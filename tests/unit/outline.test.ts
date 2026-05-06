import { describe, expect, it } from "vitest";
import { buildOutline } from "../../src/markdown/outline";

describe("buildOutline", () => {
  it("extracts markdown headings", () => {
    expect(buildOutline("# One\n\n## Two")).toEqual([
      { id: "one", line: 1, level: 1, text: "One" },
      { id: "two", line: 3, level: 2, text: "Two" }
    ]);
  });
});
