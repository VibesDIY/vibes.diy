import { CSSProperties } from "react";

// Main container style - responsive
export const getContainerStyle = (isMobile: boolean): CSSProperties => ({
  maxWidth: "800px",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: isMobile ? "16px" : "24px",
  margin: isMobile ? "40px" : "0 auto",
  justifyContent: "center",
  alignItems: isMobile ? "stretch" : "center",
  padding: isMobile ? "0" : "0",
});

// Carousel wrapper style - responsive
export const getCarouselWrapperStyle = (isMobile: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: isMobile ? "8px" : "12px",
  width: "100%",
  boxSizing: "border-box",
  padding: isMobile ? "0 16px" : "0",
});

// Carousel navigation button style - responsive
export const getCarouselNavButtonStyle = (
  isMobile: boolean,
): CSSProperties => ({
  width: isMobile ? "32px" : "40px",
  height: isMobile ? "32px" : "40px",
  minWidth: isMobile ? "32px" : "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: isMobile ? "32px" : "40px",
  cursor: "pointer",
  backgroundColor: "transparent",
  color: "var(--vibes-near-black)",
  transition: "all 0.2s ease",
  userSelect: "none",
  border: "none",
  padding: "0",
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

// Title style - responsive
export const getTitle = (isMobile: boolean): CSSProperties => ({
  fontSize: isMobile ? "36px" : "65px",
  fontFamily: "Alte Haas Grotesk, Inter, sans-serif",
  color: "var(--vibes-near-black)",
  display: "flex",
  justifyContent: "center",
  textAlign: "center",
  width: isMobile ? "100%" : "auto",
  padding: isMobile ? "0 16px" : "0",
  boxSizing: "border-box",
});

// Button style - fixed width calculated dynamically
export const getButtonStyle = (): CSSProperties => ({
  flexShrink: 0,
  flexGrow: 0,
  minWidth: 0,
});

// Chat input container style - responsive
export const getChatInputContainerStyle = (
  isMobile: boolean,
): CSSProperties => {
  if (isMobile) {
    return {
      width: "calc(100% - 32px)",
      margin: "0 16px",
      position: "relative",
      display: "flex",
      flexDirection: "column",
      border: "2px solid var(--vibes-near-black)",
      backgroundColor: "#FFFEF0",
      minHeight: "200px",
      borderRadius: "8px",
      boxSizing: "border-box",
    };
  }
  return {
    width: "100%",
    maxWidth: "600px",
    position: "relative",
    display: "flex",
    flexDirection: "row",
    border: "2px solid var(--vibes-near-black)",
    backgroundColor: "#FFFEF0",
    minHeight: "200px",
    borderRadius: "8px",
    boxSizing: "border-box",
  };
};

// Chat input label style - responsive (rotated "Prompt" on the left/top)
export const getChatInputLabelStyle = (isMobile: boolean): CSSProperties => {
  if (isMobile) {
    return {
      writingMode: "horizontal-tb",
      transform: "none",
      padding: "8px 12px",
      fontSize: "24px",
      color: "var(--vibes-near-black)",
      borderBottom: "2px solid var(--vibes-near-black)",
      backgroundColor: "#FFFEF0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderTopLeftRadius: "8px",
      borderTopRightRadius: "8px",
    };
  }
  return {
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
    borderBottomRightRadius: "8px",
    borderTopRightRadius: "8px",
  };
};

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

// Gallery container style - responsive
export const getGalleryContainerStyle = (isMobile: boolean): CSSProperties => {
  if (isMobile) {
    return {
      width: "calc(100% - 32px)",
      margin: "0 16px",
      position: "relative",
      display: "flex",
      flexDirection: "column",
      border: "2px solid var(--vibes-near-black)",
      backgroundColor: "#D3D3D3",
      borderRadius: "8px",
      boxSizing: "border-box",
    };
  }
  return {
    width: "100%",
    maxWidth: "600px",
    position: "relative",
    display: "flex",
    flexDirection: "row",
    border: "2px solid var(--vibes-near-black)",
    backgroundColor: "#D3D3D3",
    borderRadius: "8px",
    boxSizing: "border-box",
  };
};

// Gallery label style - responsive (rotated "Gallery" on the left/top)
export const getGalleryLabelStyle = (isMobile: boolean): CSSProperties => {
  if (isMobile) {
    return {
      writingMode: "horizontal-tb",
      transform: "none",
      padding: "8px 12px",
      fontSize: "24px",
      color: "var(--vibes-near-black)",
      borderBottom: "2px solid var(--vibes-near-black)",
      backgroundColor: "#D3D3D3",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderTopLeftRadius: "8px",
      borderTopRightRadius: "8px",
    };
  }
  return {
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
  };
};

// Gallery content wrapper style
export const getGalleryContentStyle = (): CSSProperties => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
});

// Gallery description style
export const getGalleryDescriptionStyle = (): CSSProperties => ({
  fontSize: "20px",
  fontWeight: 500,
  color: "var(--vibes-near-black)",
  textAlign: "left",
  borderTop: "2px solid",
  padding: "5px 24px",
});

// VibeGallery styles - responsive
export const getVibeGalleryWrapperStyle = (
  isMobile: boolean,
): CSSProperties => ({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: isMobile ? "16px" : "24px",
  width: "100%",
  gap: isMobile ? "8px" : "10px",
  flexWrap: isMobile ? "wrap" : "nowrap",
});

// VibeGalleryCard styles
export const getVibeCardLinkStyle = (): CSSProperties => ({
  textDecoration: "none",
});

export const getVibeCardWrapperStyle = (): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "12px",
});

export const getVibeCardIconContainerStyle = (
  isMobile: boolean,
): CSSProperties => ({
  position: "relative",
  width: isMobile ? "80px" : "100px",
  height: isMobile ? "80px" : "100px",
});

export const getVibeCardTexturedShadowStyle = (
  isHovered: boolean,
  isMobile: boolean,
): CSSProperties => {
  const size = isMobile ? "80px" : "100px";
  return {
    position: "absolute",
    top: "8px",
    left: isHovered ? "10px" : "8px",
    width: size,
    height: size,
    borderRadius: isMobile ? "20px" : "24px",
    overflow: "hidden",
    transition: "top 0.2s ease, left 0.2s ease",
    zIndex: 0,
  };
};

export const getVibeCardMainIconContainerStyle = (
  isHovered: boolean,
  isMobile: boolean,
): CSSProperties => {
  const size = isMobile ? "80px" : "100px";
  const padding = isMobile ? "12px" : "16px";
  return {
    position: "relative",
    width: size,
    height: size,
    borderRadius: isMobile ? "20px" : "24px",
    backgroundColor: "rgb(255, 254, 240)",
    border: "2px solid var(--vibes-near-black)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding,
    transition: "transform 0.2s ease",
    cursor: "pointer",
    transform: isHovered ? "translate(-2px, -2px)" : "translate(0, 0)",
    zIndex: 1,
  };
};

export const getVibeCardIconImageStyle = (): CSSProperties => ({
  maxWidth: "100%",
  maxHeight: "100%",
  objectFit: "contain",
});

export const getVibeCardNameStyle = (): CSSProperties => ({
  fontSize: "16px",
  fontWeight: 500,
  color: "var(--vibes-near-black)",
  textAlign: "center",
  width: "110px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
