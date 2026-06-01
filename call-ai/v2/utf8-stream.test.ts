import { describe, it, expect } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createUtf8StreamDecoder, encodeUtf8, utf8ByteLength } from "./utf8-stream.js";

const sthis = ensureSuperThis();

describe("utf8-stream", () => {
  describe("encodeUtf8 / utf8ByteLength", () => {
    it("encodes ASCII", () => {
      const bytes = encodeUtf8("hello");
      expect(bytes).toEqual(new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]));
      expect(utf8ByteLength("hello")).toBe(5);
    });

    it("encodes multibyte characters", () => {
      expect(utf8ByteLength("é")).toBe(2);
      expect(utf8ByteLength("€")).toBe(3);
      expect(utf8ByteLength("😀")).toBe(4);
    });
  });

  describe("createUtf8StreamDecoder", () => {
    it("decodes plain ASCII in one chunk", () => {
      const decoder = createUtf8StreamDecoder();
      const result = decoder.decodeChunk(new Uint8Array([0x68, 0x69]));
      expect(result).toBe("hi");
      expect(decoder.flush()).toBe("");
    });

    it("decodes a complete multibyte character in one chunk", () => {
      const decoder = createUtf8StreamDecoder();
      // € = E2 82 AC
      const result = decoder.decodeChunk(new Uint8Array([0xe2, 0x82, 0xac]));
      expect(result).toBe("€");
    });

    it("buffers an incomplete 3-byte sequence split across chunks", () => {
      const decoder = createUtf8StreamDecoder();
      // € = E2 82 AC — send first 2 bytes, then the last
      const first = decoder.decodeChunk(new Uint8Array([0xe2, 0x82]));
      expect(first).toBe("");
      const second = decoder.decodeChunk(new Uint8Array([0xac]));
      expect(second).toBe("€");
    });

    it("buffers an incomplete 2-byte sequence", () => {
      const decoder = createUtf8StreamDecoder();
      // é = C3 A9
      const first = decoder.decodeChunk(new Uint8Array([0xc3]));
      expect(first).toBe("");
      const second = decoder.decodeChunk(new Uint8Array([0xa9]));
      expect(second).toBe("é");
    });

    it("buffers an incomplete 4-byte sequence across multiple chunks", () => {
      const decoder = createUtf8StreamDecoder();
      // 😀 = F0 9F 98 80
      expect(decoder.decodeChunk(new Uint8Array([0xf0]))).toBe("");
      expect(decoder.decodeChunk(new Uint8Array([0x9f, 0x98]))).toBe("");
      expect(decoder.decodeChunk(new Uint8Array([0x80]))).toBe("😀");
    });

    it("decodes ASCII before an incomplete tail", () => {
      const decoder = createUtf8StreamDecoder();
      // "A" + first byte of €
      const first = decoder.decodeChunk(new Uint8Array([0x41, 0xe2]));
      expect(first).toBe("A");
      const second = decoder.decodeChunk(new Uint8Array([0x82, 0xac]));
      expect(second).toBe("€");
    });

    it("handles empty chunks", () => {
      const decoder = createUtf8StreamDecoder();
      expect(decoder.decodeChunk(new Uint8Array([]))).toBe("");
      expect(decoder.flush()).toBe("");
    });

    it("flush emits buffered incomplete bytes as replacement characters", () => {
      const decoder = createUtf8StreamDecoder();
      // lone lead byte E2 with no continuations, then flush
      decoder.decodeChunk(new Uint8Array([0xe2]));
      const flushed = decoder.flush();
      expect(flushed.length).toBeGreaterThan(0);
      expect(flushed).toContain("�");
    });

    // This is the exact scenario the codex bot raised as P2 on PR #2111.
    // The bot claimed [0xE2, 0x0A] would be buffered until flush().
    // In reality, 0x0A is not a continuation byte, so splitDecodableChunk
    // sees it as a complete 1-byte ASCII character and decodes immediately.
    it("does NOT buffer invalid lead + ASCII newline (bot P2 scenario)", () => {
      const decoder = createUtf8StreamDecoder();
      const result = decoder.decodeChunk(new Uint8Array([0xe2, 0x0a]));
      expect(result).toContain("\n");
      expect(result.length).toBe(2); // U+FFFD + \n
      expect(decoder.flush()).toBe("");
    });

    it("handles invalid lead + ASCII across chunk boundary", () => {
      const decoder = createUtf8StreamDecoder();
      // chunk 1: "A" + lone 3-byte lead
      const first = decoder.decodeChunk(new Uint8Array([0x41, 0xe2]));
      expect(first).toBe("A");
      // chunk 2: ASCII (not a continuation) — forces decode of buffered 0xE2
      const second = decoder.decodeChunk(new Uint8Array([0x0a, 0x41]));
      expect(second).toContain("\n");
      expect(second).toContain("A");
      expect(decoder.flush()).toBe("");
    });

    it("decodes lone continuation bytes immediately", () => {
      const decoder = createUtf8StreamDecoder();
      // 0x80 is a continuation byte with no preceding lead
      const result = decoder.decodeChunk(new Uint8Array([0x80]));
      expect(result.length).toBeGreaterThan(0);
      expect(decoder.flush()).toBe("");
    });

    it("decodes invalid bytes 0xFE and 0xFF immediately", () => {
      const decoder = createUtf8StreamDecoder();
      const result = decoder.decodeChunk(new Uint8Array([0xfe, 0xff]));
      expect(result.length).toBeGreaterThan(0);
      expect(decoder.flush()).toBe("");
    });

    it("handles a realistic streaming scenario", () => {
      const decoder = createUtf8StreamDecoder();
      const input = "Hello, 世界! 🌍";
      const encoded = encodeUtf8(input);

      let decoded = "";
      // feed byte-by-byte to stress the buffering logic
      for (let i = 0; i < encoded.length; i++) {
        decoded += decoder.decodeChunk(new Uint8Array([encoded[i]]));
      }
      decoded += decoder.flush();
      expect(decoded).toBe(input);
    });

    it("matches TextDecoder output for mixed valid and invalid bytes", () => {
      const decoder = createUtf8StreamDecoder();
      // mix of valid ASCII, incomplete multibyte, and valid multibyte
      const bytes = new Uint8Array([0x41, 0xe2, 0x0a, 0xc3, 0xa9, 0x42]);
      const manual = decoder.decodeChunk(bytes) + decoder.flush();
      const native = sthis.txt.decode(bytes);
      expect(manual).toBe(native);
    });
  });
});
