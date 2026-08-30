import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: {
    Platform: {
      OS: "ios",
    },
  },
  imagePicker: {
    UIImagePickerPreferredAssetRepresentationMode: {
      Compatible: "compatible",
    },
    requestCameraPermissionsAsync: vi.fn(),
    requestMediaLibraryPermissionsAsync: vi.fn(),
    launchCameraAsync: vi.fn(),
    launchImageLibraryAsync: vi.fn(),
  },
}));

vi.mock("expo-image-picker", () => mocks.imagePicker);
vi.mock("react-native", () => mocks.platform);

describe("pickInventoryPhoto", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.platform.Platform.OS = "ios";
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
    await expect(pickInventoryPhoto("library")).resolves.toEqual({
      status: "picked",
      photo: {
        uri: "file:///cache/photo.jpg",
        mimeType: "image/jpeg",
        fileName: "photo.jpg",
      },
    });

    expect(mocks.imagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ["images"],
        preferredAssetRepresentationMode: "compatible",
      }),
    );
  });

  it("opens Android Photo Picker without requesting broad media permission", async () => {
    mocks.platform.Platform.OS = "android";
    mocks.imagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: true,
      assets: [],
    });

    const { pickInventoryPhoto } = await import("./pick-inventory-photo");

    await expect(pickInventoryPhoto("library")).resolves.toEqual({
      status: "cancelled",
    });
    expect(
      mocks.imagePicker.requestMediaLibraryPermissionsAsync,
    ).not.toHaveBeenCalled();
    expect(mocks.imagePicker.launchImageLibraryAsync).toHaveBeenCalledOnce();
  });

  it("returns a recoverable state when permission is denied", async () => {
    mocks.imagePicker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: false,
    });

    const { pickInventoryPhoto } = await import("./pick-inventory-photo");

    await expect(pickInventoryPhoto("camera")).resolves.toEqual({
      status: "permission-denied",
    });
    expect(mocks.imagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });
});
