/** Revalidate gates on an explicit tap, without opening a picker or consuming a credit. */
export async function checkPhotoSelectionAccess({
  isCurrent,
  readConsent,
  readAccess,
}: {
  isCurrent: () => boolean;
  readConsent: () => Promise<boolean>;
  readAccess: () => Promise<boolean>;
}): Promise<"cancelled" | "consent" | "access" | "ready"> {
  if (!isCurrent()) return "cancelled";
  const accepted = await readConsent();
  if (!isCurrent()) return "cancelled";
  if (!accepted) return "consent";
  const allowed = await readAccess();
  if (!isCurrent()) return "cancelled";
  return allowed ? "ready" : "access";
}
