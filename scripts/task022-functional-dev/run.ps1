param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('local', 'preflight', 'run', 'reconcile', 'cleanup', 'focused-local', 'focused-run', 'focused-reconcile', 'focused-cleanup', 'final-local', 'final-run', 'final-reconcile', 'final-cleanup', 'closure-local', 'closure-run', 'closure-reconcile', 'closure-cleanup')]
  [string]$Mode,
  [string]$ConfirmProjectRef = '',
  [string]$ConfirmRunId = ''
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $projectRoot

if ($Mode -in @('run', 'cleanup', 'focused-run', 'focused-cleanup', 'final-run', 'final-cleanup', 'closure-run', 'closure-cleanup') -and $ConfirmProjectRef -ne 'ehllxymqyzrofydrvtzo') {
  throw 'STOP TASK-022: confirmá explícitamente el project ref DEV.'
}
if ($Mode -in @('focused-run', 'focused-cleanup', 'final-run', 'final-cleanup', 'closure-run', 'closure-cleanup') -and -not $ConfirmRunId) {
  throw 'STOP TASK-022: confirmá explícitamente el runId focal.'
}

if ($Mode -in @('local', 'focused-local', 'final-local', 'closure-local')) {
  & node .\scripts\task022-functional-dev\gate.mjs $Mode
  if ($LASTEXITCODE -ne 0) { throw 'STOP TASK-022: control local falló.' }
  return
}

$caPath = Join-Path $env:USERPROFILE 'Downloads\supabase-dev-ca.crt.crt'
$expectedCaSha256 = '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7'
if (-not (Test-Path -LiteralPath $caPath -PathType Leaf) -or
    (Get-FileHash -LiteralPath $caPath -Algorithm SHA256).Hash -ne $expectedCaSha256) {
  throw 'STOP TASK-022: CA DEV validada ausente o diferente.'
}

$previousPassword = [Environment]::GetEnvironmentVariable('SUPABASE_DB_PASSWORD', 'Process')
$previousKey = [Environment]::GetEnvironmentVariable('SUPABASE_SECRET_KEY', 'Process')
$previousCa = [Environment]::GetEnvironmentVariable('NODE_EXTRA_CA_CERTS', 'Process')
$previousWrite = [Environment]::GetEnvironmentVariable('TASK022_FUNCTIONAL_DEV_WRITE_AUTHORIZATION', 'Process')
$previousCleanup = [Environment]::GetEnvironmentVariable('TASK022_FUNCTIONAL_DEV_CLEANUP_AUTHORIZATION', 'Process')
$previousRunId = [Environment]::GetEnvironmentVariable('TASK022_FOCUSED_RUN_ID', 'Process')
$passwordBstr = [IntPtr]::Zero
$keyBstr = [IntPtr]::Zero
try {
  $securePassword = Read-Host 'Contraseña PostgreSQL DEV preexistente' -AsSecureString
  $passwordBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $env:SUPABASE_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordBstr)
  $env:NODE_EXTRA_CA_CERTS = $caPath
  if ($Mode -in @('focused-run', 'focused-cleanup', 'final-run', 'final-cleanup', 'closure-run', 'closure-cleanup') -or
      ($Mode -in @('run', 'cleanup') -and -not $env:SUPABASE_SECRET_KEY)) {
    $secureKey = Read-Host 'Secret key DEV para Auth Admin (sólo fixtures)' -AsSecureString
    $keyBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $env:SUPABASE_SECRET_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyBstr)
  }
  if ($Mode -in @('run', 'focused-run', 'final-run', 'closure-run')) { $env:TASK022_FUNCTIONAL_DEV_WRITE_AUTHORIZATION = $ConfirmProjectRef }
  if ($Mode -in @('cleanup', 'focused-cleanup', 'final-cleanup', 'closure-cleanup')) { $env:TASK022_FUNCTIONAL_DEV_CLEANUP_AUTHORIZATION = $ConfirmProjectRef }
  if ($Mode -in @('focused-run', 'focused-cleanup', 'final-run', 'final-cleanup', 'closure-run', 'closure-cleanup')) { $env:TASK022_FOCUSED_RUN_ID = $ConfirmRunId }
  & node .\scripts\task022-functional-dev\gate.mjs $Mode
  if ($LASTEXITCODE -ne 0) { throw "STOP TASK-022: $Mode falló. Conservá el ledger y no reintentes escrituras automáticamente." }
} finally {
  if ($passwordBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordBstr) }
  if ($keyBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyBstr) }
  Remove-Variable securePassword, secureKey -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_DB_PASSWORD, Env:SUPABASE_SECRET_KEY, Env:NODE_EXTRA_CA_CERTS, Env:TASK022_FUNCTIONAL_DEV_WRITE_AUTHORIZATION, Env:TASK022_FUNCTIONAL_DEV_CLEANUP_AUTHORIZATION, Env:TASK022_FOCUSED_RUN_ID -ErrorAction SilentlyContinue
  if ($null -ne $previousPassword) { $env:SUPABASE_DB_PASSWORD = $previousPassword }
  if ($null -ne $previousKey) { $env:SUPABASE_SECRET_KEY = $previousKey }
  if ($null -ne $previousCa) { $env:NODE_EXTRA_CA_CERTS = $previousCa }
  if ($null -ne $previousWrite) { $env:TASK022_FUNCTIONAL_DEV_WRITE_AUTHORIZATION = $previousWrite }
  if ($null -ne $previousCleanup) { $env:TASK022_FUNCTIONAL_DEV_CLEANUP_AUTHORIZATION = $previousCleanup }
  if ($null -ne $previousRunId) { $env:TASK022_FOCUSED_RUN_ID = $previousRunId }
}
