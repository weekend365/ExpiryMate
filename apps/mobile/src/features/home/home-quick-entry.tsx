import {
  Barcode,
  ChevronRight,
  ImageIcon,
  PenLine,
  Plus,
  ShoppingBasket,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "../../components/AppText";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { colors, spacing } from "../../shared/theme";
import { homeScreenStyles as styles } from "./home-screen-styles";

export function HomeQuickEntry({
  onOpenScanner,
  onManualRegister,
  onOpenPhotoParse,
}: {
  onOpenScanner: () => void;
  onManualRegister: () => void;
  onOpenPhotoParse?: () => void;
}) {
  const [entryMethodVisible, setEntryMethodVisible] = useState(false);

  const selectEntryMethod = (action: () => void) => {
    setEntryMethodVisible(false);
    action();
  };

  return (
    <>
      <Button
        icon={Plus}
        onPress={() => setEntryMethodVisible(true)}
        fullWidth
        testID="home-add-ingredients-button"
      >
        재료 넣기
      </Button>

      <BottomSheet
        visible={entryMethodVisible}
        onClose={() => setEntryMethodVisible(false)}
        title="어떻게 넣을까요?"
        description={
          onOpenPhotoParse
            ? "바코드, 직접 입력, 사진 중 편한 방법을 골라 주세요."
            : "바코드 또는 직접 입력 중 편한 방법을 골라 주세요."
        }
        mascotMood="idle"
      >
        <View style={styles.entryMethodActions}>
          <Button
            icon={Barcode}
            onPress={() => selectEntryMethod(onOpenScanner)}
            fullWidth
            testID="home-scan-button"
          >
            바코드 스캔
          </Button>
          <Button
            icon={PenLine}
            onPress={() => selectEntryMethod(onManualRegister)}
            variant="surface"
            fullWidth
            testID="home-manual-register-button"
          >
            직접 입력
          </Button>
          {onOpenPhotoParse ? (
            <Button
              icon={ImageIcon}
              onPress={() => selectEntryMethod(onOpenPhotoParse)}
              variant="surface"
              fullWidth
              accessibilityLabel="사진으로 넣기"
              testID="home-photo-parse-button"
            >
              사진으로 여러 개
            </Button>
          ) : null}
        </View>
      </BottomSheet>
    </>
  );
}

export function HomeShoppingCard({
  onOpenShopping,
}: {
  onOpenShopping: () => void;
}) {
  return (
    <Pressable
      onPress={onOpenShopping}
      accessibilityRole="button"
      accessibilityLabel="최근 다 쓴 재료 다시 사기"
      accessibilityHint="장보기 화면으로 이동해요."
      testID="home-shopping-button"
      style={({ pressed }) => [
        styles.shoppingCard,
        pressed && styles.shoppingCardPressed,
      ]}
    >
      <View style={styles.shoppingIcon}>
        <ShoppingBasket
          color={colors.primary}
          size={spacing.md}
          strokeWidth={2.3}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
      <View style={styles.shoppingCopy}>
        <AppText variant="bodyStrong">최근 다 쓴 재료 다시 사기</AppText>
        <AppText variant="caption" tone="subtext">
          전에 사용한 재료를 장보기에서 빠르게 찾아보세요.
        </AppText>
      </View>
      <ChevronRight
        color={colors.primary}
        size={spacing.sm}
        strokeWidth={2.4}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}
