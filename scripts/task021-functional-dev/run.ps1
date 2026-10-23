param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('local','preflight','run','reconcile','cleanup')]
  [string]$Mode,
  [string]$ConfirmProjectRef = '',
  [string]$RunId = '',
  [string]$CaPath = (Join-Path $env:USERPROFILE 'Downloads\supabase-dev-ca.crt.crt')
)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $root
$ref='ehllxymqyzrofydrvtzo'
if($Mode -ne 'local' -and $ConfirmProjectRef -cne $ref){throw 'STOP TASK-021: project ref DEV incorrecto.'}
if($Mode -in @('reconcile','cleanup') -and $RunId -notmatch '^[0-9a-fA-F-]{36}$'){throw 'STOP TASK-021: runId requerido.'}
if($Mode -ne 'local'){
  $expectedCa='700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7'
  if(-not (Test-Path -LiteralPath $CaPath -PathType Leaf) -or
      (Get-FileHash -LiteralPath $CaPath -Algorithm SHA256).Hash -cne $expectedCa){
    throw 'STOP TASK-021: CA DEV ausente o SHA-256 distinto.'
  }
}
$names=@('TASK021_DEV_DB_PASSWORD','TASK021_DEV_CA_PATH','TASK021_DEV_CONFIRM_REF','TASK021_DEV_SECRET_KEY','TASK021_DEV_PUBLISHABLE_KEY','TASK021_DEV_WRITE_REF','TASK021_DEV_CLEANUP_REF','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
$prior=@{}
foreach($name in $names){$prior[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
$dbBstr=[IntPtr]::Zero
$keyBstr=[IntPtr]::Zero
$publishBstr=[IntPtr]::Zero
try{
  if($Mode -ne 'local'){
    $secureDb=Read-Host 'Contraseña PostgreSQL DEV' -AsSecureString
    $dbBstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureDb)
    $env:TASK021_DEV_DB_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($dbBstr)
    $env:TASK021_DEV_CA_PATH=(Resolve-Path -LiteralPath $CaPath).Path
    $env:TASK021_DEV_CONFIRM_REF=$ConfirmProjectRef
  }
  if($Mode -in @('run','cleanup')){
    $secureKey=Read-Host 'Secret key DEV para Auth Admin de fixtures' -AsSecureString
    $keyBstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $env:TASK021_DEV_SECRET_KEY=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyBstr)
  }
  if($Mode -eq 'run'){
    $securePublish=Read-Host 'Publishable key DEV para sesiones autenticadas' -AsSecureString
    $publishBstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePublish)
    $env:TASK021_DEV_PUBLISHABLE_KEY=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($publishBstr)
    $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$env:TASK021_DEV_PUBLISHABLE_KEY
    $env:TASK021_DEV_WRITE_REF=$ConfirmProjectRef
  }
  if($Mode -eq 'cleanup'){$env:TASK021_DEV_CLEANUP_REF=$ConfirmProjectRef}
  $argsForNode=@($Mode)
  if($Mode -in @('reconcile','cleanup')){$argsForNode+= $RunId}
  & node .\scripts\task021-functional-dev\gate.mjs @argsForNode
  if($LASTEXITCODE -ne 0){throw "STOP TASK-021: Gate B $Mode falló. Conservar ledger y no reintentar escrituras ambiguas."}
}finally{
  foreach($pointer in @($dbBstr,$keyBstr,$publishBstr)){
    if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
  }
  Remove-Variable secureDb,secureKey,securePublish -ErrorAction SilentlyContinue
  foreach($name in $names){
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    if($null -ne $prior[$name]){[Environment]::SetEnvironmentVariable($name,$prior[$name],'Process')}
  }
}
