import * as React from "react";
import type { InventorySpaceSummary } from "@expirymate/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpaceProvider } from "./space-provider";

const hooks = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as Array<() => unknown>,
  spaces: [] as InventorySpaceSummary[],
  fetching: false,
}));

// Render the real provider across selection and query updates, retaining hook
// state and effect dependencies. Native views and network access are unnecessary.
vi.mock("react", async original => ({
  ...await original<typeof React>(),
  useState: (initial: unknown) => {
    const slot = hooks.cursor++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = initial;
    return [hooks.slots[slot], (value: unknown) => {
      hooks.slots[slot] = typeof value === "function"
        ? value(hooks.slots[slot]) : value;
    }];
  },
  useRef: (initial: unknown) => {
    const slot = hooks.cursor++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = { current: initial };
    return hooks.slots[slot];
  },
  useEffect: (effect: () => unknown, deps: unknown[]) => {
    const slot = hooks.cursor++;
    const previous = hooks.slots[slot] as unknown[] | undefined;
    if (!previous || deps.some((value, i) => !Object.is(value, previous[i]))) {
      hooks.slots[slot] = deps;
      hooks.effects.push(effect);
    }
  },
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
}));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: vi.fn().mockResolvedValue("personal"),
  setItem: vi.fn().mockResolvedValue(undefined),
} }));
vi.mock("@tanstack/react-query", async original => ({
  ...await original<typeof import("@tanstack/react-query")>(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: () => ({
    data: hooks.spaces, error: null, fetchStatus: hooks.fetching ? "fetching" : "idle",
    isError: false, isFetching: hooks.fetching, isPending: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("react-native", () => ({ AppState: {
  addEventListener: () => ({ remove: vi.fn() }),
} }));
vi.mock("../../services/api", () => ({ listInventorySpaces: vi.fn() }));
vi.mock("../../services/sentry", () => ({ captureSpaceBootstrapBreadcrumb: vi.fn() }));
vi.mock("../auth/use-auth", () => ({ useAuth: () => ({ sessionUserId: "member" }) }));
vi.mock("./ensure-enabled-query-fetch", () => ({
  useEnsureEnabledQueryFetch: vi.fn(), STALLED_INITIAL_FETCH_MESSAGE: "retry",
}));
vi.mock("./prefetch-space-queries", () => ({
  prefetchActiveSpaceQueries: vi.fn().mockResolvedValue(undefined),
  refetchActiveSpaceQueries: vi.fn().mockResolvedValue(undefined),
}));

const personal = { id: "personal", type: "personal" } as InventorySpaceSummary;
const shared = { id: "shared", type: "household" } as InventorySpaceSummary;

function render() {
  hooks.cursor = 0;
  const element = SpaceProvider({ children: null });
  hooks.effects.splice(0).forEach(effect => effect());
  return element.props.value;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
  hooks.slots = []; hooks.effects = []; hooks.cursor = 0;
  hooks.spaces = [personal, shared]; hooks.fetching = false;
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("shared space revocation after an explicit selection", () => {
  it("falls back after selecting an already cached space and later losing access", async () => {
    render(); await Promise.resolve();
    render().setActiveSpaceId("shared");
    expect(render().activeSpaceId).toBe("shared");
    // The list can retain its reference when refetch returns identical data.
    render();
    hooks.spaces = [personal];
    expect(render().activeSpaceId).toBe("personal");
    expect(render().isReady).toBe(true);
  });

  it("still waits for an accepted invitation missing from the cached list", async () => {
    hooks.spaces = [personal];
    render(); await Promise.resolve();
    render().setActiveSpaceId("shared");
    expect(render().activeSpaceId).toBeUndefined();
    hooks.spaces = [personal, shared];
    expect(render().activeSpaceId).toBe("shared");
    hooks.spaces = [personal];
    expect(render().activeSpaceId).toBe("personal");
  });
});
