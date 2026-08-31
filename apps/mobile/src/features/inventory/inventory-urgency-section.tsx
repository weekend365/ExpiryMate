import { ChevronDown, ChevronUp } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "../../components/AppText";
import { StatCard } from "../../components/StatCard";
import { colors, spacing, typography } from "../../shared/theme";
import {
  inventoryUrgencySectionDescriptions,
  type InventoryUrgencySection,
} from "./filters";
import { inventoryScreenStyles as styles } from "./inventory-screen-styles";

type ExpiryTrafficTone = "default" | "danger" | "warning" | "success";

export function UrgencySection({
  section,
  collapsed,
  onToggle,
  children,
}: {
  section: {
    key: InventoryUrgencySection;
    title: string;
    itemCount: number;
  };
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const description = inventoryUrgencySectionDescriptions[section.key];
  const title = `${section.title} ${section.itemCount}건`;

  return (
    <View style={styles.urgencySection}>
      <View
        style={[
          styles.urgencySectionHeader,
          collapsed ? null : styles.urgencySectionHeaderExpanded,
        ]}
        accessibilityRole="header"
        accessibilityLabel={`${title}. ${description}`}
      >
        <AppText
          variant="bodySmall"
          scaleRole="chrome"
          densityAware={false}
          numberOfLines={1}
          style={styles.urgencySectionTitle}
        >
          {title}
        </AppText>
        <Pressable
          onPress={onToggle}
          hitSlop={spacing.xs}
          accessibilityRole="button"
          accessibilityLabel={
            collapsed
              ? `${section.title} 펼쳐 볼게요`
              : `${section.title} 접을게요`
          }
          accessibilityHint={
            collapsed
              ? "이 분류의 재료를 펼쳐 볼 수 있어요."
              : "이 분류의 재료를 접어요."
          }
          accessibilityState={{ expanded: !collapsed }}
          style={({ pressed }) => [
            styles.urgencySectionToggle,
            pressed && styles.headerFilterButtonPressed,
          ]}
        >
          <AppText
            variant="bodySmall"
            scaleRole="chrome"
            densityAware={false}
            numberOfLines={1}
          >
            {collapsed ? "펼치기" : "접기"}
          </AppText>
          {collapsed ? (
            <ChevronDown
              color={colors.text}
              size={typography.bodySmall.fontSize}
              strokeWidth={2.4}
            />
          ) : (
            <ChevronUp
              color={colors.text}
              size={typography.bodySmall.fontSize}
              strokeWidth={2.4}
            />
          )}
        </Pressable>
      </View>
      {collapsed ? null : (
        <View style={styles.urgencySectionBody}>{children}</View>
      )}
    </View>
  );
}

export function ExpiryTrafficLamp({
  label,
  count,
  tone,
  lampOn,
  selected,
  onPress,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: {
  label: string;
  count: number;
  tone: ExpiryTrafficTone;
  lampOn: boolean;
  selected: boolean;
  onPress: () => void;
  testID: string;
  accessibilityLabel: string;
  accessibilityHint: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.expiryTrafficLamp,
        pressed && styles.headerFilterButtonPressed,
      ]}
    >
      <StatCard
        variant="traffic"
        mini
        showLabel={false}
        label={label}
        value={count}
        tone={tone}
        selected={lampOn}
        showGlow={selected}
      />
    </Pressable>
  );
}
