import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, Extension, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  keymap,
  lineNumbers,
  placeholder
} from "@codemirror/view";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef
} from "react";

export type FormatCommand =
  | "heading-1"
  | "heading-2"
  | "bold"
  | "italic"
  | "code"
  | "link"
  | "bullet-list"
  | "quote"
  | "table";

export type MarkdownEditorHandle = {
  focus: () => void;
  formatSelection: (command: FormatCommand) => void;
  scrollToLine: (line: number) => void;
  scrollToRatio: (ratio: number) => void;
};

export type EditorScrollState = {
  ratio: number;
  topLine: number;
};

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onScroll: (state: EditorScrollState) => void;
  changedLines: number[];
};

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange, onScroll, changedLines }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onScrollRef = useRef(onScroll);
    const isSyncingExternalValueRef = useRef(false);
    const initialValueRef = useRef(value);
    const changedLinesCompartmentRef = useRef(new Compartment());

    onChangeRef.current = onChange;
    onScrollRef.current = onScroll;

    const extensions = useMemo<Extension[]>(
      () => [
        lineNumbers(),
        history(),
        markdown(),
        bracketMatching(),
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        placeholder("Start writing in Markdown..."),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          "aria-label": "Markdown source"
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isSyncingExternalValueRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.domEventHandlers({
          scroll(event, view) {
            if (event.target !== view.scrollDOM) return;
            onScrollRef.current(getEditorScrollState(view));
          }
        }),
        changedLinesCompartmentRef.current.of(createChangedLineExtension(changedLines)),
        freemarkTheme
      ],
      []
    );

    useEffect(() => {
      if (!containerRef.current || viewRef.current) return;

      const state = EditorState.create({
        doc: initialValueRef.current,
        extensions
      });

      viewRef.current = new EditorView({
        state,
        parent: containerRef.current
      });

      return () => {
        viewRef.current?.destroy();
        viewRef.current = null;
      };
    }, [extensions]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;

      view.dispatch({
        effects: changedLinesCompartmentRef.current.reconfigure(
          createChangedLineExtension(changedLines)
        )
      });
    }, [changedLines]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;

      const currentValue = view.state.doc.toString();
      if (currentValue === value) return;

      isSyncingExternalValueRef.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value
        }
      });
      isSyncingExternalValueRef.current = false;
    }, [value]);

    useImperativeHandle(ref, () => ({
      focus() {
        viewRef.current?.focus();
      },
      formatSelection(command) {
        const view = viewRef.current;
        if (!view) return;

        applyFormatCommand(view, command);
      },
      scrollToLine(line) {
        const view = viewRef.current;
        if (!view) return;

        const safeLine = Math.min(Math.max(line, 1), view.state.doc.lines);
        const targetLine = view.state.doc.line(safeLine);

        view.dispatch({
          selection: { anchor: targetLine.from },
          effects: EditorView.scrollIntoView(targetLine.from, {
            y: "start",
            yMargin: 28
          })
        });
      },
      scrollToRatio(ratio) {
        const view = viewRef.current;
        if (!view) return;

        const scrollDOM = view.scrollDOM;
        const maxScrollTop = Math.max(scrollDOM.scrollHeight - scrollDOM.clientHeight, 0);
        scrollDOM.scrollTop = maxScrollTop * clampRatio(ratio);
      }
    }));

    return (
      <div className="editor-pane">
        <span className="visually-hidden">Markdown source</span>
        <div ref={containerRef} className="codemirror-host" />
      </div>
    );
  }
);

function getEditorScrollState(view: EditorView): EditorScrollState {
  const scrollDOM = view.scrollDOM;
  const maxScrollTop = Math.max(scrollDOM.scrollHeight - scrollDOM.clientHeight, 0);
  const ratio = maxScrollTop === 0 ? 0 : scrollDOM.scrollTop / maxScrollTop;
  const block = view.lineBlockAtHeight(scrollDOM.scrollTop + 32);
  const topLine = view.state.doc.lineAt(block.from).number;

  return {
    ratio: clampRatio(ratio),
    topLine
  };
}

function clampRatio(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function applyFormatCommand(view: EditorView, command: FormatCommand) {
  const selection = view.state.selection.main;
  const selectedText = view.state.sliceDoc(selection.from, selection.to);

  if (command === "table") {
    replaceSelection(view, "\n| Column | Value |\n|---|---|\n| Format | Markdown |\n");
    return;
  }

  if (command === "heading-1") {
    prefixCurrentLines(view, "# ");
    return;
  }

  if (command === "heading-2") {
    prefixCurrentLines(view, "## ");
    return;
  }

  if (command === "bullet-list") {
    prefixCurrentLines(view, "- ");
    return;
  }

  if (command === "quote") {
    prefixCurrentLines(view, "> ");
    return;
  }

  const wrappers: Record<Exclude<FormatCommand, "heading-1" | "heading-2" | "bullet-list" | "quote" | "table">, [string, string, string]> = {
    bold: ["**", "**", "bold text"],
    italic: ["*", "*", "italic text"],
    code: ["`", "`", "code"],
    link: ["[", "](https://example.com)", "link text"]
  };

  const [before, after, fallback] = wrappers[command];
  const text = selectedText || fallback;
  const insert = `${before}${text}${after}`;

  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert },
    selection: {
      anchor: selection.from + before.length,
      head: selection.from + before.length + text.length
    }
  });
  view.focus();
}

function replaceSelection(view: EditorView, insert: string) {
  const selection = view.state.selection.main;

  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert },
    selection: { anchor: selection.from + insert.length }
  });
  view.focus();
}

function prefixCurrentLines(view: EditorView, prefix: string) {
  const selection = view.state.selection.main;
  const startLine = view.state.doc.lineAt(selection.from);
  const endLine = view.state.doc.lineAt(selection.to);
  const changes = [];

  for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
    const line = view.state.doc.line(lineNumber);
    changes.push({ from: line.from, insert: prefix });
  }

  view.dispatch({ changes });
  view.focus();
}

const freemarkTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "#fff",
    color: "#000"
  },
  ".cm-scroller": {
    fontFamily: '"Geist Mono", "JetBrains Mono", Consolas, monospace',
    fontSize: "14px",
    lineHeight: "1.7"
  },
  ".cm-content": {
    padding: "28px 20px 28px 0",
    caretColor: "#000"
  },
  ".cm-line": {
    position: "relative"
  },
  ".cm-gutters": {
    backgroundColor: "#fff",
    color: "#a59f97",
    borderRight: "1px solid #e5e5e5"
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 12px"
  },
  ".cm-activeLine": {
    backgroundColor: "#f5f3f1"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#f5f3f1",
    color: "#000"
  },
  ".cm-selectionBackground": {
    backgroundColor: "#dfe7ff !important"
  },
  ".cm-line-changed": {
    backgroundColor: "rgba(15, 163, 92, 0.12)"
  },
  ".cm-line-changed::before": {
    content: '""',
    position: "absolute",
    left: "0",
    width: "3px",
    height: "100%",
    backgroundColor: "#0fa35c"
  },
  ".cm-focused": {
    outline: "none"
  }
});

function createChangedLineExtension(changedLines: number[]): Extension {
  return EditorView.decorations.compute(["doc"], (state): DecorationSet => {
    const builder = new RangeSetBuilder<Decoration>();
    const uniqueLines = [...new Set(changedLines)].sort((a, b) => a - b);

    for (const lineNumber of uniqueLines) {
      if (lineNumber < 1 || lineNumber > state.doc.lines) continue;
      const line = state.doc.line(lineNumber);
      builder.add(line.from, line.from, Decoration.line({ class: "cm-line-changed" }));
    }

    return builder.finish();
  });
}
