export type CardColor = "yellow" | "red" | "blue" | "grey";

export interface DraggableCardProps {
  children: React.ReactNode;
  color: CardColor;
  x?: number;
  y?: number;
}
