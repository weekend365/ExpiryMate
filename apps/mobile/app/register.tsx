import {
  DEFAULT_INVENTORY_FORM,
  ExpirySource,
  ItemStatus,
  ProductCategory,
  StorageLocation,
  addDays,
  formatDateKorean,
  inventoryFormSchema,
  productCategoryLabels,
  productCategoryOptions,
  storageLocationLabels,
  toIsoDate,
} from "@expirymate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import {
  CalendarDays,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  MapPin,
  Package,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "../src/components/BottomSheet";
import { Button } from "../src/components/Button";
import { DatePickerField } from "../src/components/DatePickerField";
import { EmptyState } from "../src/components/EmptyState";
import { FormField } from "../src/components/FormField";
import { Mascot } from "../src/components/Mascot";
import { Pill } from "../src/components/Pill";
import { QuantityStepper } from "../src/components/QuantityStepper";
import { Screen } from "../src/components/Screen";
import { SectionHeader } from "../src/components/SectionHeader";
import { StepFlow } from "../src/components/StepFlow";
import { useInventoryList } from "../src/features/inventory/use-inventory-list";
import { useSaveInventoryItem } from "../src/features/registration/use-save-inventory-item";
import { colors, radius, spacing, touchTarget, typography } from "../src/shared/theme";
import {
  type RegistrationDraft,
  useRegistrationStore,
} from "../src/store/registration-store";

type RegistrationFormValues = {
  productId?: string;
  displayName: string;
  brand: string;
  category?: ProductCategory;
  quantity: number;
  unit: string;
  storageLocation: StorageLocation;
  expiryDate: string;
  expirySource: ExpirySource;
  notes: string;
};

/** 1) 재료명 → 2) 보관/수량 → 3) 유통기한 확인 */
type RegistrationStep = "product" | "storage" | "expiry";

type RegisteredSessionItem = {
  id: string;
  displayName: string;
  quantity: number;
  unit?: string | null;
  storageLocation: StorageLocation;
  expiryDate: string;
};

const STORAGE_LOCATION_ORDER = [
  StorageLocation.FRIDGE,
  StorageLocation.FREEZER,
  StorageLocation.ROOM,
  StorageLocation.KITCHEN,
  StorageLocation.BATHROOM,
];

const REGISTRATION_STEPS: Array<{
  key: RegistrationStep;
  label: string;
  title: string;
  description: string;
}> = [
  {
    key: "product",
    label: "재료",
    title: "어떤 재료인가요?",
    description: "이름만 알려주시면 돼요. 예전에 넣었던 재료도 불러올 수 있어요.",
  },
  {
    key: "storage",
    label: "보관",
    title: "어디에, 몇 개 두나요?",
    description: "보관 위치와 수량만 정하면 다음으로 넘어가요.",
  },
  {
    key: "expiry",
    label: "기한",
    title: "유통기한을 확인할까요?",
    description: "빠른 선택으로 고르거나, 직접 날짜를 골라주세요.",
  },
];

const QUICK_EXPIRY_OPTIONS = [
  { label: "오늘", days: 0 },
  { label: "내일", days: 1 },
  { label: "3일 뒤", days: 3 },
  { label: "일주일", days: 7 },
];

const createDefaultFormValues = (): RegistrationFormValues => ({
  productId: undefined,
  displayName: "",
  brand: "",
  category: undefined,
  quantity: DEFAULT_INVENTORY_FORM.quantity,
  unit: DEFAULT_INVENTORY_FORM.unit ?? "개",
  storageLocation: DEFAULT_INVENTORY_FORM.storageLocation,
  expiryDate: DEFAULT_INVENTORY_FORM.expiryDate,
  expirySource: DEFAULT_INVENTORY_FORM.expirySource,
  notes: DEFAULT_INVENTORY_FORM.notes ?? "",
});

const buildInitialValues = (
  prefill: ReturnType<typeof useRegistrationStore.getState>["prefill"],
  draft: RegistrationDraft | null,
): RegistrationFormValues => {
  const nextValues = {
    ...createDefaultFormValues(),
    ...draft,
    quantity:
      typeof draft?.quantity === "number" && draft.quantity > 0
        ? draft.quantity
        : DEFAULT_INVENTORY_FORM.quantity,
    unit: draft?.unit ?? DEFAULT_INVENTORY_FORM.unit ?? "개",
    storageLocation:
      draft?.storageLocation ?? DEFAULT_INVENTORY_FORM.storageLocation,
    expiryDate: normalizeDraftExpiryDate(draft?.expiryDate),
    expirySource: draft?.expirySource ?? DEFAULT_INVENTORY_FORM.expirySource,
    notes: draft?.notes ?? DEFAULT_INVENTORY_FORM.notes ?? "",
    displayName: draft?.displayName ?? "",
    brand: draft?.brand ?? "",
  };

  if (prefill) {
    nextValues.productId = prefill.productId;
    nextValues.displayName = prefill.displayName ?? nextValues.displayName;
    nextValues.brand = prefill.brand ?? nextValues.brand;
    nextValues.category = prefill.category ?? nextValues.category;
  }

  return nextValues;
};

function normalizeDraftExpiryDate(value?: string) {
  if (!value) {
    return DEFAULT_INVENTORY_FORM.expiryDate;
  }

  try {
    return toIsoDate(value);
  } catch {
    return DEFAULT_INVENTORY_FORM.expiryDate;
  }
}

const getPrefillKey = (
  prefill: ReturnType<typeof useRegistrationStore.getState>["prefill"],
) =>
  prefill
    ? [prefill.productId ?? "", prefill.displayName ?? ""].join(":")
    : "";

export default function RegisterScreen() {
  const hasHydrated = useRegistrationStore((state) => state.hasHydrated);
  const prefill = useRegistrationStore((state) => state.prefill);
  const draft = useRegistrationStore((state) => state.draft);
  const setDraft = useRegistrationStore((state) => state.setDraft);
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);
  const clearDraft = useRegistrationStore((state) => state.clearDraft);
  const mutation = useSaveInventoryItem();
  const { data: inventory = [] } = useInventoryList();
  const [step, setStep] = useState<RegistrationStep>("product");
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(
    Boolean(prefill?.brand || prefill?.category),
  );
  const [registeredSessionItems, setRegisteredSessionItems] = useState<
    RegisteredSessionItem[]
  >([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(
    null,
  );
  const initializedRef = useRef(false);
  const appliedPrefillKeyRef = useRef("");

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(inventoryFormSchema) as never,
    defaultValues: createDefaultFormValues(),
  });

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const nextValues = buildInitialValues(prefill, draft);
    const nextPrefillKey = getPrefillKey(prefill);

    if (!initializedRef.current) {
      form.reset(nextValues);
      initializedRef.current = true;
      appliedPrefillKeyRef.current = nextPrefillKey;
      return;
    }

    if (!prefill) {
      appliedPrefillKeyRef.current = "";
    }

    if (prefill && nextPrefillKey !== appliedPrefillKeyRef.current) {
      form.reset(nextValues);
      appliedPrefillKeyRef.current = nextPrefillKey;
      setShowAdditionalInfo(Boolean(prefill.brand || prefill.category));
    }
  }, [draft, form, hasHydrated, prefill]);

  useEffect(() => {
    const subscription = form.watch((value) => {
      if (!hasHydrated || !initializedRef.current) {
        return;
      }

      setDraft({
        productId: value.productId,
        displayName: value.displayName,
        brand: value.brand,
        category: value.category,
        quantity:
          typeof value.quantity === "number" && value.quantity > 0
            ? value.quantity
            : 1,
        unit: value.unit,
        storageLocation: value.storageLocation,
        expiryDate: value.expiryDate,
        expirySource: value.expirySource,
        notes: value.notes,
      });
    });

    return () => subscription.unsubscribe();
  }, [form, hasHydrated, setDraft]);

  const handlePreset = (days: number) => {
    form.setValue("expiryDate", toIsoDate(addDays(new Date(), days)), {
      shouldValidate: true,
    });
    form.setValue("expirySource", ExpirySource.PRESET, {
      shouldValidate: true,
    });
  };

  const quantity = Number(form.watch("quantity")) || 1;
  const displayName = form.watch("displayName")?.trim() ?? "";
  const expiryDate = form.watch("expiryDate");
  const expirySource = form.watch("expirySource");
  const storageLocation = form.watch("storageLocation");
  const unit = form.watch("unit") || "개";
  const brand = form.watch("brand")?.trim() ?? "";
  const category = form.watch("category");
  const stepIndex = REGISTRATION_STEPS.findIndex((item) => item.key === step);
  const isLastStep = step === "expiry";
  const canGoNext =
    (step === "product" && Boolean(displayName)) ||
    (step === "storage" && Boolean(storageLocation) && quantity > 0) ||
    (step === "expiry" && Boolean(expiryDate));

  const recentTemplates = useMemo(
    () =>
      [...inventory]
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        )
        .slice(0, 4),
    [inventory],
  );

  const similarItems = useMemo(() => {
    const normalizedName = displayName.toLowerCase();

    return inventory.filter((item) => {
      if (item.status !== ItemStatus.ACTIVE) {
        return false;
      }

      return (
        Boolean(normalizedName) &&
        item.displayName.trim().toLowerCase() === normalizedName
      );
    });
  }, [displayName, inventory]);

  const applyRecentTemplate = (item: (typeof recentTemplates)[number]) => {
    form.setValue("productId", item.productId ?? undefined);
    form.setValue("displayName", item.displayName, { shouldValidate: true });
    form.setValue("brand", item.brand ?? "");
    form.setValue("category", item.category ?? undefined);
    form.setValue("unit", item.unit ?? "개");
    form.setValue("storageLocation", item.storageLocation, {
      shouldValidate: true,
    });
    setShowAdditionalInfo(Boolean(item.brand || item.category));
  };

  const goToPreviousStep = () => {
    if (stepIndex <= 0) {
      router.back();
      return;
    }

    const previousStep = REGISTRATION_STEPS[Math.max(0, stepIndex - 1)];
    setStep(previousStep.key);
  };

  const goToNextStep = () => {
    const nextStep =
      REGISTRATION_STEPS[Math.min(REGISTRATION_STEPS.length - 1, stepIndex + 1)];
    setStep(nextStep.key);
    setSuccessMessage(null);
    setSubmitErrorMessage(null);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      setSubmitErrorMessage(null);
      setSuccessMessage(null);
      const created = await mutation.mutateAsync({
        productId: values.productId,
        displayName: values.displayName,
        brand: values.brand,
        category: values.category,
        quantity: values.quantity,
        unit: values.unit,
        storageLocation: values.storageLocation,
        expiryDate: values.expiryDate,
        expirySource: values.expirySource,
        notes: values.notes,
      });

      clearPrefill();
      clearDraft();
      appliedPrefillKeyRef.current = "";

      setRegisteredSessionItems((current) => [
        {
          id: created.id,
          displayName: created.displayName,
          quantity: created.quantity,
          unit: created.unit,
          storageLocation: created.storageLocation,
          expiryDate: created.expiryDate,
        },
        ...current,
      ]);
      setSuccessMessage(`${created.displayName}을(를) 냉장고에 잘 넣어뒀어요.`);

      const nextDefaults = {
        ...createDefaultFormValues(),
        storageLocation: values.storageLocation,
        quantity: values.quantity,
        unit: values.unit,
      };

      form.reset(nextDefaults);
      setShowAdditionalInfo(false);
      setStep("product");
    } catch (error) {
      setSubmitErrorMessage(
        error instanceof Error
          ? error.message
          : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
      );
    }
  });

  const primaryCtaLabel = isLastStep
    ? "여기에 보관할까요?"
    : step === "product"
      ? "이 재료로 할게요"
      : "다음으로 갈게요";

  return (
    <Screen
      title="재료 넣기"
      subtitle="한 번에 하나씩, 차근차근 넣어볼게요."
    >
      <StepFlow
        steps={REGISTRATION_STEPS}
        currentIndex={stepIndex}
        onBack={goToPreviousStep}
        headerAccessory={
          <View style={styles.stepIcon}>
            {step === "product" ? (
              <Package color={colors.primary} size={spacing.md} strokeWidth={2.5} />
            ) : null}
            {step === "storage" ? (
              <MapPin color={colors.primary} size={spacing.md} strokeWidth={2.5} />
            ) : null}
            {step === "expiry" ? (
              <CalendarDays color={colors.primary} size={spacing.md} strokeWidth={2.5} />
            ) : null}
          </View>
        }
        footer={
          <Button
            icon={isLastStep ? CheckCircle2 : ChevronRight}
            iconPosition="right"
            onPress={isLastStep ? onSubmit : goToNextStep}
            loading={mutation.isPending}
            disabled={!canGoNext}
            fullWidth
          >
            {primaryCtaLabel}
          </Button>
        }
      >
        {successMessage && step === "product" ? (
          <View style={styles.successStrip}>
            <Mascot size="small" mood="happy" style={styles.successMascot} />
            <View style={styles.successCopy}>
              <Text style={styles.successTitle}>{successMessage}</Text>
              <Text style={styles.successDescription}>
                다음 재료 이름만 알려주시면 이어서 넣을 수 있어요.
              </Text>
            </View>
          </View>
        ) : null}

        {submitErrorMessage ? (
          <View style={styles.errorStrip}>
            <Text style={styles.errorTitle}>앗, 잠시 문제가 생겼어요</Text>
            <Text style={styles.errorDescription}>{submitErrorMessage}</Text>
          </View>
        ) : null}

        {step === "product" ? (
          <>
            {prefill?.displayName ? (
              <View style={styles.noticeCard}>
                <Text style={styles.noticeEyebrow}>불러온 재료</Text>
                <Text style={styles.noticeTitle}>{prefill.displayName}</Text>
                <Text style={styles.noticeDescription}>
                  {prefill.brand ? `${prefill.brand} · ` : ""}
                  이름만 한 번 확인해 주세요.
                </Text>
              </View>
            ) : null}

            {!prefill?.displayName && draft?.displayName ? (
              <View style={styles.softCard}>
                <Text style={styles.softTitle}>이어서 작성 중이에요</Text>
                <Text style={styles.softDescription}>
                  아까 적어두신 내용을 그대로 보여드릴게요.
                </Text>
              </View>
            ) : null}

            <View style={styles.formCard}>
              <FormField
                control={form.control}
                name="displayName"
                label="재료 이름"
                placeholder="예: 서울우유 1L"
              />
            </View>

            {similarItems.length ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>
                  집에 이미 {similarItems.length}개 있어요
                </Text>
                <Text style={styles.warningDescription}>
                  {similarItems
                    .slice(0, 2)
                    .map(
                      (item) =>
                        `${storageLocationLabels[item.storageLocation]} · ${item.quantity}${item.unit ?? "개"}`,
                    )
                    .join(" / ")}
                </Text>
              </View>
            ) : null}

            {recentTemplates.length ? (
              <View style={styles.card}>
                <SectionHeader
                  title="예전에 넣었던 재료"
                  description="누르면 이름을 바로 채워 드려요."
                />
                <View style={styles.templateList}>
                  {recentTemplates.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => applyRecentTemplate(item)}
                      style={({ pressed }) => [
                        styles.templateCard,
                        pressed && styles.templateCardPressed,
                      ]}
                    >
                      <Text style={styles.templateName}>{item.displayName}</Text>
                      <Text style={styles.templateMeta}>
                        {storageLocationLabels[item.storageLocation]} ·{" "}
                        {item.unit ?? "개"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <EmptyState
                mood="empty"
                title="아직 불러올 재료가 없어요"
                description="한 번 넣어 두면, 다음부터는 여기서 바로 불러올 수 있어요."
              />
            )}
          </>
        ) : null}

        {step === "storage" ? (
          <>
            <View style={styles.card}>
              <SectionHeader
                title="어디에 두나요?"
                description="보관 위치를 하나만 골라 주세요."
              />
              <View style={styles.pillRow}>
                {STORAGE_LOCATION_ORDER.map((location) => (
                  <Pill
                    key={location}
                    label={storageLocationLabels[location]}
                    icon={MapPin}
                    selected={storageLocation === location}
                    onPress={() =>
                      form.setValue("storageLocation", location, {
                        shouldValidate: true,
                      })
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
              <View style={styles.inlineMeta}>
                <Text style={styles.inlineMetaLabel}>지금 선택</Text>
                <Text style={styles.inlineMetaValue}>
                  {storageLocationLabels[storageLocation]} · {quantity}
                  {unit}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => setShowAdditionalInfo(true)}
              style={({ pressed }) => [
                styles.extraTrigger,
                pressed && styles.templateCardPressed,
              ]}
            >
              <View style={styles.extraTriggerCopy}>
                <Text style={styles.extraTriggerTitle}>브랜드·메모도 적을까요?</Text>
                <Text style={styles.extraTriggerDescription}>
                  필요할 때만 적어도 괜찮아요.
                </Text>
              </View>
              <Text style={styles.extraTriggerAction}>열기</Text>
            </Pressable>
          </>
        ) : null}

        {step === "expiry" ? (
          <>
            <View style={styles.card}>
              <SectionHeader
                title="언제까지인가요?"
                description="자주 쓰는 기간을 먼저 골라볼 수 있어요."
              />
              <View style={styles.pillRow}>
                {QUICK_EXPIRY_OPTIONS.map((option) => {
                  const presetDate = toIsoDate(addDays(new Date(), option.days));

                  return (
                    <Pill
                      key={option.days}
                      label={option.label}
                      icon={CalendarDays}
                      selected={
                        expiryDate === presetDate &&
                        expirySource === ExpirySource.PRESET
                      }
                      onPress={() => handlePreset(option.days)}
                    />
                  );
                })}
              </View>
            </View>

            <View style={styles.formCard}>
              <DatePickerField
                label="직접 고르기"
                value={expiryDate}
                onChange={(nextDate) => {
                  form.setValue("expiryDate", nextDate, { shouldValidate: true });
                  form.setValue("expirySource", ExpirySource.MANUAL, {
                    shouldValidate: true,
                  });
                }}
                error={form.formState.errors.expiryDate?.message}
              />
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <CheckCircle2
                  color={colors.success}
                  size={spacing.md}
                  strokeWidth={2.5}
                />
                <Text style={styles.summaryTitle}>이렇게 넣을게요</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>재료</Text>
                <Text style={styles.summaryValue}>
                  {displayName || "아직 없어요"}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>보관</Text>
                <Text style={styles.summaryValue}>
                  {storageLocationLabels[storageLocation]} · {quantity}
                  {unit}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>유통기한</Text>
                <Text style={styles.summaryValue}>
                  {expiryDate ? formatDateKorean(expiryDate) : "아직 고르지 않았어요"}
                </Text>
              </View>
              {brand ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>브랜드</Text>
                  <Text style={styles.summaryValue}>{brand}</Text>
                </View>
              ) : null}
              {category ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>카테고리</Text>
                  <Text style={styles.summaryValue}>
                    {productCategoryLabels[category]}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {registeredSessionItems.length && step === "product" ? (
          <View style={styles.sessionCard}>
            <View style={styles.sessionHeader}>
              <View style={styles.sessionCopy}>
                <Text style={styles.sessionEyebrow}>오늘 넣은 재료</Text>
                <Text style={styles.sessionTitle}>
                  {registeredSessionItems.length}개 넣어뒀어요
                </Text>
              </View>
              <Button
                size="small"
                icon={ChefHat}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/recommendations",
                    params: { autoGenerateAt: Date.now().toString() },
                  })
                }
              >
                요리 추천 받기
              </Button>
            </View>
            <View style={styles.sessionList}>
              {registeredSessionItems.slice(0, 3).map((item) => (
                <View key={item.id} style={styles.sessionRow}>
                  <Text style={styles.sessionName}>{item.displayName}</Text>
                  <Text style={styles.sessionMeta}>
                    {storageLocationLabels[item.storageLocation]} · {item.quantity}
                    {item.unit ?? "개"} · {formatDateKorean(item.expiryDate)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </StepFlow>

      <BottomSheet
        visible={showAdditionalInfo && step === "storage"}
        onClose={() => setShowAdditionalInfo(false)}
        mascotMood="idle"
        title="조금만 더 알려주세요"
        description="브랜드, 카테고리, 단위, 메모는 필요할 때만 적어도 돼요."
        footer={
          <Button onPress={() => setShowAdditionalInfo(false)} fullWidth>
            여기까지 할게요
          </Button>
        }
      >
        <FormField
          control={form.control}
          name="brand"
          label="브랜드"
          placeholder="예: 서울우유"
        />
        <FormField
          control={form.control}
          name="unit"
          label="단위"
          placeholder="개 / 통 / 봉"
        />
        <View style={styles.extraSection}>
          <Text style={styles.extraSectionTitle}>카테고리</Text>
          <View style={styles.pillRow}>
            {productCategoryOptions.map((option) => (
              <Pill
                key={option.value}
                label={option.label}
                selected={category === option.value}
                onPress={() =>
                  form.setValue("category", option.value as ProductCategory, {
                    shouldValidate: true,
                  })
                }
              />
            ))}
          </View>
          {category ? (
            <Text style={styles.inlineMetaValue}>
              지금 선택: {productCategoryLabels[category]}
            </Text>
          ) : null}
        </View>
        <FormField
          control={form.control}
          name="notes"
          label="메모"
          placeholder="기억해 둘 말이 있으면 적어 주세요"
          multiline
        />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepIcon: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  successStrip: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  successMascot: {
    flexShrink: 0,
  },
  successCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  successTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  successDescription: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.subtext,
  },
  errorStrip: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  errorTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.title.fontWeight,
    color: colors.danger,
  },
  errorDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.text,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  noticeCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  noticeEyebrow: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontWeight: typography.label.fontWeight,
    color: colors.primary,
  },
  noticeTitle: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  noticeDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.subtext,
  },
  softCard: {
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  softTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  softDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.subtext,
  },
  warningCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  warningTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.warning,
  },
  warningDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.text,
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
  inlineMeta: {
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  inlineMetaLabel: {
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
    color: colors.subtext,
  },
  inlineMetaValue: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.text,
  },
  templateList: {
    gap: spacing.sm,
  },
  templateCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: spacing.xxs,
    minHeight: touchTarget.min,
    justifyContent: "center",
  },
  templateCardPressed: {
    backgroundColor: colors.surfacePressed,
  },
  templateName: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  templateMeta: {
    fontSize: typography.label.fontSize,
    color: colors.subtext,
  },
  extraTrigger: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: touchTarget.min,
  },
  extraTriggerCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  extraTriggerTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
    color: colors.text,
  },
  extraTriggerDescription: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.subtext,
  },
  extraTriggerAction: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.primary,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  summaryTitle: {
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  summaryLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: typography.bodyStrong.fontWeight,
    color: colors.subtext,
  },
  summaryValue: {
    flex: 1,
    textAlign: "right",
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  extraSection: {
    gap: spacing.sm,
  },
  extraSectionTitle: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
    color: colors.text,
  },
  sessionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  sessionCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  sessionEyebrow: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontWeight: typography.label.fontWeight,
    color: colors.primary,
  },
  sessionTitle: {
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  sessionList: {
    gap: spacing.sm,
  },
  sessionRow: {
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  sessionName: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  sessionMeta: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.subtext,
  },
});
