import {
  DEFAULT_INVENTORY_FORM,
  ExpirySource,
  ItemStatus,
  ProductCategory,
  StorageLocation,
  formatDateKorean,
  inventoryFormSchema,
  productCategoryLabels,
  productCategoryOptions,
  storageLocationLabels,
} from "@expirymate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import {
  CalendarDays,
  ChefHat,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Package,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../src/components/Button";
import { BottomSheet } from "../src/components/BottomSheet";
import { DatePickerField } from "../src/components/DatePickerField";
import { EmptyState } from "../src/components/EmptyState";
import { FormField } from "../src/components/FormField";
import { Pill } from "../src/components/Pill";
import { QuantityStepper } from "../src/components/QuantityStepper";
import { Screen } from "../src/components/Screen";
import { SectionHeader } from "../src/components/SectionHeader";
import { StepFlow } from "../src/components/StepFlow";
import { useInventoryList } from "../src/features/inventory/use-inventory-list";
import { useSaveInventoryItem } from "../src/features/registration/use-save-inventory-item";
import { addDays, toIsoDate } from "@expirymate/shared";
import { colors, radius, spacing, typography } from "../src/shared/theme";
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

type RegistrationStep = "product" | "expiry" | "storage";

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
    description: "재료명을 확인하고, 자주 등록한 재료는 바로 불러올 수 있어요.",
  },
  {
    key: "expiry",
    label: "기한",
    title: "유통기한을 선택하세요",
    description: "자주 쓰는 기간은 빠른 선택으로 바로 입력할 수 있어요.",
  },
  {
    key: "storage",
    label: "보관",
    title: "어디에 몇 개 있나요?",
    description: "보관 위치와 수량을 정하면 바로 등록할 수 있어요.",
  },
];

const QUICK_EXPIRY_OPTIONS = [
  { label: "오늘", days: 0 },
  { label: "내일", days: 1 },
  { label: "3일", days: 3 },
  { label: "7일", days: 7 },
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
    ? [
        prefill.productId ?? "",
        prefill.displayName ?? "",
      ].join(":")
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
  const isLastStep = step === "storage";
  const canGoNext =
    (step === "product" && Boolean(displayName)) ||
    (step === "expiry" && Boolean(expiryDate)) ||
    (step === "storage" && Boolean(storageLocation) && quantity > 0);

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
    setShowAdditionalInfo(true);
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
    const nextStep = REGISTRATION_STEPS[Math.min(REGISTRATION_STEPS.length - 1, stepIndex + 1)];
    setStep(nextStep.key);
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
      setSuccessMessage(`${created.displayName}을(를) 등록했어요.`);

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
        error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
      );
    }
  });

  return (
    <Screen
      title="등록하기"
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
            {step === "expiry" ? (
              <CalendarDays color={colors.primary} size={spacing.md} strokeWidth={2.5} />
            ) : null}
            {step === "storage" ? (
              <MapPin color={colors.primary} size={spacing.md} strokeWidth={2.5} />
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
            {isLastStep ? "냉장고에 넣을게요" : "다음으로"}
          </Button>
        }
      >
        {successMessage ? (
          <View style={styles.successStrip}>
            <CheckCircle2 color={colors.success} size={spacing.md} strokeWidth={2.5} />
            <View style={styles.successCopy}>
              <Text style={styles.successTitle}>{successMessage}</Text>
              <Text style={styles.successDescription}>
                다음 재료 이름과 유통기한만 입력하면 이어서 등록할 수 있어요.
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
              <View style={styles.prefillCard}>
                <View style={styles.cardIcon}>
                  <Package color={colors.primary} size={spacing.sm} strokeWidth={2.5} />
                </View>
                <Text style={styles.prefillEyebrow}>불러온 재료 정보</Text>
                <Text style={styles.prefillTitle}>{prefill.displayName}</Text>
                <Text style={styles.prefillDescription}>
                  {prefill.brand ? `${prefill.brand} · ` : ""}
                  재료 정보가 자동으로 채워졌어요. 이름만 확인하면 됩니다.
                </Text>
              </View>
            ) : null}

            {!prefill?.displayName && draft?.displayName ? (
              <View style={styles.draftCard}>
                <Text style={styles.draftTitle}>이전에 입력하던 내용을 이어서 보여주고 있어요</Text>
                <Text style={styles.draftDescription}>
                  저장하기 전까지 입력 내용이 자동으로 보관됩니다.
                </Text>
              </View>
            ) : null}

            {similarItems.length ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>집에 이미 {similarItems.length}개 있어요</Text>
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

            <View style={styles.formCard}>
              <FormField
                control={form.control}
                name="displayName"
                label="재료명"
                placeholder="예: 서울우유 1L"
              />
            </View>

            {recentTemplates.length ? (
              <View style={styles.card}>
                <SectionHeader
                  title="최근 등록 재료 다시 쓰기"
                  description="예전에 넣었던 재료를 불러와 빠르게 채울 수 있어요."
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
                        {storageLocationLabels[item.storageLocation]} · {item.unit ?? "개"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <EmptyState
                icon={Package}
                title="아직 불러올 재료가 없어요"
                description="한 번 등록해 두면, 다음부터는 여기서 바로 불러올 수 있어요."
              />
            )}
          </>
        ) : null}

        {step === "expiry" ? (
          <>
            <View style={styles.formCard}>
              <DatePickerField
                label="유통기한"
                value={expiryDate}
                onChange={(nextDate) => {
                  form.setValue("expiryDate", nextDate, { shouldValidate: true });
                  form.setValue("expirySource", ExpirySource.MANUAL, {
                    shouldValidate: true,
                  });
                }}
                error={form.formState.errors.expiryDate?.message}
              />
              <View style={styles.inlineMeta}>
                <Text style={styles.inlineMetaLabel}>선택된 날짜</Text>
                <Text style={styles.inlineMetaValue}>
                  {expiryDate ? formatDateKorean(expiryDate) : "아직 선택하지 않았어요"}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader
                title="빠른 유통기한 선택"
                description="자주 쓰는 기간은 한 번에 골라볼 수 있어요."
              />
              <View style={styles.pillRow}>
                {QUICK_EXPIRY_OPTIONS.map((option) => {
                  const presetDate = toIsoDate(addDays(new Date(), option.days));

                  return (
                    <Pill
                      key={option.days}
                      label={option.label}
                      icon={CalendarDays}
                      selected={expiryDate === presetDate}
                      onPress={() => handlePreset(option.days)}
                    />
                  );
                })}
                <Pill
                  label="직접 선택"
                  icon={CalendarDays}
                  selected={expirySource === ExpirySource.MANUAL}
                  onPress={() =>
                    form.setValue("expirySource", ExpirySource.MANUAL, {
                      shouldValidate: true,
                    })
                  }
                />
              </View>
            </View>
          </>
        ) : null}

        {step === "storage" ? (
          <>
            <View style={styles.card}>
              <SectionHeader title="저장 위치" description="어디에 두고 계신가요?" />
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
                label="수량"
                value={quantity}
                onChange={(nextQuantity) =>
                  form.setValue("quantity", nextQuantity, { shouldValidate: true })
                }
                error={form.formState.errors.quantity?.message}
              />
              <View style={styles.inlineMeta}>
                <Text style={styles.inlineMetaLabel}>현재 선택</Text>
                <Text style={styles.inlineMetaValue}>
                  {storageLocationLabels[storageLocation]} · {quantity}
                  {unit}
                </Text>
              </View>
            </View>

            {similarItems.length ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>집에 이미 {similarItems.length}개 있어요</Text>
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

            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <CheckCircle2 color={colors.success} size={spacing.md} strokeWidth={2.5} />
                <Text style={styles.summaryTitle}>이대로 등록할게요</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>재료</Text>
                <Text style={styles.summaryValue}>{displayName || "입력 필요"}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>유통기한</Text>
                <Text style={styles.summaryValue}>
                  {expiryDate ? formatDateKorean(expiryDate) : "입력 필요"}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>보관</Text>
                <Text style={styles.summaryValue}>
                  {storageLocationLabels[storageLocation]} · {quantity}
                  {unit}
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
                  <Text style={styles.summaryValue}>{productCategoryLabels[category]}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <Pressable
                onPress={() => setShowAdditionalInfo(true)}
                style={({ pressed }) => [
                  styles.toggleRow,
                  pressed && styles.templateCardPressed,
                ]}
              >
                <View style={styles.toggleCopy}>
                  <SectionHeader
                    title="추가 정보"
                    description="브랜드, 카테고리, 단위, 메모는 필요할 때만 입력하세요."
                  />
                </View>
                <Text style={styles.toggleAction}>열기</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {registeredSessionItems.length ? (
          <View style={styles.sessionCard}>
            <View style={styles.sessionHeader}>
              <View>
                <Text style={styles.sessionEyebrow}>오늘 등록한 재료</Text>
                <Text style={styles.sessionTitle}>
                  {registeredSessionItems.length}개 등록됨
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
                추천 받기
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
              현재 선택: {productCategoryLabels[category]}
            </Text>
          ) : null}
        </View>
        <FormField
          control={form.control}
          name="notes"
          label="메모"
          placeholder="추가로 기록할 내용"
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
    alignItems: "flex-start",
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
  prefillCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardIcon: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  prefillEyebrow: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontWeight: typography.label.fontWeight,
    color: colors.primary,
  },
  prefillTitle: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  prefillDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.subtext,
  },
  draftCard: {
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  draftTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  draftDescription: {
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
    minHeight: spacing.xxl,
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: spacing.xxl,
  },
  toggleCopy: {
    flex: 1,
  },
  toggleAction: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.primary,
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
