<div align="center">
  <img src="src-tauri/icons/128x128.png" alt="FocuSD Island Logo" width="96" height="96">

  <h1>FocuSD Island</h1>

  <p>
    一款 Windows 灵动岛效率工具，把待办、每日笔记、Codex 状态指示灯、剪切板历史和媒体控制放在屏幕顶部。
  </p>

  <p>
    <a href="https://github.com/zzliu93-debug/FocuSD/releases/latest">下载 Release</a>
    ·
    <a href="https://github.com/zzliu93-debug/FocuSD/issues">反馈 Issue</a>
    ·
    <a href="#路线图">查看路线图</a>
  </p>

  <p>
    <img alt="Version" src="https://img.shields.io/badge/version-0.1.7-blue">
    <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-0078D4">
    <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2-24C8DB">
    <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6">
  </p>
</div>

## 目录

- [关于项目](#关于项目)
- [核心功能](#核心功能)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [使用说明](#使用说明)
- [数据与存储](#数据与存储)
- [项目结构](#项目结构)
- [路线图](#路线图)
- [参与贡献](#参与贡献)
- [许可证](#许可证)
- [致谢](#致谢)

## 关于项目

FocuSD Island 是一个 Windows 优先的桌面效率工具。它以透明、无边框、始终置顶的 Tauri 悬浮岛形式运行，平时停靠在主屏幕顶部，需要时展开为一个紧凑的工作面板。

如果你正在寻找一个适合 Windows 桌面的「灵动岛」工具，FocuSD Island 的目标不是做一个装饰组件，而是把每天最常用、最容易打断注意力的入口收进一个小岛里：今日待办、每日笔记、AI 编程状态、剪切板历史、媒体控制和外观设置。它也适合正在搜索 windows灵动岛、灵动岛 或 Windows Dynamic Island 替代方案的用户。

项目当前处于早期 MVP 阶段，优先适配 Windows。欢迎通过 Issue 和 PR 一起完善它。

## 核心功能

| 功能 | 说明 |
| --- | --- |
| Windows 灵动岛 | 透明、无边框、始终置顶，支持折叠、展开、边缘收起和托盘隐藏。 |
| 今日待办 | 新增、编辑、完成、删除任务，并可设置当前专注任务。 |
| 任务延续 | 可在设置中开启“自动将未完成任务写入下一天”。 |
| 拖动排序 | 可在设置中开启任务拖动排序，通过任务右侧把手调整顺序。 |
| 每日笔记 | 记录当天补充信息，与待办一起形成每日工作记录。 |
| 自动归档 | 跨天后自动归档上一天的待办和笔记。 |
| Markdown 保存 | 将当天内容保存为 `YYYY-MM-DD.md`，方便接入本地笔记流。 |
| Codex 状态指示灯 | 通过 Codex hooks 显示 AI 编程任务正在运行、已完成或需要查看。 |
| 剪切板历史 | 记录文本和图片剪切板内容，支持备注、搜索、收藏、复制、删除和清空。 |
| 媒体控制 | 查看系统音频状态，控制播放/暂停、上一首、下一首。 |
| 外观设置 | 调整透明度、缩放、顶部间距、主题色，并保存样式预设。 |
| 系统集成 | 支持系统托盘菜单和 Windows 当前用户开机自启动。 |

## Codex 状态指示灯

FocuSD Island 内置 Codex 状态指示灯，适合把 AI 编程任务的运行状态放在桌面最显眼的位置。

你可以在设置中一键安装或修复 Codex hooks。Codex 正在处理任务时，悬浮岛会显示运行状态；任务空闲或完成后回到完成状态；如果任务失败，或者运行标记超过 10 分钟没有收到结束事件，悬浮岛会提醒你回来查看。

> [!IMPORTANT]
> **Codex 状态灯不亮时，必须在 Codex 中信任 FocuSD hook。** 新版 Codex 会跳过未经审核和信任的命令 hook；仅在 FocuSD 中点击“安装/修复”还不够。

### Codex hook 信任步骤

1. 在 FocuSD Island 中打开 **设置 → AI Agent 状态灯**，点击 **安装/修复**。
2. 重启 Codex，或新开一个 Codex 任务。
3. 在 Codex 中打开 **设置 → Hooks**；使用 CLI 时输入 `/hooks`。
4. 找到名称为 **Updating FocuSD agent status** 的两条 hook，确认脚本路径位于 `%APPDATA%\com.focusd.island\`。
5. 点击 **审核并信任 / Trust**，然后发送一条新任务测试状态灯。

如果 hook 已被信任但状态灯仍无效，请回到 FocuSD 再次点击 **安装/修复**，然后重启 Codex 后重试。

这个功能的目标很简单：不用反复切回终端或编辑器，也能知道 Codex 现在是在工作、已经完成，还是需要你接手。

## 技术栈

- [Tauri 2](https://tauri.app/)：桌面应用外壳与原生能力
- [React 19](https://react.dev/)：前端界面
- [Vite 7](https://vite.dev/)：前端开发与构建
- [TypeScript](https://www.typescriptlang.org/)：类型约束
- [Rust](https://www.rust-lang.org/)：窗口定位、托盘、文件写入、媒体控制和 Windows API 集成
- [lucide-react](https://lucide.dev/)：界面图标

## 快速开始

FocuSD Island 支持两种使用方式：直接下载 Release，或者通过源码自行构建。

### 方式一：通过 Release 安装

适合只想直接使用应用的用户。

1. 打开本仓库的 [GitHub Releases](https://github.com/zzliu93-debug/FocuSD/releases/latest) 页面。
2. 下载最新版本的 Windows 安装包。
3. 推荐优先下载 `FocuSD Island_版本号_x64-setup.exe`。
4. 双击安装包，按提示完成安装。
5. 首次启动后，可在设置中配置 Markdown 保存目录、开机自启动、Codex 状态指示灯、剪切板历史和样式预设。

如果 Release 页面暂时没有安装包，可以使用下面的源码构建方式。

### 方式二：通过源码构建

适合想参与开发、自己构建可执行文件，或暂时没有可用 Release 包的用户。

#### 环境要求

- Windows 10 / Windows 11
- Node.js
- pnpm
- Rust / Cargo
- Microsoft Visual Studio Build Tools，并安装 C++ 工作负载
- Microsoft Edge WebView2 Runtime

#### 构建步骤

```powershell
git clone https://github.com/zzliu93-debug/lsland-1.git
cd lsland-1
pnpm install
pnpm tauri build
```

构建完成后，安装包通常位于：

```text
src-tauri/target/release/bundle/nsis/FocuSD Island_0.1.7_x64-setup.exe
src-tauri/target/release/bundle/msi/FocuSD Island_0.1.7_x64_en-US.msi
```

原始可执行文件通常位于：

```text
src-tauri/target/release/focusd-island.exe
```

如果只想生成 release 可执行文件、不生成安装包，可以运行：

```powershell
pnpm tauri build --no-bundle
```

开发模式：

```powershell
pnpm tauri dev
```

只启动前端开发服务器：

```powershell
pnpm dev
```

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm install` | 安装前端和 Tauri CLI 依赖 |
| `pnpm dev` | 启动 Vite 前端开发服务器 |
| `pnpm build` | TypeScript 检查并构建前端 |
| `pnpm preview` | 预览前端构建产物 |
| `pnpm tauri dev` | 启动 Tauri 桌面开发模式 |
| `pnpm tauri build` | 构建 Tauri 桌面应用和安装包 |
| `pnpm tauri build --no-bundle` | 仅生成 release 可执行文件 |

## 使用说明

### 待办与每日笔记

- 在展开面板中添加今日待办，并将最重要的一条设为当前专注任务。
- 每日笔记适合记录当天补充信息、临时想法或任务背景。
- 跨天后，上一天内容会进入归档，方便回顾。
- 如需本地保存，可在设置中选择 Markdown 保存目录。

默认 Todo 保存路径为：

```text
%USERPROFILE%\Documents\FocuSD
```

### 剪切板

- 开启剪切板历史后，应用会记录文本和图片剪切板内容。
- 每条记录都可以添加备注，并通过内容或备注搜索。
- 每条记录支持收藏、复制、删除。
- 收藏内容会保留在收藏栏目中，适合保存高频片段。

### Codex 状态

- 在设置中安装或修复 Codex hooks。
- 状态文件位于 `%APPDATA%\com.focusd.island\agent-status.json`。
- 指示灯会根据 Codex 运行、完成、失败或超时状态变化。

## 数据与存储

- 待办、每日笔记、归档、外观设置等前端状态默认保存在 `localStorage`。
- 配置保存目录后，今日内容可写入本地 Markdown 文件，文件名为 `YYYY-MM-DD.md`。
- 剪切板历史、Codex 状态等原生侧数据保存在应用数据目录。
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
├── scripts/                # Codex 状态 hook 脚本
├── docs/                   # 补充文档
├── package.json
└── README.md
```

## 路线图

- [ ] 开发并适配 macOS 版本
- [ ] 完善安装包发布流程和自动更新能力
- [ ] 增强多显示器定位策略
- [ ] 增加更完整的快捷键与键盘工作流
- [ ] 扩展任务分类、标签和筛选能力
- [ ] 增加数据导入、导出和同步方案
- [ ] 优化剪切板历史、媒体控制和 Codex 状态指示灯体验

如果你有更适合 Windows 灵动岛、桌面效率工具或 AI 编程工作流的想法，欢迎在 Issue 中讨论。

## 参与贡献

欢迎提交 Issue 和 Pull Request。

1. Fork 本仓库。
2. 创建你的功能分支：`git checkout -b feature/amazing-feature`。
3. 提交改动：`git commit -m "Add amazing feature"`。
4. 推送分支：`git push origin feature/amazing-feature`。
5. 发起 Pull Request。

提交 Issue 时，建议说明：

- 系统版本
- 应用版本
- 复现步骤
- 预期行为
- 实际行为
- 截图或录屏

提交 PR 时，建议保持改动范围清晰，并在说明中写明验证过的命令。

## 许可证

当前仓库暂未声明开源许可证。如需公开分发或协作复用，建议补充 `LICENSE` 文件。

## 致谢

- README 结构参考 [Best-README-Template](https://github.com/othneildrew/Best-README-Template)
- 感谢所有通过 Issue、PR 和反馈帮助改进 FocuSD Island 的用户
