# Create a venv in .venv and install requirements
param(
	[switch]$Force
)

$venvPath = Join-Path $PSScriptRoot ".venv"

if (-Not (Test-Path $venvPath) -or $Force) {
	python -m venv $venvPath
}

# Activate and upgrade pip, then install requirements
$activate = Join-Path $venvPath "Scripts\Activate.ps1"
if (-Not (Test-Path $activate)) {
	Write-Error "Virtual environment activation script not found. Ensure Python is installed and accessible."
	exit 1
}

& $activate
python -m pip install --upgrade pip
pip install -r (Join-Path $PSScriptRoot "requirements.txt")

Write-Output "Done. To activate the virtual environment in PowerShell:"
Write-Output "  .\\.venv\\Scripts\\Activate.ps1"
Write-Output "Then run: python app.py"
