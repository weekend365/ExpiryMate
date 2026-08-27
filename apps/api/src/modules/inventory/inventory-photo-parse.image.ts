/** Strip JPEG APP1 (Exif) segments so GPS is not sent to the vision model. */
export function stripJpegExif(buffer: Buffer): Buffer {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return buffer;
  }

  const parts: Buffer[] = [buffer.subarray(0, 2)];
  let offset = 2;

  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      parts.push(buffer.subarray(offset));
      break;
    }

    const marker = buffer[offset + 1];
    if (marker === undefined) {
      break;
    }

    if (marker === 0xda) {
      parts.push(buffer.subarray(offset));
      break;
    }

    if (marker === 0xd9) {
      parts.push(buffer.subarray(offset, offset + 2));
      break;
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(buffer.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }

    const size = buffer.readUInt16BE(offset + 2);
    const next = offset + 2 + size;
    if (size < 2 || next > buffer.length) {
      parts.push(buffer.subarray(offset));
      break;
    }

    if (marker !== 0xe1) {
      parts.push(buffer.subarray(offset, next));
    }
    offset = next;
  }

  return concatBuffers(parts);
}

function concatBuffers(parts: Buffer[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = Buffer.alloc(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function detectImageMime(buffer: Buffer, declared?: string) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer.subarray(1, 4).toString("ascii") === "PNG"
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  const normalized = declared?.toLowerCase();
  if (
    normalized === "image/jpeg" ||
    normalized === "image/jpg" ||
    normalized === "image/png" ||
    normalized === "image/webp"
  ) {
    return normalized === "image/jpg" ? "image/jpeg" : normalized;
  }

  return null;
}

export function prepareVisionImage(buffer: Buffer, declaredMime?: string) {
  const mimeType = detectImageMime(buffer, declaredMime);
  if (!mimeType) {
    return null;
  }

  if (mimeType === "image/jpeg") {
    return { buffer: stripJpegExif(buffer), mimeType };
  }

  return { buffer, mimeType };
}
