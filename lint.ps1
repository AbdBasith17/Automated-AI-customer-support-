Write-Host "Running isort..." -ForegroundColor Cyan
docker-compose run --rm backend isort .

Write-Host "Running black..." -ForegroundColor Cyan
docker-compose run --rm backend black .

Write-Host "Running flake8..." -ForegroundColor Cyan
docker-compose run --rm backend flake8 .

Write-Host "Finished!" -ForegroundColor Green