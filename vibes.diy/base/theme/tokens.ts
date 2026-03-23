/**
 * Vibes Design System — typed design tokens.
 *
 * Source of truth for all colors. CSS variables are derived from
 * these values via css-vars.ts, not the other way around.
 */

export const colors = {
  blue: "#3b82f6",
  blueAccent: "#0066cc",
  blueBright: "#0074d9",
  blueDark: "#357abd",
  blueDarker: "#4a90e2",

  red: "#ef4444",
  redAccent: "#da291c",
  redDark: "#b91c1c",
  redBright: "#dc2626",
  redLight: "#ff6666",
  redDelete: "#ff3333",

  yellow: "#eab308",
  yellowAccent: "#fedd00",
  yellowBright: "#fe0",

  gray: "#6b7280",
  green: "#51cf66",

  purpleNeon: "#c084fc",
  magentaNeon: "#e879f9",
  pinkNeon: "#f472b6",
  cyanNeon: "#22d3ee",
  limeNeon: "#a3e635",
  orangeNeon: "#fb923c",

  black: "#000000",
  nearBlack: "#1a1a1a",
  darkGray: "#222222",
  grayDark: "#333333",
  grayMid: "#555555",
  grayMedium: "#666666",
  grayLight: "#aaaaaa",
  grayLighter: "#cccccc",
  grayLightest: "#d4d4d4",
  grayUltralight: "#e0e0e0",
  grayPale: "#e5e5e5",
  grayOffwhite: "#eeeeee",
  grayGhost: "#f0f0f0",
  grayWhisper: "#f5f5f5",
  grayMist: "#fafafa",

  white: "#ffffff",
  cream: "#fffff0",
} as const;

export const semantic = {
  light: {
    bg: {
      primary: colors.white,
      secondary: colors.grayWhisper,
      tertiary: colors.grayPale,
      overlay: "rgba(255, 255, 255, 0.5)",
      input: colors.white,
      dropzone: colors.grayMist,
      dropzoneActive: "#f0f8ff",
      light: colors.grayGhost,
    },
    text: {
      primary: colors.grayDark,
      secondary: colors.grayMedium,
      muted: colors.grayLight,
      inverse: colors.white,
    },
    border: {
      primary: colors.nearBlack,
      secondary: colors.grayLighter,
      light: "#dddddd",
      input: colors.grayLighter,
    },
    shadow: {
      color: colors.nearBlack,
      sm: "rgba(0, 0, 0, 0.15)",
      md: "rgba(0, 0, 0, 0.3)",
      lg: "rgba(0, 0, 0, 0.5)",
      backdrop: "rgba(0, 0, 0, 0.9)",
    },
    button: {
      bg: colors.cream,
      text: colors.nearBlack,
      border: colors.nearBlack,
      iconBg: "#2a2a2a",
      iconFill: colors.white,
      bgDarkAware: colors.cream,
      textDarkAware: colors.nearBlack,
      borderDarkAware: colors.nearBlack,
      iconBgDarkAware: colors.white,
    },
    variant: {
      blue: colors.blue,
      red: colors.red,
      yellow: colors.yellow,
      gray: colors.gray,
    },
    card: { bg: colors.grayPale, text: colors.nearBlack, border: colors.nearBlack },
    error: { bg: "rgba(0, 0, 0, 0.7)", border: colors.redLight, text: colors.redLight, textBody: colors.white },
    imggen: { accent: colors.blueAccent, flash: colors.yellowBright, buttonBg: "rgba(255, 255, 255, 0.7)", deleteHover: colors.redDelete },
  },
  dark: {
    bg: {
      primary: colors.nearBlack,
      secondary: "#2a2a2a",
      tertiary: "#404040",
      overlay: "rgba(0, 0, 0, 0.5)",
      input: "#2a2a2a",
      dropzone: "#2a2a2a",
      dropzoneActive: "#1a3a4a",
      light: "#404040",
    },
    text: {
      primary: colors.grayUltralight,
      secondary: colors.grayLight,
      muted: colors.grayMedium,
      inverse: colors.nearBlack,
    },
    border: {
      primary: colors.grayMid,
      secondary: colors.grayMid,
      light: colors.grayMid,
      input: colors.grayMid,
    },
    shadow: {
      color: colors.nearBlack,
      sm: "rgba(255, 255, 255, 0.1)",
      md: "rgba(255, 255, 255, 0.1)",
      lg: "rgba(0, 0, 0, 0.5)",
      backdrop: "rgba(0, 0, 0, 0.9)",
    },
    button: {
      iconBg: colors.white,
      iconFill: "#2a2a2a",
      bgDarkAware: "#2a2a2a",
      textDarkAware: colors.grayUltralight,
      borderDarkAware: colors.grayMid,
      iconBgDarkAware: "#404040",
    },
    variant: {
      blue: colors.purpleNeon,
      red: colors.pinkNeon,
      yellow: colors.orangeNeon,
      gray: colors.cyanNeon,
    },
    card: { bg: colors.nearBlack, text: colors.white, border: colors.grayMid },
    imggen: { buttonBg: "rgba(0, 0, 0, 0.7)" },
  },
} as const;

export type SemanticTheme = typeof semantic.light;
