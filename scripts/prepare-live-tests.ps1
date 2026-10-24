param([string]$BackendPath = (Join-Path $PSScriptRoot '../../angi-backend'))
$ErrorActionPreference = 'Stop'
$backend = (Resolve-Path -LiteralPath $BackendPath).Path
$values = @{}
foreach ($line in [IO.File]::ReadAllLines((Join-Path $backend '.env'))) {
    if ($line -match '^([A-Za-z][A-Za-z0-9_]*)=(.*)$') { $values[$matches[1]] = $matches[2] }
}
if ($values['ANGI_DB_NAME'] -ne 'angi_local' -or !$values['ANGI_LOCAL_ACCOUNT_PASSWORD']) {
    throw 'Use the isolated local stack created by backend docker/local/Initialize.ps1.'
}
$run = [Guid]::NewGuid().ToString('N')
Push-Location $backend
try {
    & docker compose -f docker-compose.local.yml run --rm -e "ANGI_LOCAL_TEST_RUN=$run" seed
    if ($LASTEXITCODE -ne 0) { throw 'Local seed failed.' }
} finally { Pop-Location }
$frontend = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$content = @(
    'API_BASE_URL=http://127.0.0.1:' + $values['ANGI_API_PORT'] + '/api/v1'
    'APP_URL=http://localhost:3001'
    'SESSION_PASSWORD=' + [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    'ANGI_TEST_PASSWORD=' + $values['ANGI_LOCAL_ACCOUNT_PASSWORD']
    "ANGI_TEST_OWNER_EMAIL=owner-$run@angi.local"
    "ANGI_TEST_SUSPENDED_OWNER_EMAIL=suspended-$run@angi.local"
    "ANGI_TEST_EMPTY_OWNER_EMAIL=empty-$run@angi.local"
    "ANGI_TEST_HOURS_OWNER_EMAIL=hours-$run@angi.local"
    "ANGI_TEST_STATUS_OWNER_EMAIL=status-$run@angi.local"
    "ANGI_LOCAL_TEST_RUN=$run"
    'NEXT_PUBLIC_DATA_MODE=live'
    'NEXT_PUBLIC_ENABLE_DEMO=true'
    'NEXT_PUBLIC_GOOGLE_CLIENT_ID=' + $values['Google__ClientId']
    'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=' + $(if ($values['Mapbox__AccessToken'] -and $values['Mapbox__AccessToken'].StartsWith('pk.')) { $values['Mapbox__AccessToken'] } else { '' })
    'PLAYWRIGHT_BROWSERS_PATH=' + (Join-Path $frontend '.cache/browsers')
)
[IO.File]::WriteAllLines((Join-Path $frontend '.env.integration'), $content, [Text.UTF8Encoding]::new($false))
Write-Output 'Created ignored .env.integration with a fresh owner and isolated FE session. Existing .env/.env.local preserved.'
