import type { Clerk } from "@clerk/clerk-js";
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
 * - Clerk logout integration
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

// Clerk instance reference (received via CustomEvent)
let clerkInstance: Clerk | null = null;

// Listen for Clerk instance to be ready
window.addEventListener("clerk-instance-ready", (ei) => {
  const e = ei as CustomEvent<{ clerk: Clerk }>;
  clerkInstance = e.detail.clerk;
  console.log("✅ Clerk instance ready for vibe controls");
});

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

function generateRandomInstanceId() {
  // Simple random ID generator (12 chars alphanumeric)
  return Array.from(
    { length: 12 },
    () =>
      "0123456789abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 36)],
  ).join("");
}

function generateFreshDataUrl() {
  const slug = getAppSlug();
  const instanceId = generateRandomInstanceId();
  const { protocol, host } = window.location;
  return `${protocol}//${host}/vibe/${slug}/${instanceId}`;
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
  ?.addEventListener("click", async () => {
    // Dispatch sync disable event
    document.dispatchEvent(new CustomEvent("vibes-sync-disable"));

    // Call Clerk signOut using the event-received instance
    if (clerkInstance) {
      await clerkInstance.signOut();
      // Clerk handles redirect automatically
    } else {
      console.error("Clerk instance not available for logout");
      // Fallback: redirect to home
      window.location.href = "/";
    }
  });

document
  .querySelector('[data-action="remix"]')
  ?.addEventListener("click", () => {
    switchToMode("mutate");
  });

document
  .querySelector('[data-action="invite"]')
  ?.addEventListener("click", () => {
    switchToMode("invite");
  });

document
  .querySelector('[data-action="home"]')
  ?.addEventListener("click", () => {
    window.location.href = "/";
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

const inviteForm = document.querySelector(
  "[data-invite-form]",
) as HTMLFormElement | null;
const inviteStatus = document.querySelector(
  "[data-invite-status]",
) as HTMLElement | null;
const inviteInput = inviteForm?.querySelector(
  'input[type="email"]',
) as HTMLInputElement | null;

inviteForm?.addEventListener("submit", (e) => {
  e.preventDefault();

  // Get form data
  const formData = new FormData(inviteForm);
  const email = formData.get("email");

  if (!email) {
    console.error("Email is required");
    return;
  }

  // Show loading state
  if (inviteStatus) {
    inviteStatus.textContent = "Inviting...";
    inviteStatus.style.display = "block";
    inviteStatus.className = "";
  }

  // Dispatch custom event to trigger share
  document.dispatchEvent(
    new CustomEvent("vibes-share-request", {
      detail: {
        email: email,
        role: "member",
        right: "read",
      },
    }),
  );
});

// Listen for share success
document.addEventListener("vibes-share-success", () => {
  // const e = ei as Event | {detail: unknown};
  // console.log('Share successful:', e.detail);

  if (inviteInput) {
    // Show success feedback
    inviteInput.style.backgroundColor = "rgba(220, 255, 220, 0.8)";
    inviteInput.value = "";
    inviteInput.placeholder = "Invited! Add another?";

    setTimeout(() => {
      inviteInput.style.backgroundColor = "";
      inviteInput.placeholder = "friend@example.com";
    }, 3000);
  }

  if (inviteStatus) {
    inviteStatus.textContent = "Invitation sent!";
    inviteStatus.className = "success";

    setTimeout(() => {
      inviteStatus.style.display = "none";
    }, 3000);
  }
});

// Listen for share error
document.addEventListener("vibes-share-error", () => {
  // console.error('Share failed:', e.detail.error);

  if (inviteInput) {
    // Show error feedback
    inviteInput.style.backgroundColor = "rgba(255, 220, 220, 0.8)";
    inviteInput.placeholder = "Error - try again";

    setTimeout(() => {
      inviteInput.style.backgroundColor = "";
      inviteInput.placeholder = "friend@example.com";
    }, 3000);
  }

  if (inviteStatus) {
    inviteStatus.textContent = `Error: \${e.detail.error || 'Failed to send invitation'}`;
    inviteStatus.className = "error";
  }
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
