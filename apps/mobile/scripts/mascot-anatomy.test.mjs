import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { assertFreshReport, buildReport, classifyInterval, evaluatePose, localPoint, measurePose, measurementDir, validateInput } from "./mascot-anatomy.mjs";
import { readManifest, sourceDir } from "./sync-mascot-sources.mjs";

// Synthetic raster fixture: a rectangular refrigerator door, two oval eyes,
// a bounded mouth and two peach cheeks. All geometry is independent of
// the production images and deliberately changes under each mutation.
function fixture({ angle = 0, faceWidth = 505, eyeSpacing = 196, mouthDrop = 0, missingCheek = false, wink = false } = {}) {
  const origin = [220, 260], height = 394;
  const features = {
    leftEye: [origin[0] + 0.323 * faceWidth, origin[1] + 0.508 * height, 52, 80],
    rightEye: [origin[0] + 0.323 * faceWidth + eyeSpacing, origin[1] + 0.508 * height, wink ? 56 : 52, wink ? 34 : 80],
    mouth: [origin[0] + 0.513 * faceWidth, origin[1] + 0.594 * height + mouthDrop, 64, 34],
    leftCheek: [origin[0] + 0.244 * faceWidth, origin[1] + 0.655 * height, 60, 38],
    rightCheek: [origin[0] + 0.792 * faceWidth, origin[1] + 0.657 * height, 60, 38],
  };
  const forward = (p) => localPoint(p, -angle);
  function roi(box) {
    const [x0, y0, x1, y1] = box;
    const p = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(forward);
    return [Math.floor(Math.min(...p.map((v) => v[0]))), Math.floor(Math.min(...p.map((v) => v[1]))), Math.ceil(Math.max(...p.map((v) => v[0]))), Math.ceil(Math.max(...p.map((v) => v[1])))];
  }
  const pose = {
    expression: wink ? "wink" : "neutral", winkEye: "rightEye", uncertaintyPx: 0,
    face: {
      left: roi([217, 400, 224, 520]),
      right: roi([origin[0] + faceWidth - 3, 400, origin[0] + faceWidth + 4, 520]),
      top: roi([400, 257, 530, 264]),
      bottom: roi([400, origin[1] + height - 3, 530, origin[1] + height + 4]),
    },
    features: Object.fromEntries(Object.entries(features).map(([name, [x, y, w, h]]) => [name, { roi: roi([x - w / 2 - 5, y - h / 2 - 5, x + w / 2 + 5, y + h / 2 + 5]), occluded: false }])),
  };
  const png = new PNG({ width: 1024, height: 1024 });
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
    const [lx, ly] = localPoint([x, y], angle);
    let color = null;
    const atXEdge = Math.min(Math.abs(lx - origin[0]), Math.abs(lx - origin[0] - faceWidth)) <= 0.6;
    const atYEdge = Math.min(Math.abs(ly - origin[1]), Math.abs(ly - origin[1] - height)) <= 0.6;
    if (lx >= origin[0] - 0.6 && lx <= origin[0] + faceWidth + 0.6 && ly >= origin[1] - 0.6 && ly <= origin[1] + height + 0.6 && (atXEdge || atYEdge)) color = [30, 30, 30, 255];
    for (const [name, [cx, cy, w, h]] of Object.entries(features)) {
      if (missingCheek && name === "leftCheek") continue;
      if (((lx - cx) / (w / 2)) ** 2 + ((ly - cy) / (h / 2)) ** 2 <= 1) color = name.includes("Cheek") ? [237, 174, 161, 255] : [27, 27, 25, 255];
    }
    if (color) png.data.set(color, (y * 1024 + x) * 4);
  }
  return { png, pose };
}
function inspect(options) {
  const { png, pose } = fixture(options);
  const measured = measurePose(png, pose);
  return { pose, measured, evaluated: evaluatePose(measured, pose) };
}
const metric = (result, name) => result.evaluated.metrics.find((m) => m.name === name);

describe("BIBLE anatomy measurement", () => {
  it("measures an independent valid raster without relying on eye-based alignment", () => {
    const result = inspect();
    expect(result.evaluated.status).toBe("pass");
    expect(metric(result, "face.width/height").value).toBeCloseTo(505 / 394, 3);
  });
  it("rejects a stretched door and compressed eye spacing", () => {
    expect(metric(inspect({ faceWidth: 620 }), "face.width/height").status).toBe("fail");
    expect(metric(inspect({ eyeSpacing: 165 }), "eyeSpacing/W").status).toBe("fail");
  });
  it("rejects displaced mouth position", () => {
    expect(metric(inspect({ mouthDrop: 45 }), "mouth.v").status).toBe("fail");
  });
  it("records a missing cheek as unmeasured, never as a pass", () => {
    const result = inspect({ missingCheek: true });
    expect(metric(result, "leftCheek.width/W").value).toBeNull();
    expect(result.evaluated.status).toBe("needs-review");
  });
  it("applies closed-eye limits only to the explicitly annotated wink eye", () => {
    const result = inspect({ wink: true });
    expect(metric(result, "rightEye.height/F").status).toBe("pass");
    const wrong = evaluatePose(result.measured, { ...result.pose, expression: "neutral" });
    expect(wrong.metrics.find((m) => m.name === "rightEye.height/W").status).toBe("fail");
  });
  it("keeps measurements stable under rigid rotation of the whole door", () => {
    const result = inspect({ angle: 0.08 });
    expect(result.measured.frame.angle).toBeCloseTo(0.08, 2);
    expect(metric(result, "face.width/height").value).toBeCloseTo(505 / 394, 2);
    expect(result.evaluated.status).toBe("pass");
  });
  it("does not silently accept an ROI that clips a feature", () => {
    const { png, pose } = fixture();
    pose.features.leftEye.roi[2] -= 30;
    expect(measurePose(png, pose).issues.join(" ")).toContain("ROI boundary");
  });
  it("keeps ambiguous boundary values out of the passing set without widening BIBLE limits", () => {
    expect(classifyInterval(1.28, [1.27, 1.29], [1.2544, 1.3056])).toBe("pass");
    expect(classifyInterval(1.30, [1.29, 1.32], [1.2544, 1.3056])).toBe("needs-review");
    expect(classifyInterval(1.36, [1.33, 1.39], [1.2544, 1.3056])).toBe("fail");
  });
});

describe("anatomy provenance and reproducibility", () => {
  const input = JSON.parse(fs.readFileSync(path.join(measurementDir, "inputs.json"), "utf8"));
  it("rejects missing or duplicate targets and wrong expression mapping", () => {
    expect(() => validateInput({ ...input, poses: input.poses.slice(1) })).toThrow("exactly");
    expect(() => validateInput({ ...input, poses: [input.poses[0], ...input.poses.slice(0, 4)] })).toThrow("exactly");
    const changed = structuredClone(input);
    changed.poses[0].masterNumber = 2;
    expect(() => validateInput(changed)).toThrow("mapping");
  });
  it("rejects modified source hashes and stale measurement records", () => {
    expect(() => buildReport(input, readManifest(), () => Buffer.from("modified source"))).toThrow("hash");
    const recorded = JSON.parse(fs.readFileSync(path.join(measurementDir, "results.json"), "utf8"));
    const stale = structuredClone(recorded);
    stale.poses[0].tiltDegrees += 0.1;
    expect(() => assertFreshReport(stale, recorded)).toThrow("Stale");
  });
  it("reproduces committed measurements and overlays, including honest failing art results", () => {
    const { report, overlays } = buildReport(input, readManifest(), (name) => fs.readFileSync(path.join(sourceDir, name)));
    const actual = JSON.parse(fs.readFileSync(path.join(measurementDir, "results.json"), "utf8"));
    expect(() => assertFreshReport(actual, report)).not.toThrow();
    for (const [name, data] of Object.entries(overlays)) expect(data.equals(fs.readFileSync(path.join(measurementDir, "overlays", name)))).toBe(true);
    // Source integrity is enforced by mascot:anatomy:audit. This test verifies
    // that the measurement engine truthfully reproduces the tracked evidence.
  }, 20000);
});
