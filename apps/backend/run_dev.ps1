Write-Host "[Backend] Checking and freeing port 8080..." -ForegroundColor Cyan
$connections = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
if ($connections) {
    foreach ($conn in $connections) {
        if ($conn.OwningProcess -and $conn.OwningProcess -ne 0) {
            Write-Host "[Backend] Killing hanging process PID: $($conn.OwningProcess) on port 8080..." -ForegroundColor Yellow
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}
Write-Host "[Backend] Starting API server..." -ForegroundColor Green
go run ./cmd/api
