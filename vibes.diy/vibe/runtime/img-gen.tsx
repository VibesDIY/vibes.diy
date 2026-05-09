import { Result } from "@adviser/cement";
import { VibeSandboxApi } from "./register-dependencies.js";
import { ImgGenFile, ImgGenInputImage, isResErrorImgGen } from "@vibes.diy/vibe-types";
import { resizeImageToBase64 } from "./resize-image.js";

// Re-export ImgGen component from @vibes.diy/base so sandbox apps can
// `import { ImgGen } from "use-vibes"`.
export { ImgGen, useImgGen } from "@vibes.diy/base";

export let imgGen: (prompt: string, inputImage?: ImgGenInputImage, model?: string) => Promise<Result<ImgGenFile[]>>;

export function registerImgGen(vibeApi: VibeSandboxApi): void {
  imgGen = async (prompt: string, inputImage?: ImgGenInputImage, model?: string): Promise<Result<ImgGenFile[]>> => {
    let inputImageBase64: string | undefined;
    if (inputImage) {
      inputImageBase64 = await resizeImageToBase64(inputImage);
    }
    const startedAt = Date.now();
    // eslint-disable-next-line no-console
    console.log("[img-gen] request", {
      model: model ?? "(default)",
      hasInputImage: !!inputImage,
      prompt,
    });
    const log = (status: string, extra: Record<string, unknown>) => {
      // eslint-disable-next-line no-console
      console.log("[img-gen] " + status, {
        model: model ?? "(default)",
        durationMs: Date.now() - startedAt,
        ...extra,
      });
    };
    const rResult = await vibeApi.imgGen(prompt, inputImageBase64, model);
    if (rResult.isErr()) {
      const err = rResult.Err();
      log("error", { message: err.message });
      return Result.Err(err);
    }
    const res = rResult.Ok();
    if (isResErrorImgGen(res)) {
      log("error", { message: res.message });
      return Result.Err(new Error(res.message));
    }
    if (!res.files || res.files.length === 0) {
      log("error", { message: "Image service returned no files" });
      return Result.Err(new Error("Image service returned no files"));
    }
    log("complete", { fileCount: res.files.length, files: res.files });
    return Result.Ok(res.files);
  };
}
