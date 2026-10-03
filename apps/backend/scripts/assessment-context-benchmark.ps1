param(
    [int[]]$Contexts = @(4096, 12288),
    [ValidateRange(1, 10)][int]$Repeat = 3
)

$ErrorActionPreference = 'Stop'
$backend = Split-Path -Parent $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent $backend)
$output = Join-Path $root 'outputs/assessment-context-benchmark'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$names = @('LEARNER_ASSESSMENT_EVAL', 'LEARNER_ASSESSMENT_CONTEXT_TOKENS', 'LEARNER_ASSESSMENT_OUTPUT_RESERVE_TOKENS', 'LEARNER_ASSESSMENT_TOKEN_SAFETY_MARGIN', 'LEARNER_ASSESSMENT_OLLAMA_THINK', 'GOCACHE')
$original = @{}
foreach ($name in $names) { $original[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:LEARNER_ASSESSMENT_EVAL = '1'
    $env:LEARNER_ASSESSMENT_OUTPUT_RESERVE_TOKENS = '1024'
    $env:LEARNER_ASSESSMENT_TOKEN_SAFETY_MARGIN = '128'
    $env:LEARNER_ASSESSMENT_OLLAMA_THINK = 'false'
    $env:GOCACHE = Join-Path $backend '.codex-go-cache'
    foreach ($context in $Contexts) {
        if ($context -notin @(4096, 12288)) { throw 'Only reviewed experiment contexts 4096 and 12288 are allowed.' }
        $env:LEARNER_ASSESSMENT_CONTEXT_TOKENS = [string]$context
        $stdout = Join-Path $output "$context.stdout.txt"
        $stderr = Join-Path $output "$context.stderr.txt"
        $started = Get-Date
        $process = Start-Process -FilePath 'go.exe' -ArgumentList @('run', './cmd/assessment-eval', '-repeat', $Repeat) -WorkingDirectory $backend -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        [void]$process.Handle
        $peakRSS = 0L
        $peakPrivate = 0L
        $peakModelVRAM = 0L
        $peakGPUUsedMiB = 0L
        $samples = 0
        $models = @()
        while (-not $process.HasExited) {
            $processes = @(Get-Process | Where-Object { $_.ProcessName -match 'ollama|llama' })
            $rss = ($processes | Measure-Object -Property WorkingSet64 -Sum).Sum
            $private = ($processes | Measure-Object -Property PrivateMemorySize64 -Sum).Sum
            $peakRSS = [Math]::Max($peakRSS, [long]$rss)
            $peakPrivate = [Math]::Max($peakPrivate, [long]$private)
            try {
                $models = @((Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/ps' -TimeoutSec 2).models | Select-Object name, size, size_vram, context_length)
                $vram = ($models | Measure-Object -Property size_vram -Sum).Sum
                $peakModelVRAM = [Math]::Max($peakModelVRAM, [long]$vram)
            } catch { }
            $nvidia = Get-Command nvidia-smi -ErrorAction SilentlyContinue
            if ($nvidia) {
                $used = & $nvidia.Source --query-gpu=memory.used --format=csv,noheader,nounits
                foreach ($value in $used) { if ($value -match '^\d+$') { $peakGPUUsedMiB = [Math]::Max($peakGPUUsedMiB, [long]$value) } }
            }
            $samples++
            Start-Sleep -Seconds 1
            $process.Refresh()
        }
        $process.WaitForExit()
        $result = [ordered]@{ context=$context; repeat=$Repeat; exit_code=$process.ExitCode; elapsed_seconds=((Get-Date)-$started).TotalSeconds; samples=$samples; peak_ollama_rss_bytes=$peakRSS; peak_ollama_private_bytes=$peakPrivate; peak_model_vram_bytes=$peakModelVRAM; peak_gpu_used_mib=$peakGPUUsedMiB; last_loaded_models=$models; stdout=$stdout; stderr=$stderr }
        $result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output "$context.metrics.json") -Encoding UTF8
        $result | ConvertTo-Json -Depth 5
    }
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $original[$name], 'Process') }
}
