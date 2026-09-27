param(
  [string]$TemplateRoot = "C:\Users\Thoma\OneDrive\Dojo Deckbuilder\Templates\Card Templates",
  [string]$OutputRoot = "docs/production/starter-experiment"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$repoRoot = (Get-Location).Path
$outputPath = Join-Path $repoRoot $OutputRoot
$workPath = Join-Path $outputPath ".build"
$previewRoot = Join-Path $outputPath "previews"
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
New-Item -ItemType Directory -Force -Path $workPath | Out-Null
New-Item -ItemType Directory -Force -Path $previewRoot | Out-Null

function New-Canvas {
  param([int]$Width = 825, [int]$Height = 1125)
  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Save-TextLayer {
  param(
    [string]$Path,
    [string]$Text,
    [string]$FontName,
    [float]$FontSize,
    [System.Drawing.FontStyle]$FontStyle,
    [System.Drawing.Color]$Color,
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [switch]$Center
  )
  $canvas = New-Canvas
  try {
    $font = New-Object System.Drawing.Font($FontName, $FontSize, $FontStyle, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Object System.Drawing.SolidBrush($Color)
    $format = New-Object System.Drawing.StringFormat
    $format.LineAlignment = [System.Drawing.StringAlignment]::Near
    $format.Alignment = if ($Center) { [System.Drawing.StringAlignment]::Center } else { [System.Drawing.StringAlignment]::Near }
    $rectangle = New-Object System.Drawing.RectangleF($X, $Y, $Width, $Height)
    $canvas.Graphics.DrawString($Text, $font, $brush, $rectangle, $format)
    $canvas.Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $format.Dispose(); $brush.Dispose(); $font.Dispose()
  } finally {
    $canvas.Graphics.Dispose(); $canvas.Bitmap.Dispose()
  }
}

function Save-ChipLayer {
  param([string]$Path, [ValidateSet("Kata", "Consumable")][string]$Kind)
  $canvas = New-Canvas
  try {
    $font = New-Object System.Drawing.Font("Arial", 36, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $small = New-Object System.Drawing.Font("Arial", 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $leftRect = New-Object System.Drawing.RectangleF(105, 730, 185, 80)
    $middleRect = New-Object System.Drawing.RectangleF(320, 730, 185, 80)
    $rightRect = New-Object System.Drawing.RectangleF(535, 730, 195, 80)
    $canvas.Graphics.DrawString("1", $font, $brush, $leftRect, $format)
    if ($Kind -eq "Kata") {
      $canvas.Graphics.DrawString("-", $font, $brush, $middleRect, $format)
      $canvas.Graphics.DrawString("TURN", $small, $brush, $rightRect, $format)
    } else {
      $canvas.Graphics.DrawString("+1", $font, $brush, $middleRect, $format)
      $canvas.Graphics.DrawString("1x", $font, $brush, $rightRect, $format)
    }
    $canvas.Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $format.Dispose(); $brush.Dispose(); $small.Dispose(); $font.Dispose()
  } finally {
    $canvas.Graphics.Dispose(); $canvas.Bitmap.Dispose()
  }
}

function Save-Composite {
  param([string]$ExtractedRoot, [string]$StackPath, [string]$Path)
  [xml]$stack = Get-Content -Raw $StackPath
  $layers = @($stack.image.stack.SelectNodes(".//stack[@visibility!='hidden']//layer[@visibility='visible']"))
  $canvas = New-Canvas
  try {
    for ($i = $layers.Count - 1; $i -ge 0; $i--) {
      $layerPath = Join-Path $ExtractedRoot ($layers[$i].src -replace '/', '\\')
      if (-not (Test-Path $layerPath)) { continue }
      $layer = [System.Drawing.Image]::FromFile($layerPath)
      try { $canvas.Graphics.DrawImage($layer, 0, 0, 825, 1125) } finally { $layer.Dispose() }
    }
    $canvas.Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $canvas.Graphics.Dispose(); $canvas.Bitmap.Dispose()
  }
}

function Save-Thumbnail {
  param([string]$Source, [string]$Path)
  $sourceImage = [System.Drawing.Image]::FromFile($Source)
  try {
    $thumb = New-Object System.Drawing.Bitmap(206, 281, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($thumb)
    try {
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.DrawImage($sourceImage, 0, 0, 206, 281)
      $thumb.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $thumb.Dispose() }
  } finally { $sourceImage.Dispose() }
}

function Replace-ZipEntry {
  param([string]$ArchivePath, [string]$EntryName, [string]$SourcePath)
  $archive = [System.IO.Compression.ZipFile]::Open($ArchivePath, [System.IO.Compression.ZipArchiveMode]::Update)
  try {
    $oldEntry = $archive.GetEntry($EntryName)
    if ($null -ne $oldEntry) { $oldEntry.Delete() }
    $entry = $archive.CreateEntry($EntryName)
    $input = [System.IO.File]::OpenRead($SourcePath)
    $output = $entry.Open()
    try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose() }
  } finally { $archive.Dispose() }
}

function Build-Card {
  param(
    [string]$TemplateName,
    [string]$CardId,
    [string]$Title,
    [string]$Flavor,
    [string]$Rules,
    [ValidateSet("Kata", "Consumable")][string]$Kind
  )
  $templatePath = Join-Path $TemplateRoot $TemplateName
  if (-not (Test-Path $templatePath)) { throw "Missing official template: $templatePath" }
  $slug = $Title.ToLowerInvariant() -replace '[^a-z0-9]+', '-'
  $archivePath = Join-Path $outputPath "$CardId-$slug.ora"
  Copy-Item $templatePath $archivePath -Force

  $cardWork = Join-Path $workPath $CardId
  New-Item -ItemType Directory -Force -Path (Join-Path $cardWork 'data') | Out-Null
  tar -xf $templatePath -C $cardWork
  $stackPath = Join-Path $cardWork 'stack.xml'
  [xml]$stack = Get-Content -Raw $stackPath
  $stack.image.name = $Title
  $stack.image.stack.name = $Title
  $starterLayer = $stack.image.stack.stack[0].layer | Where-Object { $_.name -like 'Starter tag*' }
  if ($null -ne $starterLayer) { $starterLayer.visibility = 'visible' }
  $stack.Save($stackPath)

  Save-TextLayer (Join-Path $cardWork 'data/layer_010.png') $Title 'Arial' 38 ([System.Drawing.FontStyle]::Bold) ([System.Drawing.Color]::FromArgb(40, 55, 60)) 110 90 600 70
  Save-TextLayer (Join-Path $cardWork 'data/layer_008.png') $Flavor 'Times New Roman' 22 ([System.Drawing.FontStyle]::Italic) ([System.Drawing.Color]::FromArgb(65, 65, 55)) 120 215 590 55 -Center
  Save-TextLayer (Join-Path $cardWork 'data/layer_002.png') $Rules 'Arial' 23 ([System.Drawing.FontStyle]::Bold) ([System.Drawing.Color]::FromArgb(40, 55, 60)) 118 885 590 105
  Save-TextLayer (Join-Path $cardWork 'data/layer_001.png') "$CardId  /  STARTER EXPERIMENT" 'Arial' 13 ([System.Drawing.FontStyle]::Bold) ([System.Drawing.Color]::FromArgb(80, 95, 90)) 98 1028 625 35
  Save-ChipLayer (Join-Path $cardWork 'data/layer_005.png') $Kind
  $mergedPath = Join-Path $cardWork 'mergedimage.png'
  Save-Composite $cardWork $stackPath $mergedPath
  $thumbnailPath = Join-Path $cardWork 'Thumbnails/thumbnail.png'
  Save-Thumbnail $mergedPath $thumbnailPath

  Get-ChildItem (Join-Path $cardWork 'data') -Filter '*.png' | ForEach-Object { Replace-ZipEntry $archivePath ("data/" + $_.Name) $_.FullName }
  Replace-ZipEntry $archivePath 'stack.xml' $stackPath
  Replace-ZipEntry $archivePath 'mergedimage.png' $mergedPath
  Replace-ZipEntry $archivePath 'Thumbnails/thumbnail.png' $thumbnailPath
  return @{ Id = $CardId; Name = $Title; Type = $Kind; Template = $templatePath; Archive = $archivePath; Preview = $mergedPath }
}

$built = @()
$built += Build-Card '04_Kata.ora' 'DDB-STA-EXP-001' 'Reset Stance' 'Clear the board. Keep the lesson.' 'Discard 1 card.' 'Kata'
$built += Build-Card '06_Item_Consumable.ora' 'DDB-STA-EXP-002' 'Tactical Refresh' 'A little reset. A lot less panic.' 'Gain 1 Focus. Your next Defense this turn gets +1 Guard. Destroy this after use.' 'Consumable'
$built | ForEach-Object {
  $previewName = "$($_.Id)-$($_.Name.ToLowerInvariant() -replace '[^a-z0-9]+', '-').png"
  Copy-Item $_.Preview (Join-Path $previewRoot $previewName) -Force
}

$manifest = [ordered]@{
  schemaVersion = 1
  experiment = 'starter-deck-experiment-v1'
  sourceTemplates = @('Templates/Card Templates/04_Kata.ora', 'Templates/Card Templates/06_Item_Consumable.ora')
  artworkStatus = 'PENDING — official template artwork placeholder retained; replace only the artwork group before print approval.'
  cards = @($built | ForEach-Object { $previewName = "$($_.Id)-$($_.Name.ToLowerInvariant() -replace '[^a-z0-9]+', '-').png"; [ordered]@{ cardId = $_.Id; name = $_.Name; type = $_.Type; layeredSourceArchive = (Join-Path $OutputRoot (Split-Path $_.Archive -Leaf)); preview = (Join-Path "$OutputRoot/previews" $previewName); physicalSize = '825x1125 px template canvas'; printApproval = 'NOT READY — artwork pending' } })
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $outputPath 'manifest.json')

Write-Host "Built $($built.Count) starter experiment card archives under $outputPath"
