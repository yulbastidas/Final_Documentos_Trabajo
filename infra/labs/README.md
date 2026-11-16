# Laboratorios de SecureDocs

Los ejercicios usan cuentas, archivos y tráfico sintéticos. Compose separa la red interna de la red de entrada de Nginx, publicado solo en loopback. Para las pruebas funcionales usa el portal conectado en `/portal`. Verifica los permisos también contra la API, especialmente cuando un botón no está disponible por el rol.

## Preparar y limpiar

Desde la raíz del repositorio, copia `.env.example` a `.env`, genera secretos con `./infra/scripts/init-local-secrets.ps1` y levanta el entorno como indica `README.md`. No uses documentos ni contraseñas reales. Para detener contenedores sin borrar datos:

```powershell
docker compose --env-file .env -f infra/compose.yaml down
```

`down -v` elimina la base y los documentos cifrados. Úsalo solo si decidiste borrar el entorno local y conservar copia de cualquier evidencia necesaria.

## Ejercicios

### 1. Proxy y cabeceras

Abre `http://localhost:8080` y `http://localhost:8080/api/v1/health/ready`. Revisa `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP de Next.js y la ausencia de `X-Powered-By`. La configuración HTTP es solo para desarrollo; repite la revisión TLS con `infra/compose.https.yaml` y un certificado local confiable.

### 2. Migración y disponibilidad

Verifica que `migrate` finalice antes de `backend` y que `/api/v1/health/ready` informe `database` y `storage` como `up`. En una sesión local controlada, detén MySQL y observa el resultado de readiness; vuelve a iniciarlo y registra la recuperación. No uses `docker compose down -v` para simular una caída.

### 3. Almacenamiento documental

Usa una cuenta sintética y un PDF/TXT desechable. Confirma que la carga funciona, que se conserva tras reiniciar el backend y que un rol sin permiso no puede descargar el documento. Para contrastar la respuesta del servidor usa el contrato en `docs/api.md`.

### 4. Captura local de tráfico

Captura únicamente tráfico de prueba hacia `localhost:8080` en la interfaz virtual de Docker Desktop. Usa `/health` y datos sintéticos, sanea PCAP antes de compartirla y borra la captura al terminar. No interceptes sesiones reales, credenciales, redes de terceros ni otros dispositivos. HTTP permite observar contenido de laboratorio; repite con HTTPS para comprobar el cifrado de transporte.

### 5. Segmentación VLAN y Wi-Fi

Usa un switch administrable o simulador con dos segmentos de prueba y un cliente sintético en cada uno. Verifica conectividad dentro de un segmento y ausencia de tráfico entre segmentos sin una regla de enrutamiento autorizada. Guarda la topología, asignación de puertos y resultado de las pruebas. Para WPA2 usa un punto de acceso propio y aislado, clientes de prueba y ningún puente a la red institucional o Internet. Registra asociación exitosa con una clave temporal y rechazo con una clave incorrecta. Omite la clave en la evidencia.

### 6. Observación de tráfico y verificación de identidad

En un entorno aislado, compara una solicitud HTTP sintética visible en Wireshark con una solicitud HTTPS al mismo servicio. Registra el cifrado del transporte y la reacción del cliente ante un certificado de prueba que no coincide con el host o que el cliente no reconoce. Usa únicamente clientes propios y datos sintéticos para la demostración de intermediación.

### 7. WPA2-PSK con radios simuladas

Sin hardware Wi-Fi: el kernel WSL2 de Docker Desktop incluye `mac80211_hwsim`, que crea radios 802.11 virtuales que no emiten señal. Desde la raíz del repositorio:

```powershell
./infra/labs/wpa2/run-wpa2-lab.ps1
```

El script carga el módulo, crea tres radios con [`hwsim_new_radio.py`](wpa2/hwsim_new_radio.py) y separa cada una en su propio espacio de red: `ap` (hostapd, WPA2-PSK, CCMP, canal 6), `sta` (wpa_supplicant) y un monitor pasivo que captura las tramas. Genera una clave aleatoria en cada ejecución, que nunca se imprime ni se guarda, y prueba primero la clave correcta (asociación y ping al AP) y después una incorrecta (debe aparecer `WRONG_KEY` y no haber conexión). Al terminar borra los espacios de red y descarga el módulo. La captura y los registros quedan en `.lab-output/wpa2/`, ignorado por Git.

## Evidencia

- **VLAN 802.1Q comprobada en software.** Tres contenedores en una red Docker interna usaron subinterfaces etiquetadas en `eth0`. A y B se comunicaron en la VLAN 10. A no alcanzó a C en la VLAN 20. Tras reasignar C a la VLAN 10, A sí lo alcanzó. Se retiraron los contenedores y la red de prueba. Esta evidencia corresponde a etiquetado y aislamiento en Linux virtualizado.
- **Disponibilidad comprobada.** Al detener MySQL, readiness respondió 503. Tras arrancarlo, volvió a 200 con base y almacenamiento disponibles.
- **Identidad TLS comprobada.** La API respondió con el certificado temporal de localhost confiado por el cliente de prueba. El cliente rechazó el mismo certificado al conectarse con un nombre que no coincidía. Esta fue una prueba de validación de identidad con datos sintéticos.
- **Wireshark comprobado en loopback.** TShark capturó tres solicitudes sintéticas `GET /api/v1/health` y sus tres respuestas 200. El filtro se limitó al puerto 8080 y a los puertos de origen reservados para la prueba. Solo se extrajeron método, ruta y estado HTTP.
- **WPA2 comprobado con radios simuladas (14 de noviembre de 2026).** Con la clave correcta el cliente llegó a `wpa_state=COMPLETED` con `key_mgmt=WPA2-PSK`, `pairwise_cipher=CCMP` y `group_cipher=CCMP`. El AP registró `pairwise key handshake completed (RSN)` y el ping al AP tuvo 3/3 respuestas. Con una clave incorrecta el cliente registró `reason=WRONG_KEY`, no completó la asociación y el ping perdió el 100 %. El monitor pasivo capturó 383 tramas: 322 beacons y 14 tramas EAPOL del intercambio de 4 pasos, sin ningún ICMP legible porque el tráfico de datos iba cifrado con CCMP. La clave no aparece en registros ni salida. Se eliminaron los espacios de red y se descargó el módulo. Es una simulación del protocolo en el kernel, no una prueba de radiofrecuencia ni de un AP físico.

Registra fecha, commit, objetivo, autorización, topología, comandos, resultados, limitaciones y limpieza. Capturas, PCAP, certificados, usuarios y archivos quedan fuera del repositorio. Nunca publiques claves, cookies, códigos MFA ni contenido documental en issues o reportes.
