import {
  SupportInquiryCategory,
  supportInquiryCategoryOptions,
  supportInquiryCreateSchema,
  type SupportInquiryCreateInput,
} from "@expirymate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import Constants from "expo-constants";
import { router } from "expo-router";
import { MessageCircleHeart } from "lucide-react-native";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button } from "../../src/components/Button";
import { FormField } from "../../src/components/FormField";
import { Mascot } from "../../src/components/Mascot";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { createSupportInquiry } from "../../src/services/api";
import { colors, radius, spacing, typography } from "../../src/shared/theme";

type SupportFormValues = SupportInquiryCreateInput;

export default function SupportSettingsScreen() {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<SupportFormValues>({
    resolver: zodResolver(supportInquiryCreateSchema),
    defaultValues: {
      category: SupportInquiryCategory.OTHER,
      body: "",
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "unknown",
      appVersion: Constants.expoConfig?.version ?? null,
    },
  });

  const selectedCategory = form.watch("category");

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await createSupportInquiry({
        ...values,
        platform:
          Platform.OS === "ios" || Platform.OS === "android"
            ? Platform.OS
            : "unknown",
        appVersion: Constants.expoConfig?.version ?? null,
      });
      Alert.alert(
        "잘 받아 두었어요",
        "메일로 답 드릴게요. 조금만 기다려 주세요.",
        [{ text: "알겠어요", onPress: () => router.back() }],
      );
    } catch (error) {
      Alert.alert(
        "앗, 잠시 문제가 생겼어요",
        error instanceof Error
          ? error.message
          : "조금 뒤에 다시 보내 볼까요?",
      );
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Screen
      title="장고에게 물어보기"
      subtitle="불편한 점이나 궁금한 점을 편하게 남겨 주세요."
    >
      <View style={styles.hero}>
        <Mascot size="small" mood="idle" />
        <Text style={styles.heroText}>
          한 가지만 골라 주시면, 장고가 운영팀에 잘 전해 줄게요.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="어떤 이야기인가요?"
          description="주제에 가까운 것을 눌러 주세요."
        />
        <View style={styles.chips}>
          {supportInquiryCategoryOptions.map((option) => (
            <Pill
              key={option.value}
              label={option.label}
              selected={selectedCategory === option.value}
              onPress={() => form.setValue("category", option.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="자세히 들려줄래요?"
          description="언제, 어떤 화면에서 생겼는지 적어 주시면 더 빨리 도와드릴 수 있어요."
        />
        <View style={styles.card}>
          <FormField
            control={form.control}
            name="body"
            label="문의 내용"
            placeholder="예: 추천 받기를 눌렀는데 잠시 문제가 생겼어요."
            multiline
          />
        </View>
      </View>

      <Button
        onPress={onSubmit}
        loading={submitting}
        disabled={submitting}
        icon={MessageCircleHeart}
        fullWidth
      >
        이 내용으로 보낼까요?
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
  },
  heroText: {
    flex: 1,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.subtext,
  },
  section: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
});
