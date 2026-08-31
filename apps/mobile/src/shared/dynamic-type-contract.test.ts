import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function findTsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? findTsxFiles(path)
      : path.endsWith(".tsx")
        ? [path]
        : [];
  });
}

describe("dynamic type component contract", () => {
  it("routes editable text through AppTextInput", () => {
    const files = [join(MOBILE_ROOT, "app"), join(MOBILE_ROOT, "src")]
      .flatMap(findTsxFiles)
      .filter((path) => !path.endsWith("AppTextInput.tsx"));

    const rawInputs = files
      .filter((path) => /^\s*<TextInput\b/m.test(readFileSync(path, "utf8")))
      .map((path) => relative(MOBILE_ROOT, path));

    expect(rawInputs).toEqual([]);
  });

  it("keeps onboarding copy as native text instead of store-art text", () => {
    const onboarding = readFileSync(join(MOBILE_ROOT, "app", "onboarding.tsx"), "utf8");

    expect(onboarding).not.toContain("jango-appstore-space-copy");
    expect(onboarding).toContain('variant="heading"');
  });

  it("lets semantic small copy and primary actions follow the user text size", () => {
    const fontScale = readFileSync(
      join(MOBILE_ROOT, "src", "shared", "font-scale.ts"),
      "utf8",
    );
    const button = readFileSync(
      join(MOBILE_ROOT, "src", "components", "Button.tsx"),
      "utf8",
    );
    const disclosure = readFileSync(
      join(
        MOBILE_ROOT,
        "src",
        "features",
        "affiliate",
        "affiliate-disclosure.tsx",
      ),
      "utf8",
    );

    expect(fontScale).not.toMatch(/case "caption"[\s\S]*?return "chrome"/);
    expect(button).toContain('scaleRole="body"');
    expect(disclosure).not.toContain('scaleRole="chrome"');
  });

  it("keeps compact mascot copy scalable and stacks traffic metrics", () => {
    const bubble = readFileSync(
      join(MOBILE_ROOT, "src", "components", "MascotSpeechBubble.tsx"),
      "utf8",
    );
    const statCard = readFileSync(
      join(MOBILE_ROOT, "src", "components", "StatCard.tsx"),
      "utf8",
    );

    expect(bubble).not.toContain('scaleRole={isCompact ? "chrome" : undefined}');
    expect(bubble).not.toContain("densityAware={!isCompact}");
    expect(statCard).toContain("shouldStack && styles.trafficCopyStacked");
    expect(statCard).toContain(
      "numberOfLines={shouldStack ? undefined : 1}",
    );
  });

  it("stacks dense settings inputs and timer headers before text collides", () => {
    const preferences = readFileSync(
      join(MOBILE_ROOT, "app", "settings", "recipe-preferences.tsx"),
      "utf8",
    );
    const timer = readFileSync(
      join(
        MOBILE_ROOT,
        "src",
        "features",
        "recipes",
        "cooking-timer-card.tsx",
      ),
      "utf8",
    );

    expect(preferences).toContain("shouldStackDense && styles.inputRowStacked");
    expect(preferences).toContain("fullWidth={shouldStackDense}");
    expect(timer).toContain("shouldStack && styles.headerStacked");
    expect(timer).toContain("shouldStack && styles.copyStacked");
    expect(timer).toContain("shouldStack && styles.progressTrackStacked");
    expect(timer).toContain("shouldStack && styles.actionsStacked");
    expect(timer).toContain('accessibilityRole="progressbar"');
    expect(timer).toContain("ReduceMotion.System");
    expect(timer).not.toContain("minWidth: 160");
    const activeTimer = readFileSync(
      join(
        MOBILE_ROOT,
        "src",
        "features",
        "recipes",
        "active-cooking-timer-bar.tsx",
      ),
      "utf8",
    );
    expect(activeTimer).toContain("shouldStack && styles.headerStacked");
    expect(activeTimer).toContain("shouldStack && styles.progressTrackStacked");
    expect(activeTimer).toContain('accessibilityRole="progressbar"');
    expect(activeTimer).toContain("minWidth: 0");
    const stepText = readFileSync(
      join(
        MOBILE_ROOT,
        "src",
        "features",
        "recipes",
        "CookingStepText.tsx",
      ),
      "utf8",
    );
    expect(stepText).toContain('tone="primary"');
    expect(stepText).toContain("highlightTimes");
  });

  it("keeps height-aware camera layouts for phone landscape", () => {
    const scanner = readFileSync(
      join(
        MOBILE_ROOT,
        "src",
        "features",
        "scanner",
        "scanner-camera.tsx",
      ),
      "utf8",
    );
    const photoCapture = readFileSync(
      join(
        MOBILE_ROOT,
        "src",
        "features",
        "photo-intake",
        "photo-capture-screen.tsx",
      ),
      "utf8",
    );

    expect(scanner).toContain("isPhoneLandscape");
    expect(scanner).toContain("compactHeight={isPhoneLandscape}");
    expect(photoCapture).toContain("captureBodyLandscape");
    expect(photoCapture).toContain("bottomScrollLandscape");
  });
});
