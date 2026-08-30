import { StyleSheet } from "react-native";
import ShoppingScreen from "../shopping";
import { AffiliateEntryImpression } from "../../src/features/affiliate/affiliate-entry-tracking";

export default function ShoppingTabScreen() {
  return (
    <AffiliateEntryImpression placement="shopping_tab" style={styles.screen}>
      <ShoppingScreen inTabs />
    </AffiliateEntryImpression>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
