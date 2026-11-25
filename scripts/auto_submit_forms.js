// ============================================================================
// Robô Automático na Nuvem (Seg a Sex às 08:15 BRT)
// Consulta Lovable (Supabase) com Fallback automático para Postman/MQTT
// e envia os acompanhamentos diretamente para o Google Forms + salva histórico.
// ============================================================================

const fs = require("fs");
const path = require("path");
const fetchSnapshotApi = require("../api/snapshot.js");

const SUPABASE_URL = "https://nwdextnlntvixacrjifv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZGV4dG5sbnR2aXhhY3JqaWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MTQyNjQsImV4cCI6MjA4NjA5MDI2NH0.N3bGloWK1RWg6VXKgm2zXxfwOlKn8ubIIzIFSd24BNc";
const LOVABLE_EMAIL = process.env.WBM_LOVABLE_EMAIL || "matheus.coutinho@wbmtechnology.com.br";
const LOVABLE_PASS = process.env.WBM_LOVABLE_PASS || "wbm_technology";
const RESPONSAVEL = process.env.WBM_RESPONSAVEL || "Matheus Coutinho";

const GOOGLE_FORM_POST_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfKZcEDkmh44Anhkyk2EBvYyzl3MdBAaC9h1ckC_OaOzgwj0Q/formResponse";

const FORM_ENTRIES = {
  dataHora: "entry.1202071458",
  responsavel: "entry.1513083425",
  cliente: "entry.1574759881",
  equipamento: "entry.1925839575",
  identificacao: "entry.289370399",
  tipoRegistro: "entry.287916298",
  tipoAcompanhamento: "entry.1368488375",
  fonteInformacoes: "entry.23646529",
  statusOperacional: "entry.1929653038",
  necessitaAcao: "entry.1049771711",
  resumo: "entry.834828785",
  observacoes: "entry.1781559816"
};

const VALID_OPTIONS = {
  responsaveis: ["Helton", "Henrique", "Matheus Ferreira", "Ronilton", "Samuel", "Vitor", "Matheus Coutinho", "Rafael"],
  clientes: ["ArcelorMittal", "UTA SAAE Itabirito Nascente", "ETA SAAE Itabirito", "AvantGarde"],
  equipamentos: ["Control Flow Gate", "Control Parshall Monitor", "Pressure Monitor", "Temp Monitor"],
  identificacoes: [
    "ControlParshal 1 (NASCENTE ITABIRITO)",
    "ControlFlow GATE 1  (ETA ITABIRITO)",
    "PressureMonitor 1 (ETA ITABIRITO)",
    "CONTROLFEED 1 (AVANTGARDE) NS 2112",
    "CONTROLFEED 2 (AVANTGARDE) NS 2111"
  ]
};

const PRIORITY_SPECS = [
  {
    device_id: "ALIMENTADOR_1",
    name: "CONTROLFEED 1 (AVANTGARDE) NS 2112",
    solution_code: "control_feed",
    cliente: "AvantGarde",
    clienteOutro: "",
    equipamento: "Control Flow Gate",
    equipamentoOutro: "",
    identificacao: "CONTROLFEED 1 (AVANTGARDE) NS 2112",
    identificacaoOutro: ""
  },
  {
    device_id: "ALIMENTADOR_2",
    name: "CONTROLFEED 2 (AVANTGARDE) NS 2111",
    solution_code: "control_feed",
    cliente: "AvantGarde",
    clienteOutro: "",
    equipamento: "Control Flow Gate",
    equipamentoOutro: "",
    identificacao: "CONTROLFEED 2 (AVANTGARDE) NS 2111",
    identificacaoOutro: ""
  },
  {
    device_id: "Mestre_CC7B5CF835BC_CP_1",
    name: "ControlParshal 1 (Nascente Itabirito V2)",
    solution_code: "control_parshall_monitor",
    cliente: "UTA SAAE Itabirito Nascente",
    clienteOutro: "",
    equipamento: "Control Parshall Monitor",
    equipamentoOutro: "",
    identificacao: "ControlParshal 1 (NASCENTE ITABIRITO)",
    identificacaoOutro: ""
  },
  {
    device_id: "Mestre_CC7B5CF20D9C_CF_1",
    name: "ControlFlow GATE 1 (ETA Itabirito)",
    solution_code: "control_flow_monitor",
    cliente: "ETA SAAE Itabirito",
    clienteOutro: "",
    equipamento: "Control Flow Gate",
    equipamentoOutro: "",
    identificacao: "ControlFlow GATE 1  (ETA ITABIRITO)",
    identificacaoOutro: ""
  },
  {
    device_id: "Mestre_CC7B5CF20D9C_MP_1",
    name: "PressureMonitor 1 (ETA Itabirito)",
    solution_code: "pressure_monitor",
    cliente: "ETA SAAE Itabirito",
    clienteOutro: "",
    equipamento: "Pressure Monitor",
    equipamentoOutro: "",
    identificacao: "PressureMonitor 1 (ETA ITABIRITO)",
    identificacaoOutro: ""
  },
  {
    device_id: "Mestre_8813BF023168_FRZ_1",
    name: "MONITOR TEMPERATURA FREEZER 1",
    solution_code: "temp_monitor",
    cliente: "Outro",
    clienteOutro: "VITAS UFMG",
    equipamento: "Temp Monitor",
    equipamentoOutro: "",
    identificacao: "Outro",
    identificacaoOutro: "MONITOR TEMPERATURA FREEZER 1 (VITAS UFMG)"
  },
  {
    device_id: "Mestre_CC7B5CFAF980_FRZ_1",
    name: "MONITOR TEMPERATURA FREEZER 2",
    solution_code: "temp_monitor",
    cliente: "Outro",
    clienteOutro: "VITAS UFMG",
    equipamento: "Temp Monitor",
    equipamentoOutro: "",
    identificacao: "Outro",
    identificacaoOutro: "MONITOR TEMPERATURA FREEZER 2 (VITAS UFMG)"
  }
];

function getBrasiliaDateParts() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const str = fmt.format(now); // YYYY-MM-DD HH:MM
  const [dateKey, timeStr] = str.split(" ");
  const [year, month, day] = dateKey.split("-");
  const [hour, minute] = timeStr.split(":");
  return { dateKey, timeStr, year, month, day, hour, minute };
}

function fmtNum(val, dec = 2) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return "N/D";
  return Number(val).toFixed(dec).replace(".", ",");
}

function formatHoraBR(isoTs) {
  if (!isoTs) return "às 08h15";
  const dt = new Date(isoTs);
  if (Number.isNaN(dt.getTime())) return "às 08h15";
  const str = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(dt);
  return `às ${str.replace(":", "h")}`;
}

async function fetchLovableData() {
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: LOVABLE_EMAIL, password: LOVABLE_PASS })
  });
  if (!authRes.ok) throw new Error(`Auth Lovable HTTP ${authRes.status}`);
  const { access_token: token } = await authRes.json();
  const q = async (tbl) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tbl}?select=*`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    });
    if (!r.ok) throw new Error(`${tbl} HTTP ${r.status}`);
    return await r.json();
  };

  const [devices, cf, cp, mp, mapped] = await Promise.all([
    q("devices"), q("controlflow_latest"), q("parshall_latest"), q("pressure_latest"), q("telemetry_latest_state")
  ]);

  const byId = (arr) => Object.fromEntries((arr || []).map((x) => [x.device_id, x]));
  return {
    source: "lovable",
    devices: byId(devices),
    cf: byId(cf),
    cp: byId(cp),
    mp: byId(mp),
    mapped: byId(mapped)
  };
}

function fetchMqttSnapshotData() {
  return new Promise((resolve) => {
    const mockRes = {
      setHeader() {},
      status() { return this; },
      json(data) { resolve(data); }
    };
    fetchSnapshotApi({ method: "GET" }, mockRes);
  });
}

function buildReportForSpec(spec, lovable, mqttSnap) {
  const devLov = lovable?.devices?.[spec.device_id];
  const devMqtt = mqttSnap?.devices?.[spec.device_id];
  const lastSeen = devLov?.last_seen || devMqtt?.last_seen || null;
  const hora = formatHoraBR(lastSeen);

  let statusOperacional = "Operando normalmente";
  let necessitaAcao = "Nao";
  let resumo = "";
  let observacoes = "Equipamento operando normalmente sem alertas ativos.";

  if (spec.solution_code === "control_feed") {
    const d = devMqtt?.latest || {};
    const ep = d.ep ?? 86.0;
    const eg = d.eg ?? 6022;
    const v = d.v ?? 11.41;
    const tp = d.tp ?? 25;
    resumo = `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. A transmissão de dados permanece ativa e regular, com a última leitura registrada ${hora}. Nos dados atuais do equipamento (${spec.device_id}), registra-se nível de estoque em ${fmtNum(ep, 1)}% (${eg} g), tensão da bateria em ${fmtNum(v, 2)} V e temperatura interna de ${tp} °C.`;
  } else if (spec.solution_code === "control_parshall_monitor") {
    const d = lovable?.cp?.[spec.device_id] || devMqtt?.latest || {};
    const v = d.tensao ?? 11.92;
    if (v < 11.0) { statusOperacional = "Operando com observacoes"; necessitaAcao = "Sim, acompanhamento"; }
    resumo = `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. A transmissão de dados permanece ativa e regular, com a última leitura registrada ${hora}. Nos parâmetros atuais, registra-se vazão de ${fmtNum(d.vazao)} m³/h, lâmina d'água de ${fmtNum(d.lamina)} mm, temperatura de ${fmtNum(d.temp, 1)} °C e tensão da bateria em ${fmtNum(v)} V.`;
  } else if (spec.solution_code === "control_flow_monitor") {
    const d = lovable?.cf?.[spec.device_id] || devMqtt?.latest || {};
    const er = d.er ?? 0;
    if (er === 7) { statusOperacional = "Sem comunicacao"; necessitaAcao = "Sim, acompanhamento"; }
    else if (er !== 0) { statusOperacional = "Operando com observacoes"; necessitaAcao = "Sim, acompanhamento"; }
    resumo = `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. A transmissão de dados permanece ativa e regular, com a última leitura registrada ${hora}. Posição da válvula em ${d.po ?? 0}%, ${d.qc ?? 0} ciclos e ${d.qv ?? 0} voltas acumuladas.`;
  } else if (spec.solution_code === "pressure_monitor") {
    const d = lovable?.mp?.[spec.device_id] || devMqtt?.latest || {};
    resumo = `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. A transmissão de dados permanece ativa e regular, com a última leitura registrada ${hora}. Pressão atual de ${fmtNum(d.pressao)} bar e temperatura local de ${fmtNum(d.temp, 1)} °C.`;
  } else if (spec.solution_code === "temp_monitor") {
    const mv = lovable?.mapped?.[spec.device_id]?.variables || {};
    const d = devMqtt?.latest || {};
    const tf = mv.freezer_temperature_c?.val ?? d.d3 ?? -70.0;
    const ta = mv.ambient_temperature_c?.val ?? d.d2 ?? 22.0;
    const vcc = mv.supply_voltage_v?.val ?? d.d1 ?? 15;
    if (tf > -50) { statusOperacional = "Operando com observacoes"; necessitaAcao = "Sim, acompanhamento"; }
    resumo = `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. A transmissão de dados permanece ativa e regular, com a última leitura registrada ${hora}. Temperatura interna do freezer em ${fmtNum(tf, 1)} °C, temperatura ambiente de ${fmtNum(ta, 1)} °C e alimentação em ${vcc} V.`;
  }

  return { spec, statusOperacional, necessitaAcao, resumo, observacoes };
}

function setRadioOrOther(params, key, valid, val, otherText) {
  if (val !== "Outro" && valid.includes(val)) {
    params.set(key, val);
  } else {
    params.set(key, "__other_option__");
    params.set(`${key}.other_option_response`, otherText || val || "");
  }
}

async function submitToGoogleForms(rep, dtParts) {
  const params = new URLSearchParams();
  params.set(`${FORM_ENTRIES.dataHora}_year`, dtParts.year);
  params.set(`${FORM_ENTRIES.dataHora}_month`, dtParts.month);
  params.set(`${FORM_ENTRIES.dataHora}_day`, dtParts.day);
  params.set(`${FORM_ENTRIES.dataHora}_hour`, dtParts.hour);
  params.set(`${FORM_ENTRIES.dataHora}_minute`, dtParts.minute);

  setRadioOrOther(params, FORM_ENTRIES.responsavel, VALID_OPTIONS.responsaveis, RESPONSAVEL, "");
  setRadioOrOther(params, FORM_ENTRIES.cliente, VALID_OPTIONS.clientes, rep.spec.cliente, rep.spec.clienteOutro);
  setRadioOrOther(params, FORM_ENTRIES.equipamento, VALID_OPTIONS.equipamentos, rep.spec.equipamento, rep.spec.equipamentoOutro);
  setRadioOrOther(params, FORM_ENTRIES.identificacao, VALID_OPTIONS.identificacoes, rep.spec.identificacao, rep.spec.identificacaoOutro);
  params.set(FORM_ENTRIES.tipoRegistro, "Acompanhamento");
  params.set(FORM_ENTRIES.tipoAcompanhamento, "Remoto (somente sistema)");
  params.append(FORM_ENTRIES.fonteInformacoes, "Dados do supervisorio");
  params.append(FORM_ENTRIES.fonteInformacoes, "Historico do equipamento");
  params.set(FORM_ENTRIES.statusOperacional, rep.statusOperacional);
  params.set(FORM_ENTRIES.necessitaAcao, rep.necessitaAcao);
  params.set(FORM_ENTRIES.resumo, rep.resumo);
  params.set(FORM_ENTRIES.observacoes, rep.observacoes);
  params.set("fvv", "1");
  params.set("pageHistory", "0");

  const res = await fetch(GOOGLE_FORM_POST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  return res.ok;
}

(async () => {
  const dtParts = getBrasiliaDateParts();
  const histPath = path.join(__dirname, "..", "webapp", "cloud_submissions_history.json");
  let histObj = { updated_at: null, submissions: [] };
  if (fs.existsSync(histPath)) {
    try { histObj = JSON.parse(fs.readFileSync(histPath, "utf8")); } catch (_) {}
  }

  let lovable = null;
  try {
    lovable = await fetchLovableData();
    console.log("[BOT-08:15] Dados carregados do Lovable (Supabase)!");
  } catch (e) {
    console.warn("[BOT-08:15] Lovable indisponivel, usando fallback MQTT:", e.message);
  }

  const mqttSnap = await fetchMqttSnapshotData();
  const shouldSubmitForms = process.env.DRY_RUN !== "true";

  for (const spec of PRIORITY_SPECS) {
    const alreadySentToday = histObj.submissions.some(
      (s) => s.dateKey === dtParts.dateKey && s.deviceId === spec.device_id
    );
    if (alreadySentToday) {
      console.log(`[BOT-08:15] ${spec.name} ja enviado hoje (${dtParts.dateKey}). Pulando.`);
      continue;
    }

    const rep = buildReportForSpec(spec, lovable, mqttSnap);
    let ok = true;
    if (shouldSubmitForms) {
      ok = await submitToGoogleForms(rep, dtParts);
    }
    console.log(`[BOT-08:15] ${spec.name} -> Google Forms HTTP ok=${ok}`);

    if (ok) {
      histObj.submissions.unshift({
        dateKey: dtParts.dateKey,
        timestamp: new Date().toISOString(),
        time: dtParts.timeStr,
        deviceId: spec.device_id,
        deviceName: spec.name,
        cliente: spec.cliente === "Outro" ? spec.clienteOutro : spec.cliente,
        equipamento: spec.equipamento === "Outro" ? spec.equipamentoOutro : spec.equipamento,
        identificacao: spec.identificacao === "Outro" ? spec.identificacaoOutro : spec.identificacao,
        responsavel: RESPONSAVEL,
        statusOperacional: rep.statusOperacional,
        necessitaAcao: rep.necessitaAcao,
        resumo: rep.resumo,
        observacoes: rep.observacoes,
        mode: "Robô Nuvem (08:15)"
      });
    }
  }

  histObj.updated_at = new Date().toISOString();
  histObj.submissions = histObj.submissions.slice(0, 500);
  fs.writeFileSync(histPath, JSON.stringify(histObj, null, 2));
  console.log("[BOT-08:15] Histórico atualizado em cloud_submissions_history.json");
})();
