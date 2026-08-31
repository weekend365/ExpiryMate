import { Barcode, ImageIcon, PenLine } from "lucide-react-native";
import { View } from "react-native";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { spacing } from "../../shared/theme";

export function IngredientEntryMethodSheet({
  visible,
  onClose,
  onScan,
  onPhoto,
  onManual,
}: {
  visible: boolean;
  onClose: () => void;
  onScan: () => void;
  onPhoto?: () => void;
  onManual: () => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="어떻게 넣을까요?"
      description={
        onPhoto
          ? "바코드, 사진 여러 개, 직접 입력 중 편한 방법을 골라 주세요."
          : "바코드 또는 직접 입력 중 편한 방법을 골라 주세요."
      }
      mascotMood="idle"
    >
      <View style={{ gap: spacing.xs }}>
        <Button
          icon={Barcode}
          onPress={onScan}
          fullWidth
          testID="ingredient-entry-scan-button"
        >
          바코드로 넣을게요
        </Button>
        {onPhoto ? (
          <Button
            icon={ImageIcon}
            onPress={onPhoto}
            fullWidth
            variant="surface"
            testID="ingredient-entry-photo-button"
          >
            사진으로 여러 개 넣을게요
          </Button>
        ) : null}
        <Button
          icon={PenLine}
          onPress={onManual}
          fullWidth
          variant="surface"
          testID="ingredient-entry-manual-button"
        >
          직접 입력할게요
        </Button>
      </View>
    </BottomSheet>
  );
}
