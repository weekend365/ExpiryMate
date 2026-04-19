import {
  ItemStatus,
  productCategoryLabels,
  storageLocationLabels,
  type Product,
} from "@expirymate/shared";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import { useMutation } from "@tanstack/react-query";
import { Button } from "../src/components/Button";
import { useInventoryList } from "../src/features/inventory/use-inventory-list";
import { lookupProductByBarcode } from "../src/services/api";
import { colors, spacing } from "../src/shared/theme";
import { useRegistrationStore } from "../src/store/registration-store";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [result, setResult] = useState<Product | null>(null);
  const { data: inventory = [] } = useInventoryList();
  const setPrefill = useRegistrationStore((state) => state.setPrefill);

  const lookupMutation = useMutation({
    mutationFn: lookupProductByBarcode,
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleScanned = (event: BarcodeScanningResult) => {
    if (scannedBarcode || lookupMutation.isPending) {
      return;
    }

    setScannedBarcode(event.data);
    lookupMutation.mutate(event.data);
  };

  const resetScan = () => {
    setScannedBarcode(null);
    setResult(null);
    lookupMutation.reset();
  };

  const goToRegister = () => {
    setPrefill({
      barcode: scannedBarcode ?? undefined,
      productId: result?.id,
      displayName: result?.name,
      brand: result?.brand,
      category: result?.category,
    });
    router.replace("/register");
  };

  const goBackLater = () => {
    router.back();
  };

  const existingItems = useMemo(() => {
    return inventory.filter((item) => {
      if (item.status !== ItemStatus.ACTIVE) {
        return false;
      }

      if (scannedBarcode && item.barcode === scannedBarcode) {
        return true;
      }

      if (result?.id && item.productId === result.id) {
        return true;
      }

      return false;
    });
  }, [inventory, result?.id, scannedBarcode]);

  const existingItemLabel = existingItems
    .slice(0, 2)
    .map(
      (item) =>
        `${storageLocationLabels[item.storageLocation]} · ${item.quantity}${item.unit ?? "개"}`,
    )
    .join(" / ");

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionWrapper}>
        <Text style={styles.permissionTitle}>카메라 권한이 필요해요</Text>
        <Text style={styles.permissionDescription}>
          바코드를 스캔하려면 카메라 접근을 허용해주세요.
        </Text>
        <Button onPress={requestPermission}>권한 허용</Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"],
        }}
        onBarcodeScanned={handleScanned}
      />

      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.scanHint}>상품 바코드를 프레임 안에 맞춰주세요.</Text>
      </View>

      <View style={styles.bottomSheet}>
        {!scannedBarcode ? (
          <>
            <Text style={styles.sheetTitle}>바코드를 스캔하세요</Text>
            <Text style={styles.sheetDescription}>
              바코드는 상품 식별에만 사용되고, 유통기한은 따로 입력해요.
            </Text>
          </>
        ) : lookupMutation.isPending ? (
          <>
            <Text style={styles.sheetTitle}>상품 정보를 확인하는 중이에요</Text>
            <ActivityIndicator color={colors.primary} />
          </>
        ) : result ? (
          <>
            <Text style={styles.sheetTitle}>{result.name}</Text>
            <Text style={styles.sheetMeta}>
              {result.brand} · {productCategoryLabels[result.category]}
            </Text>
            <Text style={styles.sheetDescription}>
              상품 정보가 자동으로 채워져요. 유통기한과 수량만 선택하면 됩니다.
            </Text>
            {existingItems.length ? (
              <View style={styles.hintCard}>
                <Text style={styles.hintTitle}>집에 이미 {existingItems.length}개 있어요</Text>
                <Text style={styles.hintDescription}>{existingItemLabel}</Text>
              </View>
            ) : null}
            <View style={styles.actionRow}>
              <Button onPress={goToRegister} style={styles.actionButton}>
                이 상품 등록하기
              </Button>
              <Button
                variant="secondary"
                onPress={goBackLater}
                style={styles.actionButton}
              >
                나중에 처리
              </Button>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sheetTitle}>상품을 찾을 수 없어요</Text>
            <Text style={styles.sheetDescription}>
              직접 입력할까요? 바코드는 함께 저장해둘 수 있어요.
            </Text>
            <View style={styles.actionRow}>
              <Button onPress={goToRegister} style={styles.actionButton}>
                직접 등록
              </Button>
              <Button
                variant="secondary"
                onPress={goBackLater}
                style={styles.actionButton}
              >
                나중에 처리
              </Button>
            </View>
          </>
        )}

        {scannedBarcode ? (
          <Pressable onPress={resetScan}>
            <Text style={styles.resetText}>다시 스캔</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  permissionWrapper: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: "center",
    gap: spacing.md,
  },
  permissionTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
  },
  permissionDescription: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.subtext,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  scanFrame: {
    width: 280,
    height: 180,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: "transparent",
  },
  scanHint: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  sheetDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.subtext,
  },
  sheetMeta: {
    fontSize: 14,
    color: colors.subtext,
    fontWeight: "600",
  },
  hintCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: 20,
    padding: spacing.md,
    gap: 4,
  },
  hintTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.warning,
  },
  hintDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  resetText: {
    textAlign: "center",
    color: colors.primary,
    fontWeight: "700",
  },
});
