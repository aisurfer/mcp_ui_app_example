import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  COLLEAGUES,
  generateSlots,
  getTomorrowDate,
  isValidDate,
  findColleague,
} from "./data";
import { createBookingMcpServer } from "./mcpServer";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3002", 10);

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Static files — serves public/booking-form.js at /static/booking-form.js
app.use("/static", express.static(path.join(__dirname, "..", "public")));

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/colleagues
 * Returns the list of mock colleagues.
 */
app.get("/api/colleagues", (_req: Request, res: Response) => {
  try {
    res.json(COLLEAGUES);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error in GET /api/colleagues:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/slots?colleague=:id&date=:YYYY-MM-DD
 * Returns available time slots for a colleague on a given date.
 * If date is omitted, tomorrow is used.
 */
app.get("/api/slots", (req: Request, res: Response) => {
  try {
    const colleague = (req.query.colleague as string | undefined)?.trim();
    let date = (req.query.date as string | undefined)?.trim();

    if (!colleague) {
      res.status(400).json({ error: "Query parameter 'colleague' is required" });
      return;
    }

    if (!findColleague(colleague)) {
      res.status(404).json({ error: `Colleague '${colleague}' not found` });
      return;
    }

    if (!date) {
      date = getTomorrowDate();
    } else if (!isValidDate(date)) {
      res.status(400).json({ error: "Invalid date format. Expected YYYY-MM-DD" });
      return;
    }

    const slots = generateSlots(colleague, date);

    const response = {
      colleague,
      date,
      slots,
    };

    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error in GET /api/slots:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/book
 * Creates a booking (always succeeds in demo mode).
 * Body: { colleague, date, time, duration, subject? }
 */
app.post("/api/book", (req: Request, res: Response) => {
  try {
    const { colleague, date, time, duration, subject } = req.body as {
      colleague?: string;
      date?: string;
      time?: string;
      duration?: string | number;
      subject?: string;
    };

    if (!colleague || !date || !time || !duration) {
      res.status(400).json({
        error: "Fields 'colleague', 'date', 'time', and 'duration' are required",
      });
      return;
    }

    const bookingId = `booking_${Math.random().toString(36).slice(2, 10)}`;

    console.log(`[booking] Created booking ${bookingId} for ${colleague} on ${date} at ${time}`);

    res.json({
      success: true,
      bookingId,
      message: "Meeting booked successfully",
      details: {
        colleague,
        date,
        time,
        duration,
        subject: subject ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error in POST /api/book:", message);
    res.status(500).json({ error: message });
  }
});

// ── MCP endpoint (Streamable HTTP, stateless) ─────────────────────────────────

app.all("/mcp", async (req: Request, res: Response) => {
  try {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id");
    res.header("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    const server = createBookingMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mcp] Error handling request:", message);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
    }
  }
});

// ── 404 fallback ──────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Start server ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[booking-service] Listening on port ${PORT}`);
});

export default app;
