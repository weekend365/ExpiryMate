import {
  DEFAULT_INVENTORY_FORM,
  ExpirySource,
  ItemStatus,
  ProductCategory,
  StorageLocation,
  expiryPresetOptions,
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
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  MapPin,
  Package,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../src/components/Button";
import { DatePickerField } from "../src/components/DatePickerField";
import { FormField } from "../src/components/FormField";
import { Pill } from "../src/components/Pill";
import { QuantityStepper } from "../src/components/QuantityStepper";
import { Screen } from "../src/components/Screen";
import { useInventoryList } from "../src/features/inventory/use-inventory-list";
import { useSaveInventoryItem } from "../src/features/registration/use-save-inventory-item";
import { addDays, toIsoDate } from "@expirymate/shared";
import { colors, spacing } from "../src/shared/theme";
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

type RegistrationStep = "product" | "expiry" | "storage" | "review";

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
    description: "보관 위치와 수량만 확인하면 기본 등록 정보는 끝나요.",
  },
  {
    key: "review",
    label: "확인",
    title: "등록 전 마지막 확인",
    description: "필요하면 브랜드, 카테고리, 메모를 추가할 수 있어요.",
  },
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
    expiryDate: draft?.expiryDate ?? DEFAULT_INVENTORY_FORM.expiryDate,
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
  const storageLocation = form.watch("storageLocation");
  const unit = form.watch("unit") || "개";
  const brand = form.watch("brand")?.trim() ?? "";
  const category = form.watch("category");
  const stepIndex = REGISTRATION_STEPS.findIndex((item) => item.key === step);
  const activeStep = REGISTRATION_STEPS[stepIndex];
  const isLastStep = step === "review";
  const canGoNext =
    (step === "product" && Boolean(displayName)) ||
    (step === "expiry" && Boolean(expiryDate)) ||
    (step === "storage" && Boolean(storageLocation) && quantity > 0) ||
    step === "review";

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
    const previousStep = REGISTRATION_STEPS[Math.max(0, stepIndex - 1)];
    setStep(previousStep.key);
  };

  const goToNextStep = () => {
    const nextStep = REGISTRATION_STEPS[Math.min(REGISTRATION_STEPS.length - 1, stepIndex + 1)];
    setStep(nextStep.key);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
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

      const nextDefaults = buildInitialValues(null, {
        storageLocation: values.storageLocation,
        unit: values.unit,
      });

      Alert.alert(
        "등록했어요",
        `${created.displayName}을(를) 재고에 추가했어요.`,
        [
          {
            text: "하나 더 등록",
            onPress: () => {
              form.reset(nextDefaults);
              setShowAdditionalInfo(false);
              setStep("product");
            },
          },
          {
            text: "재고 보기",
            onPress: () => {
              form.reset(nextDefaults);
              setStep("product");
              router.replace("/(tabs)/inventory");
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        "저장에 실패했어요",
        error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
      );
    }
  });

  return (
    <Screen
      title="등록하기"
      subtitle={`${stepIndex + 1}/4 · ${activeStep.label} 정보를 입력해요.`}
    >
      <View style={styles.progressCard}>
        <View style={styles.progressTrack}>
          {REGISTRATION_STEPS.map((item, index) => {
            const isActive = item.key === step;
            const isCompleted = index < stepIndex;

            return (
              <View
                key={item.key}
                style={[
                  styles.progressSegment,
                  (isActive || isCompleted) && styles.progressSegmentActive,
                ]}
              />
            );
          })}
        </View>
        <View style={styles.stepHeader}>
          <View style={styles.stepIcon}>
            {step === "product" ? (
              <Package color={colors.primary} size={22} strokeWidth={2.5} />
            ) : null}
            {step === "expiry" ? (
              <CalendarDays color={colors.primary} size={22} strokeWidth={2.5} />
            ) : null}
            {step === "storage" ? (
              <MapPin color={colors.primary} size={22} strokeWidth={2.5} />
            ) : null}
            {step === "review" ? (
              <ClipboardCheck color={colors.primary} size={22} strokeWidth={2.5} />
            ) : null}
          </View>
          <View style={styles.stepCopy}>
            <Text style={styles.stepTitle}>{activeStep.title}</Text>
            <Text style={styles.stepDescription}>{activeStep.description}</Text>
          </View>
        </View>
      </View>

      {step === "product" ? (
        <>
          {prefill?.displayName ? (
            <View style={styles.prefillCard}>
              <View style={styles.cardIcon}>
                <Package color={colors.primary} size={18} strokeWidth={2.5} />
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
              <Text style={styles.sectionTitle}>최근 등록 재료 다시 쓰기</Text>
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
          ) : null}
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
            <Text style={styles.sectionTitle}>빠른 유통기한 선택</Text>
            <View style={styles.pillRow}>
              {expiryPresetOptions.map((option) => {
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
            </View>
          </View>
        </>
      ) : null}

      {step === "storage" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>저장 위치</Text>
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
        </>
      ) : null}

      {step === "review" ? (
        <>
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
              <CheckCircle2 color={colors.success} size={22} strokeWidth={2.5} />
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
              onPress={() => setShowAdditionalInfo((current) => !current)}
              style={({ pressed }) => [
                styles.toggleRow,
                pressed && styles.templateCardPressed,
              ]}
            >
              <View style={styles.toggleCopy}>
                <Text style={styles.sectionTitle}>추가 정보</Text>
                <Text style={styles.sectionDescription}>
                  브랜드, 카테고리, 단위, 메모는 필요할 때만 입력하세요.
                </Text>
              </View>
              <Text style={styles.toggleAction}>
                {showAdditionalInfo ? "접기" : "열기"}
              </Text>
            </Pressable>

            {showAdditionalInfo ? (
              <View style={styles.extraFields}>
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
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      <View style={styles.ctaBar}>
        {stepIndex > 0 ? (
          <Button
            variant="secondary"
            icon={ChevronLeft}
            onPress={goToPreviousStep}
            style={styles.ctaButton}
          >
            이전
          </Button>
        ) : null}
        <Button
          icon={isLastStep ? CheckCircle2 : ChevronRight}
          iconPosition="right"
          onPress={isLastStep ? onSubmit : goToNextStep}
          loading={mutation.isPending}
          disabled={!canGoNext}
          style={styles.ctaButton}
        >
          {isLastStep ? "등록하기" : "다음"}
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  progressTrack: {
    flexDirection: "row",
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.mutedSurface,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
  },
  stepHeader: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  stepIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCopy: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "800",
    color: colors.text,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.subtext,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  prefillCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  prefillEyebrow: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: colors.primary,
  },
  prefillTitle: {
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "800",
    color: colors.text,
  },
  prefillDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.subtext,
  },
  draftCard: {
    backgroundColor: colors.mutedSurface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  draftTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  draftDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.subtext,
  },
  warningCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.warning,
  },
  warningDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: colors.text,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.subtext,
    marginTop: 4,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  inlineMeta: {
    borderRadius: 12,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: 4,
  },
  inlineMetaLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.subtext,
  },
  inlineMetaValue: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  templateList: {
    gap: spacing.sm,
  },
  templateCard: {
    borderRadius: 12,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: 4,
  },
  templateCardPressed: {
    backgroundColor: colors.surfacePressed,
  },
  templateName: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  templateMeta: {
    fontSize: 13,
    color: colors.subtext,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
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
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: colors.text,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  summaryLabel: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: colors.subtext,
  },
  summaryValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
    color: colors.text,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  toggleCopy: {
    flex: 1,
  },
  toggleAction: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primary,
  },
  extraFields: {
    gap: spacing.md,
  },
  extraSection: {
    gap: spacing.sm,
  },
  extraSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  ctaBar: {
    flexDirection: "row",
    gap: spacing.md,
  },
  ctaButton: {
    flex: 1,
  },
});
