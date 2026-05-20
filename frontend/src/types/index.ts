export type MessageRole = "user" | "assistant";

export interface BaseMessage {
  id: string;
  role: MessageRole;
  content: string;
  isStreaming?: boolean;
}

export interface ToolUiData {
  toolCallId: string;
  toolName: string;
  fetchUrl: string;
  toolInput: Record<string, unknown>;
  toolResult: Record<string, unknown>;
  requiresSubmission: boolean;
}

export interface ToolUiMessage extends BaseMessage {
  role: "assistant";
  toolUi: ToolUiData;
  formSubmitted?: boolean;
  formResult?: Record<string, unknown>;
}

export type Message = BaseMessage | ToolUiMessage;

export function isToolUiMessage(msg: Message): msg is ToolUiMessage {
  return "toolUi" in msg && msg.toolUi !== undefined;
}
