import { router } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResponsiveLayout } from "../../shared/responsive-layout";
import { CloseButton, PermissionCard } from "./scanner-chrome";
import { scannerScreenStyles as styles } from "./scanner-screen-styles";

export function ScannerPermissionView({
  canRequestPermission,
  onRequestPermission,
  isRequesting,
}: {
  canRequestPermission: boolean;
  onRequestPermission: () => void;
  isRequesting: boolean;
}) {
  const { shouldStack } = useResponsiveLayout();

  return (
    <SafeAreaView style={styles.overlay}>
      <View style={[styles.topBar, shouldStack && styles.topBarStacked]}>
        <CloseButton onPress={() => router.back()} />
      </View>
      <PermissionCard
        canRequestPermission={canRequestPermission}
        onRequestPermission={onRequestPermission}
        isRequesting={isRequesting}
      />
    </SafeAreaView>
  );
}
