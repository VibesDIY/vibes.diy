// The device-id `getKeyBag` setup, lifted from @fireproof/core-keybag@0.24.19
// `key-bag-setup.js` (upstream tag fireproof-storage/fireproof@v0.24.19). Resolves
// the keybag URL exactly as upstream (`FP_KEYBAG_URL` → `$HOME/.fireproof/keybag`
// on node), memoizes the KeyBag per URL, and dispatches the provider by protocol.
//
// Provider registry carries `file:` (prod) and `memory:` (tests) — both live. The
// `indexeddb:` provider is dead on arrival here: the identity keybag is node-only
// (`./node`), the browser never reads a device-id keybag, so it is intentionally
// not lifted (skip dead-on-arrival; the later cleanup pass owns that boundary).
// The deno filesystem stays live inside `file:`'s provider (sysFileSystemFactory).
import { URI, runtimeFn, KeyedResolvOnce } from "@adviser/cement";
import type { SuperThis } from "@fireproof/core-types-base";
import { KeyBag, type KeyBagProvider, type KeyBagRuntime } from "./key-bag.js";
import { KeyBagProviderFile } from "./key-bag-file.js";
import { KeyBagProviderMemory } from "./key-bag-memory.js";

interface KeyBagProviderFactoryItem {
  readonly protocol: string;
  readonly factory: (url: URI, sthis: SuperThis) => Promise<KeyBagProvider>;
}

const keyBagProviderFactories = new Map<string, KeyBagProviderFactoryItem>(
  (
    [
      {
        protocol: "file:",
        factory: async (url: URI, sthis: SuperThis) => new KeyBagProviderFile(url, sthis),
      },
      {
        protocol: "memory:",
        factory: async (url: URI, sthis: SuperThis) => new KeyBagProviderMemory(url, sthis),
      },
    ] as const
  ).map((i) => [i.protocol, i])
);

export function defaultKeyBagUrl(sthis: SuperThis): URI {
  let bagFnameOrUrl = sthis.env.get("FP_KEYBAG_URL");
  let url: URI;
  if (runtimeFn().isBrowser) {
    url = URI.from(bagFnameOrUrl || "indexeddb://fp-keybag");
  } else {
    if (!bagFnameOrUrl) {
      const home = sthis.env.get("HOME");
      bagFnameOrUrl = `${home}/.fireproof/keybag`;
      url = URI.from(`file://${bagFnameOrUrl}`);
    } else {
      url = URI.from(bagFnameOrUrl);
    }
  }
  return url;
}

function defaultKeyBagOpts(sthis: SuperThis, kbo: { readonly url?: URI | string }): KeyBagRuntime {
  const url = kbo.url ? URI.from(kbo.url) : defaultKeyBagUrl(sthis);
  const kitem = keyBagProviderFactories.get(url.protocol);
  if (!kitem) {
    throw new Error(`unsupported protocol: ${url.toString()}`);
  }
  if (url.hasParam("masterkey")) {
    throw new Error(`masterkey is not supported: ${url.toString()}`);
  }
  return {
    url,
    sthis,
    getBagProvider: () => kitem.factory(url, sthis),
    id: () => url.toString(),
  };
}

const _keyBags = new KeyedResolvOnce<KeyBag>();
export async function getKeyBag(sthis: SuperThis, kbo: { readonly url?: URI | string } = {}): Promise<KeyBag> {
  await sthis.start();
  const rt = defaultKeyBagOpts(sthis, kbo);
  return _keyBags.get(rt.id()).once(() => KeyBag.create(rt));
}
