# Terragolds Sync (Shopify) baglanti testi - Windows PowerShell icin.
# Bu dosyayi calistirmak icin, proje ana dizininde su komutu yazin:
#   .\scripts\shopify-setup-windows.ps1
#
# Client Secret ekranda gorunmez, hicbir yere kaydedilmez.

$clientId = Read-Host "Shopify Client ID"
$secureSecret = Read-Host "Shopify Client Secret" -AsSecureString
$clientSecret = [System.Net.NetworkCredential]::new("", $secureSecret).Password

$env:SHOPIFY_CLIENT_ID = $clientId
$env:SHOPIFY_CLIENT_SECRET = $clientSecret

node scripts/shopify-test-token.mjs
