import { CSSProperties } from "react";

export const VibesPanelStyles = {
  /**
   * Get outer container panel style
   */
  getOuterContainerPanelStyle(customStyle?: CSSProperties): CSSProperties {
    return {
      padding: "12px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: "12px",
      ...customStyle,
    };
  },

  /**
   * Get base container panel style
   */
  getContainerPanelStyle(): CSSProperties {
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
        ...this.getContainerPanelStyle(),
        flexDirection: "column",
        width: "100%",
      };
    }
    return this.getContainerPanelStyle();
  },

  /**
   * Get label panel style (desktop vertical)
   */
  getLabelPanelStyle(): CSSProperties {
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
  getResponsiveLabelStyle(isMobile: boolean): CSSProperties {
    if (isMobile) {
      return { display: "none" };
    }
    return this.getLabelPanelStyle();
  },

  /**
   * Get button wrapper panel style
   */
  getButtonWrapperPanelStyle(): CSSProperties {
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
   * Get responsive button wrapper style
   */
  getResponsiveButtonWrapperStyle(isMobile: boolean): CSSProperties {
    if (isMobile) {
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
    return this.getButtonWrapperPanelStyle();
  },

  /**
   * Get button container panel style
   */
  getButtonContainerPanelStyle(): CSSProperties {
    return {
      display: "flex",
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: "24px",
      flexWrap: "wrap",
      maxWidth: "100%",
    };
  },

  /**
   * Get invite form panel style
   */
  getInviteFormPanelStyle(): CSSProperties {
    return {
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    };
  },

  /**
   * Get invite label panel style
   */
  getInviteLabelPanelStyle(): CSSProperties {
    return {
      alignSelf: "flex-start",
      fontWeight: 600,
    };
  },

  /**
   * Get invite input wrapper panel style
   */
  getInviteInputWrapperPanelStyle(): CSSProperties {
    return {
      width: "100%",
    };
  },

  /**
   * Get invite input style
   */
  getInviteInputStyle(): CSSProperties {
    return {
      width: "100%",
      border: "none",
      background: "transparent",
      color: "inherit",
      fontSize: "inherit",
      fontWeight: "inherit",
      letterSpacing: "inherit",
      padding: 0,
    };
  },

  /**
   * Get invite status style
   */
  getInviteStatusStyle(): CSSProperties {
    return {
      textAlign: "center",
    };
  }
};
