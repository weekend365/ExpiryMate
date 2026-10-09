const { androidCodegenOverrides } = require("./scripts/android-codegen-paths.cjs");

module.exports = {
  // Source CMake copies also preserve relative JNI paths after build-directory relocation.
  dependencies: androidCodegenOverrides(__dirname),
};
