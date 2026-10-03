import { crayonSpeechBubble, radius } from "@expirymate/shared";

export function getCrayonSpeechBubbleGeometry({
  width,
  height,
  density = "default",
}: {
  width: number;
  height: number;
  density?: "default" | "compact";
}) {
  const art = crayonSpeechBubble;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < art.minimumWidth ||
    height < art.minimumHeight
  ) {
    return null;
  }

  const isCompact = density === "compact";
  const outset = isCompact ? art.compactOutset : art.outset;
  const right = width - art.inset;
  const bottom = height - art.inset;
  const corner = Math.min(
    (isCompact ? radius.lg : radius.xxl) - art.inset,
    width / 4,
    height / 3,
  );
  const straightHeight = height - art.inset * 2 - corner * 2;
  const tailHalfHeight = Math.min(art.tailMaximumHalfHeight, straightHeight / 3);
  const tailCenter = Math.max(
    art.inset + corner + tailHalfHeight,
    Math.min(
      isCompact ? height / 2 : height - art.tailBottomOffset,
      bottom - corner - tailHalfHeight,
    ),
  );
  const outline = [
    `M ${art.inset + corner} ${art.inset}`,
    `H ${right - corner}`,
    `Q ${right} ${art.inset} ${right} ${art.inset + corner}`,
    `V ${bottom - corner}`,
    `Q ${right} ${bottom} ${right - corner} ${bottom}`,
    `H ${art.inset + corner}`,
    `Q ${art.inset} ${bottom} ${art.inset} ${bottom - corner}`,
    `V ${tailCenter + tailHalfHeight}`,
    `L ${-outset + art.tailTipInset} ${tailCenter}`,
    `L ${art.inset} ${tailCenter - tailHalfHeight}`,
    `V ${art.inset + corner}`,
    `Q ${art.inset} ${art.inset} ${art.inset + corner} ${art.inset}`,
    "Z",
  ].join(" ");

  return { width, height, outset, corner, tailCenter, tailHalfHeight, outline };
}
