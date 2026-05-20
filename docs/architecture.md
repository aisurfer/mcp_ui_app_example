# Architecture: Meeting Booking Demo App (MCP UI)

## Overview

A demo application for booking meetings with colleagues. It showcases MCP UI capabilities: the agent calls an MCP tool that renders an interactive form in an iframe inside the chat; the user fills the form; the agent receives the submitted data, performs the booking, and displays a read-only result card — all without leaving the chat window.

---

## Services

| Service | Technology | Port | Role |
|--------|-----------|------|------|
| `frontend` | Vite + React + TypeScript | 5173 | Chat UI + iframe form renderer |
| `backend` | Node.js + Express + TypeScript | 3000 | Agent orchestrator, MCP client, SSE |
| `mcp-ui-server` | Node.js + @modelcontextprotocol/sdk + TypeScript | 3001 | MCP server with UI tools and resources |
| `booking-service` | Node.js + Express + TypeScript | 3002 | Data backend: slots, booking, MCP tool |

---

## Architecture Diagram

```
User Browser
└── Frontend (React, Vite, :5173)
    ├── Chat UI
    │   ├── Message list
    │   ├── Message input
    │   └── Tool message renderer
    │       └── McpFormFrame (iframe sandbox)
    │           └── Booking Form / Result Card HTML
    │               ├── CSS: Tailwind CDN (external)
    │               └── JS: booking-service/static/booking-form.js (external)
    │
    └── SSE connection → Backend (:3000)

Backend (:3000)
├── POST /api/chat                            ← receives user message
├── GET  /api/chat/:id/events                 ← SSE stream to frontend
├── GET  /api/mcp-ui/resources/:toolCallId    ← frontend fetches iframe HTML
├── POST /api/mcp-ui/actions                  ← forwards iframe postMessage → MCP server
│
├── Agent Orchestrator
│   ├── OpenAI Chat Completions API (tool use + streaming)
│   └── Tool loop: calls MCP tools, fans out SSE events
│
├── MCP Client (shared persistent session)
│   ├── uiClient    → mcp-ui-server (:3001)
│   └── bookingClient → booking-service (:3002/mcp)
│
└── Session Store (in-memory)
    └── Map<conversationId, ConversationState>

MCP UI Server (:3001)
├── Streamable HTTP transport
├── tools/list → [show_booking_form, submit_booking_form, show_booking_result]
├── tools/call show_booking_form(initialValues?)
│   └── returns structuredContent + _meta.ui.resourceUri="ui://booking/form"
├── tools/call submit_booking_form(formId, values)
│   └── validates + returns accepted/errors
├── tools/call show_booking_result(success, bookingId?, ...)
│   └── returns structuredContent + _meta.ui.resourceUri="ui://booking/result"
│       _meta.ui.requiresSubmission=false
├── resources/read ui://booking/form
│   └── returns interactive booking form HTML
└── resources/read ui://booking/result
    └── returns read-only result card HTML

Booking Service (:3002)
├── GET  /api/colleagues          → list of 5 colleagues
├── GET  /api/slots?colleague=X   → available time slots (deterministic mock)
├── GET  /static/booking-form.js  → JS helper loaded by the iframe
└── /mcp  (MCP endpoint)
    └── tools/call book_meeting(colleague, date, time, duration, subject)
        └── validates slot availability, returns success/failure
```

---

## Sequence: Full Booking Flow

```
User → Frontend: "book a meeting with Maria tomorrow"
Frontend → Backend: POST /api/chat
Frontend → Backend: GET /api/chat/:id/events (SSE)

Backend → OpenAI: chat.completions.create (stream, tools=[show_booking_form, book_meeting, show_booking_result])
OpenAI → Backend: tool_call: show_booking_form({ initialValues: { colleague: "maria_chen", date: "..." } })

Backend → MCP UI Server: tools/call show_booking_form(initialValues)
MCP UI Server → Backend: {
  structuredContent: { formId, title, initialValues },
  _meta: { ui: { resourceUri: "ui://booking/form" } }
}

Backend → MCP UI Server: resources/read ui://booking/form
MCP UI Server → Backend: HTML (form page)

Backend: inject __BOOKING_CONFIG__ (formId, bookingServiceUrl, initialValues) into HTML
Backend: store HTML in uiHtmlStore[toolCallId]
Backend → Frontend: SSE event "tool_ui_ready" { toolCallId, fetchUrl, requiresSubmission: true }
Backend: pause agent loop, set pendingToolCallId

Frontend: render <iframe src="/api/mcp-ui/resources/:toolCallId/view">
iframe → Booking Service: GET /api/colleagues
iframe → Booking Service: GET /api/slots?colleague=maria_chen&date=...
iframe: render form with pre-filled values and slot grid

User: fills form, clicks "Book Meeting"
iframe → Frontend: postMessage { type: "mcp_tool_call", tool: "submit_booking_form", params }
Frontend → Backend: POST /api/mcp-ui/actions
Backend → MCP UI Server: tools/call submit_booking_form(values)
MCP UI Server → Backend: { accepted: true, values }
Backend: push tool result + user message to conversation history

Backend → Frontend: GET /api/chat/:id/events (SSE, resumed)
Backend → OpenAI: chat with tool_result (submitted values)
OpenAI → Backend: tool_call: book_meeting(colleague, date, time, duration, subject)
Backend → Booking Service: MCP tools/call book_meeting(...)
Booking Service → Backend: { success: true, bookingId, details: { ... } }

Backend → OpenAI: tool_result
OpenAI → Backend: tool_call: show_booking_result(success=true, bookingId, ...)

Backend → MCP UI Server: tools/call show_booking_result(...)
MCP UI Server → Backend: {
  structuredContent: { success, bookingId, colleague, date, time, duration, subject },
  _meta: { ui: { resourceUri: "ui://booking/result", requiresSubmission: false } }
}

Backend → MCP UI Server: resources/read ui://booking/result
MCP UI Server → Backend: HTML (result card page)
Backend: inject __BOOKING_RESULT__ (bookingId, colleague, date, ...) into HTML
Backend: store HTML in uiHtmlStore[toolCallId]
Backend → Frontend: SSE "tool_ui_ready" { requiresSubmission: false }
Backend → Frontend: SSE "assistant_done"  ← loop stops, no extra LLM turn

Frontend: render <iframe src="..."> (read-only result card, no submit button)
```

---

## Pre-filled Form Scenario

```
User: "book a 30-minute meeting with Alex Morgan tomorrow at 14:00"

Backend → OpenAI: parse intent
OpenAI → Backend: tool_call: show_booking_form({
  initialValues: {
    colleague: "alex_morgan",
    date: "2026-05-21",
    time: "14:00",
    duration: "30"
  }
})

MCP UI Server: generates form with pre-filled fields
Form: checks slot availability → if unavailable, shows a warning and highlights the slot
```

---

## MCP Tools

### `show_booking_form` (visible to model)
```json
{
  "name": "show_booking_form",
  "description": "Shows a meeting booking form UI to the user.",
  "inputSchema": {
    "properties": {
      "initialValues": {
        "type": "object",
        "properties": {
          "colleague": { "type": "string" },
          "date": { "type": "string", "format": "date" },
          "time": { "type": "string" },
          "duration": { "type": "string", "enum": ["30", "60", "90", "custom"] },
          "customDuration": { "type": "number" },
          "subject": { "type": "string" }
        }
      }
    }
  }
}
```
Returns: `_meta.ui.resourceUri = "ui://booking/form"`, `requiresSubmission: true` (default)

### `submit_booking_form` (app/iframe only — hidden from model)
```json
{
  "name": "submit_booking_form",
  "_meta": { "ui": { "visibility": ["app"] } },
  "inputSchema": {
    "properties": {
      "formId": { "type": "string" },
      "values": { "type": "object" }
    }
  }
}
```
Validates submitted data, returns `{ accepted, errors?, values }`.

### `book_meeting` (visible to model — served by booking-service)
```json
{
  "name": "book_meeting",
  "description": "Books a meeting after the user confirmed the form.",
  "inputSchema": {
    "properties": {
      "colleague": { "type": "string" },
      "date": { "type": "string" },
      "time": { "type": "string" },
      "duration": { "type": "number" },
      "subject": { "type": "string" }
    },
    "required": ["colleague", "date", "time", "duration"]
  }
}
```
Validates slot availability deterministically; returns `{ success, bookingId, details }` or `{ success: false, error }`.

### `show_booking_result` (visible to model)
```json
{
  "name": "show_booking_result",
  "description": "Displays a read-only booking result card (success or failure).",
  "inputSchema": {
    "properties": {
      "success": { "type": "boolean" },
      "bookingId": { "type": "string" },
      "colleague": { "type": "string" },
      "colleagueName": { "type": "string" },
      "date": { "type": "string" },
      "time": { "type": "string" },
      "duration": { "type": "number" },
      "subject": { "type": "string" },
      "error": { "type": "string" }
    },
    "required": ["success"]
  }
}
```
Returns: `_meta.ui.resourceUri = "ui://booking/result"`, `requiresSubmission: false` — agent loop does **not** pause.

---

## SSE Events (Backend → Frontend)

```typescript
type SSEEvent =
  | { type: 'assistant_delta'; content: string }
  | { type: 'assistant_done' }
  | {
      type: 'tool_ui_ready';
      toolCallId: string;
      toolName: string;
      toolInput: Record<string, unknown>;
      toolResult: Record<string, unknown>;
      fetchUrl: string;           // /api/mcp-ui/resources/:toolCallId/view
      requiresSubmission: boolean;
    }
  | { type: 'tool_call'; toolName: string; toolInput: Record<string, unknown> }
  | { type: 'tool_result'; toolName: string; result: Record<string, unknown> }
  | { type: 'error'; message: string }
```

---

## postMessage Protocol (iframe ↔ Frontend)

```typescript
// iframe → Frontend (submit)
{ type: "mcp_tool_call", tool: "submit_booking_form", params: { formId, values } }

// iframe → Frontend (resize notification)
{ type: "ui_resize", height: number }

// Frontend → iframe (confirmation, after submit)
{ type: "mcp_tool_result", toolCallId: string, result: { accepted, errors? } }
```

The frontend filters `ui_resize` events by `event.source === iframeRef.current?.contentWindow` to prevent old submitted iframes from growing when a new form sends a resize.

---

## Colleagues (mock data)

| ID | Name | Role |
|----|------|------|
| `alex_morgan` | Alex Morgan | Senior Developer |
| `maria_chen` | Maria Chen | Product Manager |
| `david_kim` | David Kim | UX Designer |
| `elena_ross` | Elena Ross | QA Engineer |
| `ivan_petersen` | Ivan Petersen | DevOps Engineer |

Slot availability is deterministically computed from `hash(colleague + date + slot_index)` — consistent across restarts, ~40% of slots unavailable.

---

## Docker Compose

```yaml
services:
  frontend:        # Vite + React  → :5173
  backend:         # Express API   → :3000
  mcp-ui-server:   # MCP server    → :3011 (internal :3001)
  booking-service: # Data API + MCP → :3002
```

All services share the `app_network` bridge network. Source directories are mounted as volumes — no image rebuild needed for code changes.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript, OpenAI SDK |
| MCP UI Server | @modelcontextprotocol/sdk, TypeScript |
| Booking Service | Express, TypeScript, @modelcontextprotocol/sdk |
| Containerization | Docker, Docker Compose |
| LLM | OpenAI GPT-4o (chat completions + streaming tool use) |
| MCP Transport | Streamable HTTP (stateless) |
| BE → FE transport | SSE (streaming events) |
| FE → BE transport | HTTP POST |
| Iframe comms | postMessage JSON |

---

## Security Notes (for production)

- iframe `sandbox` attribute: `allow-scripts allow-forms allow-same-origin` (same-origin needed for Tailwind CDN; tighten for untrusted UI servers)
- The iframe never calls the MCP server directly — all tool calls go through `postMessage → frontend → backend → MCP`
- The backend validates all iframe actions before forwarding to MCP
- `submit_booking_form` is filtered from the OpenAI tool list (hidden from the model); only the iframe can call it
- HTML from MCP resources is cached server-side for 30 minutes; the frontend fetches it via a signed/opaque `toolCallId` URL
