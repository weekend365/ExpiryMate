// Local native QA adapter. Never reads env files or connects to the application API.
const http = require("node:http");
const metroPort = Number(process.env.JANGO_QA_METRO_PORT ?? 8096);
const fixturePort = Number(process.env.JANGO_QA_FIXTURE_PORT ?? 8097);
const platform = process.env.JANGO_QA_PLATFORM ?? "android";
if (!["android", "ios"].includes(platform) || [metroPort, fixturePort].some(port => !Number.isInteger(port) || port < 1024 || port > 65535)) {
  throw new Error("QA platform or port invalid");
}
const metroUrl = `http://127.0.0.1:${metroPort}`;
http.createServer(async (_request, response) => {
  try {
    const upstream = await fetch(metroUrl, {
      headers: { "expo-platform": platform, accept: "application/json", "expo-protocol-version": "0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) throw new Error("Metro unavailable");
    const manifest = await upstream.json();
    if (!manifest.launchAsset?.url) throw new Error("Expo launch asset missing");
    manifest.launchAsset.url = `${metroUrl}/apps/mobile/e2e/fixtures/native-crayon-entry.bundle?platform=${platform}&dev=true&minify=false`;
    response.writeHead(200, { "Content-Type": "application/json", "expo-protocol-version": "0", "Cache-Control": "no-store" });
    response.end(JSON.stringify(manifest));
  } catch {
    response.writeHead(502, { "Content-Type": "text/plain" });
    response.end("Local Metro manifest unavailable; check the QA server and port.");
  }
}).listen(fixturePort, "127.0.0.1", () => console.log(`Native crayon fixture: http://127.0.0.1:${fixturePort} (${platform})`));
