"""Crea radios mac80211_hwsim en el espacio de red actual (generic netlink).

Docker Desktop ejecuta los contenedores en un espacio de red distinto del
inicial de la VM, donde el módulo crea sus radios por defecto. Este ayudante
pide HWSIM_CMD_NEW_RADIO para que las radios nazcan en el espacio del
laboratorio. Uso: python3 hwsim_new_radio.py 2
"""
import os
import socket
import struct
import sys

NETLINK_GENERIC = 16
GENL_ID_CTRL = 0x10
CTRL_CMD_GETFAMILY = 3
CTRL_ATTR_FAMILY_ID = 1
CTRL_ATTR_FAMILY_NAME = 2
HWSIM_CMD_NEW_RADIO = 4
NLM_F_REQUEST = 1
NLM_F_ACK = 4
NLMSG_ERROR = 2


def attr(kind, payload):
    length = 4 + len(payload)
    return struct.pack("HH", length, kind) + payload + b"\0" * ((4 - length % 4) % 4)


def request(sock, family, cmd, attrs, seq):
    body = struct.pack("BBH", cmd, 1, 0) + attrs
    header = struct.pack("IHHII", 16 + len(body), family, NLM_F_REQUEST | NLM_F_ACK, seq, os.getpid())
    sock.send(header + body)
    replies = []
    while True:
        data = sock.recv(65536)
        offset = 0
        while offset < len(data):
            length, kind, _, _, _ = struct.unpack_from("IHHII", data, offset)
            message = data[offset + 16 : offset + length]
            if kind == NLMSG_ERROR:
                (code,) = struct.unpack_from("i", message)
                if code < 0:
                    raise OSError(-code, os.strerror(-code))
                return replies
            replies.append(message)
            offset += (length + 3) & ~3


def parse_attrs(payload):
    out, offset = {}, 0
    while offset + 4 <= len(payload):
        length, kind = struct.unpack_from("HH", payload, offset)
        out[kind & 0x3FFF] = payload[offset + 4 : offset + length]
        offset += (length + 3) & ~3
    return out


def main():
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    sock = socket.socket(socket.AF_NETLINK, socket.SOCK_RAW, NETLINK_GENERIC)
    sock.bind((0, 0))
    replies = request(sock, GENL_ID_CTRL, CTRL_CMD_GETFAMILY, attr(CTRL_ATTR_FAMILY_NAME, b"MAC80211_HWSIM\0"), 1)
    family = struct.unpack("H", parse_attrs(replies[0][4:])[CTRL_ATTR_FAMILY_ID][:2])[0]
    for i in range(count):
        request(sock, family, HWSIM_CMD_NEW_RADIO, b"", 2 + i)
    print(f"{count} radios simuladas creadas")


if __name__ == "__main__":
    main()
