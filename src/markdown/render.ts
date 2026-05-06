import DOMPurify from "dompurify";
import { Renderer, marked } from "marked";
import { slugify } from "./outline";

marked.use({
  gfm: true,
  breaks: false
});

export type RenderedMarkdown = {
  html: string;
};

export function renderMarkdown(markdown: string): RenderedMarkdown {
  const rawHtml = marked.parse(markdown, {
    async: false,
    renderer: createHeadingRenderer()
  }) as string;

  return {
    html: DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true }
    })
  };
}

function createHeadingRenderer() {
  const renderer = new Renderer();
  const usedIds = new Map<string, number>();

  renderer.heading = function heading({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const plainText = text.replace(/<[^>]+>/g, "");
    const baseId = slugify(plainText);
    const count = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count}`;

    return `<h${depth} id="${id}">${text}</h${depth}>`;
  };

  return renderer;
}
