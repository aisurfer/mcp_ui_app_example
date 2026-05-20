/**
 * routes/mcpUi.ts
 *
 * Mounted at /api, this router exposes:
 *
 *   GET  /api/mcp-ui/resources/:toolCallId/view  — serve cached form HTML
 *   POST /api/mcp-ui/actions                     — handle iframe submit actions
 *   GET  /api/booking/slots                      — proxy to booking-service
 */

import { Router, Request, Response } from "express";
import { getConversation } from "../services/sessionStore";
import { getSharedSession } from "../services/mcpClient";
import { getUiHtml } from "../services/uiHtmlStore";
import { resumeAgent } from "../services/agentOrchestrator";

const BOOKING_SERVICE_URL =
  process.env.BOOKING_SERVICE_URL ?? "http://localhost:3002";

const router = Router();

// ── GET /api/mcp-ui/resources/:toolCallId/view ────────────────────────────────

router.get(
  "/mcp-ui/resources/:toolCallId/view",
  (req: Request, res: Response): void => {
    const { toolCallId } = req.params;
    const html = getUiHtml(toolCallId);

    if (!html) {
      res.status(404).send("<h1>Form not found or expired</h1>");
      return;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  }
);

// ── POST /api/mcp-ui/actions ──────────────────────────────────────────────────

router.post(
  "/mcp-ui/actions",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as {
        conversationId?: string;
        action?: {
          type?: string;
          tool?: string;
          params?: Record<string, unknown>;
        };
      };

      const { conversationId, action } = body;

      if (!conversationId || !action) {
        res.status(400).json({
          error: "Fields 'conversationId' and 'action' are required",
        });
        return;
      }

      const conv = getConversation(conversationId);
      if (!conv) {
        res
          .status(404)
          .json({ error: `Conversation ${conversationId} not found` });
        return;
      }

      if (action.type !== "mcp_tool_call") {
        res
          .status(400)
          .json({ error: `Unsupported action type: ${action.type}` });
        return;
      }

      const toolName = action.tool;
      const toolParams = action.params ?? {};

      if (!toolName) {
        res.status(400).json({ error: "Field 'action.tool' is required" });
        return;
      }

      console.log(`[mcpUi] Action: ${toolName}`, toolParams);

      // Call the MCP tool via the shared persistent session.
      // submit_booking_form is filtered from the OpenAI tool list but reachable here.
      let toolResult: Record<string, unknown>;

      try {
        const mcpSession = await getSharedSession();
        const rawResult = await mcpSession.callTool(toolName, toolParams);
        toolResult = {
          content: rawResult.content,
          structuredContent: rawResult.structuredContent,
          isError: rawResult.isError,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[mcpUi] MCP callTool error (${toolName}):`, message);
        res.status(502).json({ error: `MCP tool call failed: ${message}` });
        return;
      }

      // Respond to the frontend with the tool result
      res.json(toolResult);

      // If this was submit_booking_form — automatically resume the agent
      if (toolName === "submit_booking_form") {
        const pendingId = conv.pendingToolCallId;
        if (pendingId) {
          const structured =
            (toolResult["structuredContent"] as
              | Record<string, unknown>
              | undefined) ?? toolResult;

          // Fire-and-forget (response already sent above)
          resumeAgent(conversationId, pendingId, structured).catch((err) => {
            console.error(
              `[mcpUi] resumeAgent error for ${conversationId}:`,
              err
            );
          });
        } else {
          console.warn(
            `[mcpUi] submit_booking_form received but no pendingToolCallId for ${conversationId}`
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[mcpUi] POST /api/mcp-ui/actions error:", message);
      res.status(500).json({ error: message });
    }
  }
);

// ── GET /api/booking/slots ────────────────────────────────────────────────────

router.get(
  "/booking/slots",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const colleague = req.query["colleague"] as string | undefined;
      const date = req.query["date"] as string | undefined;

      const params = new URLSearchParams();
      if (colleague) params.set("colleague", colleague);
      if (date) params.set("date", date);

      const url = `${BOOKING_SERVICE_URL}/api/slots?${params.toString()}`;
      console.log(`[mcpUi] Proxy GET ${url}`);

      const upstream = await fetch(url);
      const body = (await upstream.json()) as unknown;

      res.status(upstream.status).json(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[mcpUi] GET /api/booking/slots error:", message);
      res.status(502).json({ error: `Booking service error: ${message}` });
    }
  }
);

export default router;
