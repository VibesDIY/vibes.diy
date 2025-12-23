/**
 * Vibe Controls Scripts - Vanilla JavaScript for Interactivity
 *
 * Pure JavaScript event handlers for server-side rendered vibe controls.
 * No React dependencies - all DOM manipulation using vanilla JS.
 *
 * Features:
 * - Toggle switch to open/close panel
 * - Mode switching (default ↔ mutate ↔ invite)
 * - Navigation buttons (Fresh Start, Remix Code)
 * - Invite form with CustomEvents
 * - Logout via redirect to main app /logout route
 */

// DOM element references
const switchBtn = document.querySelector("[data-vibe-switch]");
const panel = document.querySelector("[data-vibe-panel]");
const morphingPath = document.querySelector(
  "[data-vibe-switch] svg path.morphing",
);
const defaultMode = document.querySelector('[data-panel-mode="default"]');
const mutateMode = document.querySelector('[data-panel-mode="mutate"]');
const inviteMode = document.querySelector('[data-panel-mode="invite"]');

// State
let panelOpen = false;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let currentMode = "default";

// SVG path definitions for morphing animation
const originalD =
  "M426.866,285.985c-7.999-0.416-19.597-0.733-31.141-1.687  c-15.692-1.297-28.809-8.481-40.105-19.104c-12.77-12.008-20.478-26.828-22.714-44.177c-3.048-23.644,3.384-44.558,19.646-62.143  c9.174-9.92,20.248-17.25,33.444-20.363c7.786-1.837,15.944-2.399,23.973-2.828c9.988-0.535,20.023-0.666,30.021-0.371  c10.191,0.301,20.433,0.806,30.521,2.175c12.493,1.696,23.132,7.919,32.552,16.091c14.221,12.337,22.777,27.953,25.184,46.594  c2.822,21.859-2.605,41.617-16.777,58.695c-9.494,11.441-21.349,19.648-35.722,23.502c-6.656,1.785-13.724,2.278-20.647,2.77  C446.914,285.721,438.682,285.667,426.866,285.985z";
const stretchedD =
  "M165.866,285.985c-7.999-0.416-19.597-0.733-31.141-1.687  c-15.692-1.297-28.809-8.481-40.105-19.104c-12.77-12.008-20.478-26.828-22.714-44.177c-3.048-23.644,3.384-44.558,19.646-62.143  c9.174-9.92,20.248-17.25,33.444-20.363c7.786-1.837,15.944-2.399,23.973-2.828c9.988-0.535,121.023-0.666,131.021-0.371  c10.191,0.301,20.433,0.806,30.521,2.175c12.493,1.696,23.132,7.919,32.552,16.091c14.221,12.337,22.777,27.953,25.184,46.594  c2.822,21.859-2.605,41.617-16.777,58.695c-9.494,11.441-21.349,19.648-35.722,23.502c-6.656,1.785-13.724,2.278-20.647,2.77  C286.914,285.721,177.682,285.667,165.866,285.985z";

// ============================================
// URL Utilities (duplicated from appSlug.ts)
// ============================================

function getAppSlug() {
  const { pathname } = window.location;
  if (pathname.startsWith("/vibe/")) {
    const pathPart = pathname.slice("/vibe/".length);
    if (pathPart) {
      const slug = pathPart.split("/")[0];
      if (slug) {
        return slug;
      }
    }
  }
  throw new Error("Unable to determine app slug from URL");
}

function generateFreshDataUrl() {
  const slug = getAppSlug();
  const { protocol, host } = window.location;
  // Use ?new parameter to trigger creation of new instance in React app
  return `${protocol}//${host}/vibe/${slug}?new`;
}

function generateRemixUrl() {
  const appSlug = getAppSlug();
  const { protocol, host } = window.location;
  return `${protocol}//${host}/remix/${appSlug}`;
}

// ============================================
// Panel & Mode Management
// ============================================

function togglePanel() {
  panelOpen = !panelOpen;

  if (panelOpen) {
    panel?.removeAttribute("data-panel-hidden");
    switchBtn?.classList.add("active");
    // Morph to circle on right (originalD)
    if (morphingPath) {
      morphingPath.setAttribute("d", originalD);
    }
  } else {
    panel?.setAttribute("data-panel-hidden", "");
    switchBtn?.classList.remove("active");
    // Morph to stretched oval on left (stretchedD)
    if (morphingPath) {
      morphingPath.setAttribute("d", stretchedD);
    }
  }
}

function switchToMode(mode: string) {
  // Hide all modes
  defaultMode?.setAttribute("data-mode-hidden", "");
  mutateMode?.setAttribute("data-mode-hidden", "");
  inviteMode?.setAttribute("data-mode-hidden", "");

  // Show requested mode
  currentMode = mode;
  if (mode === "default") {
    defaultMode?.removeAttribute("data-mode-hidden");
  } else if (mode === "mutate") {
    mutateMode?.removeAttribute("data-mode-hidden");
  } else if (mode === "invite") {
    inviteMode?.removeAttribute("data-mode-hidden");
  }
}

// ============================================
// Event Handlers
// ============================================

// Toggle switch pointer handler (matches React implementation)
// Use pointerdown instead of click to prevent ghost clicks on mobile
switchBtn?.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  e.preventDefault();
  togglePanel();
});

// Default mode buttons
document
  .querySelector('[data-action="logout"]')
  ?.addEventListener("click", () => {
    // Dispatch sync disable event
    document.dispatchEvent(new CustomEvent("vibes-sync-disable"));
    // Redirect to main app's logout route (Clerk handles sign-out there)
    window.location.href = "/logout";
  });

document
  .querySelector('[data-action="remix"]')
  ?.addEventListener("click", () => {
    const remixUrl = generateRemixUrl();
    window.open(remixUrl, "_top");
  });

document
  .querySelector('[data-action="invite"]')
  ?.addEventListener("click", () => {
    switchToMode("invite");
  });

document
  .querySelector('[data-action="home"]')
  ?.addEventListener("click", () => {
    window.location.href = "https://vibes.diy/";
  });

// Mutate mode buttons
document
  .querySelector('[data-panel-mode="mutate"] [data-action="fresh-start"]')
  ?.addEventListener("click", () => {
    const freshUrl = generateFreshDataUrl();
    window.open(freshUrl, "_blank");
  });

document
  .querySelector('[data-panel-mode="mutate"] [data-action="remix-code"]')
  ?.addEventListener("click", () => {
    const remixUrl = generateRemixUrl();
    window.open(remixUrl, "_blank");
  });

// Back buttons (both mutate and invite modes)
document.querySelectorAll('[data-action="back"]').forEach((btn) => {
  btn.addEventListener("click", () => {
    switchToMode("default");
  });
});

// ============================================
// Invite Form Handling
// ============================================

// Populate hidden fields from URL when form is shown
const dbInput = document.getElementById("vibe-db") as HTMLInputElement | null;
const vibeInput = document.getElementById(
  "vibe-vibe",
) as HTMLInputElement | null;
const groupInput = document.getElementById(
  "vibe-group",
) as HTMLInputElement | null;

// Extract components from URL path and global vibe database
// Format: /vibe/:titleId/:installId (both required - no default fallback)
function extractVibeComponentsFromUrl(): {
  db: string;
  vibe: string;
  group: string;
} {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const vibeIndex = pathParts.indexOf("vibe");

  if (vibeIndex !== -1 && pathParts.length > vibeIndex + 2) {
    const titleId = pathParts[vibeIndex + 1];
    const installId = pathParts[vibeIndex + 2]; // No "|| 'default'" fallback

    // Get database name from first useFireproof call (exposed globally by use-vibes)
    interface WindowWithVibeDB extends Window {
      __VIBE_DB__?: {
        get: () => string;
      };
    }
    const dbName = (window as WindowWithVibeDB).__VIBE_DB__?.get() || titleId;

    return {
      db: dbName, // This is the name passed to useFireproof (e.g., "tiny-todos")
      vibe: titleId,
      group: installId,
    };
  }

  // This should never happen on vibe pages since routing requires both vibe and group
  return { db: "default", vibe: "default", group: "default" };
}

// Populate hidden fields when invite panel is shown
// FIX: Use correct selector - button has data-action="invite", not "show-invite"
const showInviteButton = document.querySelector('[data-action="invite"]');
showInviteButton?.addEventListener("click", () => {
  const components = extractVibeComponentsFromUrl();
  console.log("[vibe-controls] Extracted vibe components:", components);
  console.log("[vibe-controls] Input elements:", {
    dbInput,
    vibeInput,
    groupInput,
  });

  if (dbInput) {
    dbInput.value = components.db;
    console.log("[vibe-controls] Set db input value:", dbInput.value);
  }
  if (vibeInput) {
    vibeInput.value = components.vibe;
    console.log("[vibe-controls] Set vibe input value:", vibeInput.value);
  }
  if (groupInput) {
    groupInput.value = components.group;
    console.log("[vibe-controls] Set group input value:", groupInput.value);
  }
});

// Also populate on form submit to ensure values are fresh
const inviteForm = document.querySelector(
  "[data-invite-form]",
) as HTMLFormElement | null;
inviteForm?.addEventListener("submit", () => {
  const components = extractVibeComponentsFromUrl();
  console.log(
    "[vibe-controls] Form submit - extracting fresh components:",
    components,
  );

  if (dbInput) dbInput.value = components.db;
  if (vibeInput) vibeInput.value = components.vibe;
  if (groupInput) groupInput.value = components.group;
});

// ============================================
// ESC Key to Close Panel
// ============================================

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && panelOpen) {
    togglePanel();
    // Return to default mode when closing
    switchToMode("default");
  }
});

// ============================================
// Initialize
// ============================================

// Ensure panel starts hidden and in default mode
panel?.setAttribute("data-panel-hidden", "");
switchToMode("default");

console.log("Vibe controls initialized");
