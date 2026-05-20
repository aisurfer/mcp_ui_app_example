/**
 * services/agentOrchestrator.ts
 *
 * Agent orchestrator: drives the OpenAI tool-use loop integrated with the
 * MCP UI server and streams SSE events to connected frontend clients.
 */

import OpenAI from "openai";
import { getSharedSession, resetSharedSession } from "./mcpClient";
import { getConversation } from "./sessionStore";
import { storeUiHtml } from "./uiHtmlStore";
import type {
  SSEEvent,
  ConversationState,
  AccumulatedToolCall,
} from "../types/index";

// ── Config ────────────────────────────────────────────────────────────────────

const OPENAI_MODEL =
  process.env.OPENAI_MODEL ?? "gpt-5-nano-2025-08-07";

const SYSTEM_PROMPT = `You are a meeting booking assistant that helps schedule time with colleagues.

Available colleagues:
- Alex Morgan (alex_morgan) — Senior Developer
- Maria Chen (maria_chen) — Product Manager
- David Kim (david_kim) — UX Designer
- Elena Ross (elena_ross) — QA Engineer
- Ivan Petersen (ivan_petersen) — DevOps Engineer

When the user wants to book a meeting:
1. Call show_booking_form with initialValues if the user has already specified parameters (colleague name, date, time, duration, subject).
2. If the user mentioned a colleague — pass their id (alex_morgan, maria_chen, etc.)
3. After the user fills in the form, you will receive a tool_result with the submitted data.
4. Call book_meeting with that data to perform the booking.
5. Immediately after book_meeting, call show_booking_result to display the result card:
   - On success (success=true): pass success=true, bookingId, and all fields from details (colleague, colleagueName, date, time, duration, subject).
   - On failure (success=false): pass success=false and an error field explaining the reason.
6. Briefly confirm the result to the user in one sentence.

Be friendly and concise.`;

// ── OpenAI client (lazily created) ────────────────────────────────────────────

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// ── SSE helpers ───────────────────────────────────────────────────────────────

function sendSseEvent(conv: ConversationState, event: SSEEvent): void {
  const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of conv.sseClients) {
    try {
      client.write(data);
    } catch (err) {
      console.warn("[orchestrator] Failed to write SSE event:", err);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Ensures every assistant tool_call in the history has a matching tool result.
 * If the user interrupted a pending UI form, we inject synthetic cancellation
 * results so OpenAI doesn't reject the next request with a 400.
 */
function cancelPendingToolCalls(conv: ConversationState): void {
  const resolvedIds = new Set<string>();
  for (const msg of conv.messages) {
    if (msg.role === "tool" && msg.tool_call_id) {
      resolvedIds.add(msg.tool_call_id);
    }
  }

  let cancelled = false;
  for (let i = conv.messages.length - 1; i >= 0; i--) {
    const msg = conv.messages[i];
    if (msg.role !== "assistant" || !msg.tool_calls) continue;

    const unresolved = msg.tool_calls.filter(tc => !resolvedIds.has(tc.id));
    if (unresolved.length === 0) continue;

    const synthetic = unresolved.map(tc => {
      console.log(`[orchestrator] Cancelling tool call ${tc.id} (${tc.function.name})`);
      resolvedIds.add(tc.id);
      return {
        role: "tool" as const,
        tool_call_id: tc.id,
        content: JSON.stringify({ cancelled: true, reason: "User sent a new message before completing the form" }),
      };
    });

    conv.messages.splice(i + 1, 0, ...synthetic);
    cancelled = true;
  }

  if (cancelled) {
    conv.pendingToolCallId = undefined;
  }
}

// ── Main agent entry points ───────────────────────────────────────────────────

export async function runAgent(
  conversationId: string,
  userMessage?: string
): Promise<void> {
  const conv = getConversation(conversationId);
  if (!conv) {
    console.error(`[orchestrator] runAgent: conversation ${conversationId} not found`);
    return;
  }

  cancelPendingToolCalls(conv);

  if (userMessage) {
    conv.messages.push({ role: "user", content: userMessage });
  }

  await runAgentLoop(conv);
}

export async function resumeAgent(
  conversationId: string,
  toolCallId: string,
  submitResult: Record<string, unknown>
): Promise<void> {
  const conv = getConversation(conversationId);
  if (!conv) {
    console.error(`[orchestrator] resumeAgent: conversation ${conversationId} not found`);
    return;
  }

  const values = (submitResult["values"] ?? submitResult) as Record<string, unknown>;
  const summary = [
    values["colleague"] ? `colleague=${String(values["colleague"])}` : null,
    values["date"] ? `date=${String(values["date"])}` : null,
    values["time"] ? `time=${String(values["time"])}` : null,
    values["duration"] ? `duration=${String(values["duration"])}` : null,
    values["subject"] ? `subject=${String(values["subject"])}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  conv.messages.push({
    role: "tool",
    tool_call_id: toolCallId,
    content: JSON.stringify(submitResult),
  });

  conv.messages.push({
    role: "user",
    content: `User submitted the form: ${summary}`,
  });

  conv.pendingToolCallId = undefined;

  await runAgentLoop(conv);
}

// ── Core agent loop ───────────────────────────────────────────────────────────

async function runAgentLoop(conv: ConversationState): Promise<void> {
  const openai = getOpenAI();

  let mcpSession;
  try {
    mcpSession = await getSharedSession();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[orchestrator] Failed to connect to MCP server:", message);
    sendSseEvent(conv, { type: "error", message: `MCP connection failed: ${message}` });
    return;
  }

  const publicBookingUrl = process.env.PUBLIC_BOOKING_URL ?? "http://localhost:3002";
  const internalBookingUrl = process.env.BOOKING_SERVICE_URL ?? "http://booking-service:3002";

  try {
    const mcpTools = await mcpSession.listTools();
    const tools: OpenAI.Chat.ChatCompletionTool[] = mcpTools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    let continueLoop = true;

    while (continueLoop) {
      continueLoop = false;

      let assistantContent = "";
      const accumulatedToolCalls: Map<number, AccumulatedToolCall> = new Map();
      let finishReason: string | null = null;

      const stream = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...conv.messages,
        ],
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
        stream: true,
      });

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;

        if (delta.content) {
          assistantContent += delta.content;
          sendSseEvent(conv, { type: "assistant_delta", content: delta.content });
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!accumulatedToolCalls.has(idx)) {
              accumulatedToolCalls.set(idx, {
                index: idx,
                id: tc.id ?? "",
                name: tc.function?.name ?? "",
                arguments: tc.function?.arguments ?? "",
              });
            } else {
              const existing = accumulatedToolCalls.get(idx)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name += tc.function.name;
              if (tc.function?.arguments) existing.arguments += tc.function.arguments;
            }
          }
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
      }

      if (finishReason === "tool_calls" && accumulatedToolCalls.size > 0) {
        const toolCallsForMessage: OpenAI.Chat.ChatCompletionMessageToolCall[] =
          Array.from(accumulatedToolCalls.values()).map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.arguments },
          }));

        conv.messages.push({
          role: "assistant",
          content: assistantContent || null,
          tool_calls: toolCallsForMessage,
        });

        let pauseForUi = false;

        for (const tc of Array.from(accumulatedToolCalls.values())) {
          let toolInput: Record<string, unknown> = {};
          try {
            toolInput = JSON.parse(tc.arguments || "{}") as Record<string, unknown>;
          } catch {
            console.warn(`[orchestrator] Failed to parse tool arguments for ${tc.name}:`, tc.arguments);
          }

          console.log(`[orchestrator] Tool call: ${tc.name}`, toolInput);
          sendSseEvent(conv, { type: "tool_call", toolName: tc.name, toolInput });

          let toolResult: Record<string, unknown>;
          try {
            const mcpResult = await mcpSession!.callTool(tc.name, toolInput);
            toolResult = {
              content: mcpResult.content,
              structuredContent: mcpResult.structuredContent,
              _meta: mcpResult._meta,
              isError: mcpResult.isError,
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[orchestrator] MCP callTool error for ${tc.name}:`, message);
            sendSseEvent(conv, { type: "error", message: `Tool call failed: ${message}` });
            toolResult = { error: message };
          }

          // ── Check for UI resource ─────────────────────────────────────────────

          const meta = toolResult["_meta"] as
            | { ui?: { resourceUri?: string; requiresSubmission?: boolean } }
            | undefined;
          const resourceUri = meta?.ui?.resourceUri;
          // Default: interactive form requires submission; read-only card does not.
          const requiresSubmission = meta?.ui?.requiresSubmission !== false;

          if (resourceUri) {
            let html = "";
            try {
              const resource = await mcpSession!.readResource(resourceUri);
              html = resource.text;
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              console.error("[orchestrator] readResource error:", message);
              sendSseEvent(conv, { type: "error", message: `Failed to load UI: ${message}` });
            }

            if (html) {
              // Remap internal Docker URL to the public-facing URL
              html = html.split(internalBookingUrl).join(publicBookingUrl);

              const structured = (toolResult["structuredContent"] as Record<string, unknown>) ?? {};

              // Inject booking form config (__BOOKING_CONFIG__)
              if (html.includes("window.__BOOKING_CONFIG__ =")) {
                const formId = (structured["formId"] as string | undefined) ?? `form-${tc.id}`;
                const initialValues = (structured["initialValues"] as Record<string, unknown>) ?? {};
                const injectedConfig = JSON.stringify({ formId, bookingServiceUrl: publicBookingUrl, initialValues });
                html = html.replace(
                  "window.__BOOKING_CONFIG__ =",
                  `window.__BOOKING_CONFIG__ = ${injectedConfig}; window.__BOOKING_CONFIG__ORIG =`
                );
              }

              // Inject booking result data (__BOOKING_RESULT__)
              if (html.includes("window.__BOOKING_RESULT__ =")) {
                html = html.replace(
                  "window.__BOOKING_RESULT__ =",
                  `window.__BOOKING_RESULT__ = ${JSON.stringify(structured)}; window.__BOOKING_RESULT__ORIG =`
                );
              }
            }

            // Store HTML for the GET endpoint (both interactive and read-only)
            storeUiHtml(tc.id, html);

            const fetchUrl = `/api/mcp-ui/resources/${encodeURIComponent(tc.id)}/view`;

            sendSseEvent(conv, {
              type: "tool_ui_ready",
              toolCallId: tc.id,
              toolName: tc.name,
              toolInput,
              toolResult,
              fetchUrl,
              requiresSubmission,
            });

            if (requiresSubmission) {
              // Interactive form: pause and wait for user to submit
              conv.pendingToolCallId = tc.id;
              pauseForUi = true;
              break;
            } else {
              // Read-only card: push result to history, then stop — the card is self-sufficient
              conv.messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(toolResult),
              });
              pauseForUi = true;
              break;
            }
          } else {
            // Regular non-UI tool: push result and continue
            sendSseEvent(conv, { type: "tool_result", toolName: tc.name, result: toolResult });
            conv.messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify(toolResult),
            });
          }
        }

        if (!pauseForUi) {
          continueLoop = true;
        } else {
          sendSseEvent(conv, { type: "assistant_done" });
        }
      } else {
        if (assistantContent) {
          conv.messages.push({ role: "assistant", content: assistantContent });
        }
        sendSseEvent(conv, { type: "assistant_done" });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[orchestrator] Agent loop error:", message);
    sendSseEvent(conv, { type: "error", message });
    resetSharedSession();
  }
}
