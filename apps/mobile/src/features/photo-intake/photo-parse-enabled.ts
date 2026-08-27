export function isInventoryPhotoParseEnabled() {
  const raw =
    process.env.EXPO_PUBLIC_INVENTORY_PHOTO_PARSE_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}
