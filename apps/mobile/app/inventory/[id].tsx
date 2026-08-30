import {
  ExpirySource,
  ItemStatus,
  ProductCategory,
  formatEnteredQuantity,
  inventoryFormSchema,
  inventoryItemToFormValues,
  quantityInputLabel,
  quantityValuesForInputUnit,
  resolveQuantityInputUnit,
  toBaseQuantity,
} from "@expirymate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { CheckCircle2, ChevronRight } from "lucide-react-native";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, BackHandler, View } from "react-native";
import { z } from "zod";
import { AppText } from "../../src/components/AppText";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { HeaderBackButton } from "../../src/components/HeaderBackButton";
import { Screen } from "../../src/components/Screen";
import { StepFlow } from "../../src/components/StepFlow";
import {
  AddLocationSheet,
  AdditionalInfoSheet,
  RecapCard,
  RecapRow,
  extraDetailsRowLabel,
  inventoryFormStyles,
} from "../../src/features/inventory/inventory-form-ui";
import {
  InventoryExpiryStep,
  InventoryProductNameStep,
  InventoryQuantityStep,
} from "../../src/features/inventory/inventory-step-fields";
import { getInventoryItem, updateInventoryItem } from "../../src/services/api";
import { getSettingsErrorMessage } from "../../src/features/settings/settings-format";
import { useStorageLocations } from "../../src/features/settings/use-storage-locations";
import { useAuth } from "../../src/features/auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../../src/features/auth/session-boundary";
import { useActiveSpace } from "../../src/features/spaces/space-provider";

type InventoryFormInput = z.input<typeof inventoryFormSchema>;
type InventoryFormValues = z.output<typeof inventoryFormSchema>;
type EditStep = "product" | "quantity" | "expiry";

const EDIT_STEPS: Array<{
  key: EditStep;
  label: string;
  title: string;
  guideMessage: string;
}> = [
  {
    key: "product",
    label: "재료",
    title: "어떤 재료인가요?",
    guideMessage: "이름만 먼저 맞춰 볼게요.",
  },
  {
    key: "quantity",
    label: "양",
    title: "얼마나 있나요?",
    guideMessage: "자리는 그대로 두고, 남은 양만 알려 주세요.",
  },
  {
    key: "expiry",
    label: "기한",
    title: "언제까지인가요?",
    guideMessage: "빠른 기간을 고르거나, 날짜를 직접 바꿔도 돼요.",
  },
];

export default function InventoryEditScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
    mode?: string;
  }>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const { activeSpaceId, isReady } = useActiveSpace();
  const inventoryKey = withInventorySpace(
    sessionQueryKeys.inventory,
    sessionUserId,
    activeSpaceId,
  );
  const dashboardKey = withInventorySpace(
    sessionQueryKeys.dashboard,
    sessionUserId,
    activeSpaceId,
  );
  const itemKey = [
    ...withInventorySpace(
      sessionQueryKeys.inventoryItem,
      sessionUserId,
      activeSpaceId,
    ),
    id,
  ] as const;
  const [editStep, setEditStep] = useState<EditStep>("product");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [addLocationVisible, setAddLocationVisible] = useState(false);
  const [newLocationLabel, setNewLocationLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { selectableOptions, resolveLabel, createMutation } =
    useStorageLocations();

  const itemQuery = useQuery({
    queryKey: itemKey,
    queryFn: () => {
      if (!activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return getInventoryItem(id, activeSpaceId);
    },
    enabled: Boolean(id && activeSpaceId && isReady),
  });

  const updateMutation = useMutation({
    mutationFn: (values: Partial<InventoryFormValues>) => {
      if (!activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return updateInventoryItem(
        id,
        {
          ...values,
          expectedVersion: itemQuery.data?.version,
        },
        activeSpaceId,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKey });
      queryClient.invalidateQueries({ queryKey: dashboardKey });
      queryClient.invalidateQueries({ queryKey: itemKey });
    },
  });

  const form = useForm<InventoryFormInput, undefined, InventoryFormValues>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues: {
      displayName: "",
      quantity: 1,
      storageLocation: "fridge",
      expiryDate: "",
      expirySource: ExpirySource.MANUAL,
    },
  });
  const editFormHydratedRef = useRef(false);

  useEffect(() => {
    if (!itemQuery.data) {
      editFormHydratedRef.current = false;
      return;
    }

    if (editFormHydratedRef.current) {
      return;
    }

    form.reset(inventoryItemToFormValues(itemQuery.data));
    editFormHydratedRef.current = true;
  }, [form, itemQuery.data]);

  const quantity = Number(form.watch("quantity")) || 1;
  const watchedUnit = form.watch("unit");
  const unit =
    typeof watchedUnit === "string" && watchedUnit.trim().length > 0
      ? watchedUnit
      : "개";
  const displayName = form.watch("displayName")?.trim() ?? "";
  const expiryDate = form.watch("expiryDate");
  const expirySource = form.watch("expirySource");
  const storageLocation = form.watch("storageLocation");
  const watchedBrand = form.watch("brand");
  const brand = typeof watchedBrand === "string" ? watchedBrand.trim() : "";
  const category = form.watch("category");
  const watchedNotes = form.watch("notes");
  const notes = typeof watchedNotes === "string" ? watchedNotes.trim() : "";
  const quantityLabel = quantityInputLabel(unit, { remaining: true });
  const enteredQuantityLabel = formatEnteredQuantity(quantity, unit);
  const quantityUnitSuffix = resolveQuantityInputUnit(unit);
  const extraDetailsLabel = extraDetailsRowLabel({ brand, category, notes });
  const stepIndex = EDIT_STEPS.findIndex((step) => step.key === editStep);
  const isLastEditStep = editStep === "expiry";
  const canGoNext = isLastEditStep
    ? Boolean(displayName && storageLocation && expiryDate) && quantity > 0
    : (editStep === "product" && Boolean(displayName)) ||
      (editStep === "quantity" && Boolean(storageLocation) && quantity > 0);
  const primaryCtaLabel = isLastEditStep
    ? "이렇게 바꿔둘까요?"
    : editStep === "product"
      ? "이 재료로 할게요"
      : "이만큼 둘게요";

  const item = itemQuery.data;
  const isFinalStatus =
    item?.status === ItemStatus.CONSUMED ||
    item?.status === ItemStatus.DISCARDED;
  const selectedLocationLabel = resolveLabel(storageLocation);

  const leaveScreen = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/inventory");
  }, []);

  const goToPreviousEditStep = useCallback(() => {
    if (stepIndex <= 0) {
      leaveScreen();
      return;
    }

    setEditStep(EDIT_STEPS[stepIndex - 1].key);
  }, [leaveScreen, stepIndex]);

  const goToEditStep = useCallback(
    (target: EditStep, options?: { openLocation?: boolean }) => {
      setShowLocationPicker(Boolean(options?.openLocation));
      setEditStep(target);
    },
    [],
  );

  const goToNextEditStep = () => {
    const nextStep = EDIT_STEPS[Math.min(EDIT_STEPS.length - 1, stepIndex + 1)];
    setEditStep(nextStep.key);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "내용 바꾸기",
      headerLeft: () => <HeaderBackButton onPress={goToPreviousEditStep} />,
    });
  }, [goToPreviousEditStep, navigation]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        goToPreviousEditStep();
        return true;
      },
    );

    return () => subscription.remove();
  }, [goToPreviousEditStep]);

  const handlePresetDate = (presetDate: string) => {
    form.setValue("expiryDate", presetDate, {
      shouldValidate: true,
    });
    form.setValue("expirySource", ExpirySource.PRESET, {
      shouldValidate: true,
    });
  };

  const applyQuantityUnit = (nextUnit: string) => {
    const next = quantityValuesForInputUnit({
      quantity,
      fromUnit: unit,
      toUnit: nextUnit,
    });
    form.setValue("unit", next.unit, { shouldValidate: true });
    form.setValue("quantity", next.quantity, { shouldValidate: true });
  };

  const handleSave = form.handleSubmit(async (values) => {
    try {
      setErrorMessage(null);
      const canonical = toBaseQuantity(values.quantity, values.unit);
      await updateMutation.mutateAsync({
        ...values,
        quantityBase: canonical.quantityBase,
        unitCode: canonical.unitCode,
        unit: values.unit || "개",
      });
      leaveScreen();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
      );
    }
  });

  if (itemQuery.isLoading) {
    return (
      <Screen contentWidth="form" topInsetMode="none">
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
      <Screen contentWidth="form" topInsetMode="none">
        <EmptyState
          mood="worry"
          title="이 재료를 찾지 못했어요"
          description="목록으로 돌아가서 다시 골라볼까요?"
          actionLabel="뒤로가기"
          onAction={leaveScreen}
        />
      </Screen>
    );
  }

  if (isFinalStatus) {
    return (
      <Screen contentWidth="form" topInsetMode="none">
        <EmptyState
          mood="happy"
          title={
            item.status === ItemStatus.CONSUMED
              ? "이미 다 드신 재료예요"
              : "이미 정리한 재료예요"
          }
          description="보관함에서 다른 재료를 살펴볼까요?"
          actionLabel="뒤로가기"
          onAction={leaveScreen}
        />
      </Screen>
    );
  }

  return (
    <Screen
      contentWidth="form"
      contentStyle={inventoryFormStyles.screenSections}
      topInsetMode="none"
      testID="inventory-edit-screen"
      footer={
        <View style={inventoryFormStyles.footerStack}>
          {isLastEditStep && !expiryDate ? (
            <AppText
              style={inventoryFormStyles.ctaHint}
              accessibilityLiveRegion="polite"
            >
              날짜만 골라 주시면 바꿀게요
            </AppText>
          ) : null}
          <Button
            icon={isLastEditStep ? CheckCircle2 : ChevronRight}
            iconPosition="right"
            onPress={isLastEditStep ? handleSave : goToNextEditStep}
            loading={updateMutation.isPending}
            disabled={!canGoNext}
            fullWidth
          >
            {primaryCtaLabel}
          </Button>
        </View>
      }
    >
      {errorMessage ? (
        <FeedbackBanner
          tone="danger"
          title="앗, 잠시 문제가 생겼어요"
          description={errorMessage}
          transient
          onDismiss={() => setErrorMessage(null)}
        />
      ) : null}

      <StepFlow
        steps={EDIT_STEPS}
        currentIndex={Math.max(stepIndex, 0)}
        onBack={goToPreviousEditStep}
        density="compact"
        hideBack
        guideMessage={EDIT_STEPS[Math.max(stepIndex, 0)]?.guideMessage}
        guideMood="speak"
      >
        {editStep === "product" ? (
          <InventoryProductNameStep control={form.control} />
        ) : null}

        {editStep === "quantity" ? (
          <InventoryQuantityStep
            quantityLabel={quantityLabel}
            quantityUnitSuffix={quantityUnitSuffix}
            quantity={quantity}
            unit={unit}
            quantityError={form.formState.errors.quantity?.message}
            onChangeQuantity={(nextQuantity) =>
              form.setValue("quantity", nextQuantity, {
                shouldValidate: true,
              })
            }
            onChangeUnit={applyQuantityUnit}
            showLocationPicker={showLocationPicker}
            selectedLocationKey={storageLocation}
            selectedLocationLabel={selectedLocationLabel}
            locationOptions={selectableOptions}
            onExpandLocation={() => setShowLocationPicker(true)}
            onSelectLocation={(key) => {
              form.setValue("storageLocation", key, {
                shouldValidate: true,
              });
              setShowLocationPicker(false);
            }}
            onAddLocation={() => {
              setNewLocationLabel("");
              setAddLocationVisible(true);
            }}
            extraDetailsLabel={extraDetailsLabel}
            onOpenExtraDetails={() => setShowAdditionalInfo(true)}
          />
        ) : null}

        {editStep === "expiry" ? (
          <InventoryExpiryStep
            expiryDate={expiryDate}
            expirySource={expirySource}
            expiryError={form.formState.errors.expiryDate?.message}
            onChangeDate={(nextDate) => {
              form.setValue("expiryDate", nextDate, {
                shouldValidate: true,
              });
              form.setValue("expirySource", ExpirySource.MANUAL, {
                shouldValidate: true,
              });
            }}
            onSelectPreset={handlePresetDate}
          >
            <RecapCard>
              <RecapRow
                label="재료"
                value={displayName}
                onPress={() => goToEditStep("product")}
              />
              <RecapRow
                label="양"
                value={enteredQuantityLabel}
                onPress={() => goToEditStep("quantity")}
              />
              <RecapRow
                label="자리"
                value={selectedLocationLabel}
                onPress={() =>
                  goToEditStep("quantity", { openLocation: true })
                }
              />
            </RecapCard>
          </InventoryExpiryStep>
        ) : null}
      </StepFlow>

      <AdditionalInfoSheet
        visible={showAdditionalInfo && editStep === "quantity"}
        onClose={() => setShowAdditionalInfo(false)}
        control={form.control}
        category={category}
        onSelectCategory={(value: ProductCategory) =>
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
