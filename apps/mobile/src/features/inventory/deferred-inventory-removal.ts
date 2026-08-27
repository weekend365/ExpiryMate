export function isPendingForDifferentSpace(
  pendingSpaceId: string | undefined,
  activeSpaceId: string | undefined,
) {
  return Boolean(pendingSpaceId && pendingSpaceId !== activeSpaceId);
}
