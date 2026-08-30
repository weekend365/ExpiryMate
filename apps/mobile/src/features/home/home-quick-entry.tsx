import {
  Barcode,
  ImageIcon,
  PenLine,
  Plus,
  ShoppingBasket,
} from "lucide-react-native";
import type { AffiliateReorderPreviewResponse } from "@expirymate/shared";
import { useState } from "react";
import { View } from "react-native";
import { AppText } from "../../components/AppText";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { colors, spacing } from "../../shared/theme";
import { homeScreenStyles as styles } from "./home-screen-styles";
import { AffiliateProductGroupView } from "../affiliate/affiliate-product-group";
import { AffiliateDisclosure } from "../affiliate/affiliate-disclosure";
import {
  AffiliateEntryImpression,
  trackAffiliateEntryTap,
} from "../affiliate/affiliate-entry-tracking";

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

export function HomeReorderCard({
  preview,
  onOpenShopping,
}: {
  preview: AffiliateReorderPreviewResponse;
  onOpenShopping: (query: string) => void;
}) {
  const group = preview.group;
  if (!preview.enabled || !preview.kind || !group || !group.products[0]) {
    return null;
  }
  const title =
    preview.kind === "repeat_purchase_due"
      ? `평소라면 ${group.ingredientName}이 필요할 때예요`
      : `최근 다 쓴 ${group.ingredientName}, 다시 채워둘까요?`;
  const description =
    preview.kind === "repeat_purchase_due" && preview.cadenceDays
      ? `약 ${preview.cadenceDays}일마다 사용한 기록을 바탕으로 알려드려요.`
      : "최근 모두 사용한 재료와 관련된 상품이에요.";

  return (
    <AffiliateEntryImpression placement="home_reorder_preview">
      <View style={styles.reorderCard} testID="home-reorder-card">
        <View style={styles.reorderHeader}>
          <View style={styles.shoppingIcon}>
            <ShoppingBasket
              color={colors.primary}
              size={spacing.md}
              strokeWidth={2.3}
            />
          </View>
          <View style={styles.shoppingCopy}>
            <AppText variant="bodyStrong">{title}</AppText>
            <AppText variant="caption" tone="subtext">
              {description}
            </AppText>
          </View>
        </View>
        <AffiliateProductGroupView
          group={{ ...group, products: group.products.slice(0, 1) }}
        />
        <Button
          variant="surface"
          onPress={() => {
            trackAffiliateEntryTap("home_reorder_preview");
            onOpenShopping(group.query);
          }}
          fullWidth
        >
          다른 상품도 볼게요
        </Button>
        <AffiliateDisclosure disclosure={preview.disclosure} />
      </View>
    </AffiliateEntryImpression>
  );
}
