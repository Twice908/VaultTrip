import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("resolves Tailwind conflicts — last value wins", () => {
    expect(cn("p-4", "p-8")).toBe("p-8");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("bg-black", "bg-white")).toBe("bg-white");
  });

  it("handles conditional classes (truthy)", () => {
    const active = true;
    expect(cn("base", active && "active")).toBe("base active");
  });

  it("handles conditional classes (falsy)", () => {
    const active = false;
    expect(cn("base", active && "active")).toBe("base");
  });

  it("handles undefined and null inputs without throwing", () => {
    expect(cn("foo", undefined, null as unknown as undefined, "bar")).toBe("foo bar");
  });

  it("handles an array of classes", () => {
    expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz");
  });

  it("handles object syntax from clsx", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });

  it("returns an empty string when called with no arguments", () => {
    expect(cn()).toBe("");
  });
});
