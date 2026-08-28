export function isInventoryPhotoParseEnabled() {
  const raw =
    process.env.EXPO_PUBLIC_INVENTORY_PHOTO_PARSE_ENABLED?.trim().toLowerCase();
  // The photo intake flow is enabled by default. Keep an explicit, reversible
  // kill switch for builds that need to hide the entry points.
  return raw !== "false" && raw !== "0" && raw !== "off";
}
