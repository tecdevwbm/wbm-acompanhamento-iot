import json
import os
import socket
import struct
import threading
import time
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT_FILE = os.path.join(BASE_DIR, "mqtt_snapshot.json")

BROKERS = [
    {"name": "AWS", "host": "52.67.133.240", "port": 1883, "user": "wbm_technology", "pass": "Wbm.technology01"},
    {"name": "ORACLE", "host": "163.176.56.133", "port": 1883, "user": "wbm_technology", "pass": "Wbm.technology01"},
]

# Cadastro base dos equipamentos monitorados nos brokers do Postman
INITIAL_DEVICES = {
    "ALIMENTADOR_1": {
        "device_id": "ALIMENTADOR_1",
        "name": "CONTROLFEED 1 (AVANTGARDE) NS 2112",
        "location": "AvantGarde",
        "solution_code": "control_feed",
        "broker": "AWS (52.67.133.240)",
        "topic": "devices/ALIMENTADOR_1/status",
        "status": "online",
        "last_seen": "2026-11-16T13:58:10+00:00",
        "priorityOrder": 1,
        "isPriority": True,
        "formMapping": {
            "cliente": "AvantGarde",
            "clienteOutro": "",
            "equipamento": "Control Flow Gate",
            "equipamentoOutro": "",
            "identificacao": "CONTROLFEED 1 (AVANTGARDE) NS 2112",
            "identificacaoOutro": ""
        },
        "latest": {
            "id": "ALIMENTADOR_1", "ed": 1, "tp": 25, "eg": 6022, "ep": 86.03,
            "al": False, "am": False, "er": 0, "pf": 1, "ts": "16/11/2026 10:58:10",
            "c_ps": {"qpc": 132, "tc": 5, "hl": 8, "hd": 18},
            "i": 420.685, "v": 11.4136
        },
        "history24h": []
    },
    "ALIMENTADOR_2": {
        "device_id": "ALIMENTADOR_2",
        "name": "CONTROLFEED 2 (AVANTGARDE) NS 2111",
        "location": "AvantGarde",
        "solution_code": "control_feed",
        "broker": "AWS (52.67.133.240)",
        "topic": "devices/ALIMENTADOR_2/status",
        "status": "offline",
        "last_seen": None,
        "priorityOrder": 2,
        "isPriority": True,
        "formMapping": {
            "cliente": "AvantGarde",
            "clienteOutro": "",
            "equipamento": "Control Flow Gate",
            "equipamentoOutro": "",
            "identificacao": "CONTROLFEED 2 (AVANTGARDE) NS 2111",
            "identificacaoOutro": ""
        },
        "latest": {},
        "history24h": []
    },
    "Mestre_CC7B5CF835BC_CP_1": {
        "device_id": "Mestre_CC7B5CF835BC_CP_1",
        "name": "Monitor de Vazão Nascente V2",
        "location": "UTA - Itabirito",
        "solution_code": "control_parshall_monitor",
        "broker": "ORACLE (163.176.56.133)",
        "topic": "devices/Mestre_CC7B5CF835BC_CP_1/telemetry",
        "status": "online",
        "last_seen": "2026-11-16T13:50:00+00:00",
        "priorityOrder": 3,
        "isPriority": True,
        "formMapping": {
            "cliente": "UTA SAAE Itabirito Nascente",
            "clienteOutro": "",
            "equipamento": "Control Parshall Monitor",
            "equipamentoOutro": "",
            "identificacao": "ControlParshal 1 (NASCENTE ITABIRITO)",
            "identificacaoOutro": ""
        },
        "latest": {
            "vazao": 19.74, "lamina": 10.62, "tensao": 11.92, "temp": 15,
            "error": 0, "sleep": 120, "acordado": 60, "tempoEntreEnvios": 30
        },
        "history24h": []
    },
    "Mestre_CC7B5CF20D9C_CF_1": {
        "device_id": "Mestre_CC7B5CF20D9C_CF_1",
        "name": "Control Flow Gate ETA Itabirito",
        "location": "ETA Itabirito",
        "solution_code": "control_flow_monitor",
        "broker": "ORACLE (163.176.56.133)",
        "topic": "devices/Mestre_CC7B5CF20D9C_CF_1/telemetry",
        "status": "offline",
        "last_seen": "2026-11-06T05:14:21+00:00",
        "priorityOrder": 4,
        "isPriority": True,
        "formMapping": {
            "cliente": "ETA SAAE Itabirito",
            "clienteOutro": "",
            "equipamento": "Control Flow Gate",
            "equipamentoOutro": "",
            "identificacao": "ControlFlow GATE 1  (ETA ITABIRITO)",
            "identificacaoOutro": ""
        },
        "latest": {"ed": 1, "md": 2, "qc": 6, "er": 0, "po": 0, "qv": 28},
        "history24h": []
    },
    "Mestre_CC7B5CF20D9C_MP_1": {
        "device_id": "Mestre_CC7B5CF20D9C_MP_1",
        "name": "PressureMonitor 1 (ETA Itabirito)",
        "location": "SAAE Itabirito",
        "solution_code": "pressure_monitor",
        "broker": "ORACLE (163.176.56.133)",
        "topic": "devices/Mestre_CC7B5CF20D9C_MP_1/telemetry",
        "status": "online",
        "last_seen": "2026-11-16T13:45:00+00:00",
        "priorityOrder": 5,
        "isPriority": True,
        "formMapping": {
            "cliente": "ETA SAAE Itabirito",
            "clienteOutro": "",
            "equipamento": "Pressure Monitor",
            "equipamentoOutro": "",
            "identificacao": "PressureMonitor 1 (ETA ITABIRITO)",
            "identificacaoOutro": ""
        },
        "latest": {"pressao": 3.47, "temp": 29.63, "error": 0, "unit": "bar", "min": 0, "max": 16},
        "history24h": []
    },
    "Mestre_8813BF023168_FRZ_1": {
        "device_id": "Mestre_8813BF023168_FRZ_1",
        "name": "MONITOR TEMPERATURA FREEZER 1",
        "location": "VITAS UFMG",
        "solution_code": "temp_monitor",
        "broker": "ORACLE (163.176.56.133)",
        "topic": "devices/Mestre_8813BF023168_FRZ_1/telemetry",
        "status": "online",
        "last_seen": "2026-11-16T13:50:00+00:00",
        "priorityOrder": 6,
        "isPriority": True,
        "formMapping": {
            "cliente": "Outro",
            "clienteOutro": "VITAS UFMG",
            "equipamento": "Temp Monitor",
            "equipamentoOutro": "",
            "identificacao": "Outro",
            "identificacaoOutro": "MONITOR TEMPERATURA FREEZER 1 (VITAS UFMG)"
        },
        "latest": {"d1": 15, "d2": 21.8, "d3": -69.3, "d4": -79.4, "d5": 0, "d9": -50},
        "history24h": []
    },
    "Mestre_CC7B5CFAF980_FRZ_1": {
        "device_id": "Mestre_CC7B5CFAF980_FRZ_1",
        "name": "MONITOR TEMPERATURA FREEZER 2",
        "location": "VITAS UFMG",
        "solution_code": "temp_monitor",
        "broker": "ORACLE (163.176.56.133)",
        "topic": "devices/Mestre_CC7B5CFAF980_FRZ_1/telemetry",
        "status": "online",
        "last_seen": "2026-11-16T13:50:00+00:00",
        "priorityOrder": 7,
        "isPriority": True,
        "formMapping": {
            "cliente": "Outro",
            "clienteOutro": "VITAS UFMG",
            "equipamento": "Temp Monitor",
            "equipamentoOutro": "",
            "identificacao": "Outro",
            "identificacaoOutro": "MONITOR TEMPERATURA FREEZER 2 (VITAS UFMG)"
        },
        "latest": {"d1": 15, "d2": 22.3, "d3": -77.0, "d4": -79.5, "d5": 0, "d9": -50},
        "history24h": []
    },
    "Mestre_8813BF00E570_CM_1": {
        "device_id": "Mestre_8813BF00E570_CM_1",
        "name": "MONITOR DE ENERGIA VITAS",
        "location": "VITAS UFMG",
        "solution_code": "energy_monitor",
        "broker": "ORACLE (163.176.56.133)",
        "topic": "devices/Mestre_8813BF00E570_CM_1/telemetry",
        "status": "online",
        "last_seen": "2026-11-16T13:50:00+00:00",
        "priorityOrder": 8,
        "isPriority": True,
        "formMapping": {
            "cliente": "Outro",
            "clienteOutro": "VITAS UFMG",
            "equipamento": "Outro",
            "equipamentoOutro": "Monitor de Energia",
            "identificacao": "Outro",
            "identificacaoOutro": "MONITOR DE ENERGIA VITAS (VITAS UFMG)"
        },
        "latest": {"d1": 0, "d2": 0, "d3": 0, "d4": 221.5, "d5": 0, "d9": 0},
        "history24h": []
    },
    "Mestre_8813BF00922C_CM_1": {
        "device_id": "Mestre_8813BF00922C_CM_1",
        "name": "Inversor CA1A - 302",
        "location": "Área Limpa Inativadas",
        "solution_code": "inverter_monitor",
        "broker": "ORACLE (163.176.56.133)",
        "topic": "devices/Mestre_8813BF00922C_CM_1/telemetry",
        "status": "online",
        "last_seen": "2026-11-16T13:50:00+00:00",
        "priorityOrder": 9,
        "isPriority": True,
        "formMapping": {
            "cliente": "Outro",
            "clienteOutro": "Área Limpa Inativadas",
            "equipamento": "Outro",
            "equipamentoOutro": "Inverter Monitor",
            "identificacao": "Outro",
            "identificacaoOutro": "CA1A - 302 (Área Limpa Inativadas)"
        },
        "latest": {"d1": 1.9, "d2": 9.6, "d3": 51.5, "d4": 36, "d5": 349.6, "d6": 494.3, "d10": 0},
        "history24h": []
    },
    "Mestre_BCDDC2CDA9B8_CP_1": {
        "device_id": "Mestre_BCDDC2CDA9B8_CP_1",
        "name": "Monitor de Vazão Nascente 1",
        "location": "Nascente Itabirito",
        "solution_code": "control_parshall_monitor",
        "broker": "ORACLE (163.176.56.133)",
        "topic": "devices/Mestre_BCDDC2CDA9B8_CP_1/telemetry",
        "status": "online",
        "last_seen": "2026-09-03T16:30:03+00:00",
        "priorityOrder": 12,
        "isPriority": False,
        "formMapping": {
            "cliente": "UTA SAAE Itabirito Nascente",
            "clienteOutro": "",
            "equipamento": "Control Parshall Monitor",
            "equipamentoOutro": "",
            "identificacao": "ControlParshal 1 (NASCENTE ITABIRITO)",
            "identificacaoOutro": ""
        },
        "latest": {"vazao": 21.56, "lamina": 11.25, "tensao": 10.47, "temp": 15, "error": 0, "sleep": 121, "acordado": 61},
        "history24h": []
    },
    "Mestre_807D3AF2B53C_CTH_1": {
        "device_id": "Mestre_807D3AF2B53C_CTH_1",
        "name": "Humidity & Temperature Sensor",
        "location": "Belo Horizonte",
        "solution_code": "control_temp_humidity_monitor",
        "broker": "AWS / ORACLE",
        "topic": "devices/Mestre_807D3AF2B53C_CTH_1/telemetry",
        "status": "online",
        "last_seen": "2026-11-16T13:50:00+00:00",
        "priorityOrder": 13,
        "isPriority": False,
        "formMapping": {
            "cliente": "Outro",
            "clienteOutro": "Belo Horizonte",
            "equipamento": "Temp Monitor",
            "equipamentoOutro": "",
            "identificacao": "Outro",
            "identificacaoOutro": "Humidity & Temperature Sensor (BH)"
        },
        "latest": {"temp": 24, "umidade": 70.1, "tensao": 12.13, "error": 0},
        "history24h": []
    },
    "Mestre_48E72998A478_CP_1": {
        "device_id": "Mestre_48E72998A478_CP_1",
        "name": "Calha Parshall (Mestre_48E72998A478_CP_1)",
        "location": "WBM",
        "solution_code": "control_parshall_monitor",
        "broker": "AWS / ORACLE",
        "topic": "devices/Mestre_48E72998A478_CP_1/telemetry",
        "status": "online",
        "last_seen": "2026-11-16T13:50:00+00:00",
        "priorityOrder": 14,
        "isPriority": False,
        "formMapping": {
            "cliente": "Outro",
            "clienteOutro": "WBM",
            "equipamento": "Control Parshall Monitor",
            "equipamentoOutro": "",
            "identificacao": "Outro",
            "identificacaoOutro": "Mestre_48E72998A478_CP_1"
        },
        "latest": {},
        "history24h": []
    }
}

state_lock = threading.Lock()
devices_state = {}
recent_mqtt_log = []  # Últimos 60 pacotes recebidos para visualização estilo Postman


def load_saved_state():
    global devices_state
    devices_state = json.loads(json.dumps(INITIAL_DEVICES))
    if os.path.exists(SNAPSHOT_FILE):
        try:
            with open(SNAPSHOT_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
            for k, v in saved.get("devices", {}).items():
                if k in devices_state:
                    devices_state[k].update(v)
                else:
                    devices_state[k] = v
        except Exception as e:
            print("[WARN] Falha ao ler snapshot salvo:", e)


def save_and_publish_snapshot(aws_sock=None):
    with state_lock:
        payload_obj = {
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "devices": devices_state,
            "recent_log": recent_mqtt_log[:30]
        }
        raw_json = json.dumps(payload_obj, ensure_ascii=False)

    try:
        with open(SNAPSHOT_FILE, "w", encoding="utf-8") as f:
            f.write(raw_json)
    except Exception:
        pass

    if aws_sock:
        try:
            topic_b = encode_str("wbm/acompanhamento/snapshot")
            msg_b = raw_json.encode("utf-8")
            pkt = bytes([0x31]) + encode_varint(len(topic_b) + len(msg_b)) + topic_b + msg_b
            aws_sock.sendall(pkt)
        except Exception:
            pass


def encode_varint(x):
    out = bytearray()
    while True:
        byte = x % 128
        x //= 128
        if x > 0:
            byte |= 0x80
        out.append(byte)
        if x == 0:
            break
    return bytes(out)


def decode_varint(buf, offset):
    mult = 1
    val = 0
    while offset < len(buf):
        b = buf[offset]
        offset += 1
        val += (b & 0x7F) * mult
        if (b & 0x80) == 0:
            return val, offset
        mult *= 128
    return None, offset


def encode_str(s):
    b = s.encode("utf-8")
    return struct.pack("!H", len(b)) + b


def process_mqtt_message(broker_name, topic, msg_str, retain):
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        data = json.loads(msg_str)
    except Exception:
        data = {"raw": msg_str}

    # Ignora nosso próprio tópico de snapshot
    if topic.startswith("wbm/acompanhamento/"):
        return False

    with state_lock:
        if not retain or not topic.endswith("/status"):
            recent_mqtt_log.insert(0, {
                "ts": now_iso,
                "broker": broker_name,
                "topic": topic,
                "payload": data,
                "retain": bool(retain)
            })
            del recent_mqtt_log[60:]

        # Identifica o device_id a partir do tópico (ex: devices/ALIMENTADOR_1/status ou devices/Mestre_.../telemetry)
        parts = topic.split("/")
        dev_id = parts[1] if len(parts) >= 2 and parts[0] == "devices" else (data.get("id") or data.get("deviceId") or topic)
        subtopic = parts[2] if len(parts) >= 3 else "telemetry"

        if dev_id not in devices_state:
            # Ignora apenas status vazios de dispositivos de teste antigos se não tiverem telemetria
            if subtopic == "status" and retain:
                return False
            devices_state[dev_id] = {
                "device_id": dev_id,
                "name": dev_id,
                "location": broker_name,
                "solution_code": infer_solution_code(dev_id, data),
                "broker": broker_name,
                "topic": topic,
                "status": "online",
                "last_seen": now_iso,
                "priorityOrder": 30,
                "isPriority": False,
                "formMapping": {
                    "cliente": "Outro",
                    "clienteOutro": "WBM",
                    "equipamento": "Outro",
                    "equipamentoOutro": infer_solution_code(dev_id, data),
                    "identificacao": "Outro",
                    "identificacaoOutro": dev_id
                },
                "latest": {},
                "history24h": []
            }

        dev = devices_state[dev_id]
        dev["broker"] = broker_name

        # Se for ALIMENTADOR_1 ou ALIMENTADOR_2, o payload de telemetria vem em /status!
        is_telemetry = (
            subtopic == "telemetry"
            or dev_id.startswith("ALIMENTADOR_")
            or any(k in data for k in ["vazao", "pressao", "temp_freezer", "d1", "po", "eg", "ep"])
        )

        if is_telemetry and isinstance(data, dict):
            dev["status"] = "online"
            if not retain:
                dev["last_seen"] = now_iso
            elif not dev.get("last_seen"):
                dev["last_seen"] = now_iso
            dev["latest"].update(data)
            dev["topic"] = topic
            return True
        elif subtopic == "status" and isinstance(data, dict):
            if data.get("status") == "online":
                dev["status"] = "online"
            elif data.get("status") == "offline":
                dev["status"] = "offline"
            if not retain:
                dev["last_seen"] = now_iso
                return True
    return False


def infer_solution_code(dev_id, data):
    if dev_id.startswith("ALIMENTADOR_"):
        return "control_feed"
    if "_CP_" in dev_id or "Parshal" in dev_id:
        return "control_parshall_monitor"
    if "_CF_" in dev_id or "ControlFlow" in dev_id:
        return "control_flow_monitor"
    if "_MP_" in dev_id or "Pressure" in dev_id:
        return "pressure_monitor"
    if "_FRZ_" in dev_id or "_FZR_" in dev_id:
        return "temp_monitor"
    if "_CTH_" in dev_id:
        return "control_temp_humidity_monitor"
    if "_CM_" in dev_id:
        return "energy_monitor"
    return "generic"


def broker_worker(bcfg):
    name = bcfg["name"]
    host = bcfg["host"]
    port = bcfg["port"]
    user = bcfg["user"]
    pw = bcfg["pass"]

    while True:
        try:
            print(f"[MQTT-{name}] Conectando a {host}:{port} ...")
            s = socket.create_connection((host, port), timeout=8)
            flags = 0x02 | 0x80 | 0x40
            cid = f"wbm_postman_bridge_{name}_{int(time.time()) % 10000}"
            payload = encode_str(cid) + encode_str(user) + encode_str(pw)
            vh = encode_str("MQTT") + bytes([4, flags]) + struct.pack("!H", 60)
            s.sendall(bytes([0x10]) + encode_varint(len(vh) + len(payload)) + vh + payload)
            connack = s.recv(4)
            if len(connack) < 4 or connack[3] != 0:
                print(f"[MQTT-{name}] CONNACK recusado:", connack)
                s.close()
                time.sleep(5)
                continue

            print(f"[MQTT-{name}] Conectado com sucesso! Assinando '#'...")
            sub_vh = struct.pack("!H", 1)
            sub_pay = encode_str("#") + bytes([0])
            s.sendall(bytes([0x82]) + encode_varint(len(sub_vh) + len(sub_pay)) + sub_vh + sub_pay)

            if name == "AWS":
                save_and_publish_snapshot(s)

            s.settimeout(20.0)
            buf = b""
            last_ping = time.time()
            last_pub = time.time()

            while True:
                try:
                    chunk = s.recv(8192)
                    if not chunk:
                        raise ConnectionError("Socket fechado pelo broker")
                    buf += chunk
                    changed = False
                    idx = 0
                    while idx < len(buf):
                        pkt_type = buf[idx]
                        rem_len, next_idx = decode_varint(buf, idx + 1)
                        if rem_len is None or next_idx + rem_len > len(buf):
                            break
                        pkt_body = buf[next_idx:next_idx + rem_len]
                        idx = next_idx + rem_len

                        if (pkt_type & 0xF0) == 0x30:
                            qos = (pkt_type >> 1) & 0x03
                            retain = pkt_type & 0x01
                            tlen = struct.unpack("!H", pkt_body[:2])[0]
                            topic = pkt_body[2:2 + tlen].decode("utf-8", errors="replace")
                            p_offset = 2 + tlen + (2 if qos > 0 else 0)
                            msg_str = pkt_body[p_offset:].decode("utf-8", errors="replace")
                            if process_mqtt_message(name, topic, msg_str, retain):
                                changed = True
                    buf = buf[idx:]
                    if changed and (time.time() - last_pub > 1.5):
                        save_and_publish_snapshot(s if name == "AWS" else None)
                        last_pub = time.time()
                except socket.timeout:
                    pass

                if time.time() - last_ping >= 25:
                    s.sendall(bytes([0xC0, 0x00]))  # PINGREQ
                    last_ping = time.time()
                    if name == "AWS":
                        save_and_publish_snapshot(s)
        except Exception as e:
            print(f"[MQTT-{name}] Reconectando após erro: {e}")
            time.sleep(5)


class BridgeHTTPHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/snapshot"):
            with state_lock:
                body = json.dumps({
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "devices": devices_state,
                    "recent_log": recent_mqtt_log[:30]
                }, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()


if __name__ == "__main__":
    load_saved_state()
    save_and_publish_snapshot()
    for b in BROKERS:
        t = threading.Thread(target=broker_worker, args=(b,), daemon=True)
        t.start()

    print("[HTTP] Servidor Local + API MQTT Postman ativo em http://localhost:8080")
    server = ThreadingHTTPServer(("0.0.0.0", 8080), BridgeHTTPHandler)
    server.serve_forever()
