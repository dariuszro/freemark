const DB_NAME = "freemark-local-library";
const DB_VERSION = 1;
const RECENT_STORE = "recentFiles";
const SETTINGS_STORE = "settings";
const CURRENT_DIRECTORY_KEY = "currentDirectory";

export type RecentMarkdownFile = {
  id: string;
  name: string;
  lastOpenedAt: number;
  handle: FileSystemFileHandle;
};

export type FolderMarkdownFile = {
  id: string;
  name: string;
  handle: FileSystemFileHandle;
};

export async function getRecentMarkdownFiles(): Promise<RecentMarkdownFile[]> {
  const db = await openLibraryDb();
  const transaction = db.transaction(RECENT_STORE, "readonly");
  const store = transaction.objectStore(RECENT_STORE);
  const entries = await requestToPromise<RecentMarkdownFile[]>(store.getAll());
  db.close();

  return entries.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, 10);
}

export async function rememberRecentMarkdownFile(handle: FileSystemFileHandle) {
  const db = await openLibraryDb();
  const recentFiles = await getRecentMarkdownFiles();
  const existing = recentFiles.find((entry) => entry.name === handle.name);
  const entry: RecentMarkdownFile = {
    id: existing?.id ?? createFileId(handle.name),
    name: handle.name,
    lastOpenedAt: Date.now(),
    handle
  };

  const transaction = db.transaction(RECENT_STORE, "readwrite");
  const store = transaction.objectStore(RECENT_STORE);
  await requestToPromise(store.put(entry));
  await transactionToPromise(transaction);
  db.close();
}

export async function openRecentMarkdownFile(entry: RecentMarkdownFile) {
  await ensureFilePermission(entry.handle);
  const file = await entry.handle.getFile();
  await rememberRecentMarkdownFile(entry.handle);

  return {
    name: file.name,
    content: await file.text(),
    handle: entry.handle
  };
}

export async function openMarkdownDirectory(): Promise<{
  handle: FileSystemDirectoryHandle;
  files: FolderMarkdownFile[];
} | null> {
  if (!("showDirectoryPicker" in window)) {
    return null;
  }

  const handle = await window.showDirectoryPicker();
  await rememberCurrentDirectory(handle);

  return {
    handle,
    files: await listMarkdownFiles(handle)
  };
}

export async function getStoredMarkdownDirectory(): Promise<{
  handle: FileSystemDirectoryHandle;
  files: FolderMarkdownFile[];
} | null> {
  const db = await openLibraryDb();
  const transaction = db.transaction(SETTINGS_STORE, "readonly");
  const store = transaction.objectStore(SETTINGS_STORE);
  const entry = await requestToPromise<{ key: string; handle: FileSystemDirectoryHandle } | undefined>(
    store.get(CURRENT_DIRECTORY_KEY)
  );
  db.close();

  if (!entry?.handle) return null;

  try {
    const hasPermission = await hasDirectoryReadPermission(entry.handle);
    if (!hasPermission) return null;

    return {
      handle: entry.handle,
      files: await listMarkdownFiles(entry.handle)
    };
  } catch {
    return null;
  }
}

export async function openFolderMarkdownFile(entry: FolderMarkdownFile) {
  await ensureFilePermission(entry.handle);
  const file = await entry.handle.getFile();
  await rememberRecentMarkdownFile(entry.handle);

  return {
    name: file.name,
    content: await file.text(),
    handle: entry.handle
  };
}

async function rememberCurrentDirectory(handle: FileSystemDirectoryHandle) {
  const db = await openLibraryDb();
  const transaction = db.transaction(SETTINGS_STORE, "readwrite");
  const store = transaction.objectStore(SETTINGS_STORE);
  await requestToPromise(store.put({ key: CURRENT_DIRECTORY_KEY, handle }));
  await transactionToPromise(transaction);
  db.close();
}

async function listMarkdownFiles(handle: FileSystemDirectoryHandle): Promise<FolderMarkdownFile[]> {
  await ensureDirectoryPermission(handle);
  const files: FolderMarkdownFile[] = [];

  for await (const entry of handle.values()) {
    if (entry.kind !== "file" || !isMarkdownFile(entry.name)) continue;

    files.push({
      id: entry.name,
      name: entry.name,
      handle: entry
    });
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

async function ensureFilePermission(handle: FileSystemFileHandle) {
  if (!handle.queryPermission || !handle.requestPermission) return;

  const currentPermission = await handle.queryPermission({ mode: "readwrite" });
  if (currentPermission === "granted") return;

  const nextPermission = await handle.requestPermission({ mode: "readwrite" });
  if (nextPermission !== "granted") {
    throw new Error("File permission was not granted.");
  }
}

async function ensureDirectoryPermission(handle: FileSystemDirectoryHandle) {
  if (!handle.queryPermission || !handle.requestPermission) return;

  const currentPermission = await handle.queryPermission({ mode: "read" });
  if (currentPermission === "granted") return;

  const nextPermission = await handle.requestPermission({ mode: "read" });
  if (nextPermission !== "granted") {
    throw new Error("Directory permission was not granted.");
  }
}

async function hasDirectoryReadPermission(handle: FileSystemDirectoryHandle) {
  if (!handle.queryPermission) return true;
  return (await handle.queryPermission({ mode: "read" })) === "granted";
}

function isMarkdownFile(name: string) {
  return /\.(md|markdown)$/i.test(name);
}

function createFileId(name: string) {
  return `${Date.now()}-${name}`;
}

function openLibraryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECENT_STORE)) {
        db.createObjectStore(RECENT_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}
