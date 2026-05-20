interface ChatSidebarProps {
  conversationId: string | null;
  onNewChat: () => void;
  onToggle: () => void;
}

export default function ChatSidebar({
  conversationId,
  onNewChat,
  onToggle,
}: ChatSidebarProps) {
  return (
    <div className="flex flex-col h-full w-64 bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
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
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z"
              />
            </svg>
          </div>
          <span className="font-semibold text-sm">AI Chat</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          title="Hide sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7M18 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* New chat button */}
      <div className="px-3 pt-4">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-600 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Chat
        </button>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pt-3">
        {conversationId && (
          <div className="mb-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider px-2 mb-1">
              Current Chat
            </p>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 text-sm text-white cursor-default">
              <svg
                className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span className="truncate text-xs text-gray-300 font-mono">
                {conversationId.slice(0, 18)}…
              </span>
            </div>
          </div>
        )}

        {!conversationId && (
          <div className="text-center pt-8 px-4">
            <p className="text-xs text-gray-500">Start a new conversation</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">MCP UI Demo</p>
      </div>
    </div>
  );
}
