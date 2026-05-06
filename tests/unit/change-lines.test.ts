import { describe, expect, it } from "vitest";
import { getChangedLines } from "../../src/document/change-lines";

describe("getChangedLines", () => {
  it("returns 1-based changed line numbers", () => {
    expect(getChangedLines("one\ntwo\nthree", "one\nTWO\nthree\nfour")).toEqual([2, 4]);
  });

  it("does not mark unchanged shifted lines after an insertion", () => {
    expect(getChangedLines("one\ntwo\nthree", "one\ninserted\ntwo\nthree")).toEqual([2]);
  });

  it("marks the nearest visible line after a deletion", () => {
    expect(getChangedLines("one\ntwo\nthree", "one\nthree")).toEqual([2]);
  });
});
