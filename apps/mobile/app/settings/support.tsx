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
  View,
} from "react-native";
import { Button } from "../../src/components/Button";
import { FormField } from "../../src/components/FormField";
import { MascotSpeechBubble } from "../../src/components/MascotSpeechBubble";
import { Pill } from "../../src/components/Pill";
import { SettingsGroup } from "../../src/components/SettingsGroup";
import { SettingsScreen } from "../../src/components/SettingsScreen";
import { createSupportInquiry } from "../../src/services/api";
import { spacing } from "../../src/shared/theme";

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
    <SettingsScreen>
      <MascotSpeechBubble
        message="한 가지만 골라 주시면, 장고가 운영팀에 잘 전해 줄게요."
        mood="idle"
        density="compact"
      />

      <SettingsGroup title="어떤 이야기인가요?" content="plain">
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
      </SettingsGroup>

      <SettingsGroup title="자세히 들려줄래요?" content="padded">
        <FormField
          control={form.control}
          name="body"
          label="문의 내용"
          placeholder="예: 추천 받기를 눌렀는데 잠시 문제가 생겼어요."
          multiline
          hideLabel
        />
      </SettingsGroup>

      <Button
        onPress={onSubmit}
        loading={submitting}
        disabled={submitting}
        icon={MessageCircleHeart}
        fullWidth
      >
        이 내용으로 보낼까요?
      </Button>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
});
