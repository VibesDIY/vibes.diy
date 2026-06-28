// Lifted verbatim from @fireproof/core-gateways-file-node@0.24.19
// `to-array-buffer.js` (upstream tag fireproof-storage/fireproof@v0.24.19).
// Imports only adjusted; behavior byte-identical.
import { Buffer } from "node:buffer";

export function toArrayBuffer(buffer: Buffer | string): Uint8Array {
  if (typeof buffer === "string") {
    buffer = Buffer.from(buffer);
  }
  const ab = new ArrayBuffer(buffer.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return view;
}
