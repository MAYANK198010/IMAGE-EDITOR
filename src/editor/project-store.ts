export type TrackKind = "video" | "audio" | "text" | "effects" | "overlay";

export type ProjectKeyframe = {
  id: string;
  property: string;
  time: number;
  value: number | string;
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
};

export type ProjectTimelineItem = {
  id: string;
  trackId: string;
  kind: "video" | "audio" | "text" | "image" | "effect" | "transition";
  assetId?: string;
  start: number;
  duration: number;
  sourceStart?: number;
  sourceEnd?: number;
  speed?: number;
  volume?: number;
  muted?: boolean;
  effect?: Record<string, number>;
  style?: Record<string, string | number>;
  keyframes: ProjectKeyframe[];
};

export type ProjectTrack = {
  id: string;
  name: string;
  kind: TrackKind;
  order: number;
  visible: boolean;
  muted: boolean;
  locked: boolean;
  items: ProjectTimelineItem[];
};

export type StoredVideoClip = {
  id: string;
  assetId: string;
  name: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  speed: number;
  volume: number;
  muted: boolean;
  transition: "cut" | "fade";
  adjustments: {
    brightness: number;
    contrast: number;
    saturation: number;
    blur: number;
    sepia: number;
    grayscale: number;
    hue: number;
  };
};

export type StoredAudioAsset = {
  id: string;
  assetId: string;
  name: string;
  duration: number;
  volume: number;
};

export type StoredTitle = {
  text: string;
  start: number;
  end: number;
  color: string;
  size: number;
  position: "top" | "center" | "bottom";
};

export type VideoProjectRecord = {
  id: string;
  name: string;
  version: 1;
  createdAt: string;
  updatedAt: string;
  video: {
    clips: StoredVideoClip[];
    audioAsset: StoredAudioAsset | null;
    title: StoredTitle;
    exportSettings: {
      format: "mp4" | "webm";
      resolution: "720" | "1080" | "4k";
      aspect: "source" | "16:9" | "9:16" | "1:1" | "4:5";
      fps: number;
      frameStyle: "none" | "classic" | "film" | "neon";
    };
  };
  timeline: {
    tracks: ProjectTrack[];
    items: ProjectTimelineItem[];
    transitions: Array<{
      id: string;
      fromItemId: string;
      toItemId: string;
      type: "cut" | "fade" | "dissolve" | "wipe";
      duration: number;
    }>;
  };
};

export type ProjectAssetInput = {
  id: string;
  file: Blob;
  name: string;
  type: string;
  lastModified: number;
};

export type SavedProjectSummary = {
  id: string;
  name: string;
  updatedAt: string;
};

export type LoadedVideoProject = {
  project: VideoProjectRecord;
  assets: ProjectAssetInput[];
};

type StoredAssetRecord = ProjectAssetInput & {
  key: string;
  projectId: string;
};

const DATABASE_NAME = "frameforge-local-projects";
const DATABASE_VERSION = 1;
const PROJECT_STORE = "projects";
const ASSET_STORE = "assets";

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser does not support local project storage."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        database.createObjectStore(PROJECT_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(ASSET_STORE)) {
        database.createObjectStore(ASSET_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local project storage."));
    request.onblocked = () => reject(new Error("Project storage is blocked by another open FrameForge tab."));
  });
}

export async function listSavedProjects(): Promise<SavedProjectSummary[]> {
  const database = await openDatabase();
  try {
    const request = database.transaction(PROJECT_STORE, "readonly").objectStore(PROJECT_STORE).getAll();
    const projects = await new Promise<VideoProjectRecord[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as VideoProjectRecord[]);
      request.onerror = () => reject(request.error ?? new Error("Could not list saved projects."));
    });
    return projects
      .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } finally {
    database.close();
  }
}

export async function saveVideoProject(project: VideoProjectRecord, assets: ProjectAssetInput[]): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([PROJECT_STORE, ASSET_STORE], "readwrite");
      const assetStore = transaction.objectStore(ASSET_STORE);
      const currentAssets = assetStore.getAll();

      transaction.objectStore(PROJECT_STORE).put(project);
      currentAssets.onsuccess = () => {
        const retainedKeys = new Set(assets.map((asset) => `${project.id}::${asset.id}`));
        (currentAssets.result as StoredAssetRecord[])
          .filter((asset) => asset.projectId === project.id && !retainedKeys.has(asset.key))
          .forEach((asset) => assetStore.delete(asset.key));
        assets.forEach((asset) => assetStore.put({
          ...asset,
          key: `${project.id}::${asset.id}`,
          projectId: project.id,
        } satisfies StoredAssetRecord));
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the project."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Project save was cancelled."));
    });
  } finally {
    database.close();
  }
}

export async function loadVideoProject(projectId: string): Promise<LoadedVideoProject | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([PROJECT_STORE, ASSET_STORE], "readonly");
    const projectRequest = transaction.objectStore(PROJECT_STORE).get(projectId);
    const assetsRequest = transaction.objectStore(ASSET_STORE).getAll();

    const [project, allAssets] = await Promise.all([
      new Promise<VideoProjectRecord | undefined>((resolve, reject) => {
        projectRequest.onsuccess = () => resolve(projectRequest.result as VideoProjectRecord | undefined);
        projectRequest.onerror = () => reject(projectRequest.error ?? new Error("Could not load the project."));
      }),
      new Promise<StoredAssetRecord[]>((resolve, reject) => {
        assetsRequest.onsuccess = () => resolve(assetsRequest.result as StoredAssetRecord[]);
        assetsRequest.onerror = () => reject(assetsRequest.error ?? new Error("Could not load project media."));
      }),
    ]);

    if (!project) return null;
    const assets = allAssets
      .filter((asset) => asset.projectId === projectId)
      .map(({ id, file, name, type, lastModified }) => ({ id, file, name, type, lastModified }));
    return { project, assets };
  } finally {
    database.close();
  }
}
