type StatusBarProps = {
  saveState: "saved" | "unsaved";
  words: number;
  characters: number;
  headings: number;
  mode: string;
};

export function StatusBar({ saveState, words, characters, headings, mode }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <span className={`status-dot ${saveState}`} aria-hidden="true" />
      <span>{saveState === "saved" ? "Saved" : "Unsaved"}</span>
      <span>{words} words</span>
      <span>{characters} chars</span>
      <span>{headings} headings</span>
      <span>{mode}</span>
    </footer>
  );
}
