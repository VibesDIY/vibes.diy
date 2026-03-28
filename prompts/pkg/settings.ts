export interface HistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
}
