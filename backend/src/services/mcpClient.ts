/**
 * services/mcpClient.ts
 *
 * MCP client supporting two servers:
 *   - mcp-ui-server   → show_booking_form, submit_booking_form (+ UI resources)
 *   - booking-service → book_meeting
 *
 * A single shared connection pair is kept alive for the lifetime of the process.
 * The MCP initialize handshake (3 requests per server) happens exactly once.
 * Individual tool calls are then a single POST each.
 *
 * Public API:
 *   getSharedSession()   — returns (creating if needed) the singleton
 *   resetSharedSession() — closes and clears it so the next call reconnects
 *   clearToolsCache()    — forces re-fetch of tool list on the next listTools()
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {
  McpToolDefinition,
  McpCallToolResult,
  McpReadResourceResult,
} from "../types/index";

const MCP_UI_SERVER_URL =
  process.env.MCP_UI_SERVER_URL ?? "http://localhost:3001/mcp";

const BOOKING_MCP_URL =
  process.env.BOOKING_MCP_URL ?? "http://localhost:3002/mcp";

// ── Tools cache ───────────────────────────────────────────────────────────────

interface ToolsCache {
  tools: McpToolDefinition[];
  toolOwner: Map<string, "ui" | "booking">;
}

let _toolsCache: ToolsCache | null = null;

/** Force re-fetch of the tool list on the next listTools() call. */
export function clearToolsCache(): void {
  _toolsCache = null;
}

// ── Shared session singleton ──────────────────────────────────────────────────

let _sharedSession: McpClientSession | null = null;
let _creating: Promise<McpClientSession> | null = null;

/**
 * Returns the shared session, creating it on first call.
 * Concurrent callers wait on the same promise so only one connection is made.
 */
export async function getSharedSession(): Promise<McpClientSession> {
  if (_sharedSession) return _sharedSession;

  if (!_creating) {
    _creating = McpClientSession.create()
      .then((s) => {
        _sharedSession = s;
        _creating = null;
        console.log("[mcpClient] Shared session established");
        return s;
      })
      .catch((err) => {
        _creating = null;
        throw err;
      });
  }

  return _creating;
}

/**
 * Closes the shared session and clears the singleton.
 * The next getSharedSession() call will reconnect.
 * Call this when a tool call fails with a network/transport error.
 */
export function resetSharedSession(): void {
  if (_sharedSession) {
    _sharedSession.close().catch(() => { /* best-effort */ });
    _sharedSession = null;
  }
  _creating = null;
  console.log("[mcpClient] Shared session reset");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function connect(url: string): Promise<Client> {
  const client = new Client({ name: "backend-agent", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(url));
  await client.connect(transport);
  return client;
}

function extractResult(raw: unknown): McpCallToolResult {
  const r = raw as Record<string, unknown>;
  return {
    content: (r["content"] as McpCallToolResult["content"]) ?? [],
    structuredContent: r["structuredContent"] as Record<string, unknown> | undefined,
    _meta: r["_meta"] as McpCallToolResult["_meta"],
    isError: (r["isError"] as boolean | undefined) ?? false,
  };
}

// ── McpClientSession ──────────────────────────────────────────────────────────

export class McpClientSession {
  private uiClient: Client;
  private bookingClient: Client;
  private toolOwner: Map<string, "ui" | "booking"> = new Map();

  private constructor(uiClient: Client, bookingClient: Client) {
    this.uiClient = uiClient;
    this.bookingClient = bookingClient;
  }

  static async create(): Promise<McpClientSession> {
    const [uiClient, bookingClient] = await Promise.all([
      connect(MCP_UI_SERVER_URL),
      connect(BOOKING_MCP_URL),
    ]);
    return new McpClientSession(uiClient, bookingClient);
  }

  /**
   * List tools from both servers merged.
   * Excludes submit_booking_form (app-only).
   * Result is cached until clearToolsCache() is called.
   */
  async listTools(): Promise<McpToolDefinition[]> {
    if (_toolsCache) {
      this.toolOwner = new Map(_toolsCache.toolOwner);
      return _toolsCache.tools;
    }

    const [uiResp, bookingResp] = await Promise.all([
      this.uiClient.listTools(),
      this.bookingClient.listTools(),
    ]);

    const results: McpToolDefinition[] = [];

    for (const t of uiResp.tools) {
      if (t.name === "submit_booking_form") continue;
      this.toolOwner.set(t.name, "ui");
      results.push({
        name: t.name,
        description: t.description ?? "",
        inputSchema: t.inputSchema as Record<string, unknown>,
      });
    }

    for (const t of bookingResp.tools) {
      this.toolOwner.set(t.name, "booking");
      results.push({
        name: t.name,
        description: t.description ?? "",
        inputSchema: t.inputSchema as Record<string, unknown>,
      });
    }

    _toolsCache = { tools: results, toolOwner: new Map(this.toolOwner) };
    console.log("[mcpClient] Tools cached:", results.map((t) => t.name).join(", "));
    return results;
  }

  /** Routes the call to the correct server based on the tool registry. */
  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<McpCallToolResult> {
    const owner = this.toolOwner.get(name);
    const client = owner === "booking" ? this.bookingClient : this.uiClient;
    const response = await client.callTool({ name, arguments: args });
    return extractResult(response);
  }

  /** Reads an MCP resource (always from the ui-server). */
  async readResource(uri: string): Promise<McpReadResourceResult> {
    const response = await this.uiClient.readResource({ uri });
    const first = response.contents?.[0];

    if (!first) {
      throw new Error(`[mcpClient] readResource returned no contents for ${uri}`);
    }

    return {
      text: (first as { text?: string }).text ?? "",
      mimeType: first.mimeType ?? "text/html",
    };
  }

  async close(): Promise<void> {
    await Promise.allSettled([
      this.uiClient.close(),
      this.bookingClient.close(),
    ]);
  }
}
