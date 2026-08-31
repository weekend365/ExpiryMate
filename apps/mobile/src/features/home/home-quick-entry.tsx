import { ShoppingBasket } from "lucide-react-native";
import type { AffiliateReorderPreviewResponse } from "@expirymate/shared";
import { View } from "react-native";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { colors, spacing } from "../../shared/theme";
import { homeScreenStyles as styles } from "./home-screen-styles";
import { AffiliateProductGroupView } from "../affiliate/affiliate-product-group";
import { AffiliateDisclosure } from "../affiliate/affiliate-disclosure";
import {
  AffiliateEntryImpression,
  trackAffiliateEntryTap,
} from "../affiliate/affiliate-entry-tracking";

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
          다른 상품 보기
        </Button>
        <AffiliateDisclosure disclosure={preview.disclosure} />
      </View>
    </AffiliateEntryImpression>
  );
}
