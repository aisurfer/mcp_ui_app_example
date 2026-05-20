/**
 * server.ts
 *
 * Creates the McpServer instance and registers all tools and resources.
 *
 * Tools:
 *   - show_booking_form   — visible to model + app
 *   - submit_booking_form — visible to app only (filtered by backend before sending to OpenAI)
 *   - book_meeting        — visible to model + app
 *
 * Resources:
 *   - ui://booking/form   — returns the booking form HTML page
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

import { handleShowBookingForm } from "./tools/showBookingForm";
import { handleSubmitBookingForm } from "./tools/submitBookingForm";
import { handleShowBookingResult } from "./tools/showBookingResult";
import { generateBookingFormHtml } from "./templates/bookingForm";
import { generateBookingResultHtml } from "./templates/bookingResult";

const BOOKING_SERVICE_URL =
  process.env.BOOKING_SERVICE_URL ?? "http://localhost:3002";

// ── Create server ──────────────────────────────────────────────────────────────

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "mcp-ui-server",
    version: "1.0.0",
  });

  // ── Tool: show_booking_form ──────────────────────────────────────────────────

  server.tool(
    "show_booking_form",
    "Shows a meeting booking form UI to the user. Use this when the user wants to book a meeting or schedule time with a colleague.",
    {
      initialValues: z
        .object({
          colleague: z.string().optional().describe("Colleague ID or name"),
          date: z.string().optional().describe("Meeting date YYYY-MM-DD"),
          time: z.string().optional().describe("Preferred time HH:MM"),
          duration: z
            .enum(["30", "60", "90", "custom"])
            .optional()
            .describe("Duration in minutes"),
          customDuration: z
            .number()
            .optional()
            .describe("Custom duration in minutes"),
          subject: z.string().optional().describe("Meeting subject/topic"),
        })
        .optional()
        .describe("Pre-filled form values from user's message"),
    },
    async (input) => {
      const result = handleShowBookingForm({
        initialValues: input.initialValues,
      });

      return {
        content: [{ type: "text" as const, text: result.content[0].text }],
        structuredContent: result.structuredContent,
        // _meta is passed through as an extra field on the loose schema
        _meta: result._meta as Record<string, unknown>,
      };
    }
  );

  // ── Tool: submit_booking_form ────────────────────────────────────────────────
  // Intended for app/iframe use only. The backend filters this from the
  // OpenAI tool list using _meta.ui.visibility = ["app"].

  server.tool(
    "submit_booking_form",
    "Accepts and validates meeting booking form data submitted by the user from the iframe.",
    {
      formId: z
        .string()
        .describe("Unique form identifier from show_booking_form"),
      values: z.object({
        colleague: z.string().optional().describe("Colleague ID"),
        date: z.string().optional().describe("Meeting date YYYY-MM-DD"),
        time: z.string().optional().describe("Meeting time HH:MM"),
        duration: z.number().optional().describe("Duration in minutes"),
        subject: z.string().optional().describe("Meeting subject"),
      }),
    },
    async (input) => {
      const result = handleSubmitBookingForm({
        formId: input.formId,
        values: input.values,
      });

      return {
        content: [{ type: "text" as const, text: result.content[0].text }],
        structuredContent: result.structuredContent as Record<string, unknown>,
      };
    }
  );

  // ── Tool: show_booking_result ────────────────────────────────────────────────

  server.tool(
    "show_booking_result",
    "Displays a read-only booking result card (success or failure). Always call this after book_meeting to show the outcome to the user.",
    {
      success: z.boolean().describe("Whether the booking succeeded"),
      bookingId: z.string().optional().describe("Booking ID on success"),
      colleague: z.string().optional().describe("Colleague ID"),
      colleagueName: z.string().optional().describe("Colleague display name"),
      date: z.string().optional().describe("Meeting date YYYY-MM-DD"),
      time: z.string().optional().describe("Meeting time HH:MM"),
      duration: z.number().optional().describe("Duration in minutes"),
      subject: z.string().optional().describe("Meeting subject"),
      error: z.string().optional().describe("Error description on failure"),
    },
    async (input) => {
      const result = handleShowBookingResult(input);
      return {
        content: [{ type: "text" as const, text: result.content[0].text }],
        structuredContent: result.structuredContent as Record<string, unknown>,
        _meta: result._meta as Record<string, unknown>,
      };
    }
  );

  // ── Resource: ui://booking/form ──────────────────────────────────────────────
  // ResourceMetadata = Omit<Resource, 'uri' | 'name'>, so we omit name here.

  server.resource(
    "booking-form",
    "ui://booking/form",
    {
      mimeType: "text/html;profile=mcp-app",
      description: "Interactive HTML form for booking a meeting with a colleague",
    },
    async (uri) => {
      console.log(`[resources/read] uri=${uri.href}`);

      // Generate a fresh formId for each read so it can be correlated with
      // subsequent submit_booking_form calls.
      const formId = uuidv4();

      const html = generateBookingFormHtml({
        formId,
        bookingServiceUrl: BOOKING_SERVICE_URL,
      });

      return {
        contents: [
          {
            uri: "ui://booking/form",
            mimeType: "text/html;profile=mcp-app",
            text: html,
          },
        ],
      };
    }
  );

  // ── Resource: ui://booking/result ────────────────────────────────────────────

  server.resource(
    "booking-result",
    "ui://booking/result",
    {
      mimeType: "text/html;profile=mcp-app",
      description: "Read-only booking result card (success or failure)",
    },
    async (uri) => {
      console.log(`[resources/read] uri=${uri.href}`);
      const html = generateBookingResultHtml();
      return {
        contents: [
          {
            uri: "ui://booking/result",
            mimeType: "text/html;profile=mcp-app",
            text: html,
          },
        ],
      };
    }
  );

  return server;
}
