/**
 * bookMeeting.ts
 *
 * MCP tool: book_meeting
 *
 * Final booking step. Always succeeds in demo mode.
 * Visible to the model.
 */

import { v4 as uuidv4 } from "uuid";

export interface BookMeetingInput {
  colleague: string;
  date: string;
  time: string;
  duration: number;
  subject?: string;
}

export interface BookMeetingResult {
  content: Array<{ type: string; text: string }>;
  structuredContent: {
    success: boolean;
    bookingId: string;
    message: string;
    details: {
      colleague: string;
      date: string;
      time: string;
      duration: number;
      subject: string;
    };
  };
}

export function handleBookMeeting(input: BookMeetingInput): BookMeetingResult {
  const bookingId = `booking_${uuidv4().replace(/-/g, "").slice(0, 12)}`;

  console.log(
    `[book_meeting] Created ${bookingId}: colleague=${input.colleague}`,
    `date=${input.date} time=${input.time} duration=${input.duration}min`
  );

  return {
    content: [{ type: "text", text: "Meeting booked successfully." }],
    structuredContent: {
      success: true,
      bookingId,
      message: "Meeting booked successfully",
      details: {
        colleague: input.colleague,
        date: input.date,
        time: input.time,
        duration: input.duration,
        subject: input.subject ?? "",
      },
    },
  };
}
