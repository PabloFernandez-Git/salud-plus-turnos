$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$previousCa = [Environment]::GetEnvironmentVariable('NODE_EXTRA_CA_CERTS', 'Process')

try {
  Set-Location -LiteralPath $projectRoot
  $previousRunId = 'f943fe75-0cd4-46b1-814e-f92ef8f8066f'
  $stateRoot = Join-Path $projectRoot '.task009-gate-d'
  $archiveRoot = Join-Path $projectRoot '.task009-gate-d-archive'
  $archiveTarget = Join-Path $archiveRoot $previousRunId
  $workspacePrefix = [IO.Path]::GetFullPath($projectRoot).TrimEnd('\') + '\'
  foreach ($path in @($stateRoot, $archiveRoot, $archiveTarget)) {
    if (-not [IO.Path]::GetFullPath($path).StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'La ruta del expediente sale del workspace; STOP.'
    }
  }
  if ((Test-Path -LiteralPath $archiveTarget) -or -not (Test-Path -LiteralPath $stateRoot -PathType Container)) {
    throw 'El expediente anterior ya fue archivado o falta; no repetir el launcher.'
  }
  if (((Get-Item -LiteralPath $stateRoot -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -or
      ((Test-Path -LiteralPath $archiveRoot) -and
      ((Get-Item -LiteralPath $archiveRoot -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) -or
      @(Get-ChildItem -LiteralPath $stateRoot -Recurse -Force | Where-Object {
        $_.Attributes -band [IO.FileAttributes]::ReparsePoint
      }).Count -ne 0) {
    throw 'El expediente contiene una ruta redirigida; STOP antes de moverlo.'
  }

  $ledgerPath = Join-Path $stateRoot 'fixture-ledger.json'
  $reportPath = Join-Path $stateRoot 'recovery-report.json'
  $manualPath = Join-Path $stateRoot 'manual-baseline.json'
  foreach ($path in @($ledgerPath, $reportPath, $manualPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'Falta evidencia del run anterior; STOP.' }
  }
  $ledger = Get-Content -LiteralPath $ledgerPath -Raw | ConvertFrom-Json
  $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
  if ($ledger.runId -ne $previousRunId -or $report.runId -ne $previousRunId -or
      $report.projectRef -ne 'ehllxymqyzrofydrvtzo' -or
      $ledger.projectRef -ne 'ehllxymqyzrofydrvtzo' -or $ledger.stage -ne 'cleaned' -or
      $report.cleanup.residueZero -ne $true -or $report.cleanup.inventoryRestored -ne $true -or
      $null -ne $report.cleanupError -or $report.finalChecks.migrationDryRun -ne 'up to date' -or
      $report.finalChecks.schemaLint -ne 'no errors' -or
      (ConvertTo-Json -InputObject $ledger.baseline -Depth 20 -Compress) -ne
      (ConvertTo-Json -InputObject $ledger.finalInventory -Depth 20 -Compress)) {
    throw 'El cleanup o baseline del run anterior no está acreditado; STOP.'
  }
  foreach ($kind in $ledger.owned.PSObject.Properties.Name) {
    $owned = @(($ledger.owned.$kind) | Sort-Object)
    $cleaned = @(($ledger.cleanup.$kind) | Sort-Object)
    if (($owned -join ',') -ne ($cleaned -join ',')) {
      throw "El cleanup de $kind no coincide con el ledger; STOP."
    }
  }
  $caPath = Join-Path $env:USERPROFILE 'Downloads\supabase-dev-ca.crt.crt'
  if (-not (Test-Path -LiteralPath $caPath -PathType Leaf) -or
      (Get-FileHash -LiteralPath $caPath -Algorithm SHA256).Hash -ne
      '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7') {
    throw 'El certificado CA Supabase DEV no coincide con el validado; STOP.'
  }

  & node --test .\scripts\task009-gate-d\dev-connection.node-test.mjs
  if ($LASTEXITCODE -ne 0) { throw 'La regresión de precisión timestamptz falló; STOP.' }
  $securePassword = Read-Host 'Contraseña PostgreSQL DEV preexistente' -AsSecureString

  $manifest = @{}
  foreach ($file in Get-ChildItem -LiteralPath $stateRoot -Recurse -File -Force) {
    $relative = $file.FullName.Substring($stateRoot.Length + 1)
    $manifest[$relative] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
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
  New-Item -ItemType Directory -Path $stateRoot | Out-Null
  Copy-Item -LiteralPath (Join-Path $archiveTarget 'manual-baseline.json') -Destination $manualPath
  if ((Get-FileHash -LiteralPath $manualPath -Algorithm SHA256).Hash -ne $manifest['manual-baseline.json']) {
    throw 'El baseline nuevo difiere del aprobado; STOP antes de DEV.'
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
  & node .\scripts\task009-gate-d\run.mjs
  if ($LASTEXITCODE -ne 0) {
    throw 'Gate D se detuvo. No reintentar: conservar el nuevo ledger y run-report.json.'
  }

  $newLedger = Get-Content -LiteralPath (Join-Path $stateRoot 'fixture-ledger.json') -Raw | ConvertFrom-Json
  $newReport = Get-Content -LiteralPath (Join-Path $stateRoot 'run-report.json') -Raw | ConvertFrom-Json
  if ($newLedger.runId -eq $previousRunId -or $newLedger.runId -ne $newReport.runId -or
      $newLedger.projectRef -ne 'ehllxymqyzrofydrvtzo' -or $newLedger.stage -ne 'cleaned' -or
      $newReport.status -ne 'EXECUTION_PASS' -or
      $newReport.integrationPassed -ne $true -or $newReport.browserPassed -ne $true -or
      $newReport.cleanupResult.residueZero -ne $true -or
      $newReport.cleanupResult.inventoryRestored -ne $true -or
      $null -ne $newReport.stoppedReason -or $null -ne $newReport.cleanupStoppedReason -or
      $null -eq $newReport.finalChecks -or
      (ConvertTo-Json -InputObject $newLedger.baseline -Depth 20 -Compress) -ne
      (ConvertTo-Json -InputObject $newLedger.finalInventory -Depth 20 -Compress)) {
    throw 'El informe nuevo no acredita integración, navegador y cleanup; STOP sin reintentar.'
  }
  foreach ($kind in $newLedger.owned.PSObject.Properties.Name) {
    if ((@($newLedger.owned.$kind | Sort-Object) -join ',') -ne
        (@($newLedger.cleanup.$kind | Sort-Object) -join ',')) {
      throw "El residuo de $kind no coincide con el ledger nuevo; STOP."
    }
  }
  Write-Output "TASK009_NEW_RUN_EXECUTION_PASS runId=$($newLedger.runId); report=$stateRoot\run-report.json"
} finally {
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  Remove-Variable securePassword -ErrorAction SilentlyContinue
  if ($null -eq $previousCa) {
    Remove-Item Env:NODE_EXTRA_CA_CERTS -ErrorAction SilentlyContinue
  } else {
    $env:NODE_EXTRA_CA_CERTS = $previousCa
  }
}
