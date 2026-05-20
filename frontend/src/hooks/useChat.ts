import { useState, useRef, useCallback } from "react";
import { Message, ToolUiMessage, isToolUiMessage } from "../types";

let messageIdCounter = 0;
function nextId(): string {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

export function useChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const openEventSource = useCallback(
    (convId: string) => {
      closeEventSource();

      const es = new EventSource(`/api/chat/${convId}/events`);
      eventSourceRef.current = es;

      // assistant_delta: stream text into last assistant message
      es.addEventListener("assistant_delta", (e) => {
        const data = JSON.parse(e.data) as { content: string };
        setMessages((prev) => {
          // Clear any pending tool indicator before streaming text
          const clean = prev.filter((m) => !m.content.startsWith("__tool_indicator__"));
          const last = clean[clean.length - 1];
          if (!last || last.role !== "assistant" || isToolUiMessage(last)) {
            return [...clean, { id: nextId(), role: "assistant", content: data.content, isStreaming: true }];
          }
          return clean.map((msg, idx) =>
            idx === clean.length - 1
              ? { ...msg, content: msg.content + data.content, isStreaming: true }
              : msg
          );
        });
      });

      // assistant_done: finalize streaming, clear any leftover indicator
      es.addEventListener("assistant_done", () => {
        setMessages((prev) => {
          const clean = prev.filter((m) => !m.content.startsWith("__tool_indicator__"));
          return clean.map((msg, idx) =>
            idx === clean.length - 1 ? { ...msg, isStreaming: false } : msg
          );
        });
        setIsLoading(false);
        closeEventSource();
      });

      // tool_ui_ready: add a ToolUiMessage
      es.addEventListener("tool_ui_ready", (e) => {
        const data = JSON.parse(e.data) as {
          toolCallId: string;
          toolName: string;
          fetchUrl: string;
          toolInput: Record<string, unknown>;
          toolResult: Record<string, unknown>;
          requiresSubmission: boolean;
        };
        const toolMsg: ToolUiMessage = {
          id: nextId(),
          role: "assistant",
          content: "",
          toolUi: {
            toolCallId: data.toolCallId,
            toolName: data.toolName,
            fetchUrl: data.fetchUrl,
            toolInput: data.toolInput,
            toolResult: data.toolResult,
            requiresSubmission: data.requiresSubmission,
          },
          formSubmitted: false,
        };
        setMessages((prev) => {
          // remove trailing tool_call indicator if present
          const withoutIndicator = prev.filter(
            (m) => !m.content.startsWith("__tool_indicator__")
          );
          return [...withoutIndicator, toolMsg];
        });
        // keep loading — agent awaits form submission
      });

      // tool_call: replace any existing indicator with the new one
      // (don't remove on tool_result — let it stay until the next event clears it)
      es.addEventListener("tool_call", (e) => {
        const data = JSON.parse(e.data) as { toolName?: string };
        const toolLabels: Record<string, string> = {
          show_booking_form: "Opening booking form...",
          book_meeting: "Processing booking...",
          show_booking_result: "Preparing result...",
          submit_booking_form: "Submitting form...",
        };
        const label = toolLabels[data.toolName ?? ""] ?? `Calling ${data.toolName ?? "tool"}...`;
        const indicator: Message = {
          id: nextId(),
          role: "assistant",
          content: `__tool_indicator__${label}`,
          isStreaming: true,
        };
        setMessages((prev) => {
          // Replace existing indicator so only one is shown at a time
          const withoutIndicator = prev.filter((m) => !m.content.startsWith("__tool_indicator__"));
          return [...withoutIndicator, indicator];
        });
      });

      // tool_result: intentionally no-op — indicator stays until the next
      // tool_call replaces it, or assistant_delta/done clears it

      // error event
      es.addEventListener("error", (e) => {
        let errorText = "An error occurred";
        if (e instanceof MessageEvent) {
          try {
            const data = JSON.parse(e.data) as { message?: string };
            errorText = data.message ?? errorText;
          } catch {
            // ignore parse errors
          }
        }
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: `Error: ${errorText}`,
          },
        ]);
        setIsLoading(false);
        closeEventSource();
      });

      // native onerror (connection lost)
      es.onerror = () => {
        setIsLoading(false);
        closeEventSource();
      };
    },
    [closeEventSource]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Message = {
        id: nextId(),
        role: "user",
        content: text.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            conversationId: conversationId ?? undefined,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const body = (await res.json()) as { conversationId: string };
        const convId = body.conversationId;
        setConversationId(convId);
        openEventSource(convId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: `Connection error: ${message}`,
          },
        ]);
        setIsLoading(false);
      }
    },
    [conversationId, isLoading, openEventSource]
  );

  const submitForm = useCallback(
    async (toolCallId: string, params: unknown) => {
      if (!conversationId) return;

      try {
        const res = await fetch("/api/mcp-ui/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            action: {
              type: "mcp_tool_call",
              tool: "submit_booking_form",
              params,
            },
          }),
        });

        const result = (await res.json()) as Record<string, unknown>;

        // Mark the form as submitted
        setMessages((prev) =>
          prev.map((msg) => {
            if (isToolUiMessage(msg) && msg.toolUi.toolCallId === toolCallId) {
              return { ...msg, formSubmitted: true, formResult: result };
            }
            return msg;
          })
        );

        // Resume agent SSE stream
        setIsLoading(true);
        openEventSource(conversationId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: `Form submission error: ${message}`,
          },
        ]);
      }
    },
    [conversationId, openEventSource]
  );

  const newChat = useCallback(() => {
    closeEventSource();
    setConversationId(null);
    setMessages([]);
    setIsLoading(false);
  }, [closeEventSource]);

  return { messages, isLoading, conversationId, sendMessage, submitForm, newChat };
}
