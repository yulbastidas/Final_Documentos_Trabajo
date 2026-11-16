#!/bin/sh
# Laboratorio WPA2-PSK aislado con radios simuladas (mac80211_hwsim).
# Se ejecuta dentro de un contenedor privilegiado lanzado por run-wpa2-lab.ps1.
# No usa tarjetas Wi-Fi reales ni emite señales de radio: las dos radios son
# virtuales y cada una vive en su propio espacio de red (ap / sta).
set -eu

apk add -q --no-progress iw hostapd wpa_supplicant iproute2 tcpdump python3 >/dev/null

OUT=/out
mkdir -p "$OUT"
SSID=SecureDocs-Lab
# Clave sintética generada en cada ejecución; nunca se imprime ni se guarda.
PSK=$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | cut -c1-20)
BADPSK="incorrecta-$(head -c 6 /dev/urandom | od -An -tx1 | tr -d ' \n')"

cleanup() {
  pkill hostapd 2>/dev/null || true
  pkill wpa_supplicant 2>/dev/null || true
  pkill tcpdump 2>/dev/null || true
  ip netns del ap 2>/dev/null || true
  ip netns del sta 2>/dev/null || true
}
trap cleanup EXIT

phys() { iw phy | awk '/^Wiphy/{print $2}'; }
# Las radios se crean en este espacio de red (mismo grupo de difusión) y
# luego se separan: una para el AP y otra para el cliente.
python3 /lab/hwsim_new_radio.py 3
set -- $(phys)
[ "$#" -ge 3 ] || { echo "No hay tres radios simuladas"; exit 1; }
PHY_AP=$1
PHY_STA=$2
PHY_MON=$3

ip netns add ap
ip netns add sta
iw phy "$PHY_AP" set netns name ap
iw phy "$PHY_STA" set netns name sta
IF_AP=$(ip netns exec ap iw dev | awk '/Interface/{print $2; exit}')
IF_STA=$(ip netns exec sta iw dev | awk '/Interface/{print $2; exit}')

# Tercera radio como observador pasivo en el canal 6 (captura de radio).
IF_MON=$(iw dev | awk '/Interface/{print $2; exit}')
iw dev "$IF_MON" set type monitor
ip link set "$IF_MON" up
iw dev "$IF_MON" set channel 6
tcpdump -i "$IF_MON" -w "$OUT/wpa2.pcap" -U >/dev/null 2>&1 &
sleep 1

cat > /tmp/hostapd.conf <<EOF
interface=$IF_AP
driver=nl80211
ssid=$SSID
hw_mode=g
channel=6
auth_algs=1
wpa=2
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
wpa_passphrase=$PSK
EOF
ip netns exec ap ip addr add 10.77.0.1/24 dev "$IF_AP"
ip netns exec ap hostapd -t /tmp/hostapd.conf > "$OUT/hostapd.log" 2>&1 &
ip netns exec sta ip addr add 10.77.0.2/24 dev "$IF_STA"
sleep 2

attempt() { # $1 = etiqueta, $2 = clave
  cat > /tmp/sta.conf <<EOF
ctrl_interface=/run/wpa_supplicant
network={
  ssid="$SSID"
  key_mgmt=WPA-PSK
  proto=RSN
  pairwise=CCMP
  psk="$2"
}
EOF
  rm -f "$OUT/sta-$1.log"
  ip netns exec sta ip link set "$IF_STA" up
  ip netns exec sta wpa_supplicant -t -i "$IF_STA" -c /tmp/sta.conf > "$OUT/sta-$1.log" 2>&1 &
  state=DESCONECTADO
  for _ in $(seq 1 20); do
    if ip netns exec sta wpa_cli -i "$IF_STA" status 2>/dev/null | grep -q '^wpa_state=COMPLETED'; then
      state=COMPLETED
      break
    fi
    sleep 1
  done
  echo "$state"
}

echo "== Prueba 1: clave correcta"
R1=$(attempt correcta "$PSK")
STATUS=$(ip netns exec sta wpa_cli -i "$IF_STA" status 2>/dev/null | grep -E '^(ssid|pairwise_cipher|group_cipher|key_mgmt|wpa_state)=' | tr '\n' ' ')
PING=$(ip netns exec sta ping -c 3 -W 2 10.77.0.1 2>&1 | grep -E 'packets transmitted' || echo 'sin respuesta')
echo "estado=$R1"
echo "$STATUS"
echo "ping AP: $PING"
ip netns exec sta wpa_cli -i "$IF_STA" terminate >/dev/null 2>&1 || true
sleep 2

echo "== Prueba 2: clave incorrecta"
R2=$(attempt incorrecta "$BADPSK")
WRONG=$(grep -c 'reason=WRONG_KEY' "$OUT/sta-incorrecta.log" || true)
PING2=$(ip netns exec sta ping -c 2 -W 1 10.77.0.1 2>&1 | grep -E 'packets transmitted' || echo 'sin respuesta')
echo "estado=$R2"
echo "eventos WRONG_KEY en el cliente: $WRONG"
echo "ping AP: $PING2"
ip netns exec sta wpa_cli -i "$IF_STA" terminate >/dev/null 2>&1 || true
sleep 1
pkill tcpdump || true
sleep 1

echo "== Evidencia del AP (hostapd)"
grep -E 'associated|pairwise key handshake completed|4-Way Handshake failed|invalid MIC|AP-STA-CONNECTED|AP-STA-DISCONNECTED' "$OUT/hostapd.log" \
  | sed -E 's/([0-9a-f]{2}:){5}[0-9a-f]{2}/<MAC>/g' | sort | uniq -c | head -12

echo "== Captura de radio (monitor pasivo, canal 6)"
TOTAL=$(tcpdump -r "$OUT/wpa2.pcap" 2>/dev/null | wc -l)
BEACON=$(tcpdump -r "$OUT/wpa2.pcap" 2>/dev/null | grep -c "Beacon ($SSID)" || true)
EAPOL=$(tcpdump -r "$OUT/wpa2.pcap" -e 2>/dev/null | grep -ci 'EAPOL' || true)
echo "tramas=$TOTAL beacons=$BEACON EAPOL(4-way handshake)=$EAPOL"
echo "Contenido ICMP legible en la captura: $(tcpdump -r "$OUT/wpa2.pcap" 2>/dev/null | grep -c 'ICMP echo' || true) (0 = tráfico cifrado con CCMP)"

if [ "$R1" = COMPLETED ] && [ "$R2" != COMPLETED ] && [ "$WRONG" -ge 1 ]; then
  echo "RESULTADO: PASA (asociación con clave correcta; rechazo con clave incorrecta)"
else
  echo "RESULTADO: FALLA"
  exit 1
fi
