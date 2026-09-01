import { StyleSheet } from "react-native";
import { AffiliateEntryImpression } from "../../src/features/affiliate/affiliate-entry-tracking";
import { ShoppingScreen } from "../../src/features/affiliate/ShoppingScreen";

export default function ShoppingTabScreen() {
  return (
    <AffiliateEntryImpression placement="shopping_tab" style={styles.screen}>
      <ShoppingScreen />
    </AffiliateEntryImpression>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
