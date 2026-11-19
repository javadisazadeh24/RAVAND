<#
  Ravand (روند) one-click installer for Windows.
  - Installs Node.js and PostgreSQL automatically with winget when missing.
  - Creates the PostgreSQL role/database, writes .env, runs migrations, builds the app.
  - Creates desktop + startup shortcuts and starts the server.

  Run through Ravand-Setup.exe (recommended) or:
    powershell -NoProfile -ExecutionPolicy Bypass -File installer\install.ps1
#>
[CmdletBinding()]
param(
  [string]$PgPassword,
  [string]$DbPassword,
  [int]$PgPort = 5432,
  [int]$Port = 3000,
  [switch]$NoStart,
  [switch]$NoAutostart,
  [switch]$NoShortcuts,
  [switch]$SkipAdminCheck,
  [switch]$Pause
)

$ErrorActionPreference = 'Stop'
$script:Root = Split-Path -Parent $PSScriptRoot
$script:PgPort = $PgPort
$script:LogPath = Join-Path $script:Root 'install.log'
$script:Brand = -join ([char]0x0631, [char]0x0648, [char]0x0646, [char]0x062F)  # روند

function Step([string]$Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Ok([string]$Message) { Write-Host "    $Message" -ForegroundColor Green }
function Warn([string]$Message) { Write-Host "    $Message" -ForegroundColor Yellow }
function Die([string]$Message) { throw [System.Exception]::new($Message) }

function New-HexSecret([int]$Bytes = 18) {
  $buffer = New-Object byte[] $Bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return (-join ($buffer | ForEach-Object { $_.ToString('x2') }))
}
function New-Base64Secret([int]$Bytes = 32) {
  $buffer = New-Object byte[] $Bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return [Convert]::ToBase64String($buffer)
}

function Get-DotEnvValue([string]$Key) {
  $file = Join-Path $script:Root '.env'
  if (-not (Test-Path $file)) { return $null }
  foreach ($line in Get-Content -LiteralPath $file) {
    if ($line -match "^\s*$([regex]::Escape($Key))\s*=\s*(.*)$") {
      $value = $Matches[1].Trim()
      if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      return $value
    }
  }
  return $null
}

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user"
}

function Find-NodeExe {
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $pf = [Environment]::GetFolderPath('ProgramFiles')
  $pf86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
  $local = [Environment]::GetFolderPath('LocalApplicationData')
  $candidates = @(
    (Join-Path $pf 'nodejs\node.exe'),
    (Join-Path $pf86 'nodejs\node.exe'),
    (Join-Path $local 'Programs\nodejs\node.exe')
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
  }
  return $null
}

function Find-PgBin {
  $cmd = Get-Command psql.exe -ErrorAction SilentlyContinue
  if ($cmd) { return (Split-Path -Parent $cmd.Source) }
  $base = Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'PostgreSQL'
  if (Test-Path -LiteralPath $base) {
    $dirs = Get-ChildItem -LiteralPath $base -Directory | Sort-Object Name -Descending
    foreach ($dir in $dirs) {
      $psql = Join-Path $dir.FullName 'bin\psql.exe'
      if (Test-Path -LiteralPath $psql) { return (Split-Path -Parent $psql) }
    }
  }
  return $null
}

function Invoke-Psql([string]$Database, [string]$Sql) {
  $output = & (Join-Path $script:PgBin 'psql.exe') -X -h 127.0.0.1 -p $script:PgPort -U postgres -d $Database -v ON_ERROR_STOP=1 -tAc $Sql 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw [System.Exception]::new("psql failed: $($output -join ' ')")
  }
  return (($output | ForEach-Object { "$_" }) -join "`n").Trim()
}

function Test-PgLogin {
  $env:PGPASSWORD = $script:PgPassword
  $null = & (Join-Path $script:PgBin 'psql.exe') -X -h 127.0.0.1 -p $script:PgPort -U postgres -d postgres -tAc 'SELECT 1' 2>&1
  return ($LASTEXITCODE -eq 0)
}

function New-Shortcut([string]$ShortcutPath, [string]$Arguments = '') {
  $launcher = Join-Path $script:Root 'Ravand.exe'
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  if (Test-Path -LiteralPath $launcher) {
    $shortcut.TargetPath = $launcher
    $shortcut.Arguments = $Arguments
    $shortcut.IconLocation = "$launcher,0"
  } else {
    $shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
    $shortcut.Arguments = "`"$(Join-Path $script:Root 'start-ravand.vbs')`""
    $shortcut.IconLocation = "$(Join-Path $env:WINDIR 'System32\SHELL32.dll'),13"
  }
  $shortcut.WorkingDirectory = $script:Root
  $shortcut.Description = "$script:Brand - Management System"
  $shortcut.Save()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
}

$exitCode = 0
try {
  try { Start-Transcript -Path $script:LogPath -Force | Out-Null } catch {}
  Set-Location -LiteralPath $script:Root

  try { $Host.UI.RawUI.WindowTitle = 'Ravand Setup' } catch {}
  Write-Host ""
  Write-Host "  Ravand - Management System" -ForegroundColor Green
  Write-Host "  One-click installer (no Docker)" -ForegroundColor DarkGray

  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin -and -not $SkipAdminCheck) {
    Warn 'Administrator rights are required. Restarting the installer with elevation...'
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Port', "$Port", '-PgPort', "$PgPort")
    if ($NoStart) { $arguments += '-NoStart' }
    if ($NoAutostart) { $arguments += '-NoAutostart' }
    if ($NoShortcuts) { $arguments += '-NoShortcuts' }
    $arguments += '-Pause'
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arguments
    exit 0
  }

  # ---------- Node.js ----------
  Step 'Checking Node.js'
  $nodeExe = Find-NodeExe
  if (-not $nodeExe) {
    Warn 'Node.js was not found. Installing Node.js LTS with winget...'
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
      Die 'winget is not available. Install Node.js 20 LTS from https://nodejs.org and run this installer again.'
    }
    & winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
    Refresh-Path
    $nodeExe = Find-NodeExe
  }
  if (-not $nodeExe) { Die 'Node.js installation failed. Install Node.js 20 LTS from https://nodejs.org and run this installer again.' }
  Ok "Node.js: $nodeExe"

  $nodeDir = Split-Path -Parent $nodeExe
  $npmCli = Join-Path $nodeDir 'node_modules\npm\bin\npm-cli.js'
  if (-not (Test-Path -LiteralPath $npmCli)) {
    $globalNpm = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'npm\node_modules\npm\bin\npm-cli.js'
    if (Test-Path -LiteralPath $globalNpm) { $npmCli = $globalNpm }
  }
  if (-not (Test-Path -LiteralPath $npmCli)) { Die 'npm was not found next to Node.js. Reinstall Node.js LTS and try again.' }
  Ok "npm: $npmCli"

  # ---------- PostgreSQL ----------
  Step 'Checking PostgreSQL'
  $script:PgBin = Find-PgBin
  if (-not $script:PgBin) {
    Warn 'PostgreSQL was not found. Installing PostgreSQL 17 with winget...'
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
      Die 'winget is not available. Install PostgreSQL 17 from https://www.postgresql.org/download/windows/ and run this installer again.'
    }
    $generatedSuperPassword = New-HexSecret 18
    & winget install --id PostgreSQL.PostgreSQL.17 -e --silent --accept-package-agreements --accept-source-agreements --disable-interactivity --override "--mode unattended --unattendedmodeui none --superpassword $generatedSuperPassword --serverport $PgPort"
    Refresh-Path
    $script:PgBin = Find-PgBin
    if ($script:PgBin) { $PgPassword = $generatedSuperPassword }
  }
  if (-not $script:PgBin) { Die 'PostgreSQL installation failed. Install PostgreSQL 17 and run this installer again.' }
  Ok "PostgreSQL: $script:PgBin"

  $service = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
  if ($service) {
    if ($service.Status -ne 'Running') {
      Warn "Starting service $($service.Name)..."
      Start-Service -Name $service.Name
      Start-Sleep -Seconds 3
    }
    Ok "Service: $($service.Name) ($($service.Status))"
  } else {
    Warn 'PostgreSQL service was not found. Will still try to connect on port 5432.'
  }

  # ---------- PostgreSQL superuser ----------
  Step 'Connecting to PostgreSQL'
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    if (-not $PgPassword) {
      $secure = Read-Host "Enter the password for the PostgreSQL 'postgres' user" -AsSecureString
      $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
      try { $PgPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
      finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }
    $script:PgPassword = $PgPassword
    if (Test-PgLogin) { break }
    Warn 'Could not connect. Check the password and that the PostgreSQL service is running.'
    $PgPassword = $null
  }
  $script:PgPassword = $PgPassword
  if (-not (Test-PgLogin)) { Die 'PostgreSQL login failed. Run the installer again with the correct postgres password.' }
  Ok 'Connected to PostgreSQL.'

  # ---------- Application database ----------
  Step 'Creating the application database'
  $existingPassword = Get-DotEnvValue 'DB_PASSWORD'
  if ($DbPassword) {
    # explicit parameter wins
  } elseif ($existingPassword -and $existingPassword -notmatch '^(change_me_local|change_me|changeme|password)$') {
    $DbPassword = $existingPassword
  } elseif (-not $DbPassword) {
    $DbPassword = New-HexSecret 18
  }
  $safePassword = $DbPassword.Replace("'", "''")

  $roleSql = "SELECT 1 FROM pg_roles WHERE rolname='ravand'"
  if ((Invoke-Psql 'postgres' $roleSql) -eq '1') {
    Invoke-Psql 'postgres' "ALTER ROLE ravand WITH LOGIN PASSWORD '$safePassword';" | Out-Null
  } else {
    Invoke-Psql 'postgres' "CREATE ROLE ravand LOGIN PASSWORD '$safePassword';" | Out-Null
  }
  Ok 'Role ravand is ready.'

  $dbSql = "SELECT 1 FROM pg_database WHERE datname='ravand_os'"
  if ((Invoke-Psql 'postgres' $dbSql) -eq '1') {
    Invoke-Psql 'postgres' 'ALTER DATABASE ravand_os OWNER TO ravand;' | Out-Null
  } else {
    Invoke-Psql 'postgres' 'CREATE DATABASE ravand_os OWNER ravand;' | Out-Null
  }
  Invoke-Psql 'ravand_os' 'GRANT ALL ON SCHEMA public TO ravand; ALTER SCHEMA public OWNER TO ravand;' | Out-Null
  Ok 'Database ravand_os is ready.'

  # ---------- .env ----------
  Step 'Writing configuration (.env)'
  $authSecret = Get-DotEnvValue 'AUTH_SECRET'
  if (-not $authSecret -or $authSecret -match '^(replace-with-long-random-string|)$') {
    $authSecret = New-Base64Secret 32
  }
  $encodedPassword = [uri]::EscapeDataString($DbPassword)
  $databaseUrl = "postgresql://ravand:$encodedPassword@127.0.0.1:$PgPort/ravand_os?schema=public"
  $envLines = @(
    '# Generated by the Ravand installer. Never commit this file.',
    "DB_PASSWORD=`"$DbPassword`"",
    "DATABASE_URL=`"$databaseUrl`"",
    "AUTH_SECRET=`"$authSecret`"",
    'COOKIE_SECURE="false"'
  )
  [IO.File]::WriteAllLines((Join-Path $script:Root '.env'), $envLines, (New-Object Text.UTF8Encoding($false)))
  $env:DATABASE_URL = $databaseUrl
  $env:AUTH_SECRET = $authSecret
  $env:COOKIE_SECURE = 'false'
  Ok '.env written.'

  # ---------- Dependencies ----------
  Step 'Installing application dependencies (first run can take a few minutes)'
  & $nodeExe $npmCli install --include=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Die 'npm install failed. Check your internet connection and run the installer again.' }
  Ok 'Dependencies installed.'

  # ---------- Database migrations ----------
  Step 'Applying database migrations'
  $prismaCli = Join-Path $script:Root 'node_modules\prisma\build\index.js'
  if (-not (Test-Path -LiteralPath $prismaCli)) { Die 'Prisma was not installed correctly. Delete node_modules and run the installer again.' }

  $hasUserTable = (Invoke-Psql 'ravand_os' "SELECT CASE WHEN to_regclass('public.""User""') IS NULL THEN 0 ELSE 1 END")
  $hasMigrationsTable = (Invoke-Psql 'ravand_os' "SELECT CASE WHEN to_regclass('public.""_prisma_migrations""') IS NULL THEN 0 ELSE 1 END")
  if ($hasUserTable -eq '1' -and $hasMigrationsTable -eq '0') {
    Warn 'Existing tables found without migration history. Marking the initial migration as applied.'
    & $nodeExe $prismaCli migrate resolve --applied 20260101000000_init
    if ($LASTEXITCODE -ne 0) { Die 'Could not baseline the existing database.' }
  }
  & $nodeExe $prismaCli migrate deploy
  if ($LASTEXITCODE -ne 0) { Die 'Database migration failed. See the message above.' }
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  Ok 'Database schema is up to date.'

  # ---------- Build ----------
  Step 'Building the application (this can take a few minutes)'
  & $nodeExe $npmCli run build
  if ($LASTEXITCODE -ne 0) { Die 'The application build failed. See the message above.' }
  Ok 'Build finished.'

  # ---------- Launcher files ----------
  Step 'Creating shortcuts and launcher'
  $escapedRoot = $script:Root.Replace('"', '""')
  $escapedNode = $nodeExe.Replace('"', '""')
  $vbs = @"
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$escapedRoot"
sh.Run """$escapedNode"" ""$escapedRoot\node_modules\next\dist\bin\next"" start -H 127.0.0.1 -p $Port", 0, False
WScript.Sleep 2500
sh.Run "http://localhost:$Port", 1, False
"@
  [IO.File]::WriteAllText((Join-Path $script:Root 'start-ravand.vbs'), $vbs, [Text.Encoding]::Default)

  $stopScript = @"
`$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
foreach (`$connection in `$connections) {
  Stop-Process -Id `$connection.OwningProcess -Force -ErrorAction SilentlyContinue
}
Write-Host 'Ravand stopped.'
"@
  [IO.File]::WriteAllText((Join-Path $script:Root 'stop-ravand.ps1'), $stopScript, (New-Object Text.UTF8Encoding($false)))
  $stopCmd = "@echo off`r`npowershell -NoProfile -ExecutionPolicy Bypass -File ""%~dp0stop-ravand.ps1""`r`npause`r`n"
  [IO.File]::WriteAllText((Join-Path $script:Root 'stop-ravand.cmd'), $stopCmd, [Text.Encoding]::Default)

  if (-not $NoShortcuts) {
    $desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) "$script:Brand.lnk"
    New-Shortcut $desktopShortcut
    Ok "Desktop shortcut: $desktopShortcut"

    if (-not $NoAutostart) {
      $startupShortcut = Join-Path ([Environment]::GetFolderPath('Startup')) "$script:Brand.lnk"
      New-Shortcut $startupShortcut '--no-browser'
      Ok "Starts automatically at login: $startupShortcut"
    }
  }

  # ---------- Start ----------
  if (-not $NoStart) {
    Step 'Starting Ravand'
    $launcherExe = Join-Path $script:Root 'Ravand.exe'
    if (Test-Path -LiteralPath $launcherExe) {
      Start-Process -FilePath $launcherExe -WorkingDirectory $script:Root
    } else {
      Start-Process -FilePath (Join-Path $env:WINDIR 'System32\wscript.exe') -ArgumentList "`"$(Join-Path $script:Root 'start-ravand.vbs')`"" -WorkingDirectory $script:Root
    }
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Milliseconds 750
      try {
        $response = Invoke-WebRequest "http://127.0.0.1:$Port/login" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) { $ready = $true; break }
      } catch {}
    }
    if ($ready) {
      Ok "Ravand is running at http://localhost:$Port"
    } else {
      Warn "The server is still starting. Open http://localhost:$Port in your browser in a few seconds."
    }
  }

  Write-Host ""
  Write-Host "  Installation finished." -ForegroundColor Green
  Write-Host "  Address : http://localhost:$Port" -ForegroundColor White
  Write-Host "  Folder  : $script:Root" -ForegroundColor DarkGray
  Write-Host "  Log     : $script:LogPath" -ForegroundColor DarkGray
  Write-Host "  The first visit opens the owner account setup page." -ForegroundColor White
  Write-Host ""
} catch {
  $exitCode = 1
  Write-Host ""
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Full log: $script:LogPath" -ForegroundColor DarkGray
} finally {
  try { Stop-Transcript | Out-Null } catch {}
}

if ($Pause) { Read-Host 'Press Enter to close' | Out-Null }
exit $exitCode
