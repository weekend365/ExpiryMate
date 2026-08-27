import {
  ExpirySource,
  StorageLocation,
  formatDateKorean,
  type InventoryPhotoParseScene,
} from "@expirymate/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Camera, ImageIcon, Refrigerator, ReceiptText, Trash2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../src/components/AppText";
import { AppTextInput } from "../src/components/AppTextInput";
import { BottomSheet } from "../src/components/BottomSheet";
import { Button } from "../src/components/Button";
import { DatePickerField } from "../src/components/DatePickerField";
import { Mascot } from "../src/components/Mascot";
import { Screen } from "../src/components/Screen";
import {
  ApiError,
  batchCreateInventoryItems,
  parseInventoryPhoto,
} from "../src/services/api";
import { useAuth } from "../src/features/auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../src/features/auth/session-boundary";
import {
  applyExpiryToAll,
  applyStorageLocationToAll,
  canSubmitPhotoIntake,
  candidatesToDrafts,
  draftsToCreateBody,
  photoIntakeReadyCount,
  type PhotoIntakeDraftItem,
} from "../src/features/photo-intake/photo-intake-draft";
import { pickInventoryPhoto } from "../src/features/photo-intake/pick-inventory-photo";
import { usePrivacyStatus } from "../src/features/privacy/use-privacy";
import {
  parseRegistrationReturnTo,
  registrationReturnHref,
} from "../src/features/registration/registration-return";
import { QuickExpiryPills } from "../src/features/inventory/inventory-form-ui";
import { useStorageLocations } from "../src/features/settings/use-storage-locations";
import { useActiveSpace } from "../src/features/spaces/space-provider";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../src/shared/theme";

type PhotoIntakeStep = "scene" | "source" | "loading" | "review" | "done";

export default function RegisterPhotoScreen() {
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const returnTo = parseRegistrationReturnTo(params.from);
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const { activeSpaceId } = useActiveSpace();
  const privacyStatusQuery = usePrivacyStatus();
  const { selectableOptions, resolveLabel } = useStorageLocations();
  const defaultLocation =
    selectableOptions[0]?.key ?? StorageLocation.FRIDGE;

  const [step, setStep] = useState<PhotoIntakeStep>("scene");
  const [scene, setScene] = useState<InventoryPhotoParseScene>("receipt");
  const [items, setItems] = useState<PhotoIntakeDraftItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const parseMutation = useMutation({
    mutationFn: async (photo: {
      uri: string;
      mimeType?: string;
      fileName?: string;
    }) => {
      if (!activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return parseInventoryPhoto({ scene, ...photo }, activeSpaceId);
    },
    onSuccess: (result) => {
      setItems(candidatesToDrafts(result.items, defaultLocation));
      setStep("review");
    },
    onError: (error) => {
      setStep("source");
      if (error instanceof ApiError && error.status === 412) {
        Alert.alert("안내를 먼저 살펴봐 주세요", "사진을 읽기 전에 안내를 확인해 주세요.", [
          {
            text: "안내 보러 갈게요",
            onPress: () => router.push("/privacy/ai-data-notice"),
          },
        ]);
        return;
      }
      Alert.alert(
        "앗, 잠시 문제가 생겼어요",
        error instanceof Error
          ? error.message
          : "사진을 읽지 못했어요. 다시 찍어 볼까요?",
      );
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return batchCreateInventoryItems(
        { items: draftsToCreateBody(items) },
        activeSpaceId,
      );
    },
    onSuccess: (result) => {
      setSavedCount(result.count);
      setStep("done");
      queryClient.invalidateQueries({
        queryKey: withInventorySpace(
          sessionQueryKeys.dashboard,
          sessionUserId,
          activeSpaceId,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: withInventorySpace(
          sessionQueryKeys.inventory,
          sessionUserId,
          activeSpaceId,
        ),
      });
    },
    onError: (error) => {
      Alert.alert(
        "앗, 잠시 문제가 생겼어요",
        error instanceof Error
          ? error.message
          : "냉장고에 넣지 못했어요. 다시 해볼까요?",
      );
    },
  });

  const readyCount = photoIntakeReadyCount(items);
  const canSubmit = canSubmitPhotoIntake(items);
  const editingItem = items.find((item) => item.localId === editingId) ?? null;

  const title = useMemo(() => {
    if (step === "scene") return "어떤 사진인가요?";
    if (step === "source") return "사진을 어떻게 넣을까요?";
    if (step === "loading") return "읽고 있어요";
    if (step === "review") return "이 재료들이 맞나요?";
    return "냉장고에 넣어 뒀어요";
  }, [step]);

  const subtitle = useMemo(() => {
    if (step === "scene") {
      return "영수증이면 산 목록을, 냉장고 사진이면 보이는 재료를 골라 드릴게요.";
    }
    if (step === "source") {
      return scene === "receipt"
        ? "글자가 잘 보이게 영수증을 찍어 주세요."
        : "조명이 밝은 쪽에서 냉장고를 찍어 주세요. 가려진 재료는 빠질 수 있어요.";
    }
    if (step === "loading") {
      return "장고가 사진을 살펴보는 중이에요. 잠깐만 기다려 주세요.";
    }
    if (step === "review") {
      return items.length
        ? "기한과 자리를 채운 뒤 한 번에 넣을게요. 틀린 줄은 눌러서 고쳐 주세요."
        : "이번에는 넣을 재료를 찾지 못했어요. 다른 사진으로 다시 해볼까요?";
    }
    return `${savedCount}가지를 냉장고에 잘 넣어 뒀어요.`;
  }, [items.length, savedCount, scene, step]);

  const ensureConsent = () => {
    if (privacyStatusQuery.data?.hasAcceptedCurrentAiDataNotice) {
      return true;
    }
    Alert.alert("안내를 먼저 살펴봐 주세요", "사진을 서버로 보내 재료를 읽기 전에 안내가 필요해요.", [
      {
        text: "안내 보러 갈게요",
        onPress: () => router.push("/privacy/ai-data-notice"),
      },
    ]);
    return false;
  };

  const startParse = async (source: "camera" | "library") => {
    if (!ensureConsent()) {
      return;
    }
    const photo = await pickInventoryPhoto(source);
    if (!photo) {
      return;
    }
    setStep("loading");
    parseMutation.mutate(photo);
  };

  const footer =
    step === "review" ? (
      <Button
        onPress={() => saveMutation.mutate()}
        loading={saveMutation.isPending}
        disabled={!canSubmit}
        fullWidth
      >
        {canSubmit
          ? `${items.length}가지 냉장고에 넣을게요`
          : "기한을 채운 뒤 넣을게요"}
      </Button>
    ) : step === "done" ? (
      <Button
        onPress={() => router.replace(registrationReturnHref(returnTo))}
        fullWidth
      >
        냉장고로 돌아갈게요
      </Button>
    ) : null;

  return (
    <>
      <Screen title={title} subtitle={subtitle} footer={footer}>
        {step === "scene" ? (
          <View style={styles.choiceStack}>
            <Button
              icon={ReceiptText}
              onPress={() => {
                setScene("receipt");
                setStep("source");
              }}
              fullWidth
            >
              장보기 영수증이에요
            </Button>
            <Button
              icon={Refrigerator}
              onPress={() => {
                setScene("fridge");
                setStep("source");
              }}
              variant="surface"
              fullWidth
            >
              냉장고 사진이에요
            </Button>
          </View>
        ) : null}

        {step === "source" ? (
          <View style={styles.choiceStack}>
            <Button icon={Camera} onPress={() => void startParse("camera")} fullWidth>
              지금 찍을게요
            </Button>
            <Button
              icon={ImageIcon}
              onPress={() => void startParse("library")}
              variant="surface"
              fullWidth
            >
              앨범에서 고를게요
            </Button>
            <Button
              variant="secondary"
              onPress={() => setStep("scene")}
              fullWidth
            >
              다른 사진 종류로 바꿀게요
            </Button>
          </View>
        ) : null}

        {step === "loading" ? (
          <View style={styles.loadingCard}>
            <Mascot mood="think" size="large" />
            <AppText variant="body" tone="subtext">
              글자와 재료를 천천히 읽고 있어요.
            </AppText>
          </View>
        ) : null}

        {step === "review" && items.length ? (
          <View style={styles.reviewStack}>
            {scene === "fridge" ? (
              <AppText variant="bodySmall" tone="subtext">
                냉장고 사진은 가려진 재료를 놓칠 수 있어요. 한번만 더 봐 주세요.
              </AppText>
            ) : null}
            <View style={styles.bulkCard}>
              <AppText style={styles.sectionTitle}>한 번에 자리 정하기</AppText>
              <View style={styles.pillRow}>
                {selectableOptions.map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() =>
                      setItems((current) =>
                        applyStorageLocationToAll(current, option.key),
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${option.label}에 둘게요`}
                    style={({ pressed }) => [
                      styles.pill,
                      pressed && styles.pillPressed,
                    ]}
                  >
                    <AppText style={styles.pillLabel}>{option.label}</AppText>
                  </Pressable>
                ))}
              </View>
              <QuickExpiryPills
                isSelected={(isoDate) =>
                  items.length > 0 && items.every((item) => item.expiryDate === isoDate)
                }
                onSelect={(isoDate) =>
                  setItems((current) =>
                    applyExpiryToAll(current, isoDate, ExpirySource.PRESET),
                  )
                }
              />
            </View>
            {items.map((item) => (
              <Pressable
                key={item.localId}
                onPress={() => setEditingId(item.localId)}
                accessibilityRole="button"
                accessibilityLabel={`${item.displayName} 고치기`}
                style={({ pressed }) => [
                  styles.itemCard,
                  pressed && styles.itemCardPressed,
                ]}
              >
                <View style={styles.itemCopy}>
                  <AppText style={styles.itemName}>{item.displayName}</AppText>
                  <AppText variant="bodySmall" tone="subtext">
                    {item.quantity}
                    {item.unit ?? "개"} · {resolveLabel(item.storageLocation)} ·{" "}
                    {item.expiryDate
                      ? formatDateKorean(item.expiryDate)
                      : "기한 없음"}
                  </AppText>
                  {item.needsReview && item.reason ? (
                    <AppText variant="caption" tone="muted">
                      {item.reason}
                    </AppText>
                  ) : null}
                </View>
                <Pressable
                  onPress={() =>
                    setItems((current) =>
                      current.filter((row) => row.localId !== item.localId),
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${item.displayName} 빼기`}
                  hitSlop={8}
                  style={styles.iconButton}
                >
                  <Trash2 color={colors.danger} size={spacing.md} />
                </Pressable>
              </Pressable>
            ))}
            <AppText variant="caption" tone="muted">
              {readyCount}/{items.length}가지 기한을 채웠어요.
            </AppText>
          </View>
        ) : null}

        {step === "review" && !items.length ? (
          <Button onPress={() => setStep("source")} fullWidth>
            다른 사진으로 다시 볼게요
          </Button>
        ) : null}

        {step === "done" ? (
          <View style={styles.loadingCard}>
            <Mascot mood="happy" size="large" />
          </View>
        ) : null}
      </Screen>

      <BottomSheet
        visible={Boolean(editingItem)}
        onClose={() => setEditingId(null)}
        title="이 재료를 고칠까요?"
        footer={
          <Button onPress={() => setEditingId(null)} fullWidth>
            이 내용으로 둘게요
          </Button>
        }
      >
        {editingItem ? (
          <View style={styles.editStack}>
            <AppTextInput
              value={editingItem.displayName}
              onChangeText={(displayName) =>
                updateItem(editingItem.localId, { displayName })
              }
              placeholder="재료 이름"
            />
            <DatePickerField
              label="유통기한"
              value={editingItem.expiryDate}
              onChange={(expiryDate) =>
                updateItem(editingItem.localId, {
                  expiryDate,
                  expirySource: ExpirySource.MANUAL,
                })
              }
            />
            <View style={styles.pillRow}>
              {selectableOptions.map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() =>
                    updateItem(editingItem.localId, {
                      storageLocation: option.key,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: editingItem.storageLocation === option.key,
                  }}
                  style={[
                    styles.pill,
                    editingItem.storageLocation === option.key &&
                      styles.pillSelected,
                  ]}
                >
                  <AppText
                    style={[
                      styles.pillLabel,
                      editingItem.storageLocation === option.key &&
                        styles.pillLabelSelected,
                    ]}
                  >
                    {option.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </>
  );

  function updateItem(
    localId: string,
    patch: Partial<PhotoIntakeDraftItem>,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.localId === localId ? { ...item, ...patch } : item,
      ),
    );
  }
}

const styles = StyleSheet.create({
  choiceStack: {
    gap: spacing.sm,
  },
  loadingCard: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  reviewStack: {
    gap: spacing.sm,
  },
  bulkCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  pill: {
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  pillPressed: {
    opacity: 0.86,
  },
  pillSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  pillLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.text,
  },
  pillLabelSelected: {
    color: colors.primary,
    fontFamily: typography.title.fontFamily,
  },
  itemCard: {
    minHeight: touchTarget.cta,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  itemCardPressed: {
    opacity: 0.86,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  itemName: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  iconButton: {
    minWidth: touchTarget.icon,
    minHeight: touchTarget.icon,
    alignItems: "center",
    justifyContent: "center",
  },
  editStack: {
    gap: spacing.sm,
  },
});
