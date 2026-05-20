/**
 * index.ts
 *
 * Express application entry point.
 *
 * Routes:
 *   POST  /api/chat                            — start/continue a conversation
 *   GET   /api/chat/:conversationId/events     — SSE stream
 *   GET   /api/mcp-ui/resources/:id/view       — serve cached form HTML
 *   POST  /api/mcp-ui/actions                  — handle iframe actions
 *   GET   /api/booking/slots                   — proxy to booking-service
 *   GET   /health                              — health check
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import chatRouter from "./routes/chat";
import mcpUiRouter from "./routes/mcpUi";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

// ── Middleware ────────────────────────────────────────────────────────────────

// Allow all origins for demo purposes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Chat endpoints
//   POST /api/chat
//   GET  /api/chat/:conversationId/events
app.use("/api/chat", chatRouter);

// MCP UI + booking proxy
//   GET  /api/mcp-ui/resources/:toolCallId/view
//   POST /api/mcp-ui/actions
//   GET  /api/booking/slots   ← the router defines this as "/booking/slots"
//                               so we mount the whole router at "/api"
app.use("/api", mcpUiRouter);

// ── 404 fallback ──────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[app] Unhandled error:", message);
  res.status(500).json({ error: message });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[backend] Listening on port ${PORT}`);
  console.log(
    `[backend] OpenAI model: ${process.env.OPENAI_MODEL ?? "gpt-5-nano-2025-08-07 (default)"}`
  );
  console.log(
    `[backend] MCP UI server: ${process.env.MCP_UI_SERVER_URL ?? "http://localhost:3001/mcp (default)"}`
  );
  console.log(
    `[backend] Booking service: ${process.env.BOOKING_SERVICE_URL ?? "http://localhost:3002 (default)"}`
  );
});

export default app;
