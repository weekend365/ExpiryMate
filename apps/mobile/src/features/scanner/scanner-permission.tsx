import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResponsiveLayout } from "../../shared/responsive-layout";
import { CloseButton, PermissionCard } from "./scanner-chrome";
import { scannerScreenStyles as styles } from "./scanner-screen-styles";
import { cancelRegistration } from "../registration/registration-navigation";
import {
  parseRegistrationReturnTo,
  type RegistrationRouteParams,
} from "../registration/registration-return";

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
  const params = useLocalSearchParams<RegistrationRouteParams>();
  const returnTo = parseRegistrationReturnTo(params.from, params.returnTo);

  return (
    <SafeAreaView style={styles.overlay}>
      <View style={[styles.topBar, shouldStack && styles.topBarStacked]}>
        <CloseButton onPress={() => cancelRegistration(returnTo)} />
      </View>
      <PermissionCard
        canRequestPermission={canRequestPermission}
        onRequestPermission={onRequestPermission}
        isRequesting={isRequesting}
      />
    </SafeAreaView>
  );
}
