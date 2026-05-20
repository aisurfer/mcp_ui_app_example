/**
 * services/uiHtmlStore.ts
 *
 * Module-level cache of rendered HTML pages keyed by toolCallId.
 * Used by the GET /api/mcp-ui/resources/:toolCallId/view endpoint.
 * Entries expire after 30 minutes to avoid unbounded growth.
 */

const store = new Map<string, string>();
const TTL_MS = 30 * 60 * 1000;

export function storeUiHtml(toolCallId: string, html: string): void {
  store.set(toolCallId, html);
  setTimeout(() => store.delete(toolCallId), TTL_MS);
}

export function getUiHtml(toolCallId: string): string | undefined {
  return store.get(toolCallId);
}
