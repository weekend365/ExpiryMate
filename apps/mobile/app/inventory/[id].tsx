import {
  ExpirySource,
  ItemStatus,
  ProductCategory,
  StorageLocation,
  productCategoryOptions,
  storageLocationOptions,
  inventoryFormSchema,
} from "@expirymate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Alert, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { Button } from "../../src/components/Button";
import { FormField } from "../../src/components/FormField";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import {
  consumeInventoryItem,
  discardInventoryItem,
  getInventoryItem,
  updateInventoryItem,
} from "../../src/services/api";
import { colors, spacing } from "../../src/shared/theme";

type InventoryFormInput = z.input<typeof inventoryFormSchema>;
type InventoryFormValues = z.output<typeof inventoryFormSchema>;

export default function InventoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const itemQuery = useQuery({
    queryKey: ["inventory-item", id],
    queryFn: () => getInventoryItem(id),
    enabled: Boolean(id),
  });

  const updateMutation = useMutation({
    mutationFn: (values: Partial<InventoryFormValues>) => updateInventoryItem(id, values),
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

  const handleSave = form.handleSubmit(async (values) => {
    try {
      await updateMutation.mutateAsync(values);
      Alert.alert("수정했어요", "재고 정보가 업데이트되었습니다.");
    } catch (error) {
      Alert.alert(
        "수정에 실패했어요",
        error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
      );
    }
  });

  const isFinalStatus =
    itemQuery.data?.status === ItemStatus.CONSUMED ||
    itemQuery.data?.status === ItemStatus.DISCARDED;

  return (
    <Screen
      title={itemQuery.data?.displayName ?? "재고 상세"}
      subtitle="재료 정보 수정, 사용 완료, 폐기 처리를 할 수 있어요."
    >
      <View style={styles.formCard}>
        <FormField control={form.control} name="displayName" label="재료명" />
        <FormField control={form.control} name="brand" label="브랜드" />
        <FormField control={form.control} name="expiryDate" label="유통기한" />
        <FormField control={form.control} name="quantity" label="수량" keyboardType="numeric" />
        <FormField control={form.control} name="unit" label="단위" />
        <FormField control={form.control} name="notes" label="메모" multiline />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>저장 위치</Text>
        <View style={styles.pillRow}>
          {storageLocationOptions.map((option) => (
            <Pill
              key={option.value}
              label={option.label}
              selected={form.watch("storageLocation") === option.value}
              onPress={() =>
                form.setValue("storageLocation", option.value as StorageLocation)
              }
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
              onPress={() =>
                form.setValue("category", option.value as ProductCategory)
              }
            />
          ))}
        </View>
      </View>

      <Button onPress={handleSave} loading={updateMutation.isPending}>
        수정
      </Button>

      {!isFinalStatus ? (
        <View style={styles.actionRow}>
          <Button
            variant="secondary"
            onPress={() => consumeMutation.mutate()}
            loading={consumeMutation.isPending}
            style={styles.actionButton}
          >
            소비 완료
          </Button>
          <Button
            variant="danger"
            onPress={() => discardMutation.mutate()}
            loading={discardMutation.isPending}
            style={styles.actionButton}
          >
            폐기
          </Button>
        </View>
      ) : null}
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
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});
