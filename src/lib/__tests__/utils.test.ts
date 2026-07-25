import { describe, expect, it } from "vitest";
import { cn, errMsg } from "@/lib/utils";

describe("cn", () => {
  it("merges tailwind classes", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    const show = false;
    expect(cn("base", show && "hidden", "visible")).toBe("base visible");
  });

  it("resolves conflicts (last wins)", () => {
    expect(cn("px-4", "px-2")).toBe("px-2");
  });

  it("accepts no args", () => {
    expect(cn()).toBe("");
  });

  it("handles undefined and null", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b");
  });
});

describe("errMsg", () => {
  it("returns Error.message for Error instances", () => {
    expect(errMsg(new Error("something broke"))).toBe("something broke");
  });

  it("stringifies non-Errors", () => {
    expect(errMsg("just a string")).toBe("just a string");
    expect(errMsg(42)).toBe("42");
    expect(errMsg(null)).toBe("null");
    expect(errMsg(undefined)).toBe("undefined");
    expect(errMsg({ key: "val" })).toBe("[object Object]");
  });
});
