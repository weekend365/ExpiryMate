import { Barcode, PenLine, ShoppingBasket } from "lucide-react-native";
import { View } from "react-native";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { homeScreenStyles as styles } from "./home-screen-styles";

export function HomeQuickEntry({
  emphasizeEntryActions,
  onOpenScanner,
  onManualRegister,
  onOpenShopping,
}: {
  emphasizeEntryActions: boolean;
  onOpenScanner: () => void;
  onManualRegister: () => void;
  onOpenShopping: () => void;
}) {
  return (
    <View style={styles.quickEntrySection}>
      <AppText variant="bodySmall" tone="subtext">
        빠른 동작
      </AppText>
      <View style={styles.quickEntryActions}>
        <Button
          icon={Barcode}
          onPress={onOpenScanner}
          size={emphasizeEntryActions ? "medium" : "small"}
          fullWidth
          testID="home-scan-button"
        >
          바코드 스캔
        </Button>
        <Button
          icon={PenLine}
          onPress={onManualRegister}
          variant="surface"
          size={emphasizeEntryActions ? "medium" : "small"}
          fullWidth
          testID="home-manual-register-button"
        >
          직접 입력
        </Button>
        <Button
          icon={ShoppingBasket}
          onPress={onOpenShopping}
          variant="surface"
          size={emphasizeEntryActions ? "medium" : "small"}
          fullWidth
          testID="home-shopping-button"
        >
          장보기
        </Button>
      </View>
    </View>
  );
}
