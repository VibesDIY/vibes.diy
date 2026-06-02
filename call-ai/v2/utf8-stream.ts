import { TxtEnDecoderSingleton } from "@adviser/cement";

const txt = TxtEnDecoderSingleton();
const emptyBytes = new Uint8Array(0);

export interface Utf8StreamDecoder {
  decodeChunk(chunk: Uint8Array): string;
  flush(): string;
}

export function encodeUtf8(input: string): Uint8Array {
  return txt.encode(input);
}

export function utf8ByteLength(input: string): number {
  return encodeUtf8(input).length;
}

function concatUint8Arrays(left: Uint8Array, right: Uint8Array): Uint8Array {
  if (left.length === 0) {
    return right;
  }

  if (right.length === 0) {
    return left;
  }

  const combined = new Uint8Array(left.length + right.length);
  combined.set(left);
  combined.set(right, left.length);
  return combined;
}

function isContinuationByte(value: number): boolean {
  return (value & 0b1100_0000) === 0b1000_0000;
}

function expectedUtf8Length(leadByte: number): number {
  switch (true) {
    case (leadByte & 0b1000_0000) === 0:
      return 1;
    case (leadByte & 0b1110_0000) === 0b1100_0000:
      return 2;
    case (leadByte & 0b1111_0000) === 0b1110_0000:
      return 3;
    case (leadByte & 0b1111_1000) === 0b1111_0000:
      return 4;
    default:
      return 1;
  }
}

function splitDecodableChunk(bytes: Uint8Array): { decodable: Uint8Array; remainder: Uint8Array } {
  if (bytes.length === 0) {
    return { decodable: bytes, remainder: emptyBytes };
  }

  let leadIndex = bytes.length - 1;
  while (leadIndex >= 0 && isContinuationByte(bytes[leadIndex])) {
    leadIndex -= 1;
  }

  if (leadIndex < 0) {
    return { decodable: bytes, remainder: emptyBytes };
  }

  const expectedLength = expectedUtf8Length(bytes[leadIndex]);
  const availableLength = bytes.length - leadIndex;

  if (availableLength < expectedLength) {
    return {
      decodable: bytes.subarray(0, leadIndex),
      remainder: bytes.subarray(leadIndex),
    };
  }

  return { decodable: bytes, remainder: emptyBytes };
}

export function createUtf8StreamDecoder(): Utf8StreamDecoder {
  let remainder: Uint8Array = emptyBytes;

  return {
    decodeChunk(chunk: Uint8Array): string {
      const combined = concatUint8Arrays(remainder, chunk);
      const split = splitDecodableChunk(combined);
      remainder = split.remainder;

      if (split.decodable.length === 0) {
        return "";
      }

      return txt.decode(split.decodable);
    },

    flush(): string {
      if (remainder.length === 0) {
        return "";
      }

      const trailing = txt.decode(remainder);
      remainder = emptyBytes;
      return trailing;
    },
  };
}
