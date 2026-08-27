import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

export type PickedPhoto = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.7,
  exif: false,
};

export async function pickInventoryPhoto(
  source: "camera" | "library",
): Promise<PickedPhoto | null> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    Alert.alert(
      "권한이 필요해요",
      source === "camera"
        ? "영수증이나 냉장고 사진을 찍으려면 카메라 권한이 필요해요."
        : "앨범에서 사진을 고르려면 사진 권한이 필요해요.",
    );
    return null;
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions);

  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? "image/jpeg",
    fileName: asset.fileName ?? "photo.jpg",
  };
}
