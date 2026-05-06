export type OutlineItem = {
  id: string;
  line: number;
  level: number;
  text: string;
};

export function buildOutline(markdown: string): OutlineItem[] {
  const usedIds = new Map<string, number>();

  return markdown
    .split(/\r?\n/)
    .map((source, index) => ({
      line: index + 1,
      match: /^(#{1,6})\s+(.+)$/.exec(source.trim())
    }))
    .filter((entry): entry is { line: number; match: RegExpExecArray } => Boolean(entry.match))
    .map(({ line, match }) => {
      const text = match[2].replace(/[#*_`~[\]()]/g, "").trim();
      const baseId = slugify(text);
      const count = usedIds.get(baseId) ?? 0;
      usedIds.set(baseId, count + 1);

      return {
        id: count === 0 ? baseId : `${baseId}-${count}`,
        line,
        level: match[1].length,
        text
      };
    });
}

export function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "section"
  );
}
