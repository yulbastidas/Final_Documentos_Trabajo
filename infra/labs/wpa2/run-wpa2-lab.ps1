# Ejecuta el laboratorio WPA2 con radios simuladas dentro de la VM de Docker
# Desktop (kernel WSL2 con mac80211_hwsim). Uso, desde la raíz del repositorio:
#   ./infra/labs/wpa2/run-wpa2-lab.ps1
# Las capturas y registros quedan en .lab-output/wpa2 (ignorado por Git).
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$out = Join-Path $repoRoot '.lab-output\wpa2'
New-Item -ItemType Directory -Force -Path $out | Out-Null

docker run --rm --privileged --pid=host alpine:3.22 nsenter -t 1 -m -- modprobe mac80211_hwsim radios=0
if ($LASTEXITCODE -ne 0) { throw 'No se pudo cargar mac80211_hwsim en la VM de Docker.' }
try {
  docker run --rm --privileged --net=host `
    -v "${PSScriptRoot}:/lab:ro" -v "${out}:/out" `
    alpine:3.22 sh /lab/wpa2-lab.sh
  $code = $LASTEXITCODE
} finally {
  docker run --rm --privileged --pid=host alpine:3.22 nsenter -t 1 -m -- rmmod mac80211_hwsim | Out-Null
}
Write-Output "Registros y captura en $out (no subir al repositorio)."
exit $code
