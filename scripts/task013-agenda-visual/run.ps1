param(
  [switch]$AuthorizedDevWrite,
  [switch]$Recover,
  [switch]$BrowserCredential
)

$ErrorActionPreference = 'Stop'
if (-not $AuthorizedDevWrite) { throw 'Falta autorización explícita para escribir en Supabase DEV.' }
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$previousDirectory = (Get-Location).Path
$previousCa = [Environment]::GetEnvironmentVariable('NODE_EXTRA_CA_CERTS', 'Process')
$previousPassword = [Environment]::GetEnvironmentVariable('SUPABASE_DB_PASSWORD', 'Process')
$previousAuthorization = [Environment]::GetEnvironmentVariable('TASK013_DEV_WRITE_AUTHORIZATION', 'Process')

try {
  Set-Location -LiteralPath $projectRoot
  $caPath = Join-Path $env:USERPROFILE 'Downloads\supabase-dev-ca.crt.crt'
  if (-not (Test-Path -LiteralPath $caPath -PathType Leaf) -or
      (Get-FileHash -LiteralPath $caPath -Algorithm SHA256).Hash -ne
      '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7') {
    throw 'La CA de Supabase DEV no coincide con la validada; STOP.'
  }
  $env:NODE_EXTRA_CA_CERTS = $caPath
  $env:TASK013_DEV_WRITE_AUTHORIZATION = 'TASK-013-VISUAL-DEV-APPROVED'
  $mode = if ($Recover) { '--recover' } else { '--execute' }
  if ($BrowserCredential) {
    & node .\scripts\task013-agenda-visual\browser-credential.mjs $mode
  } else {
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
    & node .\scripts\task013-agenda-visual\run.mjs $mode
  }
  if ($LASTEXITCODE -ne 0) {
    if (Test-Path -LiteralPath '.harness/tasks/archive/TASK-013/validation-ledger.json' -PathType Leaf) {
      throw 'TASK-013 se detuvo. Conservar validation-ledger.json y evidencia; usar -Recover sólo tras inspección.'
    }
    throw 'TASK-013 se detuvo antes de crear el ledger; no hubo fixtures.'
  }
} finally {
  if ($null -eq $previousPassword) { Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue }
  else { $env:SUPABASE_DB_PASSWORD = $previousPassword }
  if ($null -eq $previousCa) { Remove-Item Env:NODE_EXTRA_CA_CERTS -ErrorAction SilentlyContinue }
  else { $env:NODE_EXTRA_CA_CERTS = $previousCa }
  if ($null -eq $previousAuthorization) { Remove-Item Env:TASK013_DEV_WRITE_AUTHORIZATION -ErrorAction SilentlyContinue }
  else { $env:TASK013_DEV_WRITE_AUTHORIZATION = $previousAuthorization }
  Set-Location -LiteralPath $previousDirectory
}
