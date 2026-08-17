import {
  recipeAllergenOptions,
  recipeDietaryStyleOptions,
  type RecipeAllergen,
  type RecipeDietaryStyle,
  type RecipeEquipment,
  type RecipeSpiceLevel,
} from "@expirymate/shared";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { AppTextInput } from "../../src/components/AppTextInput";
import { Button } from "../../src/components/Button";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { getSettingsErrorMessage } from "../../src/features/settings/settings-format";
import { useRecipePreferences } from "../../src/features/settings/use-recipe-preferences";
import { colors, radius, spacing, typography } from "../../src/shared/theme";

const spiceOptions: Array<{ value: RecipeSpiceLevel; label: string }> = [
  { value: "any", label: "제한 없음" },
  { value: "none", label: "안 매운맛" },
  { value: "mild", label: "순한맛" },
  { value: "medium", label: "보통" },
  { value: "hot", label: "매운맛" },
];
const equipmentOptions: Array<{ value: RecipeEquipment; label: string }> = [
  { value: "stovetop", label: "가스·인덕션" },
  { value: "microwave", label: "전자레인지" },
  { value: "oven", label: "오븐" },
  { value: "air_fryer", label: "에어프라이어" },
];

export default function RecipePreferenceSettingsScreen() {
  const { query, mutation } = useRecipePreferences();
  const [allergens, setAllergens] = useState<RecipeAllergen[]>([]);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [dietaryStyle, setDietaryStyle] = useState<RecipeDietaryStyle>("any");
  const [maxSpiceLevel, setMaxSpiceLevel] = useState<RecipeSpiceLevel>("any");
  const [availableEquipment, setAvailableEquipment] = useState<RecipeEquipment[]>([
    "stovetop",
  ]);
  const [excludedDraft, setExcludedDraft] = useState("");

  useEffect(() => {
    if (!query.data) return;
    setAllergens(query.data.allergens);
    setExcludedIngredients(query.data.excludedIngredients);
    setDietaryStyle(query.data.dietaryStyle);
    setMaxSpiceLevel(query.data.maxSpiceLevel);
    setAvailableEquipment(query.data.availableEquipment);
  }, [query.data]);

  const toggle = <T extends string>(value: T, current: T[], set: (next: T[]) => void) =>
    set(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);

  const addExcludedIngredient = () => {
    const value = excludedDraft.trim();
    if (!value) return;
    if (value.length > 40) {
      Alert.alert("조금만 짧게 적어 주세요", "제외 재료는 40자까지 입력할 수 있어요.");
      return;
    }
    if (excludedIngredients.length >= 20) {
      Alert.alert("최대 20개까지 저장할 수 있어요");
      return;
    }
    if (
      excludedIngredients.some(
        (item) => item.toLocaleLowerCase("ko-KR") === value.toLocaleLowerCase("ko-KR"),
      )
    ) {
      setExcludedDraft("");
      return;
    }
    setExcludedIngredients((current) => [...current, value]);
    setExcludedDraft("");
  };

  const handleSave = () => {
    if (!availableEquipment.length) {
      Alert.alert("조리도구를 하나 이상 골라 주세요");
      return;
    }
    mutation.mutate(
      { allergens, excludedIngredients, dietaryStyle, maxSpiceLevel, availableEquipment },
      {
        onSuccess: () => Alert.alert("기억해 뒀어요", "다음 요리 추천부터 적용할게요."),
        onError: (error) => Alert.alert("저장하지 못했어요", getSettingsErrorMessage(error)),
      },
    );
  };

  return (
    <Screen
      title="요리 추천 맞춤 설정"
      subtitle="내가 먹을 수 있고 만들 수 있는 요리를 장고가 먼저 살펴볼게요."
      footer={<Button onPress={handleSave} loading={mutation.isPending} fullWidth>추천 설정 저장할게요</Button>}
    >
      <PreferenceSection title="알레르기" description="해당 재료와 명백히 관련된 재고·추천을 제외해요.">
        <PillGrid>
          {recipeAllergenOptions.map((option) => (
            <Pill key={option.value} label={option.label} tone="danger" selected={allergens.includes(option.value)} onPress={() => toggle(option.value, allergens, setAllergens)} />
          ))}
        </PillGrid>
      </PreferenceSection>

      <PreferenceSection title="직접 제외할 재료" description="알레르기 외에 먹지 않거나 피하고 싶은 재료를 적어 주세요.">
        <View style={styles.inputRow}>
          <AppTextInput value={excludedDraft} onChangeText={setExcludedDraft} onSubmitEditing={addExcludedIngredient} placeholder="예: 고수" maxLength={40} returnKeyType="done" style={styles.input} />
          <Button onPress={addExcludedIngredient} variant="secondary">추가</Button>
        </View>
        {excludedIngredients.length ? (
          <PillGrid>
            {excludedIngredients.map((item) => (
              <Pill key={item} label={`${item} ×`} selected onPress={() => setExcludedIngredients((current) => current.filter((value) => value !== item))} />
            ))}
          </PillGrid>
        ) : null}
      </PreferenceSection>

      <PreferenceSection title="식단" description="한 가지 식단 기준을 모든 추천에 적용해요.">
        <PillGrid>{recipeDietaryStyleOptions.map((option) => <Pill key={option.value} label={option.label} selected={dietaryStyle === option.value} onPress={() => setDietaryStyle(option.value)} />)}</PillGrid>
      </PreferenceSection>

      <PreferenceSection title="최대 매운맛" description="이 단계보다 맵지 않은 요리만 추천해요.">
        <PillGrid>{spiceOptions.map((option) => <Pill key={option.value} label={option.label} selected={maxSpiceLevel === option.value} onPress={() => setMaxSpiceLevel(option.value)} />)}</PillGrid>
      </PreferenceSection>

      <PreferenceSection title="사용 가능한 조리도구" description="하나 이상 골라 주세요. 선택한 도구 안에서만 추천해요.">
        <PillGrid>{equipmentOptions.map((option) => <Pill key={option.value} label={option.label} selected={availableEquipment.includes(option.value)} onPress={() => toggle(option.value, availableEquipment, setAvailableEquipment)} />)}</PillGrid>
      </PreferenceSection>

      <View style={styles.notice}>
        <Text style={styles.noticeText}>AI 추천은 알레르기 안전을 보장하지 않아요. 포장지의 원재료·알레르기 표시와 실제 식품 상태를 조리 전에 꼭 확인해 주세요.</Text>
      </View>
    </Screen>
  );
}

function PreferenceSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <View style={styles.section}><SectionHeader title={title} description={description} /><View style={styles.card}>{children}</View></View>;
}

function PillGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.pillGrid}>{children}</View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  pillGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: { flex: 1, minHeight: spacing.xl, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.background },
  notice: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.warningSoft },
  noticeText: { fontSize: typography.bodySmall.fontSize, lineHeight: typography.bodySmall.lineHeight, fontFamily: typography.body.fontFamily, color: colors.text },
});
