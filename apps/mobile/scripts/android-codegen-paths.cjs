const { realpathSync } = require("node:fs");
const { createRequire } = require("node:module");
const { dirname, join, relative } = require("node:path");
const { prepareCmakeSourceReference } = require("./prepare-android-font-scale-source.cjs");

// These libraries use Gradle-generated JNI rather than a source CMakeLists.txt.
// Keep their autolinking paths aligned with with-android-font-scale-patch's
// build-directory relocation. pnpm may shorten other peers to paths without '='.
const generatedJniLibraries = [
  "@react-native-async-storage/async-storage",
  "@react-native-community/datetimepicker",
  "@sentry/react-native",
  "react-native-gesture-handler",
  "react-native-worklets",
];
const sourceCmakeLibraries = ["react-native-safe-area-context", "react-native-screens", "react-native-svg"];

function androidCodegenOverrides(mobileRoot) {
  const requireFromMobile = createRequire(join(mobileRoot, "package.json"));
  const dependencies = {};
  for (const name of [...generatedJniLibraries, ...sourceCmakeLibraries]) {
    const androidDir = realpathSync(join(dirname(requireFromMobile.resolve(`${name}/package.json`)), "android"));
    if (!androidDir.includes("=")) continue;

    // React Native's ModelAutolinkingDependenciesJson.nameCleansed uses this
    // transformation for Gradle project names, including scoped libraries.
    const projectName = name.replace(/[~*!'()]+/g, "_").replace(/^@([\w-.]+)\//, "$1_");
    const buildDir = join(mobileRoot, "android/build/jango-font-scale", projectName);
    const cmakeFile = sourceCmakeLibraries.includes(name)
      ? join(prepareCmakeSourceReference(dirname(androidDir),
        join(mobileRoot, "node_modules/.cache/jango-font-scale"), buildDir), "android/src/main/jni/CMakeLists.txt")
      : join(buildDir, "generated/source/codegen/jni/CMakeLists.txt");
    dependencies[name] = {
      platforms: { android: { cmakeListsPath: relative(androidDir, cmakeFile) } },
    };
  }
  return dependencies;
}

module.exports = { androidCodegenOverrides };
