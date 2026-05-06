import { useEffect, useRef } from "react";
import { Clock3, FileText, FolderOpen, ListTree } from "lucide-react";
import { FolderMarkdownFile, RecentMarkdownFile } from "../document/local-library";
import { OutlineItem } from "../markdown/outline";

type WorkspaceSidebarProps = {
  outlineItems: OutlineItem[];
  activeOutlineId: string | null;
  onOutlineSelect: (id: string) => void;
  recentFiles: RecentMarkdownFile[];
  onRecentFileSelect: (file: RecentMarkdownFile) => void;
  folderName: string | null;
  folderFiles: FolderMarkdownFile[];
  onOpenFolder: () => void;
  onFolderFileSelect: (file: FolderMarkdownFile) => void;
};

export function WorkspaceSidebar({
  outlineItems,
  activeOutlineId,
  onOutlineSelect,
  recentFiles,
  onRecentFileSelect,
  folderName,
  folderFiles,
  onOpenFolder,
  onFolderFileSelect
}: WorkspaceSidebarProps) {
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeLinkRef.current?.scrollIntoView({
      block: "nearest"
    });
  }, [activeOutlineId]);

  return (
    <aside className="workspace-sidebar" aria-label="Workspace navigation">
      <details className="sidebar-section" open>
        <summary>
          <ListTree size={15} aria-hidden="true" />
          <span>Outline</span>
          <small>{outlineItems.length}</small>
        </summary>

        {outlineItems.length === 0 ? (
          <p className="empty-state">No headings yet.</p>
        ) : (
          <nav className="sidebar-list" aria-label="Document outline">
            {outlineItems.map((item) => (
              <a
                key={`${item.id}-${item.level}`}
                ref={item.id === activeOutlineId ? activeLinkRef : undefined}
                className={item.id === activeOutlineId ? "sidebar-link active" : "sidebar-link"}
                href={`#${item.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  onOutlineSelect(item.id);
                }}
                style={{ paddingLeft: `${(item.level - 1) * 12 + 12}px` }}
              >
                {item.text}
              </a>
            ))}
          </nav>
        )}
      </details>

      <details className="sidebar-section">
        <summary>
          <Clock3 size={15} aria-hidden="true" />
          <span>Recent MD</span>
          <small>{recentFiles.length}</small>
        </summary>

        {recentFiles.length === 0 ? (
          <p className="empty-state">No recent Markdown files.</p>
        ) : (
          <div className="sidebar-list" aria-label="Recent Markdown files">
            {recentFiles.map((file) => (
              <button
                key={file.id}
                className="sidebar-file"
                type="button"
                onClick={() => onRecentFileSelect(file)}
                title={file.name}
              >
                <FileText size={14} aria-hidden="true" />
                <span>{file.name}</span>
              </button>
            ))}
          </div>
        )}
      </details>

      <details className="sidebar-section">
        <summary>
          <FolderOpen size={15} aria-hidden="true" />
          <span>Folder MD</span>
          <small>{folderFiles.length}</small>
        </summary>

        <div className="folder-panel">
          <button className="folder-open-button" type="button" onClick={onOpenFolder}>
            Open Folder
          </button>
          {folderName && <p className="folder-name">{folderName}</p>}
        </div>

        {folderFiles.length === 0 ? (
          <p className="empty-state">Choose a folder to list Markdown files.</p>
        ) : (
          <div className="sidebar-list" aria-label="Folder Markdown files">
            {folderFiles.map((file) => (
              <button
                key={file.id}
                className="sidebar-file"
                type="button"
                onClick={() => onFolderFileSelect(file)}
                title={file.name}
              >
                <FileText size={14} aria-hidden="true" />
                <span>{file.name}</span>
              </button>
            ))}
          </div>
        )}
      </details>
    </aside>
  );
}
