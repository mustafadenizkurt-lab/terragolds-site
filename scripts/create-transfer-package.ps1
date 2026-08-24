$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$releaseDirectory = Join-Path $projectRoot "releases"
$stagingDirectory = Join-Path $releaseDirectory ".transfer-package"
$packageDirectory = Join-Path $stagingDirectory "terragolds-workspace"
$archiveName = "Terragolds-Calisma-Arsivi-$(Get-Date -Format 'yyyy-MM-dd').zip"
$archivePath = Join-Path $releaseDirectory $archiveName
$checksumPath = "$archivePath.sha256"

function Assert-PathInsideProject([string]$Path) {
  $projectPrefix = $projectRoot.TrimEnd("\") + "\"
  $absolutePath = [System.IO.Path]::GetFullPath($Path)
  if (-not $absolutePath.StartsWith(
      $projectPrefix,
      [System.StringComparison]::OrdinalIgnoreCase
    )) {
    throw "Paketleme yolu proje klasorunun disinda olamaz: $absolutePath"
  }
}

Assert-PathInsideProject $releaseDirectory
Assert-PathInsideProject $stagingDirectory
Assert-PathInsideProject $archivePath

if (Test-Path -LiteralPath $stagingDirectory) {
  Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
}
New-Item -ItemType Directory -Path $packageDirectory -Force | Out-Null

$sourceDirectories = @(
  "app",
  "build",
  "config",
  "db",
  "drizzle",
  "lib",
  "public",
  "scripts",
  "tests",
  "worker"
)

$sourceFiles = @(
  ".env.example",
  ".gitignore",
  "drizzle.config.ts",
  "eslint.config.mjs",
  "next.config.ts",
  "package.json",
  "pnpm-lock.yaml",
  "postcss.config.mjs",
  "tsconfig.json",
  "vite.config.ts",
  "wrangler.jsonc",
  "KURULUM.txt"
)

foreach ($entry in $sourceDirectories + $sourceFiles) {
  $sourcePath = Join-Path $projectRoot $entry
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Calisma arsivinde bulunmasi gereken dosya eksik: $entry"
  }
  Copy-Item -LiteralPath $sourcePath -Destination $packageDirectory -Recurse
}

$forbiddenPathPatterns = @(
  "(^|[\\/])\.env\.local$",
  "(^|[\\/])node_modules([\\/]|$)",
  "(^|[\\/])\.git([\\/]|$)",
  "(^|[\\/])\.vinext([\\/]|$)",
  "(^|[\\/])dist([\\/]|$)",
  "(^|[\\/])outputs([\\/]|$)",
  "(^|[\\/])work([\\/]|$)",
  "(^|[\\/])\.wrangler([\\/]|$)",
  "(^|[\\/])\.pnpm-store([\\/]|$)",
  "(^|[\\/]).*\.zip$",
  "(^|[\\/])tsconfig\.tsbuildinfo$",
  "(^|[\\/])dev-server.*\.log$"
)

$packagedFiles = Get-ChildItem -LiteralPath $packageDirectory -Recurse -File
foreach ($file in $packagedFiles) {
  $relativePath = $file.FullName.Substring($packageDirectory.Length + 1)
  foreach ($pattern in $forbiddenPathPatterns) {
    if ($relativePath -match $pattern) {
      throw "Calisma arsivinde istenmeyen dosya bulundu: $relativePath"
    }
  }
}

if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}
if (Test-Path -LiteralPath $checksumPath) {
  Remove-Item -LiteralPath $checksumPath -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open(
  $archivePath,
  [System.IO.Compression.ZipArchiveMode]::Create
)
try {
  $stagingUri = [System.Uri]($stagingDirectory.TrimEnd("\") + "\")
  foreach ($file in Get-ChildItem -LiteralPath $stagingDirectory -Recurse -File) {
    $entryName = [System.Uri]::UnescapeDataString(
      $stagingUri.MakeRelativeUri([System.Uri]$file.FullName).ToString()
    )
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      $file.FullName,
      $entryName,
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
} finally {
  $archive.Dispose()
}

$checksum = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
Set-Content `
  -LiteralPath $checksumPath `
  -Value "$checksum  $archiveName" `
  -Encoding ascii

Remove-Item -LiteralPath $stagingDirectory -Recurse -Force

Write-Output "Calisma arsivi: $archivePath"
Write-Output "SHA256: $checksum"
