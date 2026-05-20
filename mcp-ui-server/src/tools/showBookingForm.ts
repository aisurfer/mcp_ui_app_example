/**
 * showBookingForm.ts
 *
 * MCP tool: show_booking_form
 *
 * Generates a unique formId and returns a tool response with _meta.ui.resourceUri
 * pointing to the booking form resource. Visible to both model and app.
 */

import { v4 as uuidv4 } from "uuid";

export interface ShowBookingFormInput {
  initialValues?: {
    colleague?: string;
    date?: string;
    time?: string;
    duration?: string;
    customDuration?: number;
    subject?: string;
  };
}

export interface ShowBookingFormResult {
  content: Array<{ type: string; text: string }>;
  structuredContent: {
    formId: string;
    title: string;
    initialValues: ShowBookingFormInput["initialValues"];
  };
  _meta: {
    ui: {
      resourceUri: string;
      visibility: string[];
    };
  };
}

export function handleShowBookingForm(
  input: ShowBookingFormInput
): ShowBookingFormResult {
  const formId = uuidv4();
  const initialValues = input.initialValues ?? {};

  console.log(
    `[show_booking_form] formId=${formId}`,
    initialValues
  );

  return {
    content: [
      {
        type: "text",
        text: "Please fill in the meeting booking form.",
      },
    ],
    structuredContent: {
      formId,
      title: "Book a Meeting",
      initialValues,
    },
    _meta: {
      ui: {
        resourceUri: "ui://booking/form",
        visibility: ["model", "app"],
      },
    },
  };
}
