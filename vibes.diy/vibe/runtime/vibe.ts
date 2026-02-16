import { type } from "arktype";

// the vibe'd react website
export const vibeEnv = type({
});

export const vibeMountParams = type({
  usrEnv: vibeEnv
});

export type VibeMountParams = typeof vibeMountParams.infer;
