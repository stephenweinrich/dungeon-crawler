<#
.SYNOPSIS
  Puts the game's secrets in Azure Key Vault and points the App Service at them.

.DESCRIPTION
  Safe to re-run; run it again whenever you change a value in .env.
    1. Creates the Key Vault if it doesn't exist (RBAC mode).
    2. Gives the web app a managed identity and the "Key Vault Secrets User" role
       on the vault, so it can read (not write) secrets.
    3. Gives YOU the "Key Vault Secrets Officer" role so you can store secrets.
    4. Stores ADMIN_PASSWORD and OPENAI_API_KEY from your local .env as vault secrets.
    5. Sets the app settings ADMIN_PASSWORD / OPENAI_API_KEY to Key Vault
       references (@Microsoft.KeyVault(...)), so the real values never sit in the
       app's configuration. Non-secret OPENAI_* options become plain app settings.
  Secret values are never printed.

  Run:  .\setup-secrets.ps1     (or: npm run secrets,  or: npm run deploy -- -SyncSettings)
#>
[CmdletBinding()]
param(
  [string]$AppName = 'dungeon-crawler-sw',
  [string]$ResourceGroup = 'rg-dungeon-crawler',
  [string]$VaultName = 'kv-dungeon-crawler-sw',
  [string]$Location = 'centralus'
)

$ErrorActionPreference = 'Continue'  # native az errors are handled via $LASTEXITCODE below
Set-Location $PSScriptRoot
function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

if (-not (Get-Command az -ErrorAction SilentlyContinue)) { Fail 'Azure CLI (az) is not installed.' }
if (-not (az account show --query id -o tsv 2>$null)) { Fail "Not logged in to Azure. Run 'az login'." }

# ---- read .env (values stay in memory) -------------------------------------
$secretKeys = 'ADMIN_PASSWORD', 'OPENAI_API_KEY'                                   # -> Key Vault
$plainKeys = 'OPENAI_IMAGE_MODEL', 'OPENAI_IMAGE_QUALITY', 'OPENAI_TEXT_MODEL'     # -> plain app settings
$env = @{}
if (Test-Path .env) {
  foreach ($line in Get-Content .env) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
      $v = $Matches[2].Trim('"').Trim("'")
      if ($v) { $env[$Matches[1]] = $v }
    }
  }
}
$secrets = $secretKeys | Where-Object { $env.ContainsKey($_) }
if (-not $secrets) { Fail 'No ADMIN_PASSWORD or OPENAI_API_KEY with a value in .env - nothing to store.' }

# ---- vault ------------------------------------------------------------------
Step "Key Vault '$VaultName'"
$vaultId = az keyvault show --name $VaultName --resource-group $ResourceGroup --query id -o tsv 2>$null
if (-not $vaultId) {
  az keyvault create --name $VaultName --resource-group $ResourceGroup --location $Location --enable-rbac-authorization true --output none
  if ($LASTEXITCODE -ne 0) { Fail "Could not create the vault (the name '$VaultName' must be globally unique - pass -VaultName)." }
  $vaultId = az keyvault show --name $VaultName --resource-group $ResourceGroup --query id -o tsv
  Write-Host '    created'
} else { Write-Host '    exists' }

# ---- identities and roles ----------------------------------------------------
Step 'Granting access'
$principal = az webapp identity assign --name $AppName --resource-group $ResourceGroup --query principalId -o tsv
if (-not $principal) { Fail 'Could not enable the web app managed identity.' }
$me = az ad signed-in-user show --query id -o tsv
function Grant($objectId, $type, $role) {
  $have = az role assignment list --assignee $objectId --role $role --scope $vaultId --query '[0].id' -o tsv 2>$null
  if (-not $have) {
    az role assignment create --assignee-object-id $objectId --assignee-principal-type $type --role $role --scope $vaultId --output none
    if ($LASTEXITCODE -ne 0) { Fail "Could not grant '$role'." }
    Write-Host "    granted $role"
  } else { Write-Host "    has $role" }
}
Grant $principal 'ServicePrincipal' 'Key Vault Secrets User'
Grant $me 'User' 'Key Vault Secrets Officer'

# ---- store the secrets -------------------------------------------------------
Step 'Storing secrets (values hidden)'
foreach ($key in $secrets) {
  $name = $key.Replace('_', '-')   # Key Vault names allow letters, digits and dashes only
  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) "kv-$([guid]::NewGuid()).txt"
  [System.IO.File]::WriteAllText($tmp, $env[$key])   # no trailing newline; keeps the value off the command line
  try {
    $done = $false
    for ($try = 1; $try -le 12 -and -not $done; $try++) {   # new role assignments take a minute to take effect
      az keyvault secret set --vault-name $VaultName --name $name --file $tmp --output none 2>$null
      if ($LASTEXITCODE -eq 0) { $done = $true } else { Write-Host "    waiting for the role to take effect ($try)..."; Start-Sleep -Seconds 10 }
    }
    if (-not $done) { Fail "Could not store secret $name." }
    Write-Host "    stored $name"
  } finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
}

# ---- app settings -----------------------------------------------------------
Step 'Pointing the app at the vault'
$settings = [ordered]@{}
foreach ($key in $secrets) {
  $name = $key.Replace('_', '-')
  $settings[$key] = "@Microsoft.KeyVault(VaultName=$VaultName;SecretName=$name)"
}
foreach ($key in $plainKeys) { if ($env.ContainsKey($key)) { $settings[$key] = $env[$key] } }
# via a JSON file: the az.cmd wrapper on Windows mangles the parentheses / semicolons in a reference
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "dc-settings-$([guid]::NewGuid()).json"
try {
  ($settings | ConvertTo-Json) | Set-Content -Path $tmp -Encoding utf8
  az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings "@$tmp" --output none
  if ($LASTEXITCODE -ne 0) { Fail 'Could not set the app settings.' }
} finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
Write-Host ('    ' + ($settings.Keys -join ', '))

# ---- verify the references resolve -------------------------------------------
Step 'Checking the references resolve'
$sub = az account show --query id -o tsv
$uri = "https://management.azure.com/subscriptions/$sub/resourceGroups/$ResourceGroup/providers/Microsoft.Web/sites/$AppName/config/configreferences/appsettings?api-version=2022-03-01"
$ok = $false
for ($i = 0; $i -lt 12 -and -not $ok; $i++) {
  $status = az rest --method get --uri $uri --query "value[].{name:name, status:properties.status}" -o json | ConvertFrom-Json
  $bad = @($status | Where-Object { $_.status -ne 'Resolved' })
  if ($status -and -not $bad) { $ok = $true } else { Start-Sleep -Seconds 10 }
}
foreach ($s in $status) { Write-Host ("    {0}: {1}" -f $s.name, $s.status) }
if (-not $ok) { Write-Host 'Some references are not resolved yet. Wait a minute and re-run, or check the app identity roles.' -ForegroundColor Yellow; exit 1 }
Write-Host 'Done. The app restarts on its own to pick the settings up.' -ForegroundColor Green
