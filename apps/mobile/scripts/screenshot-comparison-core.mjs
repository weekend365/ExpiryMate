export function getCaptureContractIssues(currentFiles, expectedFiles) {
  return [
    ...expectedFiles
      .filter((file) => !currentFiles.includes(file))
      .map((file) => ({ file, status: "missing-current" })),
    ...currentFiles
      .filter((file) => !expectedFiles.includes(file))
      .map((file) => ({ file, status: "unexpected-current" })),
  ];
}

export function hasExpectedDimensions(image, profile) {
  return image.width === profile.width && image.height === profile.height;
}

export function classifyScreenshotDiff(
  diffRatio,
  maximumDiffRatio,
  writeDiffRatio,
) {
  if (diffRatio > maximumDiffRatio) {
    return "regression";
  }
  if (diffRatio > writeDiffRatio) {
    return "changed";
  }
  return "accepted";
}
