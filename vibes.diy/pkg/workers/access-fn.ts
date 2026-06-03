import { DurableObject, Request as CFRequest, Response as CFResponse } from "@cloudflare/workers-types";
import type { UserContext } from "@vibes.diy/api-types";
import { getQuickJSWASMModule } from "@cf-wasm/quickjs";

declare const Response: typeof CFResponse;

interface GrantState {
  members: Record<string, string[]>;
  roleGrants: Record<string, string[]>;
  userGrants: Record<string, string[]>;
}

const InvokeBody = {
  parse(raw: unknown): {
    doc: unknown;
    oldDoc: unknown | null;
    user: UserContext | null;
    source?: string;
    grantState?: GrantState;
    adminMode?: boolean;
  } {
    if (typeof raw !== "object" || raw === null) throw new Error("invalid invoke body");
    return raw as {
      doc: unknown;
      oldDoc: unknown | null;
      user: UserContext | null;
      source?: string;
      grantState?: GrantState;
      adminMode?: boolean;
    };
  },
};

export class AccessFnDO implements DurableObject {
  async fetch(request: CFRequest): Promise<CFResponse> {
    if (request.method !== "POST") {
      return new Response("expected POST", { status: 400 });
    }

    let body: {
      doc: unknown;
      oldDoc: unknown | null;
      user: UserContext | null;
      source?: string;
      grantState?: GrantState;
      adminMode?: boolean;
    };
    try {
      body = InvokeBody.parse(await request.json());
    } catch {
      return new Response(JSON.stringify({ forbidden: "invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!body.source) {
      return new Response(JSON.stringify({ forbidden: "access function source not provided" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const source = body.source;
    const grantState: GrantState = body.grantState ?? { members: {}, roleGrants: {}, userGrants: {} };

    // Helper: resolve effective channels from serialized grant state
    function resolveChannels(userHandle: string): Set<string> {
      const channels = new Set<string>();
      const direct = grantState.userGrants[userHandle];
      if (direct) for (const ch of direct) channels.add(ch);
      for (const [role, members] of Object.entries(grantState.members)) {
        if ((members as string[]).includes(userHandle)) {
          const roleChannels = grantState.roleGrants[role];
          if (roleChannels) for (const ch of roleChannels) channels.add(ch);
        }
      }
      return channels;
    }

    const QuickJS = await getQuickJSWASMModule();
    const vm = QuickJS.newContext();

    try {
      // Set up doc, oldDoc, user globals
      for (const stmt of [
        `const doc = ${JSON.stringify(body.doc)};`,
        `const oldDoc = ${JSON.stringify(body.oldDoc)};`,
        `const user = ${JSON.stringify(body.user)};`,
      ]) {
        const r = vm.evalCode(stmt);
        if (r.error) {
          const errVal = vm.dump(r.error);
          r.error.dispose();
          return new Response(JSON.stringify({ forbidden: `access function setup error: ${String(errVal)}` }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        } else {
          r.value.dispose();
        }
      }

      // Register ctx object with requireAccess/requireRole host functions
      const ctxObj = vm.newObject();

      const requireAccessFn = vm.newFunction("requireAccess", (channelIdHandle: Parameters<typeof vm.dump>[0]) => {
        if (body.adminMode === true) {
          return undefined;
        }
        const channelId = vm.dump(channelIdHandle) as string;
        if (!body.user) {
          return { error: vm.newError("authentication required") };
        }
        const channels = resolveChannels(body.user.userHandle);
        if (!channels.has(channelId)) {
          return { error: vm.newError(`not in channel: ${channelId}`) };
        }
        return undefined;
      });

      const requireRoleFn = vm.newFunction("requireRole", (roleNameHandle: Parameters<typeof vm.dump>[0]) => {
        if (body.adminMode === true) {
          return undefined;
        }
        const roleName = vm.dump(roleNameHandle) as string;
        if (!body.user) {
          return { error: vm.newError("authentication required") };
        }
        const roleMembers = grantState.members[roleName] as string[] | undefined;
        if (!roleMembers?.includes(body.user.userHandle)) {
          return { error: vm.newError(`not in role: ${roleName}`) };
        }
        return undefined;
      });

      vm.setProp(ctxObj, "requireAccess", requireAccessFn);
      vm.setProp(ctxObj, "requireRole", requireRoleFn);
      vm.setProp(vm.global, "ctx", ctxObj);
      requireAccessFn.dispose();
      requireRoleFn.dispose();
      ctxObj.dispose();

      // Source is either:
      // (a) named export: "function notes(doc, ...) { ... }"
      // (b) anonymous function: "function(doc, ...) { ... }"
      // (c) arrow function: "(doc, ...) => { ... }" or "doc => { ... }"
      // (d) function body from legacy Phase 4: "return { allowAnonymous: true };"
      // export/default keywords are already stripped by extractExportSource.
      const cleanSource = source.replace(/export\s+/g, "").replace(/^default\s+/, "");
      const fnNameMatch = cleanSource.match(/^function\s+(\w+)\s*\(/);
      const isAnonymousFnOrArrow = /^function\s*\(/.test(cleanSource) || /^\(/.test(cleanSource) || /^\w+\s*=>/.test(cleanSource);
      const evalSource = fnNameMatch
        ? `${cleanSource}\n;${fnNameMatch[1]}(doc, oldDoc, user, ctx)`
        : isAnonymousFnOrArrow
          ? `const __accessFn = ${cleanSource}\n;__accessFn(doc, oldDoc, user, ctx)`
          : `(function() { ${cleanSource} })()`;
      const fnResult = vm.evalCode(evalSource);

      if (fnResult.error) {
        const errVal = vm.dump(fnResult.error);
        fnResult.error.dispose();
        const reason =
          typeof errVal === "object" && errVal !== null && "forbidden" in errVal
            ? String((errVal as Record<string, unknown>).forbidden)
            : typeof errVal === "string"
              ? errVal
              : `access function error: ${JSON.stringify(errVal)}`;
        return new Response(JSON.stringify({ forbidden: reason }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const accessResult = vm.dump(fnResult.value);
      fnResult.value.dispose();

      return new Response(JSON.stringify(accessResult), {
        headers: { "Content-Type": "application/json" },
      });
    } finally {
      vm.dispose();
    }
  }
}
