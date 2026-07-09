# AI Agent Status Hooks

FocuSD reads agent state from the app data directory:

```text
%APPDATA%\com.focusd.island\
```

Do not use process or CPU detection for this integration. Codex and Claude Code can stay alive while idle, and Claude Code may run inside a VSCode terminal. The reliable path is to wire into lifecycle hooks.

This follows the same broad pattern used by projects such as [code-notify](https://github.com/mylee04/code-notify), [agent-notify](https://github.com/LetTTGACO/agent-notify), [esp32-claude-lamp](https://github.com/reynico/esp32-claude-lamp), and [CodexLight](https://github.com/StartHex/codex_agent_status_light): make hook handlers fast and let the display layer mirror status.

## Fast Status Path

Prompt submission uses a fast marker file instead of PowerShell JSON work:

```text
agent-codex-running.flag
agent-claudeCode-running.flag
```

FocuSD polls these marker files every 200ms. If either marker exists, the island turns red.

When the turn finishes, `focusd-agent-status.ps1` removes the marker, writes `agent-status.json`, and keeps a short hold marker when the task completed too quickly. This makes very short prompts still visibly flash red for about 800ms.

## Manual Smoke Test

```powershell
.\scripts\focusd-agent-running.cmd codex
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\focusd-agent-status.ps1 codex completed

.\scripts\focusd-agent-running.cmd claudeCode
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\focusd-agent-status.ps1 claudeCode completed
```

## Codex Hooks

Add these hooks to your Codex `config.toml`:

```toml
[[hooks.UserPromptSubmit]]
[[hooks.UserPromptSubmit.hooks]]
type = "command"
command = 'cmd.exe /d /s /c ""D:\FocuSD\scripts\focusd-agent-running.cmd" codex"'
command_windows = 'cmd.exe /d /s /c ""D:\FocuSD\scripts\focusd-agent-running.cmd" codex"'
timeout = 1
statusMessage = "Updating FocuSD agent status"

[[hooks.Stop]]
[[hooks.Stop.hooks]]
type = "command"
command = 'powershell -NoProfile -ExecutionPolicy Bypass -File "D:\FocuSD\scripts\focusd-agent-status.ps1" codex completed'
command_windows = 'powershell -NoProfile -ExecutionPolicy Bypass -File "D:\FocuSD\scripts\focusd-agent-status.ps1" codex completed'
timeout = 5
statusMessage = "Updating FocuSD agent status"
```

Codex requires new or changed hooks to be reviewed and trusted before they run. Restart Codex or open a new session, then use `/hooks` when prompted.

## Claude Code Hooks

Add these hooks to your Claude Code `settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cmd.exe",
            "args": [
              "/d",
              "/s",
              "/c",
              "\"D:\\FocuSD\\scripts\\focusd-agent-running.cmd\" claudeCode"
            ],
            "timeout": 1
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "powershell.exe",
            "args": [
              "-NoProfile",
              "-ExecutionPolicy",
              "Bypass",
              "-File",
              "D:\\FocuSD\\scripts\\focusd-agent-status.ps1",
              "claudeCode",
              "completed"
            ],
            "timeout": 5
          }
        ]
      }
    ],
    "StopFailure": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "powershell.exe",
            "args": [
              "-NoProfile",
              "-ExecutionPolicy",
              "Bypass",
              "-File",
              "D:\\FocuSD\\scripts\\focusd-agent-status.ps1",
              "claudeCode",
              "failed"
            ],
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

If you already have hooks in `settings.json`, merge the `UserPromptSubmit`, `Stop`, and `StopFailure` entries instead of replacing unrelated hooks. Restart the VSCode terminal running Claude Code after changing the file.
