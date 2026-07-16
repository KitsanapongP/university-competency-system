@echo off
echo [Backend] Checking and freeing port 8080...
for /f "tokens=5" %%a in ('netstat -a -n -o ^| findstr :8080') do (
    if not "%%a"=="0" (
        echo [Backend] Killing hanging process PID: %%a on port 8080...
        taskkill /F /PID %%a >nul 2>&1
    )
)
echo [Backend] Starting API server...
go run ./cmd/api
