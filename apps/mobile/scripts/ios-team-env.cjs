/**
 * Personal Team builds strip Push + Sign in with Apple.
 * Preview/production EAS profiles must use a paid Apple Developer Program team.
 */
function assertIosTeamCompatibleWithAppEnv(env = process.env) {
  const isPersonalTeamBuild = env.EXPO_IOS_PERSONAL_TEAM === "1";
  const appEnv = env.EXPO_PUBLIC_APP_ENV?.trim();

  if (isPersonalTeamBuild && (appEnv === "production" || appEnv === "preview")) {
    throw new Error(
      [
        "EXPO_IOS_PERSONAL_TEAM=1 cannot be used with preview/production EAS builds.",
        "Paid Apple Developer Program builds need Sign in with Apple + Push entitlements.",
        "Unset EXPO_IOS_PERSONAL_TEAM (or set it to 0) for preview/production profiles.",
      ].join("\n"),
    );
  }
}

function isPersonalTeamBuild(env = process.env) {
  return env.EXPO_IOS_PERSONAL_TEAM === "1";
}

if (require.main === module) {
  try {
    assertIosTeamCompatibleWithAppEnv();
    console.log("iOS team / app env combination looks good.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  assertIosTeamCompatibleWithAppEnv,
  isPersonalTeamBuild,
};
