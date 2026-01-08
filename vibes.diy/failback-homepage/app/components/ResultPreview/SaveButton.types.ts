export interface SaveButtonProps {
  onClick: () => void;
  hasChanges: boolean;
  syntaxErrorCount?: number;
  color?: ButtonColor;
  testId: string;
}

export type ButtonColor =
  | "blue"
  | "electric"
  | "hot"
  | "cyber"
  | "retro"
  | "cool"
  | "dream"
  | "danger";
