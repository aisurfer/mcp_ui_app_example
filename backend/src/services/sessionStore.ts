/**
 * services/sessionStore.ts
 *
 * In-memory store for conversation state.
 * Each conversation holds its message history, pending UI state,
 * and active SSE client responses.
 */

import type { ServerResponse } from "http";
import type { ConversationState } from "../types/index";
import { v4 as uuidv4 } from "uuid";
import { clearToolsCache } from "./mcpClient";

// ── Store ─────────────────────────────────────────────────────────────────────

const store = new Map<string, ConversationState>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new conversation and return it.
 */
export function createConversation(): ConversationState {
  const id = `conv_${uuidv4()}`;
  const state: ConversationState = {
    id,
    messages: [],
    sseClients: new Set<ServerResponse>(),
    createdAt: new Date(),
  };
  store.set(id, state);
  clearToolsCache();
  console.log(`[sessionStore] Created conversation ${id}`);
  return state;
}

/**
 * Get an existing conversation by id.
 * Returns undefined if not found.
 */
export function getConversation(id: string): ConversationState | undefined {
  return store.get(id);
}

/**
 * Get or create a conversation by id.
 * If id is provided and found, returns it. Otherwise creates a new one.
 */
export function getOrCreateConversation(id?: string): ConversationState {
  if (id) {
    const existing = store.get(id);
    if (existing) return existing;
    console.warn(`[sessionStore] Conversation ${id} not found — creating new one`);
  }
  return createConversation();
}

/**
 * Register an SSE client response for a conversation.
 * Returns a cleanup function that removes the client.
 */
export function addSseClient(
  conversationId: string,
  res: ServerResponse
): () => void {
  const conv = store.get(conversationId);
  if (!conv) {
    console.warn(`[sessionStore] addSseClient: conversation ${conversationId} not found`);
    return () => { /* noop */ };
  }
  conv.sseClients.add(res);
  console.log(
    `[sessionStore] SSE client added to ${conversationId} (total: ${conv.sseClients.size})`
  );
  return () => {
    conv.sseClients.delete(res);
    console.log(
      `[sessionStore] SSE client removed from ${conversationId} (total: ${conv.sseClients.size})`
    );
  };
}

/**
 * Find a conversation that has a specific pendingToolCallId.
 * Used to look up the session from a toolCallId in the URL.
 */
export function findConversationByToolCallId(
  toolCallId: string
): ConversationState | undefined {
  for (const conv of store.values()) {
    if (conv.pendingToolCallId === toolCallId) return conv;
  }
  return undefined;
}

/**
 * Delete a conversation from the store.
 */
export function deleteConversation(id: string): void {
  store.delete(id);
  console.log(`[sessionStore] Deleted conversation ${id}`);
}

/**
 * Return the number of stored conversations (for debugging).
 */
export function conversationCount(): number {
  return store.size;
}
