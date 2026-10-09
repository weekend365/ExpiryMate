/* global process, Buffer, console, URL */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "../../..");
const deps = process.env.JANGO_PREVIEW_DEPS || "/private/tmp/jango-home-card-preview-deps-20261009/node_modules";
const { build } = await import(resolve(root, "node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild/lib/main.js"));
const require = createRequire(resolve(root, "apps/mobile/package.json"));
const assets = new Map();
const result = await build({
  entryPoints: [resolve(directory, "fixture.jsx")], bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", metafile: true,
  logLevel: "warning", define: { "process.env.NODE_ENV": '"development"', "__DEV__": "true" },
  resolveExtensions: [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".jsx", ".js", ".json"],
  nodePaths: [deps, resolve(root, "apps/mobile/node_modules")],
  plugins: [{ name: "local-qa", setup(plugin) {
    plugin.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: createRequire(resolve(deps, "react/package.json")).resolve(args.path) }));
    plugin.onResolve({ filter: /^react-dom(?:\/.*)?$/ }, args => ({ path: createRequire(resolve(deps, "react-dom/package.json")).resolve(args.path) }));
    plugin.onResolve({ filter: /^react-native$/ }, () => ({ path: resolve(directory, "../home-card-crayon-point-v1/native-bridge.jsx") }));
    plugin.onResolve({ filter: /^review-native-web$/ }, () => ({ path: resolve(deps, "react-native-web/dist/index.js") }));
    plugin.onResolve({ filter: /^lucide-react-native$/ }, args => ({ path: require.resolve(args.path) }));
    plugin.onResolve({ filter: /^@expirymate\/shared$/ }, () => ({ path: resolve(root, "packages/shared/src/index.ts") }));
    plugin.onResolve({ filter: /^react-native-reanimated$/ }, () => ({ path: "motion", namespace: "qa-stub" }));
    plugin.onResolve({ filter: /\/BottomSheet$/ }, () => ({ path: "sheet", namespace: "qa-stub" }));
    plugin.onLoad({ filter: /.*/, namespace: "qa-stub" }, args => ({ loader: "jsx", resolveDir: directory, contents: args.path === "motion"
      ? `import {View} from 'react-native';export default {View};export const useSharedValue=v=>({value:v});export const useAnimatedStyle=()=>({});export const withSpring=v=>v;export const useReducedMotion=()=>true;`
      : `export const BottomSheet=()=>null;`,
    }));
    plugin.onResolve({ filter: /\.(png|otf|ttf)$/ }, args => ({ path: resolve(args.resolveDir, args.path), namespace: "qa-asset" }));
    plugin.onLoad({ filter: /.*/, namespace: "qa-asset" }, args => {
      const url = `/assets/${assets.size}`; assets.set(url, args.path);
      return { contents: `export default ${JSON.stringify({ uri: url })}`, loader: "js" };
    });
  } }],
});
if (Object.keys(result.metafile.inputs).some(path => /src\/(?:services\/(?:api|query-client)|store\/registration-store)/.test(path))) {
  throw new Error("QA must exclude live API and persisted store");
}
const port = Number(process.env.JANGO_PREVIEW_PORT || 4181);
const fontCSS = ["Regular", "Medium", "SemiBold", "Bold", "ExtraBold"].map(face => `@font-face{font-family:'Pretendard-${face}';src:url('/font/${face}.otf')}`).join("");
const frame = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fontCSS}html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}</style><div id="root"></div><script src="/bundle.js"></script></html>`;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (req.method === "POST" && url.pathname === "/capture") {
      if (req.headers.origin !== `http://127.0.0.1:${port}`) throw new Error("Local origin required");
      const chunks = []; let length = 0;
      for await (const chunk of req) { length += chunk.length; if (length > 8_000_000) throw new Error("Capture too large"); chunks.push(chunk); }
      const { name, image } = JSON.parse(Buffer.concat(chunks).toString());
      if (!/^[a-z0-9-]+\.jpg$/.test(name)) throw new Error("Invalid capture name");
      const bytes = Buffer.from(image, "base64"); if (bytes[0] !== 255 || bytes[1] !== 216) throw new Error("JPEG required");
      await mkdir(resolve(directory, "screens"), { recursive: true });
      await writeFile(resolve(directory, "screens", name), bytes); res.end(`저장 완료: ${name}`); return;
    }
    if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); res.end(result.outputFiles[0].contents); return; }
    if (url.pathname === "/frame.html") { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(frame); return; }
    let file = assets.get(url.pathname);
    if (/^\/font\/(Regular|Medium|SemiBold|Bold|ExtraBold)\.otf$/.test(url.pathname)) file = resolve(root, `apps/mobile/assets/fonts/Pretendard-${url.pathname.split("/").pop()}`);
    if (url.pathname === "/") file = resolve(directory, "index.html");
    if (!file) { res.writeHead(404); res.end("Not found"); return; }
    res.setHeader("Content-Type", file.endsWith(".html") ? "text/html; charset=utf-8" : file.endsWith(".png") ? "image/png" : "font/otf");
    res.end(await readFile(file));
  } catch (error) { res.writeHead(400); res.end(error.message); }
});
server.listen(port, "127.0.0.1", () => console.log(`Crayon follow-up review: http://127.0.0.1:${port}/`));
