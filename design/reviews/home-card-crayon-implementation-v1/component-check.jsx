import React, { useState } from "react";
import { SurfaceCard } from "../../../apps/mobile/src/components/SurfaceCard";
import { Button } from "../../../apps/mobile/src/components/Button";
import { AppText } from "../../../apps/mobile/src/components/AppText";
import { colors, spacing } from "../../../apps/mobile/src/shared/theme";

// Review-only: verify a tone change without remounting and two isolated SVG masks.
export function RuntimeComponentCheck() {
  const tones = ["primary", "warning", "danger"];
  const [index, setIndex] = useState(0);
  const tone = tones[index];
  return <main style={{ padding: spacing.md, display: "grid", gap: spacing.md, background: colors.background }}>
    <h1>앱 카드 컴포넌트 검증</h1>
    <section data-check="default-off"><SurfaceCard variant="hero" tone={tone}><AppText>기본 카드 · {tone}</AppText></SurfaceCard></section>
    <section data-check="live-tone"><SurfaceCard variant="hero" tone={tone} decoration="crayon">
      <AppText>상태 변경 · {tone}</AppText>
      <Button onPress={() => setIndex((value) => (value + 1) % tones.length)}>다음 상태</Button>
    </SurfaceCard></section>
    <section data-check="second-mask"><SurfaceCard variant="hero" tone="primary" decoration="crayon"><AppText>별도 카드의 윤곽 유지</AppText></SurfaceCard></section>
  </main>;
}
