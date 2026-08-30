export function isRectMeaningfullyVisible(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}) {
  if (input.width <= 0 || input.height <= 0) return false;
  const visibleWidth = Math.max(
    0,
    Math.min(input.x + input.width, input.viewportWidth) - Math.max(input.x, 0),
  );
  const visibleHeight = Math.max(
    0,
    Math.min(input.y + input.height, input.viewportHeight) - Math.max(input.y, 0),
  );
  return (
    (visibleWidth * visibleHeight) / (input.width * input.height) >= 0.5
  );
}
