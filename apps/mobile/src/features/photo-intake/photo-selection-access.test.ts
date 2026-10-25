import { describe, expect, it, vi } from "vitest";
import { checkPhotoSelectionAccess } from "./photo-selection-access";

describe("explicit photo continuation gates", () => {
  function setup() {
    return { isCurrent: vi.fn(() => true), readConsent: vi.fn(async () => true), readAccess: vi.fn(async () => true) };
  }
  it("requires consent before checking photo allowance", async () => {
    const input = setup();
    input.readConsent.mockResolvedValue(false);
    expect(await checkPhotoSelectionAccess(input)).toBe("consent");
    expect(input.readAccess).not.toHaveBeenCalled();
  });
  it("waits for confirmed photo access instead of treating consent as permission to parse", async () => {
    const input = setup();
    input.readAccess.mockResolvedValue(false);
    expect(await checkPhotoSelectionAccess(input)).toBe("access");
  });
  it("allows an explicit continuation only after both fresh checks", async () => {
    const input = setup();
    expect(await checkPhotoSelectionAccess(input)).toBe("ready");
    expect(input.readConsent).toHaveBeenCalledOnce();
    expect(input.readAccess).toHaveBeenCalledOnce();
  });
  it.each(["before", "consent", "access"])("cancels an outdated account/space attempt at %s", async (stage) => {
    const input = setup();
    if (stage === "before") input.isCurrent.mockReturnValue(false);
    if (stage === "consent") input.readConsent.mockImplementation(async () => { input.isCurrent.mockReturnValue(false); return true; });
    if (stage === "access") input.readAccess.mockImplementation(async () => { input.isCurrent.mockReturnValue(false); return true; });
    expect(await checkPhotoSelectionAccess(input)).toBe("cancelled");
    if (stage !== "access") expect(input.readAccess).not.toHaveBeenCalled();
  });
  it.each(["readConsent", "readAccess"] as const)("never proceeds on %s failure", async (key) => {
    const input = setup();
    input[key].mockRejectedValue(new Error("offline"));
    await expect(checkPhotoSelectionAccess(input)).rejects.toThrow("offline");
    if (key === "readConsent") expect(input.readAccess).not.toHaveBeenCalled();
  });
});
