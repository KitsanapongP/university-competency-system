# University Competency System Backend (Base)

## Run Server (Recommended for Windows)

To automatically check, kill any process holding port `8080`, and start the server:

### Using Command Prompt (CMD)
```cmd
run_dev.bat
```

### Using PowerShell
```powershell
.\run_dev.ps1
```

---

## Manual Run & Troubleshooting

If you encounter `listen tcp :8080: bind: Only one usage of each socket address is normally permitted.` when running `go run ./cmd/api`, use these commands to kill the process holding port 8080:

### CMD / Command Prompt
```cmd
for /f "tokens=5" %a in ('netstat -a -n -o ^| findstr :8080') do taskkill /F /PID %a
```

### PowerShell
```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess -Force
```

### Standard Run
```bash
cp .env.example .env
go run ./cmd/api
```
