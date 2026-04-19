import {
  DEFAULT_INVENTORY_FORM,
  ExpirySource,
  expiryPresetOptions,
  inventoryFormSchema,
  productCategoryOptions,
  storageLocationOptions,
} from "@expirymate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Alert, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { Button } from "../src/components/Button";
import { FormField } from "../src/components/FormField";
import { Pill } from "../src/components/Pill";
import { Screen } from "../src/components/Screen";
import { useSaveInventoryItem } from "../src/features/registration/use-save-inventory-item";
import { addDays, toIsoDate } from "@expirymate/shared";
import { colors, spacing } from "../src/shared/theme";
import { useRegistrationStore } from "../src/store/registration-store";

type InventoryFormInput = z.input<typeof inventoryFormSchema>;
type InventoryFormValues = z.output<typeof inventoryFormSchema>;

export default function RegisterScreen() {
  const prefill = useRegistrationStore((state) => state.prefill);
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);
  const mutation = useSaveInventoryItem();

  const form = useForm<InventoryFormInput, undefined, InventoryFormValues>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues: {
      ...DEFAULT_INVENTORY_FORM,
      productId: prefill?.productId,
      barcode: prefill?.barcode ?? "",
      displayName: prefill?.displayName ?? "",
      brand: prefill?.brand ?? "",
      category: prefill?.category,
    },
  });

  useEffect(() => {
    if (prefill) {
      form.reset({
        ...DEFAULT_INVENTORY_FORM,
        productId: prefill.productId,
        barcode: prefill.barcode ?? "",
        displayName: prefill.displayName ?? "",
        brand: prefill.brand ?? "",
        category: prefill.category,
      });
    }
  }, [form, prefill]);

  const handlePreset = (days: number) => {
    form.setValue("expiryDate", toIsoDate(addDays(new Date(), days)));
    form.setValue("expirySource", ExpirySource.PRESET);
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
      router.replace({
        pathname: "/inventory/[id]",
        params: { id: created.id },
      });
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
      subtitle="유통기한은 별도로 입력해주세요. 바코드는 상품 식별용으로만 사용돼요."
    >
      <View style={styles.formCard}>
        <FormField control={form.control} name="displayName" label="상품명" placeholder="예: 서울우유 1L" />
        <FormField control={form.control} name="brand" label="브랜드" placeholder="예: 서울우유" />
        <FormField control={form.control} name="barcode" label="바코드" placeholder="스캔하거나 직접 입력" />
        <FormField control={form.control} name="expiryDate" label="유통기한" placeholder="YYYY-MM-DD 또는 ISO 문자열" />
        <FormField control={form.control} name="quantity" label="수량" placeholder="1" keyboardType="numeric" />
        <FormField control={form.control} name="unit" label="단위" placeholder="개 / 통 / 봉" />
        <FormField control={form.control} name="notes" label="메모" placeholder="추가로 기록할 내용" multiline />
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
          {storageLocationOptions.map((option) => (
            <Pill
              key={option.value}
              label={option.label}
              selected={form.watch("storageLocation") === option.value}
              onPress={() => form.setValue("storageLocation", option.value as InventoryFormInput["storageLocation"])}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>카테고리</Text>
        <View style={styles.pillRow}>
          {productCategoryOptions.map((option) => (
            <Pill
              key={option.value}
              label={option.label}
              selected={form.watch("category") === option.value}
              onPress={() => form.setValue("category", option.value as InventoryFormInput["category"])}
            />
          ))}
        </View>
      </View>

      <Button onPress={onSubmit} loading={mutation.isPending}>
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
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
