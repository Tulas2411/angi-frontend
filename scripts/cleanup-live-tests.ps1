param([string]$BackendPath = (Join-Path $PSScriptRoot '../../angi-backend'))
$ErrorActionPreference = 'Stop'
$frontend = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$run = [IO.File]::ReadAllLines((Join-Path $frontend '.env.integration')) |
    Where-Object { $_ -match '^ANGI_LOCAL_TEST_RUN=[a-z0-9-]{1,40}$' } |
    ForEach-Object { ($_ -split '=', 2)[1] }
if (!$run -or @($run).Count -ne 1) { throw 'Expected one exact local test run in .env.integration.' }
Push-Location (Resolve-Path -LiteralPath $BackendPath).Path
try {
    & docker compose -f docker-compose.local.yml run --rm -e "ANGI_LOCAL_TEST_RUN=$run" seed dotnet run --project docker/local/Seed --configuration Release -- --cleanup-media
    if ($LASTEXITCODE -ne 0) { throw 'Local media cleanup failed.' }
} finally { Pop-Location }
