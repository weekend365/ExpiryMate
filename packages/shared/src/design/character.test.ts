import { describe, expect, it } from "vitest";
import { characterColors } from "./character";
import { characterColors as publicColors } from "../index";

describe("BIBLE character palette", () => {
  it("exports the five remaining material colors with their BIBLE values", () => {
    expect(characterColors).toMatchObject({
      mintHighlight: "#8ED2B5",
      pineappleFruit: "#F5C93E",
      pineappleLeaves: "#5FBD98",
      hinges: "#C6C5C5",
      stitching: "#BCB8B4",
    });
    expect(publicColors).toBe(characterColors);
  });
});
