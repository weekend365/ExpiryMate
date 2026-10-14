import { memoryStorage } from "multer";

// The mobile contract sends one image and one flat `scene` field. Restrict
// multipart parsing before the controller, membership and AI policy checks.
export const photoUploadOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024,
    files: 1,
    fields: 1,
    // Busboy signals the parts limit when it reaches it; allow the terminating
    // boundary after the image and scene. files/fields still each permit one.
    parts: 3,
    fieldNameSize: 64,
    fieldSize: 64,
    fieldNestingDepth: 0,
    fieldArrayIndexLimit: 0,
  },
};
