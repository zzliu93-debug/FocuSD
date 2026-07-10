# FocuSD Island

> 一个 Windows 优先的 Tauri + React 桌面悬浮岛，把当天最重要的任务、笔记、Codex任务状态、历史剪贴板和媒体控制放在屏幕顶部。

语言：中文 | [English](#english)

## 项目简介

FocuSD Island 是一个轻量级桌面效率工具。它以透明、无边框、始终置顶的「悬浮岛」形式停靠在主显示器顶部，默认是紧凑胶囊形态，展开后可以查看Codex状态指示灯、管理今日待办、记录每日笔记、回顾归档、查看剪贴板历史、控制媒体播放，并调整悬浮岛的外观与位置。

项目当前处于早期 MVP 阶段，优先适配 Windows 桌面环境。欢迎通过 Issue 和 PR 一起完善它。

## 核心功能

- 悬浮岛窗口：透明、无边框、始终置顶，支持折叠、展开、边缘收起和托盘隐藏。
- AI Agent 状态灯：可安装/修复 Codex，用红/绿状态提示 Agent 是否正在运行。
- 今日待办：新增、编辑、完成、删除任务，并可将某个任务设为当前专注任务。
- 每日笔记：记录当天补充信息，与待办一起形成日归档。
- 自动归档：跨日后自动归档上一天的待办和笔记。
- Markdown 保存：将当天内容保存为 `YYYY-MM-DD.md` 文件，便于接入本地笔记流。
- 历史回顾：以卡片或时间线方式查看已归档日期。
- 剪贴板历史：记录文本和图片剪贴板内容，支持快捷键呼出、复制、删除和清空。
- 媒体控制：查看系统音频活跃状态，控制播放/暂停、上一首、下一首。
- 外观设置：调整透明度、缩放、顶部间距、主题颜色，并保存自定义预设。
- 系统集成：支持系统托盘菜单、Windows 当前用户开机自启动。

## 部署方式

### 方式一：通过源码部署

适合想参与开发、自己构建可执行文件，或暂时没有可用 Release 包的用户。

#### 环境要求

- Windows 10 / Windows 11
- Node.js
- pnpm
- Rust / Cargo
- Microsoft Visual Studio Build Tools，并安装 C++ 工作负载
- Microsoft Edge WebView2 Runtime

#### 步骤

```powershell
git clone <your-repository-url>
cd FocuSD
pnpm install
pnpm tauri build
```

构建完成后，Windows 可执行文件通常位于：

```text
src-tauri/target/release/focusd-island.exe
```

如果只想生成 release 可执行文件，不生成安装包，可以运行：

```powershell
pnpm tauri build --no-bundle
```

开发时可以使用：

```powershell
pnpm tauri dev
```

如果只需要启动前端开发服务器：

```powershell
pnpm dev
```

### 方式二：通过 Release 部署

适合只想直接使用应用的用户。

1. 打开本仓库的 GitHub Releases 页面。
2. 下载最新版本的 Windows 安装包或 release 可执行文件。
3. 如果下载的是安装包，按提示完成安装；如果下载的是可执行文件，直接运行即可。
4. 首次启动后，可以在设置面板中配置 Markdown 保存目录、开机自启动、剪贴板历史和外观预设。

如果 Release 页面暂未提供安装包，请先使用「通过源码部署」方式自行构建。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm install` | 安装前端与 Tauri CLI 依赖 |
| `pnpm dev` | 启动 Vite 前端开发服务器 |
| `pnpm build` | TypeScript 检查并构建前端 |
| `pnpm preview` | 预览前端构建产物 |
| `pnpm tauri dev` | 启动 Tauri 桌面开发模式 |
| `pnpm tauri build` | 构建 Tauri 桌面应用 |
| `pnpm tauri build --no-bundle` | 仅生成 release 可执行文件 |

## 技术栈

- [Tauri 2](https://tauri.app/)：桌面应用外壳与原生能力
- [React 19](https://react.dev/)：前端界面
- [Vite 7](https://vite.dev/)：前端开发与构建
- [TypeScript](https://www.typescriptlang.org/)：类型约束
- [Rust](https://www.rust-lang.org/)：窗口定位、托盘、文件写入、媒体控制和 Windows API 集成
- [lucide-react](https://lucide.dev/)：界面图标

## 数据与存储

- 待办、每日笔记、归档、外观设置等前端状态默认保存在 `localStorage`。
- 配置保存目录后，今日内容可以写入本地 Markdown 文件，文件名为 `YYYY-MM-DD.md`。
- 剪贴板历史、AI Agent 状态等原生侧数据保存在应用数据目录中。
- AI Agent 状态灯会读取 `%APPDATA%\com.focusd.island\agent-status.json` 和同目录 marker 文件。
- 开机自启动使用 Windows 当前用户注册表路径：`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`。

## 项目结构

```text
.
├── src/                    # React 前端
│   ├── App.tsx             # 核心 UI、状态和 Tauri invoke 调用
│   ├── App.css             # 主要样式
│   └── main.tsx            # React 入口
├── src-tauri/              # Tauri / Rust 桌面端
│   ├── src/lib.rs          # 原生命令、窗口定位、托盘、媒体和文件保存
│   ├── src/clipboard_history.rs
│   ├── src/main.rs         # Tauri 应用入口
│   ├── capabilities/       # Tauri 权限能力配置
│   └── tauri.conf.json     # Tauri 配置
├── scripts/                # Agent 状态 hook 脚本
├── package.json
└── README.md
```

## 未来计划

- 开发并适配 macOS 版本。
- 完善安装包发布流程和自动更新能力。
- 增强多显示器定位策略。
- 增加更完整的快捷键与键盘工作流。
- 扩展任务分类、排序、标签和筛选能力。
- 增加数据导入、导出和同步方案。
- 优化剪贴板历史、媒体控制和 AI Agent 状态灯体验。

## 参与贡献

欢迎提交 Issue 和 Pull Request。

- 发现 Bug：请在 Issue 中说明系统版本、复现步骤、预期行为和实际行为。
- 提出新功能：请描述使用场景，以及它如何帮助保持专注或提升效率。
- 提交 PR：建议保持改动小而清晰，并在说明中写明验证过的命令。
- macOS 适配、Windows 原生能力、Tauri 权限、安全边界、UI 细节优化都非常欢迎。

当前项目仍在 MVP 阶段，很多地方可以一起打磨。

## 许可

当前仓库暂未声明开源许可证。如需公开分发或协作使用，建议补充 `LICENSE` 文件。

---

<a id="english"></a>

# FocuSD Island

> A Windows-first Tauri + React floating island for keeping today's tasks, notes, clipboard history, and media controls at the top of your screen.

Language: [中文](#focusd-island) | English

## Overview

FocuSD Island is a lightweight desktop productivity app. It runs as a transparent, borderless, always-on-top island near the top of the primary display. In its collapsed state it behaves like a compact capsule; when expanded, it lets you manage today's todos, write a daily note, review archives, inspect clipboard history, control media playback, and tune the island's appearance and placement.

The project is currently an early MVP and is mainly designed for Windows desktop usage. Issues and pull requests are welcome.

## Core Features

- Floating island window: transparent, borderless, always on top, with collapsed, expanded, edge-tucked, and tray-hidden states.
- Today's todos: add, edit, complete, delete, and mark a task as the current focus.
- AI agent status light: install or repair Codex, then show whether an agent is running.
- Daily note: capture extra context for the day and archive it with the todo list.
- Automatic archive: roll over the previous day's todos and note when a new day starts.
- Markdown saving: write today's content to a local `YYYY-MM-DD.md` file.
- Archive review: browse saved days with cards or a timeline layout.
- Clipboard history: capture text and image clipboard items, open with a shortcut, copy, delete, or clear them.
- Media control: read system audio activity and control play/pause, previous, and next.
- Appearance settings: tune opacity, scale, top margin, theme colors, and custom presets.
- System integration: tray menu and Windows current-user launch-at-startup support.

## Deployment Options

### Option 1: Deploy From Source

Use this path if you want to develop the app, build the executable yourself, or use the project before a packaged Release is available.

#### Requirements

- Windows 10 / Windows 11
- Node.js
- pnpm
- Rust / Cargo
- Microsoft Visual Studio Build Tools with the C++ workload
- Microsoft Edge WebView2 Runtime

#### Steps

```powershell
git clone <your-repository-url>
cd FocuSD
pnpm install
pnpm tauri build
```

After the build finishes, the Windows executable is usually written to:

```text
src-tauri/target/release/focusd-island.exe
```

To build only the release executable without creating installers, run:

```powershell
pnpm tauri build --no-bundle
```

For development, run:

```powershell
pnpm tauri dev
```

To start only the frontend dev server:

```powershell
pnpm dev
```

### Option 2: Deploy From Release

Use this path if you only want to install and run the app.

1. Open the GitHub Releases page for this repository.
2. Download the latest Windows installer or release executable.
3. If you downloaded an installer, follow the installer steps. If you downloaded a standalone executable, run it directly.
4. After first launch, configure the Markdown save directory, launch-at-startup option, clipboard history, and appearance presets from Settings.

If no packaged Release is available yet, use the source deployment path above.

## Common Commands

| Command | Description |
| --- | --- |
| `pnpm install` | Install frontend and Tauri CLI dependencies |
| `pnpm dev` | Start the Vite frontend dev server |
| `pnpm build` | Type-check and build the frontend |
| `pnpm preview` | Preview the frontend build output |
| `pnpm tauri dev` | Start the Tauri desktop app in development mode |
| `pnpm tauri build` | Build the Tauri desktop app |
| `pnpm tauri build --no-bundle` | Build only the release executable |

## Tech Stack

- [Tauri 2](https://tauri.app/) for the desktop shell and native capabilities
- [React 19](https://react.dev/) for the UI
- [Vite 7](https://vite.dev/) for development and frontend builds
- [TypeScript](https://www.typescriptlang.org/) for type safety
- [Rust](https://www.rust-lang.org/) for window positioning, tray integration, file writing, media control, and Windows API integration
- [lucide-react](https://lucide.dev/) for icons

## Data And Storage

- Todos, daily notes, archives, appearance settings, and other frontend state are stored in `localStorage` by default.
- After configuring a save directory, today's content can be written to a local Markdown file named `YYYY-MM-DD.md`.
- Clipboard history and AI agent state files are stored in the app data directory.
- The AI agent status light reads `%APPDATA%\com.focusd.island\agent-status.json` and marker files in the same directory.
- Launch-at-startup uses the current Windows user registry path: `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.

## Project Structure

```text
.
├── src/                    # React frontend
│   ├── App.tsx             # Core UI, state, and Tauri invoke calls
│   ├── App.css             # Main styles
│   └── main.tsx            # React entry point
├── src-tauri/              # Tauri / Rust desktop side
│   ├── src/lib.rs          # Native commands, window positioning, tray, media, file saving
│   ├── src/clipboard_history.rs
│   ├── src/main.rs         # Tauri application entry point
│   ├── capabilities/       # Tauri permission capabilities
│   └── tauri.conf.json     # Tauri configuration
├── scripts/                # Agent status hook scripts
├── package.json
└── README.md
```

## Roadmap

- Build and adapt a macOS version.
- Improve packaged releases and automatic updates.
- Strengthen multi-monitor positioning strategies.
- Add more complete keyboard shortcuts and keyboard-first workflows.
- Expand task categories, ordering, tags, and filters.
- Add data import, export, and sync options.
- Improve clipboard history, media control, and AI agent status light workflows.

## Contributing

Issues and pull requests are welcome.

- For bugs, include your OS version, reproduction steps, expected behavior, and actual behavior.
- For feature requests, describe the workflow and how it helps focus or productivity.
- For PRs, keep changes focused and list the commands you used for verification.
- macOS support, Windows native capabilities, Tauri permissions, security boundaries, and UI polish are all very welcome.

The project is still in MVP stage, so there is plenty of room to shape it together.

## License

No open-source license has been declared for this repository yet. Add a `LICENSE` file before public distribution or collaborative reuse.
