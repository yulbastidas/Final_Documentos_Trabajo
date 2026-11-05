$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secretDirectory = Join-Path $repoRoot '.secrets'

New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null

$secretNames = @(
  'mysql_password',
  'mysql_root_password',
  'document_kek',
  'mfa_encryption_key',
  'csrf_secret'
)
$random = [Security.Cryptography.RandomNumberGenerator]::Create()

try {
  foreach ($secretName in $secretNames) {
    $secretPath = Join-Path $secretDirectory $secretName
    if (-not (Test-Path -LiteralPath $secretPath)) {
      $secretBytes = [byte[]]::new(32)
      $random.GetBytes($secretBytes)
      $secretValue = [Convert]::ToBase64String($secretBytes)
      [IO.File]::WriteAllText($secretPath, $secretValue, [Text.Encoding]::ASCII)
      [Array]::Clear($secretBytes, 0, $secretBytes.Length)
    }
  }
} finally {
  $random.Dispose()
}

Write-Output 'Se crearon los secretos locales que faltaban en .secrets/ (ignorados por Git).'
