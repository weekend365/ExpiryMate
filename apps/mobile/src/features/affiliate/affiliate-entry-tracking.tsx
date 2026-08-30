import { type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { trackMonetizationEvent } from "../../services/api";
import { useVisibleImpression } from "./use-visible-impression";

export type AffiliateEntryPlacement =
  | "home_reorder_preview"
  | "inventory_consumed"
  | "cooking_complete"
  | "recipe_optional_entry"
  | "shopping_tab";

export function AffiliateEntryImpression({
  placement,
  style,
  children,
}: {
  placement: AffiliateEntryPlacement;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const ref = useVisibleImpression({
    impressionKey: `affiliate-entry:${placement}`,
    onVisible: () => {
      void trackMonetizationEvent({
        event: "affiliate_entry_shown",
        properties: { placement },
      }).catch(() => undefined);
    },
  });

  return <View ref={ref} style={style}>{children}</View>;
}

export function trackAffiliateEntryTap(placement: AffiliateEntryPlacement) {
  void trackMonetizationEvent({
    event: "affiliate_entry_tapped",
    properties: { placement },
  }).catch(() => undefined);
}
