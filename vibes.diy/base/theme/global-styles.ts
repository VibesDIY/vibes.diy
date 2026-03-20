/**
 * Global resets and base element styles.
 * Extracted from app.css and app/styles/modules/global-resets.css.
 */

export const globalResets = `
html {
  margin: 0;
  padding: 0;
}

body {
  margin: 0;
  padding: 0;
  font-family:
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    "Roboto",
    "Oxygen",
    "Ubuntu",
    "Cantarell",
    "Fira Sans",
    "Droid Sans",
    "Helvetica Neue",
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  width: 100%;
  height: 100%;
  background-color: var(--color-light-background-00);
  color: var(--color-light-primary);
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
  }

  body {
    color-scheme: dark;
    background-color: var(--color-dark-background-00);
    color: var(--color-dark-primary);
  }

  html, body {
    background-color: var(--color-dark-background-00);
    color: var(--color-dark-primary);
  }

  .text-accent-02 {
    color: var(--color-dark-secondary);
  }

  .text-accent-00 {
    color: var(--color-dark-accent-01);
  }
}

@supports (-webkit-touch-callout: none) {
  @media (prefers-color-scheme: dark) {
    html, body {
      background-color: var(--color-dark-background-00);
      color: var(--color-dark-primary);
    }
  }
}

hr {
  opacity: 0.5;
}

#root {
  height: 100%;
}

button {
  font-family: inherit;
}

input,
textarea,
select {
  font-size: 16px;
}

button,
a,
[role="button"],
[type="button"],
[type="submit"],
[type="reset"] {
  cursor: pointer;
}

.light {
  --sp-layout-height: 100vh !important;
}
`;
