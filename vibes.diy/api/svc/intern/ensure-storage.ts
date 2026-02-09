import { CoerceBinaryInput, to_uint8 } from "@adviser/cement";
import { base58btc } from "multiformats/bases/base58";
import { sha256 } from "multiformats/hashes/sha2";
import { SuperThis } from "@fireproof/core-types-base";

export interface CalcCidResult {
  cid: string;
  data: Uint8Array;
  dataStr(): string;
}
export async function calcCid({ sthis }: { sthis: SuperThis }, content: CoerceBinaryInput): Promise<CalcCidResult> {
  const uint8Content = to_uint8(content);
  const hash = await sha256.digest(uint8Content);
  return {
    cid: base58btc.encode(hash.digest),
    data: uint8Content,
    dataStr: () => {
      if (typeof content === "string") {
        return content;
      } else {
        return sthis.txt.decode(uint8Content);
      }
    },
  };
}
