import { VibeSandboxApi } from "./register-dependencies.js";
import { isResErrorCallAI, type JSONSchema } from "@vibes.diy/vibe-types";

export interface CallAIOpts {
  schema: JSONSchema;
}

export let callAI: (prompt: string, opts: CallAIOpts) => Promise<string>;
export let callAi: (prompt: string, opts: CallAIOpts) => Promise<string>;

export function registerCallAI(vibeApi: VibeSandboxApi): void {
  callAi = callAI = async (prompt: string, opts: CallAIOpts): Promise<string> => {
    const rCallAI = await vibeApi.callAI(prompt, opts);
    if (rCallAI.isErr()) {
      throw rCallAI.Err();
    }
    const callAIRes = rCallAI.Ok();
    if (isResErrorCallAI(callAIRes)) {
      throw new Error(callAIRes.message);
    }
    return callAIRes.result;
  };
}
