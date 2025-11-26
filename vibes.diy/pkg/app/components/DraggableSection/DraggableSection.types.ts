export type CardColor = "yellow" | "red" | "blue" | "grey";

export interface DraggableSectionProps {
  children: React.ReactNode;
  color: CardColor;
  x?: number;
  y?: number;
  static?: boolean; // When true, behaves like a normal div (not draggable, no position)
  removePaddingTop?: boolean;
}
