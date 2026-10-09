import { useState } from "react";
import { registerRootComponent } from "expo";
import { useFonts } from "expo-font";
import { ScrollView, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../../src/components/AppText";
import { Button } from "../../src/components/Button";
import { pretendardFonts } from "../../src/shared/fonts";
import { colors, spacing } from "../../src/shared/theme";
import { CrayonReviewScene, crayonReviewScenes } from "./crayon-review-scenes";

function App() {
  const [loaded, error] = useFonts(pretendardFonts);
  const [index, setIndex] = useState(0);
  const [decorated, setDecorated] = useState(true);
  if (!loaded && !error) return <AppText>글꼴 로딩 중</AppText>;
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <AppText variant="bodySmall">로컬 크레파스 검수 · 예시 데이터 · 서버 처리 없음</AppText>
      <AppText variant="caption">{crayonReviewScenes[index]} · 장식 {decorated ? "켬" : "끔"}</AppText>
      <View style={{ gap: spacing.xs }}>
        <Button onPress={() => setIndex(value => (value + 1) % crayonReviewScenes.length)}>다음 상태</Button>
        <Button variant="secondary" onPress={() => setDecorated(value => !value)}>장식 전후 전환</Button>
      </View>
      <CrayonReviewScene key={crayonReviewScenes[index]} scene={crayonReviewScenes[index]!} decorated={decorated} />
    </ScrollView>
  </SafeAreaView></SafeAreaProvider>;
}
registerRootComponent(App);
