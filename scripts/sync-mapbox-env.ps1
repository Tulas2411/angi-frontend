param([string]$BackendPath = (Join-Path $PSScriptRoot '../../angi-backend'))
$ErrorActionPreference = 'Stop'
$backend = (Resolve-Path -LiteralPath $BackendPath).Path
$line = [IO.File]::ReadAllLines((Join-Path $backend '.env')) |
    Where-Object { $_ -match '^Mapbox__AccessToken=' } | Select-Object -First 1
if (!$line) { throw 'Missing Mapbox__AccessToken in backend .env.' }
$token = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
if (!$token.StartsWith('pk.')) {
    throw 'Frontend maps require a public pk. Mapbox token. Secret tokens are never copied into NEXT_PUBLIC_ variables.'
}
$frontend = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$target = Join-Path $frontend '.env'
if (Test-Path -LiteralPath (Join-Path $frontend '.env.local')) {
    $target = Join-Path $frontend '.env.local'
}
$content = if (Test-Path -LiteralPath $target) { [IO.File]::ReadAllText($target) }
    else { [IO.File]::ReadAllText((Join-Path $frontend '.env.example')) }
$setting = 'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=' + $token
if ($content -match '(?m)^NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=') {
    $content = [regex]::Replace($content, '(?m)^NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=[^\r\n]*', [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $setting })
} else { $content = $content.TrimEnd() + [Environment]::NewLine + $setting + [Environment]::NewLine }
[IO.File]::WriteAllText($target, $content, [Text.UTF8Encoding]::new($false))
Write-Output ('Synced public Mapbox token into frontend ' + [IO.Path]::GetFileName($target) + '. Restart frontend development or rebuild production.')
