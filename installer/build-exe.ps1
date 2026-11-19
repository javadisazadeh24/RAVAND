# Builds Ravand-Setup.exe and Ravand.exe with the C# compiler that ships with Windows.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File installer\build-exe.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $csc)) {
  $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (-not (Test-Path -LiteralPath $csc)) { throw 'The .NET Framework C# compiler (csc.exe) was not found.' }

$icon = Join-Path $PSScriptRoot 'ravand.ico'
if (-not (Test-Path -LiteralPath $icon)) {
  Add-Type -AssemblyName System.Drawing
  $logo = Join-Path $root 'public\logo.png'
  if (Test-Path -LiteralPath $logo) {
    $source = [System.Drawing.Image]::FromFile($logo)
    try {
      $size = 256
      $bitmap = New-Object System.Drawing.Bitmap $size, $size
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $scale = [Math]::Min($size / $source.Width, $size / $source.Height)
        $width = [int]($source.Width * $scale)
        $height = [int]($source.Height * $scale)
        $x = [int](($size - $width) / 2)
        $y = [int](($size - $height) / 2)
        $graphics.DrawImage($source, $x, $y, $width, $height)
        $stream = New-Object System.IO.MemoryStream
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        $png = $stream.ToArray()
        $file = [System.IO.File]::Create($icon)
        try {
          $writer = New-Object System.IO.BinaryWriter $file
          $writer.Write([UInt16]0)
          $writer.Write([UInt16]1)
          $writer.Write([UInt16]1)
          $writer.Write([Byte]0)
          $writer.Write([Byte]0)
          $writer.Write([Byte]0)
          $writer.Write([Byte]0)
          $writer.Write([UInt16]1)
          $writer.Write([UInt16]32)
          $writer.Write([UInt32]$png.Length)
          $writer.Write([UInt32]22)
          $writer.Write($png)
          $writer.Flush()
        } finally { $file.Dispose() }
      } finally { $graphics.Dispose(); $bitmap.Dispose() }
    } finally { $source.Dispose() }
  }
}

$common = @('/nologo', '/target:winexe', '/optimize+', '/reference:System.Windows.Forms.dll')
if (Test-Path -LiteralPath $icon) { $common += "/win32icon:$icon" }

& $csc @common "/win32manifest:$(Join-Path $PSScriptRoot 'setup.manifest')" "/out:$(Join-Path $root 'Ravand-Setup.exe')" (Join-Path $PSScriptRoot 'Setup.cs')
if ($LASTEXITCODE -ne 0) { throw 'Building Ravand-Setup.exe failed.' }

& $csc @common "/win32manifest:$(Join-Path $PSScriptRoot 'launcher.manifest')" "/out:$(Join-Path $root 'Ravand.exe')" (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Building Ravand.exe failed.' }

Write-Host 'Built:' -ForegroundColor Green
Write-Host "  $(Join-Path $root 'Ravand-Setup.exe')"
Write-Host "  $(Join-Path $root 'Ravand.exe')"
