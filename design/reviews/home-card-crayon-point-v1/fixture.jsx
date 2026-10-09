/* global window, document, MutationObserver, ResizeObserver, URLSearchParams */
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { House, ChefHat, Archive, ShoppingBasket, Settings } from "lucide-react-native";
import HomeScreen from "../../../apps/mobile/app/(tabs)/home";
import { colors, radius, spacing, typography } from "../../../apps/mobile/src/shared/theme";
import { getTabBarMetrics } from "../../../apps/mobile/src/shared/responsive-layout-core";
import { RuntimeComponentCheck } from "../home-card-crayon-implementation-v1/component-check";

const params = new URLSearchParams(window.location.search);
const variant = params.get("variant") || "baseline";
const palette = params.get("palette") || "tone";
const scale = Number(params.get("scale") || 1);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const tabs = [["홈", House], ["추천", ChefHat], ["보관함", Archive], ["장보기", ShoppingBasket], ["설정", Settings]];
// Review-only mapping: consume the actual SurfaceCard tone and existing semantic roles.
// Native implementation will expose these as separate shared decoration roles.
const toneDecoration = {
  primary: { outline: colors.primaryForeground, accent: colors.brandAccent },
  warning: { outline: colors.warningForeground, accent: colors.warningAccent },
  danger: { outline: colors.dangerForeground, accent: colors.dangerAccent },
};

function createCrayonOverlay(card) {
  const w = card.clientWidth;
  const h = card.clientHeight;
  const r = Math.min(radius.xxl - 1, h / 2 - 2);
  const light = variant === "light";
  const lineWidth = light ? 1.15 : 1.65;
  const inset = 1.7;
  const d = `M ${r + 1} ${inset}
    C ${w * .4} ${.8} ${w * .62} ${2.6} ${w - r - 1} ${inset}
    C ${w - 11} ${.8} ${w - 1.4} ${13} ${w - inset} ${r}
    C ${w - .8} ${h * .48} ${w - 2.4} ${h * .65} ${w - inset} ${h - r}
    C ${w - .5} ${h - 12} ${w - 12} ${h - 1.1} ${w - r} ${h - inset}
    C ${w * .62} ${h - .6} ${w * .38} ${h - 2.2} ${r} ${h - inset}
    C ${12} ${h - .8} ${1.1} ${h - 12} ${inset} ${h - r}
    C ${2.2} ${h * .63} ${.9} ${h * .42} ${inset} ${r}
    C ${.9} ${12} ${12} ${1.1} ${r + 1} ${inset} Z`;
  let svg = card.querySelector("[data-review-decoration]");
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("data-review-decoration", "crayon-card");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    Object.assign(svg.style, { position: "absolute", inset: "0", pointerEvents: "none", overflow: "visible" });
    card.appendChild(svg);
  }
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  const tone = card.getAttribute("data-review-tone") || "default";
  const decoration = palette === "original"
    ? { outline: colors.borderControl, accent: colors.brandAccent }
    : toneDecoration[tone] || { outline: colors.borderControl, accent: null };
  svg.setAttribute("data-review-tone", tone);
  card.style.borderColor = "transparent";
  // Fixed texture pattern: one connected outline, no generated randomness.
  const patch = !light && scale < 1.3 && decoration.accent ? `<g stroke="${decoration.accent}" stroke-linecap="round" opacity=".28">
    <path d="M 25 ${h - 5.7} Q 40 ${h - 7.1} 57 ${h - 5.9}" stroke-width="3.5"/>
    <path d="M 29 ${h - 3.4} Q 42 ${h - 4.5} 53 ${h - 3.7}" stroke-width="1.7"/>
    <path d="M ${w - 64} 5.7 Q ${w - 49} 4.3 ${w - 35} 5.6" stroke-width="2.8"/>
  </g>` : "";
  svg.innerHTML = `<defs><pattern id="crayon-grain" width="6" height="5" patternUnits="userSpaceOnUse">
    <rect width="6" height="5" fill="white"/><circle cx="1.6" cy="1.4" r=".4" fill="#777"/>
    <circle cx="4.7" cy="3.8" r=".32" fill="#888"/>
  </pattern><mask id="crayon-mask"><rect width="${w}" height="${h}" fill="url(#crayon-grain)"/></mask></defs>
  <path d="${d}" fill="none" stroke="${decoration.outline}" stroke-width="${lineWidth}" stroke-linecap="round" opacity="${light ? .35 : .48}" mask="url(#crayon-mask)"/>${patch}`;
}

function ReviewApp() {
  useEffect(() => {
    let resize;
    let toneObserver;
    let observedCard;
    const observe = () => {
      const card = document.getElementById("review-home-hero");
      if (variant === "baseline" || variant === "runtime" || card === observedCard) return;
      resize?.disconnect();
      toneObserver?.disconnect();
      observedCard = card;
      if (!card) return;
      resize = new ResizeObserver(() => createCrayonOverlay(card));
      resize.observe(card);
      toneObserver = new MutationObserver(() => createCrayonOverlay(card));
      toneObserver.observe(card, { attributes: true, attributeFilter: ["data-review-tone"] });
    };
    const observer = new MutationObserver(observe);
    observer.observe(document.getElementById("root"), { childList: true, subtree: true });
    observe();
    return () => { observer.disconnect(); resize?.disconnect(); toneObserver?.disconnect(); };
  }, []);
  const metrics = getTabBarMetrics(scale >= 1.3, 0);
  return <QueryClientProvider client={queryClient}>
    <div data-review-state={params.get("state") || "calm"} data-review-scale={scale} data-review-variant={variant} data-review-palette={palette} style={{ height: "100%", display: "flex", flexDirection: "column", background: colors.background }}>
      <HomeScreen />
      <nav aria-label="기존 5개 탭의 검토용 표시" style={{ flexShrink: 0, display: "flex", minHeight: metrics.height, paddingTop: metrics.paddingTop, background: colors.surface, borderTop: `1px solid ${colors.border}` }}>
        {tabs.map(([label, Icon], i) => <div key={label} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: spacing.xxs, color: i ? colors.subtext : colors.primaryForeground }}>
          <Icon size={24} strokeWidth={2.4} color={i ? colors.subtext : colors.primaryForeground} />
          <span style={{ fontFamily: "Pretendard-Medium", fontSize: typography.caption.fontSize * Math.min(scale, 1.3), lineHeight: `${typography.caption.lineHeight * Math.min(scale, 1.3)}px` }}>{label}</span>
        </div>)}
      </nav>
    </div>
  </QueryClientProvider>;
}

createRoot(document.getElementById("root")).render(params.get("check") === "component" ? <RuntimeComponentCheck /> : <ReviewApp />);
