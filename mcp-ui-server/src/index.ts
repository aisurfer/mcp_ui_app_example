/**
 * index.ts
 *
 * Express HTTP server with Streamable HTTP transport for MCP.
 *
 * Routes:
 *   POST /mcp   — MCP protocol (Streamable HTTP transport, stateless)
 *   GET  /mcp   — SSE for server-initiated messages (optional, same handler)
 *   DELETE /mcp — Session termination
 *   GET  /health — Health check
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

// ── Express setup ──────────────────────────────────────────────────────────────

const app = express();

app.use(cors());
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ── Health check ───────────────────────────────────────────────────────────────

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "mcp-ui-server" });
});

// ── MCP endpoint (Streamable HTTP transport) ───────────────────────────────────
//
// Each request gets its own McpServer + transport instance (stateless / sessionless).
// This is the simplest deployment model; no session state is maintained between calls.

app.all("/mcp", async (req: Request, res: Response) => {
  try {
    // Set CORS headers explicitly for MCP endpoint
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, mcp-session-id"
    );
    res.header("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    // Create a fresh server + transport for each request (stateless mode)
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      // sessionIdGenerator: undefined → no persistent sessions
      sessionIdGenerator: undefined,
    });

    // Connect server to transport (wires up message handling)
    await server.connect(transport);

    // Handle the incoming HTTP request through the transport
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mcp] Error handling request:", message);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null,
      });
    }
  }
});

// ── 404 fallback ───────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Start ──────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[mcp-ui-server] Listening on port ${PORT}`);
  console.log(`[mcp-ui-server] MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(
    `[mcp-ui-server] Booking service: ${process.env.BOOKING_SERVICE_URL ?? "http://localhost:3002"}`
  );
});

export default app;
