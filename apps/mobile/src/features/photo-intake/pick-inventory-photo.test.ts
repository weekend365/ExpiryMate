import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  imagePicker: {
    UIImagePickerPreferredAssetRepresentationMode: {
      Compatible: "compatible",
    },
    requestCameraPermissionsAsync: vi.fn(),
    requestMediaLibraryPermissionsAsync: vi.fn(),
    launchCameraAsync: vi.fn(),
    launchImageLibraryAsync: vi.fn(),
  },
  alert: vi.fn(),
}));

vi.mock("expo-image-picker", () => mocks.imagePicker);
vi.mock("react-native", () => ({ Alert: { alert: mocks.alert } }));

describe("pickInventoryPhoto", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("asks iOS for a compatible representation when choosing from the library", async () => {
    mocks.imagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: true,
    });
    mocks.imagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///cache/photo.jpg",
          mimeType: "image/jpeg",
          fileName: "photo.jpg",
        },
      ],
    });

    const { pickInventoryPhoto } = await import("./pick-inventory-photo");
    await pickInventoryPhoto("library");

    expect(mocks.imagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ["images"],
        preferredAssetRepresentationMode: "compatible",
      }),
    );
  });
});
