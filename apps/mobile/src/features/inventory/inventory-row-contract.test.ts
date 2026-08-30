import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string) {
  return readFileSync(join(MOBILE_ROOT, relativePath), "utf8");
}

describe("inventory row interaction contract", () => {
  it("opens editing from the row and cleanup from the trailing trash action", () => {
    const screen = read("app/(tabs)/inventory.tsx");
    const card = read("src/components/InventoryCard.tsx");

    expect(screen).toMatch(
      /const handleCardPress[\s\S]*?handleEditItem\(item\);/,
    );
    expect(screen).toContain("onCleanup={openCleanupSheet}");
    expect(card).toContain("<Trash2");
    expect(card).toContain("onPress={() => onCleanup(item)}");
    expect(card).not.toContain("<PenLine");
  });
});
