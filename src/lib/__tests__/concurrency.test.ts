import { describe, expect, it } from "vitest";
import { mapLimit } from "@/lib/concurrency";

describe("mapLimit", () => {
  it("processes all items and preserves order", async () => {
    const result = await mapLimit([1, 2, 3], 2, async (x) => x * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it("handles empty input", async () => {
    await expect(mapLimit([], 5, async (x) => x)).resolves.toEqual([]);
  });

  it("limits concurrency (never exceeds limit simultaneous)", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await mapLimit([1, 2, 3, 4, 5], 3, async (x) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return x;
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it("runs items concurrently at the limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await mapLimit([1, 2, 3, 4], 2, async (x) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return x;
    });
    expect(maxInFlight).toBe(2);
  });

  it("handles a single item with limit 1", async () => {
    const result = await mapLimit(["x"], 1, async (x) => x.toUpperCase());
    expect(result).toEqual(["X"]);
  });

  it("propagates errors from the mapper", async () => {
    await expect(
      mapLimit([1, 2, 3], 2, async (x) => {
        if (x === 2) throw new Error("boom");
        return x;
      }),
    ).rejects.toThrow("boom");
  });

  it("runs at limit even when items outnumber limit", async () => {
    const order: number[] = [];
    await mapLimit([1, 2, 3, 4, 5], 2, async (x) => {
      order.push(x);
      await new Promise((r) => setTimeout(r, 5 * x));
      order.push(-x);
      return x;
    });
    expect(order).toEqual([1, 2, -1, 3, -2, 4, -3, 5, -4, -5]);
  });
});
