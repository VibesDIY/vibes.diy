import type { Preview } from "@storybook/react-vite";
// @ts-expect-error Vite ?raw import returns string
import themeCSS from "@vibes.diy/base/theme.css?raw";

// Inject theme CSS tokens + base font
const style = document.createElement("style");
style.textContent = themeCSS + `\nbody { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }`;
document.head.appendChild(style);

// Load Inter font
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap";
document.head.appendChild(fontLink);

const customViewports = {
  xs: {
    name: "XS (480px)",
    styles: { width: "480px", height: "800px" },
  },
  belowSm: {
    name: "Below SM (639px)",
    styles: { width: "639px", height: "800px" },
  },
  small: {
    name: "Small Mobile (440px)",
    styles: { width: "440px", height: "800px" },
  },
  tiny: {
    name: "Tiny (375px)",
    styles: { width: "375px", height: "800px" },
  },
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "dark", value: "#1a1a1a" },
      ],
    },
    viewport: {
      viewports: customViewports,
    },
  },
  globalTypes: {
    theme: {
      description: "Global theme for components",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: ["light", "dark"],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || "light";

      if (typeof document !== "undefined") {
        if (theme === "dark") {
          document.documentElement.classList.add("dark");
          document.documentElement.dataset.theme = "dark";
        } else {
          document.documentElement.classList.remove("dark");
          document.documentElement.dataset.theme = "light";
        }
      }

      return Story();
    },
  ],
};

export default preview;
