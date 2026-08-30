export function isCurrentRecipeGenerationRequest(input: {
  requestId: number;
  latestRequestId: number;
  requestSpaceId: string;
  activeSpaceId: string | undefined;
  requestUserId: string | undefined;
  activeUserId: string | undefined;
}) {
  return (
    input.requestId === input.latestRequestId &&
    input.requestSpaceId === input.activeSpaceId &&
    input.requestUserId === input.activeUserId
  );
}
