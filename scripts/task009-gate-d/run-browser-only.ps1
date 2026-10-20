$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$previousCa = [Environment]::GetEnvironmentVariable('NODE_EXTRA_CA_CERTS', 'Process')
$previousBrowserOnly = [Environment]::GetEnvironmentVariable('TASK009_BROWSER_ONLY', 'Process')
$previousRunEnv = [Environment]::GetEnvironmentVariable('TASK009_PREVIOUS_RUN_ID', 'Process')
$priorRunId = '40fc08f8-ba93-43e7-94ae-daeaa77f297b'
$integrationRunId = '71c74b49-e099-4c63-9dba-7f8c76989882'

try {
  Set-Location -LiteralPath $projectRoot
  $stateRoot = Join-Path $projectRoot '.task009-gate-d'
  $archiveRoot = Join-Path $projectRoot '.task009-gate-d-archive'
  $archiveTarget = Join-Path $archiveRoot $priorRunId
  $testResults = Join-Path $projectRoot 'test-results'
  $workspacePrefix = [IO.Path]::GetFullPath($projectRoot).TrimEnd('\') + '\'
  foreach ($path in @($stateRoot, $archiveRoot, $archiveTarget, $testResults)) {
    if (-not [IO.Path]::GetFullPath($path).StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'Una ruta del expediente sale del workspace; STOP.'
    }
  }
  if ((Test-Path -LiteralPath $archiveTarget) -or -not (Test-Path -LiteralPath $stateRoot -PathType Container)) {
    throw 'El expediente ya fue archivado o falta; no repetir el launcher.'
  }
  foreach ($path in @($stateRoot, $archiveRoot, $testResults)) {
    if ((Test-Path -LiteralPath $path) -and
        ((Get-Item -LiteralPath $path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
      throw 'Un expediente es una ruta redirigida; STOP.'
    }
  }
  foreach ($path in @($stateRoot, $testResults)) {
    if ((Test-Path -LiteralPath $path) -and
        @(Get-ChildItem -LiteralPath $path -Recurse -Force | Where-Object {
          $_.Attributes -band [IO.FileAttributes]::ReparsePoint
        }).Count -ne 0) {
      throw 'El expediente contiene una ruta redirigida; STOP.'
    }
  }

  $ledgerPath = Join-Path $stateRoot 'fixture-ledger.json'
  $reportPath = Join-Path $stateRoot 'run-report.json'
  $manualPath = Join-Path $stateRoot 'manual-baseline.json'
  foreach ($path in @($ledgerPath, $reportPath, $manualPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'Falta evidencia del run anterior; STOP.' }
  }
  $ledger = Get-Content -LiteralPath $ledgerPath -Raw | ConvertFrom-Json
  $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
  if ($ledger.runId -ne $priorRunId -or $report.runId -ne $priorRunId -or
      $ledger.projectRef -ne 'ehllxymqyzrofydrvtzo' -or
      $report.projectRef -ne 'ehllxymqyzrofydrvtzo' -or
      $ledger.stage -ne 'cleaned' -or $report.browserOnly -ne $true -or
      $report.integrationPassed -ne $false -or $report.browserPassed -ne $false -or
      $report.priorIntegration.runId -ne $integrationRunId -or
      $report.priorIntegration.evidenceGroups -ne 6 -or
      $report.cleanupResult.residueZero -ne $true -or
      $report.cleanupResult.inventoryRestored -ne $true -or
      $report.finalChecks.dryRun -ne 'Remote database is up to date' -or
      $report.finalChecks.lint -ne 'No schema errors found' -or
      (ConvertTo-Json -InputObject $ledger.baseline -Depth 20 -Compress) -ne
      (ConvertTo-Json -InputObject $ledger.finalInventory -Depth 20 -Compress) -or
      (ConvertTo-Json -InputObject $report.baseline -Depth 20 -Compress) -ne
      (ConvertTo-Json -InputObject $report.finalInventory -Depth 20 -Compress)) {
    throw 'El cleanup del run Playwright anterior no está acreditado; STOP.'
  }
  foreach ($kind in $ledger.owned.PSObject.Properties.Name) {
    if ((@($ledger.owned.$kind | Sort-Object) -join ',') -ne
        (@($ledger.cleanup.$kind | Sort-Object) -join ',')) {
      throw "El cleanup anterior de $kind no coincide; STOP."
    }
  }

  $config = Get-Content -LiteralPath (Join-Path $projectRoot 'playwright.task009.config.ts') -Raw
  $spec = Get-Content -LiteralPath (Join-Path $projectRoot 'tests\e2e\task-009-gate-d.spec.mjs') -Raw
  $selector = Get-Content -LiteralPath (Join-Path $projectRoot 'src\modules\appointments\components\booking-selector.tsx') -Raw
  if (-not $config.Contains('baseURL: "http://localhost:31009"') -or
      -not $config.Contains('url: "http://localhost:31009/login"') -or
      -not $config.Contains('actionTimeout: 30_000') -or
      -not $spec.Contains('Especialidad no está lista') -or
      -not $spec.Contains('getByRole("textbox", { name: "Nota", exact: true })') -or
      -not $spec.Contains('countOwnedSlotAppointments("18:00")') -or
      -not $selector.Contains('specialtyState !== "ready"') -or
      -not $selector.Contains('professionalState !== "ready"')) {
    throw 'La corrección local de Playwright no está presente; STOP.'
  }
  $caPath = Join-Path $env:USERPROFILE 'Downloads\supabase-dev-ca.crt.crt'
  if (-not (Test-Path -LiteralPath $caPath -PathType Leaf) -or
      (Get-FileHash -LiteralPath $caPath -Algorithm SHA256).Hash -ne
      '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7') {
    throw 'El certificado CA Supabase DEV no coincide con el validado; STOP.'
  }
  & node --test .\scripts\task009-gate-d\dev-connection.node-test.mjs
  if ($LASTEXITCODE -ne 0) { throw 'La regresión timestamptz falló; STOP.' }

  $securePassword = Read-Host 'Contraseña PostgreSQL DEV preexistente' -AsSecureString
  $manifest = @{}
  foreach ($file in Get-ChildItem -LiteralPath $stateRoot -Recurse -File -Force) {
    $relative = $file.FullName.Substring($stateRoot.Length + 1)
    $manifest[$relative] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
  }
  $testManifest = @{}
  if (Test-Path -LiteralPath $testResults -PathType Container) {
    foreach ($file in Get-ChildItem -LiteralPath $testResults -Recurse -File -Force) {
      $relative = $file.FullName.Substring($testResults.Length + 1)
      $testManifest[$relative] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    }
  }
  New-Item -ItemType Directory -Path $archiveRoot -Force | Out-Null
  Move-Item -LiteralPath $stateRoot -Destination $archiveTarget
  foreach ($relative in $manifest.Keys) {
    $archived = Join-Path $archiveTarget $relative
    if (-not (Test-Path -LiteralPath $archived -PathType Leaf) -or
        (Get-FileHash -LiteralPath $archived -Algorithm SHA256).Hash -ne $manifest[$relative]) {
      throw 'El expediente archivado difiere del original; STOP antes de DEV.'
    }
  }
  if (Test-Path -LiteralPath $testResults -PathType Container) {
    $archiveEvidence = Join-Path $archiveTarget 'test-results'
    Copy-Item -LiteralPath $testResults -Destination $archiveEvidence -Recurse
    foreach ($relative in $testManifest.Keys) {
      $archived = Join-Path $archiveEvidence $relative
      if (-not (Test-Path -LiteralPath $archived -PathType Leaf) -or
          (Get-FileHash -LiteralPath $archived -Algorithm SHA256).Hash -ne $testManifest[$relative]) {
        throw 'La evidencia Playwright archivada difiere del original; STOP antes de DEV.'
      }
    }
  }
  New-Item -ItemType Directory -Path $stateRoot | Out-Null
  Copy-Item -LiteralPath (Join-Path $archiveTarget 'manual-baseline.json') -Destination $manualPath
  if ((Get-FileHash -LiteralPath $manualPath -Algorithm SHA256).Hash -ne $manifest['manual-baseline.json']) {
    throw 'El baseline copiado difiere del anterior; STOP antes de DEV.'
  }

  $passwordBstr = [IntPtr]::Zero
  try {
    $passwordBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $env:SUPABASE_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordBstr)
  } finally {
    if ($passwordBstr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordBstr)
    }
    Remove-Variable securePassword -ErrorAction SilentlyContinue
  }
  $env:NODE_EXTRA_CA_CERTS = $caPath
  $env:TASK009_BROWSER_ONLY = '1'
  $env:TASK009_PREVIOUS_RUN_ID = $integrationRunId

  & node .\scripts\task009-gate-d\run.mjs
  if ($LASTEXITCODE -ne 0) {
    throw 'Playwright Gate D se detuvo. No reintentar: conservar ledger, reporte y evidencia.'
  }
  $newLedger = Get-Content -LiteralPath (Join-Path $stateRoot 'fixture-ledger.json') -Raw | ConvertFrom-Json
  $newReport = Get-Content -LiteralPath (Join-Path $stateRoot 'run-report.json') -Raw | ConvertFrom-Json
  if ($newLedger.runId -eq $priorRunId -or $newLedger.runId -ne $newReport.runId -or
      $newLedger.projectRef -ne 'ehllxymqyzrofydrvtzo' -or $newLedger.stage -ne 'cleaned' -or
      $newReport.status -ne 'EXECUTION_PASS' -or $newReport.browserOnly -ne $true -or
      $newReport.integrationPassed -ne $false -or
      $newReport.priorIntegration.runId -ne $integrationRunId -or
      $newReport.browserPassed -ne $true -or
      @($newReport.evidence | Where-Object { $_.outcome -eq 'PASS' }).Count -ne 3 -or
      $newReport.cleanupResult.residueZero -ne $true -or
      $newReport.cleanupResult.inventoryRestored -ne $true -or
      $null -ne $newReport.stoppedReason -or $null -ne $newReport.cleanupStoppedReason -or
      $newReport.finalChecks.dryRun -ne 'Remote database is up to date' -or
      $newReport.finalChecks.lint -ne 'No schema errors found' -or
      (ConvertTo-Json -InputObject $newLedger.baseline -Depth 20 -Compress) -ne
      (ConvertTo-Json -InputObject $newLedger.finalInventory -Depth 20 -Compress)) {
    throw 'El informe nuevo no acredita tres escenarios Playwright y cleanup; STOP.'
  }
  foreach ($kind in $newLedger.owned.PSObject.Properties.Name) {
    if ((@($newLedger.owned.$kind | Sort-Object) -join ',') -ne
        (@($newLedger.cleanup.$kind | Sort-Object) -join ',')) {
      throw "El residuo de $kind no coincide con el nuevo ledger; STOP."
    }
  }
  Write-Output "TASK009_BROWSER_EXECUTION_PASS runId=$($newLedger.runId); report=$stateRoot\run-report.json"
} finally {
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  Remove-Variable securePassword -ErrorAction SilentlyContinue
  if ($null -eq $previousCa) { Remove-Item Env:NODE_EXTRA_CA_CERTS -ErrorAction SilentlyContinue }
  else { $env:NODE_EXTRA_CA_CERTS = $previousCa }
  if ($null -eq $previousBrowserOnly) { Remove-Item Env:TASK009_BROWSER_ONLY -ErrorAction SilentlyContinue }
  else { $env:TASK009_BROWSER_ONLY = $previousBrowserOnly }
  if ($null -eq $previousRunEnv) { Remove-Item Env:TASK009_PREVIOUS_RUN_ID -ErrorAction SilentlyContinue }
  else { $env:TASK009_PREVIOUS_RUN_ID = $previousRunEnv }
}
