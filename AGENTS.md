# AGENTS.md

本文件面向在本仓库中工作的 AI 编程代理和协作者，说明项目背景、常用命令、代码边界与变更约定。请在动手修改前先阅读本文件，并优先遵循仓库现有实现风格。

## 项目概览

FocuSD Island 是一个 Windows 优先的桌面效率工具，以透明、无边框、始终置顶的 Tauri 悬浮岛形式运行。前端负责悬浮岛 UI、待办、每日笔记、归档、外观设置和媒体控制面板；Tauri/Rust 侧负责窗口定位、托盘、注册表开机自启、Markdown 写入以及 Windows 媒体/音频能力。

当前项目处于早期 MVP 阶段，改动应保持小步、可验证、低风险。

## 技术栈

- 前端：React 19、TypeScript、Vite 7
- 桌面壳：Tauri 2
- 原生能力：Rust、Windows API
- 图标：lucide-react
- 包管理器：pnpm

## 目录结构

```text
.
├── src/                    # React 前端
│   ├── App.tsx             # 核心 UI、状态、交互与 Tauri invoke 调用
│   ├── App.css             # 主要样式
│   ├── main.tsx            # React 入口
│   └── vite-env.d.ts
├── src-tauri/              # Tauri / Rust 桌面端
│   ├── src/lib.rs          # 原生命令、窗口定位、托盘、文件保存、媒体控制
│   ├── src/main.rs         # Tauri 应用入口
│   ├── Cargo.toml          # Rust 依赖与构建配置
│   ├── tauri.conf.json     # Tauri 配置
│   ├── capabilities/       # Tauri 权限能力配置
│   └── icons/              # 应用图标
├── package.json            # 前端依赖和脚本
├── vite.config.ts
└── README.md
```

## 常用命令

安装依赖：

```powershell
pnpm install
```

启动前端开发服务器：

```powershell
pnpm dev
```

启动 Tauri 桌面开发模式：

```powershell
pnpm tauri dev
```

类型检查并构建前端：

```powershell
pnpm build
```

构建 Tauri 应用：

```powershell
pnpm tauri build
```

仅生成 release 可执行文件、不生成安装包：

```powershell
pnpm tauri build --no-bundle
```

## 开发约定

- 默认使用 TypeScript 和 React 函数组件，延续当前 `src/App.tsx` 中的状态组织与命名风格。
- 优先复用现有组件、类型、工具函数和 CSS class，不为小改动引入新的抽象层。
- 继续使用 `localStorage` 存储前端状态，除非需求明确要求迁移到文件、数据库或云同步。
- Tauri 命令通过 `@tauri-apps/api/core` 的 `invoke` 调用；新增命令时需同步更新 Rust 侧 handler、前端类型和必要的权限配置。
- UI 图标优先使用 `lucide-react`，不要手写可由图标库提供的 SVG。
- 面向 Windows 的原生能力需要谨慎处理错误路径，Rust 命令应返回清晰的 `Result<_, String>`。
- 修改窗口大小、定位、透明度、置顶、托盘或注册表逻辑时，要同时考虑折叠态、展开态、边缘收起和托盘隐藏。
- 避免无关重构、格式化整仓或改动生成产物。
- 验证应与改动范围匹配，不要无条件运行 `pnpm tauri build`，但改动范围要求的构建不得省略：仅文档改动不需要构建；前端逻辑、样式或依赖改动必须运行 `pnpm build`；涉及 Tauri/Rust、Windows 原生能力、桌面配置或发布产物的改动必须运行对应的 Tauri 构建。
- 不得因为构建耗时而跳过必要验证。若必要构建失败或受环境阻塞，应明确报告原因，不得将未完成的构建描述为已验证。

## 前端注意事项

- `src/App.tsx` 目前承载了大部分业务逻辑，新增功能前先查找是否已有相关类型、状态和工具函数。
- 样式主要在 `src/App.css`，请保持现有视觉语言：悬浮岛、紧凑面板、透明背景、可读的控件状态。
- 文本应注意中英文混排和窄窗口显示，避免按钮、标签和任务标题溢出。
- 对任务、每日笔记、归档、设置预设等状态的改动，需要维护对应的 `localStorage` key 兼容性。

## Tauri / Rust 注意事项

- 主要逻辑位于 `src-tauri/src/lib.rs`。
- 与 Windows API 相关的代码需保持最小权限和明确错误处理。
- 开机自启使用当前用户注册表路径：
  `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
- Markdown 保存命令应继续校验目录和文件名，避免不受控路径写入。
- 新增 Tauri 插件或权限时，需要检查 `src-tauri/capabilities/default.json` 和 `src-tauri/tauri.conf.json`。

## 验证建议

根据改动范围选择最小且充分的验证方式，避免无关、耗时的构建：

- 仅文档改动：确认 Markdown 内容可读即可。
- 前端逻辑、样式或依赖改动：必须运行 `pnpm build`，必要时运行 `pnpm dev` 进行浏览器检查。
- Tauri 命令、窗口、托盘、注册表、Windows API 或桌面配置改动：必须运行 `pnpm tauri build --no-bundle`，并在行为风险需要时运行 `pnpm tauri dev` 手动验证。
- 发布相关改动：必须运行完整的 `pnpm tauri build`。

## Git 与协作

- 修改前先查看 `git status --short`，不要覆盖用户已有改动。
- 不要使用 `git reset --hard`、`git checkout --` 等破坏性命令，除非用户明确要求。
- 如果工作区已有与当前任务无关的修改，保留它们并只处理本次任务相关文件。
- 提交前尽量让改动范围保持聚焦，并在最终说明中列出已验证的命令。

## 编码与文档

- 源码保持项目当前编码风格。中文文档建议使用 UTF-8。
- 注释只写在能降低理解成本的位置，不解释显而易见的代码。
- README 当前包含中英文项目说明；更新文档时注意不要破坏现有双语结构。
