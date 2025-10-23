export type CardColor = "yellow" | "red" | "blue" | "grey";

export interface HomeSectionProps {
  children: React.ReactNode;
  color: CardColor;
}
