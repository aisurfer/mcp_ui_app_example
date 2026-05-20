import { useEffect, useRef, useState } from "react";

interface McpFormFrameProps {
  toolCallId: string;
  fetchUrl: string;
  toolResult: Record<string, unknown>;
  formSubmitted: boolean;
  onSubmit: (params: unknown) => void;
}

interface PostMessageEvent {
  type: string;
  tool?: string;
  params?: unknown;
  height?: number;
}

export default function McpFormFrame({
  toolCallId,
  fetchUrl,
  formSubmitted,
  onSubmit,
}: McpFormFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(620);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Only handle messages from this specific iframe
      if (event.source !== iframeRef.current?.contentWindow) return;

      const data = event.data as PostMessageEvent;
      if (!data || typeof data.type !== "string") return;

      if (
        data.type === "mcp_tool_call" &&
        data.tool === "submit_booking_form" &&
        data.params !== undefined
      ) {
        onSubmit(data.params);
      } else if (data.type === "ui_resize" && typeof data.height === "number") {
        // Add a small buffer so the iframe never shows a scrollbar
        setIframeHeight(Math.max(300, data.height + 32));
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [toolCallId, onSubmit]);

  if (formSubmitted) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
        <svg
          className="w-4 h-4 text-green-500 flex-shrink-0"
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
        Form submitted successfully
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={fetchUrl}
      sandbox="allow-scripts allow-forms allow-same-origin"
      style={{
        width: "100%",
        height: `${iframeHeight}px`,
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        display: "block",
        transition: "height 0.2s ease",
      }}
      title="MCP UI Form"
    />
  );
}
