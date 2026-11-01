import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat, type ImageRef } from "expo-image-manipulator";
import type { PickedPhoto } from "./pick-inventory-photo";

const MAX_BYTES = 4 * 1024 * 1024;

/** Decode/render bakes orientation into pixels before JPEG metadata is removed. */
export async function prepareInventoryPhoto(photo: PickedPhoto) {
  const generated = new Set<string>();
  let context: ReturnType<typeof ImageManipulator.manipulate> | undefined;
  const cleanup = () => {
    for (const uri of generated) {
      if (uri === photo.uri) continue;
      try {
        const file = new File(uri);
        if (file.exists) file.delete();
      } catch {
        // A cache file may already have been evicted. Never delete the source.
      }
    }
    generated.clear();
  };
  let image: ImageRef | undefined;
  try {
    context = ImageManipulator.manipulate(photo.uri);
    image = await context.renderAsync();
    const { width, height } = image;
    if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) {
      throw new Error("invalid dimensions");
    }
    for (const [limit, compress] of [[2560, 0.9], [2560, 0.8], [2048, 0.8]] as const) {
      if (Math.max(image.width, image.height) > limit) {
        context.resize(width >= height ? { width: limit } : { height: limit });
        image.release();
        image = undefined;
        image = await context.renderAsync();
      }
      const result = await image.saveAsync({ format: SaveFormat.JPEG, compress });
      if (result.uri === photo.uri) throw new Error("unexpected source overwrite");
      generated.add(result.uri);
      const file = new File(result.uri);
      if (!file.exists || !(file.size > 0)) throw new Error("unreadable JPEG");
      if (file.size <= MAX_BYTES) {
        return {
          photo: {
            uri: result.uri,
            mimeType: "image/jpeg",
            fileName: "inventory-photo.jpg",
          },
          cleanup,
        };
      }
    }
    throw new Error(
      "사진 용량을 4MB 이하로 줄이지 못했어요. 재료를 나눠 찍거나 다른 사진을 골라 주세요.",
    );
  } catch (error) {
    cleanup();
    if (error instanceof Error && error.message.startsWith("사진 용량")) throw error;
    throw new Error(
      "사진 파일을 준비하지 못했어요. 사진이 정상적으로 열리는지 확인하고 다시 골라 주세요.",
    );
  } finally {
    image?.release();
    context?.release();
  }
}

export async function withPreparedInventoryPhoto<T>(
  photo: PickedPhoto,
  isCurrent: () => boolean,
  send: (prepared: PickedPhoto) => Promise<T>,
): Promise<T> {
  if (!isCurrent()) throw new Error("사진을 고른 계정과 냉장고를 다시 확인해 주세요.");
  const prepared = await prepareInventoryPhoto(photo);
  try {
    if (!isCurrent()) throw new Error("사진을 고른 계정과 냉장고를 다시 확인해 주세요.");
    return await send(prepared.photo);
  } finally {
    prepared.cleanup();
  }
}
