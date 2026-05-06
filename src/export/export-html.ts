import { downloadBlob } from "../document/file-handles";

type ExportHtmlInput = {
  title: string;
  markdown: string;
  html: string;
};

export function exportHtml({ title, markdown, html }: ExportHtmlInput) {
  const documentTitle = escapeHtml(title || "freemark-document");
  const sourceComment = markdown
    .split(/\r?\n/)
    .slice(0, 12)
    .map((line) => `  ${line}`)
    .join("\n");

  const fullHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${documentTitle}</title>
    <style>
${exportCss()}
    </style>
  </head>
  <body>
    <!--
freemark source preview:
${sourceComment}
    -->
    <main class="markdown-body">
${html}
    </main>
  </body>
</html>
`;

  downloadBlob(
    new Blob([fullHtml], { type: "text/html;charset=utf-8" }),
    `${sanitizeFileName(title || "freemark-document")}.html`
  );
}

function exportCss() {
  return `body {
  margin: 0;
  background: #fdfcfc;
  color: #000;
  font: 16px/1.65 Georgia, "Times New Roman", serif;
}

.markdown-body {
  box-sizing: border-box;
  width: min(760px, calc(100vw - 40px));
  margin: 56px auto;
}

h1, h2, h3 {
  font-weight: 400;
  line-height: 1.14;
}

h1 {
  font-size: 44px;
}

h2 {
  margin-top: 40px;
  font-size: 30px;
}

h3 {
  margin-top: 28px;
  font-size: 22px;
}

pre {
  overflow: auto;
  padding: 16px;
  background: #f5f3f1;
  border: 1px solid #e5e5e5;
}

code {
  font-family: "Geist Mono", "JetBrains Mono", Consolas, monospace;
  font-size: 0.92em;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 10px 12px;
  border: 1px solid #e5e5e5;
  text-align: left;
}

blockquote {
  margin-left: 0;
  padding-left: 18px;
  border-left: 2px solid #000;
  color: #777169;
}
`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}

function sanitizeFileName(value: string) {
  return value.replace(/\.md$/i, "").replace(/[^a-z0-9-_]+/gi, "-").replace(/(^-|-$)/g, "");
}
