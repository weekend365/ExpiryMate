import { MutationObserver, QueryClient, type MutationObserverOptions } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { spacesListQueryKey } from "../auth/session-boundary";
import { useUpdateSpaceNotifications } from "./use-space-notifications";

const api = vi.hoisted(() => ({ update: vi.fn(), refetch: vi.fn(async () => undefined), userId: "user-a" }));
let client: QueryClient;
let observer: MutationObserver | undefined;
vi.mock("@tanstack/react-query", async (original) => ({
  ...await original<typeof import("@tanstack/react-query")>(),
  useQueryClient: () => client,
  useMutation: (options: MutationObserverOptions) => {
    if (observer) observer.setOptions(options);
    else observer = new MutationObserver(client, options);
    return { mutateAsync: observer.mutate.bind(observer) };
  },
}));
vi.mock("../../services/api", () => ({ updateSpaceNotifications: api.update }));
vi.mock("../auth/use-auth", () => ({ useAuth: () => ({ sessionUserId: api.userId }) }));
vi.mock("./space-provider", () => ({ useActiveSpace: () => ({ refetchSpaces: api.refetch }) }));

const initial = [
  { id: "home", notificationsEnabled: false },
  { id: "family", notificationsEnabled: true },
];
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  observer = undefined;
  api.userId = "user-a";
  client.setQueryData(spacesListQueryKey("user-a"), initial);
  client.setQueryData(spacesListQueryKey("user-b"), initial);
  vi.clearAllMocks();
});

describe("server-confirmed notification switch feedback", () => {
  it("updates only the saved space in the current user's cache", async () => {
    api.update.mockResolvedValue({ enabled: true });
    await useUpdateSpaceNotifications().mutateAsync({ spaceId: "home", enabled: true });
    expect(api.update).toHaveBeenCalledWith("home", true);
    expect(client.getQueryData(spacesListQueryKey("user-a"))).toEqual([
      { id: "home", notificationsEnabled: true }, initial[1],
    ]);
    expect(client.getQueryData(spacesListQueryKey("user-b"))).toEqual(initial);
    expect(api.refetch).toHaveBeenCalledOnce();
  });
  it("preserves the confirmed state when the server rejects a change", async () => {
    api.update.mockRejectedValue(new Error("forbidden"));
    await expect(useUpdateSpaceNotifications().mutateAsync({ spaceId: "home", enabled: true })).rejects.toThrow("forbidden");
    expect(client.getQueryData(spacesListQueryKey("user-a"))).toEqual(initial);
    expect(api.refetch).not.toHaveBeenCalled();
  });
  it("uses the response value and leaves a missing cache unpopulated", async () => {
    client.removeQueries({ queryKey: spacesListQueryKey("user-a") });
    api.update.mockResolvedValue({ enabled: false });
    await useUpdateSpaceNotifications().mutateAsync({ spaceId: "home", enabled: true });
    expect(client.getQueryData(spacesListQueryKey("user-a"))).toBeUndefined();
  });
  it("keeps an in-flight save bound to its original account after switching accounts", async () => {
    let finish!: (value: { enabled: boolean }) => void;
    let started!: () => void;
    const requestStarted = new Promise<void>(resolve => { started = resolve; });
    api.update.mockImplementation(() => {
      started();
      return new Promise(resolve => { finish = resolve; });
    });
    const pending = useUpdateSpaceNotifications().mutateAsync({ spaceId: "home", enabled: true });
    await requestStarted;
    api.userId = "user-b";
    useUpdateSpaceNotifications();
    finish({ enabled: true });
    await pending;
    expect(client.getQueryData(spacesListQueryKey("user-b"))).toEqual(initial);
    expect(client.getQueryData(spacesListQueryKey("user-a"))).toEqual([
      { id: "home", notificationsEnabled: true }, initial[1],
    ]);
    expect(api.refetch).not.toHaveBeenCalled();
  });
});
