param (
    [string]$env = "all"
)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "         AION CORE AUTOMATED CHECK SUITE          " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Map selection flags directly to the tox environment list
$toxEnvs = ""
if ($env -eq "lint") { 
    $toxEnvs = "lint" 
} elseif ($env -eq "test") { 
    $toxEnvs = "py311" 
} elseif ($env -eq "coverage") { 
    $toxEnvs = "coverage" 
} else { 
    $toxEnvs = "py311,lint,coverage" 
}

Write-Host "`n[1/2] Executing Django Backend Tox Engine ($toxEnvs)..." -ForegroundColor Yellow
docker compose run --rm backend tox -e $toxEnvs

Write-Host "`n[2/2] Executing FastAPI AI Service Tox Engine ($toxEnvs)..." -ForegroundColor Yellow
docker compose run --rm ai-service tox -e $toxEnvs

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host " Automation Suite Complete!                      " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green