import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpoPushService } from "./expo-push.service";

describe("ExpoPushService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends a push and returns the ticket", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ status: "ok", id: "ticket-1" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = new ExpoPushService();
    const ticket = await service.send({
      to: "ExpoPushToken[test]",
      title: "hello",
      body: "world",
    });

    expect(ticket).toEqual({ status: "ok", id: "ticket-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify([
          {
            to: "ExpoPushToken[test]",
            title: "hello",
            body: "world",
          },
        ]),
      }),
    );
  });

  it("batches multiple push messages", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { status: "ok", id: "ticket-1" },
          { status: "ok", id: "ticket-2" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = new ExpoPushService();
    const tickets = await service.sendMany([
      { to: "ExpoPushToken[a]", title: "a", body: "1" },
      { to: "ExpoPushToken[b]", title: "b", body: "2" },
    ]);

    expect(tickets).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fetches push receipts by ticket id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          "ticket-1": {
            status: "error",
            details: { error: "DeviceNotRegistered" },
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = new ExpoPushService();
    const receipts = await service.getReceipts(["ticket-1"]);

    expect(receipts["ticket-1"]?.details?.error).toBe("DeviceNotRegistered");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/getReceipts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ids: ["ticket-1"] }),
      }),
    );
  });

  it("returns an empty map when receipt ids are empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const service = new ExpoPushService();
    await expect(service.getReceipts([])).resolves.toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
