import type { Translations } from "../types";

const zhCN: Translations = {
  localeLabel: "简体中文",
  localeTag: "zh-CN",

  island: {
    focusing: (taskTitle) => `正在专注：${taskTitle}`,
    pendingTodos: (count) => `剩余${count}个待办`,
    openMusic: "打开音乐控制",
    collapse: "收起",
    collapseIsland: "收起岛屿",
    minimizeToTray: "最小化到托盘",
    resetPosition: "复位",
    resetPositionLabel: "恢复岛屿默认位置",
    editor: "岛屿编辑",
    todoList: "任务清单",
    music: "Music",
    clipboardHistory: "剪贴板历史",
    layoutEditor: "布局编辑",
  },

  agent: {
    running: (provider) => `${provider} 正在运行`,
    failed: (provider) => `${provider} 运行失败`,
    stale: (provider) => `${provider} 可能已中断`,
    idleOrDone: "AI Agent 空闲或已完成",
    phase: {
      running: "正在运行",
      completed: "已完成",
      failed: "运行失败",
      stale: "可能已中断",
      idle: "空闲",
    },
  },

  // These panels shipped in English in the original Chinese-first build.
  // zh-CN keeps that exact wording so existing users see no change; the en
  // locale is identical here. Translate later if a fully-Chinese UI is wanted.
  notebook: {
    sectionLabel: "任务清单",
    backToToday: "Back to today's todo list",
    saveToday: "Save today's todo list",
    saveTodayMarkdown: "Save today's todo list as markdown",
    reviewSaved: "Review saved todo lists",
    tasksTab: "Tasks",
    dailyTab: "DAILY",
    reviewTab: "Review",
    openDailyNote: "Open daily note",
    backToTasks: "Back to tasks",
    notebookCards: "Notebook cards",
    twoColumnTimeline: "Two-column timeline",
    openCount: (count) => `${count} open`,
    addTaskFor: (date) => `Add a task for ${date}`,
    reviewTodos: "Review your todos",
    addTaskHint: "Add a task, press Enter to save",
    dailyPlaceholder: "Write today's notes...",
    dailyNoteLabel: "Daily note",
  },

  archive: {
    noSavedLists: "No saved lists yet",
    eyebrow: "TODAY",
    noTasks: "No tasks",
  },

  music: {
    playerLabel: "Music player",
    controlFailed: "Control failed",
    paused: "Paused",
    playing: "Playing",
    noMedia: "No media",
    previous: "Previous",
    previousTrack: "Previous track",
    play: "Play",
    pause: "Pause",
    next: "Next",
    nextTrack: "Next track",
  },

  todo: {
    empty: "今天还很轻",
    emptyReview: "Nothing was written here",
    complete: "完成",
    markIncomplete: "标记未完成",
    actionOnTask: (action, taskTitle) => `${action}：${taskTitle}`,
    editTitle: "编辑任务名",
    start: "开始",
    stop: "结束",
    delete: "删除",
    deleteTask: (taskTitle) => `删除：${taskTitle}`,
    reorder: "拖动排序",
    reorderTask: (taskTitle) => `拖动排序：${taskTitle}`,
  },

  clipboard: {
    title: "剪贴板历史",
    favoriteCount: (count) => `${count} 条收藏`,
    expandShortcut: "展开快捷键",
    clear: "清空",
    confirmClear: "确认清空",
    clearHistory: "清空剪贴板历史",
    segments: "剪贴板栏目",
    all: "全部",
    favorites: "收藏",
    searchPlaceholder: "搜索内容或备注",
    searchLabel: "搜索剪贴板内容或备注",
    clearSearch: "清除搜索",
    emptyAll: "复制文本或图片后会出现在这里",
    emptyFavorites: "还没有收藏剪贴记录",
    emptySearch: "没有匹配的剪贴记录",
    copyBack: "复制回剪贴板",
    copy: "复制",
    copied: "已复制",
    favorite: "收藏",
    unfavorite: "取消收藏",
    favoriteItem: "收藏剪贴记录",
    unfavoriteItem: "取消收藏剪贴记录",
    delete: "删除",
    confirmDelete: "确认删除",
    deleteItem: "删除剪贴记录",
    notePlaceholder: "备注这是什么",
    noteInputLabel: "剪贴记录备注",
    saveNote: "保存备注",
    cancelEdit: "取消编辑",
    cancelEditNote: "取消编辑备注",
    editNote: (note) => `编辑备注：${note}`,
    editNoteLabel: "添加剪贴记录备注",
    addNote: "添加备注",
    addNoteLabel: "添加剪贴记录备注",
    noteFallback: "备注",
  },

  settings: {
    title: "设置",
    reset: "恢复默认",

    language: {
      title: "语言",
      label: "界面语言",
    },

    appearance: {
      title: "外观模式",
      classic: "经典",
      liquidGlass: "液态玻璃",
      glassStrength: "玻璃强度",
    },

    layout: {
      title: "布局设置",
      opacity: "不透明度",
      sizeScale: "整体大小",
      marginY: "上下边距",
      launchAtStartup: "开机自启动",
      showTitle: "展示“title”",
    },

    todo: {
      title: "待办设置",
      carryOverIncomplete: "自动将未完成任务写入下一天",
      enableReorder: "允许拖动调整任务顺序",
    },

    agent: {
      title: "AI Agent 状态灯",
      install: "安装/修复",
      installing: "安装中",
      installed: "已安装",
      currentStatus: "当前状态",
      clearStatusFor: (provider) => `清除 ${provider} 状态`,
      clearing: "清除中",
      clearStatus: "清除状态",
      scriptsDir: "脚本目录",
    },

    clipboard: {
      title: "剪贴板历史",
      enabled: "记录剪贴板",
      captureImages: "记录图片",
      maxItems: "最大历史条数",
      shortcut: "展开快捷键",
      pressKeys: "按下组合键",
    },

    colors: {
      title: "颜色设置",
      taskText: "任务/待办字样",
      pulse: "亮点颜色",
      islandBackground: "岛屿背景",
      todoPaper: "待办纸张",
      pulseBrightness: "亮点亮度",
    },

    presets: {
      title: "样式预设",
      saveCurrent: "保存当前",
      empty: "还没有样式预设",
      nameLabel: "样式预设名称",
      defaultName: (index) => `样式预设 ${index}`,
      rename: "重命名样式预设",
      defaultPreset: "默认样式预设",
      apply: "启用",
      delete: "删除样式预设",
      deleteNamed: (name) => `删除 ${name}`,
    },

    save: {
      title: "待办清单保存路径",
      folder: "文件夹",
      folderLabel: "待办清单 Markdown 保存文件夹",
      saved: "已保存",
      save: "保存",
    },
  },
};

export default zhCN;
