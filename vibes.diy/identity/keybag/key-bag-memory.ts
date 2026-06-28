// Lifted verbatim from @fireproof/core-keybag@0.24.19 `key-bag-memory.js`
// (upstream tag fireproof-storage/fireproof@v0.24.19). The in-memory keybag
// provider used by tests (`memory://…`). Preserved because it is live (tests rely
// on it); the same on-disk JSON shape is kept in RAM. Imports only adjusted.
import type { URI } from "@adviser/cement";
import type { SuperThis } from "@fireproof/core-types-base";

const memoryKeyBag = new Map<string, Uint8Array>();

export class KeyBagProviderMemory {
  readonly url: URI;
  readonly sthis: SuperThis;
  constructor(url: URI, sthis: SuperThis) {
    this.url = url;
    this.sthis = sthis;
  }
  #key(id: string): string {
    return `${this.url.pathname}/${id}`;
  }
  del(id: string): Promise<void> {
    const key = this.#key(id);
    if (memoryKeyBag.has(key)) {
      memoryKeyBag.delete(key);
    }
    return Promise.resolve();
  }
  async get(id: string): Promise<unknown> {
    const binKeyItem = memoryKeyBag.get(this.#key(id));
    if (binKeyItem) {
      try {
        const ki = JSON.parse(this.sthis.txt.decode(binKeyItem));
        return ki;
      } catch {
        // corrupt in-memory item → treat as absent (verbatim: upstream swallows)
      }
    }
    return undefined;
  }
  async set(id: string, item: unknown): Promise<void> {
    const p = this.sthis.txt.encode(JSON.stringify(item, null, 2));
    memoryKeyBag.set(this.#key(id), p);
  }
}
