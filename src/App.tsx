import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type WheelEvent,
} from "react";
import {
  Check,
  ChevronUp,
  CircleDot,
  ClipboardList,
  Columns2,
  Copy,
  ImageIcon,
  Minus,
  NotebookPen,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Save,
  Search,
  SkipBack,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

export type IslandMode = "collapsed" | "expanded";

type IslandPage = "todo" | "music" | "clipboard" | "layout";
type TodoPageMode = "today" | "daily" | "archive" | "review";
type ArchiveLayout = "cards" | "timeline";
type MediaPlaybackStatus = "unavailable" | "playing" | "paused";

type TodoItem = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
};

type TodoArchive = {
  date: string;
  todos: TodoItem[];
  dailyNote: string;
  savedAt: number;
  savedToDisk: boolean;
  filePath?: string;
};

type SaveState = "idle" | "saving" | "saved" | "needs-path" | "error";
type SavePathState = "idle" | "saved";

type SaveTodoResult = {
  filePath: string;
};

type MediaState = {
  available: boolean;
  audioActive: boolean;
  audioPeak: number;
  playbackStatus: MediaPlaybackStatus;
  updatedAt: number;
};

type ClipboardHistorySettings = {
  enabled: boolean;
  captureImages: boolean;
  maxItems: number;
};

type ClipboardHistoryImage = {
  width: number;
  height: number;
  byteSize: number;
  originalPath: string;
  thumbnailPath: string;
  thumbnailDataUrl?: string;
};

type ClipboardHistoryItem = {
  id: string;
  kind: "text" | "image";
  hash: string;
  createdAt: number;
  copiedAt: number;
  preview: string;
  text?: string;
  image?: ClipboardHistoryImage;
};

type ClipboardHistorySnapshot = {
  settings: ClipboardHistorySettings;
  items: ClipboardHistoryItem[];
};

type AudioLevel = {
  active: boolean;
  peak: number;
  updatedAt: number;
};

type IslandSettings = {
  opacity: number;
  sizeScale: number;
  marginY: number;
  taskTextColor: string;
  pulseColor: string;
  pulseBrightness: number;
  islandBackgroundColor: string;
  todoBackgroundColor: string;
  showTitle: boolean;
};

type IslandPreset = {
  id: string;
  name: string;
  settings: IslandSettings;
  createdAt: number;
  isDefault?: boolean;
};

type IslandShellProps = {
  mode: IslandMode;
  page: IslandPage;
  isTucked: boolean;
  showTitle: boolean;
  activeTaskTitle: string | null;
  pendingTodoCount: number;
  mediaState: MediaState;
  onOpenPage: (page: IslandPage) => void;
  onCollapse: () => void;
  onMinimize: () => void;
  onTuck: () => void;
  onReveal: () => void;
  onPageChange: (page: IslandPage) => void;
  children: ReactNode;
};

const STORAGE_KEY = "focusd-island-settings";
const SETTINGS_PRESETS_STORAGE_KEY = "focusd-island-setting-presets";
const TODOS_STORAGE_KEY = "focusd-island-todos";
const ACTIVE_TODO_STORAGE_KEY = "focusd-island-active-todo";
const TODO_DATE_STORAGE_KEY = "focusd-island-current-date";
const TODO_ARCHIVE_STORAGE_KEY = "focusd-island-archives";
const DAILY_NOTE_STORAGE_KEY = "focusd-island-daily-note";
const TODO_SAVE_DIRECTORY_STORAGE_KEY = "focusd-island-save-directory";
const TODO_LAST_SAVED_SIGNATURE_STORAGE_KEY =
  "focusd-island-last-saved-signature";
const BASE_EXPANDED_ISLAND_HEIGHT = 306;
const MUSIC_EXPANDED_ISLAND_HEIGHT = 286;
const CLIPBOARD_EXPANDED_ISLAND_HEIGHT = 430;
const EDITOR_EXPANDED_ISLAND_HEIGHT = 430;
const TODO_ROW_HEIGHT = 46;
const TODO_TITLE_CHARACTERS_PER_LINE = 32;
const TODO_MAX_ESTIMATED_TITLE_LINES = 5;
const TODO_GROW_START_ROWS = 2;
const TODO_SCROLL_START_ROWS = 6;
const MAX_CUSTOM_SETTING_PRESETS = 6;
const DEFAULT_TASK_TEXT_COLOR = "#1afbff";
const AUDIO_ACTIVE_THRESHOLD = 0.000015;
const DEFAULT_MEDIA_STATE: MediaState = {
  available: false,
  audioActive: false,
  audioPeak: 0,
  playbackStatus: "unavailable",
  updatedAt: 0,
};
const DEFAULT_CLIPBOARD_HISTORY: ClipboardHistorySnapshot = {
  settings: {
    enabled: true,
    captureImages: true,
    maxItems: 30,
  },
  items: [],
};
const DEFAULT_SETTINGS: IslandSettings = {
  opacity: 95,
  sizeScale: 1,
  marginY: 31,
  taskTextColor: DEFAULT_TASK_TEXT_COLOR,
  pulseColor: "#ff8f70",
  pulseBrightness: 100,
  islandBackgroundColor: "#101013",
  todoBackgroundColor: "#ffffff",
  showTitle: true,
};
const LEGACY_DEFAULT_PRESET_IDS = new Set(["default-white", "default-khaki"]);
const LEGACY_DEFAULT_PRESET_NAMES = new Set(["白色", "卡其"]);

type LegacyIslandSettings = Partial<IslandSettings> & {
  margin?: number;
  taskTitleColor?: string;
  pendingTodoColor?: string;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function getColorSetting(value: unknown, fallback: string) {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value)
    ? value
    : fallback;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = HEX_COLOR_PATTERN.test(hex)
    ? hex.slice(1)
    : DEFAULT_SETTINGS.pulseColor.slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function normalizeSettings(
  settings: LegacyIslandSettings | null | undefined,
): IslandSettings {
  const taskTextColor = getColorSetting(
    settings?.taskTextColor ?? settings?.pendingTodoColor,
    getColorSetting(settings?.taskTitleColor, DEFAULT_SETTINGS.taskTextColor),
  );

  return {
    opacity: clamp(Number(settings?.opacity ?? DEFAULT_SETTINGS.opacity), 50, 100),
    sizeScale: clamp(
      Number(settings?.sizeScale ?? DEFAULT_SETTINGS.sizeScale),
      0.75,
      1.4,
    ),
    marginY: clamp(
      Number(settings?.marginY ?? settings?.margin ?? DEFAULT_SETTINGS.marginY),
      0,
      160,
    ),
    taskTextColor,
    pulseColor: getColorSetting(
      settings?.pulseColor,
      DEFAULT_SETTINGS.pulseColor,
    ),
    pulseBrightness: clamp(
      Number(settings?.pulseBrightness ?? DEFAULT_SETTINGS.pulseBrightness),
      50,
      160,
    ),
    islandBackgroundColor: getColorSetting(
      settings?.islandBackgroundColor,
      DEFAULT_SETTINGS.islandBackgroundColor,
    ),
    todoBackgroundColor: getColorSetting(
      settings?.todoBackgroundColor,
      DEFAULT_SETTINGS.todoBackgroundColor,
    ),
    showTitle:
      typeof settings?.showTitle === "boolean"
        ? settings.showTitle
        : DEFAULT_SETTINGS.showTitle,
  };
}

function getDefaultSettingPresets(): IslandPreset[] {
  return [];
}

function mergeWithDefaultSettingPresets(presets: IslandPreset[]) {
  const defaultPresets = getDefaultSettingPresets();
  const customPresets = presets
    .filter(
      (preset) =>
        !preset.isDefault &&
        !LEGACY_DEFAULT_PRESET_IDS.has(preset.id) &&
        !LEGACY_DEFAULT_PRESET_NAMES.has(preset.name.trim()),
    )
    .map((preset) => ({ ...preset, isDefault: false }))
    .slice(0, MAX_CUSTOM_SETTING_PRESETS);

  return [...defaultPresets, ...customPresets];
}

function isDefaultSettingPreset(presetId: string) {
  return LEGACY_DEFAULT_PRESET_IDS.has(presetId);
}

function getTodoTitleLineCount(title: string) {
  const visualLength = Array.from(title).reduce(
    (total, character) => total + (character.charCodeAt(0) > 255 ? 1.6 : 1),
    0,
  );

  return clamp(
    Math.ceil(visualLength / TODO_TITLE_CHARACTERS_PER_LINE),
    1,
    TODO_MAX_ESTIMATED_TITLE_LINES,
  );
}

function getTodoVisualRows(todoList: TodoItem[]) {
  return todoList.reduce(
    (total, todo) => total + getTodoTitleLineCount(todo.title),
    0,
  );
}

function loadSettings(): IslandSettings {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<IslandSettings> & {
      margin?: number;
    };

    return normalizeSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadSettingPresets(): IslandPreset[] {
  const stored = window.localStorage.getItem(SETTINGS_PRESETS_STORAGE_KEY);

  if (!stored) {
    return getDefaultSettingPresets();
  }

  try {
    const parsed = JSON.parse(stored) as Partial<IslandPreset>[];

    if (!Array.isArray(parsed)) {
      return getDefaultSettingPresets();
    }

    const presets = parsed
      .map((preset, index) => ({
        id:
          typeof preset.id === "string" && preset.id
            ? preset.id
            : createTodoId(),
        name:
          typeof preset.name === "string" && preset.name.trim()
            ? preset.name.trim()
            : `预设 ${index + 1}`,
        settings: normalizeSettings(preset.settings),
        createdAt:
          typeof preset.createdAt === "number" ? preset.createdAt : Date.now(),
        isDefault: false,
      }));

    return mergeWithDefaultSettingPresets(presets);
  } catch {
    return getDefaultSettingPresets();
  }
}

function normalizeTodo(todo: Partial<TodoItem>): TodoItem {
  return {
    id: typeof todo.id === "string" && todo.id ? todo.id : createTodoId(),
    title: todo.title?.trim() ?? "",
    completed: Boolean(todo.completed),
    createdAt: typeof todo.createdAt === "number" ? todo.createdAt : Date.now(),
  };
}

function loadTodos(): TodoItem[] {
  const stored = window.localStorage.getItem(TODOS_STORAGE_KEY);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as Partial<TodoItem>[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((todo) => typeof todo.title === "string" && todo.title.trim())
      .map(normalizeTodo);
  } catch {
    return [];
  }
}

function loadActiveTodoId() {
  return window.localStorage.getItem(ACTIVE_TODO_STORAGE_KEY);
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDisplayDateParts(date: string) {
  const [fallbackYear = date, fallbackMonth = "", fallbackDay = ""] =
    date.split("-");
  const parsedDate = new Date(`${date}T00:00:00`);
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const hasValidDate = !Number.isNaN(parsedDate.getTime());

  return {
    year: hasValidDate ? String(parsedDate.getFullYear()) : fallbackYear,
    month: hasValidDate
      ? String(parsedDate.getMonth() + 1).padStart(2, "0")
      : fallbackMonth,
    day: hasValidDate
      ? String(parsedDate.getDate()).padStart(2, "0")
      : fallbackDay,
    weekday: hasValidDate ? weekdays[parsedDate.getDay()] : "",
  };
}

function loadCurrentTodoDate() {
  return window.localStorage.getItem(TODO_DATE_STORAGE_KEY) ?? getLocalDateString();
}

function loadTodoArchives(): TodoArchive[] {
  const stored = window.localStorage.getItem(TODO_ARCHIVE_STORAGE_KEY);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as Partial<TodoArchive>[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((archive) => typeof archive.date === "string" && archive.date)
      .map((archive) => ({
        date: archive.date ?? getLocalDateString(),
        todos: Array.isArray(archive.todos)
          ? archive.todos
              .filter(
                (todo) => typeof todo.title === "string" && todo.title.trim(),
              )
              .map(normalizeTodo)
          : [],
        dailyNote:
          typeof archive.dailyNote === "string" ? archive.dailyNote : "",
        savedAt: typeof archive.savedAt === "number" ? archive.savedAt : 0,
        savedToDisk: Boolean(archive.savedToDisk),
        filePath:
          typeof archive.filePath === "string" ? archive.filePath : undefined,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

function loadSaveDirectory() {
  return window.localStorage.getItem(TODO_SAVE_DIRECTORY_STORAGE_KEY) ?? "";
}

function loadDailyNote() {
  return window.localStorage.getItem(DAILY_NOTE_STORAGE_KEY) ?? "";
}

function getTodoSignature(date: string, todos: TodoItem[], dailyNote: string) {
  return JSON.stringify({
    date,
    todos: todos.map((todo) => ({
      title: todo.title,
      completed: todo.completed,
    })),
    dailyNote,
  });
}

function formatTodosAsMarkdown(todos: TodoItem[]) {
  return todos
    .map((todo) => `- [${todo.completed ? "x" : " "}] ${todo.title}`)
    .join("\n");
}

function formatTodoDocumentAsMarkdown(todos: TodoItem[], dailyNote: string) {
  const todoMarkdown = formatTodosAsMarkdown(todos);
  const dailyMarkdown = dailyNote.trimEnd();

  if (todoMarkdown && dailyMarkdown) {
    return `${todoMarkdown}\n\n${dailyMarkdown}`;
  }

  return todoMarkdown || dailyMarkdown;
}

function createTodoId() {
  if ("crypto" in window && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function IslandShell({
  mode,
  page,
  isTucked,
  showTitle,
  activeTaskTitle,
  pendingTodoCount,
  mediaState,
  onOpenPage,
  onCollapse,
  onMinimize,
  onTuck,
  onReveal,
  onPageChange,
  children,
}: IslandShellProps) {
  const isExpanded = mode === "expanded";
  const isMusicPlaying =
    mediaState.playbackStatus === "playing" ||
    (mediaState.playbackStatus !== "paused" && mediaState.audioActive);
  const className = [
    "island",
    `island--${mode}`,
    `island--${page}`,
    showTitle ? "" : "island--title-hidden",
  ]
    .filter(Boolean)
    .join(" ");
  const collapsedLabel = activeTaskTitle
    ? `正在专注：${activeTaskTitle}`
    : "FocuSD Island";

  return (
    <section
      className={className}
      aria-label={collapsedLabel}
      onClick={() => {
        if (!isExpanded) {
          onOpenPage("todo");
        }
      }}
      onMouseEnter={() => {
        if (isTucked) {
          onReveal();
        }
      }}
    >
      <div className="island__collapsed" aria-hidden={isExpanded}>
        <span className="island__pulse" />
        {showTitle && <span className="island__brand">FocuSD</span>}
        {activeTaskTitle ? (
          <span className="island__active-task">
            {showTitle ? "· " : ""}
            {activeTaskTitle}
          </span>
        ) : (
          <span className="island__todo-count">
            {showTitle ? "· " : ""}
            剩余{pendingTodoCount}个待办
          </span>
        )}
        <MusicWaveButton
          isAvailable={mediaState.available || mediaState.audioActive}
          isPlaying={isMusicPlaying}
          audioPeak={mediaState.audioPeak}
          label="打开音乐控制"
          onClick={() => onOpenPage("music")}
        />
        <button
          className="island__quiet-button"
          type="button"
          title="收起"
          aria-label="收起岛屿"
          onClick={(event) => {
            event.stopPropagation();
            onTuck();
          }}
        />
      </div>

      <div className="island__expanded" aria-hidden={!isExpanded}>
        <header className="island__header">
          <div className="island__title">
            <CircleDot size={16} strokeWidth={2.2} />
            <span>FocuSD</span>
          </div>

          <div
            className="editor-dots"
            aria-label="岛屿编辑"
          >
            <button
              className={`dot-button dot-button--todo ${
                page === "todo" ? "dot-button--active" : ""
              }`}
              type="button"
              title="任务清单"
              aria-label="任务清单"
              onClick={(event) => {
                event.stopPropagation();
                onPageChange("todo");
              }}
            />
            <button
              className={`dot-button dot-button--music ${
                page === "music" ? "dot-button--active" : ""
              }`}
              type="button"
              title="Music"
              aria-label="Music"
              onClick={(event) => {
                event.stopPropagation();
                onPageChange("music");
              }}
            />
            <button
              className={`dot-button dot-button--clipboard ${
                page === "clipboard" ? "dot-button--active" : ""
              }`}
              type="button"
              title="剪贴板历史"
              aria-label="剪贴板历史"
              onClick={(event) => {
                event.stopPropagation();
                onPageChange("clipboard");
              }}
            />
            <button
              className={`dot-button dot-button--layout ${
                page === "layout" ? "dot-button--active" : ""
              }`}
              type="button"
              title="布局编辑"
              aria-label="布局编辑"
              onClick={(event) => {
                event.stopPropagation();
                onPageChange("layout");
              }}
            />
          </div>

          <div
            className="island__collapse-target"
            onClick={onCollapse}
          />

          <div className="window-actions">
            <button
              className="icon-button"
              type="button"
              title="收起"
              aria-label="收起岛屿"
              onClick={(event) => {
                event.stopPropagation();
                onCollapse();
              }}
            >
              <ChevronUp size={18} strokeWidth={2.2} />
            </button>
            <button
              className="icon-button"
              type="button"
              title="最小化到托盘"
              aria-label="最小化到托盘"
              onClick={(event) => {
                event.stopPropagation();
                onMinimize();
              }}
            >
              <Minus size={18} strokeWidth={2.2} />
            </button>
          </div>
        </header>
        <div className="island__content">{children}</div>
      </div>
    </section>
  );
}

function MusicWaveButton({
  isAvailable,
  isPlaying,
  audioPeak,
  label,
  onClick,
}: {
  isAvailable: boolean;
  isPlaying: boolean;
  audioPeak: number;
  label: string;
  onClick: () => void;
}) {
  const [phase, setPhase] = useState(0);
  const className = [
    "music-wave-button",
    isAvailable ? "music-wave-button--available" : "music-wave-button--idle",
    isPlaying ? "music-wave-button--playing" : "music-wave-button--paused",
  ]
    .filter(Boolean)
    .join(" ");
  const shouldAnimate = isAvailable || isPlaying;
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!shouldAnimate) {
      setPhase(0);
      return;
    }

    const interval = window.setInterval(
      () => {
        setPhase(performance.now() / (isPlaying ? 260 : 900));
      },
      prefersReducedMotion ? 420 : isPlaying ? 72 : 180,
    );

    return () => window.clearInterval(interval);
  }, [isPlaying, prefersReducedMotion, shouldAnimate]);

  const liftedPeak = isPlaying
    ? clamp(Math.log1p(clamp(audioPeak, 0, 1) * 150) / Math.log1p(150), 0, 1)
    : 0;
  const barScales = [0.34, 0.72, 0.48, 0.86, 0.42].map((bar, index) => {
    const floor = isAvailable ? 0.22 : 0.12;
    const breath =
      shouldAnimate && !prefersReducedMotion
        ? 0.07 + Math.sin(phase + index * 0.82) * 0.045
        : 0;
    const movement =
      liftedPeak *
      (0.26 + bar * 1.02) *
      (0.82 + Math.sin(phase * (1.15 + index * 0.08) + index * 1.7) * 0.24);

    return clamp(floor + breath + movement, 0.12, 1.22);
  });

  return (
    <button
      className={className}
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {barScales.map((scale, index) => (
        <span
          key={index}
          style={
            {
              "--wave-scale": scale.toFixed(3),
              "--wave-opacity": (0.42 + scale * 0.52).toFixed(3),
            } as CSSProperties
          }
        />
      ))}
    </button>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider-control">
      <span className="slider-control__meta">
        <span>{label}</span>
        <strong>
          {step < 1 ? value.toFixed(2) : Math.round(value)}
          {suffix}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="color-control">
      <span className="color-control__meta">
        <span>{label}</span>
        <strong>{value.toUpperCase()}</strong>
      </span>
      <input
        type="color"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function ToggleControl({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-control">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className="toggle-control__switch" aria-hidden="true" />
    </label>
  );
}

function NumberControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="number-control">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const nextValue = Number(event.currentTarget.value);

          if (Number.isFinite(nextValue)) {
            onChange(clamp(Math.round(nextValue), min, max));
          }
        }}
      />
    </label>
  );
}

function LayoutEditor({
  settings,
  clipboardSettings,
  saveDirectoryDraft,
  savePathState,
  highlightSavePath,
  presets,
  launchAtStartup,
  onSettingsChange,
  onClipboardSettingsChange,
  onReset,
  onSaveDirectoryDraftChange,
  onSaveDirectory,
  onSavePreset,
  onApplyPreset,
  onRenamePreset,
  onDeletePreset,
  onLaunchAtStartupChange,
}: {
  settings: IslandSettings;
  clipboardSettings: ClipboardHistorySettings;
  saveDirectoryDraft: string;
  savePathState: SavePathState;
  highlightSavePath: boolean;
  presets: IslandPreset[];
  launchAtStartup: boolean;
  onSettingsChange: (settings: IslandSettings) => void;
  onClipboardSettingsChange: (settings: ClipboardHistorySettings) => void;
  onReset: () => void;
  onSaveDirectoryDraftChange: (value: string) => void;
  onSaveDirectory: () => void;
  onSavePreset: () => void;
  onApplyPreset: (presetId: string) => void;
  onRenamePreset: (presetId: string, name: string) => void;
  onDeletePreset: (presetId: string) => void;
  onLaunchAtStartupChange: (enabled: boolean) => void;
}) {
  const savePathPanelRef = useRef<HTMLDivElement | null>(null);
  const savePathInputRef = useRef<HTMLInputElement | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetNameDraft, setPresetNameDraft] = useState("");

  const startPresetRename = useCallback((preset: IslandPreset) => {
    setEditingPresetId(preset.id);
    setPresetNameDraft(preset.name);
  }, []);

  const commitPresetRename = useCallback(() => {
    if (!editingPresetId) {
      return;
    }

    onRenamePreset(editingPresetId, presetNameDraft);
    setEditingPresetId(null);
    setPresetNameDraft("");
  }, [editingPresetId, onRenamePreset, presetNameDraft]);

  useEffect(() => {
    if (!highlightSavePath) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const editorPanel = savePathPanelRef.current?.closest(".editor-panel");

      if (editorPanel instanceof HTMLElement) {
        editorPanel.scrollTo({
          top: editorPanel.scrollHeight,
          behavior: "smooth",
        });
      }

      savePathInputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [highlightSavePath]);

  return (
    <div className="editor-panel">
      <div className="editor-panel__header">
        <span>布局设置</span>
        <button
          className="reset-button"
          type="button"
          title="恢复默认"
          aria-label="恢复默认"
          onClick={onReset}
        >
          <RefreshCcw size={15} strokeWidth={2.2} />
        </button>
      </div>
      <SliderControl
        label="不透明度"
        value={settings.opacity}
        min={50}
        max={100}
        step={1}
        suffix="%"
        onChange={(opacity) => onSettingsChange({ ...settings, opacity })}
      />
      <SliderControl
        label="整体大小"
        value={settings.sizeScale}
        min={0.75}
        max={1.4}
        step={0.01}
        suffix="x"
        onChange={(sizeScale) => onSettingsChange({ ...settings, sizeScale })}
      />
      <SliderControl
        label="上下边距"
        value={settings.marginY}
        min={0}
        max={160}
        step={1}
        suffix="px"
        onChange={(marginY) => onSettingsChange({ ...settings, marginY })}
      />
      <ToggleControl
        label="开机自启动"
        checked={launchAtStartup}
        onChange={onLaunchAtStartupChange}
      />
      <ToggleControl
        label="展示“title”"
        checked={settings.showTitle}
        onChange={(showTitle) => onSettingsChange({ ...settings, showTitle })}
      />

      <div className="clipboard-settings-panel">
        <div className="clipboard-settings-panel__header">
          <span>剪贴板历史</span>
        </div>
        <ToggleControl
          label="记录剪贴板"
          checked={clipboardSettings.enabled}
          onChange={(enabled) =>
            onClipboardSettingsChange({ ...clipboardSettings, enabled })
          }
        />
        <ToggleControl
          label="记录图片"
          checked={clipboardSettings.captureImages}
          onChange={(captureImages) =>
            onClipboardSettingsChange({ ...clipboardSettings, captureImages })
          }
        />
        <NumberControl
          label="最大历史条数"
          value={clipboardSettings.maxItems}
          min={5}
          max={200}
          onChange={(maxItems) =>
            onClipboardSettingsChange({ ...clipboardSettings, maxItems })
          }
        />
      </div>

      <div className="color-panel">
        <div className="color-panel__header">
          <span>颜色设置</span>
        </div>
        <div className="color-grid">
          <ColorControl
            label="任务/待办字样"
            value={settings.taskTextColor}
            onChange={(taskTextColor) =>
              onSettingsChange({ ...settings, taskTextColor })
            }
          />
          <ColorControl
            label="亮点颜色"
            value={settings.pulseColor}
            onChange={(pulseColor) =>
              onSettingsChange({ ...settings, pulseColor })
            }
          />
          <ColorControl
            label="岛屿背景"
            value={settings.islandBackgroundColor}
            onChange={(islandBackgroundColor) =>
              onSettingsChange({ ...settings, islandBackgroundColor })
            }
          />
          <ColorControl
            label="待办纸张"
            value={settings.todoBackgroundColor}
            onChange={(todoBackgroundColor) =>
              onSettingsChange({ ...settings, todoBackgroundColor })
            }
          />
        </div>
      </div>
      <SliderControl
        label="亮点亮度"
        value={settings.pulseBrightness}
        min={50}
        max={160}
        step={1}
        suffix="%"
        onChange={(pulseBrightness) =>
          onSettingsChange({ ...settings, pulseBrightness })
        }
      />

      <div className="preset-panel">
        <div className="preset-panel__header">
          <span>预设</span>
          <button
            className="preset-save-button"
            type="button"
            onClick={onSavePreset}
          >
            <Save size={13} strokeWidth={2.2} />
            <span>保存当前</span>
          </button>
        </div>
        {presets.length === 0 ? (
          <div className="preset-empty">还没有预设</div>
        ) : (
          <div className="preset-list" role="list">
            {presets.map((preset) => (
              <div
                className={[
                  "preset-item",
                  preset.isDefault ? "preset-item--default" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={preset.id}
                role="listitem"
              >
                {editingPresetId === preset.id ? (
                  <input
                    className="preset-name-input"
                    value={presetNameDraft}
                    aria-label="预设名称"
                    autoFocus
                    onChange={(event) =>
                      setPresetNameDraft(event.currentTarget.value)
                    }
                    onBlur={commitPresetRename}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitPresetRename();
                      }

                      if (event.key === "Escape") {
                        setEditingPresetId(null);
                        setPresetNameDraft("");
                      }
                    }}
                  />
                ) : (
                  <button
                    className="preset-name-button"
                    type="button"
                    title={preset.isDefault ? "默认预设" : "重命名预设"}
                    disabled={preset.isDefault}
                    onClick={() => {
                      if (!preset.isDefault) {
                        startPresetRename(preset);
                      }
                    }}
                  >
                    {preset.name}
                  </button>
                )}
                <button
                  className="preset-apply-button"
                  type="button"
                  onClick={() => onApplyPreset(preset.id)}
                >
                  启用
                </button>
                {preset.isDefault ? (
                  <span className="preset-delete-spacer" aria-hidden="true" />
                ) : (
                  <button
                    className="preset-delete-button"
                    type="button"
                    title="删除预设"
                    aria-label={`删除 ${preset.name}`}
                    onClick={() => onDeletePreset(preset.id)}
                  >
                    <Trash2 size={13} strokeWidth={2.2} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className={[
          "save-path-panel",
          highlightSavePath ? "save-path-panel--attention" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        ref={savePathPanelRef}
      >
        <div className="save-path-panel__header">
          <span>待办清单保存路径</span>
        </div>
        <div className="save-path-row">
          <label className="save-path-field">
            <span>文件夹</span>
            <input
              ref={savePathInputRef}
              value={saveDirectoryDraft}
              placeholder="D:/Todos"
              aria-label="待办清单 Markdown 保存文件夹"
              onChange={(event) =>
                onSaveDirectoryDraftChange(event.currentTarget.value)
              }
            />
          </label>
          <button
            className={[
              "save-path-button",
              savePathState === "saved" ? "save-path-button--saved" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            type="button"
            onClick={onSaveDirectory}
          >
            {savePathState === "saved" ? (
              <>
                <Check className="save-check-icon" size={15} strokeWidth={2.6} />
                <span>已保存</span>
              </>
            ) : (
              <>
                <Save size={14} strokeWidth={2.2} />
                <span>保存</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function TodoNotebook({
  todos,
  dailyNote,
  draft,
  activeTodoId,
  currentDate,
  pageMode,
  archives,
  archiveLayout,
  selectedArchive,
  saveState,
  onDraftChange,
  onAddTodo,
  onToggleTodo,
  onUpdateTodo,
  onStartTodo,
  onDeleteTodo,
  onSaveToday,
  onShowArchive,
  onShowDaily,
  onShowToday,
  onDailyNoteChange,
  onArchiveLayoutChange,
  onSelectArchive,
}: {
  todos: TodoItem[];
  dailyNote: string;
  draft: string;
  activeTodoId: string | null;
  currentDate: string;
  pageMode: TodoPageMode;
  archives: TodoArchive[];
  archiveLayout: ArchiveLayout;
  selectedArchive: TodoArchive | null;
  saveState: SaveState;
  onDraftChange: (value: string) => void;
  onAddTodo: () => void;
  onToggleTodo: (id: string) => void;
  onUpdateTodo: (id: string, title: string) => void;
  onStartTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onSaveToday: () => void;
  onShowArchive: () => void;
  onShowDaily: () => void;
  onShowToday: () => void;
  onDailyNoteChange: (value: string) => void;
  onArchiveLayoutChange: (layout: ArchiveLayout) => void;
  onSelectArchive: (date: string) => void;
}) {
  const displayedTodos =
    pageMode === "review" ? selectedArchive?.todos ?? [] : todos;
  const isTodayMode = pageMode === "today";
  const isDailyMode = pageMode === "daily";
  const isArchiveMode = pageMode === "archive";
  const isReviewMode = pageMode === "review";
  const openCount = displayedTodos.filter((todo) => !todo.completed).length;
  const listClassName = [
    "todo-list",
    displayedTodos.length > TODO_SCROLL_START_ROWS ? "todo-list--scroll" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const inputPlaceholder =
    pageMode === "today"
      ? `Add a task for ${currentDate}`
      : "Review your todos";
  const archiveTitle =
    archiveLayout === "cards" ? "Notebook cards" : "Two-column timeline";
  const notebookClassName = [
    "todo-notebook",
    isDailyMode ? "todo-notebook--daily" : "",
    isArchiveMode ? "todo-notebook--archive" : "",
    isArchiveMode ? `todo-notebook--archive-${archiveLayout}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [todoTitleDraft, setTodoTitleDraft] = useState("");

  const startTodoTitleEdit = useCallback((todo: TodoItem) => {
    if (!isTodayMode) {
      return;
    }

    setEditingTodoId(todo.id);
    setTodoTitleDraft(todo.title);
  }, [isTodayMode]);

  const commitTodoTitleEdit = useCallback(() => {
    if (!editingTodoId) {
      return;
    }

    const nextTitle = todoTitleDraft.trim();

    if (nextTitle) {
      onUpdateTodo(editingTodoId, nextTitle);
    }

    setEditingTodoId(null);
    setTodoTitleDraft("");
  }, [editingTodoId, onUpdateTodo, todoTitleDraft]);

  return (
    <section className={notebookClassName} aria-label="任务清单">
      <div className="todo-notebook__spine">
        <button
          className={[
            "todo-spine-button",
            "todo-spine-button--today",
            isTodayMode || isDailyMode ? "todo-spine-button--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          type="button"
          title="Back to today's todo list"
          aria-label="Back to today's todo list"
          onClick={onShowToday}
        />
        <button
          className={[
            "todo-spine-button",
            "todo-spine-button--save",
            saveState === "saved" ? "todo-spine-button--saved" : "",
            saveState === "saving" ? "todo-spine-button--saving" : "",
            saveState === "needs-path" || saveState === "error"
              ? "todo-spine-button--attention"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          type="button"
          title="Save today's todo list"
          aria-label="Save today's todo list as markdown"
          onClick={onSaveToday}
        >
          {saveState === "saved" && (
            <Check className="save-check-icon" size={12} strokeWidth={3} />
          )}
        </button>
        <button
          className={[
            "todo-spine-button",
            "todo-spine-button--archive",
            pageMode === "archive" || pageMode === "review"
              ? "todo-spine-button--active"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          type="button"
          title="Review saved todo lists"
          aria-label="Review saved todo lists"
          onClick={onShowArchive}
        />
      </div>

      <div className="todo-notebook__topline">
        <div className="todo-notebook__title-group">
          <span className="todo-notebook__tab">
            {isDailyMode ? (
              <NotebookPen size={15} strokeWidth={2.1} />
            ) : (
              <ClipboardList size={15} strokeWidth={2.1} />
            )}
            {isReviewMode
              ? selectedArchive?.date ?? "Review"
              : isDailyMode
                ? "DAILY"
                : "Tasks"}
          </span>
          {!isArchiveMode && !isReviewMode && (
            <button
              className={[
                "todo-page-toggle",
                isDailyMode ? "todo-page-toggle--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              title={isDailyMode ? "Back to tasks" : "Open daily note"}
              aria-label={isDailyMode ? "Back to tasks" : "Open daily note"}
              onClick={isDailyMode ? onShowToday : onShowDaily}
            >
              {isDailyMode ? (
                <ClipboardList size={14} strokeWidth={2.2} />
              ) : (
                <NotebookPen size={14} strokeWidth={2.2} />
              )}
            </button>
          )}
        </div>
        {isArchiveMode ? (
          <div className="archive-layout-toggle" aria-label={archiveTitle}>
            <button
              className={archiveLayout === "cards" ? "archive-layout-toggle--active" : ""}
              type="button"
              title="Notebook cards"
              aria-label="Notebook cards"
              onClick={() => onArchiveLayoutChange("cards")}
            >
              <ClipboardList size={14} strokeWidth={2.1} />
            </button>
            <button
              className={archiveLayout === "timeline" ? "archive-layout-toggle--active" : ""}
              type="button"
              title="Two-column timeline"
              aria-label="Two-column timeline"
              onClick={() => onArchiveLayoutChange("timeline")}
            >
              <Columns2 size={14} strokeWidth={2.1} />
            </button>
          </div>
        ) : (
          <span className="todo-notebook__open-count">{openCount} open</span>
        )}
      </div>

      {!isDailyMode && !isArchiveMode && (
        <form
          className="todo-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (isTodayMode) {
              onAddTodo();
            }
          }}
        >
          <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
          <input
            value={draft}
            disabled={!isTodayMode}
            placeholder={inputPlaceholder}
            aria-label="Add a task, press Enter to save"
            onChange={(event) => onDraftChange(event.currentTarget.value)}
          />
        </form>
      )}

      {isArchiveMode ? (
        <ArchiveBrowser
          archives={archives}
          layout={archiveLayout}
          onSelectArchive={onSelectArchive}
        />
      ) : isDailyMode ? (
        <textarea
          className="daily-note"
          value={dailyNote}
          placeholder="Write today's notes..."
          aria-label="Daily note"
          spellCheck={false}
          onChange={(event) => onDailyNoteChange(event.currentTarget.value)}
        />
      ) : (
        <div className={listClassName} role="list">
          {displayedTodos.length === 0 ? (
            <div className="todo-empty">
              {isReviewMode ? "Nothing was written here" : "今天还很轻"}
            </div>
          ) : (
            displayedTodos.map((todo) => {
              const isActive =
                isTodayMode && todo.id === activeTodoId && !todo.completed;
              const titleLineCount = getTodoTitleLineCount(todo.title);

              return (
                <div
                  className={[
                    "todo-item",
                    todo.completed ? "todo-item--done" : "",
                    isActive ? "todo-item--active" : "",
                    !isTodayMode ? "todo-item--readonly" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={todo.id}
                  role="listitem"
                  style={
                    {
                      "--todo-title-min-height": `${titleLineCount * 19}px`,
                    } as CSSProperties
                  }
                >
                  <button
                    className="todo-check"
                    type="button"
                    aria-pressed={todo.completed}
                    disabled={!isTodayMode}
                    title={todo.completed ? "标记未完成" : "完成"}
                    aria-label={`${todo.completed ? "标记未完成" : "完成"}：${
                      todo.title
                    }`}
                    onClick={() => onToggleTodo(todo.id)}
                  >
                    {todo.completed && <Check size={14} strokeWidth={2.5} />}
                  </button>
                  {isTodayMode && editingTodoId === todo.id ? (
                    <input
                      className="todo-title-input"
                      value={todoTitleDraft}
                      aria-label="编辑任务名"
                      autoFocus
                      onChange={(event) =>
                        setTodoTitleDraft(event.currentTarget.value)
                      }
                      onBlur={commitTodoTitleEdit}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          commitTodoTitleEdit();
                        }

                        if (event.key === "Escape") {
                          setEditingTodoId(null);
                          setTodoTitleDraft("");
                        }
                      }}
                    />
                  ) : isTodayMode ? (
                    <button
                      className="todo-title todo-title--editable"
                      type="button"
                      title="编辑任务名"
                      onClick={() => startTodoTitleEdit(todo)}
                    >
                      {todo.title}
                    </button>
                  ) : (
                    <span className="todo-title">{todo.title}</span>
                  )}
                  {isTodayMode && (
                    <>
                      <button
                        className={["todo-start", isActive ? "todo-start--active" : ""]
                          .filter(Boolean)
                          .join(" ")}
                        type="button"
                        title={isActive ? "结束" : "开始"}
                        aria-label={`${isActive ? "结束" : "开始"}：${todo.title}`}
                        disabled={todo.completed}
                        onClick={() => onStartTodo(todo.id)}
                      >
                        <Play size={13} strokeWidth={2.4} />
                        <span>{isActive ? "结束" : "开始"}</span>
                      </button>
                      <button
                        className="todo-delete"
                        type="button"
                        title="删除"
                        aria-label={`删除：${todo.title}`}
                        onClick={() => onDeleteTodo(todo.id)}
                      >
                        <Trash2 size={14} strokeWidth={2.2} />
                      </button>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}

function ArchiveBrowser({
  archives,
  layout,
  onSelectArchive,
}: {
  archives: TodoArchive[];
  layout: ArchiveLayout;
  onSelectArchive: (date: string) => void;
}) {
  const handleHorizontalWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (layout !== "cards") {
      return;
    }

    event.preventDefault();
    event.currentTarget.scrollLeft += event.deltaY + event.deltaX;
  };

  if (archives.length === 0) {
    return <div className="todo-empty">No saved lists yet</div>;
  }

  if (layout === "timeline") {
    return (
      <div className="archive-timeline" role="list">
        {archives.map((archive) => (
          <button
            className="archive-timeline__item"
            key={archive.date}
            type="button"
            role="listitem"
            onClick={() => onSelectArchive(archive.date)}
          >
            <span className="archive-timeline__dot" />
            <span>{archive.date}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="archive-cards" role="list" onWheel={handleHorizontalWheel}>
      {archives.map((archive) => {
        const previewTodos = archive.todos.slice(0, 3);
        const dateParts = getDisplayDateParts(archive.date);

        return (
          <button
            className="archive-card"
            key={archive.date}
            type="button"
            role="listitem"
            onClick={() => onSelectArchive(archive.date)}
          >
            <span className="archive-card__eyebrow">TODAY</span>
            <strong className="archive-card__date">
              <span>{dateParts.year}</span>
              <span>
                {dateParts.month}
                <em>/</em>
                {dateParts.day}
              </span>
            </strong>
            <span className="archive-card__preview">
              {previewTodos.length > 0 ? (
                previewTodos.map((todo) => (
                  <span className="archive-card__todo" key={todo.id}>
                    <span
                      className={[
                        "archive-card__todo-mark",
                        todo.completed ? "archive-card__todo-mark--done" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                    <span>{todo.title}</span>
                  </span>
                ))
              ) : (
                <span className="archive-card__empty">No tasks</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MusicPlayerPanel({
  mediaState,
  onPlayPause,
  onNext,
  onPrevious,
}: {
  mediaState: MediaState;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const isPlaying =
    mediaState.playbackStatus === "playing" ||
    (mediaState.playbackStatus !== "paused" && mediaState.audioActive);
  const isPaused = mediaState.playbackStatus === "paused";
  const hasAudioSignal = mediaState.available || mediaState.audioActive;
  const statusLabel = isPaused
    ? "Paused"
    : hasAudioSignal
      ? "Audio active"
      : "No signal";
  const peakPercent = Math.round(
    clamp(Math.log1p(mediaState.audioPeak * 160) / Math.log1p(160), 0, 1) *
      100,
  );

  return (
    <section
      className={[
        "music-player",
        hasAudioSignal ? "" : "music-player--empty",
        isPaused ? "music-player--paused" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Music player"
    >
      <div className="music-player__signal">
        <div className="music-player__status">
          <span>{statusLabel}</span>
          <strong>{peakPercent}%</strong>
        </div>
        <MusicLevelWave
          isAvailable={hasAudioSignal}
          isPlaying={isPlaying}
          audioPeak={mediaState.audioPeak}
        />
      </div>

      <div className="music-player__controls">
        <button
          className="music-control-button"
          type="button"
          title="Previous"
          aria-label="Previous track"
          onClick={onPrevious}
        >
          <SkipBack size={18} strokeWidth={2.4} />
        </button>
        <button
          className="music-control-button music-control-button--primary"
          type="button"
          title={isPlaying ? "Pause" : "Play"}
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={onPlayPause}
        >
          {isPlaying ? (
            <Pause size={20} strokeWidth={2.5} />
          ) : (
            <Play size={20} strokeWidth={2.5} />
          )}
        </button>
        <button
          className="music-control-button"
          type="button"
          title="Next"
          aria-label="Next track"
          onClick={onNext}
        >
          <SkipForward size={18} strokeWidth={2.4} />
        </button>
      </div>
    </section>
  );
}

function MusicLevelWave({
  isAvailable,
  isPlaying,
  audioPeak,
}: {
  isAvailable: boolean;
  isPlaying: boolean;
  audioPeak: number;
}) {
  const [phase, setPhase] = useState(0);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!isAvailable && !isPlaying) {
      setPhase(0);
      return;
    }

    const interval = window.setInterval(
      () => {
        setPhase(performance.now() / (isPlaying ? 210 : 760));
      },
      prefersReducedMotion ? 460 : isPlaying ? 58 : 150,
    );

    return () => window.clearInterval(interval);
  }, [isAvailable, isPlaying, prefersReducedMotion]);

  const liftedPeak = isPlaying
    ? clamp(Math.log1p(clamp(audioPeak, 0, 1) * 185) / Math.log1p(185), 0, 1)
    : 0;
  const bars = [0.22, 0.48, 0.78, 0.54, 0.92, 0.68, 0.4, 0.72, 0.34].map(
    (bar, index) => {
      const floor = isAvailable ? 0.2 : 0.1;
      const breath =
        isAvailable && !prefersReducedMotion
          ? 0.06 + Math.sin(phase + index * 0.72) * 0.045
          : 0;
      const movement =
        liftedPeak *
        (0.34 + bar * 1.06) *
        (0.78 + Math.sin(phase * (1.05 + index * 0.05) + index * 1.35) * 0.28);

      return clamp(floor + breath + movement, 0.1, 1.08);
    },
  );

  return (
    <div className="music-player__wave" aria-hidden="true">
      {bars.map((scale, index) => (
        <span
          key={index}
          style={
            {
              "--wave-scale": scale.toFixed(3),
              "--wave-opacity": (0.3 + scale * 0.68).toFixed(3),
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function ClipboardHistoryPanel({
  snapshot,
  onCopyItem,
  onDeleteItem,
  onClear,
}: {
  snapshot: ClipboardHistorySnapshot;
  onCopyItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) {
      return snapshot.items;
    }

    return snapshot.items.filter((item) => {
      const haystack = [
        item.kind === "image" ? "图片 image" : "文本 text",
        item.preview,
        item.text ?? "",
        formatClipboardTime(item.copiedAt),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, snapshot.items]);

  return (
    <section className="clipboard-panel" aria-label="剪贴板历史">
      <header className="clipboard-panel__header">
        <div className="clipboard-panel__title">
          <ClipboardList size={16} strokeWidth={2.2} />
          <span>剪贴板历史</span>
          <strong>{snapshot.items.length}</strong>
        </div>
        <button
          className="clipboard-clear-button"
          type="button"
          disabled={snapshot.items.length === 0}
          onClick={onClear}
        >
          清空
        </button>
      </header>

      <label className="clipboard-search">
        <Search size={15} strokeWidth={2.2} />
        <input
          value={query}
          placeholder="搜索文本、时间或图片"
          aria-label="搜索剪贴板历史"
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        {query && (
          <button
            type="button"
            title="清除搜索"
            aria-label="清除搜索"
            onClick={() => setQuery("")}
          >
            <X size={14} strokeWidth={2.4} />
          </button>
        )}
      </label>

      <div className="clipboard-list" role="list">
        {filteredItems.length === 0 ? (
          <div className="clipboard-empty">
            {snapshot.items.length === 0 ? "复制文本或图片后会出现在这里" : "没有匹配的剪贴记录"}
          </div>
        ) : (
          filteredItems.map((item) => (
            <article className="clipboard-item" key={item.id} role="listitem">
              <button
                className="clipboard-item__main"
                type="button"
                title="复制回剪贴板"
                onClick={() => onCopyItem(item.id)}
              >
                {item.kind === "image" ? (
                  <span className="clipboard-item__thumb">
                    {item.image?.thumbnailDataUrl ? (
                      <img src={item.image.thumbnailDataUrl} alt="" />
                    ) : (
                      <ImageIcon size={20} strokeWidth={2.1} />
                    )}
                  </span>
                ) : (
                  <span className="clipboard-item__text-icon">
                    <ClipboardList size={17} strokeWidth={2.1} />
                  </span>
                )}
                <span className="clipboard-item__body">
                  <span className="clipboard-item__meta">
                    <span>{item.kind === "image" ? "图片" : "文本"}</span>
                    <time>{formatClipboardTime(item.copiedAt)}</time>
                    {item.image && (
                      <span>
                        {item.image.width} x {item.image.height}
                      </span>
                    )}
                    {item.image && <span>{formatBytes(item.image.byteSize)}</span>}
                  </span>
                  <span className="clipboard-item__preview">{item.preview}</span>
                </span>
              </button>
              <div className="clipboard-item__actions">
                <button
                  type="button"
                  title="复制"
                  aria-label="复制回剪贴板"
                  onClick={() => onCopyItem(item.id)}
                >
                  <Copy size={14} strokeWidth={2.3} />
                </button>
                <button
                  type="button"
                  title="删除"
                  aria-label="删除剪贴记录"
                  onClick={() => onDeleteItem(item.id)}
                >
                  <Trash2 size={14} strokeWidth={2.3} />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function formatClipboardTime(timestamp: number) {
  if (!timestamp) {
    return "--:--";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  const today = getLocalDateString();
  const itemDate = getLocalDateString(date);
  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return itemDate === today ? time : `${itemDate} ${time}`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function App() {
  const [mode, setMode] = useState<IslandMode>("collapsed");
  const [isTucked, setIsTucked] = useState(false);
  const [page, setPage] = useState<IslandPage>("todo");
  const [mediaState, setMediaState] =
    useState<MediaState>(DEFAULT_MEDIA_STATE);
  const mediaStatusLockUntil = useRef(0);
  const [settings, setSettings] = useState<IslandSettings>(loadSettings);
  const [launchAtStartup, setLaunchAtStartup] = useState(false);
  const [settingPresets, setSettingPresets] =
    useState<IslandPreset[]>(loadSettingPresets);
  const [todos, setTodos] = useState<TodoItem[]>(loadTodos);
  const [dailyNote, setDailyNote] = useState(loadDailyNote);
  const [draftTodo, setDraftTodo] = useState("");
  const [activeTodoId, setActiveTodoId] = useState<string | null>(
    loadActiveTodoId,
  );
  const [currentTodoDate, setCurrentTodoDate] =
    useState<string>(loadCurrentTodoDate);
  const [archives, setArchives] = useState<TodoArchive[]>(loadTodoArchives);
  const [todoPageMode, setTodoPageMode] = useState<TodoPageMode>("today");
  const [archiveLayout, setArchiveLayout] = useState<ArchiveLayout>("cards");
  const [selectedArchiveDate, setSelectedArchiveDate] = useState<string | null>(
    null,
  );
  const [saveDirectory, setSaveDirectory] = useState(loadSaveDirectory);
  const [saveDirectoryDraft, setSaveDirectoryDraft] =
    useState(loadSaveDirectory);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savePathState, setSavePathState] = useState<SavePathState>("idle");
  const [clipboardHistory, setClipboardHistory] =
    useState<ClipboardHistorySnapshot>(DEFAULT_CLIPBOARD_HISTORY);
  const didCheckDate = useRef(false);
  const selectedArchive =
    archives.find((archive) => archive.date === selectedArchiveDate) ?? null;
  const visibleTodoRows = Math.min(
    Math.max(
      todoPageMode === "archive"
        ? archives.length
        : todoPageMode === "review"
          ? getTodoVisualRows(selectedArchive?.todos ?? [])
          : todoPageMode === "daily"
            ? TODO_GROW_START_ROWS
          : getTodoVisualRows(todos),
      1,
    ),
    TODO_SCROLL_START_ROWS,
  );
  const expandedIslandHeight =
    page === "todo"
      ? BASE_EXPANDED_ISLAND_HEIGHT +
        Math.max(0, visibleTodoRows - TODO_GROW_START_ROWS) * TODO_ROW_HEIGHT
      : page === "music"
        ? MUSIC_EXPANDED_ISLAND_HEIGHT
        : page === "clipboard"
          ? CLIPBOARD_EXPANDED_ISLAND_HEIGHT
          : EDITOR_EXPANDED_ISLAND_HEIGHT;
  const layoutSync = useRef<{
    frame: number | null;
    inFlight: boolean;
    pending: IslandSettings;
    active: IslandSettings;
  }>({
    frame: null,
    inFlight: false,
    pending: settings,
    active: settings,
  });

  const stageStyle = useMemo(
    () =>
      ({
        "--island-opacity": settings.opacity / 100,
        "--island-scale": settings.sizeScale,
        "--expanded-island-height": `${expandedIslandHeight}px`,
        "--task-text-color": settings.taskTextColor,
        "--island-pulse-color": settings.pulseColor,
        "--island-pulse-glow-color": hexToRgba(settings.pulseColor, 0.72),
        "--island-pulse-brightness": `${settings.pulseBrightness}%`,
        "--island-background-color": settings.islandBackgroundColor,
        "--todo-background-color": settings.todoBackgroundColor,
      }) as CSSProperties,
    [
      expandedIslandHeight,
      settings.islandBackgroundColor,
      settings.opacity,
      settings.pulseBrightness,
      settings.pulseColor,
      settings.sizeScale,
      settings.taskTextColor,
      settings.todoBackgroundColor,
    ],
  );

  const syncNativeLayout = useCallback(async (nextSettings: IslandSettings) => {
    try {
      await invoke("set_island_layout", {
        layout: {
          sizeScale: nextSettings.sizeScale,
          marginY: nextSettings.marginY,
        },
      });
    } catch (error) {
      console.error("Failed to sync island layout", error);
    }
  }, []);

  const flushNativeLayout = useCallback(() => {
    const syncState = layoutSync.current;

    if (syncState.inFlight) {
      return;
    }

    const nextSettings = syncState.pending;
    syncState.active = nextSettings;
    syncState.inFlight = true;

    void syncNativeLayout(nextSettings).finally(() => {
      const latestState = layoutSync.current;
      latestState.inFlight = false;

      if (latestState.pending !== latestState.active) {
        latestState.frame = window.requestAnimationFrame(() => {
          latestState.frame = null;
          flushNativeLayout();
        });
      }
    });
  }, [syncNativeLayout]);

  const scheduleNativeLayout = useCallback(
    (nextSettings: IslandSettings) => {
      const syncState = layoutSync.current;
      syncState.pending = nextSettings;

      if (syncState.frame !== null || syncState.inFlight) {
        return;
      }

      syncState.frame = window.requestAnimationFrame(() => {
        syncState.frame = null;
        flushNativeLayout();
      });
    },
    [flushNativeLayout],
  );

  const syncNativeInteraction = useCallback(
    async (
      nextMode: IslandMode,
      nextSettings: IslandSettings,
      nextExpandedHeight: number,
      nextIsTucked: boolean,
    ) => {
      try {
        await invoke("set_island_interaction", {
          mode: nextMode,
          sizeScale: nextSettings.sizeScale,
          expandedHeight: nextExpandedHeight,
          isTucked: nextIsTucked,
        });
      } catch (error) {
        console.error("Failed to sync island interaction", error);
      }
    },
    [],
  );

  const refreshClipboardHistory = useCallback(async () => {
    try {
      const snapshot = await invoke<ClipboardHistorySnapshot>(
        "get_clipboard_history",
      );
      setClipboardHistory(snapshot);
    } catch (error) {
      console.error("Failed to read clipboard history", error);
    }
  }, []);

  const updateClipboardSettings = useCallback(
    async (nextSettings: ClipboardHistorySettings) => {
      const normalizedSettings = {
        ...nextSettings,
        maxItems: clamp(Math.round(nextSettings.maxItems), 5, 200),
      };

      setClipboardHistory((currentHistory) => ({
        ...currentHistory,
        settings: normalizedSettings,
      }));

      try {
        const snapshot = await invoke<ClipboardHistorySnapshot>(
          "set_clipboard_history_settings",
          { settings: normalizedSettings },
        );
        setClipboardHistory(snapshot);
      } catch (error) {
        console.error("Failed to update clipboard history settings", error);
        void refreshClipboardHistory();
      }
    },
    [refreshClipboardHistory],
  );

  const copyClipboardHistoryItem = useCallback(async (id: string) => {
    try {
      const snapshot = await invoke<ClipboardHistorySnapshot>(
        "copy_clipboard_history_item",
        { id },
      );
      setClipboardHistory(snapshot);
    } catch (error) {
      console.error("Failed to copy clipboard history item", error);
    }
  }, []);

  const deleteClipboardHistoryItem = useCallback(async (id: string) => {
    try {
      const snapshot = await invoke<ClipboardHistorySnapshot>(
        "delete_clipboard_history_item",
        { id },
      );
      setClipboardHistory(snapshot);
    } catch (error) {
      console.error("Failed to delete clipboard history item", error);
    }
  }, []);

  const clearClipboardHistoryItems = useCallback(async () => {
    try {
      const snapshot = await invoke<ClipboardHistorySnapshot>(
        "clear_clipboard_history",
      );
      setClipboardHistory(snapshot);
    } catch (error) {
      console.error("Failed to clear clipboard history", error);
    }
  }, []);

  const minimizeIsland = useCallback(async () => {
    try {
      await invoke("minimize_island");
    } catch (error) {
      console.error("Failed to minimize island", error);
    }
  }, []);

  const setIslandMode = useCallback((nextMode: IslandMode) => {
    setMode(nextMode);
    setIsTucked(false);

    if (nextMode === "collapsed") {
      setPage("todo");
    }
  }, []);

  const tuckIsland = useCallback(() => {
    setIslandMode("collapsed");
    setIsTucked(true);
  }, [setIslandMode]);

  const revealIsland = useCallback(() => {
    setIsTucked(false);
  }, []);

  const openIslandPage = useCallback((nextPage: IslandPage) => {
    setPage(nextPage);
    setMode("expanded");
    setIsTucked(false);
  }, []);

  const collapseIsland = useCallback(() => {
    setIslandMode("collapsed");
  }, [setIslandMode]);

  const refreshMediaState = useCallback(async () => {
    try {
      const nextMediaState = await invoke<MediaState>("get_media_state");

      setMediaState((currentState) => {
        const isStatusLocked = Date.now() < mediaStatusLockUntil.current;
        const nextPeak = Math.max(
          currentState.audioPeak * 0.82,
          nextMediaState.audioPeak,
        );
        const measuredAudioActive =
          nextMediaState.audioActive || nextPeak > AUDIO_ACTIVE_THRESHOLD;
        const audioActive =
          isStatusLocked && currentState.playbackStatus === "paused"
            ? false
            : measuredAudioActive;
        const playbackStatus = isStatusLocked
          ? currentState.playbackStatus
          : audioActive
            ? "playing"
            : "unavailable";

        return {
          ...nextMediaState,
          audioActive,
          audioPeak: audioActive ? nextPeak : 0,
          playbackStatus,
        };
      });
    } catch (error) {
      console.error("Failed to read media state", error);
      setMediaState((currentState) => ({
        ...DEFAULT_MEDIA_STATE,
        audioActive: currentState.audioActive,
        audioPeak: currentState.audioPeak * 0.72,
        playbackStatus: currentState.audioActive ? "playing" : "unavailable",
      }));
    }
  }, []);

  const runMediaCommand = useCallback(
    async (command: "media_play_pause" | "media_next" | "media_previous") => {
      if (command === "media_play_pause") {
        setMediaState((currentState) => {
          const isCurrentlyPlaying =
            currentState.playbackStatus === "playing" ||
            (currentState.playbackStatus !== "paused" &&
              currentState.audioActive);
          const nextStatus: MediaPlaybackStatus = isCurrentlyPlaying
            ? "paused"
            : "playing";
          mediaStatusLockUntil.current = Date.now() + 900;

          return {
            ...currentState,
            available: nextStatus === "playing" || currentState.available,
            audioActive: nextStatus === "playing",
            audioPeak:
              nextStatus === "playing"
                ? Math.max(currentState.audioPeak, 0.08)
                : 0,
            playbackStatus: nextStatus,
          };
        });
      }

      try {
        await invoke<void>(command);
      } catch (error) {
        console.error(`Failed to run media command: ${command}`, error);
      }
      window.setTimeout(() => void refreshMediaState(), 120);
      window.setTimeout(() => void refreshMediaState(), 980);
    },
    [refreshMediaState],
  );

  useEffect(() => {
    let didCancel = false;

    const refreshAudioLevel = async () => {
      try {
        const audioLevel = await invoke<AudioLevel>("get_audio_level");

        if (didCancel) {
          return;
        }

        setMediaState((currentState) => {
          const isStatusLocked = Date.now() < mediaStatusLockUntil.current;
          const shouldSuppressAudio =
            isStatusLocked && currentState.playbackStatus === "paused";
          const decayedPeak = currentState.audioPeak * 0.82;
          const nextPeak = audioLevel.active
            ? Math.max(decayedPeak, audioLevel.peak)
            : decayedPeak;
          const audioActive =
            !shouldSuppressAudio &&
            (audioLevel.active || nextPeak > AUDIO_ACTIVE_THRESHOLD * 1.5);

          return {
            ...currentState,
            audioActive,
            audioPeak: audioActive ? nextPeak : 0,
            playbackStatus:
              isStatusLocked
                ? currentState.playbackStatus
                : audioActive
                  ? "playing"
                  : currentState.playbackStatus === "paused"
                    ? "paused"
                  : "unavailable",
          };
        });
      } catch (error) {
        console.error("Failed to read audio level", error);
      }
    };

    void refreshAudioLevel();

    const interval = window.setInterval(() => {
      void refreshAudioLevel();
    }, 120);

    return () => {
      didCancel = true;
      window.clearInterval(interval);
    };
  }, []);

  const addTodo = useCallback(() => {
    const title = draftTodo.trim();

    if (!title) {
      return;
    }

    setTodos((currentTodos) => [
      {
        id: createTodoId(),
        title,
        completed: false,
        createdAt: Date.now(),
      },
      ...currentTodos,
    ]);
    setDraftTodo("");
  }, [draftTodo]);

  const toggleTodo = useCallback((id: string) => {
    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    );
    setActiveTodoId((currentId) => (currentId === id ? null : currentId));
  }, []);

  const updateTodoTitle = useCallback((id: string, title: string) => {
    const nextTitle = title.trim();

    if (!nextTitle) {
      return;
    }

    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === id ? { ...todo, title: nextTitle } : todo,
      ),
    );
  }, []);

  const startTodo = useCallback(
    (id: string) => {
      const todo = todos.find((item) => item.id === id);

      if (!todo || todo.completed) {
        return;
      }

      if (activeTodoId === id) {
        setActiveTodoId(null);
        return;
      }

      setActiveTodoId(id);
      setIslandMode("collapsed");
    },
    [activeTodoId, setIslandMode, todos],
  );

  const deleteTodo = useCallback((id: string) => {
    setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id));
    setActiveTodoId((currentId) => (currentId === id ? null : currentId));
  }, []);

  const upsertArchive = useCallback(
    (
      date: string,
      todoList: TodoItem[],
      nextDailyNote: string,
      savedToDisk: boolean,
      filePath?: string,
    ) => {
      const archive: TodoArchive = {
        date,
        todos: todoList,
        dailyNote: nextDailyNote,
        savedAt: Date.now(),
        savedToDisk,
        filePath,
      };

      setArchives((currentArchives) =>
        [archive, ...currentArchives.filter((item) => item.date !== date)].sort(
          (a, b) => b.date.localeCompare(a.date),
        ),
      );
    },
    [],
  );

  const saveTodosToDisk = useCallback(
    async (date: string, todoList: TodoItem[], nextDailyNote: string) => {
      const directory = saveDirectory.trim();

      if (!directory) {
        throw new Error("Missing todo save path.");
      }

      const result = await invoke<SaveTodoResult>("save_todo_markdown", {
        directory,
        date,
        content: formatTodoDocumentAsMarkdown(todoList, nextDailyNote),
      });

      upsertArchive(date, todoList, nextDailyNote, true, result.filePath);
      window.localStorage.setItem(
        TODO_LAST_SAVED_SIGNATURE_STORAGE_KEY,
        getTodoSignature(date, todoList, nextDailyNote),
      );

      return result;
    },
    [saveDirectory, upsertArchive],
  );

  const saveTodayTodos = useCallback(async () => {
    if (!saveDirectory.trim()) {
      setSaveState("needs-path");
      setPage("layout");
      setMode("expanded");
      setIsTucked(false);
      return;
    }

    setSaveState("saving");

    try {
      await saveTodosToDisk(currentTodoDate, todos, dailyNote);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1200);
    } catch (error) {
      console.error("Failed to save todo markdown", error);
      setSaveState("error");
    }
  }, [currentTodoDate, dailyNote, saveDirectory, saveTodosToDisk, todos]);

  const saveDirectoryFromEditor = useCallback(() => {
    const nextDirectory = saveDirectoryDraft.trim();

    setSaveDirectory(nextDirectory);
    setSaveDirectoryDraft(nextDirectory);
    setSaveState("idle");
    setSavePathState("saved");
    window.setTimeout(() => setSavePathState("idle"), 1200);
  }, [saveDirectoryDraft]);

  const showArchive = useCallback(() => {
    setTodoPageMode("archive");
    setSelectedArchiveDate(null);
    setDraftTodo("");
  }, []);

  const showToday = useCallback(() => {
    setTodoPageMode("today");
    setSelectedArchiveDate(null);
    setDraftTodo("");
  }, []);

  const showDaily = useCallback(() => {
    setTodoPageMode("daily");
    setSelectedArchiveDate(null);
    setDraftTodo("");
  }, []);

  const selectArchive = useCallback(
    (date: string) => {
      if (date === currentTodoDate) {
        showToday();
        return;
      }

      setSelectedArchiveDate(date);
      setTodoPageMode("review");
      setDraftTodo("");
    },
    [currentTodoDate, showToday],
  );

  const rolloverToToday = useCallback(
    async (nextDate: string) => {
      const signature = getTodoSignature(currentTodoDate, todos, dailyNote);
      const lastSavedSignature = window.localStorage.getItem(
        TODO_LAST_SAVED_SIGNATURE_STORAGE_KEY,
      );

      if (
        (todos.length > 0 || dailyNote.trim()) &&
        signature !== lastSavedSignature
      ) {
        if (saveDirectory.trim()) {
          try {
            await saveTodosToDisk(currentTodoDate, todos, dailyNote);
          } catch (error) {
            console.error("Failed to auto-save todo markdown", error);
            upsertArchive(currentTodoDate, todos, dailyNote, false);
          }
        } else {
          upsertArchive(currentTodoDate, todos, dailyNote, false);
        }
      }

      setTodos([]);
      setDailyNote("");
      setActiveTodoId(null);
      setCurrentTodoDate(nextDate);
      setTodoPageMode("today");
      setSelectedArchiveDate(null);
      window.localStorage.setItem(
        TODO_LAST_SAVED_SIGNATURE_STORAGE_KEY,
        getTodoSignature(nextDate, [], ""),
      );
    },
    [
      currentTodoDate,
      dailyNote,
      saveDirectory,
      saveTodosToDisk,
      todos,
      upsertArchive,
    ],
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    scheduleNativeLayout(DEFAULT_SETTINGS);
  }, [scheduleNativeLayout]);

  const saveSettingsPreset = useCallback(() => {
    setSettingPresets((currentPresets) => {
      const customPresetCount = currentPresets.filter(
        (preset) => !preset.isDefault && !isDefaultSettingPreset(preset.id),
      ).length;
      const preset: IslandPreset = {
        id: createTodoId(),
        name: `预设 ${customPresetCount + 1}`,
        settings,
        createdAt: Date.now(),
        isDefault: false,
      };

      return mergeWithDefaultSettingPresets([preset, ...currentPresets]);
    });
  }, [settings]);

  const applySettingsPreset = useCallback(
    (presetId: string) => {
      const preset = settingPresets.find((item) => item.id === presetId);

      if (!preset) {
        return;
      }

      const nextSettings = normalizeSettings(preset.settings);
      setSettings(nextSettings);
      scheduleNativeLayout(nextSettings);
    },
    [scheduleNativeLayout, settingPresets],
  );

  const renameSettingsPreset = useCallback((presetId: string, name: string) => {
    const nextName = name.trim();

    if (
      !nextName ||
      isDefaultSettingPreset(presetId) ||
      LEGACY_DEFAULT_PRESET_NAMES.has(nextName)
    ) {
      return;
    }

    setSettingPresets((currentPresets) =>
      currentPresets.map((preset) =>
        preset.id === presetId ? { ...preset, name: nextName } : preset,
      ),
    );
  }, []);

  const deleteSettingsPreset = useCallback((presetId: string) => {
    if (isDefaultSettingPreset(presetId)) {
      return;
    }

    setSettingPresets((currentPresets) =>
      currentPresets.filter((preset) => preset.id !== presetId),
    );
  }, []);

  const updateLaunchAtStartup = useCallback(async (enabled: boolean) => {
    setLaunchAtStartup(enabled);

    try {
      await invoke("set_launch_at_startup", { enabled });
    } catch (error) {
      console.error("Failed to update launch at startup", error);
      setLaunchAtStartup(!enabled);
    }
  }, []);

  useEffect(() => {
    void invoke<boolean>("get_launch_at_startup")
      .then(setLaunchAtStartup)
      .catch((error) => {
        console.error("Failed to read launch at startup", error);
      });
  }, []);

  useEffect(() => {
    void refreshClipboardHistory();

    let unlisten: (() => void) | null = null;

    void listen("clipboard-history-changed", () => {
      void refreshClipboardHistory();
    })
      .then((nextUnlisten) => {
        unlisten = nextUnlisten;
      })
      .catch((error) => {
        console.error("Failed to listen for clipboard history changes", error);
      });

    return () => {
      unlisten?.();
    };
  }, [refreshClipboardHistory]);

  useEffect(() => {
    void refreshMediaState();

    const interval = window.setInterval(() => {
      void refreshMediaState();
    }, 1500);

    return () => window.clearInterval(interval);
  }, [refreshMediaState]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem(
      SETTINGS_PRESETS_STORAGE_KEY,
      JSON.stringify(settingPresets),
    );
  }, [settingPresets]);

  useEffect(() => {
    window.localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    window.localStorage.setItem(DAILY_NOTE_STORAGE_KEY, dailyNote);
  }, [dailyNote]);

  useEffect(() => {
    window.localStorage.setItem(TODO_DATE_STORAGE_KEY, currentTodoDate);
  }, [currentTodoDate]);

  useEffect(() => {
    window.localStorage.setItem(TODO_ARCHIVE_STORAGE_KEY, JSON.stringify(archives));
  }, [archives]);

  useEffect(() => {
    window.localStorage.setItem(TODO_SAVE_DIRECTORY_STORAGE_KEY, saveDirectory);
  }, [saveDirectory]);

  useEffect(() => {
    if (activeTodoId) {
      window.localStorage.setItem(ACTIVE_TODO_STORAGE_KEY, activeTodoId);
      return;
    }

    window.localStorage.removeItem(ACTIVE_TODO_STORAGE_KEY);
  }, [activeTodoId]);

  useEffect(() => {
    if (
      activeTodoId &&
      !todos.some((todo) => todo.id === activeTodoId && !todo.completed)
    ) {
      setActiveTodoId(null);
    }
  }, [activeTodoId, todos]);

  useEffect(() => {
    if (didCheckDate.current) {
      return;
    }

    didCheckDate.current = true;
    const today = getLocalDateString();

    if (currentTodoDate !== today) {
      void rolloverToToday(today);
    }
  }, [currentTodoDate, rolloverToToday]);

  useEffect(() => {
    const checkForNewDay = () => {
      const today = getLocalDateString();

      if (currentTodoDate !== today) {
        void rolloverToToday(today);
      }
    };

    const interval = window.setInterval(checkForNewDay, 30_000);
    return () => window.clearInterval(interval);
  }, [currentTodoDate, rolloverToToday]);

  useEffect(() => {
    scheduleNativeLayout(settings);
  }, [settings.marginY, scheduleNativeLayout]);

  useEffect(() => {
    void syncNativeInteraction(mode, settings, expandedIslandHeight, isTucked);
  }, [
    expandedIslandHeight,
    isTucked,
    mode,
    settings.sizeScale,
    syncNativeInteraction,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        collapseIsland();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [collapseIsland]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!focused && mode === "expanded") {
          collapseIsland();
        }
      })
      .then((nextUnlisten) => {
        unlisten = nextUnlisten;
      })
      .catch((error) => {
        console.error("Failed to listen for island focus changes", error);
      });

    return () => {
      unlisten?.();
    };
  }, [collapseIsland, mode]);

  const activeTaskTitle = useMemo(() => {
    const activeTodo = todos.find(
      (todo) => todo.id === activeTodoId && !todo.completed,
    );

    return activeTodo?.title ?? null;
  }, [activeTodoId, todos]);
  const openTodoCount = useMemo(
    () => todos.filter((todo) => !todo.completed).length,
    [todos],
  );

  return (
    <main className="stage" style={stageStyle}>
      <IslandShell
        mode={mode}
        page={page}
        isTucked={isTucked}
        showTitle={settings.showTitle}
        activeTaskTitle={activeTaskTitle}
        pendingTodoCount={openTodoCount}
        mediaState={mediaState}
        onOpenPage={openIslandPage}
        onCollapse={collapseIsland}
        onMinimize={minimizeIsland}
        onTuck={tuckIsland}
        onReveal={revealIsland}
        onPageChange={setPage}
      >
        {page === "layout" && (
          <LayoutEditor
            settings={settings}
            clipboardSettings={clipboardHistory.settings}
            saveDirectoryDraft={saveDirectoryDraft}
            savePathState={savePathState}
            highlightSavePath={saveState === "needs-path"}
            presets={settingPresets}
            launchAtStartup={launchAtStartup}
            onSettingsChange={setSettings}
            onClipboardSettingsChange={updateClipboardSettings}
            onReset={resetSettings}
            onSaveDirectoryDraftChange={setSaveDirectoryDraft}
            onSaveDirectory={saveDirectoryFromEditor}
            onSavePreset={saveSettingsPreset}
            onApplyPreset={applySettingsPreset}
            onRenamePreset={renameSettingsPreset}
            onDeletePreset={deleteSettingsPreset}
            onLaunchAtStartupChange={updateLaunchAtStartup}
          />
        )}
        {page === "music" && (
          <MusicPlayerPanel
            mediaState={mediaState}
            onPlayPause={() => void runMediaCommand("media_play_pause")}
            onNext={() => void runMediaCommand("media_next")}
            onPrevious={() => void runMediaCommand("media_previous")}
          />
        )}
        {page === "clipboard" && (
          <ClipboardHistoryPanel
            snapshot={clipboardHistory}
            onCopyItem={(id) => void copyClipboardHistoryItem(id)}
            onDeleteItem={(id) => void deleteClipboardHistoryItem(id)}
            onClear={() => void clearClipboardHistoryItems()}
          />
        )}
        {page === "todo" && (
          <TodoNotebook
            todos={todos}
            dailyNote={dailyNote}
            draft={draftTodo}
            activeTodoId={activeTodoId}
            currentDate={currentTodoDate}
            pageMode={todoPageMode}
            archives={archives}
            archiveLayout={archiveLayout}
            selectedArchive={selectedArchive}
            saveState={saveState}
            onDraftChange={setDraftTodo}
            onAddTodo={addTodo}
            onToggleTodo={toggleTodo}
            onUpdateTodo={updateTodoTitle}
            onStartTodo={startTodo}
            onDeleteTodo={deleteTodo}
            onSaveToday={saveTodayTodos}
            onShowArchive={showArchive}
            onShowDaily={showDaily}
            onShowToday={showToday}
            onDailyNoteChange={setDailyNote}
            onArchiveLayoutChange={setArchiveLayout}
            onSelectArchive={selectArchive}
          />
        )}
      </IslandShell>
    </main>
  );
}

export default App;
