import { VibeSandboxApi } from "./register-dependencies.js";
import { isResErrorImgVibes } from "@vibes.diy/vibe-types";

// Re-export ImgVibes component from @vibes.diy/base so sandbox apps can import { ImgVibes } from "use-vibes"
export { ImgVibes, useImgVibes } from "@vibes.diy/base";

export let imgVibes: (prompt: string) => Promise<string[]>;

export function registerImgVibes(vibeApi: VibeSandboxApi): void {
  imgVibes = async (prompt: string): Promise<string[]> => {
    const rResult = await vibeApi.imgVibes(prompt);
    if (rResult.isErr()) {
      throw rResult.Err();
    }
    const res = rResult.Ok();
    if (isResErrorImgVibes(res)) {
      throw new Error(res.message);
    }
    return res.imageUrls;
  };
}
