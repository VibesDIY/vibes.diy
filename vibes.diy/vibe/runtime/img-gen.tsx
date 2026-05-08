import { VibeSandboxApi } from "./register-dependencies.js";
import { ImgGenFile, isResErrorImgGen } from "@vibes.diy/vibe-types";
import { resizeImageToBase64 } from "./resize-image.js";

// Re-export ImgGen component from @vibes.diy/base so sandbox apps can
// `import { ImgGen } from "use-vibes"`.
export { ImgGen, useImgGen } from "@vibes.diy/base";

export let imgGen: (prompt: string, inputImage?: File, model?: string) => Promise<ImgGenFile[]>;

export function registerImgGen(vibeApi: VibeSandboxApi): void {
  imgGen = async (prompt: string, inputImage?: File, model?: string): Promise<ImgGenFile[]> => {
    let inputImageBase64: string | undefined;
    if (inputImage) {
      inputImageBase64 = await resizeImageToBase64(inputImage);
    }
    const rResult = await vibeApi.imgGen(prompt, inputImageBase64, model);
    if (rResult.isErr()) {
      throw rResult.Err();
    }
    const res = rResult.Ok();
    if (isResErrorImgGen(res)) {
      throw new Error(res.message);
    }
    return res.files;
  };
}
