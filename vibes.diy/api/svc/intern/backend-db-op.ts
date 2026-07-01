// Re-export the backend `ctx.db` op handler + its internal URL from vibe-runtime,
// so the host BackendDO (in `pkg`, which depends on api-svc, not vibe-runtime
// directly) can route the isolate's self-stub `globalOutbound` db-ops to it
// (#2856 B6). Same module instance as the executor → shared nonce registry.
export { BACKEND_DB_OP_URL, handleBackendDbOp } from "@vibes.diy/vibe-runtime/backend-executor.js";
