import { Readable } from "node:stream";
import type { Request, Response } from "express";
import multer from "multer";
import { describe, expect, it } from "vitest";
import { photoUploadOptions } from "./photo-upload-options";

type Part = { name: string; content: Buffer | string; file?: boolean };

async function parse(parts: Part[], chunkSize?: number) {
  const boundary = "jango-photo-upload-test";
  const body = Buffer.concat(parts.flatMap(part => [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"${part.file ? '; filename="photo.jpg"\r\nContent-Type: image/jpeg' : ""}\r\n\r\n`),
    Buffer.isBuffer(part.content) ? part.content : Buffer.from(part.content),
    Buffer.from("\r\n"),
  ]).concat(Buffer.from(`--${boundary}--\r\n`)).map(chunk => Uint8Array.from(chunk)));
  const chunks = chunkSize
    ? Array.from({ length: Math.ceil(body.length / chunkSize) }, (_, i) => body.subarray(i * chunkSize, (i + 1) * chunkSize))
    : [body];
  const request = Object.assign(Readable.from(chunks), {
    method: "POST",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "content-length": String(body.length),
    },
  }) as unknown as Request;
  const error = await new Promise<unknown>(resolve => {
    multer(photoUploadOptions).single("image")(request, {} as Response, error => resolve(error));
  });
  return { request, error };
}

describe("photo multipart parsing", () => {
  it.each(["receipt", "fridge"])("accepts the mobile image and %s scene contract", async scene => {
    const { request, error } = await parse([
      { name: "scene", content: scene },
      { name: "image", file: true, content: "image fixture" },
    ], 17);
    expect(error).toBeUndefined();
    expect(request.body).toEqual({ scene });
    expect(request.file?.buffer.toString()).toBe("image fixture");
  });

  it("rejects nested field names before sparse arrays can be materialized", async () => {
    const { error } = await parse([
      { name: "items[4294967294]", content: "a" },
      { name: "items[x]", content: "b" },
    ]);
    expect(error).toMatchObject({ code: "LIMIT_FIELD_NESTING" });
    const retry = await parse([{ name: "scene", content: "receipt" }]);
    expect(retry.error).toBeUndefined();
  });

  it("rejects extra fields and oversized text values", async () => {
    expect((await parse([{ name: "scene", content: "receipt" }, { name: "extra", content: "a" }])).error)
      .toMatchObject({ code: "LIMIT_FIELD_COUNT" });
    expect((await parse([{ name: "scene", content: "x".repeat(65) }])).error)
      .toMatchObject({ code: "LIMIT_FIELD_VALUE" });
  });

  it("accepts the existing 4 MiB boundary and rejects one byte beyond it", async () => {
    const file = (size: number): Part => ({ name: "image", file: true, content: Buffer.alloc(size) });
    expect((await parse([file(4 * 1024 * 1024)])).error).toBeUndefined();
    expect((await parse([file(4 * 1024 * 1024 + 1)])).error).toMatchObject({ code: "LIMIT_FILE_SIZE" });
  });

  it("rejects a second image", async () => {
    const image: Part = { name: "image", file: true, content: "image fixture" };
    expect((await parse([image, image])).error).toMatchObject({ code: "LIMIT_FILE_COUNT" });
  });
});
