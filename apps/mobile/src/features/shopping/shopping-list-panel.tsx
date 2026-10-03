import {
  createShoppingItemSchema,
  type CreateShoppingItem,
  type ShoppingItem,
} from "@expirymate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Check, MoreHorizontal, Plus, Square } from "lucide-react-native";
import { AppText } from "../../components/AppText";
import { AppTextInput } from "../../components/AppTextInput";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { FeedbackBanner } from "../../components/FeedbackBanner";
import { FormField } from "../../components/FormField";
import { Pill } from "../../components/Pill";
import { colors, controlSize, radius, spacing } from "../../shared/theme";
import { useRegistrationStore } from "../../store/registration-store";
import { registerRoute } from "../registration/registration-return";
import { useActiveSpace } from "../spaces/space-provider";
import { useShoppingList } from "./use-shopping-list";
import { ShoppingHeroCard } from "./shopping-hero-card";

export function ShoppingListPanel({
  suggestedNames,
  onFindProducts,
}: {
  suggestedNames: string[];
  onFindProducts: (name: string) => void;
}) {
  const { activeSpaceId } = useActiveSpace();
  const { query, change, isPending, ready } = useShoppingList();
  const [editing, setEditing] = useState<ShoppingItem | "new" | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const form = useForm<CreateShoppingItem>({
    resolver: zodResolver(createShoppingItemSchema),
    defaultValues: { name: "", quantity: 1, unit: "개" },
  });
  const items = query.data?.items ?? [];
  const pending = items.filter((item) => !item.completedAt);
  const completed = items.filter((item) => item.completedAt);
  const notifyError = (error: unknown) =>
    Alert.alert(
      "목록을 바꾸지 못했어요",
      error instanceof Error ? error.message : "다시 시도해 주세요.",
    );
  const edit = (item: ShoppingItem | "new") => {
    form.reset(
      item === "new"
        ? { name: "", quantity: 1, unit: "개" }
        : { name: item.name, quantity: item.quantity, unit: item.unit },
    );
    setEditing(item);
  };
  const save = form.handleSubmit(async (body) => {
    try {
      if (editing && editing !== "new")
        await change({
          action: "update",
          id: editing.id,
          body: { ...body, expectedVersion: editing.version },
        });
      else await change({ action: "create", body });
      setEditing(null);
    } catch (error) {
      notifyError(error);
    }
  });
  const register = (item: ShoppingItem) => {
    if (!activeSpaceId) return;
    const start = () => {
      const store = useRegistrationStore.getState();
      store.clearPrefill(activeSpaceId);
      store.setDraft(activeSpaceId, {
        shoppingListItemId: item.id,
        displayName: item.name,
        quantity: item.quantity,
        unit: item.unit,
      });
      router.push(registerRoute("shop"));
    };
    const draft = useRegistrationStore.getState().drafts[activeSpaceId];
    if (draft?.displayName)
      Alert.alert(
        "작성 중인 재료가 있어요",
        "작성 중인 내용을 이 재료로 바꿀까요?",
        [
          { text: "취소", style: "cancel" },
          { text: "이 재료 등록", onPress: start },
        ],
      );
    else start();
  };
  const confirmDelete = (item: ShoppingItem) =>
    Alert.alert(
      "목록에서 삭제할까요?",
      `${item.name}을 장보기 목록에서 지워요. 등록된 재고는 유지돼요.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: () =>
            void change({
              action: "delete",
              id: item.id,
              expectedVersion: item.version,
            }).catch(notifyError),
        },
      ],
    );
  const showItemMenu = (item: ShoppingItem) =>
    Alert.alert(`${item.name} 관리`, undefined, [
      { text: "취소", style: "cancel" },
      { text: "수정", onPress: () => edit(item) },
      { text: "삭제", style: "destructive", onPress: () => confirmDelete(item) },
    ]);
  const renderItem = (item: ShoppingItem, isLast: boolean) => (
    <View
      key={item.id}
      style={[
        styles.itemRow,
        item.completedAt && styles.itemCompleted,
        !isLast && styles.itemDivider,
      ]}
      testID={`shopping-item-${item.id}`}
    >
      <Pressable
        onPress={() =>
          void change({
            action: "update",
            id: item.id,
            body: {
              completed: !item.completedAt,
              expectedVersion: item.version,
            },
          })
            .then(() => {
              if (!item.completedAt) setShowCompleted(true);
            })
            .catch(notifyError)
        }
        disabled={isPending || Boolean(item.inventoryItemId)}
        accessibilityRole="checkbox"
        accessibilityLabel={`${item.name} 구매 ${item.completedAt ? "완료 취소" : "완료"}`}
        accessibilityState={{
          checked: Boolean(item.completedAt),
          disabled: isPending || Boolean(item.inventoryItemId),
        }}
        style={styles.check}
      >
        {item.completedAt ? (
          <View style={styles.completedCheck}>
            <Check size={spacing.md} color={colors.actionSuccessForeground} />
          </View>
        ) : (
          <Square size={spacing.md} color={colors.subtext} />
        )}
      </Pressable>
      <Pressable
        onPress={
          item.inventoryItemId
            ? undefined
            : item.completedAt
              ? () => register(item)
              : () => onFindProducts(item.name)
        }
        disabled={Boolean(item.inventoryItemId)}
        accessibilityRole={item.inventoryItemId ? "text" : "button"}
        accessibilityLabel={`${item.name} ${item.quantity}${item.unit}, ${item.inventoryItemId ? "보관함 등록 완료" : item.completedAt ? "보관함에 등록" : "관련 상품 보기"}`}
        style={styles.itemDetails}
      >
        <View style={styles.nameAndQuantity}>
          <AppText variant="subheading" style={styles.itemName}>
            {item.name}
          </AppText>
          <AppText variant="bodySmallStrong" tone="subtext">
            {item.quantity}{item.unit}
          </AppText>
        </View>
        <AppText
          variant="bodySmall"
          tone={item.inventoryItemId ? "success" : "link"}
        >
          {item.inventoryItemId
            ? "보관함 등록 완료"
            : item.completedAt
              ? "보관함에 등록 ›"
              : "관련 상품 보기 ›"}
        </AppText>
      </Pressable>
      <Pressable
        onPress={() => showItemMenu(item)}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityLabel={`${item.name} 관리`}
        accessibilityState={{ disabled: isPending }}
        style={styles.moreButton}
      >
        <MoreHorizontal size={spacing.md} color={colors.primaryForeground} />
      </Pressable>
    </View>
  );
  return (
    <View style={styles.root} testID="shopping-list-panel">
      <ShoppingHeroCard
        appearance={items.length > 0 ? "crayon" : "default"}
        notices={[
          {
            id: "shopping-list-guide",
            mood: "speak",
            message: "살 재료를 적어 주세요. 구매한 재료는 체크하면 돼요!",
          },
        ]}
      >
        <Button
          icon={Plus}
          onPress={() => edit("new")}
          disabled={!ready || isPending}
          testID="shopping-add-button"
        >
          목록에 추가
        </Button>
      </ShoppingHeroCard>
      {suggestedNames.length ? (
        <View style={styles.suggestionCard}>
          <AppText variant="bodyStrong">이 재료도 담을까요?</AppText>
          <View style={styles.actions}>
            {suggestedNames.map((name) => (
              <Pill
                key={name}
                label={`${name} 담기`}
                onPress={() => {
                  form.reset({ name, quantity: 1, unit: "개" });
                  setEditing("new");
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
      {query.isLoading ? (
        <ActivityIndicator accessibilityLabel="장보기 목록 불러오는 중" />
      ) : null}
      {query.isError ? (
        <FeedbackBanner
          title="목록을 새로 불러오지 못했어요"
          description={
            query.error instanceof Error
              ? query.error.message
              : "연결을 확인해 주세요."
          }
          actionLabel="다시 시도"
          onAction={() => void query.refetch()}
        />
      ) : null}
      {!query.isLoading && !query.isError && !items.length ? (
        <EmptyState
          kind="empty"
          title="아직 살 재료가 없어요"
          description="다 쓴 재료나 요리에 필요한 재료를 담아 보세요."
        />
      ) : null}
      {pending.length ? (
        <View style={styles.list}>
          {pending.map((item, index) =>
            renderItem(item, index === pending.length - 1),
          )}
        </View>
      ) : null}
      {completed.length ? (
        <>
          <Button
            variant="surface"
            onPress={() => setShowCompleted(!showCompleted)}
          >
            구매 완료 {completed.length}개 {showCompleted ? "접기" : "보기"}
          </Button>
          {showCompleted ? (
            <View style={styles.list}>
              {completed.map((item, index) =>
                renderItem(item, index === completed.length - 1),
              )}
            </View>
          ) : null}
        </>
      ) : null}
      <BottomSheet
        visible={editing !== null}
        onClose={() => {
          if (!isPending) setEditing(null);
        }}
        title={editing === "new" ? "살 재료 추가" : "장보기 항목 수정"}
        footer={
          <Button onPress={() => void save()} loading={isPending} fullWidth>
            목록에 저장
          </Button>
        }
      >
        <View style={styles.root}>
          <FormField
            control={form.control}
            name="name"
            label="재료 이름"
            placeholder="예: 두부"
          />
          <Controller
            control={form.control}
            name="quantity"
            render={({ field, fieldState }) => (
              <View style={styles.copy}>
                <AppText variant="bodySmall">수량</AppText>
                <AppTextInput
                  accessibilityLabel="장보기 수량"
                  keyboardType="number-pad"
                  value={field.value ? String(field.value) : ""}
                  onChangeText={(value) =>
                    field.onChange(value ? Number(value) : 0)
                  }
                  style={styles.input}
                />
                {fieldState.error ? (
                  <AppText variant="caption" tone="danger">
                    {fieldState.error.message}
                  </AppText>
                ) : null}
              </View>
            )}
          />
          <FormField
            control={form.control}
            name="unit"
            label="단위"
            placeholder="개"
          />
          <AppText variant="caption" tone="subtext">
            이미 담긴 재료는 중복 추가하지 않아요. 기존 항목의 수량은 수정에서
            바꿔 주세요.
          </AppText>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  suggestionCard: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  list: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  itemRow: {
    minHeight: controlSize.ctaLarge + spacing.sm,
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  itemCompleted: { backgroundColor: colors.successSoft },
  itemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  copy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  itemDetails: {
    flex: 1,
    minWidth: 0,
    minHeight: controlSize.minimum,
    justifyContent: "center",
    gap: spacing.xxs,
  },
  nameAndQuantity: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  itemName: { flexShrink: 1 },
  check: {
    minHeight: controlSize.minimum,
    minWidth: controlSize.minimum,
    alignItems: "center",
    justifyContent: "center",
  },
  completedCheck: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.actionSuccessBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  moreButton: {
    minHeight: controlSize.minimum,
    minWidth: controlSize.minimum,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  input: {
    minHeight: controlSize.cta,
    borderWidth: 1,
    borderColor: colors.borderControl,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
});
