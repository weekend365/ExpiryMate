import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { captureStartupBootstrapIssue } from "./bootstrap-diagnostics";
import { fetchWithNetworkError, parseEnvelope } from "./api-transport";

vi.mock("./bootstrap-diagnostics", () => ({ captureStartupBootstrapIssue: vi.fn() }));

describe("mobile API transport", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([null, {}, { success: "true" }])("rejects malformed envelopes: %j", async (value) => {
    await expect(parseEnvelope(Response.json(value))).rejects.toThrow("서버 응답 형식을 확인하지 못했어요.");
  });

  it("distinguishes unreadable JSON from malformed error envelopes", async () => {
    await expect(parseEnvelope(new Response("<html>error</html>"))).rejects.toThrow("앗, 답을 제대로 받지 못했어요.");
    await expect(parseEnvelope(Response.json({ success: false, error: null }))).rejects.toThrow("서버 오류 응답 형식을 확인하지 못했어요.");
  });

  it("validates successful data and leaves failure details available to the caller", async () => {
    const schema = z.object({ id: z.string() });
    await expect(parseEnvelope(Response.json({ success: true, data: { id: "ok" } }), schema)).resolves.toMatchObject({ data: { id: "ok" } });
    await expect(parseEnvelope(Response.json({ success: true, data: { id: 42 } }), schema)).rejects.toThrow("서버 응답 형식을 확인하지 못했어요.");
    expect(captureStartupBootstrapIssue).toHaveBeenCalledWith("api.response-schema", expect.anything(), { status: 200 });
    await expect(parseEnvelope(Response.json({ success: false, error: { code: "DENIED", details: { retry: false } } }), schema)).resolves.toMatchObject({
      success: false, error: { code: "DENIED", details: { retry: false } },
    });
  });

  it("aborts at the requested timeout and cleans up its timer", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    const result = expect(fetchWithNetworkError("/test", undefined, 100)).rejects.toThrow("응답이 너무 늦어요. 잠시 뒤 다시 해볼까요?");
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("forwards an upstream abort and removes the listener afterwards", async () => {
    const upstream = new AbortController();
    const remove = vi.spyOn(upstream.signal, "removeEventListener");
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    const result = expect(fetchWithNetworkError("/test", { signal: upstream.signal })).rejects.toThrow("응답이 너무 늦어요.");
    upstream.abort();
    await result;
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("maps network failures to the existing connection message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(fetchWithNetworkError("/test")).rejects.toThrow("인터넷 연결을 한번 봐 주세요.");
  });
});
