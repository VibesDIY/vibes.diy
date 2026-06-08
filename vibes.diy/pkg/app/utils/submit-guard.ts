/** Inputs for the single accept-a-turn decision. */
export interface SubmitGuardState {
  readonly text: string;
  /** A submit was accepted but the stream's first block hasn't landed yet. */
  readonly submitting: boolean;
  /** A turn is actively streaming (promptState.running). */
  readonly running: boolean;
}

/**
 * True only when a brand-new turn may be accepted. Closes the click→first-block
 * window: `submitting` covers the gap before `running` flips true, `running`
 * covers the rest of the turn.
 */
export function shouldAcceptPrompt({ text, submitting, running }: SubmitGuardState): boolean {
  if (submitting || running) return false;
  return text.trim().length > 0;
}
