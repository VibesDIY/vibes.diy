import type { SelectedSlotInput } from "@vibes.diy/api-types";
import type { PromptState } from "../routes/chat/chat.$userSlug.$appSlug.js";

// On a freshly forked/cloned chat the user lands in the editor with no
// ChatSections but with the source code hydrated into promptState for the
// code view. Without this helper the first user prompt fires with only the
// typed text — the model has no context that an existing app is being
// edited and generates a brand-new app. Bug #1781.
//
// Returns a SELECTED_DRAFT slot input carrying /App.jsx when (a) the chat
// has no prior blocks and (b) the hydrated source matches the URL fsId.
// On any follow-up turn (blocks.length > 0) the chat's own timeline
// supplies the PREVIOUS slot, so we stop attaching the draft.
export function buildClonedSourceSelected(state: PromptState, fsId: string | undefined): SelectedSlotInput | undefined {
  if (fsId === undefined) return undefined;
  if (state.blocks.length !== 0) return undefined;
  const src = state.hydratedSource;
  if (!src || src.fsId !== fsId) return undefined;
  return {
    kind: "draft",
    files: [
      {
        type: "code-block",
        filename: "/App.jsx",
        lang: "jsx",
        content: src.code.join("\n"),
      },
    ],
  };
}
