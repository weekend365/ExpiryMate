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
  barcode: string;
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

const STORAGE_LOCATION_ORDER = [
  StorageLocation.FRIDGE,
  StorageLocation.FREEZER,
  StorageLocation.ROOM,
  StorageLocation.KITCHEN,
  StorageLocation.BATHROOM,
];

const createDefaultFormValues = (): RegistrationFormValues => ({
  productId: undefined,
  barcode: "",
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
    barcode: draft?.barcode ?? "",
    displayName: draft?.displayName ?? "",
    brand: draft?.brand ?? "",
  };

  if (prefill) {
    nextValues.productId = prefill.productId;
    nextValues.barcode = prefill.barcode ?? nextValues.barcode;
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
        prefill.barcode ?? "",
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
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(
    Boolean(prefill?.barcode),
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
      setShowAdditionalInfo(Boolean(prefill.barcode));
    }
  }, [draft, form, hasHydrated, prefill]);

  useEffect(() => {
    const subscription = form.watch((value) => {
      if (!hasHydrated || !initializedRef.current) {
        return;
      }

      setDraft({
        productId: value.productId,
        barcode: value.barcode,
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
  const barcode = form.watch("barcode")?.trim() ?? "";
  const expiryDate = form.watch("expiryDate");

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

      if (barcode && item.barcode === barcode) {
        return true;
      }

      return (
        Boolean(normalizedName) &&
        item.displayName.trim().toLowerCase() === normalizedName
      );
    });
  }, [barcode, displayName, inventory]);

  const applyRecentTemplate = (item: (typeof recentTemplates)[number]) => {
    form.setValue("productId", item.productId ?? undefined);
    form.setValue("barcode", item.barcode ?? "", { shouldValidate: true });
    form.setValue("displayName", item.displayName, { shouldValidate: true });
    form.setValue("brand", item.brand ?? "");
    form.setValue("category", item.category ?? undefined);
    form.setValue("unit", item.unit ?? "개");
    form.setValue("storageLocation", item.storageLocation, {
      shouldValidate: true,
    });
    setShowAdditionalInfo(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await mutation.mutateAsync({
        productId: values.productId,
        barcode: values.barcode || undefined,
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
            },
          },
          {
            text: "재고 보기",
            onPress: () => {
              form.reset(nextDefaults);
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
      subtitle="상품 식별은 바코드로, 유통기한은 빠른 선택이나 날짜 선택기로 입력해요."
    >
      {prefill?.displayName ? (
        <View style={styles.prefillCard}>
          <Text style={styles.prefillEyebrow}>스캔한 상품 정보</Text>
          <Text style={styles.prefillTitle}>{prefill.displayName}</Text>
          <Text style={styles.prefillDescription}>
            {prefill.brand ? `${prefill.brand} · ` : ""}
            상품 정보가 자동으로 채워졌어요. 유통기한과 수량만 확인하면 됩니다.
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

      {recentTemplates.length ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>최근 등록 상품 다시 쓰기</Text>
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

      <View style={styles.formCard}>
        <FormField
          control={form.control}
          name="displayName"
          label="상품명"
          placeholder="예: 서울우유 1L"
        />
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
        <QuantityStepper
          label="수량"
          value={quantity}
          onChange={(nextQuantity) =>
            form.setValue("quantity", nextQuantity, { shouldValidate: true })
          }
          error={form.formState.errors.quantity?.message}
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
          {expiryPresetOptions.map((option) => (
            <Pill
              key={option.days}
              label={option.label}
              onPress={() => handlePreset(option.days)}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>저장 위치</Text>
        <View style={styles.pillRow}>
          {STORAGE_LOCATION_ORDER.map((location) => (
            <Pill
              key={location}
              label={storageLocationLabels[location]}
              selected={form.watch("storageLocation") === location}
              onPress={() =>
                form.setValue("storageLocation", location, {
                  shouldValidate: true,
                })
              }
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Pressable
          onPress={() => setShowAdditionalInfo((current) => !current)}
          style={({ pressed }) => [
            styles.toggleRow,
            pressed && { opacity: 0.82 },
          ]}
        >
          <View>
            <Text style={styles.sectionTitle}>추가 정보</Text>
            <Text style={styles.sectionDescription}>
              브랜드, 카테고리, 바코드, 메모는 필요할 때만 입력하세요.
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
              name="barcode"
              label="바코드"
              placeholder="스캔하거나 직접 입력"
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
                    selected={form.watch("category") === option.value}
                    onPress={() =>
                      form.setValue("category", option.value as ProductCategory, {
                        shouldValidate: true,
                      })
                    }
                  />
                ))}
              </View>
              {form.watch("category") ? (
                <Text style={styles.inlineMetaValue}>
                  현재 선택: {productCategoryLabels[form.watch("category") as ProductCategory]}
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

      <Button
        onPress={onSubmit}
        loading={mutation.isPending}
        disabled={!displayName || !expiryDate}
      >
        등록하기
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
  },
  prefillCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  prefillEyebrow: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
  },
  prefillTitle: {
    fontSize: 22,
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
    borderRadius: 24,
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
    borderRadius: 24,
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
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
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
    borderRadius: 18,
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
    borderRadius: 18,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: 4,
  },
  templateCardPressed: {
    opacity: 0.82,
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
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
});
