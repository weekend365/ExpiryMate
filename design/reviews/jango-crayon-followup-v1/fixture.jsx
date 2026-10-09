/* global window, document, URLSearchParams */
import React from "react";
import { createRoot } from "react-dom/client";
import { ScrollView } from "react-native";
import { CrayonReviewScene, crayonReviewScenes } from "../../../apps/mobile/e2e/fixtures/crayon-review-scenes";
import { colors, spacing } from "../../../apps/mobile/src/shared/theme";

const params = new URLSearchParams(window.location.search);
const scene = crayonReviewScenes.includes(params.get("scene")) ? params.get("scene") : crayonReviewScenes[0];
createRoot(document.getElementById("root")).render(
  <ScrollView contentContainerStyle={{ padding: spacing.lg, backgroundColor: colors.background, flexGrow: 1 }}>
    <CrayonReviewScene scene={scene} decorated={params.get("variant") !== "baseline"} />
  </ScrollView>,
);
