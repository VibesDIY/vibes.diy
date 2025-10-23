export type CardColor = 'yellow' | 'red' | 'blue' | 'grey';

export interface DraggableSectionProps {
  children: React.ReactNode;
  color: CardColor;
  x?: number;
  y?: number;
}