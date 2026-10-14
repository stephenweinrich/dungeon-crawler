<#
.SYNOPSIS
  Deploys the committed game to the Azure App Service.

.DESCRIPTION
  Builds a zip of exactly what is committed (git archive), so uncommitted work,
  .env, player saves and bug reports are never uploaded, then pushes it with
  `az webapp deploy`. The deploy is NOT a clean one (--clean false): the live
  server's runtime files (data/slot-*.json saves, data/feedback.json reports)
  survive. Note the flip side: data files that are in git (items.json, mobs.json,
  npcs.json, map-level*.json) ARE overwritten by the committed versions, so edits
  made through the live admin editor are lost unless you commit them.

  Run:   npm run deploy          (or:  .\deploy.ps1)
  Flags: -DryRun        build the zip and run checks, upload nothing
         -SyncSettings  also store ADMIN_PASSWORD / OPENAI_* from your local .env in
                        Azure Key Vault and link the app to them (never printed)
         -Force         skip the "not on main / not pushed" safety checks

  Needs: Azure CLI (`az login` done) and git.
#>
[CmdletBinding()]
param(
  [string]$AppName = 'dungeon-crawler-sw',
  [string]$ResourceGroup = 'rg-dungeon-crawler',
  [switch]$SyncSettings,
  [switch]$DryRun,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

# ---- checks ----------------------------------------------------------------
foreach ($tool in 'git', 'az') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Fail "$tool is not installed or not on PATH." }
}

Step 'Checking git state'
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$dirty = git status --porcelain --untracked-files=no
if ($dirty) {
  Write-Host $dirty
  Fail 'Uncommitted changes to tracked files. Commit them first: only committed work is deployed.'
}
if (-not $Force) {
  if ($branch -ne 'main') { Fail "You are on '$branch', not main. Switch to main or pass -Force." }
  git fetch origin main --quiet
  $unpushed = (git rev-list --count origin/main..HEAD).Trim()
  if ([int]$unpushed -gt 0) { Fail "$unpushed commit(s) are not pushed to origin/main yet. Run 'git push' first or pass -Force." }
}
$sha = (git rev-parse --short HEAD).Trim()

if (-not $DryRun) {
  Step 'Checking Azure login'
  $acct = az account show --query name -o tsv 2>$null
  if (-not $acct) { Fail "Not logged in to Azure. Run 'az login'." }
  Write-Host "    subscription: $acct"
}

# ---- build the package -----------------------------------------------------
$zip = Join-Path ([System.IO.Path]::GetTempPath()) "dungeon-crawler-$sha.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Step "Packaging commit $sha"
git archive --format=zip --output="$zip" HEAD
if ($LASTEXITCODE -ne 0) { Fail 'git archive failed.' }
Write-Host ('    {0:N1} MB -> {1}' -f ((Get-Item $zip).Length / 1MB), $zip)

if ($DryRun) { Write-Host 'Dry run: nothing uploaded.' -ForegroundColor Yellow; exit 0 }

# ---- secrets (optional) ----------------------------------------------------
if ($SyncSettings) {
  Step 'Syncing secrets to Key Vault (see setup-secrets.ps1)'
  & "$PSScriptRootsetup-secrets.ps1" -AppName $AppName -ResourceGroup $ResourceGroup
  if ($LASTEXITCODE -ne 0) { Fail 'setup-secrets.ps1 failed.' }
}

# ---- deploy ----------------------------------------------------------------
Step "Deploying to $AppName ($ResourceGroup)"
az webapp deploy --name $AppName --resource-group $ResourceGroup --src-path $zip --type zip --clean false --restart true --track-status false
# --track-status false skips the CLI's own runtime-status polling (it can fail on a dropped
# connection even though the upload succeeded); the smoke test below is the real check.
if ($LASTEXITCODE -ne 0) { Fail 'az webapp deploy failed.' }
Remove-Item $zip -Force -ErrorAction SilentlyContinue

# ---- smoke test ------------------------------------------------------------
$hostName = az webapp show --name $AppName --resource-group $ResourceGroup --query defaultHostName -o tsv
$siteUrl = "https://$hostName/"
Step "Waiting for $siteUrl"
$ok = $false
for ($i = 0; $i -lt 18; $i++) {
  try {
    $r = Invoke-WebRequest -Uri $siteUrl -UseBasicParsing -TimeoutSec 20
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { }
  Start-Sleep -Seconds 5
}
if (-not $ok) { Fail "Deployed, but $siteUrl did not return 200 within 90s. Check: az webapp log tail -n $AppName -g $ResourceGroup" }

# the admin editor must be locked down in production
try {
  $login = Invoke-WebRequest -Uri ($siteUrl + 'api/admin/login') -Method Post -Body '{"password":"x"}' -UseBasicParsing -ErrorAction Stop
  $adminState = "enabled ($($login.StatusCode))"
} catch {
  $code = [int]$_.Exception.Response.StatusCode
  $adminState = if ($code -eq 503) { 'disabled (set ADMIN_PASSWORD to use it)' } elseif ($code -eq 401) { 'enabled (password required)' } else { "HTTP $code" }
}

Write-Host "Deployed $sha -> $siteUrl" -ForegroundColor Green
Write-Host "    admin editor: $adminState"
