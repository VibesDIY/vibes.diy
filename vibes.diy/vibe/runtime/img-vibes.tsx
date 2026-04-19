import { VibeSandboxApi } from "./register-dependencies.js";
import { isResErrorImgVibes } from "@vibes.diy/vibe-types";
import { resizeImageToBase64 } from "./resize-image.js";

// Re-export ImgVibes component from @vibes.diy/base so sandbox apps can import { ImgVibes } from "use-vibes"
export { ImgVibes, useImgVibes } from "@vibes.diy/base";

export let imgVibes: (prompt: string, inputImage?: File) => Promise<string[]>;

export function registerImgVibes(vibeApi: VibeSandboxApi): void {
  imgVibes = async (prompt: string, inputImage?: File): Promise<string[]> => {
    let inputImageBase64: string | undefined;
    if (inputImage) {
      inputImageBase64 = await resizeImageToBase64(inputImage);
    }
    const rResult = await vibeApi.imgVibes(prompt, inputImageBase64);
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
