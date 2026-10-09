/* global process */
process.env.JANGO_PREVIEW_MODE = "runtime";
process.env.JANGO_PREVIEW_PORT ||= "4180";
await import("../home-card-crayon-point-v1/preview.mjs");
