/**
 * submitBookingForm.ts
 *
 * MCP tool: submit_booking_form
 *
 * Accepts form data from the iframe (app), validates it, and returns the
 * result. This tool is intended for app/iframe use only (NOT visible to the
 * model — filtered out by the backend before sending the tool list to OpenAI).
 *
 * Metadata: _meta.ui.visibility = ["app"]
 */

export interface SubmitBookingFormInput {
  formId: string;
  values: {
    colleague?: string;
    date?: string;
    time?: string;
    duration?: number;
    subject?: string;
  };
}

export interface SubmitBookingFormResult {
  content: Array<{ type: string; text: string }>;
  structuredContent:
    | {
        accepted: true;
        formId: string;
        values: {
          colleague: string;
          date: string;
          time: string;
          duration: number;
          subject: string;
        };
      }
    | {
        accepted: false;
        formId: string;
        errors: string[];
      };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export function handleSubmitBookingForm(
  input: SubmitBookingFormInput
): SubmitBookingFormResult {
  const { formId, values } = input;

  console.log(`[submit_booking_form] formId=${formId}`, values);

  const errors: string[] = [];

  if (!values.colleague || values.colleague.trim() === "") {
    errors.push("Please select a colleague");
  }

  if (!values.date || values.date.trim() === "") {
    errors.push("Please specify a date");
  } else if (!DATE_RE.test(values.date)) {
    errors.push("Invalid date format (expected YYYY-MM-DD)");
  }

  if (!values.time || values.time.trim() === "") {
    errors.push("Please select a meeting time");
  } else if (!TIME_RE.test(values.time)) {
    errors.push("Invalid time format (expected HH:MM)");
  }

  if (values.duration === undefined || values.duration === null) {
    errors.push("Please specify a duration");
  } else if (
    typeof values.duration !== "number" ||
    !Number.isFinite(values.duration) ||
    values.duration <= 0
  ) {
    errors.push("Duration must be a positive number");
  }

  if (errors.length > 0) {
    console.log(`[submit_booking_form] Validation failed:`, errors);
    return {
      content: [{ type: "text", text: "Validation failed." }],
      structuredContent: {
        accepted: false,
        formId,
        errors,
      },
    };
  }

  // All valid
  const accepted = {
    accepted: true as const,
    formId,
    values: {
      colleague: values.colleague!.trim(),
      date: values.date!.trim(),
      time: values.time!.trim(),
      duration: values.duration!,
      subject: (values.subject ?? "").trim(),
    },
  };

  console.log(`[submit_booking_form] Accepted:`, accepted.values);

  return {
    content: [{ type: "text", text: "Form submitted successfully." }],
    structuredContent: accepted,
  };
}
