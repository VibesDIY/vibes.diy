export * from "./hooks/useMobile.js";
export * from "./components/icons/index.js";
export * from "./components/index.js";
export { cx, colors, semantic, stripesOverlay, gridBackground, getVibesGlobalCSS } from "./theme/index.js";
export type { SemanticTheme } from "./theme/index.js";
// Legacy alias kept only for the G2 wire-rename seam. The G4 seam
// replaces the ImgVibes component with a `_files`-shaped ImgGen and
// drops these aliases entirely.
export { default as ImgVibes, default as ImgGen } from "./components/ImgVibes.js";
export type { ImgVibesProps } from "./components/ImgVibes.js";
export { useImgVibes, useImgVibes as useImgGen } from "./hooks/img-vibes/index.js";
export { ControlsBar } from "./components/ControlsBar.js";
export { PromptBar } from "./components/PromptBar.js";
export { ImageOverlay } from "./components/ImgVibesUtils/overlays/ImageOverlay.js";
export { ImgVibesModal } from "./components/ImgVibesUtils/ImgVibesModal.js";
export type { ImgVibesModalProps } from "./components/ImgVibesUtils/ImgVibesModal.js";
export { ImgVibesDisplay, ImgVibesDisplayPlaceholder } from "./components/ImgVibesUtils/index.js";
export { defaultClasses } from "./utils/style-utils.js";
export type { ImageDocument, PartialImageDocument } from "@vibes.diy/use-vibes-types";
