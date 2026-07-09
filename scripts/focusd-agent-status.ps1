param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet("codex", "claudeCode")]
  [string]$Provider,

  [Parameter(Mandatory = $true, Position = 1)]
  [ValidateSet("idle", "running", "completed", "failed")]
  [string]$Phase,

  [Parameter(Position = 2)]
  [string]$TaskId = "",

  [string]$StatusPath = "",

  [int]$MinimumRunningVisibleMs = 800,

  [switch]$HookResponse
)

$ErrorActionPreference = "Stop"

function New-AgentTaskStatus {
  param(
    [string]$Phase = "idle",
    [string]$TaskId = "",
    [long]$UpdatedAt = 0
  )

  $status = [ordered]@{
    phase = $Phase
    updatedAt = $UpdatedAt
  }

  if ($TaskId) {
    $status.taskId = $TaskId
  }

  return $status
}

function Copy-AgentTaskStatus {
  param(
    [object]$Source
  )

  if ($null -eq $Source) {
    return New-AgentTaskStatus
  }

  $phase = "idle"
  if ($Source.PSObject.Properties.Name -contains "phase") {
    $candidatePhase = [string]$Source.phase
    if (@("idle", "running", "completed", "failed") -contains $candidatePhase) {
      $phase = $candidatePhase
    }
  }

  $updatedAt = 0
  if ($Source.PSObject.Properties.Name -contains "updatedAt") {
    $updatedAt = [long]$Source.updatedAt
  }

  $taskId = ""
  if ($Source.PSObject.Properties.Name -contains "taskId") {
    $taskId = [string]$Source.taskId
  }

  return New-AgentTaskStatus -Phase $phase -TaskId $taskId -UpdatedAt $updatedAt
}

function Get-DefaultStatusPath {
  if ($env:FOCUSD_AGENT_STATUS_PATH) {
    return $env:FOCUSD_AGENT_STATUS_PATH
  }

  if ($env:APPDATA) {
    return Join-Path $env:APPDATA "com.focusd.island\agent-status.json"
  }

  return Join-Path $env:LOCALAPPDATA "com.focusd.island\agent-status.json"
}

function Get-AgentMarkerNames {
  param(
    [string]$Provider
  )

  if ($Provider -eq "codex") {
    return @{
      Running = "agent-codex-running.flag"
      Hold = "agent-codex-running-hold.flag"
    }
  }

  return @{
    Running = "agent-claudeCode-running.flag"
    Hold = "agent-claudeCode-running-hold.flag"
  }
}

function Update-AgentRunningMarkers {
  param(
    [string]$Provider,
    [string]$Phase,
    [string]$StatusDirectory,
    [long]$Now,
    [int]$MinimumRunningVisibleMs
  )

  $markerNames = Get-AgentMarkerNames -Provider $Provider
  $runningPath = Join-Path $StatusDirectory $markerNames.Running
  $holdPath = Join-Path $StatusDirectory $markerNames.Hold

  if ($Phase -eq "running") {
    [System.IO.File]::WriteAllText($runningPath, "", [System.Text.UTF8Encoding]::new($false))
    Remove-Item -LiteralPath $holdPath -Force -ErrorAction SilentlyContinue
    return
  }

  $visibleUntil = 0
  if (Test-Path -LiteralPath $runningPath) {
    $markerUpdatedAt = [DateTimeOffset](Get-Item -LiteralPath $runningPath).LastWriteTimeUtc
    $elapsedMs = [Math]::Max(0, $Now - $markerUpdatedAt.ToUnixTimeMilliseconds())
    $remainingMs = [Math]::Max(0, $MinimumRunningVisibleMs - $elapsedMs)
    if ($remainingMs -gt 0) {
      $visibleUntil = $Now + $remainingMs
    }
  }

  Remove-Item -LiteralPath $runningPath -Force -ErrorAction SilentlyContinue
  if ($visibleUntil -gt $Now) {
    [System.IO.File]::WriteAllText($holdPath, [string]$visibleUntil, [System.Text.UTF8Encoding]::new($false))
  } else {
    Remove-Item -LiteralPath $holdPath -Force -ErrorAction SilentlyContinue
  }
}

if (-not $StatusPath) {
  $StatusPath = Get-DefaultStatusPath
}

$mutex = New-Object System.Threading.Mutex($false, "FocuSD.AgentStatus")
$hasLock = $false

try {
  $hasLock = $mutex.WaitOne([TimeSpan]::FromSeconds(5))
  if (-not $hasLock) {
    throw "Timed out waiting for the FocuSD agent status file lock."
  }

  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $state = [ordered]@{
    codex = New-AgentTaskStatus
    claudeCode = New-AgentTaskStatus
    updatedAt = $now
  }

  if (Test-Path -LiteralPath $StatusPath) {
    try {
      $existing = Get-Content -LiteralPath $StatusPath -Raw | ConvertFrom-Json
      $state.codex = Copy-AgentTaskStatus -Source $existing.codex
      $state.claudeCode = Copy-AgentTaskStatus -Source $existing.claudeCode
    } catch {
      $state.codex = New-AgentTaskStatus
      $state.claudeCode = New-AgentTaskStatus
    }
  }

  $nextTask = New-AgentTaskStatus -Phase $Phase -TaskId $TaskId -UpdatedAt $now
  if ($Provider -eq "codex") {
    $state.codex = $nextTask
  } else {
    $state.claudeCode = $nextTask
  }
  $state.updatedAt = $now

  $statusDirectory = Split-Path -Parent $StatusPath
  New-Item -ItemType Directory -Force -Path $statusDirectory | Out-Null
  Update-AgentRunningMarkers -Provider $Provider -Phase $Phase -StatusDirectory $statusDirectory -Now $now -MinimumRunningVisibleMs $MinimumRunningVisibleMs

  $json = $state | ConvertTo-Json -Depth 5
  $temporaryPath = "$StatusPath.tmp"
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($temporaryPath, $json, $utf8NoBom)
  Move-Item -LiteralPath $temporaryPath -Destination $StatusPath -Force
} finally {
  if ($hasLock) {
    $mutex.ReleaseMutex() | Out-Null
  }
  $mutex.Dispose()
}

if ($HookResponse) {
  [Console]::Out.Write('{"continue":true,"suppressOutput":true}')
}
