import { ToolUiMessage } from "../types";
import McpFormFrame from "./McpFormFrame";

interface McpFormMessageProps {
  message: ToolUiMessage;
  onSubmit: (params: unknown) => void;
}

export default function McpFormMessage({ message, onSubmit }: McpFormMessageProps) {
  const { toolUi, formSubmitted = false } = message;

  return (
    <div className="flex items-start gap-3 message-enter">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
        <svg
          className="w-4 h-4 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>

      {/* Card */}
      <div
        className="flex-1 bg-white border border-gray-200 shadow-sm overflow-hidden"
        style={{ borderRadius: "18px 18px 18px 4px", maxWidth: "680px" }}
      >
        {/* Card header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={toolUi.requiresSubmission
                  ? "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  : "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                }
              />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700">
            {toolUi.requiresSubmission ? "Fill in the form:" : "Result:"}
          </span>
          {formSubmitted && (
            <span className="ml-auto text-xs text-green-600 flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Submitted
            </span>
          )}
        </div>

        {/* Tool name badge */}
        {toolUi.toolName && (
          <div className="px-4 pt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500 font-mono">
              {toolUi.toolName}
            </span>
          </div>
        )}

        {/* Iframe area */}
        <div className="p-4">
          <McpFormFrame
            toolCallId={toolUi.toolCallId}
            fetchUrl={toolUi.fetchUrl}
            toolResult={toolUi.toolResult}
            formSubmitted={formSubmitted}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  );
}
