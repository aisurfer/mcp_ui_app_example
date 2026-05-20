/**
 * mcpServer.ts
 *
 * MCP server for the booking-service.
 *
 * Tools:
 *   - book_meeting — performs the actual calendar booking
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { findColleague, generateSlots } from "./data";

export function createBookingMcpServer(): McpServer {
  const server = new McpServer({
    name: "booking-service-mcp",
    version: "1.0.0",
  });

  server.tool(
    "book_meeting",
    "Books a meeting with a colleague in the corporate calendar. Call this after the user has confirmed the booking details via the form.",
    {
      colleague: z.string().describe("Colleague ID (e.g. alex_petrov)"),
      date: z.string().describe("Meeting date YYYY-MM-DD"),
      time: z.string().describe("Meeting time HH:MM"),
      duration: z.number().describe("Duration in minutes"),
      subject: z.string().optional().describe("Meeting subject/topic"),
    },
    async (input) => {
      const colleague = findColleague(input.colleague);
      if (!colleague) {
        return {
          content: [{ type: "text" as const, text: `Colleague '${input.colleague}' not found` }],
          structuredContent: {
            success: false,
            error: `Colleague with ID '${input.colleague}' was not found in the system.`,
          } as Record<string, unknown>,
        };
      }

      const slots = generateSlots(input.colleague, input.date);
      const slot = slots.find((s) => s.time === input.time);
      if (!slot || !slot.available) {
        const reason = !slot
          ? `Slot ${input.time} does not exist in the schedule`
          : `Slot ${input.time} on ${input.date} is already taken for ${colleague.name}`;
        console.log(`[book_meeting] Slot unavailable: ${reason}`);
        return {
          content: [{ type: "text" as const, text: "Slot unavailable" }],
          structuredContent: {
            success: false,
            error: reason + ". Please choose a different time.",
          } as Record<string, unknown>,
        };
      }

      const bookingId = `booking_${uuidv4().replace(/-/g, "").slice(0, 12)}`;

      console.log(
        `[book_meeting] Created ${bookingId}: colleague=${input.colleague}`,
        `date=${input.date} time=${input.time} duration=${input.duration}min`
      );

      return {
        content: [{ type: "text" as const, text: "Meeting booked successfully." }],
        structuredContent: {
          success: true,
          bookingId,
          message: "Meeting booked successfully",
          details: {
            colleague: input.colleague,
            colleagueName: colleague.name,
            date: input.date,
            time: input.time,
            duration: input.duration,
            subject: input.subject ?? "",
          },
        } as Record<string, unknown>,
      };
    }
  );

  return server;
}
