import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../src/markdown/render";

describe("renderMarkdown", () => {
  it("renders markdown and sanitizes scripts", () => {
    const result = renderMarkdown("# Safe\n\n<script>alert('x')</script>");

    expect(result.html).toContain('<h1 id="safe">Safe</h1>');
    expect(result.html).not.toContain("<script>");
  });
});
