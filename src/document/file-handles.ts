export type OpenedMarkdownFile = {
  name: string;
  content: string;
  handle: FileSystemFileHandle | null;
};

export type SaveMarkdownResult =
  | { kind: "saved"; name: string; handle: FileSystemFileHandle | null }
  | { kind: "download" };

export async function openMarkdownFile(): Promise<OpenedMarkdownFile | null> {
  if ("showOpenFilePicker" in window) {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: "Markdown files",
          accept: {
            "text/markdown": [".md", ".markdown"],
            "text/plain": [".txt"]
          }
        }
      ]
    });

    const file = await handle.getFile();
    return {
      name: file.name,
      content: await file.text(),
      handle
    };
  }

  document.getElementById("open-file-input")?.click();
  return null;
}

export async function saveMarkdownFile(
  markdown: string,
  currentName: string,
  currentHandle: FileSystemFileHandle | null
): Promise<SaveMarkdownResult> {
  if (!("showSaveFilePicker" in window) && !currentHandle) {
    return { kind: "download" };
  }

  const handle =
    currentHandle ??
    (await window.showSaveFilePicker({
      suggestedName: currentName,
      types: [
        {
          description: "Markdown file",
          accept: {
            "text/markdown": [".md"]
          }
        }
      ]
    }));

  const writable = await handle.createWritable();
  await writable.write(markdown);
  await writable.close();

  return {
    kind: "saved",
    name: handle.name,
    handle
  };
}

export async function saveMarkdownFileAs(
  markdown: string,
  currentName: string
): Promise<SaveMarkdownResult> {
  return saveMarkdownFile(markdown, currentName, null);
}

export function downloadMarkdown(markdown: string, name: string) {
  downloadBlob(new Blob([markdown], { type: "text/markdown;charset=utf-8" }), name);
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
