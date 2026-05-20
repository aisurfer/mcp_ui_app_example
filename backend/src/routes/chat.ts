/**
 * routes/chat.ts
 *
 * POST /api/chat        — accept user message, start agent
 * GET  /api/chat/:id/events — SSE stream for a conversation
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getOrCreateConversation, addSseClient } from "../services/sessionStore";
import { runAgent } from "../services/agentOrchestrator";

const router = Router();

// ── POST /api/chat ────────────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as { message?: string; conversationId?: string };
    const userMessage = body.message?.trim();
    const existingId = body.conversationId?.trim();

    if (!userMessage) {
      res.status(400).json({ error: "Field 'message' is required" });
      return;
    }

    // Get or create conversation
    const conv = getOrCreateConversation(existingId);

    // Respond immediately with conversationId
    res.json({ conversationId: conv.id, status: "processing" });

    // Run agent asynchronously (does not block the HTTP response)
    runAgent(conv.id, userMessage).catch((err) => {
      console.error(`[chat] runAgent error for ${conv.id}:`, err);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chat] POST /api/chat error:", message);
    res.status(500).json({ error: message });
  }
});

// ── GET /api/chat/:conversationId/events ──────────────────────────────────────

router.get("/:conversationId/events", (req: Request, res: Response): void => {
  const { conversationId } = req.params;

  // Ensure the conversation exists
  const conv = getOrCreateConversation(conversationId);

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering if present
  res.flushHeaders();

  // Send a comment to keep the connection alive initially
  res.write(": connected\n\n");

  // Register this response as an SSE client
  const cleanup = addSseClient(conv.id, res);

  // Heartbeat every 25 seconds to keep the connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  // Clean up on client disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    cleanup();
    console.log(`[chat] SSE client disconnected from ${conv.id}`);
  });
});

export default router;
