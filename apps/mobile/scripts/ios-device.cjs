const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { QA } = require("./app-variant.cjs");
const deploymentTarget = require("../app.json").expo.plugins.find((plugin) =>
  Array.isArray(plugin) && plugin[0] === "expo-build-properties",
)[1].ios.deploymentTarget;

function selectPhysicalDevice(devices, search) {
  const physical = devices.filter((device) =>
    device.hardwareProperties?.reality === "physical" &&
    device.connectionProperties?.pairingState === "paired" &&
    device.hardwareProperties?.deviceType === "iPhone",
  );
  const candidates = search ? physical.filter((device) => [
    device.identifier, device.hardwareProperties.udid, device.deviceProperties?.name,
  ].some((value) => value?.toLowerCase() === search.toLowerCase())) : physical;
  if (candidates.length !== 1) {
    throw new Error(candidates.length === 0
      ? "실물 iPhone을 찾지 못했습니다. USB로 연결하고 잠금을 해제한 뒤 Mac을 신뢰해주세요."
      : "iPhone이 여러 대입니다. ios:dev --device <기기 이름 또는 UDID>로 하나를 지정해주세요.");
  }
  return candidates[0];
}

function parseOptions(args) {
  let device;
  let check = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--check") check = true;
    else if (args[index] === "--device" && args[index + 1] && !args[index + 1].startsWith("--")) device = args[++index];
    else throw new Error(`지원하지 않는 옵션: ${args[index]}. --device <이름 또는 UDID>, --check를 사용할 수 있습니다.`);
  }
  return { device, check };
}

function runCommand(command, args, options) {
  const result = spawnSync(command, args, { maxBuffer: 64 * 1024 * 1024, encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} 실패 (${result.status}).\n${result.stderr || result.stdout || "위의 빌드 로그를 확인해주세요."}`);
  }
  return result.stdout;
}

function assertQaSettings(settings) {
  if (settings.PRODUCT_BUNDLE_IDENTIFIER !== QA.id || settings.JANGO_APP_SCHEME !== QA.scheme || settings.CONFIGURATION !== "Debug-QA") {
    throw new Error("QA 앱 식별자 또는 빌드 구성이 일치하지 않아 설치를 중단했습니다.");
  }
}

function buildAndInstall({ root, device, check = false, run = runCommand, exists = fs.existsSync }) {
  const env = { ...process.env, APP_VARIANT: "development", EXPO_PUBLIC_APP_ENV: "development", SKIP_BUNDLING: "1" };
  const options = { cwd: path.join(root, "ios"), env };
  const buildArgs = ["-workspace", "ExpiryMate.xcworkspace", "-scheme", "ExpiryMateQA", "-configuration", "Debug-QA",
    "-destination", `id=${device.hardwareProperties.udid}`, "-derivedDataPath", path.join(os.tmpdir(), "jango-ios-dev-derived"),
    // Newer Xcode rejects old deployment targets in dependency resource bundles.
    // Use the app's declared minimum for this QA build without editing Pods.
    `IPHONEOS_DEPLOYMENT_TARGET=${deploymentTarget}`];
  const entries = JSON.parse(run("xcodebuild", [...buildArgs, "-showBuildSettings", "-json"], options));
  const settings = entries.find((entry) => entry.target === "ExpiryMate")?.buildSettings;
  if (!settings) throw new Error("QA 앱의 Xcode 빌드 설정을 찾지 못했습니다.");
  assertQaSettings(settings);
  if (check) return { checked: true, installed: false };
  run("pod", ["install", "--deployment", "--no-repo-update"], { ...options, stdio: "inherit" });
  run("xcodebuild", [...buildArgs, "-allowProvisioningUpdates", "build", "-quiet"], { ...options, stdio: "inherit" });
  const binary = path.join(settings.TARGET_BUILD_DIR, settings.FULL_PRODUCT_NAME);
  if (!exists(path.join(binary, "Info.plist"))) throw new Error("빌드된 QA 앱의 Info.plist가 없습니다.");
  const bundleId = run("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleIdentifier", path.join(binary, "Info.plist")], options).trim();
  if (bundleId !== QA.id) throw new Error("빌드된 앱이 QA 식별자가 아니므로 설치를 중단했습니다.");
  run("xcrun", ["devicectl", "device", "install", "app", "--device", device.identifier, binary], { ...options, stdio: "inherit" });
  console.log("장고 QA 설치 완료. dev:client:tunnel을 실행하고 QA 앱에서 QR을 열어주세요.");
  return { checked: true, installed: true };
}

function runIosDevice(root, args) {
  const options = parseOptions(args);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "jango-ios-devices-"));
  try {
    const jsonPath = path.join(temporary, "devices.json");
    runCommand("xcrun", ["devicectl", "list", "devices", "--json-output", jsonPath], { cwd: root });
    const device = selectPhysicalDevice(JSON.parse(fs.readFileSync(jsonPath, "utf8")).result.devices, options.device);
    console.log(`실물 iPhone: ${device.deviceProperties.name} / 장고 QA (Debug-QA)`);
    const result = buildAndInstall({ root, device, check: options.check });
    if (options.check) console.log("실물 기기와 QA 빌드 설정 확인 완료. 빌드·서명·설치는 수행하지 않았습니다.");
    return result;
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}

module.exports = { runIosDevice, selectPhysicalDevice, parseOptions, assertQaSettings, buildAndInstall };
