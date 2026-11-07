# YAM local web server for Windows - no installation required (uses built-in PowerShell).
# Usage: powershell -ExecutionPolicy Bypass -File serve.ps1 [port]
param([int]$Port = 8080)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.pdf' = 'application/pdf'; '.ico' = 'image/x-icon'
}

$listener = $null
for ($p = $Port; $p -lt $Port + 50; $p++) {
  try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$p/")
    $l.Start()
    $listener = $l; $Port = $p; break
  } catch { }
}
if (-not $listener) { Write-Host "Could not open a local port."; exit 1 }

$url = "http://localhost:$Port/"
Write-Host "YAM is running at $url"
Write-Host "Keep this window open while you use the app. Close it to stop."
Start-Process $url

$rootFull = [System.IO.Path]::GetFullPath($root)
while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $res = $ctx.Response
  try {
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '') { $rel = 'index.html' }
    $file = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
    if ($file.StartsWith($rootFull) -and (Test-Path $file -PathType Leaf)) {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $ct = $types[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $res.ContentType = $ct
      $res.Headers.Add('Cache-Control', 'no-cache')
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
  } catch { $res.StatusCode = 500 }
  finally { $res.OutputStream.Close() }
}
