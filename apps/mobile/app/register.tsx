import {
  DEFAULT_INVENTORY_FORM,
  ExpirySource,
  ItemStatus,
  ProductCategory,
  addDays,
  fieldLimits,
  formatDateKorean,
  groupInventoryItems,
  inventoryFormSchema,
  productCategoryLabels,
  productCategoryOptions,
  toIsoDate,
} from "@expirymate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { router, useNavigation } from "expo-router";
import {
  Barcode,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  MapPin,
  Plus,
} from "lucide-react-native";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Alert,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AppTextInput } from "../src/components/AppTextInput";
import { BottomSheet } from "../src/components/BottomSheet";
import { HeaderBackButton } from "../src/components/HeaderBackButton";
import { Button } from "../src/components/Button";
import { DatePickerField } from "../src/components/DatePickerField";
import { FormField } from "../src/components/FormField";
import { FeedbackBanner } from "../src/components/FeedbackBanner";
import { MascotSpeechBubble } from "../src/components/MascotSpeechBubble";
import { Pill } from "../src/components/Pill";
import { QuantityStepper } from "../src/components/QuantityStepper";
import { Screen } from "../src/components/Screen";
import { StepFlow } from "../src/components/StepFlow";
import { useInventoryList } from "../src/features/inventory/use-inventory-list";
import { useSaveInventoryItem } from "../src/features/registration/use-save-inventory-item";
import { getSettingsErrorMessage } from "../src/features/settings/settings-format";
import { useStorageLocations } from "../src/features/settings/use-storage-locations";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../src/shared/theme";
import { useResponsiveLayout } from "../src/shared/responsive-layout";
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
  storageLocation: string;
  expiryDate: string;
  expirySource: ExpirySource;
  notes: string;
};

/** 1) 재료명 → 2) 보관/수량 → 3) 기한 선택 → 4) 확인 → done */
type RegistrationStep = "product" | "storage" | "expiry" | "confirm" | "done";

type InputRegistrationStep = Exclude<RegistrationStep, "done">;

type RegisteredSessionItem = {
  id: string;
  displayName: string;
  quantity: number;
  unit?: string | null;
  storageLocation: string;
  expiryDate: string;
};

const REGISTRATION_STEPS: Array<{
  key: InputRegistrationStep;
  label: string;
  title: string;
  guideMessage: string;
}> = [
  {
    key: "product",
    label: "재료",
    title: "어떤 재료인가요?",
    guideMessage: "예전에 넣었다면 아래 이름으로 바로 불러올 수 있어요.",
  },
  {
    key: "storage",
    label: "보관",
    title: "어디에, 몇 개 두나요?",
    guideMessage: "브랜드·메모는 필요할 때만 적어도 괜찮아요.",
  },
  {
    key: "expiry",
    label: "기한",
    title: "언제까지인가요?",
    guideMessage: "빠른 기간으로 바꾸거나, 달력에서 골라 주세요.",
  },
  {
    key: "confirm",
    label: "확인",
    title: "이렇게 넣을까요?",
    guideMessage: "맞으면 아래에 보관해 주세요. 고치고 싶으면 뒤로 가면 돼요.",
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
  prefill ? [prefill.productId ?? "", prefill.displayName ?? ""].join(":") : "";

export default function RegisterScreen() {
  const { shouldStack, shouldStackDense } = useResponsiveLayout();
  const navigation = useNavigation();
  const hasHydrated = useRegistrationStore((state) => state.hasHydrated);
  const prefill = useRegistrationStore((state) => state.prefill);
  const draft = useRegistrationStore((state) => state.draft);
  const rewardNotice = useRegistrationStore((state) => state.rewardNotice);
  const setDraft = useRegistrationStore((state) => state.setDraft);
  const setRewardNotice = useRegistrationStore((state) => state.setRewardNotice);
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);
  const clearDraft = useRegistrationStore((state) => state.clearDraft);
  const mutation = useSaveInventoryItem();
  const { data: inventory = [] } = useInventoryList();
  const [step, setStep] = useState<RegistrationStep>("product");
  // Only open when the user taps — prefill must not auto-pop the sheet on storage step.
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [addLocationVisible, setAddLocationVisible] = useState(false);
  const [newLocationLabel, setNewLocationLabel] = useState("");
  const { selectableOptions, resolveLabel, createMutation } =
    useStorageLocations();
  const [registeredSessionItems, setRegisteredSessionItems] = useState<
    RegisteredSessionItem[]
  >([]);
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
  const isInputStep = step !== "done";
  const stepIndex = isInputStep
    ? REGISTRATION_STEPS.findIndex((item) => item.key === step)
    : -1;
  const isLastStep = step === "confirm";
  const canGoNext =
    (step === "product" && Boolean(displayName)) ||
    (step === "storage" && Boolean(storageLocation) && quantity > 0) ||
    (step === "expiry" && Boolean(expiryDate)) ||
    (step === "confirm" &&
      Boolean(displayName && storageLocation && expiryDate) &&
      quantity > 0);
  const latestRegisteredItem = registeredSessionItems[0] ?? null;

  useLayoutEffect(() => {
    if (step !== "done") {
      navigation.setOptions({
        title: "재료 넣기",
        headerLeft: () =>
          navigation.canGoBack() ? (
            <HeaderBackButton onPress={() => navigation.goBack()} />
          ) : undefined,
      });
      return;
    }

    navigation.setOptions({
      title: "잘 넣어뒀어요",
      headerLeft: () => (
        <HeaderBackButton onPress={() => router.replace("/(tabs)/home")} />
      ),
    });
  }, [navigation, step]);

  useEffect(() => {
    if (step !== "done") {
      return undefined;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        router.replace("/(tabs)/home");
        return true;
      },
    );

    return () => subscription.remove();
  }, [step]);

  const recentTemplates = useMemo(() => {
    // Same product identity as the inventory list: productId, or name + brand.
    return groupInventoryItems(inventory)
      .map((group) =>
        group.items.reduce((latest, item) =>
          new Date(item.createdAt).getTime() >
          new Date(latest.createdAt).getTime()
            ? item
            : latest,
        ),
      )
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      )
      .slice(0, 4);
  }, [inventory]);

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
      REGISTRATION_STEPS[
        Math.min(REGISTRATION_STEPS.length - 1, stepIndex + 1)
      ];
    setStep(nextStep.key);
    setSubmitErrorMessage(null);
  };

  const finishRegistration = () => {
    router.replace("/(tabs)/home");
  };

  const continueWithBarcode = () => {
    clearPrefill();
    router.replace("/scanner");
  };

  const continueWithManual = () => {
    setSubmitErrorMessage(null);
    setStep("product");
  };

  const openRecipeRecommendations = () => {
    router.replace({
      pathname: "/(tabs)/recommendations",
      params: { autoGenerateAt: Date.now().toString() },
    });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      setSubmitErrorMessage(null);
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

      const nextDefaults = {
        ...createDefaultFormValues(),
        storageLocation: values.storageLocation,
        quantity: values.quantity,
        unit: values.unit,
      };

      form.reset(nextDefaults);
      setShowAdditionalInfo(false);
      setStep("done");
    } catch (error) {
      setSubmitErrorMessage(
        error instanceof Error
          ? error.message
          : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
      );
    }
  });

  const primaryCtaLabel =
    step === "product"
      ? "이 재료로 할게요"
      : step === "storage"
        ? "여기에 둘게요"
        : step === "expiry"
          ? "이 날짜로 할게요"
          : "여기에 보관할까요?";

  if (step === "done") {
    return (
      <Screen
        contentWidth="form"
        title="잘 넣어뒀어요"
        subtitle="여기까지 해도 충분해요."
        footer={
          <View style={styles.doneFooter}>
            <Button
              icon={CheckCircle2}
              iconPosition="right"
              onPress={finishRegistration}
              fullWidth
            >
              그만 추가할래요
            </Button>
            <Button
              variant="secondary"
              icon={Barcode}
              onPress={continueWithBarcode}
              fullWidth
            >
              바코드로 더 넣을게요
            </Button>
            <Pressable
              onPress={continueWithManual}
              accessibilityRole="button"
              accessibilityLabel="손으로 더 넣을게요"
              hitSlop={spacing.xs}
              style={({ pressed }) => [
                styles.doneTextLink,
                pressed && styles.doneTextLinkPressed,
              ]}
            >
              <Text style={styles.doneTextLinkLabel}>손으로 더 넣을게요</Text>
            </Pressable>
          </View>
        }
      >
        <View style={styles.doneHero}>
          <Text style={styles.doneTitle}>
            {latestRegisteredItem
              ? `${latestRegisteredItem.displayName}을(를) 냉장고에 잘 넣어뒀어요`
              : "냉장고에 잘 넣어뒀어요"}
          </Text>
          <MascotSpeechBubble
            message="더 넣고 싶으면 아래에서 이어갈 수 있어요."
            mood="happy"
            size="medium"
            style={styles.doneBubble}
          />
        </View>

        {registeredSessionItems.length ? (
          <View style={styles.sessionCard}>
            <View
              style={[
                styles.sessionHeader,
                shouldStack && styles.sessionHeaderStacked,
              ]}
            >
              <View style={styles.sessionCopy}>
                <Text style={styles.sessionEyebrow}>오늘 넣은 재료</Text>
                <Text style={styles.sessionTitle}>
                  {registeredSessionItems.length}개 넣어뒀어요
                </Text>
              </View>
            </View>
            <View style={styles.sessionList}>
              {registeredSessionItems.slice(0, 3).map((item) => (
                <View key={item.id} style={styles.sessionRow}>
                  <Text style={styles.sessionName}>{item.displayName}</Text>
                  <Text style={styles.sessionMeta}>
                    {resolveLabel(item.storageLocation)} · {item.quantity}
                    {item.unit ?? "개"} · {formatDateKorean(item.expiryDate)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {registeredSessionItems.length >= 2 ? (
          <Pressable
            onPress={openRecipeRecommendations}
            accessibilityRole="button"
            accessibilityLabel="요리 추천 받아볼까요?"
            style={({ pressed }) => [
              styles.recipeHint,
              shouldStack && styles.recipeHintStacked,
              pressed && styles.templateCardPressed,
            ]}
          >
            <ChefHat
              color={colors.primary}
              size={spacing.md}
              strokeWidth={2.4}
            />
            <Text style={styles.recipeHintText}>요리 추천 받아볼까요?</Text>
          </Pressable>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      contentWidth="form"
      testID="register-screen"
      footer={
        <Button
          icon={isLastStep ? CheckCircle2 : ChevronRight}
          iconPosition="right"
          onPress={isLastStep ? onSubmit : goToNextStep}
          loading={mutation.isPending}
          disabled={!canGoNext}
          fullWidth
          testID="register-next-button"
        >
          {primaryCtaLabel}
        </Button>
      }
    >
      <StepFlow
        steps={REGISTRATION_STEPS}
        currentIndex={Math.max(stepIndex, 0)}
        onBack={goToPreviousStep}
        guideMessage={REGISTRATION_STEPS[Math.max(stepIndex, 0)]?.guideMessage}
        guideMood="speak"
      >
        {rewardNotice ? (
          <FeedbackBanner
            tone={rewardNotice.granted ? "success" : "info"}
            title={
              rewardNotice.granted
                ? `바코드 추천권 +${rewardNotice.creditsGranted}`
                : getBarcodeRewardNoticeTitle(rewardNotice.reason)
            }
            description={
              rewardNotice.granted
                ? `현재 ${rewardNotice.balance}/${rewardNotice.balanceLimit}회 보유하고 있어요.`
                : "상품은 정상적으로 등록했어요."
            }
            actionLabel="확인"
            onAction={() => setRewardNotice(null)}
            showMascot={false}
          />
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
                {prefill.brand ? (
                  <Text style={styles.noticeDescription}>{prefill.brand}</Text>
                ) : null}
              </View>
            ) : null}

            <View
              style={[styles.formCard, shouldStack && styles.formCardCompact]}
            >
              <FormField
                control={form.control}
                name="displayName"
                label="재료 이름"
                placeholder="예: 서울우유 1L"
              />
              {recentTemplates.length ? (
                <View style={styles.recentTemplateBlock}>
                  <Text style={styles.recentTemplateCaption}>
                    최근에 넣었어요
                  </Text>
                  <View style={styles.pillRow}>
                    {recentTemplates.map((item) => {
                      const selected =
                        displayName.trim().toLowerCase() ===
                        item.displayName.trim().toLowerCase();

                      return (
                        <Pill
                          key={item.id}
                          label={item.displayName}
                          selected={selected}
                          onPress={() => applyRecentTemplate(item)}
                          accessibilityLabel={`${item.displayName} 불러오기`}
                        />
                      );
                    })}
                  </View>
                </View>
              ) : null}
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
                        `${resolveLabel(item.storageLocation)} · ${item.quantity}${item.unit ?? "개"}`,
                    )
                    .join(" / ")}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        {step === "storage" ? (
          <>
            <View
              style={[styles.formCard, shouldStack && styles.formCardCompact]}
            >
              <View style={styles.storageBlock}>
                <Text style={styles.storageBlockLabel}>어디에 두나요?</Text>
                <View style={styles.pillRow}>
                  {selectableOptions.map((option) => (
                    <Pill
                      key={option.key}
                      label={option.label}
                      icon={MapPin}
                      selected={storageLocation === option.key}
                      onPress={() =>
                        form.setValue("storageLocation", option.key, {
                          shouldValidate: true,
                        })
                      }
                    />
                  ))}
                  <Pill
                    label="위치 추가"
                    icon={Plus}
                    selected={false}
                    onPress={() => {
                      setNewLocationLabel("");
                      setAddLocationVisible(true);
                    }}
                  />
                </View>
              </View>

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
            </View>

            <Pressable
              onPress={() => setShowAdditionalInfo(true)}
              accessibilityRole="button"
              accessibilityLabel="브랜드·메모 적기"
              accessibilityHint="필요할 때만 적어도 괜찮아요."
              hitSlop={spacing.xs}
              style={({ pressed }) => [
                styles.extraTextLink,
                pressed && styles.extraTextLinkPressed,
              ]}
            >
              <Text style={styles.extraTextLinkLabel}>
                {brand || category
                  ? "브랜드·메모 확인하기"
                  : "브랜드·메모 적기"}
              </Text>
            </Pressable>
          </>
        ) : null}

        {step === "expiry" ? (
          <View
            style={[styles.formCard, shouldStack && styles.formCardCompact]}
          >
            <DatePickerField
              presentation="hero"
              heroEyebrow={null}
              value={expiryDate}
              onChange={(nextDate) => {
                form.setValue("expiryDate", nextDate, { shouldValidate: true });
                form.setValue("expirySource", ExpirySource.MANUAL, {
                  shouldValidate: true,
                });
              }}
              error={form.formState.errors.expiryDate?.message}
            >
              <View style={styles.expiryPresetBlock}>
                <Text style={styles.expiryPresetCaption}>빠른 기간</Text>
                <View style={styles.pillRow}>
                  {QUICK_EXPIRY_OPTIONS.map((option) => {
                    const presetDate = toIsoDate(
                      addDays(new Date(), option.days),
                    );

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
            </DatePickerField>
          </View>
        ) : null}

        {step === "confirm" ? (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <CheckCircle2
                color={colors.success}
                size={spacing.md}
                strokeWidth={2.5}
              />
              <Text style={styles.summaryTitle}>이렇게 넣을게요</Text>
            </View>
            <View
              style={[
                styles.summaryRow,
                shouldStackDense && styles.summaryRowStacked,
              ]}
            >
              <Text style={styles.summaryLabel}>재료</Text>
              <Text
                style={[
                  styles.summaryValue,
                  shouldStackDense && styles.summaryValueStacked,
                ]}
              >
                {displayName || "아직 없어요"}
              </Text>
            </View>
            <View
              style={[
                styles.summaryRow,
                shouldStackDense && styles.summaryRowStacked,
              ]}
            >
              <Text style={styles.summaryLabel}>보관</Text>
              <Text
                style={[
                  styles.summaryValue,
                  shouldStackDense && styles.summaryValueStacked,
                ]}
              >
                {resolveLabel(storageLocation)} · {quantity}
                {unit}
              </Text>
            </View>
            <View
              style={[
                styles.summaryRow,
                shouldStackDense && styles.summaryRowStacked,
              ]}
            >
              <Text style={styles.summaryLabel}>유통기한</Text>
              <Text
                style={[
                  styles.summaryValue,
                  shouldStackDense && styles.summaryValueStacked,
                ]}
              >
                {expiryDate
                  ? formatDateKorean(expiryDate)
                  : "아직 고르지 않았어요"}
              </Text>
            </View>
            {brand ? (
              <View
                style={[
                  styles.summaryRow,
                  shouldStackDense && styles.summaryRowStacked,
                ]}
              >
                <Text style={styles.summaryLabel}>브랜드</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    shouldStackDense && styles.summaryValueStacked,
                  ]}
                >
                  {brand}
                </Text>
              </View>
            ) : null}
            {category ? (
              <View
                style={[
                  styles.summaryRow,
                  shouldStackDense && styles.summaryRowStacked,
                ]}
              >
                <Text style={styles.summaryLabel}>카테고리</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    shouldStackDense && styles.summaryValueStacked,
                  ]}
                >
                  {productCategoryLabels[category]}
                </Text>
              </View>
            ) : null}
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

      <BottomSheet
        visible={addLocationVisible}
        onClose={() => setAddLocationVisible(false)}
        title="어디에 둘까요?"
        description="위치 이름을 알려 주시면 목록에 넣어 둘게요."
        mascotMood="idle"
        footer={
          <Button
            onPress={() => {
              createMutation.mutate(
                { label: newLocationLabel },
                {
                  onSuccess: (created) => {
                    setAddLocationVisible(false);
                    setNewLocationLabel("");
                    form.setValue("storageLocation", created.key, {
                      shouldValidate: true,
                    });
                    Alert.alert(
                      "위치를 만들었어요",
                      "방금 만든 위치를 골라 뒀어요.",
                    );
                  },
                  onError: (error) =>
                    Alert.alert(
                      "앗, 잠시 문제가 생겼어요",
                      getSettingsErrorMessage(error),
                    ),
                },
              );
            }}
            loading={createMutation.isPending}
            disabled={newLocationLabel.trim().length === 0}
            fullWidth
          >
            여기에 보관할까요?
          </Button>
        }
      >
        <View style={styles.addLocationField}>
          <Text style={styles.addLocationLabel}>위치 이름</Text>
          <AppTextInput
            value={newLocationLabel}
            onChangeText={setNewLocationLabel}
            placeholder="예: 팬트리"
            maxLength={fieldLimits.storageLocationLabel}
            autoFocus
            style={styles.addLocationInput}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

function getBarcodeRewardNoticeTitle(
  reason: NonNullable<
    ReturnType<typeof useRegistrationStore.getState>["rewardNotice"]
  >["reason"],
) {
  const messages = {
    granted: "바코드 추천권을 받았어요",
    existing_barcode: "이미 등록된 바코드예요",
    invalid_gtin: "추천권 대상 바코드가 아니에요",
    lookup_unverified: "상품 조회를 확인하지 못했어요",
    insufficient_product_data: "추가 상품 정보가 필요해요",
    daily_limit_reached: "오늘 적립 한도를 모두 사용했어요",
    balance_limit_reached: "추천권 보유 한도에 도달했어요",
    rewards_disabled: "추천권 적립이 준비 중이에요",
  } as const;
  return messages[reason];
}

const styles = StyleSheet.create({
  addLocationField: {
    gap: spacing.xs,
  },
  addLocationLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.text,
  },
  addLocationInput: {
    minHeight: touchTarget.cta,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
  },
  doneHero: {
    alignItems: "stretch",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  doneTitle: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.heading.fontFamily,
    color: colors.text,
    textAlign: "center",
  },
  doneBubble: {
    alignSelf: "stretch",
  },
  doneFooter: {
    gap: spacing.sm,
  },
  doneTextLink: {
    minHeight: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTextLinkPressed: {
    opacity: 0.7,
  },
  doneTextLinkLabel: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
  recipeHint: {
    minHeight: touchTarget.min,
    borderRadius: radius.xxl,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  recipeHintStacked: {
    alignItems: "flex-start",
    flexDirection: "column",
  },
  recipeHintText: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.primary,
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
    fontFamily: typography.title.fontFamily,
    color: colors.danger,
  },
  errorDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
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
  formCardCompact: {
    padding: spacing.sm,
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
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
  },
  noticeTitle: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  noticeDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
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
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  warningCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  warningTitle: {
    fontSize: typography.body.fontSize,
    fontFamily: typography.title.fontFamily,
    color: colors.warning,
  },
  warningDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  inlineMetaValue: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
  storageBlock: {
    gap: spacing.xs,
  },
  storageBlockLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.text,
  },
  recentTemplateBlock: {
    gap: spacing.xs,
  },
  recentTemplateCaption: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.mutedText,
  },
  expiryPresetBlock: {
    gap: spacing.xs,
  },
  expiryPresetCaption: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.mutedText,
  },
  templateCardPressed: {
    backgroundColor: colors.surfacePressed,
  },
  extraTextLink: {
    minHeight: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  extraTextLinkPressed: {
    opacity: 0.72,
  },
  extraTextLinkLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
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
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  summaryRowStacked: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: spacing.xxs,
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
  summaryValueStacked: {
    textAlign: "left",
  },
  extraSection: {
    gap: spacing.sm,
  },
  extraSectionTitle: {
    fontSize: typography.bodySmall.fontSize,
    fontFamily: typography.bodyStrong.fontFamily,
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
  sessionHeaderStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  sessionCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  sessionEyebrow: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
  },
  sessionTitle: {
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontFamily: typography.title.fontFamily,
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
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  sessionMeta: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
});
