/**
 * tools/showBookingResult.ts
 *
 * MCP tool: show_booking_result
 *
 * Displays a read-only result card (success or failure) after book_meeting.
 * Returns _meta.ui.resourceUri so the backend fetches the HTML card,
 * and _meta.ui.requiresSubmission = false so the agent loop continues
 * without waiting for user form submission.
 */

export interface ShowBookingResultInput {
  success: boolean;
  bookingId?: string;
  colleague?: string;
  colleagueName?: string;
  date?: string;
  time?: string;
  duration?: number;
  subject?: string;
  error?: string;
}

export function handleShowBookingResult(input: ShowBookingResultInput) {
  const text = input.success
    ? `Meeting booked. ID: ${input.bookingId ?? "—"}`
    : `Booking failed: ${input.error ?? "unknown reason"}`;

  console.log("[show_booking_result]", text);

  return {
    content: [{ type: "text" as const, text }],
    structuredContent: {
      success: input.success,
      bookingId: input.bookingId,
      colleague: input.colleague,
      colleagueName: input.colleagueName,
      date: input.date,
      time: input.time,
      duration: input.duration,
      subject: input.subject,
      error: input.error,
    },
    _meta: {
      ui: {
        resourceUri: "ui://booking/result",
        requiresSubmission: false,
        visibility: ["model", "app"],
      },
    },
  };
}
