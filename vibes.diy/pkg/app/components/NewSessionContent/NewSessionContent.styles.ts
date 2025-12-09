import { CSSProperties } from "react";

// Main container style
export const getContainerStyle = (): CSSProperties => ({
  maxWidth: "800px",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  margin: "0 auto",
  justifyContent: "center",
  alignItems: "center",
});

// Carousel wrapper style
export const getCarouselWrapperStyle = (): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  width: "100%",
});

// Carousel navigation button style
export const getCarouselNavButtonStyle = (): CSSProperties => ({
  width: "40px",
  height: "40px",
  minWidth: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "40px",
  cursor: "pointer",
  backgroundColor: "transparent",
  color: "var(--vibes-near-black)",
  transition: "all 0.2s ease",
  userSelect: "none",
});

// Suggestions buttons container style (viewport - shows exactly 3 buttons)
export const getSuggestionsContainerStyle = (): CSSProperties => ({
  display: "flex",
  flex: "1",
  position: "relative",
  overflow: "hidden",
  minWidth: 0, // Allow flex item to shrink below content size
  padding: "8px 12px", // Padding to accommodate box-shadow and prevent edge clipping
});

// Suggestions inner wrapper for animation (sliding strip)
export const getSuggestionsInnerStyle = (
  offset: number,
  isAnimating: boolean,
): CSSProperties => ({
  display: "flex",
  gap: "22px",
  transform: `translateX(${offset}px)`,
  transition: isAnimating
    ? "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
    : "none",
});

// Title style
export const getTitle = (): CSSProperties => ({
  fontSize: "65px",
  fontFamily: "Alte Haas Grotesk, Inter, sans-serif",
  color: "var(--vibes-near-black)",
  display: "flex",
  justifyContent: "center",
});

// Button style - fixed width calculated dynamically
export const getButtonStyle = (): CSSProperties => ({
  flexShrink: 0,
  flexGrow: 0,
  minWidth: 0,
});

// Chat input container style
export const getChatInputContainerStyle = (): CSSProperties => ({
  width: "100%",
  maxWidth: '600px',
  position: "relative",
  display: "flex",
  border: "2px solid var(--vibes-near-black)",
  backgroundColor: "#FFFEF0",
  minHeight: "200px",
  borderRadius: '8px',
});

// Chat input label style (rotated "Prompt" on the left)
export const getChatInputLabelStyle = (): CSSProperties => ({
  writingMode: "vertical-rl",
  transform: "rotate(180deg)",
  padding: "20px 8px",
  fontSize: "36px",
  color: "var(--vibes-near-black)",
  borderLeft: "2px solid var(--vibes-near-black)",
  backgroundColor: "#FFFEF0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderBottomRightRadius: '8px',
  borderTopRightRadius: '8px',
});

// Textarea wrapper style
export const getTextareaWrapperStyle = (): CSSProperties => ({
  flex: 1,
  position: "relative",
  display: "flex",
  flexDirection: "column",
});

// Textarea style
export const getTextareaStyle = (): CSSProperties => ({
  flex: 1,
  width: "100%",
  padding: "24px 80px 24px 24px",
  border: "none",
  backgroundColor: "transparent",
  fontSize: "18px",
  fontFamily: "inherit",
  resize: "none",
  outline: "none",
  color: "var(--vibes-near-black)",
});

// Submit button style (circular button with arrow)
export const getSubmitButtonStyle = (): CSSProperties => ({
  position: "absolute",
  bottom: "20px",
  right: "20px",
  width: "45px",
  height: "45px",
  borderRadius: "50%",
  border: "none",
  backgroundColor: "var(--vibes-near-black)",
  color: "#fff",
  fontSize: "24px",
  fontWeight: "bold",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "transform 0.2s ease",
});

// Gallery container style
export const getGalleryContainerStyle = (): CSSProperties => ({
  width: "100%",
  maxWidth: "600px",
  position: "relative",
  display: "flex",
  border: "2px solid var(--vibes-near-black)",
  backgroundColor: "#D3D3D3",
  borderRadius: "8px",
});

// Gallery label style (rotated "Gallery" on the left)
export const getGalleryLabelStyle = (): CSSProperties => ({
  writingMode: "vertical-rl",
  transform: "rotate(180deg)",
  padding: "20px 8px",
  fontSize: "36px",
  color: "var(--vibes-near-black)",
  borderLeft: "2px solid var(--vibes-near-black)",
  backgroundColor: "#D3D3D3",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderBottomRightRadius: "8px",
  borderTopRightRadius: "8px",
  marginRight: "24px",
});

// Gallery content wrapper style
export const getGalleryContentStyle = (): CSSProperties => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "24px",
});

// Gallery description style
export const getGalleryDescriptionStyle = (): CSSProperties => ({
  fontSize: "20px",
  fontWeight: 500,
  color: "var(--vibes-near-black)",
  textAlign: "left",
});
