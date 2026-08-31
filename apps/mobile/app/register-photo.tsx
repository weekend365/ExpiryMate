import {
  ExpirySource,
  ProductCategory,
  StorageLocation,
  formatDateKorean,
  productCategoryOptions,
  quantityValuesForInputUnit,
  type InventoryPhotoParseAccess,
  type InventoryPhotoParseScene,
} from "@expirymate/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CameraView } from "expo-camera";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../src/components/AppText";
import { AppTextInput } from "../src/components/AppTextInput";
import { BottomSheet } from "../src/components/BottomSheet";
import { Button } from "../src/components/Button";
import { DatePickerField } from "../src/components/DatePickerField";
import { FeedbackBanner } from "../src/components/FeedbackBanner";
import { Mascot } from "../src/components/Mascot";
import { MascotSpeechBubble } from "../src/components/MascotSpeechBubble";
import { QuantityStepper } from "../src/components/QuantityStepper";
import { Screen } from "../src/components/Screen";
import {
  ApiError,
  batchCreateInventoryItems,
  createIdempotencyKey,
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
  photoIntakeItemIsReadyToSave,
  prioritizePhotoIntakeDrafts,
  type PhotoIntakeDraftItem,
} from "../src/features/photo-intake/photo-intake-draft";
import { pickInventoryPhoto } from "../src/features/photo-intake/pick-inventory-photo";
import { PhotoCaptureScreen } from "../src/features/photo-intake/photo-capture-screen";
import {
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
import { QuantityUnitPills } from "../src/features/inventory/QuantityUnitPills";
import { useStorageLocations } from "../src/features/settings/use-storage-locations";
import { useInventoryList } from "../src/features/inventory/use-inventory-list";
import { useActiveSpace } from "../src/features/spaces/space-provider";
import {
  colors,
  radius,
  spacing,
  touchTarget,
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
  const { data: existingInventory = [] } = useInventoryList();
  const cameraRef = useRef<CameraView>(null);
  const batchSubmissionRef = useRef<{
    idempotencyKey: string;
    itemIds: string[];
    payload: ReturnType<typeof draftsToCreateBody>;
  } | null>(null);
  const defaultLocation =
    selectableOptions[0]?.key ?? StorageLocation.FRIDGE;

  const [step, setStep] = useState<PhotoIntakeStep>("choose");
  const [pendingSelection, setPendingSelection] =
    useState<PhotoIntakeSelection | null>(null);
  const [selectedScene, setSelectedScene] =
    useState<InventoryPhotoParseScene>("receipt");
  const [awaitingConsent, setAwaitingConsent] = useState(false);
  const [flowIssue, setFlowIssue] = useState<FlowIssue | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isAcquiringPhoto, setIsAcquiringPhoto] = useState(false);
  const [accessDetailsVisible, setAccessDetailsVisible] = useState(false);
  const [accessGateVisible, setAccessGateVisible] = useState(false);
  const [items, setItems] = useState<PhotoIntakeDraftItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [confirmedDuplicateIds, setConfirmedDuplicateIds] = useState<string[]>(
    [],
  );

  const duplicateCandidateIds = useMemo(() => {
    const seenKeys = new Set(
      existingInventory.map((item) => inventoryDuplicateKey(item)),
    );
    const candidates = new Set<string>();
    for (const item of items) {
      const key = inventoryDuplicateKey(item);
      if (seenKeys.has(key)) {
        candidates.add(item.localId);
      } else {
        seenKeys.add(key);
      }
    }
    return candidates;
  }, [existingInventory, items]);
  const confirmedDuplicateIdSet = useMemo(
    () => new Set(confirmedDuplicateIds),
    [confirmedDuplicateIds],
  );
  const reviewedItems = useMemo(
    () =>
      items.map((item) =>
        duplicateCandidateIds.has(item.localId) &&
        !confirmedDuplicateIdSet.has(item.localId)
          ? { ...item, needsReview: true }
          : item,
      ),
    [confirmedDuplicateIdSet, duplicateCandidateIds, items],
  );

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
      batchSubmissionRef.current = null;
      setConfirmedDuplicateIds([]);
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
      setIsCameraReady(false);
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
      batchSubmissionRef.current ??= {
        idempotencyKey: createIdempotencyKey(),
        itemIds: reviewedItems
          .filter(photoIntakeItemIsReadyToSave)
          .map((item) => item.localId),
        payload: draftsToCreateBody(reviewedItems),
      };
      return batchCreateInventoryItems(
        { items: batchSubmissionRef.current.payload },
        activeSpaceId,
        batchSubmissionRef.current.idempotencyKey,
      );
    },
    onSuccess: (result) => {
      const submittedIds = new Set(batchSubmissionRef.current?.itemIds ?? []);
      batchSubmissionRef.current = null;
      const remainingItems = items.filter(
        (item) => !submittedIds.has(item.localId),
      );
      setSavedCount((current) => current + result.count);
      setItems(remainingItems);
      if (remainingItems.length > 0) {
        setStep("review");
        setFlowIssue({
          tone: "success",
          title: `${result.count}가지를 먼저 넣었어요`,
          description: `확인이 필요한 ${remainingItems.length}가지는 이 화면에 남겨 뒀어요.`,
        });
      } else {
        setStep("done");
      }
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
      if (
        error instanceof ApiError &&
        error.status < 500 &&
        error.status !== 408
      ) {
        batchSubmissionRef.current = null;
      }
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

  const readyCount = photoIntakeReadyCount(reviewedItems);
  const attentionCount = items.length - readyCount;
  const canSubmit = canSubmitPhotoIntake(reviewedItems);
  const editingItem = items.find((item) => item.localId === editingId) ?? null;
  const scene = selectedScene;
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
        setSelectedScene(selection.scene);
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

  const acquirePhoto = useCallback(
    async (selection: PhotoIntakeSelection) => {
      setFlowIssue(null);
      setIsAcquiringPhoto(true);
      try {
        const photo = selection.source === "camera"
          ? await cameraRef.current?.takePictureAsync({
              quality: 0.7,
              exif: false,
              shutterSound: true,
            })
          : null;

        if (selection.source === "camera") {
          if (!photo?.uri) {
            throw new Error("카메라가 아직 준비되지 않았어요. 잠시 후 다시 찍어 주세요.");
          }
          if (sessionUserId) {
            void saveRecentPhotoIntakeSelection(sessionUserId, selection).catch(
              () => undefined,
            );
          }
          setIsCameraReady(false);
          setStep("loading");
          parsePhoto({
            photo: {
              uri: photo.uri.startsWith("file://")
                ? photo.uri
                : `file://${photo.uri}`,
              mimeType: "image/jpeg",
              fileName: "inventory-photo.jpg",
            },
            scene: selection.scene,
          });
          return;
        }

        const result = await pickInventoryPhoto("library");
        if (result.status === "cancelled") return;
        if (result.status === "permission-denied") {
          setFlowIssue({
            title: "사진 접근 권한이 필요해요",
            description:
              "권한을 허용한 뒤 현재 선택한 사진 종류로 다시 시도해 주세요.",
          });
          return;
        }
        if (sessionUserId) {
          void saveRecentPhotoIntakeSelection(sessionUserId, selection).catch(
            () => undefined,
          );
        }
        setIsCameraReady(false);
        setStep("loading");
        parsePhoto({ photo: result.photo, scene: selection.scene });
      } catch (error) {
        setFlowIssue({
          title:
            selection.source === "camera"
              ? "사진을 찍지 못했어요"
              : "앨범을 열지 못했어요",
          description:
            error instanceof Error
              ? error.message
              : "잠시 후 같은 방법으로 다시 시도해 주세요.",
        });
      } finally {
        setIsAcquiringPhoto(false);
      }
    },
    [parsePhoto, sessionUserId],
  );

  const choosePhoto = async (selection: PhotoIntakeSelection) => {
    setPendingSelection(selection);
    setFlowIssue(null);
    const privacyStatus =
      privacyStatusQuery.data ?? (await refetchPrivacyStatus()).data;
    if (!privacyStatus?.hasAcceptedCurrentAiDataNotice) {
      setAwaitingConsent(true);
      router.push("/privacy/ai-data-notice?from=register-photo");
      return;
    }
    if (!accessUi.canSelectPhoto) {
      setAccessGateVisible(true);
      return;
    }
    void acquirePhoto(selection);
  };

  useFocusEffect(
    useCallback(() => {
      if (!awaitingConsent || !pendingSelection) return undefined;
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
        setFlowIssue({
          tone: "success",
          title: "AI 데이터 안내에 동의했어요",
          description:
            pendingSelection.source === "camera"
              ? "촬영 버튼을 누르면 지금 고른 사진 종류로 이어갈게요."
              : "앨범 버튼을 다시 누르면 지금 고른 사진 종류로 이어갈게요.",
        });
      });
      return () => {
        active = false;
      };
    }, [
      awaitingConsent,
      pendingSelection,
      refetchPrivacyStatus,
    ]),
  );

  const watchPhotoAd = async () => {
    try {
      const result = await photoAccess.watchRewardedAd();
      if (result === "verified") {
        await photoAccess.refresh();
        setAccessGateVisible(false);
        setFlowIssue({
          tone: "success",
          title: "사진 분석 1회가 준비됐어요",
          description:
            pendingSelection?.source === "library"
              ? "앨범 버튼을 다시 누르면 선택한 종류로 이어갈게요."
              : "촬영 버튼을 누르면 선택한 종류로 이어갈게요.",
        });
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
          ? readyCount === items.length
            ? `${readyCount}가지 냉장고에 넣을게요`
            : `확인된 ${readyCount}가지 먼저 넣을게요`
          : `${attentionCount}가지 확인한 뒤 넣을게요`}
      </Button>
    ) : step === "done" ? (
      <Button
        onPress={() => router.replace(registrationReturnHref(returnTo))}
        fullWidth
      >
        냉장고로 돌아갈게요
      </Button>
    ) : null;
  const gateIssue = photoAccessIssue(
    photoAccess.access,
    photoAccess.adState,
  );

  return (
    <>
      {step === "choose" ? (
        <PhotoCaptureScreen
          cameraRef={cameraRef}
          scene={selectedScene}
          accessLabel={photoAccessSummary(
            photoAccess.access,
            photoAccess.isLoading,
          )}
          issue={flowIssue}
          isBusy={isAcquiringPhoto}
          isActive={!awaitingConsent}
          isCameraReady={isCameraReady}
          onCameraReady={() => setIsCameraReady(true)}
          onClose={() => router.replace(registrationReturnHref(returnTo))}
          onSceneChange={(nextScene) => {
            setSelectedScene(nextScene);
            setPendingSelection(null);
            setFlowIssue(null);
          }}
          onCapture={() => {
            void choosePhoto({ scene: selectedScene, source: "camera" });
          }}
          onOpenLibrary={() => {
            void choosePhoto({ scene: selectedScene, source: "library" });
          }}
          onShowAccessDetails={() => setAccessDetailsVisible(true)}
        />
      ) : (
        <Screen title={title} subtitle={subtitle} footer={footer}>
          {step === "loading" ? (
            <View style={styles.loadingCard}>
              <PhotoFlowProgress current={1} />
              <MascotSpeechBubble
                message="글자와 재료를 천천히 읽고 있어요."
                mood="think"
                size="medium"
                textVariant="body"
              />
            </View>
          ) : null}

        {step === "review" && items.length ? (
          <View style={styles.reviewStack}>
            <PhotoFlowProgress current={2} />
            {flowIssue ? (
              <FeedbackBanner
                tone={flowIssue.tone ?? "danger"}
                title={flowIssue.title}
                description={flowIssue.description}
                showMascot={false}
                onDismiss={() => setFlowIssue(null)}
              />
            ) : null}
            <View style={styles.reviewSummary}>
              <AppText variant="bodyStrong">
                확인 필요 {attentionCount}개 · 바로 저장 {items.length - attentionCount}개
              </AppText>
              <AppText variant="bodySmall" tone="subtext">
                확인이 필요한 재료를 먼저 모아 뒀어요.
              </AppText>
            </View>
            {scene === "fridge" ? (
              <AppText variant="bodySmall" tone="subtext">
                냉장고 사진은 가려진 재료를 놓칠 수 있어요. 한번만 더 봐 주세요.
              </AppText>
            ) : null}
            <View style={styles.bulkCard}>
              <AppText variant="bodyStrong">한 번에 자리 정하기</AppText>
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
                    <AppText variant="bodySmall">{option.label}</AppText>
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
              <Pressable
                onPress={() =>
                  setItems((current) =>
                    applyExpiryToAll(current, null, ExpirySource.UNKNOWN),
                  )
                }
                accessibilityRole="button"
                accessibilityState={{
                  selected:
                    items.length > 0 &&
                    items.every(
                      (item) => item.expirySource === ExpirySource.UNKNOWN,
                    ),
                }}
                style={({ pressed }) => [
                  styles.pill,
                  items.length > 0 &&
                    items.every(
                      (item) => item.expirySource === ExpirySource.UNKNOWN,
                    ) &&
                    styles.pillSelected,
                  pressed && styles.pillPressed,
                ]}
              >
                <AppText variant="bodySmall">기한 모름 전체 적용</AppText>
              </Pressable>
            </View>
            {items.map((item) => {
              const isUnconfirmedDuplicate =
                duplicateCandidateIds.has(item.localId) &&
                !confirmedDuplicateIdSet.has(item.localId);
              const needsAttention =
                !photoIntakeItemIsReadyToSave(item) || isUnconfirmedDuplicate;
              return (
              <Pressable
                key={item.localId}
                onPress={() => setEditingId(item.localId)}
                accessibilityRole="button"
                accessibilityLabel={`${item.displayName} 고치기`}
                style={({ pressed }) => [
                  styles.itemCard,
                  needsAttention && styles.itemCardNeedsAttention,
                  pressed && styles.itemCardPressed,
                ]}
              >
                <View style={styles.itemCopy}>
                  <View style={styles.itemTitleRow}>
                    <AppText variant="bodyStrong">{item.displayName}</AppText>
                    {needsAttention ? (
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
                    {item.expirySource === ExpirySource.UNKNOWN
                      ? "기한 확인 필요"
                      : item.expiryDate
                      ? formatDateKorean(item.expiryDate)
                      : "기한 없음"}
                  </AppText>
                  {needsAttention ? (
                    <AppText variant="caption" tone="warning">
                      {isUnconfirmedDuplicate
                        ? "보관함에 같은 내용이 있어요. 추가할지 확인해 주세요."
                        : item.reason ?? "유통기한을 확인해 주세요."}
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
                  hitSlop={spacing.xs}
                  style={styles.iconButton}
                >
                  <Trash2 color={colors.danger} size={spacing.md} />
                </Pressable>
              </Pressable>
              );
            })}
            <AppText variant="caption" tone="muted">
              {readyCount}/{items.length}가지 저장 준비를 마쳤어요.
            </AppText>
          </View>
        ) : null}

        {step === "review" && !items.length ? (
          <View style={styles.choiceStack}>
            <PhotoFlowProgress current={2} />
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
      )}

      <BottomSheet
        visible={accessDetailsVisible}
        onClose={() => setAccessDetailsVisible(false)}
        title="사진 분석 안내"
        description="촬영이나 앨범 선택 전에는 필요한 정보만 간단히 보여 드려요."
        footer={
          <Button onPress={() => setAccessDetailsVisible(false)} fullWidth>
            확인했어요
          </Button>
        }
      >
        <View style={styles.sheetStack}>
          <View style={styles.policyCard}>
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
          </View>
          <View style={styles.policyCard}>
            <AppText variant="bodyStrong">AI 데이터 안내</AppText>
            <AppText variant="bodySmall" tone="subtext">
              {privacyStatusQuery.data?.hasAcceptedCurrentAiDataNotice
                ? "현재 안내에 동의했어요. 선택한 사진만 분석에 사용해요."
                : "처음 분석할 때 안내를 확인하고 동의한 뒤 사진을 사용해요."}
            </AppText>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={accessGateVisible}
        onClose={() => setAccessGateVisible(false)}
        title={gateIssue.title}
        description={gateIssue.description}
        footer={
          <View style={styles.sheetStack}>
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
            ) : (
              <Button onPress={() => setAccessGateVisible(false)} fullWidth>
                확인했어요
              </Button>
            )}
            <Button
              variant="surface"
              onPress={() => router.replace(registerRoute(returnTo))}
              fullWidth
            >
              사진 없이 직접 등록하기
            </Button>
          </View>
        }
      >
        <AppText variant="bodySmall" tone="subtext">
          고른 사진 종류는 유지돼요. 준비가 끝나면 촬영 또는 앨범 버튼을 다시 눌러 주세요.
        </AppText>
      </BottomSheet>

      <BottomSheet
        visible={Boolean(editingItem)}
        onClose={() => setEditingId(null)}
        title="이 재료를 고칠까요?"
        footer={
          <Button
            onPress={() => {
              if (editingItem) {
                updateItem(editingItem.localId, {
                  needsReview: false,
                  reason: undefined,
                });
                if (duplicateCandidateIds.has(editingItem.localId)) {
                  setConfirmedDuplicateIds((current) =>
                    current.includes(editingItem.localId)
                      ? current
                      : [...current, editingItem.localId],
                  );
                }
              }
              setEditingId(null);
            }}
            fullWidth
          >
            {editingItem && duplicateCandidateIds.has(editingItem.localId)
              ? "같은 내용이어도 추가할게요"
              : "이 내용으로 둘게요"}
          </Button>
        }
      >
        {editingItem ? (
          <View style={styles.editStack}>
            {duplicateCandidateIds.has(editingItem.localId) ? (
              <FeedbackBanner
                tone="warning"
                title="같은 재료가 이미 있거나 겹쳐 보여요"
                description="이름·양·자리·기한이 같아요. 별도 묶음이 맞는지 확인해 주세요."
                showMascot={false}
              />
            ) : null}
            <AppTextInput
              value={editingItem.displayName}
              onChangeText={(displayName) =>
                updateItem(editingItem.localId, { displayName })
              }
              placeholder="재료 이름"
            />
            <AppTextInput
              value={editingItem.brand ?? ""}
              onChangeText={(brand) =>
                updateItem(editingItem.localId, { brand })
              }
              placeholder="브랜드 (선택)"
            />
            <QuantityStepper
              label="수량"
              value={editingItem.quantity}
              unitSuffix={editingItem.unit || "개"}
              onChange={(quantity) =>
                updateItem(editingItem.localId, { quantity })
              }
            />
            <View style={styles.editFieldGroup}>
              <AppText variant="bodySmallStrong">단위</AppText>
              <QuantityUnitPills
                unit={editingItem.unit}
                onChange={(nextUnit) => {
                  const next = quantityValuesForInputUnit({
                    quantity: editingItem.quantity,
                    fromUnit: editingItem.unit,
                    toUnit: nextUnit,
                  });
                  updateItem(editingItem.localId, {
                    quantity: next.quantity,
                    unit: next.unit,
                  });
                }}
              />
            </View>
            <DatePickerField
              label="유통기한"
              value={
                editingItem.expirySource === ExpirySource.UNKNOWN
                  ? null
                  : editingItem.expiryDate
              }
              onChange={(expiryDate) =>
                updateItem(editingItem.localId, {
                  expiryDate,
                  expirySource: ExpirySource.MANUAL,
                })
              }
            />
            <Pressable
              onPress={() =>
                updateItem(editingItem.localId, {
                  expiryDate: null,
                  expirySource: ExpirySource.UNKNOWN,
                })
              }
              accessibilityRole="button"
              accessibilityState={{
                selected: editingItem.expirySource === ExpirySource.UNKNOWN,
              }}
              style={[
                styles.pill,
                editingItem.expirySource === ExpirySource.UNKNOWN &&
                  styles.pillSelected,
              ]}
            >
              <AppText variant="bodySmall">기한을 모르겠어요</AppText>
            </Pressable>
            <View style={styles.editFieldGroup}>
              <AppText variant="bodySmallStrong">카테고리</AppText>
              <View style={styles.pillRow}>
                {productCategoryOptions.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      updateItem(editingItem.localId, {
                        category: option.value as ProductCategory,
                      })
                    }
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: editingItem.category === option.value,
                    }}
                    style={[
                      styles.pill,
                      editingItem.category === option.value &&
                        styles.pillSelected,
                    ]}
                  >
                    <AppText variant="bodySmall">{option.label}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
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
                    variant={
                      editingItem.storageLocation === option.key
                        ? "bodySmallStrong"
                        : "bodySmall"
                    }
                    tone={
                      editingItem.storageLocation === option.key
                        ? "primary"
                        : "default"
                    }
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
    setConfirmedDuplicateIds((current) =>
      current.filter((id) => id !== localId),
    );
    setItems((current) =>
      current.map((item) =>
        item.localId === localId ? { ...item, ...patch } : item,
      ),
    );
  }
}

function PhotoFlowProgress({ current }: { current: 1 | 2 }) {
  return (
    <View
      style={styles.flowProgress}
      accessible
      accessibilityLabel={`2단계 중 ${current}단계, ${current === 1 ? "사진" : "결과 확인"}`}
    >
      <View style={styles.flowProgressMeta}>
        <AppText variant="label" tone="subtext" scaleRole="chrome">
          {current === 1 ? "사진" : "결과 확인"}
        </AppText>
        <AppText variant="label" tone="primary" scaleRole="chrome">
          {current}/2
        </AppText>
      </View>
      <View style={styles.flowProgressTrack}>
        <View style={[styles.flowProgressSegment, styles.flowProgressActive]} />
        <View
          style={[
            styles.flowProgressSegment,
            current === 2 && styles.flowProgressActive,
          ]}
        />
      </View>
    </View>
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

function inventoryDuplicateKey(item: {
  displayName: string;
  quantity: number;
  unit?: string | null;
  storageLocation: string;
  expiryDate: string | null;
}) {
  const normalize = (value?: string | null) =>
    value?.normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase() ?? "";
  return [
    normalize(item.displayName),
    item.quantity,
    normalize(item.unit ?? "개"),
    item.storageLocation,
    item.expiryDate ?? "unknown",
  ].join(":");
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
  flowProgress: {
    width: "100%",
    gap: spacing.xs,
  },
  flowProgressMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  flowProgressTrack: {
    flexDirection: "row",
    gap: spacing.xxs,
  },
  flowProgressSegment: {
    flex: 1,
    height: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  flowProgressActive: {
    backgroundColor: colors.primary,
  },
  reviewStack: {
    gap: spacing.sm,
  },
  reviewSummary: {
    borderRadius: radius.xxl,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  sheetStack: {
    gap: spacing.sm,
  },
  policyCard: {
    borderRadius: radius.xxl,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  bulkCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
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
  iconButton: {
    minWidth: touchTarget.icon,
    minHeight: touchTarget.icon,
    alignItems: "center",
    justifyContent: "center",
  },
  editStack: {
    gap: spacing.sm,
  },
  editFieldGroup: {
    gap: spacing.xs,
  },
});
