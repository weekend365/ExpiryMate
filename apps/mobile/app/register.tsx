import {
  DEFAULT_INVENTORY_FORM,
  ExpirySource,
  ProductCategory,
  UnitCode,
  defaultQuantityForInputUnit,
  formatDateKorean,
  formatEnteredQuantity,
  formatInventoryQuantity,
  groupInventoryItems,
  inventoryFormSchema,
  catalogIdentityDiffers,
  quantityInputLabel,
  quantityInputStep,
  quantityValuesForInputUnit,
  resolveQuantityInputUnit,
  suggestQuantityInputUnit,
  toBaseQuantity,
  toIsoDate,
} from "@expirymate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { router, useNavigation } from "expo-router";
import {
  Barcode,
  CheckCircle2,
  ChevronRight,
  Plus,
} from "lucide-react-native";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Alert,
  BackHandler,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { AppText } from "../src/components/AppText";
import { HeaderBackButton } from "../src/components/HeaderBackButton";
import { Button } from "../src/components/Button";
import { DatePickerField, type DatePickerFieldHandle } from "../src/components/DatePickerField";
import { FormField } from "../src/components/FormField";
import { FeedbackBanner } from "../src/components/FeedbackBanner";
import { JangoHeroNoticeCarousel } from "../src/components/JangoHeroNoticeCarousel";
import { Pill } from "../src/components/Pill";
import { QuantityStepper } from "../src/components/QuantityStepper";
import { Screen } from "../src/components/Screen";
import { StepFlow } from "../src/components/StepFlow";
import {
  AddLocationSheet,
  AdditionalInfoSheet,
  ExtraDetailsRow,
  QuickExpiryPills,
  RecapCard,
  RecapRow,
  StorageLocationField,
  extraDetailsRowLabel,
  formatPutAwayMessage,
  formatPutAwaySupportingMessage,
  inventoryFormStyles,
} from "../src/features/inventory/inventory-form-ui";
import { QuantityUnitPills } from "../src/features/inventory/QuantityUnitPills";
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
import {
  type RegistrationDraft,
  useRegistrationStore,
} from "../src/store/registration-store";

type RegistrationFormValues = {
  productId?: string;
  productMasterId?: string;
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

/** 1) 재료명 → 2) 양(위치 칩) → 3) 기한 → done */
type RegistrationStep = "product" | "quantity" | "expiry" | "done";

type InputRegistrationStep = Exclude<RegistrationStep, "done">;

type RegisteredSessionItem = {
  id: string;
  displayName: string;
  quantity: number;
  unit?: string | null;
  quantityBase: number;
  unitCode: UnitCode;
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
    key: "quantity",
    label: "양",
    title: "얼마나 있나요?",
    guideMessage: "자리는 그대로 두고, 양만 알려 주세요.",
  },
  {
    key: "expiry",
    label: "기한",
    title: "언제까지인가요?",
    guideMessage: "빠른 기간을 고르거나, 날짜를 직접 바꿔도 돼요.",
  },
];

const createDefaultFormValues = (): RegistrationFormValues => ({
  productId: undefined,
  productMasterId: undefined,
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
  lastStorageLocation?: string | null,
): RegistrationFormValues => {
  const nextValues = {
    ...createDefaultFormValues(),
    ...draft,
    quantity:
      typeof draft?.quantity === "number" &&
      draft.quantity > 0 &&
      !prefill?.displayName
        ? draft.quantity
        : DEFAULT_INVENTORY_FORM.quantity,
    unit: prefill?.displayName
      ? (DEFAULT_INVENTORY_FORM.unit ?? "개")
      : (draft?.unit ?? DEFAULT_INVENTORY_FORM.unit ?? "개"),
    storageLocation:
      draft?.storageLocation ??
      lastStorageLocation ??
      DEFAULT_INVENTORY_FORM.storageLocation,
    expiryDate: normalizeDraftExpiryDate(draft?.expiryDate),
    expirySource: draft?.expirySource ?? DEFAULT_INVENTORY_FORM.expirySource,
    notes: draft?.notes ?? DEFAULT_INVENTORY_FORM.notes ?? "",
    displayName: draft?.displayName ?? "",
    brand: draft?.brand ?? "",
  };

  if (prefill) {
    nextValues.productId = prefill.productId;
    nextValues.productMasterId = prefill.productMasterId;
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

function getVisibleRegistrationSteps(includeProduct: boolean) {
  return REGISTRATION_STEPS.filter((step) => {
    if (step.key === "product") {
      return includeProduct;
    }

    return true;
  });
}

const getPrefillKey = (
  prefill: ReturnType<typeof useRegistrationStore.getState>["prefill"],
) =>
  prefill
    ? [
        prefill.productMasterId ?? "",
        prefill.productId ?? "",
        prefill.displayName ?? "",
      ].join(":")
    : "";

export default function RegisterScreen() {
  const navigation = useNavigation();
  const hasHydrated = useRegistrationStore((state) => state.hasHydrated);
  const prefill = useRegistrationStore((state) => state.prefill);
  const draft = useRegistrationStore((state) => state.draft);
  const lastStorageLocation = useRegistrationStore(
    (state) => state.lastStorageLocation,
  );
  const rewardNotice = useRegistrationStore((state) => state.rewardNotice);
  const setDraft = useRegistrationStore((state) => state.setDraft);
  const setLastStorageLocation = useRegistrationStore(
    (state) => state.setLastStorageLocation,
  );
  const setRewardNotice = useRegistrationStore((state) => state.setRewardNotice);
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);
  const clearDraft = useRegistrationStore((state) => state.clearDraft);
  const mutation = useSaveInventoryItem();
  const { data: inventory = [] } = useInventoryList();
  const [step, setStep] = useState<RegistrationStep>("product");
  const [entryMethod, setEntryMethod] = useState<"scan" | "manual">("manual");
  const [skipProduct, setSkipProduct] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  // Only open when the user taps — prefill must not auto-pop the extra sheet.
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
  const userChoseQuantityUnitRef = useRef(false);
  const expiryPickerRef = useRef<DatePickerFieldHandle>(null);

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(inventoryFormSchema) as never,
    defaultValues: createDefaultFormValues(),
  });

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const nextValues = buildInitialValues(
      prefill,
      draft,
      lastStorageLocation,
    );
    const nextPrefillKey = getPrefillKey(prefill);

    if (!initializedRef.current) {
      form.reset(nextValues);
      initializedRef.current = true;
      appliedPrefillKeyRef.current = nextPrefillKey;
      userChoseQuantityUnitRef.current = false;
      if (prefill?.displayName?.trim()) {
        setEntryMethod("scan");
        setSkipProduct(true);
        setStep("quantity");
      }
      return;
    }

    if (!prefill) {
      appliedPrefillKeyRef.current = "";
    }

    if (prefill && nextPrefillKey !== appliedPrefillKeyRef.current) {
      form.reset(nextValues);
      appliedPrefillKeyRef.current = nextPrefillKey;
      userChoseQuantityUnitRef.current = false;
      if (prefill.displayName?.trim()) {
        setEntryMethod("scan");
        setSkipProduct(true);
        setStep("quantity");
      }
    }
  }, [draft, form, hasHydrated, lastStorageLocation, prefill]);

  useEffect(() => {
    const subscription = form.watch((value) => {
      if (!hasHydrated || !initializedRef.current) {
        return;
      }

      setDraft({
        productId: value.productId,
        productMasterId: value.productMasterId,
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

  useEffect(() => {
    setRegisteredSessionItems((current) => {
      if (!current.length) {
        return current;
      }

      let changed = false;
      const next = current.map((item) => {
        const updated = inventory.find((entry) => entry.id === item.id);
        if (
          !updated ||
          (updated.displayName === item.displayName &&
            updated.quantity === item.quantity &&
            updated.unit === item.unit &&
            updated.quantityBase === item.quantityBase &&
            updated.unitCode === item.unitCode &&
            updated.storageLocation === item.storageLocation &&
            updated.expiryDate === item.expiryDate)
        ) {
          return item;
        }

        changed = true;
        return {
          ...item,
          displayName: updated.displayName,
          quantity: updated.quantity,
          unit: updated.unit,
          quantityBase: updated.quantityBase,
          unitCode: updated.unitCode,
          storageLocation: updated.storageLocation,
          expiryDate: updated.expiryDate,
        };
      });

      return changed ? next : current;
    });
  }, [inventory]);

  const handlePresetDate = (presetDate: string) => {
    form.setValue("expiryDate", presetDate, {
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
  const notes = form.watch("notes")?.trim() ?? "";
  const quantityLabel = quantityInputLabel(unit);
  const enteredQuantityLabel = formatEnteredQuantity(quantity, unit);
  const quantityUnitSuffix = resolveQuantityInputUnit(unit);
  const extraDetailsLabel = extraDetailsRowLabel({ brand, category, notes });

  const applyQuantityUnit = useCallback(
    (nextUnit: string, options?: { userChosen?: boolean }) => {
      if (options?.userChosen) {
        userChoseQuantityUnitRef.current = true;
      }

      const next = quantityValuesForInputUnit({
        quantity: Number(form.getValues("quantity")) || 1,
        fromUnit: form.getValues("unit"),
        toUnit: nextUnit,
      });
      form.setValue("unit", next.unit, { shouldValidate: true });
      form.setValue("quantity", next.quantity, { shouldValidate: true });
    },
    [form],
  );

  useEffect(() => {
    if (step !== "quantity" || userChoseQuantityUnitRef.current) {
      return;
    }

    const currentUnit = form.getValues("unit");
    const currentQuantity = Number(form.getValues("quantity")) || 1;
    if (resolveQuantityInputUnit(currentUnit) !== "개" || currentQuantity !== 1) {
      return;
    }

    const suggested = suggestQuantityInputUnit(displayName, category);
    if (suggested === "개") {
      return;
    }

    form.setValue("unit", suggested, { shouldValidate: true });
    form.setValue("quantity", defaultQuantityForInputUnit(suggested), {
      shouldValidate: true,
    });
  }, [category, displayName, form, step]);

  const visibleSteps = useMemo(
    () => getVisibleRegistrationSteps(!skipProduct),
    [skipProduct],
  );
  const isInputStep = step !== "done";
  const stepIndex = isInputStep
    ? visibleSteps.findIndex((item) => item.key === step)
    : -1;
  const isLastStep =
    isInputStep &&
    stepIndex >= 0 &&
    stepIndex === visibleSteps.length - 1;
  const catalogNameDiffers = Boolean(
    prefill?.productMasterId &&
      prefill.catalogName &&
      catalogIdentityDiffers(
        { name: prefill.catalogName, brand: prefill.catalogBrand },
        { name: displayName, brand },
      ),
  );
  const productGuideMessage = prefill?.productMasterId
    ? "스캔한 이름이 다르면 고쳐 주세요. 내 냉장고에만 먼저 반영돼요."
    : REGISTRATION_STEPS[0]?.guideMessage;
  const canGoNext = isLastStep
    ? Boolean(displayName && storageLocation && expiryDate) && quantity > 0
    : (step === "product" && Boolean(displayName)) ||
      (step === "quantity" && Boolean(storageLocation) && quantity > 0) ||
      (step === "expiry" && Boolean(expiryDate));
  const latestRegisteredItem = registeredSessionItems[0] ?? null;
  const selectedLocationLabel = resolveLabel(storageLocation);

  const goToPreviousStep = useCallback(() => {
    if (stepIndex > 0) {
      setStep(visibleSteps[stepIndex - 1]!.key);
      return;
    }

    if (skipProduct && step === "quantity") {
      setSkipProduct(false);
      setStep("product");
      return;
    }

    router.back();
  }, [skipProduct, step, stepIndex, visibleSteps]);

  const goToRegistrationStep = useCallback(
    (target: InputRegistrationStep, options?: { openLocation?: boolean }) => {
      if (target === "product") {
        setSkipProduct(false);
      }
      setShowLocationPicker(Boolean(options?.openLocation));
      setStep(target);
    },
    [],
  );

  useLayoutEffect(() => {
    if (step !== "done") {
      navigation.setOptions({
        title: "재료 넣기",
        headerLeft: () => <HeaderBackButton onPress={goToPreviousStep} />,
      });
      return;
    }

    navigation.setOptions({
      title: "",
      headerLeft: () => (
        <HeaderBackButton onPress={() => router.replace("/(tabs)/home")} />
      ),
    });
  }, [goToPreviousStep, navigation, step]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (step === "done") {
          router.replace("/(tabs)/home");
          return true;
        }

        goToPreviousStep();
        return true;
      },
    );

    return () => subscription.remove();
  }, [goToPreviousStep, step]);

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
      .slice(0, 8);
  }, [inventory]);

  const applyRecentTemplate = (item: (typeof recentTemplates)[number]) => {
    form.setValue("productId", item.productId ?? undefined);
    form.setValue("productMasterId", item.productMasterId ?? undefined);
    form.setValue("displayName", item.displayName, { shouldValidate: true });
    form.setValue("brand", item.brand ?? "");
    form.setValue("category", item.category ?? undefined);
    const nextUnit =
      item.unitCode === UnitCode.ML
        ? "ml"
        : item.unitCode === UnitCode.G
          ? "g"
          : (item.unit ?? "개");
    form.setValue("unit", nextUnit);
    form.setValue(
      "quantity",
      nextUnit === "ml" || nextUnit === "g"
        ? defaultQuantityForInputUnit(nextUnit)
        : 1,
      { shouldValidate: true },
    );
    form.setValue("storageLocation", item.storageLocation, {
      shouldValidate: true,
    });
    setShowAdditionalInfo(Boolean(item.brand || item.category));
  };

  const goToNextStep = () => {
    if (isLastStep) {
      return;
    }

    const nextStep = visibleSteps[stepIndex + 1];
    if (!nextStep) {
      return;
    }

    setStep(nextStep.key);
    setSubmitErrorMessage(null);
  };

  const finishRegistration = () => {
    setRewardNotice(null);
    router.replace("/(tabs)/home");
  };

  const continueWithBarcode = () => {
    clearPrefill();
    setRewardNotice(null);
    router.replace("/scanner");
  };

  const continueWithManual = () => {
    setRewardNotice(null);
    setSubmitErrorMessage(null);
    userChoseQuantityUnitRef.current = false;
    setEntryMethod("manual");
    setSkipProduct(false);
    setShowLocationPicker(false);
    setStep("product");
  };

  const openRecipeRecommendations = () => {
    router.replace({
      pathname: "/(tabs)/recommendations",
      params: { autoGenerateAt: Date.now().toString() },
    });
  };

  const openSessionEdit = (item: RegisteredSessionItem) => {
    router.push({
      pathname: "/inventory/[id]",
      params: { id: item.id },
    });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      setSubmitErrorMessage(null);
      const canonical = toBaseQuantity(values.quantity, values.unit);
      const created = await mutation.mutateAsync({
        productId: values.productId,
        productMasterId: values.productMasterId,
        displayName: values.displayName,
        brand: values.brand,
        category: values.category,
        quantity: values.quantity,
        unit: values.unit,
        quantityBase: canonical.quantityBase,
        unitCode: canonical.unitCode,
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
          quantityBase: created.quantityBase,
          unitCode: created.unitCode,
          storageLocation: created.storageLocation,
          expiryDate: created.expiryDate,
        },
        ...current,
      ]);

      const nextDefaults = {
        ...createDefaultFormValues(),
        storageLocation: values.storageLocation,
      };

      setLastStorageLocation(values.storageLocation);
      form.reset(nextDefaults);
      userChoseQuantityUnitRef.current = false;
      setShowAdditionalInfo(false);
      setShowLocationPicker(false);
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
    isLastStep
      ? "냉장고에 넣을게요"
      : step === "product"
        ? "이 재료로 할게요"
        : "이만큼 둘게요";

  if (step === "done") {
    const doneHeroNotices = [
      ...(registeredSessionItems.length >= 2
        ? [
            {
              id: "recipe-recommend",
              mood: "cooking" as const,
              message: "요리 추천 받아볼까요?",
              supportingMessage: "방금 넣은 재료로 메뉴를 찾아볼게요.",
              onPress: openRecipeRecommendations,
              accessibilityHint: "추천 받을게요",
            },
          ]
        : []),
      ...(rewardNotice?.granted
        ? [
            {
              id: "barcode-reward",
              mood: "happy" as const,
              message: "바코드 추천권 1회를 받았어요",
              supportingMessage: `현재 ${rewardNotice.balance}/${rewardNotice.balanceLimit}회 보유하고 있어요.`,
            },
          ]
        : []),
      {
        id: "put-away",
        mood: "happy" as const,
        message: latestRegisteredItem
          ? formatPutAwayMessage(latestRegisteredItem.displayName)
          : "잘 넣어뒀어요",
        supportingMessage: formatPutAwaySupportingMessage({
          expiryDate: latestRegisteredItem?.expiryDate,
          sessionCount: registeredSessionItems.length,
        }),
      },
    ];

    return (
      <Screen
        contentWidth="form"
        contentStyle={styles.screenSections}
        topInsetMode="none"
        footerStyle={styles.doneFooterSection}
        footer={
          <View style={styles.doneFooter}>
            <Button
              icon={entryMethod === "scan" ? Barcode : Plus}
              onPress={
                entryMethod === "scan" ? continueWithBarcode : continueWithManual
              }
              fullWidth
            >
              다음 재료 넣을게요
            </Button>
            <Button
              icon={entryMethod === "scan" ? Plus : Barcode}
              variant="secondary"
              onPress={
                entryMethod === "scan" ? continueWithManual : continueWithBarcode
              }
              fullWidth
            >
              {entryMethod === "scan" ? "손으로 넣을게요" : "바코드로 넣을게요"}
            </Button>
            <Button variant="surface" onPress={finishRegistration} fullWidth>
              그만 추가할래요
            </Button>
          </View>
        }
      >
        <View style={styles.doneHero}>
          <View
            style={[
              styles.sectionCard,
              styles.sectionCardSoft,
              styles.sectionCardPadded,
            ]}
          >
            <JangoHeroNoticeCarousel
              notices={doneHeroNotices}
              density="compact"
              textVariant="bodyStrong"
              bubbleStyle={styles.doneBubble}
            />
          </View>
        </View>

        {registeredSessionItems.length ? (
          <View style={[styles.sectionCard, styles.sectionCardPadded]}>
            <AppText style={styles.sectionTitle}>오늘 넣은 재료</AppText>
            <View style={styles.sessionList}>
              {registeredSessionItems.slice(0, 3).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => openSessionEdit(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.displayName} 내용을 고칠게요`}
                  accessibilityHint="이름, 수량, 유통기한을 다시 맞춰 둘 수 있어요."
                  style={({ pressed }) => [
                    styles.sessionRow,
                    pressed && styles.templateCardPressed,
                  ]}
                >
                  <View style={styles.sessionRowCopy}>
                    <AppText style={styles.sessionName}>{item.displayName}</AppText>
                    <AppText style={styles.sessionMeta}>
                      {resolveLabel(item.storageLocation)} ·{" "}
                      {formatInventoryQuantity(item)} ·{" "}
                      {formatDateKorean(item.expiryDate)}
                    </AppText>
                  </View>
                  <ChevronRight
                    color={colors.mutedText}
                    size={spacing.md}
                    strokeWidth={2.4}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </Screen>
    );
  }

  return (
      <Screen
        contentWidth="form"
        contentStyle={styles.screenSections}
        topInsetMode="none"
        testID="register-screen"
      footer={
        <View style={styles.footerStack}>
          {isLastStep && !expiryDate ? (
            <AppText style={styles.ctaHint} accessibilityLiveRegion="polite">
              날짜만 골라 주시면 넣을게요
            </AppText>
          ) : null}
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
        </View>
      }
    >
      <StepFlow
        steps={visibleSteps}
        currentIndex={Math.max(stepIndex, 0)}
        onBack={goToPreviousStep}
        density="compact"
        hideBack
        guideMessage={
          step === "product"
            ? productGuideMessage
            : visibleSteps[Math.max(stepIndex, 0)]?.guideMessage
        }
        guideMood="speak"
      >
        {step === "product" && rewardNotice?.granted ? (
          <FeedbackBanner
            tone="success"
            title="아직 없는 상품이에요"
            description="이 재료를 넣으면 추천권 1회를 드려요."
            showMascot={false}
          />
        ) : null}
        {submitErrorMessage ? (
          <View style={styles.errorStrip}>
            <AppText style={styles.errorTitle}>앗, 잠시 문제가 생겼어요</AppText>
            <AppText style={styles.errorDescription}>{submitErrorMessage}</AppText>
          </View>
        ) : null}

        {step === "product" ? (
          <View style={styles.stepSections}>
            {prefill?.displayName ? (
              <View style={[styles.sectionCard, styles.sectionCardPadded]}>
                <View style={styles.noticeBlock}>
                  <AppText style={styles.noticeEyebrow}>
                    {catalogNameDiffers ? "목록과 다른 이름" : "불러온 재료"}
                  </AppText>
                  <AppText style={styles.noticeTitle}>{displayName || prefill.displayName}</AppText>
                  {catalogNameDiffers ? (
                    <AppText style={styles.noticeDescription}>
                      목록 이름은 {prefill.catalogName}예요. 냉장고에는 지금
                      이름으로 넣을게요.
                    </AppText>
                  ) : prefill.brand ? (
                    <AppText style={styles.noticeDescription}>{prefill.brand}</AppText>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={[styles.sectionCard, styles.sectionCardTight]}>
              <AppText style={styles.sectionTitle}>재료 이름</AppText>
              <FormField
                control={form.control}
                name="displayName"
                label="재료 이름"
                hideLabel
                placeholder="예: 서울우유 1L"
              />
              {recentTemplates.length ? (
                <View style={styles.recentTemplateBlock}>
                  <AppText style={styles.sectionCaption}>최근에 넣었어요</AppText>
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
          </View>
        ) : null}

        {step === "quantity" ? (
          <View style={styles.stepSections}>
            <View style={[styles.sectionCard, styles.sectionCardTight]}>
              <AppText style={styles.sectionTitle}>{quantityLabel}</AppText>
              <QuantityStepper
                presentation="hero"
                label={quantityLabel}
                unitSuffix={quantityUnitSuffix}
                value={quantity}
                step={quantityInputStep(unit)}
                onChange={(nextQuantity) =>
                  form.setValue("quantity", nextQuantity, {
                    shouldValidate: true,
                  })
                }
                error={form.formState.errors.quantity?.message}
              />
              <View style={styles.unitChipBlock}>
                <AppText style={styles.sectionCaption}>단위</AppText>
                <QuantityUnitPills
                  unit={unit}
                  onChange={(nextUnit) =>
                    applyQuantityUnit(nextUnit, { userChosen: true })
                  }
                />
              </View>
            </View>

            <StorageLocationField
              expanded={showLocationPicker}
              selectedKey={storageLocation}
              selectedLabel={selectedLocationLabel}
              options={selectableOptions}
              onExpand={() => setShowLocationPicker(true)}
              onSelect={(key) => {
                form.setValue("storageLocation", key, {
                  shouldValidate: true,
                });
                setShowLocationPicker(false);
              }}
              onAddLocation={() => {
                setNewLocationLabel("");
                setAddLocationVisible(true);
              }}
            />

            <ExtraDetailsRow
              label={extraDetailsLabel}
              onPress={() => setShowAdditionalInfo(true)}
            />
          </View>
        ) : null}

        {step === "expiry" ? (
          <View style={styles.stepSections}>
            <View style={[styles.sectionCard, styles.sectionCardTight]}>
              <AppText style={styles.sectionTitle}>유통기한</AppText>
              <DatePickerField
                ref={expiryPickerRef}
                presentation="hero"
                heroEyebrow={null}
                actionLabel={expiryDate ? "다른 날짜 고르기" : "달력에서 고르기"}
                value={expiryDate}
                onChange={(nextDate) => {
                  form.setValue("expiryDate", nextDate, { shouldValidate: true });
                  form.setValue("expirySource", ExpirySource.MANUAL, {
                    shouldValidate: true,
                  });
                }}
                error={form.formState.errors.expiryDate?.message}
              >
                <QuickExpiryPills
                  isSelected={(isoDate) =>
                    expiryDate === isoDate && expirySource === ExpirySource.PRESET
                  }
                  onSelect={handlePresetDate}
                />
              </DatePickerField>
            </View>

            <RecapCard>
              <RecapRow
                label="재료"
                value={displayName}
                onPress={() => goToRegistrationStep("product")}
              />
              <RecapRow
                label="양"
                value={enteredQuantityLabel}
                onPress={() => goToRegistrationStep("quantity")}
              />
              <RecapRow
                label="자리"
                value={selectedLocationLabel}
                onPress={() =>
                  goToRegistrationStep("quantity", { openLocation: true })
                }
              />
            </RecapCard>
          </View>
        ) : null}
      </StepFlow>

      <AdditionalInfoSheet
        visible={showAdditionalInfo && step === "quantity"}
        onClose={() => setShowAdditionalInfo(false)}
        control={form.control}
        category={category}
        onSelectCategory={(value) =>
          form.setValue("category", value, { shouldValidate: true })
        }
      />

      <AddLocationSheet
        visible={addLocationVisible}
        onClose={() => setAddLocationVisible(false)}
        label={newLocationLabel}
        onChangeLabel={setNewLocationLabel}
        loading={createMutation.isPending}
        onSubmit={() => {
          createMutation.mutate(
            { label: newLocationLabel },
            {
              onSuccess: (created) => {
                setAddLocationVisible(false);
                setNewLocationLabel("");
                form.setValue("storageLocation", created.key, {
                  shouldValidate: true,
                });
                setShowLocationPicker(false);
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
      />
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  doneHero: {
    alignItems: "stretch",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  doneBubble: {
    alignSelf: "stretch",
  },
  doneFooter: {
    gap: spacing.xs,
  },
  doneFooterSection: {
    paddingTop: spacing.sm,
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
  noticeBlock: {
    gap: spacing.xs,
  },
  noticeEyebrow: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
  },
  noticeTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  noticeDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  recentTemplateBlock: {
    gap: spacing.xs,
  },
  templateCardPressed: {
    backgroundColor: colors.surfacePressed,
  },
  sessionList: {
    gap: spacing.sm,
  },
  sessionRow: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sessionRowCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  sessionName: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  sessionMeta: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
});

const styles = { ...inventoryFormStyles, ...localStyles };
