// Lifted verbatim from @fireproof/core-runtime@0.24.19 `utils.js` (upstream tag
// fireproof-storage/fireproof@v0.24.19), adjusting only imports/types. The
// `SuperThis` runtime context the identity facade re-exports as `ensureSuperThis`
// / `ensureLogger` (and `runtimeFn`, re-exported straight from cement). This is
// thin glue over `@adviser/cement` (envFactory / toCryptoRuntime / LoggerImpl /
// AppContext) + multiformats base58 + TextEncoder/Decoder — no bespoke crypto.
// Behavior kept identical so the full external facade contract (nextId,
// timeOrderedNextId, env get/gets/set/sets/delete, txt base64/base58/encode/
// decode, logger incl. Flush, pathOps, start) is preserved. Gated by the
// extracted==fireproof cross-check in `./superthis.test.ts` plus the full api
// suite. `ensureSuperThis` stays the only `core-runtime` value import until T5.
import {
  AppContext,
  IsLogger,
  JSONFormatter,
  LoggerImpl,
  ResolveOnce,
  Result,
  YAMLFormatter,
  envFactory,
  isURL,
  runtimeFn,
  toCryptoRuntime,
} from "@adviser/cement";
import type { Logger } from "@adviser/cement";
import { base58btc } from "multiformats/bases/base58";
import type { SuperThis, SuperThisOpts, PathOps, TextEndeCoder } from "@fireproof/core-types-base";

type CryptoRuntime = ReturnType<typeof toCryptoRuntime>;
interface NextIdResult {
  readonly str: string;
  readonly bin: Uint8Array;
}

// `runtimeFn` is a pure cement re-export (runtime detection) — surfaced here so
// the identity facade can source it in-repo instead of from core-runtime.
export { runtimeFn };

const _globalLogger = new ResolveOnce<Logger>();
function globalLogger(): Logger {
  return _globalLogger.once(() => new LoggerImpl());
}
const registerFP_DEBUG = new ResolveOnce<void>();

interface SuperThisImplOpts {
  readonly logger: Logger;
  readonly env: SuperThis["env"];
  readonly crypto: CryptoRuntime;
  readonly pathOps: PathOps;
  readonly txt: TextEndeCoder;
  readonly ctx: AppContext;
}

class SuperThisImpl {
  readonly logger: Logger;
  readonly env: SuperThis["env"];
  readonly pathOps: PathOps;
  readonly ctx: AppContext;
  readonly txt: TextEndeCoder;
  readonly crypto: CryptoRuntime;
  constructor(opts: SuperThisImplOpts) {
    this.logger = opts.logger;
    this.env = opts.env;
    this.crypto = opts.crypto;
    this.pathOps = opts.pathOps;
    this.txt = opts.txt;
    this.ctx = opts.ctx;
  }
  nextId(bytes = 6): NextIdResult {
    const bin = this.crypto.randomBytes(bytes);
    return {
      str: base58btc.encode(bin),
      bin,
    };
  }
  timeOrderedNextId(now?: number): { str: string } {
    now = typeof now === "number" ? now : new Date().getTime();
    const t = (0x1000000000000 + now).toString(16).replace(/^1/, "");
    const bin = this.crypto.randomBytes(10);
    // verbatim: upstream `(bin[1] & 0xf0) | (bin[1] | 0x08 && 0x0b)` parses with
    // `&&` BELOW `|`, i.e. `(bin[1] & 0xf0) | ((bin[1] | 0x08) && 0x0b)`. The left
    // of `&&` is always truthy, so the result is always `(bin[1] & 0xf0) | 0x0b`
    // (low nibble forced to `b`). Written out so the precedence can't be misread.
    bin[1] = (bin[1] & 0xf0) | 0x0b;
    const hex = Array.from(bin)
      .map((i: number) => i.toString(16).padStart(2, "0"))
      .join("");
    return {
      str: `${t.slice(0, 8)}-${t.slice(8)}-7${hex.slice(0, 3)}-${hex.slice(3, 7)}-${hex.slice(7, 19)}`,
    };
  }
  start(): Promise<void> {
    return Promise.resolve();
  }
  clone(override: Partial<SuperThisImplOpts>): SuperThis {
    return new SuperThisImpl({
      logger: override.logger || this.logger,
      // verbatim: upstream always calls envFactory(override.env) (even undefined)
      env: envFactory(override.env as Parameters<typeof envFactory>[0]) || this.env,
      crypto: override.crypto || this.crypto,
      pathOps: override.pathOps || this.pathOps,
      txt: override.txt || this.txt,
      ctx: AppContext.merge(this.ctx, override.ctx),
    }) as unknown as SuperThis;
  }
}

function presetEnv(ipreset?: Map<string, string> | Record<string, string>): Map<string, string> {
  let preset: Record<string, string> = {};
  if (ipreset instanceof Map) {
    preset = Object.fromEntries(ipreset.entries());
  } else if (typeof ipreset === "object" && ipreset !== null) {
    preset = ipreset;
  }
  const penv = new Map([
    ...Array.from(
      Object.entries({
        ...setPresetEnv({}),
        ...preset,
      })
    ),
  ]);
  return penv;
}

class pathOpsImpl implements PathOps {
  join(...paths: string[]): string {
    return paths.map((i) => i.replace(/\/+$/, "")).join("/");
  }
  dirname(path: string): string {
    return path.split("/").slice(0, -1).join("/");
  }
  basename(path: string): string {
    return path.split("/").pop() || "";
  }
}
const pathOps = new pathOpsImpl();

const txtOps: TextEndeCoder = ((txtEncoder: TextEncoder, txtDecoder: TextDecoder) =>
  ({
    id: () => "fp-txtOps",
    encode: (input: string) => txtEncoder.encode(input),
    decode: (input: Uint8Array) => txtDecoder.decode(coerceIntoUint8(input).Ok()),
    base64: {
      encode: (input: string | Uint8Array) => {
        if (typeof input === "string") {
          const data = txtEncoder.encode(input);
          return btoa(String.fromCharCode(...data));
        }
        let charStr = "";
        for (const i of coerceIntoUint8(input).Ok()) {
          charStr += String.fromCharCode(i);
        }
        return btoa(charStr);
      },
      decodeUint8: (input: string) => {
        const data = atob(input.replace(/\s+/g, ""));
        return new Uint8Array(data.split("").map((c) => c.charCodeAt(0)));
      },
      decode: (input: string) => {
        const data = atob(input.replace(/\s+/g, ""));
        const uint8 = new Uint8Array(data.split("").map((c) => c.charCodeAt(0)));
        return txtDecoder.decode(uint8);
      },
    },
    base58: {
      encode: (input: string | Uint8Array) => {
        if (typeof input === "string") {
          const data = txtEncoder.encode(input);
          return base58btc.encode(data);
        }
        return base58btc.encode(coerceIntoUint8(input).Ok());
      },
      decodeUint8: (input: string) => {
        return base58btc.decode(input.replace(/\s+/g, ""));
      },
      decode: (input: string) => {
        const data = base58btc.decode(input.replace(/\s+/g, ""));
        return txtDecoder.decode(data);
      },
    },
  }) as unknown as TextEndeCoder)(new TextEncoder(), new TextDecoder());

export function coerceIntoUint8(raw: Uint8Array | Result<Uint8Array> | unknown): Result<Uint8Array> {
  if (raw instanceof Uint8Array) {
    return Result.Ok(raw);
  }
  if (Result.Is(raw)) {
    return raw as Result<Uint8Array>;
  }
  return Result.Err("Not a Uint8Array");
}

const _onSuperThis = new Map<string, (sthis: SuperThis) => void>();
export function onSuperThis(fn: (sthis: SuperThis) => void): () => void {
  const key = `onSuperThis-${Math.random().toString(36).slice(2)}`;
  _onSuperThis.set(key, fn);
  return () => {
    _onSuperThis.delete(key);
  };
}

export function setPresetEnv(o: Record<string, string>, symbol = "FP_PRESET_ENV"): Record<string, string> {
  const key = Symbol.for(symbol);
  const g = globalThis as unknown as Record<symbol, Record<string, string>>;
  const env = g[key] ?? {};
  for (const [k, v] of Object.entries(o)) {
    env[k] = v;
  }
  g[key] = env;
  return env;
}

export function ensureSuperThis(osthis?: Partial<SuperThisOpts>): SuperThis {
  const env = envFactory({
    symbol: osthis?.env?.symbol || "FP_ENV",
    presetEnv: presetEnv(osthis?.env?.presetEnv),
  });
  const ret = new SuperThisImpl({
    logger: osthis?.logger || globalLogger(),
    env,
    crypto: osthis?.crypto || toCryptoRuntime(),
    ctx: AppContext.merge(osthis?.ctx),
    pathOps,
    txt: osthis?.txt || txtOps,
  }) as unknown as SuperThis;
  _onSuperThis.forEach((fn) => fn(ret));
  return ret;
}

export function ensureSuperLog(sthis: SuperThis, componentName: string, ctx?: Record<string, unknown>): SuperThis {
  return sthis.clone({
    logger: ensureLogger(sthis, componentName, ctx),
  });
}

export function ensureLogger(sthis: SuperThis, componentName: string, ctx?: Record<string, unknown>): Logger {
  let logger: Logger;
  if (sthis && IsLogger(sthis.logger)) {
    logger = sthis.logger;
  } else {
    logger = globalLogger();
  }
  const cLogger = logger.With().Module(componentName);
  const debug: string[] = [];
  let exposeStack = false;
  if (ctx) {
    if ("debug" in ctx) {
      if (typeof ctx.debug === "string" && ctx.debug.length > 0) {
        debug.push(ctx.debug);
      } else {
        debug.push(componentName);
      }
      delete ctx.debug;
    }
    if ("exposeStack" in ctx) {
      exposeStack = true;
      delete ctx.exposeStack;
    }
    if ("exposeStack" in ctx) {
      exposeStack = true;
      delete ctx.exposeStack;
    }
    if ("this" in ctx) {
      cLogger.Str("this", (sthis as SuperThis).nextId(4).str);
      delete ctx.this;
    }
    for (const [key, value] of Object.entries(ctx)) {
      switch (typeof value) {
        case "string":
          cLogger.Str(key, value);
          break;
        case "number":
          cLogger.Uint64(key, value);
          break;
        default:
          if (value instanceof Date) {
            cLogger.Str(key, value.toISOString());
          } else if (isURL(value)) {
            cLogger.Str(key, value.toString());
          } else if (typeof value === "function") {
            cLogger.Ref(key, value);
          } else {
            cLogger.Any(key, value);
          }
          break;
      }
    }
  }
  registerFP_DEBUG
    .once(async () => {
      sthis.env.onSet(
        (key: string, value?: string) => {
          switch (key) {
            case "FP_FORMAT": {
              switch (value) {
                case "jsonice":
                  logger.SetFormatter(new JSONFormatter(logger.TxtEnDe(), 2));
                  break;
                case "yaml":
                  logger.SetFormatter(new YAMLFormatter(logger.TxtEnDe(), 2));
                  break;
                case "json":
                default:
                  logger.SetFormatter(new JSONFormatter(logger.TxtEnDe()));
                  break;
              }
              break;
            }
            case "FP_DEBUG":
              logger.SetDebug(value || []);
              break;
            case "FP_STACK":
              logger.SetExposeStack(!!value);
              break;
          }
        },
        "FP_FORMAT",
        "FP_DEBUG",
        "FP_STACK"
      );
    })
    .finally(() => {
      // noop — mirrors upstream
    });
  if (debug.length > 0) {
    logger.SetDebug(debug);
  }
  if (exposeStack) {
    logger.SetExposeStack(true);
  }
  const out = cLogger.Logger();
  if (sthis.env.get("FP_CONSTRUCTOR_DEBUG")) {
    out.Debug().Msg("constructor");
  }
  return out;
}
