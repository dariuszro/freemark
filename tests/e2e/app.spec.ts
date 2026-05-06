import { expect, test } from "@playwright/test";

test("renders the editor shell and live preview", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("freemark").first()).toBeVisible();
  await expect(page.getByLabel("Markdown source")).toBeVisible();
  await expect(page.getByLabel("Markdown preview")).toContainText("Sprint 1 proof");

  await page.getByLabel("Markdown source").fill("# Hello from test\n\nThis preview is live.");

  await expect(page.getByLabel("Markdown preview")).toContainText("Hello from test");
  await expect(page.getByText("Unsaved")).toBeVisible();

  await page.getByLabel("Markdown source").pressSequentially("\n\nFocus stays while typing.", {
    delay: 5
  });

  await expect(page.getByLabel("Markdown preview")).toContainText("Focus stays while typing.");

  await page.getByLabel("Table").click();

  await expect(page.getByLabel("Markdown preview")).toContainText("Column");
});

test("highlights lines changed since the last saved version", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Markdown source").fill("# Changed draft\n\nA fresh paragraph.");

  await expect(page.locator(".cm-line-changed").first()).toBeVisible();
});

test("asks before opening another document with unsaved changes", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Markdown source").fill("# Unsaved draft");
  await page.getByLabel("Open Markdown file").click();

  const dialog = page.getByRole("dialog", { name: "Zapisać zmiany?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Tak" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Nie" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Anuluj" })).toBeVisible();

  await dialog.getByRole("button", { name: "Anuluj" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Markdown preview")).toContainText("Unsaved draft");
});

test("creates a new blank document after discard confirmation", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Markdown source").fill("# Temporary draft");
  await page.getByLabel("New Markdown file").click();
  await page.getByRole("dialog", { name: "Zapisać zmiany?" }).getByRole("button", { name: "Nie" }).click();

  await expect(page.getByLabel("Markdown preview")).not.toContainText("Temporary draft");
  await expect(page.getByText("Saved")).toBeVisible();
});

test("formats the current line as a level-one heading", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Markdown source").fill("Document title");
  await page.getByLabel("Heading 1").click();

  await expect(page.getByLabel("Markdown preview").locator("h1")).toHaveText("Document title");
});

test("keeps the selected outline item visible for long documents", async ({ page }) => {
  await page.goto("/");

  const longDocument = Array.from({ length: 45 }, (_, index) => {
    const section = index + 1;
    return `## Section ${section}\n\n${"Paragraph text for a long document. ".repeat(12)}`;
  }).join("\n\n");

  await page.getByLabel("Markdown source").fill(`# Long document\n\n${longDocument}`);

  const outline = page.getByLabel("Document outline");
  const preview = page.getByLabel("Markdown preview");
  const editorScroller = page.locator(".cm-scroller");
  await preview.evaluate((element) => {
    element.scrollTop = 0;
  });
  await editorScroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  const initialScrollTop = await preview.evaluate((element) => element.scrollTop);
  const initialEditorScrollTop = await editorScroller.evaluate((element) => element.scrollTop);

  await outline.getByText("Section 42").click();

  await expect
    .poll(() => preview.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(initialScrollTop);
  await expect
    .poll(() => editorScroller.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(initialEditorScrollTop);
  await expect(outline.locator(".sidebar-link.active")).toHaveText("Section 42");
  await expect(outline.getByText("Section 42")).toBeInViewport();

  const isHeadingVisibleInPreview = await preview.evaluate((element) => {
    const heading = element.querySelector("#section-42");
    if (!heading) return false;

    const previewRect = element.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();

    return headingRect.top >= previewRect.top && headingRect.top < previewRect.bottom;
  });

  expect(isHeadingVisibleInPreview).toBe(true);
});

test("synchronizes manual scrolling between markdown and rich preview", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Recent MD")).toBeVisible();
  await expect(page.getByText("Folder MD")).toBeVisible();

  const longDocument = Array.from({ length: 55 }, (_, index) => {
    const section = index + 1;
    return `## Sync Section ${section}\n\n${"Scrolling should keep source and preview together. ".repeat(14)}`;
  }).join("\n\n");

  await page.getByLabel("Markdown source").fill(`# Scroll sync\n\n${longDocument}`);

  const outline = page.getByLabel("Document outline");
  const preview = page.getByLabel("Markdown preview");
  const editorScroller = page.locator(".cm-scroller");

  await preview.evaluate((element) => {
    element.scrollTop = 0;
  });
  await editorScroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight * 0.55;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });

  await expect.poll(() => preview.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(outline.locator(".sidebar-link.active")).toContainText("Sync Section");

  await editorScroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  await preview.evaluate((element) => {
    element.scrollTop = element.scrollHeight * 0.7;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });

  await expect.poll(() => editorScroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(outline.locator(".sidebar-link.active")).toContainText("Sync Section");
});
