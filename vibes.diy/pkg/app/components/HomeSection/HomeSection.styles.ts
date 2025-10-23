import { CardColor } from "./HomeSection.types.ts";

const colorMap: Record<CardColor, string> = {
  yellow: "#ffd90094",
  red: "#DA291C",
  blue: "#009ACE",
  grey: "#CCCDC8",
};

export const getHomeSectionStyle = (color: CardColor): React.CSSProperties => ({
  position: "relative",
  width: "80%",
  padding: "40px",
  borderRadius: "15px",
  overflow: "hidden",
  backgroundColor: '#ffffff',
  color: '#000000'
});

export const getHomeSectionWrapperStyle = (color: CardColor): React.CSSProperties => ({
  position: "relative",
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: "100%",
  padding: '200px 0px',
  borderRadius: "15px",
  overflow: "hidden",
  zIndex: 1,

  background: `
    linear-gradient(
      180deg,
      transparent 0%,
      transparent 10%,
      ${colorMap[color]} 10%,
      ${colorMap[color]} 90%,
      transparent 90%,
      transparent 100%
    )
  `,

  /* Add a "film grain" effect using multiple tiny dot gradients */
  backgroundImage: `
    linear-gradient(
      180deg,
      transparent 0%,
      transparent 10%,
      ${colorMap[color]} 50%,
      transparent 90%,
      transparent 100%
    ),
    radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px),
    radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px),
    radial-gradient(circle, rgba(255,255,255,0.02) 1px, transparent 1px)
  `,
  backgroundSize: "100% 100%, 2px 2px, 3px 3px, 4px 4px",
  backgroundRepeat: "no-repeat, repeat, repeat, repeat",
  backgroundBlendMode: "overlay, overlay, overlay, overlay",

  filter: "contrast(170%) brightness(100%)",
  imageRendering: "pixelated",
});
