export type CardColor = "yellow" | "red" | "blue" | "grey";

export interface DraggableCardProps {
  children: React.ReactNode;
  color: CardColor;
  isText?: boolean;
  x?: number;
  y?: number;
}
