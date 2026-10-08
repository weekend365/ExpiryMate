const { AndroidConfig, withAndroidManifest, withAppBuildGradle, withProjectBuildGradle, withSettingsGradle } = require("expo/config-plugins");

const begin = "// @generated begin jango-font-scale-native-patch";
const end = "// @generated end jango-font-scale-native-patch";

// React Native 0.81.5's patched C++ must be compiled; its published AAR
// cannot include our source change. Keep this opt-in during native validation.
const sourceBuild = `${begin}
if (providers.gradleProperty("jangoFontScaleNativePatch").orElse("false").get().toBoolean()) {
  def jangoReactNativeDir = new File(
    providers.exec {
      workingDir(rootDir)
      commandLine("node", new File(rootDir, "../scripts/prepare-android-font-scale-source.cjs").absolutePath)
    }.standardOutput.asText.get().trim()
  )
  includeBuild(jangoReactNativeDir) {
    dependencySubstitution {
      substitute(module("com.facebook.react:react-android")).using(project(":packages:react-native:ReactAndroid"))
      substitute(module("com.facebook.react:react-native")).using(project(":packages:react-native:ReactAndroid"))
      substitute(module("com.facebook.react:hermes-android")).using(project(":packages:react-native:ReactAndroid:hermes-engine"))
      substitute(module("com.facebook.react:hermes-engine")).using(project(":packages:react-native:ReactAndroid:hermes-engine"))
    }
  }
}
${end}`;

const moduleBegin = "// @generated begin jango-font-scale-module-builds";
const moduleEnd = "// @generated end jango-font-scale-module-builds";
const moduleBuilds = `${moduleBegin}
// Prefab also parses normal-build output paths. pnpm's patched peer paths
// contain '=', so relocate generated outputs without changing their native inputs.
subprojects { nativeModule ->
  if (nativeModule.projectDir.canonicalPath.contains("=")) {
    nativeModule.layout.buildDirectory.set(rootProject.layout.buildDirectory.dir("jango-font-scale/" + nativeModule.name))
  }
}
// Reanimated 4.1.7 expects Worklets' output at android/build. Use its
// supported directory override only when that generated output was relocated.
def jangoWorklets = findProject(":react-native-worklets")
if (jangoWorklets != null && jangoWorklets.projectDir.canonicalPath.contains("=")) {
  def jangoWorkletsReference = providers.exec {
    commandLine("node", new File(rootDir, "../scripts/prepare-android-font-scale-source.cjs").absolutePath,
      "--worklets", jangoWorklets.layout.buildDirectory.get().asFile.absolutePath)
  }.standardOutput.asText.get().trim()
  project(":app").ext.set("REACT_NATIVE_WORKLETS_NODE_MODULES_DIR", jangoWorkletsReference)
}
${moduleEnd}`;

// Preserve the current SDK 54 template flags in normal builds. Font-scale
// handling is added only to the native verification build, through a placeholder.
const baseConfigChanges = "keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode";
const configChangesPlaceholder = "${jangoFontScaleConfigChanges}";
const activityBegin = "// @generated begin jango-font-scale-activity";
const activityEnd = "// @generated end jango-font-scale-activity";
const activityConfig = `${activityBegin}
android.defaultConfig.manifestPlaceholders["jangoFontScaleConfigChanges"] =
  "${baseConfigChanges}" + (providers.gradleProperty("jangoFontScaleNativePatch").orElse("false").get().toBoolean() ? "|fontScale" : "")
${activityEnd}`;

function configChangesForManifest(current) {
  if (current !== baseConfigChanges && current !== configChangesPlaceholder) {
    throw new Error("Android font-scale patch: configChanges template changed; review lifecycle handling.");
  }
  return configChangesPlaceholder;
}

function insertActivityConfig(contents) {
  return replaceGeneratedBlock(contents, activityBegin, activityEnd, activityConfig);
}

function replaceGeneratedBlock(contents, first, last, block) {
  const start = contents.indexOf(first);
  const finish = contents.indexOf(last);
  if ((start < 0) !== (finish < 0) || (start >= 0 && finish < start)) {
    throw new Error("Android font-scale patch: incomplete generated block.");
  }
  if (start >= 0) return contents.slice(0, start) + block + contents.slice(finish + last.length);
  return `${contents.trimEnd()}\n\n${block}\n`;
}

function insertFontScaleSourceBuild(contents) {
  if (!contents.includes("include ':app'")) {
    throw new Error("Android font-scale patch: app include missing; review the Expo settings template.");
  }
  return replaceGeneratedBlock(contents, begin, end, sourceBuild);
}

function insertModuleBuildDirectories(contents) {
  return replaceGeneratedBlock(contents, moduleBegin, moduleEnd, moduleBuilds);
}

module.exports = function withAndroidFontScalePatch(config) {
  config = withSettingsGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== "groovy") {
      throw new Error("Android font-scale patch: unsupported settings language.");
    }
    modConfig.modResults.contents = insertFontScaleSourceBuild(modConfig.modResults.contents);
    return modConfig;
  });
  config = withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== "groovy") {
      throw new Error("Android font-scale patch: unsupported build language.");
    }
    modConfig.modResults.contents = insertModuleBuildDirectories(modConfig.modResults.contents);
    return modConfig;
  });
  config = withAndroidManifest(config, (modConfig) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(modConfig.modResults);
    activity.$["android:configChanges"] = configChangesForManifest(activity.$["android:configChanges"]);
    return modConfig;
  });
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== "groovy") {
      throw new Error("Android font-scale patch: unsupported app build language.");
    }
    modConfig.modResults.contents = insertActivityConfig(modConfig.modResults.contents);
    return modConfig;
  });
};
module.exports.insertFontScaleSourceBuild = insertFontScaleSourceBuild;
module.exports.insertModuleBuildDirectories = insertModuleBuildDirectories;
module.exports.insertActivityConfig = insertActivityConfig;
module.exports.configChangesForManifest = configChangesForManifest;
