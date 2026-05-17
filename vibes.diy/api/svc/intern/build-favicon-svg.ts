const GRID_BG = "#cccdc8";
const GRID_LINE = "rgba(255,255,255,0.5)";

function toBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

export function buildFaviconSvg(args: { bytes: Uint8Array; mime: string }): string {
  const dataUri = `data:${args.mime};base64,${toBase64(args.bytes)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<defs>
<pattern id="g" width="16" height="16" patternUnits="userSpaceOnUse">
<path d="M16 0H0V16" fill="none" stroke="${GRID_LINE}" stroke-width="1"/>
</pattern>
<clipPath id="c"><circle cx="32" cy="32" r="30"/></clipPath>
</defs>
<rect width="64" height="64" fill="${GRID_BG}"/>
<rect width="64" height="64" fill="url(#g)"/>
<image x="2" y="2" width="60" height="60" clip-path="url(#c)" preserveAspectRatio="xMidYMid slice" href="${dataUri}"/>
</svg>`;
}
