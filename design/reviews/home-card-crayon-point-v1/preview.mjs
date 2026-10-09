/* global process, Buffer, console, URL */
// Runs a review-only bundle. It never reads env files or connects to the API.
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "../../..");
const runtimeReview = process.env.JANGO_PREVIEW_MODE === "runtime";
const reviewDirectory = runtimeReview ? resolve(directory, "../home-card-crayon-implementation-v1") : directory;
const deps = process.env.JANGO_PREVIEW_DEPS || "/private/tmp/jango-home-card-preview-deps-20261009/node_modules";
const esbuildPath = resolve(root, "node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild/lib/main.js");
const { build } = await import(esbuildPath);
const mobileRequire = createRequire(resolve(root, "apps/mobile/package.json"));
const assets = new Map();
const stubs = new Set([
  "use-dashboard-summary", "recipe-generation-provider", "space-provider", "use-auth",
  "use-insights", "use-subscription-entitlement", "session-boundary", "registration-store", "photo-parse-enabled",
  "use-affiliate-reorder-preview", "pending-cooking-cleanup-card", "home-quick-entry", "ingredient-entry-method-sheet", "BottomSheet",
]);
const fixture = resolve(directory, "fixture-data.js");
const staticModule = `import React from 'react';import {View} from 'react-native';
  export default {View};export const useSharedValue=v=>({value:v});
  export const useAnimatedStyle=()=>({});export const withSpring=v=>v;export const useReducedMotion=()=>true;`;
const result = await build({
  entryPoints: [resolve(directory, "fixture.jsx")], bundle: true, write: false,
  platform: "browser", format: "iife", jsx: "automatic", logLevel: "warning", metafile: true,
  define: { "process.env.NODE_ENV": '"development"', "__DEV__": "true" },
  resolveExtensions: [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".jsx", ".js", ".json"],
  nodePaths: [deps, resolve(root, "apps/mobile/node_modules"), resolve(root, "node_modules")],
  plugins: [{ name: "review-only-adapters", setup(plugin) {
    plugin.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: createRequire(resolve(deps, "react/package.json")).resolve(args.path) }));
    plugin.onResolve({ filter: /^react-dom(?:\/.*)?$/ }, args => ({ path: createRequire(resolve(deps, "react-dom/package.json")).resolve(args.path) }));
    plugin.onResolve({ filter: /^react-native$/ }, () => ({ path: resolve(directory, "native-bridge.jsx") }));
    plugin.onResolve({ filter: /^review-native-web$/ }, () => ({ path: resolve(deps, "react-native-web/dist/index.js") }));
    plugin.onResolve({ filter: /^lucide-react-native$/ }, () => ({ path: mobileRequire.resolve("lucide-react-native") }));
    plugin.onResolve({ filter: /^@expirymate\/shared$/ }, () => ({ path: resolve(root, "packages/shared/src/index.ts") }));
    plugin.onResolve({ filter: /^react-native-reanimated$/ }, () => ({ path: "motion", namespace: "review-stub" }));
    plugin.onResolve({ filter: /^react-native-safe-area-context$/ }, () => ({ path: "insets", namespace: "review-stub" }));
    plugin.onResolve({ filter: /^expo-router$/ }, () => ({ path: "router", namespace: "review-stub" }));
    plugin.onResolve({ filter: /\/(?:use-dashboard-summary|recipe-generation-provider|space-provider|use-auth|use-insights|use-subscription-entitlement|session-boundary|subscription-status|registration-store|photo-parse-enabled|use-affiliate-reorder-preview|pending-cooking-cleanup-card|home-quick-entry|ingredient-entry-method-sheet|BottomSheet)$/ }, args => {
      const name = args.path.split("/").pop();
      return stubs.has(name) || name === "subscription-status" ? { path: fixture } : undefined;
    });
    plugin.onResolve({ filter: /^@tanstack\/react-query$/ }, args => ({ path: mobileRequire.resolve(args.path) }));
    plugin.onResolve({ filter: /\.(png|otf|ttf)$/ }, args => ({ path: resolve(args.resolveDir, args.path), namespace: "review-asset" }));
    plugin.onLoad({ filter: /.*/, namespace: "review-asset" }, async args => {
      const url = `/assets/${assets.size}`; assets.set(url, args.path);
      return { contents: `export default ${JSON.stringify({ uri: url })}`, loader: "js" };
    });
    plugin.onLoad({ filter: /.*/, namespace: "review-stub" }, args => ({ loader: "jsx", resolveDir: directory, contents:
      args.path === "motion" ? staticModule : args.path === "insets"
        ? `import React from 'react';import {View} from 'react-native';export const useSafeAreaInsets=()=>({top:24,bottom:0,left:0,right:0});export const SafeAreaView=({style,children})=><View style={[style,{paddingTop:24}]}>{children}</View>;`
        : `export const router={push:()=>{},canGoBack:()=>false};export const useFocusEffect=()=>{};`,
    }));
    plugin.onLoad({ filter: /\/SurfaceCard\.tsx$/ }, async args => ({
      contents: (await readFile(args.path, "utf8")).replace("<View\n      style=", '<View\n      nativeID={variant === "hero" ? "review-home-hero" : undefined}\n      dataSet={variant === "hero" ? { reviewTone: tone } : undefined}\n      style='),
      loader: "tsx", resolveDir: dirname(args.path),
    }));
    plugin.onLoad({ filter: /\/home-hero\.tsx$/ }, async args => ({
      // Baseline and historical A/B use the current HomeHero with only decoration disabled.
      contents: (await readFile(args.path, "utf8")).replace('decoration="crayon"', 'decoration={new URLSearchParams(window.location.search).get("variant") === "runtime" ? "crayon" : undefined}'),
      loader: "tsx", resolveDir: dirname(args.path),
    }));
  } }],
});
if (Object.keys(result.metafile.inputs).some(path => /apps\/mobile\/src\/services\/(?:api|query-client)/.test(path))) {
  throw new Error("Review bundle must exclude live API and persisted query services");
}
const bundle = result.outputFiles[0].contents;
const fontFiles = ["Regular", "Medium", "SemiBold", "Bold", "ExtraBold"];
const fontCSS = fontFiles.map(face => `@font-face{font-family:'Pretendard-${face}';src:url('/font/${face}.otf')}`).join("");
const frame = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fontCSS}html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}body{overflow:hidden}</style><div id="root"></div><script src="/bundle.js"></script></html>`;
const captureForm = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>검토 캡처 저장</title><form><label>파일 이름<input name="name" value="comparison-360.jpg"></label><label>캡처 데이터<textarea name="image"></textarea></label><button>저장</button></form><output aria-live="polite"></output><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const r=await fetch('/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:f.get('name'),image:f.get('image')})});document.querySelector('output').textContent=await r.text()}</script></html>`;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "POST" && url.pathname === "/capture") {
      if (req.headers.origin !== `http://127.0.0.1:${port}`) throw new Error("Local origin required");
      const chunks = []; let length = 0;
      for await (const chunk of req) { length += chunk.length; if (length > 8_000_000) throw new Error("Capture too large"); chunks.push(chunk); }
      const { name, image } = JSON.parse(Buffer.concat(chunks).toString());
      if (!/^[a-z0-9-]+\.jpg$/.test(name)) throw new Error("Invalid capture name");
      const bytes = Buffer.from(image, "base64");
      if (bytes[0] !== 255 || bytes[1] !== 216) throw new Error("JPEG required");
      await mkdir(resolve(reviewDirectory, "screens"), { recursive: true });
      await writeFile(resolve(reviewDirectory, "screens", name), bytes); res.end(`저장 완료: screens/${name}`); return;
    }
    if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle); return; }
    if (url.pathname === "/frame.html" || url.pathname === "/capture.html") { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(url.pathname === "/frame.html" ? frame : captureForm); return; }
    let file = assets.get(url.pathname);
    if (url.pathname.startsWith("/font/") && /^\/font\/(Regular|Medium|SemiBold|Bold|ExtraBold)\.otf$/.test(url.pathname)) file = resolve(root, `apps/mobile/assets/fonts/Pretendard-${url.pathname.split("/").pop()}`);
    if (url.pathname === "/" || url.pathname === "/index.html") file = resolve(reviewDirectory, "index.html");
    if (!file || !existsSync(file)) { res.writeHead(404); res.end("Not found"); return; }
    res.setHeader("Content-Type", file.endsWith(".html") ? "text/html; charset=utf-8" : file.endsWith(".png") ? "image/png" : "font/otf");
    res.end(await readFile(file));
  } catch (error) { res.writeHead(400); res.end(error.message); }
});
const port = Number(process.env.JANGO_PREVIEW_PORT || 4179);
server.listen(port, "127.0.0.1", () => console.log(`Home card review: http://127.0.0.1:${port}/ (${relative(root, directory)})`));
