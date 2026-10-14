export function getReleaseMetadata(env: NodeJS.ProcessEnv = process.env) {
  const gitSha = [env.GIT_SHA, env.RAILWAY_GIT_COMMIT_SHA]
    .map(value => value?.trim())
    .find(value => value && value !== "unknown") ?? "unknown";

  return {
    version: env.APP_VERSION?.trim() || "0.1.0",
    gitSha,
  };
}
