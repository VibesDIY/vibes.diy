import { VibeSandboxApi } from "./register-dependencies.js";
import { isResErrorImageGen } from "@vibes.diy/vibe-types";

export let imageGen: (prompt: string) => Promise<string[]>;

export function registerImageGen(vibeApi: VibeSandboxApi): void {
  imageGen = async (prompt: string): Promise<string[]> => {
    const rResult = await vibeApi.imageGen(prompt);
    if (rResult.isErr()) {
      throw rResult.Err();
    }
    const res = rResult.Ok();
    if (isResErrorImageGen(res)) {
      throw new Error(res.message);
    }
    return res.imageUrls;
  };
}
