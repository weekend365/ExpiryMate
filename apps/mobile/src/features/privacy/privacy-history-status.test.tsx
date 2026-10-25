import * as React from "react";
import { afterAll, describe, expect, it, vi } from "vitest";
import { PrivacyHistoryStatus } from "./privacy-history-status";

vi.mock("../../components/FeedbackBanner", () => ({ FeedbackBanner: "FeedbackBanner" }));
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

describe("privacy history loading and recovery", () => {
  const defaults = { count: undefined, isError: false, isFetching: true, onRetry: vi.fn() };

  it("does not render empty history before the count has loaded", () => {
    const children = vi.fn();
    const result = PrivacyHistoryStatus({ ...defaults, children });
    expect(result.props.testID).toBe("privacy-history-loading");
    expect(children).not.toHaveBeenCalled();
  });

  it.each([undefined, 0, 4])("hides destructive actions on errors, including cached count %s", (count) => {
    const children = vi.fn();
    const onRetry = vi.fn();
    const result = PrivacyHistoryStatus({ ...defaults, count, isError: true, isFetching: false, children, onRetry });
    expect(result.props.testID).toBe("privacy-history-error");
    expect(children).not.toHaveBeenCalled();
    result.props.onAction();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("prevents duplicate retries while an error is being retried", () => {
    const result = PrivacyHistoryStatus({ ...defaults, isError: true, children: vi.fn() });
    expect(result.props.onAction).toBeUndefined();
    expect(result.props.title).toContain("다시 확인");
  });

  it.each([0, 8])("renders only the confirmed count %s", (count) => {
    const children = vi.fn(() => null);
    PrivacyHistoryStatus({ ...defaults, count, isFetching: false, children });
    expect(children).toHaveBeenCalledWith(count);
  });
});
