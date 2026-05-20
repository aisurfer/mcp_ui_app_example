import { Message } from "../types";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";

interface ChatContainerProps {
  messages: Message[];
  isLoading: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSendMessage: (text: string) => void;
  onSubmitForm: (toolCallId: string, params: unknown) => void;
}

export default function ChatContainer({
  messages,
  isLoading,
  sidebarOpen,
  onToggleSidebar,
  onSendMessage,
  onSubmitForm,
}: ChatContainerProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            title="Open sidebar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <h1 className="font-semibold text-gray-800 text-sm">AI Assistant</h1>
        </div>
        <div className="ml-auto text-xs text-gray-400">MCP UI</div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          onSubmitForm={onSubmitForm}
        />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white">
        <ChatInput onSend={onSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}
