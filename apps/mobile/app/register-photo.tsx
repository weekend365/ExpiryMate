import {
  ExpirySource,
  StorageLocation,
  formatDateKorean,
  type InventoryPhotoParseAccess,
  type InventoryPhotoParseScene,
} from "@expirymate/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Check,
  ImageIcon,
  Refrigerator,
  ReceiptText,
  Trash2,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../src/components/AppText";
import { AppTextInput } from "../src/components/AppTextInput";
import { BottomSheet } from "../src/components/BottomSheet";
import { Button } from "../src/components/Button";
import { DatePickerField } from "../src/components/DatePickerField";
import { FeedbackBanner } from "../src/components/FeedbackBanner";
import { Mascot } from "../src/components/Mascot";
import { QuantityStepper } from "../src/components/QuantityStepper";
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
  prioritizePhotoIntakeDrafts,
  type PhotoIntakeDraftItem,
} from "../src/features/photo-intake/photo-intake-draft";
import { pickInventoryPhoto } from "../src/features/photo-intake/pick-inventory-photo";
import {
  isSamePhotoIntakeSelection,
  loadRecentPhotoIntakeSelection,
  saveRecentPhotoIntakeSelection,
  type PhotoIntakeSelection,
} from "../src/features/photo-intake/photo-intake-selection";
import { usePrivacyStatus } from "../src/features/privacy/use-privacy";
import {
  parseRegistrationReturnTo,
  registerRoute,
  registrationReturnHref,
} from "../src/features/registration/registration-return";
import { usePhotoParseAccess } from "../src/features/photo-intake/use-photo-parse-access";
import { resolvePhotoParseAccessUi } from "../src/features/photo-intake/photo-parse-access-ui";
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

type PhotoIntakeStep = "choose" | "loading" | "review" | "done";

type FlowIssue = {
  title: string;
  description?: string;
  tone?: "danger" | "warning" | "info" | "success";
};

export default function RegisterPhotoScreen() {
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const returnTo = parseRegistrationReturnTo(params.from);
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const { activeSpaceId } = useActiveSpace();
  const privacyStatusQuery = usePrivacyStatus();
  const photoAccess = usePhotoParseAccess();
  const { selectableOptions, resolveLabel } = useStorageLocations();
  const defaultLocation =
    selectableOptions[0]?.key ?? StorageLocation.FRIDGE;

  const [step, setStep] = useState<PhotoIntakeStep>("choose");
  const [selectedSelection, setSelectedSelection] =
    useState<PhotoIntakeSelection | null>(null);
  const [recentSelection, setRecentSelection] =
    useState<PhotoIntakeSelection | null>(null);
  const [albumScene, setAlbumScene] =
    useState<InventoryPhotoParseScene>("receipt");
  const [awaitingConsent, setAwaitingConsent] = useState(false);
  const [flowIssue, setFlowIssue] = useState<FlowIssue | null>(null);
  const [items, setItems] = useState<PhotoIntakeDraftItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const parseMutation = useMutation({
    mutationFn: async ({
      photo,
      scene,
    }: {
      photo: { uri: string; mimeType?: string; fileName?: string };
      scene: InventoryPhotoParseScene;
    }) => {
      if (!activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return parseInventoryPhoto({ scene, ...photo }, activeSpaceId);
    },
    onSuccess: (result) => {
      setItems(
        prioritizePhotoIntakeDrafts(
          candidatesToDrafts(result.items, defaultLocation),
        ),
      );
      setStep("review");
      setFlowIssue(null);
      void photoAccess.refresh();
    },
    onError: (error) => {
      setStep("choose");
      void photoAccess.refresh();
      if (error instanceof ApiError && error.status === 412) {
        setAwaitingConsent(true);
        router.push("/privacy/ai-data-notice?from=register-photo");
        return;
      }
      setFlowIssue({
        title: "사진을 읽지 못했어요",
        description: error instanceof Error
          ? error.message
          : "사진을 읽지 못했어요. 다시 찍어 볼까요?",
      });
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
  const parsePhoto = parseMutation.mutate;
  const refetchPrivacyStatus = privacyStatusQuery.refetch;

  const readyCount = photoIntakeReadyCount(items);
  const canSubmit = canSubmitPhotoIntake(items);
  const editingItem = items.find((item) => item.localId === editingId) ?? null;
  const scene = selectedSelection?.scene ?? albumScene;
  const accessUi = resolvePhotoParseAccessUi(
    photoAccess.access,
    photoAccess.adState,
    photoAccess.isLoading,
  );

  useEffect(() => {
    if (!sessionUserId) return;
    let active = true;
    void loadRecentPhotoIntakeSelection(sessionUserId)
      .then((selection) => {
        if (!active || !selection) return;
        setRecentSelection(selection);
        setAlbumScene(selection.scene);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [sessionUserId]);

  const title = useMemo(() => {
    if (step === "choose") return "어떤 사진으로 넣을까요?";
    if (step === "loading") return "읽고 있어요";
    if (step === "review") return "이 재료들이 맞나요?";
    return "냉장고에 넣어 뒀어요";
  }, [step]);

  const subtitle = useMemo(() => {
    if (step === "choose") {
      return "사진 종류와 가져올 곳을 한 번에 고르면 바로 여러 재료를 찾아 드릴게요.";
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
  }, [items.length, savedCount, step]);

  const openPhotoSelection = useCallback(
    async (selection: PhotoIntakeSelection, skipAccessCheck = false) => {
      if (!skipAccessCheck && !accessUi.canSelectPhoto) {
        setFlowIssue(photoAccessIssue(photoAccess.access, photoAccess.adState));
        return;
      }

      setFlowIssue(null);
      try {
        const result = await pickInventoryPhoto(selection.source);
        if (result.status === "cancelled") return;
        if (result.status === "permission-denied") {
          setFlowIssue({
            title:
              selection.source === "camera"
                ? "카메라 권한이 필요해요"
                : "사진 접근 권한이 필요해요",
            description:
              selection.source === "camera"
                ? "권한을 허용한 뒤 같은 영수증 또는 냉장고 촬영을 다시 눌러 주세요."
                : "권한을 허용한 뒤 선택해 둔 앨범 사진 종류로 다시 시도해 주세요.",
          });
          return;
        }

        setRecentSelection(selection);
        if (sessionUserId) {
          void saveRecentPhotoIntakeSelection(sessionUserId, selection).catch(
            () => undefined,
          );
        }
        setStep("loading");
        parsePhoto({ photo: result.photo, scene: selection.scene });
      } catch (error) {
        setFlowIssue({
          title: "사진 선택기를 열지 못했어요",
          description:
            error instanceof Error
              ? error.message
              : "잠시 후 같은 방법으로 다시 시도해 주세요.",
        });
      }
    },
    [
      accessUi.canSelectPhoto,
      parsePhoto,
      photoAccess.access,
      photoAccess.adState,
      sessionUserId,
    ],
  );

  const choosePhoto = async (selection: PhotoIntakeSelection) => {
    setSelectedSelection(selection);
    setFlowIssue(null);
    const privacyStatus =
      privacyStatusQuery.data ?? (await refetchPrivacyStatus()).data;
    if (!privacyStatus?.hasAcceptedCurrentAiDataNotice) {
      setAwaitingConsent(true);
      router.push("/privacy/ai-data-notice?from=register-photo");
      return;
    }
    void openPhotoSelection(selection);
  };

  useFocusEffect(
    useCallback(() => {
      if (!awaitingConsent || !selectedSelection) return undefined;
      let active = true;
      void refetchPrivacyStatus().then((result) => {
        if (!active) return;
        if (!result.data?.hasAcceptedCurrentAiDataNotice) {
          setFlowIssue({
            tone: "warning",
            title: "AI 데이터 안내 동의가 필요해요",
            description:
              "선택한 사진 방법은 그대로 두었어요. 다시 눌러 안내를 확인하거나 직접 등록해 주세요.",
          });
          return;
        }
        setAwaitingConsent(false);
        void openPhotoSelection(selectedSelection);
      });
      return () => {
        active = false;
      };
    }, [
      awaitingConsent,
      openPhotoSelection,
      refetchPrivacyStatus,
      selectedSelection,
    ]),
  );

  const watchPhotoAd = async () => {
    try {
      const result = await photoAccess.watchRewardedAd();
      if (result === "verified") {
        if (selectedSelection) {
          if (!privacyStatusQuery.data?.hasAcceptedCurrentAiDataNotice) {
            setAwaitingConsent(true);
            router.push("/privacy/ai-data-notice?from=register-photo");
            return;
          }
          await openPhotoSelection(selectedSelection, true);
        } else {
          setFlowIssue({
            tone: "success",
            title: "사진 분석 1회가 준비됐어요",
            description: "아래에서 사용할 사진을 골라 주세요.",
          });
        }
      } else {
        setFlowIssue({
          tone: "info",
          title: "광고 보상을 확인하고 있어요",
          description:
            "확인이 끝나면 선택해 둔 방법을 그대로 다시 시도할 수 있어요.",
        });
      }
    } catch (error) {
      setFlowIssue({
        title: "광고를 완료하지 못했어요",
        description: error instanceof Error
          ? error.message
          : "잠시 후 다시 시도해 주세요.",
      });
    }
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
        {step === "choose" ? (
          <View style={styles.choiceStack}>
            <View style={styles.accessCard} accessibilityLiveRegion="polite">
              <View style={styles.accessHeadingRow}>
                <AppText style={styles.sectionTitle}>사진 분석 이용 조건</AppText>
                <AppText variant="caption" tone="primary">
                  선택 전에 확인
                </AppText>
              </View>
              <AppText variant="bodyStrong">
                {photoAccessSummary(photoAccess.access, photoAccess.isLoading)}
              </AppText>
              {photoAccess.access ? (
                <AppText variant="bodySmall" tone="subtext">
                  {photoAccess.access.subscriptionQuota
                    ? `이번 달 ${photoAccess.access.subscriptionQuota.monthly.used}/${photoAccess.access.subscriptionQuota.monthly.limit}회 · 오늘 ${photoAccess.access.subscriptionQuota.daily.used}/${photoAccess.access.subscriptionQuota.daily.limit}회 사용`
                    : `무료 ${photoAccess.access.free.used}/${photoAccess.access.free.limit}회 사용 · 광고 추가 ${photoAccess.access.rewardedAds.verified}/${photoAccess.access.rewardedAds.dailyLimit}회 사용`}
                </AppText>
              ) : null}
              <AppText variant="bodySmall" tone="subtext">
                {privacyStatusQuery.data?.hasAcceptedCurrentAiDataNotice
                  ? "AI 데이터 안내 동의 완료"
                  : "첫 이용 시 선택 후 AI 데이터 안내 동의가 필요해요."}
              </AppText>
            </View>

            {flowIssue ? (
              <FeedbackBanner
                tone={flowIssue.tone}
                title={flowIssue.title}
                description={flowIssue.description}
                showMascot={false}
              />
            ) : null}

            <AppText style={styles.sectionTitle}>사진과 가져올 곳을 골라 주세요</AppText>
            <PhotoChoiceCard
              icon={ReceiptText}
              title="영수증 촬영"
              description="구매 목록을 한 번에 찾아요"
              detail="글자가 잘 보이도록 펼쳐서 찍어 주세요."
              recommended={isSamePhotoIntakeSelection(recentSelection, {
                scene: "receipt",
                source: "camera",
              })}
              selected={isSamePhotoIntakeSelection(selectedSelection, {
                scene: "receipt",
                source: "camera",
              })}
              onPress={() =>
                void choosePhoto({ scene: "receipt", source: "camera" })
              }
            />
            <PhotoChoiceCard
              icon={Refrigerator}
              title="냉장고 촬영"
              description="보이는 재료를 여러 개 찾아요"
              detail="밝은 곳에서 문 안쪽까지 보이게 찍어 주세요."
              recommended={isSamePhotoIntakeSelection(recentSelection, {
                scene: "fridge",
                source: "camera",
              })}
              selected={isSamePhotoIntakeSelection(selectedSelection, {
                scene: "fridge",
                source: "camera",
              })}
              onPress={() =>
                void choosePhoto({ scene: "fridge", source: "camera" })
              }
            />
            <PhotoChoiceCard
              icon={ImageIcon}
              title="앨범에서 가져오기"
              description={
                albumScene === "receipt"
                  ? "저장한 영수증에서 구매 목록을 찾아요"
                  : "저장한 냉장고 사진에서 여러 재료를 찾아요"
              }
              detail="아래 사진 종류를 확인한 뒤 앨범을 열어 주세요."
              recommended={isSamePhotoIntakeSelection(recentSelection, {
                scene: albumScene,
                source: "library",
              })}
              selected={isSamePhotoIntakeSelection(selectedSelection, {
                scene: albumScene,
                source: "library",
              })}
              onPress={() =>
                void choosePhoto({ scene: albumScene, source: "library" })
              }
            />
            <View style={styles.albumSceneCard}>
              <AppText variant="bodySmall" tone="subtext">
                앨범에서 가져올 사진 종류
              </AppText>
              <View style={styles.pillRow}>
                <ScenePill
                  label="영수증 사진"
                  selected={albumScene === "receipt"}
                  onPress={() => {
                    setAlbumScene("receipt");
                    if (selectedSelection?.source === "library") {
                      setSelectedSelection(null);
                    }
                  }}
                />
                <ScenePill
                  label="냉장고 사진"
                  selected={albumScene === "fridge"}
                  onPress={() => {
                    setAlbumScene("fridge");
                    if (selectedSelection?.source === "library") {
                      setSelectedSelection(null);
                    }
                  }}
                />
              </View>
            </View>

            {accessUi.showVerifying ? (
              <Button onPress={() => undefined} disabled fullWidth>
                광고 보상 확인 중
              </Button>
            ) : accessUi.showWatchAd ? (
              <Button
                onPress={() => void watchPhotoAd()}
                loading={photoAccess.adState === "loading"}
                fullWidth
              >
                광고 보고 사진 분석 1회 받기
              </Button>
            ) : null}

            {accessUi.dailyLimitReached ? (
              <View style={styles.limitCard} accessibilityLiveRegion="polite">
                <AppText variant="bodyStrong">오늘 분석 4회를 모두 사용했어요</AppText>
                <AppText variant="bodySmall" tone="subtext">
                  {formatResetTime(photoAccess.access?.resetsAt)}에 다시 사용할 수 있어요.
                </AppText>
              </View>
            ) : null}

            <Button
              variant="surface"
              onPress={() => router.replace(registerRoute(returnTo))}
              fullWidth
            >
              사진 없이 직접 등록하기
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
                  (item.needsReview || !item.expiryDate) &&
                    styles.itemCardNeedsAttention,
                  pressed && styles.itemCardPressed,
                ]}
              >
                <View style={styles.itemCopy}>
                  <View style={styles.itemTitleRow}>
                    <AppText style={styles.itemName}>{item.displayName}</AppText>
                    {item.needsReview || !item.expiryDate ? (
                      <View style={styles.attentionBadge}>
                        <AppText variant="caption" tone="warning">
                          확인 필요
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                  <AppText variant="bodySmall" tone="subtext">
                    {item.quantity}
                    {item.unit || "개"} · {resolveLabel(item.storageLocation)} ·{" "}
                    {item.expiryDate
                      ? formatDateKorean(item.expiryDate)
                      : "기한 없음"}
                  </AppText>
                  {item.needsReview || !item.expiryDate ? (
                    <AppText variant="caption" tone="warning">
                      {item.reason ?? "유통기한을 확인해 주세요."}
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
          <View style={styles.choiceStack}>
            <Button
              onPress={() => {
                setFlowIssue(null);
                setStep("choose");
              }}
              fullWidth
            >
              다른 사진으로 다시 볼게요
            </Button>
            <Button
              variant="surface"
              onPress={() => router.replace(registerRoute(returnTo))}
              fullWidth
            >
              사진 없이 직접 등록하기
            </Button>
          </View>
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
            <QuantityStepper
              label="수량"
              value={editingItem.quantity}
              unitSuffix={editingItem.unit || "개"}
              onChange={(quantity) =>
                updateItem(editingItem.localId, { quantity })
              }
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

function PhotoChoiceCard({
  icon: Icon,
  title,
  description,
  detail,
  recommended,
  selected,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  detail: string;
  recommended: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${description}${recommended ? ", 최근 사용한 추천 방법" : ""}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.photoChoiceCard,
        selected && styles.photoChoiceCardSelected,
        pressed && styles.photoChoiceCardPressed,
      ]}
    >
      <View style={styles.photoChoiceIcon}>
        <Icon color={colors.primary} size={spacing.md} strokeWidth={2.2} />
      </View>
      <View style={styles.photoChoiceCopy}>
        <View style={styles.photoChoiceTitleRow}>
          <AppText variant="bodyStrong">{title}</AppText>
          {recommended ? (
            <View style={styles.recommendBadge}>
              <AppText variant="caption" tone="primary">
                최근 사용 · 추천
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="bodySmall">{description}</AppText>
        <AppText variant="caption" tone="subtext">
          {detail}
        </AppText>
      </View>
      {selected ? <Check color={colors.primary} size={spacing.sm} /> : null}
    </Pressable>
  );
}

function ScenePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.pill,
        selected && styles.pillSelected,
        pressed && styles.pillPressed,
      ]}
    >
      <AppText
        style={[styles.pillLabel, selected && styles.pillLabelSelected]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function photoAccessSummary(
  access: InventoryPhotoParseAccess | undefined,
  isLoading: boolean,
) {
  if (!access) {
    return isLoading
      ? "사용 가능한 횟수를 확인하고 있어요"
      : "이용 조건을 불러오지 못했어요";
  }
  if (access.canParse) {
    if (access.subscriptionQuota) {
      return `이번 달 ${access.subscriptionQuota.monthly.remaining}회 · 오늘 ${access.subscriptionQuota.daily.remaining}회 남았어요`;
    }
    if (access.rewardedAds.creditsAvailable > 0) {
      return `사진 분석권 ${access.rewardedAds.creditsAvailable}회 사용 가능`;
    }
    const remaining = Math.max(0, access.free.limit - access.free.used);
    return `오늘 무료 분석 ${remaining}회 남았어요`;
  }
  if (access.requiredAction === "watch_ad") {
    return "무료 분석 사용 완료 · 광고 시청 후 1회 가능";
  }
  if (access.requiredAction === "daily_limit_reached") {
    return `오늘 사용 가능 횟수를 모두 썼어요 · ${formatResetTime(access.resetsAt)} 초기화`;
  }
  return "지금은 광고 사진 분석을 사용할 수 없어요";
}

function photoAccessIssue(
  access: InventoryPhotoParseAccess | undefined,
  adState: "idle" | "loading" | "verifying",
): FlowIssue {
  if (adState === "verifying") {
    return {
      tone: "info",
      title: "광고 보상을 확인하고 있어요",
      description: "확인이 끝나면 선택한 방법으로 다시 시도해 주세요.",
    };
  }
  if (!access) {
    return {
      title: "사진 분석 이용 조건을 확인하지 못했어요",
      description: "잠시 후 같은 선택을 다시 눌러 주세요.",
    };
  }
  if (access.requiredAction === "watch_ad") {
    return {
      tone: "warning",
      title: "사진 분석 1회가 더 필요해요",
      description:
        "아래 광고를 완료하면 지금 고른 사진 방법으로 바로 이어갈 수 있어요.",
    };
  }
  if (access.requiredAction === "daily_limit_reached") {
    const monthlyExhausted =
      access.subscriptionQuota?.monthly.remaining === 0;
    return {
      tone: "warning",
      title: monthlyExhausted
        ? "이번 달 사진 분석 횟수를 모두 사용했어요"
        : "오늘 사진 분석 횟수를 모두 사용했어요",
      description: `${formatResetTime(
        monthlyExhausted
          ? access.subscriptionQuota?.resetsAt
          : access.resetsAt,
      )}에 다시 시도하거나 직접 등록해 주세요.`,
    };
  }
  return {
    title: "지금은 사진 분석을 사용할 수 없어요",
    description: "잠시 후 다시 시도하거나 사진 없이 직접 등록해 주세요.",
  };
}

function formatResetTime(value?: string) {
  if (!value) return "다음 KST 자정";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  choiceStack: {
    gap: spacing.sm,
  },
  accessCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  accessHeadingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  photoChoiceCard: {
    minHeight: touchTarget.ctaLarge,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  photoChoiceCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  photoChoiceCardPressed: {
    opacity: 0.86,
  },
  photoChoiceIcon: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  photoChoiceCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  photoChoiceTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
  },
  recommendBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.primarySoftPressed,
  },
  albumSceneCard: {
    marginTop: -spacing.xs,
    padding: spacing.sm,
    gap: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
  },
  limitCard: {
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.xxl,
    padding: spacing.md,
    gap: spacing.xxs,
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
  itemCardNeedsAttention: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  itemTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
  },
  attentionBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
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
