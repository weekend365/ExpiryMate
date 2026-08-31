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
import { Pressable, StyleSheet, View } from "react-native";
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
  controlSize,
} from "../shared/theme";
import { AppText } from "./AppText";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { FeedbackBanner } from "./FeedbackBanner";

export function SpaceSwitcher() {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const {
    spaces,
    activeSpace,
    activeSpaceId,
    isLoading,
    error,
    refetchSpaces,
    setActiveSpaceId,
  } = useActiveSpace();
  const [visible, setVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!sessionUserId) {
        return;
      }
      if (!activeSpaceId) {
        void refetchSpaces();
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
    }, [activeSpaceId, queryClient, refetchSpaces, sessionUserId]),
  );

  // Never return null: a hidden switcher means activeSpace is missing, which
  // also keeps home/inventory/recipes disabled. Always show loading or retry.
  if (!activeSpace) {
    if (error) {
      return (
        <FeedbackBanner
          tone="danger"
          title="냉장고를 불러오지 못했어요"
          description={error.message}
          actionLabel="다시 시도"
          onAction={() => {
            void refetchSpaces();
          }}
        />
      );
    }

    return (
      <View
        style={[styles.trigger, styles.disabled]}
        accessibilityRole="text"
        accessibilityLabel="냉장고를 불러오는 중"
      >
        <View style={styles.triggerIcon}>
          <House color={colors.primary} size={spacing.md} strokeWidth={2.3} />
        </View>
        <View style={styles.triggerCopy}>
          <AppText variant="caption" tone="muted" scaleRole="chrome">
            지금 보고 있는 냉장고
          </AppText>
          <AppText variant="bodyStrong" style={styles.triggerTitle}>
            냉장고를 펼치고 있어요
          </AppText>
        </View>
      </View>
    );
  }

  const ActiveIcon =
    activeSpace.type === "store"
      ? Building2
      : activeSpace.type === "household"
        ? Users
        : House;

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={`현재 냉장고 ${activeSpace.name}`}
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
          <AppText variant="caption" tone="muted" scaleRole="chrome">
            지금 보고 있는 냉장고
          </AppText>
          <AppText variant="bodyStrong" style={styles.triggerTitle}>
            {activeSpace.name}
          </AppText>
        </View>
        <ChevronDown color={colors.subtext} size={spacing.md} strokeWidth={2.2} />
      </Pressable>

      {error ? (
        <FeedbackBanner
          tone="warning"
          title="최신 냉장고 목록을 확인하지 못했어요"
          description="저장된 냉장고 데이터는 그대로 보여드리고 있어요."
          actionLabel="새로고침"
          onAction={() => {
            void refetchSpaces();
          }}
        />
      ) : null}

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
                  <AppText variant="bodyStrong">{space.name}</AppText>
                  <AppText variant="caption" tone="subtext">
                    {space.memberCount > 1
                      ? `${space.memberCount}명이 함께 써요`
                      : "나만 쓰고 있어요"}
                  </AppText>
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
    minHeight: controlSize.ctaLarge,
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
    width: controlSize.icon,
    height: controlSize.icon,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  triggerTitle: {
    flexShrink: 1,
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
    minHeight: controlSize.ctaLarge,
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
    minWidth: 0,
    gap: spacing.xxs,
  },
});
