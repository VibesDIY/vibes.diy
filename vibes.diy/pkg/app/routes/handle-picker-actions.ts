import { toast } from "react-hot-toast";
import type { HandleOption } from "@vibes.diy/base";
import type { Conn } from "@vibes.diy/api-types";

// The active-handle switcher's two write actions (#2678), extracted from the vibe
// route so the success / partial-failure paths are unit-testable without mounting
// the route (#2720). The route keeps `isOwner` + the bindings *load* (it's needed
// early, before refreshViewer is defined); these are just the writes.
//
// "Active handle" is the `defaultHandle` user setting that resolveActiveHandle (#2275)
// honors. Both actions are optimistic with rollback and refresh the embedded vibe's
// viewer identity (whoAmI) on success so the iframe switches personas in step.

/** Per-handle avatar endpoint (#2434); 404s gracefully to the slug initial. */
export const handleAvatarUrl = (slug: string): string => `/u/${encodeURIComponent(slug)}/avatar`;

export interface SwitchActiveHandleDeps {
  readonly slug: string;
  readonly currentSlug: string | undefined;
  readonly sharedApi: Conn<"shared">;
  readonly setBusy: (busy: boolean) => void;
  readonly setActiveHandle: (slug: string) => void;
  readonly refreshViewer: () => Promise<void>;
}

/** Switch the active handle: persist `defaultHandle`, then refresh the viewer.
 *  No-ops when already on `slug`; on write failure, stays put and toasts. */
export async function switchActiveHandle({
  slug,
  currentSlug,
  sharedApi,
  setBusy,
  setActiveHandle,
  refreshViewer,
}: SwitchActiveHandleDeps): Promise<void> {
  if (slug === currentSlug) return;
  setBusy(true);
  const r = await sharedApi.ensureUserSettings({ settings: [{ type: "defaultHandle", ownerHandle: slug }] });
  if (r.isErr()) {
    setBusy(false);
    toast.error(`Couldn't switch handle: ${r.Err().message}`);
    return;
  }
  setActiveHandle(slug);
  await refreshViewer();
  setBusy(false);
}

export interface CreateAndUseHandleDeps {
  readonly sharedApi: Conn<"shared">;
  readonly setBusy: (busy: boolean) => void;
  readonly setHandles: (updater: (prev: HandleOption[]) => HandleOption[]) => void;
  readonly setActiveHandle: (slug: string) => void;
  readonly refreshViewer: () => Promise<void>;
}

/** "New handle": mint a binding (server picks a random slug) and act as it. The
 *  binding is surfaced in the list as soon as it's created; the active handle only
 *  advances if persisting the default succeeds (otherwise the new handle stays in
 *  the list and the partial failure is reported). */
export async function createAndUseHandle({
  sharedApi,
  setBusy,
  setHandles,
  setActiveHandle,
  refreshViewer,
}: CreateAndUseHandleDeps): Promise<void> {
  setBusy(true);
  const r = await sharedApi.createHandleBinding({});
  if (r.isErr()) {
    setBusy(false);
    toast.error(`Couldn't create handle: ${r.Err().message}`);
    return;
  }
  const created = r.Ok().ownerHandle;
  // The binding exists now, so surface it regardless of whether the switch sticks.
  setHandles((prev) =>
    prev.some((h) => h.slug === created) ? prev : [...prev, { slug: created, avatarUrl: handleAvatarUrl(created) }]
  );
  const s = await sharedApi.ensureUserSettings({ settings: [{ type: "defaultHandle", ownerHandle: created }] });
  if (s.isErr()) {
    setBusy(false);
    toast.error(`Created @${created}, but couldn't switch to it: ${s.Err().message}`);
    return;
  }
  setActiveHandle(created);
  await refreshViewer();
  setBusy(false);
  toast.success(`Now acting as @${created}`);
}
