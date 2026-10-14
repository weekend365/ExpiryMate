import * as React from "react";
import { Children, isValidElement, type ReactNode } from "react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsScreen from "../../../app/(tabs)/settings";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  access: undefined as undefined | {
    tier: "free" | "jango_plus" | "jango_household";
    subscriptionsEnabled: boolean;
    householdDailyLimit?: number;
    paidCredits: { enabled: boolean };
  },
}));

vi.mock("expo-router", () => ({ router: { push: mocks.push } }));
vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Switch: "Switch", View: "View",
}));
vi.mock("lucide-react-native", () => ({
  Bell: "Bell", ChefHat: "ChefHat", CreditCard: "CreditCard", MapPin: "MapPin",
  MessageCircleHeart: "MessageCircleHeart", ShieldCheck: "ShieldCheck", Sun: "Sun",
  Ticket: "Ticket", UserRound: "UserRound", Users: "Users",
}));
vi.mock("../../components/AppText", () => ({ AppText: "AppText" }));
vi.mock("../../components/ListRow", () => ({ ListRow: "ListRow" }));
vi.mock("../../components/Mascot", () => ({ Mascot: "Mascot" }));
vi.mock("../../components/Screen", () => ({ Screen: "Screen" }));
vi.mock("../../components/SectionHeader", () => ({ SectionHeader: "SectionHeader" }));
vi.mock("../monetization/monetization-provider", () => ({
  useMonetization: () => ({ access: mocks.access }),
}));
vi.mock("../../shared/responsive-layout", () => ({
  useResponsiveLayout: () => ({ shouldStack: false }),
}));
vi.mock("../../shared/fonts", () => ({
  fontFamily: { regular: "Pretendard-Regular" },
  fontFamilyForWeight: () => "Pretendard-Regular",
}));
vi.mock("../../store/app-store", () => ({
  useAppStore: (selector: (state: object) => unknown) => selector({
    keepCookingScreenAwake: true, setKeepCookingScreenAwake: vi.fn(),
  }),
}));

type RowProps = { title?: string; description?: string; onPress?: () => void; children?: ReactNode };

// Metro uses automatic JSX; Vitest's default transform here is classic.
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

function rows(node: ReactNode): RowProps[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<RowProps>(child)) return [];
    return [child.props, ...rows(child.props.children)];
  });
}

describe("subscription settings entry", () => {
  beforeEach(() => { mocks.access = undefined; mocks.push.mockClear(); });

  it.each([false, true])("keeps the restoration entry reachable for a free user (sales=%s)", (subscriptionsEnabled) => {
    mocks.access = { tier: "free", subscriptionsEnabled, paidCredits: { enabled: false } };
    const row = rows(SettingsScreen()).find((item) => item.title === "장고 플러스");
    expect(row).toBeDefined();
    row?.onPress?.();
    expect(mocks.push).toHaveBeenCalledWith("/settings/subscription");
    expect(rows(SettingsScreen()).some((item) => item.title === "AI 추천권")).toBe(false);
  });

  it("keeps the entry available before status loads or when it cannot be retrieved", () => {
    const row = rows(SettingsScreen()).find((item) => item.title === "장고 플러스");
    expect(row?.description).not.toContain("이용 중");
    row?.onPress?.();
    expect(mocks.push).toHaveBeenCalledWith("/settings/subscription");
  });

  it("retains the active personal subscription description while sales are paused", () => {
    mocks.access = { tier: "jango_plus", subscriptionsEnabled: false, paidCredits: { enabled: false } };
    expect(rows(SettingsScreen()).find((item) => item.title === "장고 플러스")?.description)
      .toContain("이용 중");
  });
});
