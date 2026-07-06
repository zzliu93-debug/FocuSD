# FocuSD Island

> 一个 Windows 优先的 Tauri + React 桌面悬浮岛，用来把当天最重要的任务放在屏幕顶部。

语言：中文 | [English](#english)

## 项目简介

FocuSD Island 是一个轻量的桌面效率工具。它以透明、无边框、置顶的「悬浮岛」形式停靠在主显示器顶部，默认保持紧凑胶囊形态；展开后可以管理当天待办、记录日记、保存 Markdown 归档，并调整悬浮岛的外观和位置。

这个项目当前处于早期 MVP 阶段，主要面向 Windows 桌面环境。

## 功能特性

- 透明、无边框、始终置顶的悬浮岛窗口
- 主显示器顶部居中定位，支持边缘收起和托盘隐藏
- 胶囊态与展开面板态切换
- 今日待办：新增、编辑、完成、删除任务
- 专注任务：启动某个待办后，折叠态显示当前任务
- 每日笔记：记录当天补充内容
- 自动跨日归档：新的一天会归档上一天的待办和笔记
- Markdown 保存：将当天内容保存为 `YYYY-MM-DD.md`
- 历史回顾：以卡片或时间线方式查看已归档日期
- 布局设置：透明度、缩放、顶部间距、颜色主题
- 预设管理：保存、应用、重命名和删除自定义外观预设
- 系统托盘：显示、隐藏和退出应用
- 开机自启动：通过 Windows 当前用户启动项控制

## 技术栈

- [Tauri 2](https://tauri.app/)：桌面应用外壳与原生能力
- [React 19](https://react.dev/)：前端界面
- [Vite 7](https://vite.dev/)：前端开发与构建
- [TypeScript](https://www.typescriptlang.org/)：类型约束
- [Rust](https://www.rust-lang.org/)：Tauri 后端命令、窗口定位、托盘和文件写入
- [lucide-react](https://lucide.dev/)：界面图标

## 环境要求

请先准备以下环境：

- Node.js
- pnpm
- Rust / Cargo
- Microsoft Visual Studio Build Tools，并安装 C++ 工作负载
- Microsoft Edge WebView2 Runtime

## 本地开发

安装依赖：

```powershell
pnpm install
```

启动 Tauri 开发模式：

```powershell
pnpm tauri dev
```

仅启动前端开发服务器：

```powershell
pnpm dev
```

## 构建

构建前端资源：

```powershell
pnpm build
```

构建 Tauri 应用：

```powershell
pnpm tauri build
```

如果只需要生成 release 可执行文件，不生成安装包：

```powershell
pnpm tauri build --no-bundle
```

生成的 Windows 可执行文件位于：

```text
src-tauri/target/release/focusd-island.exe
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动 Vite 前端开发服务器 |
| `pnpm build` | TypeScript 检查并构建前端 |
| `pnpm preview` | 预览前端构建产物 |
| `pnpm tauri dev` | 启动桌面应用开发模式 |
| `pnpm tauri build` | 构建桌面应用 |

## 数据与存储

- 待办、笔记、归档和外观设置默认保存在浏览器 `localStorage` 中。
- 在设置面板中填写待办保存目录后，可以将当天内容保存为 Markdown 文件。
- Markdown 文件名格式为 `YYYY-MM-DD.md`。
- 开机自启动使用 Windows 注册表当前用户启动项：`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`。

## 项目结构

```text
.
├── src/                 # React 前端代码
│   ├── App.tsx          # 悬浮岛、待办、笔记、设置等核心界面逻辑
│   ├── App.css          # 界面样式
│   └── main.tsx         # React 入口
├── src-tauri/           # Tauri / Rust 桌面端代码
│   ├── src/lib.rs       # 原生命令、窗口定位、托盘、文件保存
│   ├── src/main.rs      # Tauri 程序入口
│   └── tauri.conf.json  # Tauri 应用配置
├── package.json         # 前端依赖与脚本
├── vite.config.ts       # Vite 配置
└── README.md
```

## 开发状态

当前版本：`0.1.0`

FocuSD Island 仍在 MVP 阶段，后续可以继续扩展：

- 更完整的快捷键支持
- 更灵活的任务分类和排序
- 安装包发布与自动更新
- 多显示器位置策略
- 数据导入、导出与同步

## 许可

当前仓库暂未声明开源许可证。如需公开分发或协作使用，建议补充 `LICENSE` 文件。

---

<a id="english"></a>

# FocuSD Island

> A Windows-first Tauri + React floating island for keeping today's most important work at the top of your screen.

Language: [中文](#focusd-island) | English

## Overview

FocuSD Island is a lightweight desktop productivity app. It lives as a transparent, borderless, always-on-top island near the top of the primary display. In its collapsed state it behaves like a compact capsule; when expanded, it lets you manage today's todos, write a daily note, save Markdown archives, and tune the island's appearance and placement.

The project is currently an early MVP and is mainly designed for Windows desktop usage.

## Features

- Transparent, borderless, always-on-top floating island window
- Top-center positioning on the primary display, with edge tuck and tray hiding
- Collapsed capsule state and expanded panel state
- Today's todos: add, edit, complete, and delete tasks
- Focus task mode: start a todo and show it in the collapsed island
- Daily note for extra context
- Automatic day rollover and archive creation
- Markdown export as `YYYY-MM-DD.md`
- Archive review with notebook cards or a two-column timeline
- Layout settings for opacity, scale, top margin, and colors
- Preset management for saving, applying, renaming, and deleting custom looks
- System tray menu for showing, hiding, and quitting the app
- Launch-at-startup support through the current Windows user startup registry entry

## Tech Stack

- [Tauri 2](https://tauri.app/) for the desktop shell and native capabilities
- [React 19](https://react.dev/) for the UI
- [Vite 7](https://vite.dev/) for development and frontend builds
- [TypeScript](https://www.typescriptlang.org/) for type safety
- [Rust](https://www.rust-lang.org/) for Tauri commands, window positioning, tray integration, and file writing
- [lucide-react](https://lucide.dev/) for icons

## Prerequisites

Make sure you have:

- Node.js
- pnpm
- Rust / Cargo
- Microsoft Visual Studio Build Tools with the C++ workload
- Microsoft Edge WebView2 Runtime

## Development

Install dependencies:

```powershell
pnpm install
```

Run the Tauri app in development mode:

```powershell
pnpm tauri dev
```

Run only the frontend dev server:

```powershell
pnpm dev
```

## Build

Build the frontend assets:

```powershell
pnpm build
```

Build the Tauri app:

```powershell
pnpm tauri build
```

Build only the release executable without creating installers:

```powershell
pnpm tauri build --no-bundle
```

The Windows executable is written to:

```text
src-tauri/target/release/focusd-island.exe
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the Vite frontend dev server |
| `pnpm build` | Type-check and build the frontend |
| `pnpm preview` | Preview the frontend build output |
| `pnpm tauri dev` | Start the desktop app in development mode |
| `pnpm tauri build` | Build the desktop app |

## Data And Storage

- Todos, notes, archives, and appearance settings are stored in browser `localStorage` by default.
- After setting a todo save directory in the settings panel, today's content can be saved as a Markdown file.
- Markdown files use the `YYYY-MM-DD.md` filename format.
- Launch-at-startup uses the current Windows user registry path: `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.

## Project Structure

```text
.
├── src/                 # React frontend code
│   ├── App.tsx          # Core island, todo, note, and settings UI logic
│   ├── App.css          # UI styles
│   └── main.tsx         # React entry point
├── src-tauri/           # Tauri / Rust desktop code
│   ├── src/lib.rs       # Native commands, window positioning, tray, file saving
│   ├── src/main.rs      # Tauri application entry point
│   └── tauri.conf.json  # Tauri app configuration
├── package.json         # Frontend dependencies and scripts
├── vite.config.ts       # Vite configuration
└── README.md
```

## Status

Current version: `0.1.0`

FocuSD Island is still in MVP stage. Possible next steps include:

- More complete keyboard shortcut support
- More flexible task categorization and ordering
- Installer release and auto-update support
- Multi-monitor positioning strategies
- Data import, export, and sync

## License

No open-source license has been declared for this repository yet. Add a `LICENSE` file before public distribution or collaborative reuse.
