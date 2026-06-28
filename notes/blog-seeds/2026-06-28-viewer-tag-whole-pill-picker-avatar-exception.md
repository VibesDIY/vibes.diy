# The whole tag is the button now: dropping the dead caret, routing the avatar around it

Source: vibe-switch viewer-tag follow-up to #2678

The agent-in-vibe card's handle tag shipped as `@meghan ▾` — a labelled caret
button you had to hit to open the "Acting as" picker. This change deletes the
triangle and makes the *entire* pill the trigger: click anywhere on the tag and
the HandlePickerMenu opens. The one carve-out is the avatar — clicking the photo
makes a new avatar instead, reusing the existing upload + consent-overlay flow.

Decisions worth a full post:

- **Two click targets in one pill, no nested buttons.** A real `<button>` wrapping
  another interactive element is invalid and a screen-reader trap. So the avatar
  stays a `role="button"` span that `stopPropagation()`s, the name is the labelled
  `<button aria-label="Switch handle">` (keyboard/SR-reachable trigger), and the
  outer pill carries a convenience `onClick` for the dead padding. Click the
  avatar → upload; click anything else → picker; and the bubble is stopped so the
  pill's onClick never double-fires.
- **"Reuse the consent overlay" meant extracting it, not re-implementing it.** The
  in-vibe ViewerTag already uploads avatars through the `avatarConfirmController`
  preview/confirm gate (via the srv-sandbox bridge). The card is host-side, so it
  can't use that bridge — but Settings' `HandleAvatarEditor` had the host-side
  4-step flow (grant → POST → confirm → `ensureHandleAvatar`) inline. Pulled that
  into `lib/upload-avatar.ts` so both the card and Settings go through the *same*
  consent modal. The blog seed for #2678 had explicitly scoped avatar-on-the-card
  out; this is the wiring it deferred, done by sharing not duplicating.
- **The gotcha: `trailing` is not the caret.** First pass deleted the `trailing`
  slot along with the `▾`. tsc caught it — `SharePanelView`'s member roster uses
  `trailing` for the read-only role label (owner/editor/reader). The caret was a
  *consumer* of the slot, not the slot itself. Kept `trailing`, removed only the
  card's caret usage, and the picker trigger is now `onTagClick` instead.
- **Cache-bust the per-handle avatar URL after a write.** `/u/<handle>/avatar` is
  cacheable, so a fresh upload wouldn't repaint. The route bumps an `avatarVersion`
  and appends `?v=` on success, then re-runs whoAmI so the embedded vibe (whose
  avatar comes from the same endpoint) updates in step.
