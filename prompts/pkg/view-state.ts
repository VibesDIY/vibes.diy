export type ViewType = "preview" | "code" | "data" | "chat" | "settings";

export interface ViewTypeItem {
  enabled: boolean;
  icon: string;
  label: string;
  loading?: boolean; // Made loading optional
}

export type ViewControlsType = Record<Exclude<ViewType, "chat">, ViewTypeItem>;

export interface ViewState {
  readonly currentView: ViewType;
  readonly displayView: ViewType;
  readonly navigateToView: (view: ViewType) => void;
  readonly viewControls: ViewControlsType;
  readonly showViewControls: boolean;
  readonly sessionId: string;
  readonly encodedTitle: string;
}
