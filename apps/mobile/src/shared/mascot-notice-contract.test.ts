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

function read(relativePath: string) {
  return readFileSync(join(MOBILE_ROOT, relativePath), "utf8");
}

describe("Jango notice presentation contract", () => {
  it("keeps the shared speech bubble as a white, bordered surface with a tail", () => {
    const bubble = read("src/components/MascotSpeechBubble.tsx");

    expect(bubble).toContain("backgroundColor: colors.surface");
    expect(bubble).toContain("borderColor: colors.border");
    expect(bubble).toContain("styles.tail");
  });

  it("routes shared Jango notices through MascotSpeechBubble", () => {
    for (const path of [
      "src/components/BottomSheet.tsx",
      "src/components/EmptyState.tsx",
      "src/components/FeedbackBanner.tsx",
      "src/components/JangoHeroNoticeCarousel.tsx",
    ]) {
      const source = read(path);

      expect(source).toContain("MascotSpeechBubble");
      expect(source).not.toMatch(/<Mascot\b/);
    }
  });

  it("lets event-driven Jango feedback auto-dismiss or close without changing heroes", () => {
    const feedback = read("src/components/FeedbackBanner.tsx");
    const bubble = read("src/components/MascotSpeechBubble.tsx");
    const hero = read("src/components/JangoHeroNoticeCarousel.tsx");

    expect(feedback).toContain("DEFAULT_FEEDBACK_AUTO_DISMISS_MS = 5_000");
    expect(feedback).toContain("isTransientNotice");
    expect(feedback).toContain('presentation = "inline"');
    expect(feedback).not.toContain("showMascot?");
    expect(feedback).toContain('accessibilityLabel="알림 닫기"');
    expect(feedback).toContain("AccessibilityInfo.isScreenReaderEnabled()");
    expect(feedback).toContain('tone !== "danger"');
    expect(feedback).toContain("!hasAction");
    expect(feedback).toContain("!isComfortableText");
    expect(feedback).toContain("setTimeout");
    expect(bubble).toContain('accessibilityLabel="장고 알림 닫기"');
    expect(bubble).toContain('testID="mascot-speech-dismiss-button"');
    expect(bubble).toMatch(
      /dismissButton:[\s\S]*?width: controlSize\.icon[\s\S]*?height: controlSize\.icon/,
    );
    expect(bubble).toContain("accessible={!onDismiss && !onInlineAction}");
    expect(bubble).toContain("inlineActionLabel");
    expect(bubble).toContain('accessibilityRole="link"');
    expect(bubble).not.toContain("textDecorationLine");
    expect(hero).not.toContain("transient");
    expect(hero).not.toContain("onDismiss");
  });

  it("limits direct mascot rendering to decorative or text-free artwork", () => {
    const allowedDirectMascotFiles = [
      "app/(tabs)/settings.tsx",
      "app/auth/login.tsx",
      "app/onboarding.tsx",
      "app/register-photo.tsx",
      "src/components/MascotSpeechBubble.tsx",
    ];
    const directMascotFiles = [join(MOBILE_ROOT, "app"), join(MOBILE_ROOT, "src")]
      .flatMap(findTsxFiles)
      .filter((path) => /<Mascot\b/.test(readFileSync(path, "utf8")))
      .map((path) => relative(MOBILE_ROOT, path).replaceAll("\\", "/"))
      .sort();

    expect(directMascotFiles).toEqual(allowedDirectMascotFiles.sort());
  });
});
