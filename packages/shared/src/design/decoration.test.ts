import { describe, expect, it } from "vitest";
import { crayonCardDecoration, semanticColors } from "../index";

describe("crayon decoration contract", () => {
  it("keeps decorations in the card's existing semantic color family", () => {
    const colors = crayonCardDecoration.colors;
    expect(colors.primary).toEqual({ outline: semanticColors.primaryForeground, accent: semanticColors.brandAccent });
    expect(colors.warning).toEqual({ outline: semanticColors.warningForeground, accent: semanticColors.warningAccent });
    expect(colors.danger).toEqual({ outline: semanticColors.dangerForeground, accent: semanticColors.dangerAccent });
    expect(colors.success).toEqual(colors.primary);
    expect(colors.default.accent).toBeNull();
    expect(colors.muted.accent).toBeNull();
  });
});
