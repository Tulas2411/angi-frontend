param([string]$BackendPath = (Join-Path $PSScriptRoot '../../angi-backend'))
$ErrorActionPreference = 'Stop'
$frontend = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$run = [IO.File]::ReadAllLines((Join-Path $frontend '.env.integration')) |
    Where-Object { $_ -match '^ANGI_LOCAL_TEST_RUN=[a-z0-9-]{1,40}$' } |
    ForEach-Object { ($_ -split '=', 2)[1] }
if (!$run -or @($run).Count -ne 1) { throw 'Expected one exact local test run in .env.integration.' }
Push-Location (Resolve-Path -LiteralPath $BackendPath).Path
try {
    $output = & docker compose -f docker-compose.local.yml run --rm -e "ANGI_LOCAL_TEST_RUN=$run" seed dotnet run --project docker/local/Seed --configuration Release -- --verify-owner-tasks
    if ($LASTEXITCODE -ne 0) { throw 'Backend persistence inspection failed.' }
} finally { Pop-Location }
$payload = $output | Where-Object { $_ -match '^\{' } | Select-Object -Last 1
if (!$payload) { throw 'Missing backend verification result.' }
$result = $payload | ConvertFrom-Json
$artifacts = Join-Path $frontend 'artifacts'
[void][IO.Directory]::CreateDirectory($artifacts)
[IO.File]::WriteAllText((Join-Path $artifacts 'owner-task-persistence.json'), $payload, [Text.UTF8Encoding]::new($false))
if ($result.OperatingStatus -ne 'Open' -or $result.VerificationStatus -ne 'Verified' -or $result.ModerationStatus -ne 'Visible' -or $result.StatusAuditCount -lt 3 -or !$result.TrimmedReasonPersisted -or !$result.MaxLengthReasonPersisted) {
    throw 'Owner task persistence/audit checks did not all pass. See artifacts/owner-task-persistence.json.'
}
Write-Output 'PASS: real PostgreSQL state, three status audit transitions, trimmed reason and 500-character reason.'
