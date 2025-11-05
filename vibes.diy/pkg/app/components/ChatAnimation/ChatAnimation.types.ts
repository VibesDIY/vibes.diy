export interface ChatAnimationProps {
  arrayOfMessages: MessageType[];
  title?: string;
  user: string;
}

export interface MessageType {
  user: string;
  message: string;
}
