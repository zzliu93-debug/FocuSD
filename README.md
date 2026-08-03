<div align="center">
  <img src="src-tauri/icons/128x128.png" alt="FocuSD Island Logo" width="96" height="96">

  <h1>FocuSD Island</h1>

  <p>
    一款 Windows 灵动岛效率工具，把待办、每日笔记、Codex 状态指示灯、剪切板历史和媒体控制放在屏幕顶部，现已支持毛玻璃风格
  </p>

  <p>
    <a href="https://github.com/zzliu93-debug/FocuSD/releases/latest">下载 Release</a>
    ·
    <a href="https://github.com/zzliu93-debug/FocuSD/issues">反馈 Issue</a>
    ·
    <a href="https://github.com/zzliu93-debug/FocuSD/stargazers">GitHub Stars</a>
  </p>

  <p>
    <img alt="Version" src="https://img.shields.io/badge/version-0.2.2-blue">
    <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-0078D4">
    <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2-24C8DB">
    <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6">
    <a href="https://github.com/zzliu93-debug/FocuSD/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/zzliu93-debug/FocuSD?style=flat"></a>
  </p>
</div>

## 关于项目

FocuSD Island 是一个 Windows 桌面悬浮效率工具。它以透明、无边框、始终置顶的小岛形式停靠在屏幕顶部，平时保持紧凑，需要时展开处理待办、笔记、剪切板和媒体控制。

它的目标不是模拟一个装饰性的灵动岛，而是把容易打断注意力的常用入口集中起来，并让你不切回终端也能看到 Codex 任务状态。项目目前优先适配 Windows。

## 核心功能

| 功能 | 说明 |
| --- | --- |
| 悬浮岛 | 透明、无边框、始终置顶，支持折叠、边缘收起和托盘隐藏。 |
| 待办与笔记 | 管理今日任务、专注任务和每日笔记，支持拖动排序、跨天延续与归档。 |
| Markdown 保存 | 将每日内容保存为本地 `YYYY-MM-DD.md`。 |
| Codex 状态 | 显示任务正在运行、已完成、失败或可能中断。 |
| 剪切板历史 | 记录文本和图片，支持备注、搜索、收藏和复制。 |
| 媒体与外观 | 控制系统媒体，并提供经典与液态玻璃外观设置。 |

## Codex 状态指示灯

FocuSD 可以通过 Codex hooks 显示 AI 编程任务的运行状态。在 **设置 → AI Agent 状态灯** 中点击 **安装/修复** 即可配置。

> [!IMPORTANT]
> **Codex 状态灯不亮时，必须在 Codex 中信任 FocuSD hook。** 新版 Codex 会跳过未经审核和信任的命令 hook；仅在 FocuSD 中点击“安装/修复”还不够。

安装后请在 Codex 的 **设置 → Hooks**（CLI 使用 `/hooks`）中找到两条 **Updating FocuSD agent status**，审核并信任，然后重启 Codex。

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

需要 Windows 10/11、Node.js、pnpm、Rust、Visual Studio C++ Build Tools 和 WebView2 Runtime。

```powershell
git clone https://github.com/zzliu93-debug/FocuSD.git
cd FocuSD
pnpm install
pnpm tauri build
```

开发模式：

```powershell
pnpm tauri dev
```

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

### 外观与液态玻璃

- 在设置中可切换“经典”与“液态玻璃”主题，并调节玻璃强度。
- 液态玻璃在 Windows 10 1809+/Windows 11 上优先使用 Acrylic 背景采样；系统不支持或关闭透明效果时自动降级为可读的 CSS 玻璃。
- 经典主题保留原有背景色与透明度行为；旧设置和旧预设会保持经典主题，避免升级后改变已有外观。

## 数据与存储

待办、笔记、归档和外观设置保存在本机。配置保存目录后，每日内容可写入 `YYYY-MM-DD.md`；剪切板历史和 Codex 状态保存在应用数据目录。

## 参与贡献

欢迎提交 [Issue](https://github.com/zzliu93-debug/FocuSD/issues) 和 Pull Request。反馈问题时请附上系统版本、应用版本、复现步骤和截图或录屏；提交 PR 时请说明改动内容和验证命令。

## 许可证

当前仓库暂未声明开源许可证。
