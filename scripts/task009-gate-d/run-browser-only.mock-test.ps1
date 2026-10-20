param([ValidateSet('success', 'runner_fail', 'prior_mismatch', 'cleanup_mismatch')][string]$Mode)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$root = Join-Path $env:TEMP ('task009-browser-mock-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$previousProfile = $env:USERPROFILE
$previousCa = $env:NODE_EXTRA_CA_CERTS
$previousBrowserOnly = $env:TASK009_BROWSER_ONLY
$previousRunId = $env:TASK009_PREVIOUS_RUN_ID
try {
  New-Item -ItemType Directory -Force -Path (Join-Path $root 'scripts\task009-gate-d'), (Join-Path $root 'profile\Downloads') | Out-Null
  Copy-Item -LiteralPath (Join-Path $repo 'scripts\task009-gate-d\run-browser-only.ps1') -Destination (Join-Path $root 'scripts\task009-gate-d\run-browser-only.ps1')
  Copy-Item -LiteralPath (Join-Path $repo '.task009-gate-d') -Destination (Join-Path $root '.task009-gate-d') -Recurse
  Copy-Item -LiteralPath (Join-Path $repo 'test-results') -Destination (Join-Path $root 'test-results') -Recurse
  Copy-Item -LiteralPath (Join-Path $repo 'playwright.task009.config.ts') -Destination (Join-Path $root 'playwright.task009.config.ts')
  New-Item -ItemType Directory -Path (Join-Path $root 'tests\e2e') -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $repo 'tests\e2e\task-009-gate-d.spec.mjs') -Destination (Join-Path $root 'tests\e2e\task-009-gate-d.spec.mjs')
  New-Item -ItemType Directory -Path (Join-Path $root 'src\modules\appointments\components') -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $repo 'src\modules\appointments\components\booking-selector.tsx') -Destination (Join-Path $root 'src\modules\appointments\components\booking-selector.tsx')
  Copy-Item -LiteralPath (Join-Path $previousProfile 'Downloads\supabase-dev-ca.crt.crt') -Destination (Join-Path $root 'profile\Downloads\supabase-dev-ca.crt.crt')
  $env:USERPROFILE = Join-Path $root 'profile'
  $env:NODE_EXTRA_CA_CERTS = 'prior-ca'
  $env:TASK009_BROWSER_ONLY = 'prior-mode'
  $env:TASK009_PREVIOUS_RUN_ID = 'prior-run'
  if ($Mode -eq 'prior_mismatch') {
    $priorReport = Join-Path $root '.task009-gate-d\run-report.json'
    $badReport = Get-Content -LiteralPath $priorReport -Raw | ConvertFrom-Json
    $badReport.cleanupResult.residueZero = $false
    $badReport | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $priorReport -Encoding UTF8
  }
  $global:nodeCalls = 0
  $global:promptCalls = 0
  function Read-Host {
    param([string]$Prompt, [switch]$AsSecureString)
    if (-not $AsSecureString) { throw 'Plain password prompt' }
    $global:promptCalls++
    ConvertTo-SecureString 'local-mock-only' -AsPlainText -Force
  }
  function node {
    $global:nodeCalls++
    if ($args[0] -eq '--test') { $global:LASTEXITCODE = 0; return }
    if ($args[0] -ne '.\scripts\task009-gate-d\run.mjs' -or
        $env:SUPABASE_DB_PASSWORD -ne 'local-mock-only' -or
        $env:TASK009_BROWSER_ONLY -ne '1' -or
        $env:TASK009_PREVIOUS_RUN_ID -ne '71c74b49-e099-4c63-9dba-7f8c76989882') {
      throw 'Mock runner invocation differs'
    }
    $archive = Join-Path $root '.task009-gate-d-archive\40fc08f8-ba93-43e7-94ae-daeaa77f297b'
    $state = Join-Path $root '.task009-gate-d'
    $ledger = Get-Content -LiteralPath (Join-Path $archive 'fixture-ledger.json') -Raw | ConvertFrom-Json
    $ledger.runId = 'a4b5c6d7-1234-4123-8123-123456789abc'
    $ledger.stage = 'cleaned'
    if ($Mode -eq 'cleanup_mismatch') { $ledger.cleanup.centers = @() }
    $ledger | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $state 'fixture-ledger.json') -Encoding UTF8
    $report = @{
      runId = $ledger.runId
      status = 'EXECUTION_PASS'
      browserOnly = $true
      integrationPassed = $false
      priorIntegration = @{ runId = '71c74b49-e099-4c63-9dba-7f8c76989882'; evidenceGroups = 6 }
      browserPassed = $true
      evidence = @(@{ outcome = 'PASS' }, @{ outcome = 'PASS' }, @{ outcome = 'PASS' })
      cleanupResult = @{ residueZero = $true; inventoryRestored = $true }
      finalChecks = @{ dryRun = 'Remote database is up to date'; lint = 'No schema errors found' }
      stoppedReason = $null
      cleanupStoppedReason = $null
    }
    if ($Mode -eq 'runner_fail') {
      $report.status = 'BLOCKED'
      $report.browserPassed = $false
      $report.stoppedReason = 'local simulated browser failure'
      $global:LASTEXITCODE = 17
    } else { $global:LASTEXITCODE = 0 }
    $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $state 'run-report.json') -Encoding UTF8
  }

  $threw = $false
  try { & (Join-Path $root 'scripts\task009-gate-d\run-browser-only.ps1') } catch { $threw = $true }
  if (($Mode -eq 'success') -eq $threw) { throw 'Launcher result differs from mock scenario' }
  if ($env:SUPABASE_DB_PASSWORD) { throw 'Password remained in the environment' }
  if ($env:NODE_EXTRA_CA_CERTS -ne 'prior-ca' -or $env:TASK009_BROWSER_ONLY -ne 'prior-mode' -or
      $env:TASK009_PREVIOUS_RUN_ID -ne 'prior-run') { throw 'Prior environment was not restored' }
  if ($Mode -eq 'prior_mismatch') {
    if ($global:nodeCalls -ne 0 -or $global:promptCalls -ne 0 -or
        (Test-Path -LiteralPath (Join-Path $root '.task009-gate-d-archive'))) {
      throw 'Prior mismatch reached password or archive'
    }
  } else {
    $archive = Join-Path $root '.task009-gate-d-archive\40fc08f8-ba93-43e7-94ae-daeaa77f297b'
    if ($global:nodeCalls -ne 2 -or $global:promptCalls -ne 1 -or
        -not (Test-Path -LiteralPath (Join-Path $archive 'run-report.json')) -or
        -not (Test-Path -LiteralPath (Join-Path $archive 'test-results\.last-run.json'))) {
      throw 'Archive, evidence or mock calls mismatch'
    }
    foreach ($file in @('run-report.json', 'fixture-ledger.json', 'manual-baseline.json')) {
      $original = Join-Path $repo ('.task009-gate-d\' + $file)
      $saved = Join-Path $archive $file
      if ((Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash -ne
          (Get-FileHash -LiteralPath $saved -Algorithm SHA256).Hash) {
        throw 'Archived evidence changed'
      }
    }
  }
  Write-Output "PASS PS5.1 browser-only launcher $Mode"
} finally {
  Set-Location -LiteralPath $repo
  $env:USERPROFILE = $previousProfile
  if ($null -eq $previousCa) { Remove-Item Env:NODE_EXTRA_CA_CERTS -ErrorAction SilentlyContinue }
  else { $env:NODE_EXTRA_CA_CERTS = $previousCa }
  if ($null -eq $previousBrowserOnly) { Remove-Item Env:TASK009_BROWSER_ONLY -ErrorAction SilentlyContinue }
  else { $env:TASK009_BROWSER_ONLY = $previousBrowserOnly }
  if ($null -eq $previousRunId) { Remove-Item Env:TASK009_PREVIOUS_RUN_ID -ErrorAction SilentlyContinue }
  else { $env:TASK009_PREVIOUS_RUN_ID = $previousRunId }
  $full = [IO.Path]::GetFullPath($root)
  $prefix = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
  if ($full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $root -Recurse -Force
  }
}
