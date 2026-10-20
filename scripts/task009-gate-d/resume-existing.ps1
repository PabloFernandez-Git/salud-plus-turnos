$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $projectRoot
$previousCa = [Environment]::GetEnvironmentVariable('NODE_EXTRA_CA_CERTS', 'Process')

try {

$expectedRunId = 'f943fe75-0cd4-46b1-814e-f92ef8f8066f'
$stateRoot = Join-Path $projectRoot '.task009-gate-d'
$ledgerPath = Join-Path $stateRoot 'fixture-ledger.json'
$tempLedgerPath = Join-Path $stateRoot 'fixture-ledger.json.tmp'
$oldReportPath = Join-Path $stateRoot 'run-report.json'
$markerPath = Join-Path $stateRoot 'recovery-run-started.json'
$recoveryReportPath = Join-Path $stateRoot 'recovery-report.json'

if ((Test-Path -LiteralPath $markerPath) -or (Test-Path -LiteralPath $recoveryReportPath)) {
  throw 'La recuperación ya comenzó o terminó. No repetir el launcher; inspeccionar el reporte y el ledger.'
}
foreach ($path in @($ledgerPath, $tempLedgerPath, $oldReportPath)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Falta evidencia original: $path"
  }
}
$ledger = Get-Content -LiteralPath $ledgerPath -Raw | ConvertFrom-Json
$temporary = Get-Content -LiteralPath $tempLedgerPath -Raw | ConvertFrom-Json
$oldReport = Get-Content -LiteralPath $oldReportPath -Raw | ConvertFrom-Json
if ($ledger.runId -ne $expectedRunId -or $temporary.runId -ne $expectedRunId -or
    $oldReport.runId -ne $expectedRunId -or $ledger.stage -ne 'creating' -or
    $temporary.stage -ne 'creating') {
  throw 'RunId o estado local distinto del run autorizado; STOP.'
}

$caPath = Join-Path $env:USERPROFILE 'Downloads\supabase-dev-ca.crt.crt'
$expectedCaSha256 = '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7'
if (-not (Test-Path -LiteralPath $caPath -PathType Leaf)) {
  throw 'No se encontró el certificado CA Supabase DEV previamente validado.'
}
if ((Get-FileHash -LiteralPath $caPath -Algorithm SHA256).Hash -ne $expectedCaSha256) {
  throw 'La huella del certificado CA cambió; STOP.'
}

  $securePassword = Read-Host 'Contraseña PostgreSQL DEV preexistente' -AsSecureString
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
  & node .\scripts\task009-gate-d\resume-existing.mjs
  if ($LASTEXITCODE -ne 0) {
    throw 'La recuperación se detuvo. Preservar ledger, temporales y recovery-report.json.'
  }
} finally {
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  if ($null -eq $previousCa) {
    Remove-Item Env:NODE_EXTRA_CA_CERTS -ErrorAction SilentlyContinue
  } else {
    $env:NODE_EXTRA_CA_CERTS = $previousCa
  }
}
