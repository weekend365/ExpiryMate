import {
  ExpirySource,
  ItemStatus,
  ProductCategory,
  StorageLocation,
  formatDateKorean,
  getExpiryBucket,
  inventoryFormSchema,
  itemStatusLabels,
  productCategoryLabels,
  productCategoryOptions,
  storageLocationLabels,
  storageLocationOptions,
} from "@expirymate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Package,
  Pencil,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import { DatePickerField } from "../../src/components/DatePickerField";
import { EmptyState } from "../../src/components/EmptyState";
import { FormField } from "../../src/components/FormField";
import { Mascot, type MascotMood } from "../../src/components/Mascot";
import { Pill } from "../../src/components/Pill";
import { QuantityStepper } from "../../src/components/QuantityStepper";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StepFlow } from "../../src/components/StepFlow";
import {
  consumeInventoryItem,
  discardInventoryItem,
  getInventoryItem,
  updateInventoryItem,
} from "../../src/services/api";
import { colors, radius, spacing, touchTarget, typography } from "../../src/shared/theme";

type InventoryFormInput = z.input<typeof inventoryFormSchema>;
type InventoryFormValues = z.output<typeof inventoryFormSchema>;
type EditStep = "product" | "storage" | "expiry";
type ConfirmAction = "consume" | "discard" | null;

const EDIT_STEPS: Array<{
  key: EditStep;
  label: string;
  title: string;
  description: string;
}> = [
  {
    key: "product",
    label: "재료",
    title: "이름을 확인할까요?",
    description: "재료 이름과 브랜드만 먼저 살펴볼게요.",
  },
  {
    key: "storage",
    label: "보관",
    title: "어디에, 몇 개 있나요?",
    description: "보관 위치와 수량을 맞춰 주세요.",
  },
  {
    key: "expiry",
    label: "기한",
    title: "유통기한과 메모",
    description: "날짜를 맞춰 두고, 필요할 때만 메모를 남겨 주세요.",
  },
];

export default function InventoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [editStep, setEditStep] = useState<EditStep>("product");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const itemQuery = useQuery({
    queryKey: ["inventory-item", id],
    queryFn: () => getInventoryItem(id),
    enabled: Boolean(id),
  });

  const updateMutation = useMutation({
    mutationFn: (values: Partial<InventoryFormValues>) =>
      updateInventoryItem(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-item", id] });
    },
  });

  const consumeMutation = useMutation({
    mutationFn: () => consumeInventoryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-item", id] });
    },
  });

  const discardMutation = useMutation({
    mutationFn: () => discardInventoryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-item", id] });
    },
  });

  const form = useForm<InventoryFormInput, undefined, InventoryFormValues>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues: {
      displayName: "",
      quantity: 1,
      storageLocation: StorageLocation.FRIDGE,
      expiryDate: "",
      expirySource: ExpirySource.MANUAL,
    },
  });

  useEffect(() => {
    if (itemQuery.data) {
      form.reset({
        productId: itemQuery.data.productId ?? undefined,
        displayName: itemQuery.data.displayName,
        brand: itemQuery.data.brand ?? "",
        category: itemQuery.data.category ?? undefined,
        quantity: itemQuery.data.quantity,
        unit: itemQuery.data.unit ?? "개",
        storageLocation: itemQuery.data.storageLocation,
        expiryDate: itemQuery.data.expiryDate,
        expirySource: itemQuery.data.expirySource,
        notes: itemQuery.data.notes ?? "",
      });
    }
  }, [form, itemQuery.data]);

  const quantity = Number(form.watch("quantity")) || 1;
  const displayName = form.watch("displayName")?.trim() ?? "";
  const expiryDate = form.watch("expiryDate");
  const storageLocation = form.watch("storageLocation");
  const category = form.watch("category");
  const stepIndex = EDIT_STEPS.findIndex((step) => step.key === editStep);
  const isLastEditStep = editStep === "expiry";
  const canGoNext =
    (editStep === "product" && Boolean(displayName)) ||
    (editStep === "storage" && Boolean(storageLocation) && quantity > 0) ||
    (editStep === "expiry" && Boolean(expiryDate));

  const item = itemQuery.data;
  const isFinalStatus =
    item?.status === ItemStatus.CONSUMED ||
    item?.status === ItemStatus.DISCARDED;
  const viewMood = getViewMood(item?.expiryDate, item?.status);

  const openEdit = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    setEditStep("product");
    setMode("edit");
  };

  const closeEdit = () => {
    if (item) {
      form.reset({
        productId: item.productId ?? undefined,
        displayName: item.displayName,
        brand: item.brand ?? "",
        category: item.category ?? undefined,
        quantity: item.quantity,
        unit: item.unit ?? "개",
        storageLocation: item.storageLocation,
        expiryDate: item.expiryDate,
        expirySource: item.expirySource,
        notes: item.notes ?? "",
      });
    }
    setMode("view");
    setEditStep("product");
  };

  const goToPreviousEditStep = () => {
    if (stepIndex <= 0) {
      closeEdit();
      return;
    }

    setEditStep(EDIT_STEPS[stepIndex - 1].key);
  };

  const goToNextEditStep = () => {
    const nextStep = EDIT_STEPS[Math.min(EDIT_STEPS.length - 1, stepIndex + 1)];
    setEditStep(nextStep.key);
  };

  const handleSave = form.handleSubmit(async (values) => {
    try {
      setErrorMessage(null);
      await updateMutation.mutateAsync(values);
      setMode("view");
      setEditStep("product");
      setSuccessMessage("내용을 잘 바꿔 뒀어요. 장고도 안심했어요.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
      );
    }
  });

  const handleConfirmAction = async () => {
    if (!confirmAction) {
      return;
    }

    try {
      setErrorMessage(null);
      if (confirmAction === "consume") {
        await consumeMutation.mutateAsync();
        setSuccessMessage("다 드셨군요! 장고가 박수 쳐 드릴게요.");
      } else {
        await discardMutation.mutateAsync();
        setSuccessMessage("재료를 정리했어요. 장고도 한숨 돌렸어요.");
      }
      setConfirmAction(null);
    } catch (error) {
      setConfirmAction(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
      );
    }
  };

  if (itemQuery.isLoading) {
    return (
      <Screen title="재료 살펴보기" subtitle="장고가 내용을 찾아보고 있어요.">
        <EmptyState
          mood="idle"
          title="재료를 불러오고 있어요"
          description="조금만 기다려 주세요."
        />
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen title="재료 살펴보기" subtitle="장고가 찾지 못했어요.">
        <EmptyState
          mood="worry"
          title="이 재료를 찾지 못했어요"
          description="목록으로 돌아가서 다시 골라볼까요?"
          actionLabel="보관함으로 갈게요"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  if (mode === "edit") {
    return (
      <Screen
        title="내용 바꾸기"
        subtitle="한 번에 하나씩만 고쳐볼게요."
      >
        {errorMessage ? (
          <View style={styles.errorStrip}>
            <Mascot size="small" mood="worry" />
            <View style={styles.feedbackCopy}>
              <Text style={styles.errorTitle}>앗, 잠시 문제가 생겼어요</Text>
              <Text style={styles.errorDescription}>{errorMessage}</Text>
            </View>
          </View>
        ) : null}

        <StepFlow
          steps={EDIT_STEPS}
          currentIndex={stepIndex}
          onBack={goToPreviousEditStep}
          footer={
            <Button
              icon={isLastEditStep ? CheckCircle2 : ChevronRight}
              iconPosition="right"
              onPress={isLastEditStep ? handleSave : goToNextEditStep}
              loading={updateMutation.isPending}
              disabled={!canGoNext}
              fullWidth
            >
              {isLastEditStep ? "이렇게 바꿔둘까요?" : "다음으로 갈게요"}
            </Button>
          }
        >
          {editStep === "product" ? (
            <View style={styles.formCard}>
              <FormField
                control={form.control}
                name="displayName"
                label="재료 이름"
                placeholder="예: 서울우유 1L"
              />
              <FormField
                control={form.control}
                name="brand"
                label="브랜드"
                placeholder="예: 서울우유"
              />
            </View>
          ) : null}

          {editStep === "storage" ? (
            <>
              <View style={styles.card}>
                <SectionHeader
                  title="어디에 두나요?"
                  description="보관 위치를 하나만 골라 주세요."
                />
                <View style={styles.pillRow}>
                  {storageLocationOptions.map((option) => (
                    <Pill
                      key={option.value}
                      label={option.label}
                      icon={MapPin}
                      selected={storageLocation === option.value}
                      onPress={() =>
                        form.setValue(
                          "storageLocation",
                          option.value as StorageLocation,
                          { shouldValidate: true },
                        )
                      }
                    />
                  ))}
                </View>
              </View>

              <View style={styles.formCard}>
                <QuantityStepper
                  label="몇 개인가요?"
                  value={quantity}
                  onChange={(nextQuantity) =>
                    form.setValue("quantity", nextQuantity, {
                      shouldValidate: true,
                    })
                  }
                  error={form.formState.errors.quantity?.message}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  label="단위"
                  placeholder="개 / 통 / 봉"
                />
              </View>
            </>
          ) : null}

          {editStep === "expiry" ? (
            <>
              <View style={styles.formCard}>
                <DatePickerField
                  label="유통기한"
                  value={expiryDate}
                  onChange={(nextDate) => {
                    form.setValue("expiryDate", nextDate, {
                      shouldValidate: true,
                    });
                    form.setValue("expirySource", ExpirySource.MANUAL, {
                      shouldValidate: true,
                    });
                  }}
                  error={form.formState.errors.expiryDate?.message}
                />
              </View>

              <View style={styles.card}>
                <SectionHeader
                  title="카테고리"
                  description="필요할 때만 골라 주세요."
                />
                <View style={styles.pillRow}>
                  {productCategoryOptions.map((option) => (
                    <Pill
                      key={option.value}
                      label={option.label}
                      selected={category === option.value}
                      onPress={() =>
                        form.setValue(
                          "category",
                          option.value as ProductCategory,
                          { shouldValidate: true },
                        )
                      }
                    />
                  ))}
                </View>
              </View>

              <View style={styles.formCard}>
                <FormField
                  control={form.control}
                  name="notes"
                  label="메모"
                  placeholder="기억해 둘 말이 있으면 적어 주세요"
                  multiline
                />
              </View>
            </>
          ) : null}
        </StepFlow>
      </Screen>
    );
  }

  return (
    <Screen
      title={item.displayName}
      subtitle="장고랑 같이 이 재료를 살펴볼게요."
      footer={
        isFinalStatus ? (
          <Button onPress={() => router.back()} fullWidth>
            보관함으로 갈게요
          </Button>
        ) : (
          <Button icon={Pencil} onPress={openEdit} fullWidth>
            내용 바꿀래요
          </Button>
        )
      }
    >
      {successMessage ? (
        <View style={styles.successStrip}>
          <Mascot size="small" mood="happy" />
          <Text style={styles.successTitle}>{successMessage}</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.errorStrip}>
          <Mascot size="small" mood="worry" />
          <View style={styles.feedbackCopy}>
            <Text style={styles.errorTitle}>앗, 잠시 문제가 생겼어요</Text>
            <Text style={styles.errorDescription}>{errorMessage}</Text>
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.heroCard,
          viewMood === "worry" ? styles.heroCardWorry : styles.heroCardCalm,
        ]}
      >
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <Text
              style={[
                styles.heroEyebrow,
                viewMood === "worry"
                  ? styles.heroEyebrowWorry
                  : styles.heroEyebrowCalm,
              ]}
            >
              {itemStatusLabels[item.status]}
            </Text>
            <Text style={styles.heroTitle}>{item.displayName}</Text>
            <Text style={styles.heroDescription}>
              {storageLocationLabels[item.storageLocation]} · {item.quantity}
              {item.unit ?? "개"}
            </Text>
          </View>
          <Mascot size="small" mood={viewMood} />
        </View>
      </View>

      <View style={styles.summaryCard}>
        <SummaryRow
          icon={CalendarDays}
          label="유통기한"
          value={formatDateKorean(item.expiryDate)}
        />
        <SummaryRow
          icon={MapPin}
          label="보관 위치"
          value={storageLocationLabels[item.storageLocation]}
        />
        <SummaryRow
          icon={Package}
          label="수량"
          value={`${item.quantity}${item.unit ?? "개"}`}
        />
        {item.brand ? (
          <SummaryRow icon={Package} label="브랜드" value={item.brand} />
        ) : null}
        {item.category ? (
          <SummaryRow
            icon={Package}
            label="카테고리"
            value={productCategoryLabels[item.category]}
          />
        ) : null}
        {item.notes ? (
          <View style={styles.notesBlock}>
            <Text style={styles.notesLabel}>메모</Text>
            <Text style={styles.notesValue}>{item.notes}</Text>
          </View>
        ) : null}
      </View>

      {!isFinalStatus ? (
        <View style={styles.softActions}>
          <Pressable
            onPress={() => {
              setSuccessMessage(null);
              setConfirmAction("consume");
            }}
            style={({ pressed }) => [
              styles.softAction,
              pressed && styles.softActionPressed,
            ]}
          >
            <Text style={styles.softActionTitle}>다 먹었어요</Text>
            <Text style={styles.softActionDescription}>
              다 쓰셨다면 장고에게 알려 주세요.
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setSuccessMessage(null);
              setConfirmAction("discard");
            }}
            style={({ pressed }) => [
              styles.softAction,
              styles.softActionDanger,
              pressed && styles.softActionPressed,
            ]}
          >
            <Text style={[styles.softActionTitle, styles.softActionTitleDanger]}>
              정리할게요
            </Text>
            <Text style={styles.softActionDescription}>
              버리거나 비울 재료라면 여기서 정리할 수 있어요.
            </Text>
          </Pressable>
        </View>
      ) : (
        <EmptyState
          mood="happy"
          title={
            item.status === ItemStatus.CONSUMED
              ? "이미 다 드신 재료예요"
              : "이미 정리한 재료예요"
          }
          description="보관함에서 다른 재료를 살펴볼까요?"
        />
      )}

      <BottomSheet
        visible={confirmAction === "discard"}
        onClose={() => setConfirmAction(null)}
        mascotMood="worry"
        title="이 재료를 정리할까요?"
        description={`${item.displayName}을(를) 보관함에서 빼면 목록에서 사라져요.`}
        footer={
          <View style={styles.sheetFooter}>
            <Button
              variant="secondary"
              onPress={() => setConfirmAction(null)}
              fullWidth
            >
              조금만 더 둘래요
            </Button>
            <Button
              variant="danger"
              onPress={handleConfirmAction}
              loading={discardMutation.isPending}
              fullWidth
            >
              정리할게요
            </Button>
          </View>
        }
      >
        <View style={styles.confirmCard}>
          <Text style={styles.confirmLabel}>정리할 재료</Text>
          <Text style={styles.confirmValue}>{item.displayName}</Text>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={confirmAction === "consume"}
        onClose={() => setConfirmAction(null)}
        mascotMood="happy"
        title="다 드신 거죠?"
        description="다 드셨다고 알려주시면 보관함 목록에서 빠져요."
        footer={
          <View style={styles.sheetFooter}>
            <Button
              variant="secondary"
              onPress={() => setConfirmAction(null)}
              fullWidth
            >
              아직이에요
            </Button>
            <Button
              onPress={handleConfirmAction}
              loading={consumeMutation.isPending}
              fullWidth
            >
              다 먹었어요
            </Button>
          </View>
        }
      >
        <View style={styles.confirmCard}>
          <Text style={styles.confirmLabel}>다 드신 재료</Text>
          <Text style={styles.confirmValue}>{item.displayName}</Text>
        </View>
      </BottomSheet>
    </Screen>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryLabelRow}>
        <Icon color={colors.mutedText} size={spacing.sm} strokeWidth={2.3} />
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function getViewMood(
  expiryDate?: string,
  status?: ItemStatus,
): MascotMood {
  if (status === ItemStatus.CONSUMED || status === ItemStatus.DISCARDED) {
    return "happy";
  }

  if (!expiryDate) {
    return "idle";
  }

  const bucket = getExpiryBucket(expiryDate);
  if (bucket === "expired" || bucket === "today" || bucket === "within_3_days") {
    return "worry";
  }

  return "idle";
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  heroCardWorry: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
  },
  heroCardCalm: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  heroEyebrow: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
  },
  heroEyebrowWorry: {
    color: colors.warning,
  },
  heroEyebrowCalm: {
    color: colors.primary,
  },
  heroTitle: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.heading.fontFamily,
    color: colors.text,
  },
  heroDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: touchTarget.min,
  },
  summaryLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  summaryLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.subtext,
  },
  summaryValue: {
    flex: 1,
    textAlign: "right",
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  notesBlock: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesLabel: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  notesValue: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.text,
  },
  softActions: {
    gap: spacing.sm,
  },
  softAction: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xxs,
    minHeight: touchTarget.min,
    justifyContent: "center",
  },
  softActionDanger: {
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
  },
  softActionPressed: {
    backgroundColor: colors.surfacePressed,
  },
  softActionTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  softActionTitleDanger: {
    color: colors.danger,
  },
  softActionDescription: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  successStrip: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  successTitle: {
    flex: 1,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  errorStrip: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  feedbackCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  errorTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.danger,
  },
  errorDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
  sheetFooter: {
    gap: spacing.sm,
  },
  confirmCard: {
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.xxl,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  confirmLabel: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  confirmValue: {
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
});
