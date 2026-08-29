export const layoutScreenshotNames = [
  "home.png",
  "inventory.png",
  "register-keyboard.png",
  "scanner-permission-denied.png",
  "scanner.png",
  "recommendations.png",
  "recommendation-options.png",
  "settings.png",
  "subscription.png",
  "insights.png",
  "shopping.png",
  "register-photo.png",
];

export const layoutProfiles = {
  "small-three-button": {
    width: 720,
    height: 1280,
    description: "compact width with legacy three-button navigation",
  },
  "modern-gesture": {
    width: 824,
    height: 1830,
    description: "regular width with gesture navigation",
  },
  "small-large-text": {
    width: 720,
    height: 1280,
    description: "compact width at Android font scale 2.0",
  },
  "large-display-large-text": {
    width: 824,
    height: 1830,
    description: "large display density and Android font scale 2.0",
  },
  "tablet-landscape": {
    width: 1600,
    height: 1200,
    description: "tablet-sized sw600dp landscape window",
  },
  "foldable-portrait": {
    width: 1600,
    height: 2560,
    description: "unfolded foldable-sized sw600dp portrait window",
  },
};

export function getLayoutProfile(profile) {
  const configuration = layoutProfiles[profile];
  if (!configuration) {
    throw new Error(
      `Unknown layout profile: ${profile}. Expected one of ${Object.keys(layoutProfiles).join(", ")}.`,
    );
  }
  return configuration;
}
