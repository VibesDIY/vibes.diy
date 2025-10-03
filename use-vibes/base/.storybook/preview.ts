import type { Preview } from "@storybook/react-vite";

// Custom viewports for testing component responsiveness
const customViewports = {
  xs: {
    name: "XS - Custom (480px)",
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
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
    backgrounds: {
      default: "light",
      values: [
        {
          name: "light",
          value: "#ffffff",
        },
        {
          name: "dark",
          value: "#1a1a1a",
        },
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

      // Apply theme to document for CSS light-dark() function support
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