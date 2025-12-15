import React from "react";

interface PreviewPageProps {
  transformedJS: string;
}

export default function PreviewPage(props: PreviewPageProps) {
  const { transformedJS } = props;

  // Importmap for preview - matches original importmap.tsx format
  // Uses esm.sh URLs since srcdoc iframe can't access local /dist/ paths
  const importMap = {
    imports: {
      // React and aliases for compatibility
      react: "https://esm.sh/react@19.2.1",
      "/react": "https://esm.sh/react@19.2.1",
      "react?target=es2022": "https://esm.sh/react@19.2.1",
      "/react?target=es2022": "https://esm.sh/react@19.2.1",
      "react@^=18?target=es2022": "https://esm.sh/react@19.2.1",
      "/react@^=18?target=es2022": "https://esm.sh/react@19.2.1",
      "react@%3E=18?target=es2022": "https://esm.sh/react@19.2.1",
      "/react@%3E=18?target=es2022": "https://esm.sh/react@19.2.1",
      "react@>=18?target=es2022": "https://esm.sh/react@19.2.1",
      "/react@>=18?target=es2022": "https://esm.sh/react@19.2.1",
      "react@%3E=18": "https://esm.sh/react@19.2.1",
      "/react@%3E=18": "https://esm.sh/react@19.2.1",
      "react@>=18": "https://esm.sh/react@19.2.1",
      "/react@>=18": "https://esm.sh/react@19.2.1",
      "/react@^19.2.0?target=es2022": "https://esm.sh/react@19.2.1",
      "/react@19.2.1/es2022/react.mjs": "https://esm.sh/react@19.2.1",
      "react@19.3.0-canary-fd524fe0-20251121": "https://esm.sh/react@19.2.1",
      "/react@19.3.0-canary-fd524fe0-20251121": "https://esm.sh/react@19.2.1",

      // React DOM
      "react-dom": "https://esm.sh/react-dom@19.2.1",
      "react-dom/client": "https://esm.sh/react-dom@19.2.1/client",
      "react/jsx-runtime": "https://esm.sh/react@19.2.1/jsx-runtime",
      "react/jsx-dev-runtime": "https://esm.sh/react@19.2.1/jsx-dev-runtime",

      // Router
      "react-router":
        "https://esm.sh/react-router?deps=react@19.2.1,react-dom@19.2.1",
      "react-router-dom":
        "https://esm.sh/react-router-dom?deps=react@19.2.1,react-dom@19.2.1",

      // Vibes essentials - both use-fireproof and use-vibes point to use-vibes (matches original)
      "use-vibes":
        "https://esm.sh/use-vibes?deps=react@19.2.1,react-dom@19.2.1",
      "use-fireproof":
        "https://esm.sh/use-vibes?deps=react@19.2.1,react-dom@19.2.1",
      "call-ai": "https://esm.sh/call-ai@v0.14.5",

      // Common UI libraries
      "react-hot-toast":
        "https://esm.sh/react-hot-toast?deps=react@19.2.1,react-dom@19.2.1",
      clsx: "https://esm.sh/clsx",
      "tailwind-merge": "https://esm.sh/tailwind-merge",
      "class-variance-authority": "https://esm.sh/class-variance-authority",
      "@radix-ui/react-slot": "https://esm.sh/@radix-ui/react-slot",
      "react-markdown": "https://esm.sh/react-markdown",
    },
  };

  // transformedJS already imports React, so we put it first
  // then mount code only imports what's additional
  const mountScript = `
    ${transformedJS}

    import { createRoot } from 'react-dom/client';
    import { MemoryRouter } from 'react-router-dom';

    const root = createRoot(document.getElementById('root'));
    // Wrap in MemoryRouter to handle srcdoc location for React Router
    root.render(
      React.createElement(MemoryRouter, { initialEntries: ['/'] },
        React.createElement(App)
      )
    );
  `;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          type="importmap"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(importMap) }}
        />
        <script type="module" src="https://esm.sh/@tailwindcss/browser@4" />
      </head>
      <body>
        <div id="root" />
        <script
          type="module"
          dangerouslySetInnerHTML={{ __html: mountScript }}
        />
      </body>
    </html>
  );
}
