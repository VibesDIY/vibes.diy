// Lifted verbatim from @fireproof/core-gateways-file@0.24.19
// `sys-file-system-factory.js` + the per-gateway `get-sys-file-system.js`
// singletons (upstream tag fireproof-storage/fireproof@v0.24.19). Branches on the
// runtime and returns a memoized SysFileSystem — node OR deno. Both runtimes are
// preserved (deno anchors cross-runtime correctness). Imports only adjusted: the
// dynamic gateway imports now point at the in-repo node/deno wrappers.
import { runtimeFn, ResolveOnce } from "@adviser/cement";
import type { URI } from "@adviser/cement";
import type { SysFileSystem } from "../../types/sthis.js";

const nodeFs = new ResolveOnce<SysFileSystem>();
const denoFs = new ResolveOnce<SysFileSystem>();

export function sysFileSystemFactory(_uri: URI): Promise<SysFileSystem> {
  const rt = runtimeFn();
  switch (true) {
    case rt.isNodeIsh:
      return nodeFs.once(async () => {
        const { NodeFileSystem } = await import("./node-filesystem.js");
        return new NodeFileSystem().start();
      });
    case rt.isDeno:
      return denoFs.once(async () => {
        const { DenoFileSystem } = await import("./deno-filesystem.js");
        return new DenoFileSystem().start();
      });
    default:
      throw new Error(`unsupported runtime:${JSON.stringify(rt)}`);
  }
}
