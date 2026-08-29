import * as ImagePicker from "expo-image-picker";

export type PickedPhoto = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

export type PickInventoryPhotoResult =
  | { status: "picked"; photo: PickedPhoto }
  | { status: "cancelled" }
  | { status: "permission-denied" };

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.7,
  exif: false,
  // Keep iOS from returning the original HEIC/AVIF container. The API accepts
  // JPEG, PNG, and WebP, so ask the system for its compatible representation.
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

export async function pickInventoryPhoto(
  source: "camera" | "library",
): Promise<PickInventoryPhotoResult> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return { status: "permission-denied" };
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions);

  if (result.canceled || !result.assets[0]?.uri) {
    return { status: "cancelled" };
  }

  const asset = result.assets[0];
  return {
    status: "picked",
    photo: {
      uri: asset.uri,
      mimeType: asset.mimeType ?? "image/jpeg",
      fileName: asset.fileName ?? "photo.jpg",
    },
  };
}
