import { router } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Check,
  ChevronDown,
  House,
  Users,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useActiveSpace } from "../features/spaces/space-provider";
import { useAuth } from "../features/auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../features/auth/session-boundary";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../shared/theme";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";

export function SpaceSwitcher() {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const {
    spaces,
    activeSpace,
    activeSpaceId,
    isLoading,
    setActiveSpaceId,
  } = useActiveSpace();
  const [visible, setVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!sessionUserId || !activeSpaceId) {
        return;
      }
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: withInventorySpace(
            sessionQueryKeys.dashboard,
            sessionUserId,
            activeSpaceId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: withInventorySpace(
            sessionQueryKeys.inventory,
            sessionUserId,
            activeSpaceId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: withInventorySpace(
            sessionQueryKeys.recipes,
            sessionUserId,
            activeSpaceId,
          ),
        }),
      ]);
    }, [activeSpaceId, queryClient, sessionUserId]),
  );

  if (!activeSpace && !isLoading) {
    return null;
  }

  const ActiveIcon =
    activeSpace?.type === "store"
      ? Building2
      : activeSpace?.type === "household"
        ? Users
        : House;

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={`현재 냉장고 ${activeSpace?.name ?? "불러오는 중"}`}
        accessibilityHint="다른 냉장고로 바꿀 수 있어요"
        style={({ pressed }) => [
          styles.trigger,
          pressed && styles.pressed,
          isLoading && styles.disabled,
        ]}
      >
        <View style={styles.triggerIcon}>
          <ActiveIcon color={colors.primary} size={spacing.md} strokeWidth={2.3} />
        </View>
        <View style={styles.triggerCopy}>
          <Text style={styles.eyebrow}>지금 보고 있는 냉장고</Text>
          <Text style={styles.triggerTitle} numberOfLines={1}>
            {activeSpace?.name ?? "냉장고를 펼치고 있어요"}
          </Text>
        </View>
        <ChevronDown color={colors.subtext} size={spacing.md} strokeWidth={2.2} />
      </Pressable>

      <BottomSheet
        visible={visible}
        onClose={() => setVisible(false)}
        title="어느 냉장고를 볼까요?"
        description="가족이나 동료와 함께 쓰는 재고도 여기서 바꿀 수 있어요."
        footer={
          <Button
            variant="surface"
            onPress={() => {
              setVisible(false);
              router.push("/settings/spaces");
            }}
            fullWidth
          >
            함께 쓰는 냉장고 살펴보기
          </Button>
        }
      >
        <View style={styles.spaceList}>
          {spaces.map((space) => {
            const selected = space.id === activeSpaceId;
            const Icon =
              space.type === "store"
                ? Building2
                : space.type === "household"
                  ? Users
                  : House;
            return (
              <Pressable
                key={space.id}
                onPress={() => {
                  setActiveSpaceId(space.id);
                  setVisible(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.spaceRow,
                  selected && styles.spaceRowSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Icon
                  color={selected ? colors.primary : colors.subtext}
                  size={spacing.md}
                  strokeWidth={2.3}
                />
                <View style={styles.spaceCopy}>
                  <Text style={styles.spaceName}>{space.name}</Text>
                  <Text style={styles.spaceMeta}>
                    {space.memberCount > 1
                      ? `${space.memberCount}명이 함께 써요`
                      : "나만 쓰고 있어요"}
                  </Text>
                </View>
                {selected ? (
                  <Check
                    color={colors.primary}
                    size={spacing.md}
                    strokeWidth={2.5}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: touchTarget.ctaLarge,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  triggerIcon: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  eyebrow: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.mutedText,
  },
  triggerTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.55,
  },
  spaceList: {
    gap: spacing.xs,
  },
  spaceRow: {
    minHeight: touchTarget.ctaLarge,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  spaceRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  spaceCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  spaceName: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  spaceMeta: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.subtext,
  },
});
