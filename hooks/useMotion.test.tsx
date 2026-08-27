/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountUp } from "./useMotion";

describe("useCountUp", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays at 0 until active", () => {
    const { result } = renderHook(() => useCountUp(45, false));
    expect(result.current).toBe(0);
  });

  it("animates toward the target when active", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountUp(100, true, 200));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(result.current).toBe(100);
  });
});
