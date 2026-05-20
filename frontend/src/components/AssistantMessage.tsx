import { BaseMessage } from "../types";

interface AssistantMessageProps {
  message: BaseMessage;
}

// Check if message is an internal tool indicator
function isToolIndicator(content: string): boolean {
  return content.startsWith("__tool_indicator__");
}

function getDisplayContent(content: string): string {
  if (isToolIndicator(content)) {
    return content.replace("__tool_indicator__", "");
  }
  return content;
}

export default function AssistantMessage({ message }: AssistantMessageProps) {
  const indicator = isToolIndicator(message.content);
  const displayText = getDisplayContent(message.content);

  return (
    <div className="flex items-end gap-3 message-enter">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 self-end">
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

      {/* Bubble */}
      <div className="max-w-[75%]">
        <div
          className={`
            px-4 py-3 text-sm leading-relaxed shadow-sm
            ${
              indicator
                ? "bg-amber-50 border border-amber-200 text-amber-700"
                : "bg-white border border-gray-200 text-gray-800"
            }
          `}
          style={{
            borderRadius: "18px 18px 18px 4px",
            whiteSpace: indicator ? "normal" : "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {indicator ? (
            <span className="flex items-center gap-2">
              <svg
                className="w-3.5 h-3.5 animate-spin text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              {displayText}
            </span>
          ) : (
            <>
              {displayText}
              {message.isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 animate-pulse align-text-bottom" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
