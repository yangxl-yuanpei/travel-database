$ErrorActionPreference = "Stop"

$pythonCommands = @(
    "python",
    "py",
    (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe")
)

foreach ($pythonCommand in $pythonCommands) {
    if ($pythonCommand -in @("python", "py")) {
        $resolvedCommand = Get-Command $pythonCommand -ErrorAction SilentlyContinue
        if ($null -ne $resolvedCommand) {
            & $resolvedCommand.Source (Join-Path $PSScriptRoot "validate_json.py")
            exit $LASTEXITCODE
        }
    }
    elseif (Test-Path -LiteralPath $pythonCommand) {
        & $pythonCommand (Join-Path $PSScriptRoot "validate_json.py")
        exit $LASTEXITCODE
    }
}

Write-Error "Python 3 was not found. Install Python or run this script inside Codex Desktop."
exit 1
