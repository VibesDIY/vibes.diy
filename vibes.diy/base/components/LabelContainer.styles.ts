import { CSSProperties } from "react";

export const LabelContainerStyles = {
  /**
   * Get base container style
   */
  getContainerStyle(): CSSProperties {
    return {
      position: "relative",
      display: "inline-flex",
      alignItems: "stretch",
      width: "auto",
      marginBottom: "40px",
    };
  },

  /**
   * Get responsive container style
   */
  getResponsiveContainerStyle(isMobile: boolean): CSSProperties {
    if (isMobile) {
      return {
        ...this.getContainerStyle(),
        flexDirection: "column",
        width: "100%",
      };
    }
    return {
      ...this.getContainerStyle(),
      flexDirection: "row",
    };
  },

  /**
   * Get base label style (desktop vertical)
   */
  getLabelStyle(): CSSProperties {
    return {
      background: "var(--vibes-card-bg)",
      border: "2px solid var(--vibes-card-border)",
      borderLeft: "none",
      borderTopRightRadius: "8px",
      borderBottomRightRadius: "8px",
      padding: "12px 8px",
      fontWeight: 700,
      fontSize: "14px",
      textTransform: "uppercase",
      letterSpacing: "1px",
      whiteSpace: "nowrap",
      color: "var(--vibes-card-text)",
      writingMode: "vertical-rl",
      transform: "rotate(180deg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      margin: "32px 0px",
    };
  },

  /**
   * Get responsive label style
   */
  getResponsiveLabelStyle(isMobile: boolean, disappear = false): CSSProperties {
    if (isMobile) {
      if (disappear) {
        return { display: "none" };
      }
      // Mobile: horizontal label at top
      return {
        background: "var(--vibes-card-bg)",
        border: "2px solid var(--vibes-card-border)",
        borderLeft: "2px solid var(--vibes-card-border)",
        borderBottom: "none",
        borderTopLeftRadius: "8px",
        borderTopRightRadius: "8px",
        borderBottomRightRadius: "0",
        padding: "8px 12px",
        fontWeight: 700,
        fontSize: "14px",
        textTransform: "uppercase",
        letterSpacing: "1px",
        whiteSpace: "nowrap",
        color: "var(--vibes-card-text)",
        writingMode: "horizontal-tb",
        transform: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: "calc(100% - 64px)",
        margin: "0px 32px",
      };
    }
    // Desktop: vertical label on right
    return {
      ...this.getLabelStyle(),
      borderBottom: "2px solid var(--vibes-card-border)",
      borderTopLeftRadius: "0",
      width: "auto",
    };
  },

  /**
   * Get base button label wrapper style
   */
  getButtonLabelWrapperStyle(): CSSProperties {
    return {
      background: "var(--vibes-card-bg)",
      border: "2px solid var(--vibes-card-border)",
      borderRadius: "8px",
      padding: "24px 24px 32px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "auto",
    };
  },

  /**
   * Get responsive button label wrapper style
   */
  getResponsiveButtonLabelWrapperStyle(isMobile: boolean, disappear = false): CSSProperties {
    if (isMobile && disappear) {
      return {
        background: "transparent",
        border: "none",
        borderRadius: "0",
        padding: "0",
        paddingBottom: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "auto",
      };
    }
    if (isMobile && !disappear) {
      return {
        ...this.getButtonLabelWrapperStyle(),
        width: "100%",
      };
    }
    return this.getButtonLabelWrapperStyle();
  },
};
