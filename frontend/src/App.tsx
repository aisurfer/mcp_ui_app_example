import { useState } from "react";
import { useChat } from "./hooks/useChat";
import ChatSidebar from "./components/ChatSidebar";
import ChatContainer from "./components/ChatContainer";

export default function App() {
  const { messages, isLoading, conversationId, sendMessage, submitForm, newChat } =
    useChat();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-full bg-gray-50">
      {/* Sidebar */}
      <div
        className={`
          flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden
          ${sidebarOpen ? "w-64" : "w-0"}
        `}
      >
        <ChatSidebar
          conversationId={conversationId}
          onNewChat={newChat}
          onToggle={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        <ChatContainer
          messages={messages}
          isLoading={isLoading}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onSendMessage={sendMessage}
          onSubmitForm={submitForm}
        />
      </div>
    </div>
  );
}
