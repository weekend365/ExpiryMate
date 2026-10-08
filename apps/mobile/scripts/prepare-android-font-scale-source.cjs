const { createHash } = require("node:crypto");
const { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, rmSync, symlinkSync, writeFileSync } = require("node:fs");
const path = require("node:path");

// Gradle canonicalizes symlinks; Prefab then parses '=' in pnpm's patch_hash
// path as an option. Compile an identical source copy at a path without '='.
// Downloaded dependencies and native outputs are not package source inputs.
const generated = [
  ".gradle", ".kotlin", ".jango-source-sha256", "node_modules", "ReactAndroid/build", "ReactAndroid/.cxx",
  "ReactAndroid/hermes-engine/build", "ReactAndroid/hermes-engine/.cxx", "sdks/hermes", "sdks/download",
];
function isSource(relative) {
  return !generated.some((prefix) => relative === prefix || relative.startsWith(`${prefix}/`));
}

function sourceDigest(sourceDir) {
  const hash = createHash("sha256");
  function scan(dir, relative = "") {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (!isSource(name)) continue;
      if (entry.isDirectory()) scan(path.join(dir, entry.name), name);
      else if (entry.isFile()) hash.update(name).update("\0").update(readFileSync(path.join(dir, entry.name))).update("\0");
      else throw new Error(`Unexpected link in React Native source: ${name}`);
    }
  }
  scan(sourceDir);
  return hash.digest("hex");
}

function prepareSource(sourceDir, cacheDir) {
  const digest = sourceDigest(sourceDir);
  const destination = path.join(cacheDir, `react-native-${digest}`);
  if (destination.includes("=")) throw new Error("Native font-scale source cache path must not contain '='.");
  const marker = path.join(destination, ".jango-source-sha256");
  if (!existsSync(marker) || readFileSync(marker, "utf8").trim() !== digest) {
    mkdirSync(destination, { recursive: true });
    cpSync(sourceDir, destination, {
      recursive: true,
      filter: (source) => isSource(path.relative(sourceDir, source).split(path.sep).join("/")),
    });
    writeFileSync(marker, `${digest}\n`);
  }
  if (sourceDigest(destination) !== digest) {
    throw new Error("Cached React Native source differs from the installed patch; remove this cache before rebuilding.");
  }
  return destination;
}

function linkDependency(target, link) {
  mkdirSync(path.dirname(link), { recursive: true });
  let previous;
  try { previous = lstatSync(link); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (previous && !previous.isSymbolicLink()) throw new Error(`Unexpected dependency cache directory: ${link}`);
  if (previous && readlinkSync(link) === target) return;
  if (previous) rmSync(link);
  symlinkSync(target, link, "dir");
}

function prepareWorkletsSource(sourceDir, cacheDir, buildDir) {
  const key = createHash("sha256").update(sourceDir).digest("hex");
  const reference = path.join(cacheDir, `worklets-reference-${key}`);
  linkDependency(path.join(sourceDir, "Common"), path.join(reference, "Common"));
  linkDependency(path.join(sourceDir, "android/src"), path.join(reference, "android/src"));
  linkDependency(buildDir, path.join(reference, "android/build"));
  return reference;
}

if (require.main === module) {
  const mobileDir = path.resolve(__dirname, "..");
  const sourceDir = path.dirname(require.resolve("react-native/package.json", { paths: [mobileDir] }));
  const cacheDir = path.join(mobileDir, "node_modules/.cache/jango-font-scale");
  if (process.argv[2] === "--worklets") {
    if (!process.argv[3]) throw new Error("Worklets build directory required.");
    const workletsDir = path.dirname(require.resolve("react-native-worklets/package.json", { paths: [mobileDir] }));
    process.stdout.write(prepareWorkletsSource(workletsDir, cacheDir, process.argv[3]));
    process.exit(0);
  }
  // RN's source-build template locates codegen next to the source package.
  const codegenDir = path.dirname(require.resolve("@react-native/codegen/package.json", { paths: [sourceDir] }));
  const codegenLink = path.join(cacheDir, "@react-native/codegen");
  linkDependency(codegenDir, codegenLink);
  const destination = prepareSource(sourceDir, cacheDir);
  // pnpm keeps RN's JS dependencies beside the installed package, not inside it.
  linkDependency(path.dirname(sourceDir), path.join(destination, "node_modules"));
  process.stdout.write(destination);
}
module.exports = { prepareSource, prepareWorkletsSource };
