import { BaseMessage } from "../types";

interface UserMessageProps {
  message: BaseMessage;
}

export default function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="flex justify-end message-enter">
      <div className="max-w-[75%]">
        <div
          className="px-4 py-3 text-white text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm"
          style={{
            backgroundColor: "#2563EB",
            borderRadius: "18px 18px 4px 18px",
          }}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
