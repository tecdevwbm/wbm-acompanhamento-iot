const net = require("net");

const BROKERS = [
  { name: "AWS", host: "52.67.133.240", port: 1883, user: "wbm_technology", pass: "Wbm.technology01" },
  { name: "ORACLE", host: "163.176.56.133", port: 1883, user: "wbm_technology", pass: "Wbm.technology01" }
];

function encodeVarint(x) {
  const out = [];
  while (true) {
    let b = x % 128;
    x = Math.floor(x / 128);
    if (x > 0) b |= 0x80;
    out.push(b);
    if (x === 0) break;
  }
  return Buffer.from(out);
}

function decodeVarint(buf, offset) {
  let mult = 1;
  let val = 0;
  while (offset < buf.length) {
    const b = buf[offset++];
    val += (b & 0x7f) * mult;
    if ((b & 0x80) === 0) return { val, offset };
    mult *= 128;
  }
  return null;
}

function encodeStr(str) {
  const b = Buffer.from(str, "utf8");
  const len = Buffer.alloc(2);
  len.writeUInt16BE(b.length, 0);
  return Buffer.concat([len, b]);
}

function fetchBrokerRetainedAndLive(bcfg, waitMs = 1400) {
  return new Promise((resolve) => {
    const messages = [];
    const client = new net.Socket();
    let buf = Buffer.alloc(0);
    let finished = false;

    const done = () => {
      if (finished) return;
      finished = true;
      try { client.destroy(); } catch (_) {}
      resolve(messages);
    };

    const timer = setTimeout(done, waitMs);

    client.connect(bcfg.port, bcfg.host, () => {
      const cid = `wbm_vercel_${bcfg.name}_${Math.floor(Math.random() * 99999)}`;
      const vh = Buffer.concat([encodeStr("MQTT"), Buffer.from([4, 0xc2, 0, 30])]);
      const pay = Buffer.concat([encodeStr(cid), encodeStr(bcfg.user), encodeStr(bcfg.pass)]);
      const connPkt = Buffer.concat([Buffer.from([0x10]), encodeVarint(vh.length + pay.length), vh, pay]);
      client.write(connPkt);
    });

    let subscribed = false;
    client.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      let idx = 0;
      while (idx < buf.length) {
        const pktType = buf[idx];
        const dec = decodeVarint(buf, idx + 1);
        if (!dec || dec.offset + dec.val > buf.length) break;
        const body = buf.slice(dec.offset, dec.offset + dec.val);
        idx = dec.offset + dec.val;

        if (pktType === 0x20 && !subscribed) {
          subscribed = true;
          const subPay = Buffer.concat([Buffer.from([0x00, 0x01]), encodeStr("#"), Buffer.from([0x00])]);
          const subPkt = Buffer.concat([Buffer.from([0x82]), encodeVarint(subPay.length), subPay]);
          client.write(subPkt);
        } else if ((pktType & 0xf0) === 0x30) {
          const qos = (pktType >> 1) & 0x03;
          const retain = pktType & 0x01;
          const tlen = body.readUInt16BE(0);
          const topic = body.slice(2, 2 + tlen).toString("utf8");
          const pOffset = 2 + tlen + (qos > 0 ? 2 : 0);
          const msgStr = body.slice(pOffset).toString("utf8");
          messages.push({ broker: bcfg.name, topic, msgStr, retain: Boolean(retain) });
        }
      }
      buf = buf.slice(idx);
    });

    client.on("error", () => {
      clearTimeout(timer);
      done();
    });
    client.on("close", () => {
      clearTimeout(timer);
      done();
    });
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const [awsMsgs, oracleMsgs] = await Promise.all([
      fetchBrokerRetainedAndLive(BROKERS[0], 1400),
      fetchBrokerRetainedAndLive(BROKERS[1], 1400)
    ]);

    const allMsgs = [...awsMsgs, ...oracleMsgs];
    let snapshotData = {
      updated_at: new Date().toISOString(),
      devices: {},
      recent_log: []
    };

    // 1. Aplica primeiro o snapshot retido na AWS (se existir)
    for (const m of allMsgs) {
      if (m.topic === "wbm/acompanhamento/snapshot") {
        try {
          const parsed = JSON.parse(m.msgStr);
          if (parsed && parsed.devices) {
            snapshotData.devices = parsed.devices;
            if (Array.isArray(parsed.recent_log)) {
              snapshotData.recent_log = parsed.recent_log;
            }
          }
        } catch (_) {}
      }
    }

    // 2. Aplica todos os pacotes diretos recebidos de AWS e ORACLE
    for (const m of allMsgs) {
      if (m.topic.startsWith("wbm/acompanhamento/")) continue;
      let data = null;
      try {
        data = JSON.parse(m.msgStr);
      } catch (_) {
        continue;
      }

      const parts = m.topic.split("/");
      const devId = parts.length >= 2 && parts[0] === "devices" ? parts[1] : (data.id || data.deviceId || m.topic);
      const subtopic = parts[2] || "telemetry";

      if (!m.retain || !m.topic.endsWith("/status") || m.topic.includes("ALIMENTADOR")) {
        snapshotData.recent_log.unshift({
          ts: new Date().toISOString(),
          broker: m.broker,
          topic: m.topic,
          payload: data,
          retain: m.retain
        });
      }

      if (!snapshotData.devices[devId]) {
        if (subtopic === "status" && m.retain && !devId.startsWith("ALIMENTADOR_")) {
          continue;
        }
        snapshotData.devices[devId] = {
          device_id: devId,
          name: devId,
          broker: m.broker,
          topic: m.topic,
          status: "online",
          last_seen: new Date().toISOString(),
          latest: {}
        };
      }

      const dev = snapshotData.devices[devId];
      const isTelemetry =
        subtopic === "telemetry" ||
        devId.startsWith("ALIMENTADOR_") ||
        ["vazao", "pressao", "temp_freezer", "d1", "po", "eg", "ep"].some((k) => k in data);

      if (isTelemetry) {
        dev.status = "online";
        if (!m.retain) dev.last_seen = new Date().toISOString();
        dev.latest = { ...(dev.latest || {}), ...data };
      } else if (subtopic === "status" && data.status) {
        dev.status = data.status;
      }
    }

    snapshotData.recent_log = snapshotData.recent_log.slice(0, 35);
    return res.status(200).json(snapshotData);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
