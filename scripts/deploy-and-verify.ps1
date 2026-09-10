# Tek komutla: en son kodu çek, temiz build al, deploy et, ne yaptigini acikca yazdir.
# Calistirmak icin: terragolds-site klasorunde  ->  powershell -ExecutionPolicy Bypass -File .\scripts\deploy-and-verify.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== 1/5: Mevcut durum ===" -ForegroundColor Cyan
git status --short
$before = git rev-parse HEAD

Write-Host "`n=== 2/5: origin/main'e sifirlaniyor (yerel degisiklikler varsa once durdurulur) ===" -ForegroundColor Cyan
$dirty = git status --porcelain
if ($dirty) {
    Write-Host "UYARI: Yerel commit edilmemis degisiklikler var, islem durduruldu:" -ForegroundColor Red
    Write-Host $dirty
    exit 1
}
git fetch origin main
git checkout main
git reset --hard origin/main

$after = git rev-parse HEAD
Write-Host "`nOnceki commit : $before"
Write-Host "Sonraki commit: $after"
if ($before -eq $after) {
    Write-Host "NOT: Commit degismedi - zaten en guncelmis." -ForegroundColor Yellow
} else {
    Write-Host "Yeni kod indi." -ForegroundColor Green
}
git log -1 --oneline

Write-Host "`n=== 3/5: Eski build ciktisi temizleniyor ===" -ForegroundColor Cyan
if (Test-Path ".vinext") { Remove-Item -Recurse -Force ".vinext" }
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" }
Write-Host "Temizlendi."

Write-Host "`n=== 4/5: pnpm run build ===" -ForegroundColor Cyan
pnpm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "BUILD BASARISIZ - deploy yapilmiyor." -ForegroundColor Red
    exit 1
}
Write-Host "Build basarili." -ForegroundColor Green

Write-Host "`n=== 5/5: wrangler deploy ===" -ForegroundColor Cyan
wrangler deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "DEPLOY BASARISIZ." -ForegroundColor Red
    exit 1
}

Write-Host "`n=== TAMAMLANDI ===" -ForegroundColor Green
Write-Host "Deploy edilen commit: $(git log -1 --oneline)"
