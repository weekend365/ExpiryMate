// Local manifest adapter for the opt-in native fixture. No runtime route changes.
const http = require("node:http");

const metroPort = Number(process.env.JANGO_QA_METRO_PORT ?? 8093);
const fixturePort = Number(process.env.JANGO_QA_FIXTURE_PORT ?? 8095);
for (const port of [metroPort, fixturePort]) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("QA ports must be integers between 1024 and 65535.");
  }
}
const metroUrl = `http://127.0.0.1:${metroPort}`;

http.createServer(async (_request, response) => {
  try {
    const upstream = await fetch(metroUrl, {
      headers: { "expo-platform": "android", accept: "application/json", "expo-protocol-version": "0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) throw new Error(`Metro returned ${upstream.status}`);
    const manifest = await upstream.json();
    if (!manifest.launchAsset?.url) throw new Error("Expo launch asset missing");
    manifest.launchAsset.url = `${metroUrl}/apps/mobile/e2e/fixtures/native-font-scale-entry.bundle?platform=android&dev=true&minify=false`;
    response.writeHead(200, { "Content-Type": "application/json", "expo-protocol-version": "0", "Cache-Control": "no-store" });
    response.end(JSON.stringify(manifest));
  } catch {
    response.writeHead(502, { "Content-Type": "text/plain" });
    response.end("Local Metro manifest unavailable; check the QA server and port.");
  }
}).listen(fixturePort, "127.0.0.1", () => {
  console.log(`Native font-scale fixture manifest: http://127.0.0.1:${fixturePort}`);
});
