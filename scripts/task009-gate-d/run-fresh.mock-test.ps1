param([ValidateSet('success', 'runner_fail', 'parser_fail', 'cleanup_mismatch')][string]$Mode)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$caSource = Join-Path $env:USERPROFILE 'Downloads\supabase-dev-ca.crt.crt'
$root = Join-Path $env:TEMP ('g9-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
try {
  New-Item -ItemType Directory -Force -Path (Join-Path $root 'scripts\task009-gate-d'), (Join-Path $root 'profile\Downloads') | Out-Null
  Copy-Item -LiteralPath (Join-Path $repo 'scripts\task009-gate-d\run-fresh.ps1') -Destination (Join-Path $root 'scripts\task009-gate-d\run-fresh.ps1')
  Copy-Item -LiteralPath (Join-Path $repo '.task009-gate-d') -Destination (Join-Path $root '.task009-gate-d') -Recurse
  Copy-Item -LiteralPath $caSource -Destination (Join-Path $root 'profile\Downloads\supabase-dev-ca.crt.crt')
  $env:USERPROFILE = Join-Path $root 'profile'
  $env:NODE_EXTRA_CA_CERTS = 'previous-ca-sentinel'
  $env:MOCK_MODE = $Mode
  $env:MOCK_ROOT = $root
  $global:nodeCalls = 0
  $global:promptCalls = 0

  function Read-Host {
    param([string]$Prompt, [switch]$AsSecureString)
    if (-not $AsSecureString) { throw 'Nonsecure prompt' }
    $global:promptCalls++
    ConvertTo-SecureString 'local-mock-only' -AsPlainText -Force
  }
  function node {
    $global:nodeCalls++
    if ($args[0] -eq '--test') {
      if ($env:MOCK_MODE -eq 'parser_fail') { $global:LASTEXITCODE = 1 } else { $global:LASTEXITCODE = 0 }
      return
    }
    if ($args[0] -ne '.\scripts\task009-gate-d\run.mjs') { throw 'Unexpected Node call' }
    if ($env:SUPABASE_DB_PASSWORD -ne 'local-mock-only') { throw 'Password missing in runner' }
    $archive = Join-Path $env:MOCK_ROOT '.task009-gate-d-archive\f943fe75-0cd4-46b1-814e-f92ef8f8066f'
    $state = Join-Path $env:MOCK_ROOT '.task009-gate-d'
    $ledger = Get-Content -LiteralPath (Join-Path $archive 'fixture-ledger.json') -Raw | ConvertFrom-Json
    $ledger.runId = 'a4b5c6d7-1234-4123-8123-123456789abc'
    $ledger.stage = 'cleaned'
    if ($env:MOCK_MODE -eq 'cleanup_mismatch') { $ledger.cleanup.appointments = @() }
    $ledger | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $state 'fixture-ledger.json') -Encoding UTF8
    $report = @{
      runId = $ledger.runId
      status = 'EXECUTION_PASS'
      integrationPassed = $true
      browserPassed = $true
      cleanupResult = @{ residueZero = $true; inventoryRestored = $true }
      finalChecks = @{ dryRun = 'up to date' }
      stoppedReason = $null
      cleanupStoppedReason = $null
    }
    if ($env:MOCK_MODE -eq 'runner_fail') {
      $report.integrationPassed = $false
      $report.browserPassed = $false
      $report.stoppedReason = 'synthetic failure'
      $report.status = 'BLOCKED'
      $global:LASTEXITCODE = 17
    } else {
      $global:LASTEXITCODE = 0
    }
    $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $state 'run-report.json') -Encoding UTF8
  }

  $threw = $false
  try { & (Join-Path $root 'scripts\task009-gate-d\run-fresh.ps1') } catch { $threw = $true }
  if ($Mode -eq 'success' -and $threw) { throw 'Success path threw' }
  if ($Mode -ne 'success' -and -not $threw) { throw 'Failure path did not stop' }
  if ($env:SUPABASE_DB_PASSWORD) { throw 'Password remained in environment' }
  if ($env:NODE_EXTRA_CA_CERTS -ne 'previous-ca-sentinel') { throw 'CA environment not restored' }
  if ($Mode -eq 'parser_fail') {
    if ($global:nodeCalls -ne 1 -or $global:promptCalls -ne 0 -or
        -not (Test-Path -LiteralPath (Join-Path $root '.task009-gate-d\recovery-report.json'))) {
      throw 'Parser failure altered evidence or proceeded'
    }
  } else {
    $archive = Join-Path $root '.task009-gate-d-archive\f943fe75-0cd4-46b1-814e-f92ef8f8066f'
    if ($global:nodeCalls -ne 2 -or $global:promptCalls -ne 1 -or
        -not (Test-Path -LiteralPath (Join-Path $archive 'recovery-report.json'))) {
      throw 'Archive or mock calls mismatch'
    }
    $originalHash = (Get-FileHash -LiteralPath (Join-Path $repo '.task009-gate-d\recovery-report.json') -Algorithm SHA256).Hash
    $archiveHash = (Get-FileHash -LiteralPath (Join-Path $archive 'recovery-report.json') -Algorithm SHA256).Hash
    if ($originalHash -ne $archiveHash) { throw 'Archived evidence changed' }
  }
  Write-Output "PASS PS5.1 mocked launcher $Mode"
} finally {
  Set-Location -LiteralPath $repo
  $full = [IO.Path]::GetFullPath($root)
  $prefix = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
  if ($full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $root -Recurse -Force
  }
}
