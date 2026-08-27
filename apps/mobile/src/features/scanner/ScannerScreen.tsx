import { useCameraPermissions } from "expo-camera";
import { View } from "react-native";
import { ScannerCameraExperience } from "./scanner-camera";
import { ScannerPermissionView } from "./scanner-permission";
import { scannerScreenStyles as styles } from "./scanner-screen-styles";

export function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const hasPermission = permission?.granted ?? false;
  const canRequestPermission = permission?.canAskAgain ?? true;

  return (
    <View style={styles.root} testID="scanner-screen">
      {!hasPermission ? (
        <ScannerPermissionView
          canRequestPermission={canRequestPermission}
          onRequestPermission={() => {
            requestPermission().catch(() => null);
          }}
          isRequesting={permission == null}
        />
      ) : (
        <ScannerCameraExperience />
      )}
    </View>
  );
}
