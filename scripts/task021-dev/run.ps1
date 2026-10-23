param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('local', 'preflight', 'apply')]
  [string]$Mode,
  [string]$ConfirmProjectRef = '',
  [string]$CaPath = (Join-Path $env:USERPROFILE 'Downloads\supabase-dev-ca.crt.crt')
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $root
$expectedRef = 'ehllxymqyzrofydrvtzo'
if ($Mode -ne 'local' -and $ConfirmProjectRef -cne $expectedRef) {
  throw 'STOP TASK-021: confirmar exactamente el project ref de salud-plus-turnos-dev.'
}
if ($Mode -ne 'local') {
  $expectedCaHash = '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7'
  if (-not (Test-Path -LiteralPath $CaPath -PathType Leaf) -or
      (Get-FileHash -LiteralPath $CaPath -Algorithm SHA256).Hash -cne $expectedCaHash) {
    throw 'STOP TASK-021: CA DEV ausente o SHA-256 distinto.'
  }
}
$priorPassword = [Environment]::GetEnvironmentVariable('TASK021_DEV_DB_PASSWORD', 'Process')
$priorCa = [Environment]::GetEnvironmentVariable('TASK021_DEV_CA_PATH', 'Process')
$priorRef = [Environment]::GetEnvironmentVariable('TASK021_DEV_CONFIRM_REF', 'Process')
$bstr = [IntPtr]::Zero
try {
  if ($Mode -ne 'local') {
    $secure = Read-Host 'Contraseña PostgreSQL DEV' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $env:TASK021_DEV_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $env:TASK021_DEV_CA_PATH = (Resolve-Path -LiteralPath $CaPath).Path
    $env:TASK021_DEV_CONFIRM_REF = $ConfirmProjectRef
  }
  & node .\scripts\task021-dev\gate.mjs $Mode
  if ($LASTEXITCODE -ne 0) {
    throw "STOP TASK-021: Gate A $Mode falló. No repetir apply; inspeccionar el historial y catálogo sólo en lectura."
  }
} finally {
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  Remove-Variable secure -ErrorAction SilentlyContinue
  Remove-Item Env:TASK021_DEV_DB_PASSWORD, Env:TASK021_DEV_CA_PATH, Env:TASK021_DEV_CONFIRM_REF -ErrorAction SilentlyContinue
  if ($null -ne $priorPassword) { $env:TASK021_DEV_DB_PASSWORD = $priorPassword }
  if ($null -ne $priorCa) { $env:TASK021_DEV_CA_PATH = $priorCa }
  if ($null -ne $priorRef) { $env:TASK021_DEV_CONFIRM_REF = $priorRef }
}
