/**
 * types/index.ts
 *
 * Shared TypeScript types for the backend.
 */

import type { ServerResponse } from "http";
import type OpenAI from "openai";

// ── SSE Event types ───────────────────────────────────────────────────────────

export interface AssistantDeltaEvent {
  type: "assistant_delta";
  content: string;
}

export interface AssistantDoneEvent {
  type: "assistant_done";
}

export interface ToolCallEvent {
  type: "tool_call";
  toolName: string;
  toolInput: Record<string, unknown>;
}

export interface ToolUiReadyEvent {
  type: "tool_ui_ready";
  toolCallId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolResult: Record<string, unknown>;
  fetchUrl: string;
  requiresSubmission: boolean;
}

export interface ToolResultEvent {
  type: "tool_result";
  toolName: string;
  result: Record<string, unknown>;
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export type SSEEvent =
  | AssistantDeltaEvent
  | AssistantDoneEvent
  | ToolCallEvent
  | ToolUiReadyEvent
  | ToolResultEvent
  | ErrorEvent;

// ── Session store types ───────────────────────────────────────────────────────

export interface ConversationState {
  id: string;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  pendingToolCallId?: string;
  sseClients: Set<ServerResponse>;
  createdAt: Date;
}

// ── MCP types ─────────────────────────────────────────────────────────────────

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpCallToolResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  structuredContent?: Record<string, unknown>;
  _meta?: {
    ui?: {
      resourceUri?: string;
      requiresSubmission?: boolean;
      visibility?: string[];
    };
    [key: string]: unknown;
  };
  isError?: boolean;
}

export interface McpReadResourceResult {
  text: string;
  mimeType: string;
}

// ── Agent types ───────────────────────────────────────────────────────────────

export interface AccumulatedToolCall {
  index: number;
  id: string;
  name: string;
  arguments: string;
}
