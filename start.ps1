Write-Host "Starting Charon 3D AI Office..." -ForegroundColor Cyan

$backendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; python -m uvicorn app.main:app --host 0.0.0.0 --port 8000" -PassThru
$frontendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev -- --port 5173" -PassThru

Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"
Write-Host "Backend: http://localhost:8000 | Frontend: http://localhost:5173" -ForegroundColor Green
