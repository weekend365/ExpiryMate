const QA = Object.freeze({ name: "장고 QA", id: "com.expirymate.mobile.crayonqa", scheme: "jango-crayonqa" });

function resolveAppVariant(env = process.env) {
  const variant = env.APP_VARIANT || "production";
  if (!["development", "production"].includes(variant)) {
    throw new Error(`Unknown APP_VARIANT: ${variant}`);
  }
  if (variant === "development" && ["production", "preview"].includes(env.EXPO_PUBLIC_APP_ENV)) {
    throw new Error("Development identity cannot be used with production/preview environment");
  }
  return variant;
}

module.exports = { QA, resolveAppVariant };
