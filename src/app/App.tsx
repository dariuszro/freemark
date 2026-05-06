import { ChangeEvent, UIEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Code,
  Download,
  Eye,
  FileDown,
  FilePlus2,
  FileText,
  Heading1,
  Heading2,
  Italic,
  Link,
  List,
  PanelLeft,
  Printer,
  Quote,
  Save,
  SaveAll,
  SplitSquareHorizontal,
  Table2
} from "lucide-react";
import { renderMarkdown } from "../markdown/render";
import { buildOutline } from "../markdown/outline";
import { exportHtml } from "../export/export-html";
import { getChangedLines } from "../document/change-lines";
import {
  downloadMarkdown,
  openMarkdownFile,
  saveMarkdownFile,
  saveMarkdownFileAs
} from "../document/file-handles";
import {
  FolderMarkdownFile,
  RecentMarkdownFile,
  getRecentMarkdownFiles,
  getStoredMarkdownDirectory,
  openFolderMarkdownFile,
  openMarkdownDirectory,
  openRecentMarkdownFile,
  rememberRecentMarkdownFile
} from "../document/local-library";
import {
  EditorScrollState,
  FormatCommand,
  MarkdownEditor,
  MarkdownEditorHandle
} from "../editor/MarkdownEditor";
import { WorkspaceSidebar } from "../ui/WorkspaceSidebar";
import { IconButton } from "../ui/IconButton";
import { StatusBar } from "../ui/StatusBar";
import { sampleDocument } from "./sample-document";

type ViewMode = "split" | "editor" | "preview";
type SavePromptDecision = "save" | "discard" | "cancel";
type SavePromptState = {
  documentName: string;
  resolve: (decision: SavePromptDecision) => void;
};

export function App() {
  const [markdown, setMarkdown] = useState(sampleDocument);
  const [savedMarkdown, setSavedMarkdown] = useState(sampleDocument);
  const [documentName, setDocumentName] = useState("untitled.md");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [isOutlineVisible, setOutlineVisible] = useState(true);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentMarkdownFile[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [folderFiles, setFolderFiles] = useState<FolderMarkdownFile[]>([]);
  const [saveState, setSaveState] = useState<"saved" | "unsaved">("saved");
  const [savePrompt, setSavePrompt] = useState<SavePromptState | null>(null);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const isScrollSyncingRef = useRef(false);
  const isFallbackOpenApprovedRef = useRef(false);

  const rendered = useMemo(() => renderMarkdown(markdown), [markdown]);
  const outline = useMemo(() => buildOutline(markdown), [markdown]);
  const counts = useMemo(() => getDocumentCounts(markdown), [markdown]);
  const changedLines = useMemo(
    () => getChangedLines(savedMarkdown, markdown),
    [markdown, savedMarkdown]
  );

  const handleMarkdownChange = (nextValue: string) => {
    setMarkdown(nextValue);
    setSaveState(nextValue === savedMarkdown ? "saved" : "unsaved");
  };

  useEffect(() => {
    let isMounted = true;

    async function loadLibrary() {
      const [recent, directory] = await Promise.all([
        getRecentMarkdownFiles(),
        getStoredMarkdownDirectory()
      ]);

      if (!isMounted) return;
      setRecentFiles(recent);
      if (directory) {
        setFolderName(directory.handle.name);
        setFolderFiles(directory.files);
      }
    }

    void loadLibrary();

    return () => {
      isMounted = false;
    };
  }, []);

  const setActiveDocument = async (
    name: string,
    content: string,
    handle: FileSystemFileHandle | null
  ) => {
    setMarkdown(content);
    setSavedMarkdown(content);
    setDocumentName(name);
    fileHandleRef.current = handle;
    setSaveState("saved");

    if (handle) {
      await rememberRecentMarkdownFile(handle);
      setRecentFiles(await getRecentMarkdownFiles());
    }
  };

  const handleNewDocument = async () => {
    if (!(await ensureCanReplaceActiveDocument())) return;

    await setActiveDocument("untitled.md", "", null);
    window.setTimeout(() => editorRef.current?.focus(), 0);
  };

  const handleOpen = async () => {
    if (!(await ensureCanReplaceActiveDocument())) return;

    try {
      isFallbackOpenApprovedRef.current = true;
      const opened = await openMarkdownFile();
      if (opened) {
        isFallbackOpenApprovedRef.current = false;
      }
      if (!opened) return;
      await setActiveDocument(opened.name, opened.content, opened.handle);
    } catch (error) {
      isFallbackOpenApprovedRef.current = false;
      console.warn("Opening a Markdown file was cancelled or failed.", error);
    }
  };

  const commitSaveResult = async (result: Awaited<ReturnType<typeof saveMarkdownFile>>) => {
    if (result.kind === "saved") {
      fileHandleRef.current = result.handle;
      setDocumentName(result.name);
      if (result.handle) {
        await rememberRecentMarkdownFile(result.handle);
        setRecentFiles(await getRecentMarkdownFiles());
      }
      setSavedMarkdown(markdown);
      setSaveState("saved");
      return true;
    }

    downloadMarkdown(markdown, documentName);
    setSavedMarkdown(markdown);
    setSaveState("saved");
    return true;
  };

  const saveActiveDocument = async () => {
    try {
      const result = await saveMarkdownFile(markdown, documentName, fileHandleRef.current);
      return commitSaveResult(result);
    } catch (error) {
      setSaveState("unsaved");
      console.warn("Saving a Markdown file was cancelled or failed.", error);
      return false;
    }
  };

  const handleSave = async () => {
    await saveActiveDocument();
  };

  const handleSaveAs = async () => {
    try {
      const result = await saveMarkdownFileAs(markdown, documentName);
      await commitSaveResult(result);
    } catch (error) {
      setSaveState(markdown === savedMarkdown ? "saved" : "unsaved");
      console.warn("Saving a Markdown file as a new file was cancelled or failed.", error);
    }
  };

  const handleExportHtml = () => {
    exportHtml({
      title: documentName.replace(/\.md$/i, ""),
      markdown,
      html: rendered.html
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleFallbackOpen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const isApproved = isFallbackOpenApprovedRef.current;
    isFallbackOpenApprovedRef.current = false;

    if (!isApproved && !(await ensureCanReplaceActiveDocument())) {
      event.target.value = "";
      return;
    }

    const content = await file.text();
    await setActiveDocument(file.name, content, null);
    event.target.value = "";
  };

  const handleRecentFileSelect = async (file: RecentMarkdownFile) => {
    if (!(await ensureCanReplaceActiveDocument())) return;

    try {
      const opened = await openRecentMarkdownFile(file);
      await setActiveDocument(opened.name, opened.content, opened.handle);
    } catch (error) {
      console.warn("Opening a recent Markdown file was cancelled or failed.", error);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const openedDirectory = await openMarkdownDirectory();
      if (!openedDirectory) return;

      setFolderName(openedDirectory.handle.name);
      setFolderFiles(openedDirectory.files);
    } catch (error) {
      console.warn("Opening a Markdown folder was cancelled or failed.", error);
    }
  };

  const handleFolderFileSelect = async (file: FolderMarkdownFile) => {
    if (!(await ensureCanReplaceActiveDocument())) return;

    try {
      const opened = await openFolderMarkdownFile(file);
      await setActiveDocument(opened.name, opened.content, opened.handle);
    } catch (error) {
      console.warn("Opening a folder Markdown file was cancelled or failed.", error);
    }
  };

  const ensureCanReplaceActiveDocument = async () => {
    if (saveState === "saved") return true;

    const decision = await requestSavePrompt(documentName);
    if (decision === "save") {
      return saveActiveDocument();
    }

    return decision === "discard";
  };

  const requestSavePrompt = (name: string) => {
    return new Promise<SavePromptDecision>((resolve) => {
      setSavePrompt({ documentName: name, resolve });
    });
  };

  const resolveSavePrompt = (decision: SavePromptDecision) => {
    savePrompt?.resolve(decision);
    setSavePrompt(null);
  };

  const handleFormat = (command: FormatCommand) => {
    editorRef.current?.formatSelection(command);
  };

  useEffect(() => {
    setActiveHeadingId((currentId) => {
      if (currentId && outline.some((item) => item.id === currentId)) {
        return currentId;
      }

      return outline[0]?.id ?? null;
    });
  }, [outline]);

  const handleOutlineSelect = (id: string) => {
    runWithoutScrollEcho(() => {
      setActiveHeadingId(id);
      const outlineItem = outline.find((item) => item.id === id);
      if (outlineItem) {
        editorRef.current?.scrollToLine(outlineItem.line);
      }

      scrollPreviewToHeading(id);
    });
  };

  const handleEditorScroll = ({ ratio, topLine }: EditorScrollState) => {
    if (isScrollSyncingRef.current) return;

    runWithoutScrollEcho(() => {
      scrollPreviewToRatio(ratio);
      setActiveHeadingId(getActiveHeadingIdForLine(topLine));
    });
  };

  const handlePreviewScroll = (event: UIEvent<HTMLElement>) => {
    if (isScrollSyncingRef.current) return;

    const preview = event.currentTarget;
    const ratio = getScrollRatio(preview);
    const activeId = getActiveHeadingIdForPreview(preview);

    runWithoutScrollEcho(() => {
      editorRef.current?.scrollToRatio(ratio);
      setActiveHeadingId(activeId);
    });
  };

  const scrollPreviewToHeading = (id: string) => {
    const preview = previewRef.current;
    const target = preview?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!preview || !target) return;

    const previewRect = preview.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextScrollTop = preview.scrollTop + targetRect.top - previewRect.top - 24;

    preview.scrollTo({
      top: Math.max(nextScrollTop, 0),
      behavior: "auto"
    });
  };

  const scrollPreviewToRatio = (ratio: number) => {
    const preview = previewRef.current;
    if (!preview) return;

    const maxScrollTop = Math.max(preview.scrollHeight - preview.clientHeight, 0);
    preview.scrollTop = maxScrollTop * clampRatio(ratio);
  };

  const getActiveHeadingIdForLine = (line: number) => {
    const activeItem = outline.reduce((current, item) => {
      if (item.line <= line) return item;
      return current;
    }, outline[0]);

    return activeItem?.id ?? null;
  };

  const getActiveHeadingIdForPreview = (preview: HTMLElement) => {
    const headings = Array.from(
      preview.querySelectorAll<HTMLElement>("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]")
    );

    if (headings.length === 0) {
      return null;
    }

    const previewRect = preview.getBoundingClientRect();
    const scrollPosition = preview.scrollTop + 96;
    const activeHeading = headings.reduce((current, heading) => {
      const headingTop = preview.scrollTop + heading.getBoundingClientRect().top - previewRect.top;
      if (headingTop <= scrollPosition) {
        return heading;
      }

      return current;
    }, headings[0]);

    return activeHeading.id;
  };

  const runWithoutScrollEcho = (callback: () => void) => {
    isScrollSyncingRef.current = true;
    callback();
    window.setTimeout(() => {
      isScrollSyncingRef.current = false;
    }, 0);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="freemark home">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">freemark</span>
        </div>

        <div className="document-chip" title={documentName}>
          <FileText size={15} aria-hidden="true" />
          <span>{documentName}</span>
        </div>

        <nav className="topbar-actions" aria-label="Document actions">
          <input
            id="open-file-input"
            className="visually-hidden"
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            onChange={handleFallbackOpen}
          />
          <IconButton label="New Markdown file" onClick={handleNewDocument} icon={<FilePlus2 size={16} />} />
          <IconButton label="Open Markdown file" onClick={handleOpen} icon={<FileDown size={16} />} />
          <IconButton label="Save Markdown file" onClick={handleSave} icon={<Save size={16} />} primary />
          <IconButton label="Save Markdown file as" onClick={handleSaveAs} icon={<SaveAll size={16} />} />
          <IconButton label="Export HTML" onClick={handleExportHtml} icon={<Download size={16} />} />
          <IconButton label="Print or save PDF" onClick={handlePrint} icon={<Printer size={16} />} />
        </nav>
      </header>

      <main className={`workspace workspace-${viewMode}`}>
        {isOutlineVisible && (
          <WorkspaceSidebar
            outlineItems={outline}
            activeOutlineId={activeHeadingId}
            onOutlineSelect={handleOutlineSelect}
            recentFiles={recentFiles}
            onRecentFileSelect={handleRecentFileSelect}
            folderName={folderName}
            folderFiles={folderFiles}
            onOpenFolder={handleOpenFolder}
            onFolderFileSelect={handleFolderFileSelect}
          />
        )}

        <section className="workbench" aria-label="Markdown editing workspace">
          <div className="workbench-toolbar">
            <div className="toolbar-cluster">
              <div className="segmented-control" aria-label="View mode">
                <button
                  className={viewMode === "split" ? "active" : ""}
                  type="button"
                  onClick={() => setViewMode("split")}
                  title="Split view"
                >
                  <SplitSquareHorizontal size={15} />
                </button>
                <button
                  className={viewMode === "editor" ? "active" : ""}
                  type="button"
                  onClick={() => setViewMode("editor")}
                  title="Editor only"
                >
                  <FileText size={15} />
                </button>
                <button
                  className={viewMode === "preview" ? "active" : ""}
                  type="button"
                  onClick={() => setViewMode("preview")}
                  title="Preview only"
                >
                  <Eye size={15} />
                </button>
              </div>

              <div className="format-toolbar" aria-label="Markdown formatting">
                <IconButton label="Heading 1" onClick={() => handleFormat("heading-1")} icon={<Heading1 size={15} />} />
                <IconButton label="Heading 2" onClick={() => handleFormat("heading-2")} icon={<Heading2 size={15} />} />
                <IconButton label="Bold" onClick={() => handleFormat("bold")} icon={<Bold size={15} />} />
                <IconButton label="Italic" onClick={() => handleFormat("italic")} icon={<Italic size={15} />} />
                <IconButton label="Inline code" onClick={() => handleFormat("code")} icon={<Code size={15} />} />
                <IconButton label="Link" onClick={() => handleFormat("link")} icon={<Link size={15} />} />
                <IconButton label="Bullet list" onClick={() => handleFormat("bullet-list")} icon={<List size={15} />} />
                <IconButton label="Quote" onClick={() => handleFormat("quote")} icon={<Quote size={15} />} />
                <IconButton label="Table" onClick={() => handleFormat("table")} icon={<Table2 size={15} />} />
              </div>
            </div>

            <IconButton
              label={isOutlineVisible ? "Hide outline" : "Show outline"}
              onClick={() => setOutlineVisible((visible) => !visible)}
              icon={<PanelLeft size={16} />}
            />
          </div>

          <div className="editor-grid">
            {viewMode !== "preview" && (
              <MarkdownEditor
                ref={editorRef}
                value={markdown}
                onChange={handleMarkdownChange}
                onScroll={handleEditorScroll}
                changedLines={changedLines}
              />
            )}
            {viewMode !== "editor" && (
              <article
                ref={previewRef}
                className="preview-pane markdown-body"
                aria-label="Markdown preview"
                onScroll={handlePreviewScroll}
                dangerouslySetInnerHTML={{ __html: rendered.html }}
              />
            )}
          </div>
        </section>
      </main>

      <StatusBar
        saveState={saveState}
        words={counts.words}
        characters={counts.characters}
        headings={outline.length}
        mode={viewMode}
      />

      {savePrompt && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="decision-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-prompt-title"
            aria-describedby="save-prompt-description"
          >
            <div>
              <h2 id="save-prompt-title">Zapisać zmiany?</h2>
              <p id="save-prompt-description">
                Dokument {savePrompt.documentName} ma niezapisane zmiany.
              </p>
            </div>

            <div className="dialog-actions">
              <button
                className="dialog-button dialog-button-primary"
                type="button"
                onClick={() => resolveSavePrompt("save")}
                autoFocus
              >
                Tak
              </button>
              <button
                className="dialog-button"
                type="button"
                onClick={() => resolveSavePrompt("discard")}
              >
                Nie
              </button>
              <button
                className="dialog-button"
                type="button"
                onClick={() => resolveSavePrompt("cancel")}
              >
                Anuluj
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function getDocumentCounts(markdown: string) {
  const plainText = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/[#>*_[\]()`~!-]/g, " ");

  const words = plainText.trim().length === 0 ? 0 : plainText.trim().split(/\s+/).length;

  return {
    words,
    characters: markdown.length
  };
}

function getScrollRatio(element: HTMLElement) {
  const maxScrollTop = Math.max(element.scrollHeight - element.clientHeight, 0);
  return maxScrollTop === 0 ? 0 : clampRatio(element.scrollTop / maxScrollTop);
}

function clampRatio(value: number) {
  return Math.min(Math.max(value, 0), 1);
}
