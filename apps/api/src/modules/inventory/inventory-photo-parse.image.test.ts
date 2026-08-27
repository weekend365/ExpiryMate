import { describe, expect, it } from "vitest";
import {
  detectImageMime,
  stripJpegExif,
} from "./inventory-photo-parse.image";

function jpegWithExif() {
  const exifPayload = Buffer.from("Exif\0\0GPS");
  const app1Length = Buffer.alloc(2);
  app1Length.writeUInt16BE(exifPayload.length + 2, 0);
  const soi = Buffer.from([0xff, 0xd8]);
  const app1 = Buffer.from([0xff, 0xe1]);
  const sos = Buffer.from([
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  const eoi = Buffer.from([0xff, 0xd9]);
  const output = Buffer.alloc(
    soi.length + app1.length + app1Length.length + exifPayload.length + sos.length + eoi.length,
  );
  let offset = 0;
  for (const part of [soi, app1, app1Length, exifPayload, sos, eoi]) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

describe("photo parse image helpers", () => {
  it("strips JPEG APP1 Exif so GPS is not forwarded", () => {
    const original = jpegWithExif();
    const stripped = stripJpegExif(original);

    const hex = stripped.toString("hex");
    expect(hex.startsWith("ffd8")).toBe(true);
    expect(hex.includes(Buffer.from("GPS").toString("hex"))).toBe(false);
    expect(hex.includes("ffda")).toBe(true);
  });

  it("detects jpeg magic bytes", () => {
    expect(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBe(
      "image/jpeg",
    );
    expect(detectImageMime(Buffer.from("not-an-image"))).toBeNull();
  });
});
