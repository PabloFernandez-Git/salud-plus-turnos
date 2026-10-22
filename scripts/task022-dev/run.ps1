param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('preflight', 'apply')]
  [string]$Mode
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $projectRoot

$caPath = Join-Path $env:USERPROFILE 'Downloads\supabase-dev-ca.crt.crt'
$expectedCaSha256 = '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7'
if (-not (Test-Path -LiteralPath $caPath -PathType Leaf) -or
    (Get-FileHash -LiteralPath $caPath -Algorithm SHA256).Hash -ne $expectedCaSha256) {
  throw 'STOP TASK-022: falta la CA DEV validada o cambió su SHA-256.'
}

$previousPassword = [Environment]::GetEnvironmentVariable('SUPABASE_DB_PASSWORD', 'Process')
$previousCa = [Environment]::GetEnvironmentVariable('NODE_EXTRA_CA_CERTS', 'Process')
$securePassword = Read-Host 'Contraseña PostgreSQL DEV preexistente' -AsSecureString
$passwordBstr = [IntPtr]::Zero
try {
  $passwordBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $env:SUPABASE_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordBstr)
  $env:NODE_EXTRA_CA_CERTS = $caPath
  & node .\scripts\task022-dev\gate.mjs $Mode
  if ($LASTEXITCODE -ne 0) {
    throw "STOP TASK-022: $Mode falló. No repetir apply sin inspeccionar el estado remoto."
  }
} finally {
  if ($passwordBstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordBstr)
  }
  Remove-Variable securePassword -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:NODE_EXTRA_CA_CERTS -ErrorAction SilentlyContinue
  if ($null -ne $previousPassword) { $env:SUPABASE_DB_PASSWORD = $previousPassword }
  if ($null -ne $previousCa) { $env:NODE_EXTRA_CA_CERTS = $previousCa }
}
