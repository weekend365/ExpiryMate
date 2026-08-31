export const layoutScreenshotNames = [
  "onboarding.png",
  "login.png",
  "forgot-password.png",
  "auth-register.png",
  "reset-password.png",
  "verify-pending.png",
  "verify-email.png",
  "home.png",
  "inventory.png",
  "inventory-edit.png",
  "inventory-action-notice.png",
  "register-keyboard.png",
  "scanner-permission-denied.png",
  "scanner.png",
  "recommendations.png",
  "recommendation-options.png",
  "settings.png",
  "subscription.png",
  "insights.png",
  "shopping.png",
  "shopping-search-results.png",
  "register-photo.png",
  "cooking.png",
  "cooking-timer-running.png",
  "cooking-timer-paused.png",
  "privacy.png",
  "ai-data-notice.png",
  "account-delete.png",
  "settings-account.png",
  "settings-notifications.png",
  "settings-recipe-preferences.png",
  "settings-recommendation-credits.png",
  "settings-spaces.png",
  "settings-space-detail.png",
  "settings-storage-locations.png",
  "settings-support.png",
  "invitation-code.png",
  "invitation-accept.png",
];

/** One canonical visual state for every user-facing Expo route. */
export const layoutRouteScreenshots = {
  "(tabs)/home": "home.png",
  "(tabs)/inventory": "inventory.png",
  "(tabs)/recommendations": "recommendations.png",
  "(tabs)/settings": "settings.png",
  "(tabs)/shop": "shopping.png",
  "auth/forgot-password": "forgot-password.png",
  "auth/login": "login.png",
  "auth/register": "auth-register.png",
  "auth/reset-password": "reset-password.png",
  "auth/verify-email": "verify-email.png",
  "auth/verify-pending": "verify-pending.png",
  "cooking/[recommendationId]": "cooking.png",
  insights: "insights.png",
  "inventory/[id]": "inventory-edit.png",
  onboarding: "onboarding.png",
  privacy: "privacy.png",
  "privacy/account-delete": "account-delete.png",
  "privacy/ai-data-notice": "ai-data-notice.png",
  "register-photo": "register-photo.png",
  register: "register-keyboard.png",
  scanner: "scanner.png",
  "settings/account": "settings-account.png",
  "settings/notifications": "settings-notifications.png",
  "settings/recipe-preferences": "settings-recipe-preferences.png",
  "settings/recommendation-credits": "settings-recommendation-credits.png",
  "settings/spaces": "settings-spaces.png",
  "settings/spaces/[spaceId]": "settings-space-detail.png",
  "settings/storage-locations": "settings-storage-locations.png",
  "settings/subscription": "subscription.png",
  "settings/support": "settings-support.png",
  shopping: "shopping.png",
  "spaces/invitations/accept": "invitation-accept.png",
  "spaces/invitations/code": "invitation-code.png",
};

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
  "phone-landscape": {
    width: 1280,
    height: 720,
    description: "phone-sized landscape window",
  },
  "phone-landscape-large-text": {
    width: 1280,
    height: 720,
    description: "phone landscape at Android font scale 2.0",
  },
  "ios-small": {
    width: 750,
    height: 1334,
    description: "small iPhone portrait at the default Dynamic Type size",
  },
  "ios-small-large-text": {
    width: 750,
    height: 1334,
    description: "small iPhone portrait at an accessibility Dynamic Type size",
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
