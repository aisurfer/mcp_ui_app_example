import { useEffect, useRef } from "react";
import { Message, isToolUiMessage } from "../types";
import UserMessage from "./UserMessage";
import AssistantMessage from "./AssistantMessage";
import McpFormMessage from "./McpFormMessage";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onSubmitForm: (toolCallId: string, params: unknown) => void;
}

export default function MessageList({
  messages,
  isLoading,
  onSubmitForm,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const isEmpty = messages.length === 0;

  return (
    <div className="h-full overflow-y-auto scrollbar-thin px-4 py-6">
      {isEmpty && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">
            Hi! How can I help you?
          </h2>
          <p className="text-sm text-gray-400 max-w-xs">
            Ask anything or request to book a meeting with a colleague.
          </p>
        </div>
      )}

      <div className="max-w-3xl mx-auto space-y-4">
        {messages.map((msg) => {
          // Skip internal indicators rendered as AssistantMessage
          if (isToolUiMessage(msg)) {
            return (
              <McpFormMessage
                key={msg.id}
                message={msg}
                onSubmit={(params) => onSubmitForm(msg.toolUi.toolCallId, params)}
              />
            );
          }

          if (msg.role === "user") {
            return <UserMessage key={msg.id} message={msg} />;
          }

          return <AssistantMessage key={msg.id} message={msg} />;
        })}

        {/* Typing indicator */}
        {isLoading &&
          (messages.length === 0 ||
            messages[messages.length - 1].role === "user" ||
            (messages[messages.length - 1].role === "assistant" &&
              !messages[messages.length - 1].isStreaming)) && (
            <div className="flex items-end gap-3 message-enter">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
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
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-gray-400 dot-bounce"
                      style={{ animationDelay: `${i * 0.18}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
