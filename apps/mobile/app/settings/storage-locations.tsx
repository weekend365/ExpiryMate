import { fieldLimits } from "@expirymate/shared";
import { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import { ListRow } from "../../src/components/ListRow";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { getSettingsErrorMessage } from "../../src/features/settings/settings-format";
import { useStorageLocations } from "../../src/features/settings/use-storage-locations";
import { useActiveSpace } from "../../src/features/spaces/space-provider";
import { colors, radius, spacing, touchTarget, typography } from "../../src/shared/theme";

export default function StorageLocationsSettingsScreen() {
  const { activeRole } = useActiveSpace();
  const canManage = activeRole === "owner" || activeRole === "manager";
  const {
    query,
    createMutation,
    updateMutation,
    deleteMutation,
  } = useStorageLocations();
  const [addVisible, setAddVisible] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");

  const editing = query.data?.custom.find((item) => item.id === editId) ?? null;

  const openAdd = () => {
    setLabelDraft("");
    setAddVisible(true);
  };

  const openEdit = (id: string, label: string) => {
    setEditId(id);
    setLabelDraft(label);
  };

  const handleCreate = () => {
    createMutation.mutate(
      { label: labelDraft },
      {
        onSuccess: () => {
          setAddVisible(false);
          setLabelDraft("");
          Alert.alert("위치를 만들었어요", "이제 여기에 재료를 둘 수 있어요.");
        },
        onError: (error) =>
          Alert.alert("앗, 잠시 문제가 생겼어요", getSettingsErrorMessage(error)),
      },
    );
  };

  const handleRename = () => {
    if (!editId) {
      return;
    }

    updateMutation.mutate(
      { id: editId, label: labelDraft },
      {
        onSuccess: () => {
          setEditId(null);
          setLabelDraft("");
          Alert.alert("이름을 바꿨어요", "보관 위치 이름을 잘 기억해 둘게요.");
        },
        onError: (error) =>
          Alert.alert("앗, 잠시 문제가 생겼어요", getSettingsErrorMessage(error)),
      },
    );
  };

  const handleDelete = (id: string, label: string) => {
    Alert.alert(
      "이 위치를 정리할까요?",
      `"${label}"을(를) 목록에서 빼 둘게요. 이미 들어 있는 재료가 있으면 먼저 옮겨 주세요.`,
      [
        { text: "잠시만요", style: "cancel" },
        {
          text: "정리할게요",
          style: "destructive",
          onPress: () => {
            deleteMutation.mutate(id, {
              onSuccess: () =>
                Alert.alert("정리했어요", "위치를 목록에서 빼 뒀어요."),
              onError: (error) =>
                Alert.alert(
                  "앗, 아직 정리할 수 없어요",
                  getSettingsErrorMessage(error),
                ),
            });
          },
        },
      ],
    );
  };

  return (
    <Screen
      title="보관 위치"
      subtitle={
        canManage
          ? "기본 위치는 그대로 두고, 함께 쓸 자리를 더 만들 수 있어요."
          : "이 냉장고에서 함께 쓰는 보관 위치예요."
      }
      footer={
        canManage ? (
          <Button onPress={openAdd} fullWidth>
            위치 추가
          </Button>
        ) : undefined
      }
    >
      <View style={styles.section}>
        <SectionHeader
          title="기본 위치"
          description="냉장·냉동·실온·주방은 장고가 기본으로 챙겨 둬요."
        />
        <View style={styles.card}>
          {(query.data?.system ?? []).map((location, index, list) => (
            <ListRow
              key={location.key}
              title={location.label}
              description="기본 위치 · 이름 바꾸기·정리는 안 돼요"
              last={index === list.length - 1}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="나만의 위치"
          description="팬트리, 베란다처럼 집 안 자리를 더해 보세요."
        />
        <View style={styles.card}>
          {(query.data?.custom ?? []).length === 0 ? (
            <View style={styles.emptyCustom}>
              <Text style={styles.emptyCustomText}>
                아직 만든 위치가 없어요. 아래에서 하나 만들어 볼까요?
              </Text>
            </View>
          ) : (
            (query.data?.custom ?? []).map((location, index, list) => (
              <ListRow
                key={location.id}
                title={location.label}
                description={
                  canManage ? "이름 바꾸기 · 정리하기" : "함께 쓰는 위치"
                }
                last={index === list.length - 1}
                onPress={
                  canManage
                    ? () => openEdit(location.id, location.label)
                    : undefined
                }
              />
            ))
          )}
        </View>
      </View>

      <BottomSheet
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        title="어디에 둘까요?"
        description="위치 이름을 알려 주시면 목록에 넣어 둘게요."
        mascotMood="idle"
        footer={
          <Button
            onPress={handleCreate}
            loading={createMutation.isPending}
            disabled={labelDraft.trim().length === 0}
            fullWidth
          >
            여기에 보관할까요?
          </Button>
        }
      >
        <LabelField value={labelDraft} onChange={setLabelDraft} />
      </BottomSheet>

      <BottomSheet
        visible={Boolean(editing)}
        onClose={() => {
          setEditId(null);
          setLabelDraft("");
        }}
        title="이름을 바꿀까요?"
        description="키는 그대로 두고, 보이는 이름만 바꿔요."
        mascotMood="idle"
        footer={
          <View style={styles.sheetActions}>
            <Button
              onPress={handleRename}
              loading={updateMutation.isPending}
              disabled={labelDraft.trim().length === 0}
              fullWidth
            >
              이렇게 부를게요
            </Button>
            {editing ? (
              <Button
                variant="secondary"
                onPress={() => handleDelete(editing.id, editing.label)}
                fullWidth
              >
                이 위치 정리할게요
              </Button>
            ) : null}
          </View>
        }
      >
        <LabelField value={labelDraft} onChange={setLabelDraft} />
      </BottomSheet>
    </Screen>
  );
}

function LabelField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>위치 이름</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="예: 팬트리"
        placeholderTextColor={colors.mutedText}
        maxLength={fieldLimits.storageLocationLabel}
        autoFocus
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  emptyCustom: {
    padding: spacing.md,
    minHeight: touchTarget.min,
    justifyContent: "center",
  },
  emptyCustomText: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.subtext,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.text,
  },
  input: {
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
  sheetActions: {
    gap: spacing.sm,
  },
});
