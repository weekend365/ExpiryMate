import {
  DEFAULT_INVENTORY_FORM,
  ExpirySource,
  ItemStatus,
  ProductCategory,
  UnitCode,
  addDays,
  defaultQuantityForInputUnit,
  fieldLimits,
  formatDateKorean,
  formatEnteredQuantity,
  formatInventoryQuantity,
  groupInventoryItems,
  inventoryFormSchema,
  catalogIdentityDiffers,
  dateOnlyToUtcDate,
  productCategoryLabels,
  productCategoryOptions,
  quantityInputLabel,
  quantityInputStep,
  quantityValuesForInputUnit,
  resolveQuantityInputUnit,
  suggestQuantityInputUnit,
  toBaseQuantity,
  toIsoDate,
} from "@expirymate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useQueryClient } from "@tanstack/react-query";
import { router, useNavigation } from "expo-router";
import {
  Barcode,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Plus,
} from "lucide-react-native";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Alert,
  BackHandler,
  Platform,
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
import { QuantityUnitPills } from "../src/features/inventory/QuantityUnitPills";
import { useInventoryList } from "../src/features/inventory/use-inventory-list";
import { useSaveInventoryItem } from "../src/features/registration/use-save-inventory-item";
import { getSettingsErrorMessage } from "../src/features/settings/settings-format";
import { useStorageLocations } from "../src/features/settings/use-storage-locations";
import { updateInventoryItem } from "../src/services/api";
import { useAuth } from "../src/features/auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../src/features/auth/session-boundary";
import { useActiveSpace } from "../src/features/spaces/space-provider";
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

type SessionEditDraft = {
  id: string;
  displayName: string;
  quantity: number;
  unit: string;
  storageLocation: string;
  expiryDate: string;
};

function koreanObjectParticle(word: string): "을" | "를" {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);

  if (code < 0xac00 || code > 0xd7a3) {
    return "를";
  }

  return (code - 0xac00) % 28 === 0 ? "를" : "을";
}

function formatPutAwayMessage(name: string) {
  const trimmed = name.trim();
  return `${trimmed}${koreanObjectParticle(trimmed)} 넣었어요`;
}

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
    guideMessage: "냉장고면 그대로 두셔도 괜찮아요. 개수나 용량만 알려 주세요.",
  },
  {
    key: "expiry",
    label: "기한",
    title: "언제까지인가요?",
    guideMessage: "빠른 기간으로 바꾸거나, 달력에서 골라 주세요.",
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

function getVisibleRegistrationSteps(
  includeProduct: boolean,
  includeExpiry: boolean,
) {
  return REGISTRATION_STEPS.filter((step) => {
    if (step.key === "product") {
      return includeProduct;
    }

    if (step.key === "expiry") {
      return includeExpiry;
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
  const queryClient = useQueryClient();
  const { activeSpaceId } = useActiveSpace();
  const { sessionUserId } = useAuth();
  const { data: inventory = [] } = useInventoryList();
  const [step, setStep] = useState<RegistrationStep>("product");
  const [entryMethod, setEntryMethod] = useState<"scan" | "manual">("manual");
  const [skipProduct, setSkipProduct] = useState(false);
  const [skipExpiry, setSkipExpiry] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
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
  const [sessionEdit, setSessionEdit] = useState<SessionEditDraft | null>(null);
  const [sessionEditError, setSessionEditError] = useState<string | null>(null);
  const [isSavingSessionEdit, setIsSavingSessionEdit] = useState(false);
  const [showAndroidExpiryPicker, setShowAndroidExpiryPicker] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(
    null,
  );
  const initializedRef = useRef(false);
  const appliedPrefillKeyRef = useRef("");
  const userChoseQuantityUnitRef = useRef(false);

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
        setSkipExpiry(Boolean(nextValues.expiryDate));
        setStep("quantity");
        setShowUnitPicker(false);
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
        setSkipExpiry(Boolean(nextValues.expiryDate));
        setStep("quantity");
        setShowUnitPicker(false);
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
  const quantityLabel = quantityInputLabel(unit);
  const enteredQuantityLabel = formatEnteredQuantity(quantity, unit);

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
    () => getVisibleRegistrationSteps(!skipProduct, !skipExpiry),
    [skipExpiry, skipProduct],
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
  const showRecap = isLastStep && step === "expiry";
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
    setSkipExpiry(false);
    setShowUnitPicker(false);
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
    setSessionEditError(null);
    setShowAndroidExpiryPicker(false);
    setSessionEdit({
      id: item.id,
      displayName: item.displayName,
      quantity: item.quantity,
      unit: item.unit ?? "개",
      storageLocation: item.storageLocation,
      expiryDate: item.expiryDate,
    });
  };

  const closeSessionEdit = () => {
    setSessionEdit(null);
    setSessionEditError(null);
    setShowAndroidExpiryPicker(false);
  };

  const handleSessionEditExpiry = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android" && event.type === "dismissed") {
      return;
    }

    if (!selectedDate) {
      return;
    }

    setSessionEdit((current) =>
      current
        ? { ...current, expiryDate: toIsoDate(selectedDate) }
        : current,
    );
    setShowAndroidExpiryPicker(false);
  };

  const saveSessionEdit = async () => {
    if (!sessionEdit) {
      return;
    }

    if (!activeSpaceId) {
      setSessionEditError("함께 쓸 냉장고를 먼저 골라 주세요.");
      return;
    }

    const nextName = sessionEdit.displayName.trim();
    if (
      !nextName ||
      sessionEdit.quantity <= 0 ||
      !sessionEdit.storageLocation ||
      !sessionEdit.expiryDate
    ) {
      setSessionEditError("이름, 양, 자리, 날짜를 알려 주세요.");
      return;
    }

    try {
      setIsSavingSessionEdit(true);
      setSessionEditError(null);
      const canonical = toBaseQuantity(sessionEdit.quantity, sessionEdit.unit);
      const updated = await updateInventoryItem(
        sessionEdit.id,
        {
          displayName: nextName,
          quantity: sessionEdit.quantity,
          unit: sessionEdit.unit,
          quantityBase: canonical.quantityBase,
          unitCode: canonical.unitCode,
          storageLocation: sessionEdit.storageLocation,
          expiryDate: sessionEdit.expiryDate,
          expirySource: ExpirySource.MANUAL,
        },
        activeSpaceId,
      );

      setRegisteredSessionItems((current) =>
        current.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                displayName: updated.displayName,
                quantity: updated.quantity,
                unit: updated.unit,
                quantityBase: updated.quantityBase,
                unitCode: updated.unitCode,
                storageLocation: updated.storageLocation,
                expiryDate: updated.expiryDate,
              }
            : item,
        ),
      );

      await Promise.all([
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
            sessionQueryKeys.inventoryItem,
            sessionUserId,
            activeSpaceId,
          ),
        }),
      ]);

      closeSessionEdit();
    } catch (error) {
      setSessionEditError(
        error instanceof Error
          ? error.message
          : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
      );
    } finally {
      setIsSavingSessionEdit(false);
    }
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
      setShowUnitPicker(false);
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
    let sessionEditPickerDate = new Date();
    if (sessionEdit?.expiryDate) {
      try {
        sessionEditPickerDate = dateOnlyToUtcDate(sessionEdit.expiryDate);
      } catch {
        sessionEditPickerDate = new Date();
      }
    }
    const canSaveSessionEdit = Boolean(
      sessionEdit?.displayName.trim() &&
        sessionEdit.storageLocation &&
        sessionEdit.expiryDate &&
        sessionEdit.quantity > 0,
    );

    return (
      <>
      <Screen
        contentWidth="form"
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
            <Pressable
              onPress={
                entryMethod === "scan" ? continueWithManual : continueWithBarcode
              }
              accessibilityRole="button"
              accessibilityLabel={
                entryMethod === "scan"
                  ? "손으로 더 넣을게요"
                  : "바코드로 더 넣을게요"
              }
              hitSlop={spacing.xs}
              style={({ pressed }) => [
                styles.doneTextLink,
                pressed && styles.doneTextLinkPressed,
              ]}
            >
              <Text style={styles.doneTextLinkLabel}>
                {entryMethod === "scan"
                  ? "손으로 더 넣을게요"
                  : "바코드로 더 넣을게요"}
              </Text>
            </Pressable>
            <Pressable
              onPress={finishRegistration}
              accessibilityRole="button"
              accessibilityLabel="그만 추가할래요"
              hitSlop={spacing.xs}
              style={({ pressed }) => [
                styles.doneTextLink,
                pressed && styles.doneTextLinkPressed,
              ]}
            >
              <Text style={styles.doneMutedLinkLabel}>그만 추가할래요</Text>
            </Pressable>
          </View>
        }
      >
        <View style={styles.doneHero}>
          <MascotSpeechBubble
            message={
              latestRegisteredItem
                ? formatPutAwayMessage(latestRegisteredItem.displayName)
                : "잘 넣어뒀어요"
            }
            mood="happy"
            size="medium"
            textVariant="title"
            style={styles.doneBubble}
          />
          {rewardNotice?.granted ? (
            <FeedbackBanner
              tone="success"
              title="바코드 추천권 1회를 받았어요"
              description={`현재 ${rewardNotice.balance}/${rewardNotice.balanceLimit}회 보유하고 있어요.`}
              showMascot={false}
            />
          ) : null}
        </View>

        {registeredSessionItems.length ? (
          <View style={styles.sessionListBlock}>
            <Text style={styles.sessionEyebrow}>오늘 넣은 재료</Text>
            <View style={styles.sessionList}>
              {registeredSessionItems.slice(0, 3).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => openSessionEdit(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.displayName} 내용을 고칠게요`}
                  accessibilityHint="방금 넣은 이름, 수량, 유통기한을 이 자리에서 다시 맞춰 둘 수 있어요."
                  style={({ pressed }) => [
                    styles.sessionRow,
                    pressed && styles.templateCardPressed,
                  ]}
                >
                  <View style={styles.sessionRowCopy}>
                    <Text style={styles.sessionName}>{item.displayName}</Text>
                    <Text style={styles.sessionMeta}>
                      {resolveLabel(item.storageLocation)} ·{" "}
                      {formatInventoryQuantity(item)} ·{" "}
                      {formatDateKorean(item.expiryDate)}
                    </Text>
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

        {registeredSessionItems.length >= 2 ? (
          <Pressable
            onPress={openRecipeRecommendations}
            accessibilityRole="button"
            accessibilityLabel="요리 추천 받아볼까요?"
            hitSlop={spacing.xs}
            style={({ pressed }) => [
              styles.doneTextLink,
              pressed && styles.doneTextLinkPressed,
            ]}
          >
            <Text style={styles.doneTextLinkLabel}>요리 추천 받아볼까요?</Text>
          </Pressable>
        ) : null}
      </Screen>
      <BottomSheet
        visible={Boolean(sessionEdit)}
        onClose={closeSessionEdit}
        mascotMood="idle"
        title="조금만 고칠게요"
        description="이름, 양, 자리, 날짜만 다시 맞춰 둘게요."
        footer={
          <Button
            onPress={() => {
              void saveSessionEdit();
            }}
            loading={isSavingSessionEdit}
            disabled={!canSaveSessionEdit || isSavingSessionEdit}
            fullWidth
          >
            이 내용으로 둘게요
          </Button>
        }
      >
        {sessionEdit ? (
          <>
            {sessionEditError ? (
              <View style={styles.errorStrip}>
                <Text style={styles.errorTitle}>앗, 잠시 문제가 생겼어요</Text>
                <Text style={styles.errorDescription}>{sessionEditError}</Text>
              </View>
            ) : null}
            <View style={styles.storageBlock}>
              <Text style={styles.storageBlockLabel}>어떤 이름인가요?</Text>
              <AppTextInput
                value={sessionEdit.displayName}
                onChangeText={(displayName) =>
                  setSessionEdit((current) =>
                    current ? { ...current, displayName } : current,
                  )
                }
                placeholder="예: 서울우유 1L"
                maxLength={fieldLimits.displayName}
                style={styles.addLocationInput}
              />
            </View>
            <QuantityStepper
              label={quantityInputLabel(sessionEdit.unit)}
              value={sessionEdit.quantity}
              step={quantityInputStep(sessionEdit.unit)}
              onChange={(quantity) =>
                setSessionEdit((current) =>
                  current ? { ...current, quantity } : current,
                )
              }
            />
            <View style={styles.storageBlock}>
              <Text style={styles.storageBlockLabel}>어디에 두나요?</Text>
              <View style={styles.pillRow}>
                {selectableOptions.map((option) => (
                  <Pill
                    key={option.key}
                    label={option.label}
                    icon={MapPin}
                    selected={sessionEdit.storageLocation === option.key}
                    onPress={() =>
                      setSessionEdit((current) =>
                        current
                          ? { ...current, storageLocation: option.key }
                          : current,
                      )
                    }
                  />
                ))}
              </View>
            </View>
            <View style={styles.storageBlock}>
              <Text style={styles.storageBlockLabel}>언제까지인가요?</Text>
              <View style={styles.pillRow}>
                {QUICK_EXPIRY_OPTIONS.map((option) => {
                  const presetDate = toIsoDate(addDays(new Date(), option.days));

                  return (
                    <Pill
                      key={option.days}
                      label={option.label}
                      icon={CalendarDays}
                      selected={sessionEdit.expiryDate === presetDate}
                      onPress={() =>
                        setSessionEdit((current) =>
                          current
                            ? { ...current, expiryDate: presetDate }
                            : current,
                        )
                      }
                    />
                  );
                })}
              </View>
              {Platform.OS === "ios" ? (
                <DateTimePicker
                  value={sessionEditPickerDate}
                  mode="date"
                  display="compact"
                  onChange={handleSessionEditExpiry}
                />
              ) : (
                <>
                  <Pressable
                    onPress={() => setShowAndroidExpiryPicker(true)}
                    accessibilityRole="button"
                    accessibilityLabel="다른 날짜 고르기"
                    style={({ pressed }) => [
                      styles.extraTextLink,
                      pressed && styles.extraTextLinkPressed,
                    ]}
                  >
                    <Text style={styles.extraTextLinkLabel}>
                      {formatDateKorean(sessionEdit.expiryDate)}까지 · 다른 날짜
                      고르기
                    </Text>
                  </Pressable>
                  {showAndroidExpiryPicker ? (
                    <DateTimePicker
                      value={sessionEditPickerDate}
                      mode="date"
                      display="default"
                      onChange={handleSessionEditExpiry}
                    />
                  ) : null}
                </>
              )}
            </View>
          </>
        ) : null}
      </BottomSheet>
      </>
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
            <Text style={styles.errorTitle}>앗, 잠시 문제가 생겼어요</Text>
            <Text style={styles.errorDescription}>{submitErrorMessage}</Text>
          </View>
        ) : null}

        {step === "product" ? (
          <View style={styles.openStepLayout}>
            {prefill?.displayName ? (
              <View style={styles.noticeBlock}>
                <Text style={styles.noticeEyebrow}>
                  {catalogNameDiffers ? "목록과 다른 이름" : "불러온 재료"}
                </Text>
                <Text style={styles.noticeTitle}>{displayName || prefill.displayName}</Text>
                {catalogNameDiffers ? (
                  <Text style={styles.noticeDescription}>
                    목록 이름은 {prefill.catalogName}예요. 냉장고에는 지금
                    이름으로 넣을게요.
                  </Text>
                ) : prefill.brand ? (
                  <Text style={styles.noticeDescription}>{prefill.brand}</Text>
                ) : null}
              </View>
            ) : null}

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

            {similarItems.length ? (
              <View style={styles.warningBlock}>
                <Text style={styles.warningTitle}>
                  집에 이미 {similarItems.length}개 있어요
                </Text>
                <Text style={styles.warningDescription}>
                  {similarItems
                    .slice(0, 2)
                    .map(
                      (item) =>
                        `${resolveLabel(item.storageLocation)} · ${formatInventoryQuantity(item)}`,
                    )
                    .join(" / ")}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {step === "quantity" ? (
          <View style={styles.quantityLayout}>
            <View style={styles.quantityPrimary}>
              <QuantityStepper
                presentation="hero"
                label={quantityLabel}
                value={quantity}
                step={quantityInputStep(unit)}
                onChange={(nextQuantity) =>
                  form.setValue("quantity", nextQuantity, {
                    shouldValidate: true,
                  })
                }
                error={form.formState.errors.quantity?.message}
              />
              {showUnitPicker ? (
                <View style={styles.storageBlock}>
                  <Text style={styles.storageBlockLabel}>어떤 단위인가요?</Text>
                  <QuantityUnitPills
                    unit={unit}
                    onChange={(nextUnit) =>
                      applyQuantityUnit(nextUnit, { userChosen: true })
                    }
                  />
                </View>
              ) : null}
            </View>

            {showLocationPicker ? (
              <View style={styles.storageBlock}>
                <View style={styles.pillRow}>
                  {selectableOptions.map((option) => (
                    <Pill
                      key={option.key}
                      label={option.label}
                      icon={MapPin}
                      selected={storageLocation === option.key}
                      onPress={() => {
                        form.setValue("storageLocation", option.key, {
                          shouldValidate: true,
                        });
                        setShowLocationPicker(false);
                      }}
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
            ) : (
              <Pressable
                onPress={() => setShowLocationPicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`${selectedLocationLabel}에 둘게요`}
                accessibilityHint="자리를 다른 곳으로 바꿀 수 있어요."
                style={({ pressed }) => [
                  styles.quietMetaRow,
                  pressed && styles.quietMetaRowPressed,
                ]}
              >
                <MapPin
                  color={colors.mutedText}
                  size={spacing.sm}
                  strokeWidth={2.4}
                />
                <Text style={styles.quietMetaLabel}>
                  {selectedLocationLabel}에 둘게요
                </Text>
                <Text style={styles.quietMetaAction}>바꿀게요</Text>
              </Pressable>
            )}

            <View style={styles.quantityTertiary}>
              <View style={styles.extraRow}>
                {showUnitPicker ? null : (
                  <Pressable
                    onPress={() => setShowUnitPicker(true)}
                    accessibilityRole="button"
                    accessibilityLabel="단위 바꿀게요"
                    accessibilityHint={`지금은 ${unit}로 세고 있어요.`}
                    hitSlop={spacing.xs}
                    style={({ pressed }) => [
                      styles.extraTextLink,
                      pressed && styles.extraTextLinkPressed,
                    ]}
                  >
                    <Text style={styles.extraMutedLinkLabel}>
                      지금 {unit} · 단위 바꿀게요
                    </Text>
                  </Pressable>
                )}
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
                  <Text style={styles.extraMutedLinkLabel}>
                    {brand || category
                      ? "브랜드·메모 확인하기"
                      : "브랜드·메모 적기"}
                  </Text>
                </Pressable>
                {skipExpiry && expiryDate ? (
                  <Pressable
                    onPress={() => {
                      setSkipExpiry(false);
                      setStep("expiry");
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="날짜 바꿀게요"
                    hitSlop={spacing.xs}
                    style={({ pressed }) => [
                      styles.extraTextLink,
                      pressed && styles.extraTextLinkPressed,
                    ]}
                  >
                    <Text style={styles.extraMutedLinkLabel}>
                      {formatDateKorean(expiryDate)}까지 · 바꿀게요
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {step === "expiry" ? (
          <View style={styles.openStepLayout}>
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
            {showRecap ? (
              <View style={styles.recapLine}>
                <Text style={styles.recapTitle}>이렇게 넣을게요</Text>
                <Text style={styles.recapBody}>
                  {[
                    displayName,
                    resolveLabel(storageLocation),
                    enteredQuantityLabel,
                    expiryDate ? `${formatDateKorean(expiryDate)}까지` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </StepFlow>

      <BottomSheet
        visible={showAdditionalInfo && step === "quantity"}
        onClose={() => setShowAdditionalInfo(false)}
        mascotMood="idle"
        title="조금만 더 알려주세요"
        description="브랜드, 카테고리, 메모는 필요할 때만 적어도 돼요."
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

const styles = StyleSheet.create({
  // Importance: voice title/32px to input · primary group 8 · secondary 16 · extras 24
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
    gap: spacing.sm,
    paddingVertical: spacing.xs,
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
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
  doneMutedLinkLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.mutedText,
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
  openStepLayout: {
    gap: spacing.sm,
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
  warningBlock: {
    gap: spacing.xxs,
  },
  warningTitle: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
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
  extraMutedLinkLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.mutedText,
  },
  extraRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.xs,
  },
  quantityLayout: {
    gap: spacing.sm,
  },
  quantityPrimary: {
    gap: spacing.xs,
  },
  quantityTertiary: {
    marginTop: spacing.xs,
  },
  quietMetaRow: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  quietMetaRowPressed: {
    opacity: 0.72,
  },
  quietMetaLabel: {
    flex: 1,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  quietMetaAction: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.mutedText,
  },
  recapLine: {
    gap: spacing.xxs,
  },
  recapTitle: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
  },
  recapBody: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.text,
  },
  extraSection: {
    gap: spacing.sm,
  },
  extraSectionTitle: {
    fontSize: typography.bodySmall.fontSize,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  sessionListBlock: {
    gap: spacing.sm,
  },
  sessionEyebrow: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.mutedText,
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
