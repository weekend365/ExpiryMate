const fs = require("node:fs");
const path = require("node:path");
const { withBaseMod, withDangerousMod } = require("expo/config-plugins");
const { QA } = require("../scripts/app-variant.cjs");
const base = require("../app.json").expo;

function configureProject(project) {
  const objects = project.hash.project.objects;
  const configs = objects.XCBuildConfiguration;
  const targetList = project.getFirstTarget().firstTarget.buildConfigurationList;
  for (const [key, list] of Object.entries(objects.XCConfigurationList)) {
    if (key.endsWith("_comment")) continue;
    for (const name of ["Debug", "Release"]) {
      const sourceRef = list.buildConfigurations.find((ref) => ref.comment === name);
      if (!sourceRef) continue;
      const source = configs[sourceRef.value];
      const qaName = `${name}-QA`;
      let qaRef = list.buildConfigurations.find((ref) => ref.comment === qaName);
      if (!qaRef) {
        qaRef = { value: project.generateUuid(), comment: qaName };
        list.buildConfigurations.push(qaRef);
      }
      const existingBase = configs[qaRef.value]?.baseConfigurationReference;
      const existingBaseComment = configs[qaRef.value]?.baseConfigurationReference_comment;
      const copy = JSON.parse(JSON.stringify(source));
      copy.name = qaName;
      if (existingBase) {
        copy.baseConfigurationReference = existingBase;
        copy.baseConfigurationReference_comment = existingBaseComment;
      }
      if (key === targetList) {
        source.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = base.ios.bundleIdentifier;
        source.buildSettings.JANGO_APP_DISPLAY_NAME = JSON.stringify(base.name);
        source.buildSettings.JANGO_APP_SCHEME = base.scheme;
        copy.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = QA.id;
        copy.buildSettings.JANGO_APP_DISPLAY_NAME = JSON.stringify(QA.name);
        copy.buildSettings.JANGO_APP_SCHEME = QA.scheme;
      }
      configs[qaRef.value] = copy;
      configs[`${qaRef.value}_comment`] = qaName;
    }
  }
  return project;
}

function configureInfo(info) {
  info.CFBundleDisplayName = "$(JANGO_APP_DISPLAY_NAME)";
  const primary = new Set([base.scheme, base.ios.bundleIdentifier, QA.scheme, QA.id, `exp+${base.slug}`]);
  info.CFBundleURLTypes = (info.CFBundleURLTypes || []).map((entry) => ({
    ...entry, CFBundleURLSchemes: (entry.CFBundleURLSchemes || []).filter((scheme) => !primary.has(scheme) && !["$(JANGO_APP_SCHEME)", "$(PRODUCT_BUNDLE_IDENTIFIER)"].includes(scheme)),
  })).filter((entry) => entry.CFBundleURLSchemes.length);
  info.CFBundleURLTypes.unshift({ CFBundleURLSchemes: ["$(JANGO_APP_SCHEME)", "$(PRODUCT_BUNDLE_IDENTIFIER)"] });
  return info;
}

function configurePodfile(contents) {
  const block = "# BEGIN JANGO APP VARIANTS\nproject 'ExpiryMate', 'Debug' => :debug, 'Release' => :release, 'Debug-QA' => :debug, 'Release-QA' => :release\n# END JANGO APP VARIANTS";
  const clean = contents.replace(/# BEGIN JANGO APP VARIANTS[\s\S]*?# END JANGO APP VARIANTS\n{0,2}/, "");
  return clean.replace("prepare_react_native_project!", `${block}\n\nprepare_react_native_project!`);
}

function withIosAppVariants(config) {
  // Ordinary Expo mods execute in reverse registration order. Apply identity
  // after the intercepted chain so Prebuild cannot overwrite production/QA settings.
  const after = (current, name, action) => withBaseMod(current, {
    platform: "ios", mod: name,
    async action({ modRequest, ...rest }) {
      const result = await modRequest.nextMod({ ...rest, modRequest });
      action(result);
      return result;
    },
  });
  config = after(config, "infoPlist", (mod) => {
    configureInfo(mod.modResults);
    mod.ios.infoPlist = mod.modResults;
  });
  config = after(config, "xcodeproj", (mod) => { configureProject(mod.modResults); });
  config = after(config, "podfile", (mod) => { mod.modResults.contents = configurePodfile(mod.modResults.contents); });
  return withDangerousMod(config, ["ios", async (mod) => {
    const directory = path.join(mod.modRequest.platformProjectRoot, "ExpiryMate.xcodeproj/xcshareddata/xcschemes");
    const source = fs.readFileSync(path.join(directory, "ExpiryMate.xcscheme"), "utf8");
    fs.writeFileSync(path.join(directory, "ExpiryMateQA.xcscheme"), source.replace(/(buildConfiguration\s*=\s*")(Debug|Release)(")/g, "$1$2-QA$3"));
    return mod;
  }]);
}

module.exports = withIosAppVariants;
module.exports.configureProject = configureProject;
module.exports.configureInfo = configureInfo;
module.exports.configurePodfile = configurePodfile;
