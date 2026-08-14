import { describe, expect, it } from "vitest";
import { mapPool, mapPoolSettled } from "./async-pool";

describe("mapPool", () => {
  it("preserves order with a concurrency cap", async () => {
    const seen: number[] = [];
    const result = await mapPool(
      [1, 2, 3, 4],
      async (n) => {
        seen.push(n);
        await new Promise((r) => setTimeout(r, 5));
        return n * 10;
      },
      { concurrency: 2 },
    );
    expect(result).toEqual([10, 20, 30, 40]);
    expect(seen.sort()).toEqual([1, 2, 3, 4]);
  });

  it("reports progress", async () => {
    const ticks: number[] = [];
    await mapPool([1, 2, 3], async (n) => n, {
      concurrency: 1,
      onProgress: (done) => ticks.push(done),
    });
    expect(ticks).toEqual([1, 2, 3]);
  });
});

describe("mapPoolSettled", () => {
  it("captures per-item errors", async () => {
    const result = await mapPoolSettled(
      [1, 2, 3],
      async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      },
      { concurrency: 3 },
    );
    expect(result[0]).toEqual({ status: "fulfilled", value: 1 });
    expect(result[1]?.status).toBe("rejected");
    expect(result[2]).toEqual({ status: "fulfilled", value: 3 });
  });
});
