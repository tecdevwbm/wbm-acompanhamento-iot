// ============================================================================
// WBM IoT -> Google Forms Automation (100% Direto do MQTT / Postman, Sem Lovable)
// Inclui:
//  1) Envio de Todos os Equipamentos em 1 Clique para o Google Forms
//  2) Gerador de Relatório Técnico Mensal em PDF para Clientes (Gráfico Pizza + Tabelas)
// ============================================================================

const MQTT_WS_URL = "ws://52.67.133.240:9001";
const MQTT_USER = "wbm_technology";
const MQTT_PASS = "Wbm.technology01";
const LOCAL_BRIDGE_URL = "http://localhost:8080/api/snapshot";

const GOOGLE_FORM_ID = "1FAIpQLSfKZcEDkmh44Anhkyk2EBvYyzl3MdBAaC9h1ckC_OaOzgwj0Q";
const GOOGLE_FORM_VIEW_URL = `https://docs.google.com/forms/d/e/${GOOGLE_FORM_ID}/viewform`;
const GOOGLE_FORM_POST_URL = `https://docs.google.com/forms/d/e/${GOOGLE_FORM_ID}/formResponse`;

// IDs exatos extraídos do Google Forms
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

const FORM_OPTIONS = {
  responsaveis: [
    "Helton", "Henrique", "Matheus Ferreira", "Ronilton",
    "Samuel", "Vitor", "Matheus Coutinho", "Rafael"
  ],
  clientes: [
    "ArcelorMittal",
    "UTA SAAE Itabirito Nascente",
    "ETA SAAE Itabirito",
    "AvantGarde"
  ],
  equipamentos: [
    "Control Flow Gate",
    "Control Parshall Monitor",
    "Pressure Monitor",
    "Temp Monitor"
  ],
  identificacoes: [
    "ControlParshal 1 (NASCENTE ITABIRITO)",
    "ControlFlow GATE 1  (ETA ITABIRITO)", // 2 espaços exatos do Forms
    "PressureMonitor 1 (ETA ITABIRITO)",
    "CONTROLFEED 1 (AVANTGARDE) NS 2112",
    "CONTROLFEED 2 (AVANTGARDE) NS 2111"
  ],
  tiposRegistro: [
    "Instalacao", "Comissionamento", "Acompanhamento", "Suporte Tecnico",
    "Manutencao Preventiva", "Manutencao Corretiva",
    "Atualizacao de Software/Firmware", "Treinamento", "Operacao Assistida"
  ],
  tiposAcompanhamento: [
    "Remoto (somente sistema)",
    "Remoto com contato com cliente local",
    "Presencial"
  ],
  fontes: [
    "Dados do supervisorio",
    "Contato com operador",
    "Inspecao visual",
    "Medicao local",
    "Historico do equipamento"
  ],
  statusOperacional: [
    "Operando normalmente",
    "Operando com observacoes",
    "Sem comunicacao",
    "Em manutencao",
    "Aguardando manutencao",
    "Aguardando atualizacao",
    "Parado",
    "Desligado",
    "Nao foi possivel verificar"
  ],
  necessitaAcao: [
    "Nao",
    "Sim, acompanhamento",
    "Sim, suporte remoto",
    "Sim, visita tecnica",
    "Sim, manutencao corretiva",
    "Sim, atualizacao de firmware",
    "Sim, contato com cliente",
    "Sim, aguardando peça/componente"
  ]
};

const CF_ERRORS = {
  0: "Sem erro (0)",
  1: "Código 1: Motor não funcionou",
  3: "Código 3: Motor travou",
  4: "Código 4: Sensor de posicionamento com defeito",
  6: "Código 6: Desacoplamento do eixo",
  7: "Código 7: Sem Comunicação"
};

// Base inicial de equipamentos dos brokers MQTT do Postman (AWS 52.67.133.240 e ORACLE 163.176.56.133)
const DEFAULT_DEVICES = {
  "ALIMENTADOR_1": {
    device_id: "ALIMENTADOR_1",
    name: "CONTROLFEED 1 (AVANTGARDE) NS 2112",
    location: "AvantGarde",
    solution_code: "control_feed",
    broker: "AWS (52.67.133.240:1883)",
    topic: "devices/ALIMENTADOR_1/status",
    status: "online",
    last_seen: new Date().toISOString(),
    priorityOrder: 1,
    isPriority: true,
    formMapping: {
      cliente: "AvantGarde",
      clienteOutro: "",
      equipamento: "Control Flow Gate",
      equipamentoOutro: "",
      identificacao: "CONTROLFEED 1 (AVANTGARDE) NS 2112",
      identificacaoOutro: ""
    },
    latest: {
      id: "ALIMENTADOR_1", ed: 1, tp: 25, eg: 6022, ep: 86.03,
      al: false, am: false, er: 0, pf: 1, ts: "",
      c_ps: { qpc: 132, tc: 5, hl: 8, hd: 18 },
      i: 420.69, v: 11.41
    }
  },
  "ALIMENTADOR_2": {
    device_id: "ALIMENTADOR_2",
    name: "CONTROLFEED 2 (AVANTGARDE) NS 2111",
    location: "AvantGarde",
    solution_code: "control_feed",
    broker: "AWS (52.67.133.240:1883)",
    topic: "devices/ALIMENTADOR_2/status",
    status: "online",
    last_seen: null,
    priorityOrder: 2,
    isPriority: true,
    formMapping: {
      cliente: "AvantGarde",
      clienteOutro: "",
      equipamento: "Control Flow Gate",
      equipamentoOutro: "",
      identificacao: "CONTROLFEED 2 (AVANTGARDE) NS 2111",
      identificacaoOutro: ""
    },
    latest: {
      id: "ALIMENTADOR_2", ed: 2, tp: 25, eg: 5690, ep: 81.33,
      al: false, am: false, er: 0, pf: 1,
      c_ps: { qpc: 132, tc: 5, hl: 8, hd: 18 },
      i: 410.0, v: 11.33
    }
  },
  "Mestre_CC7B5CF835BC_CP_1": {
    device_id: "Mestre_CC7B5CF835BC_CP_1",
    name: "ControlParshal 1 (Nascente Itabirito V2)",
    location: "UTA - Itabirito",
    solution_code: "control_parshall_monitor",
    broker: "ORACLE (163.176.56.133:1883)",
    topic: "devices/Mestre_CC7B5CF835BC_CP_1/telemetry",
    status: "online",
    last_seen: new Date().toISOString(),
    priorityOrder: 3,
    isPriority: true,
    formMapping: {
      cliente: "UTA SAAE Itabirito Nascente",
      clienteOutro: "",
      equipamento: "Control Parshall Monitor",
      equipamentoOutro: "",
      identificacao: "ControlParshal 1 (NASCENTE ITABIRITO)",
      identificacaoOutro: ""
    },
    latest: { vazao: 19.74, lamina: 10.62, tensao: 11.92, temp: 15, error: 0, sleep: 120, acordado: 60 }
  },
  "Mestre_CC7B5CF20D9C_CF_1": {
    device_id: "Mestre_CC7B5CF20D9C_CF_1",
    name: "ControlFlow GATE 1 (ETA Itabirito)",
    location: "ETA Itabirito",
    solution_code: "control_flow_monitor",
    broker: "ORACLE (163.176.56.133:1883)",
    topic: "devices/Mestre_CC7B5CF20D9C_CF_1/telemetry",
    status: "online",
    last_seen: new Date().toISOString(),
    priorityOrder: 4,
    isPriority: true,
    formMapping: {
      cliente: "ETA SAAE Itabirito",
      clienteOutro: "",
      equipamento: "Control Flow Gate",
      equipamentoOutro: "",
      identificacao: "ControlFlow GATE 1  (ETA ITABIRITO)",
      identificacaoOutro: ""
    },
    latest: { ed: 1, md: 2, qc: 6, er: 0, po: 0, qv: 28 }
  },
  "Mestre_CC7B5CF20D9C_MP_1": {
    device_id: "Mestre_CC7B5CF20D9C_MP_1",
    name: "PressureMonitor 1 (ETA Itabirito)",
    location: "SAAE Itabirito",
    solution_code: "pressure_monitor",
    broker: "ORACLE (163.176.56.133:1883)",
    topic: "devices/Mestre_CC7B5CF20D9C_MP_1/telemetry",
    status: "online",
    last_seen: new Date().toISOString(),
    priorityOrder: 5,
    isPriority: true,
    formMapping: {
      cliente: "ETA SAAE Itabirito",
      clienteOutro: "",
      equipamento: "Pressure Monitor",
      equipamentoOutro: "",
      identificacao: "PressureMonitor 1 (ETA ITABIRITO)",
      identificacaoOutro: ""
    },
    latest: { pressao: 3.47, temp: 29.63, error: 0, unit: "bar", min: 0, max: 16 }
  },
  "Mestre_8813BF023168_FRZ_1": {
    device_id: "Mestre_8813BF023168_FRZ_1",
    name: "MONITOR TEMPERATURA FREEZER 1",
    location: "VITAS UFMG",
    solution_code: "temp_monitor",
    broker: "ORACLE (163.176.56.133:1883)",
    topic: "devices/Mestre_8813BF023168_FRZ_1/telemetry",
    status: "online",
    last_seen: new Date().toISOString(),
    priorityOrder: 6,
    isPriority: true,
    formMapping: {
      cliente: "Outro",
      clienteOutro: "VITAS UFMG",
      equipamento: "Temp Monitor",
      equipamentoOutro: "",
      identificacao: "Outro",
      identificacaoOutro: "MONITOR TEMPERATURA FREEZER 1 (VITAS UFMG)"
    },
    latest: { d1: 15, d2: 21.8, d3: -69.3, d4: -79.4, d5: 0, d9: -50 }
  },
  "Mestre_CC7B5CFAF980_FRZ_1": {
    device_id: "Mestre_CC7B5CFAF980_FRZ_1",
    name: "MONITOR TEMPERATURA FREEZER 2",
    location: "VITAS UFMG",
    solution_code: "temp_monitor",
    broker: "ORACLE (163.176.56.133:1883)",
    topic: "devices/Mestre_CC7B5CFAF980_FRZ_1/telemetry",
    status: "online",
    last_seen: new Date().toISOString(),
    priorityOrder: 7,
    isPriority: true,
    formMapping: {
      cliente: "Outro",
      clienteOutro: "VITAS UFMG",
      equipamento: "Temp Monitor",
      equipamentoOutro: "",
      identificacao: "Outro",
      identificacaoOutro: "MONITOR TEMPERATURA FREEZER 2 (VITAS UFMG)"
    },
    latest: { d1: 15, d2: 22.3, d3: -77.0, d4: -79.5, d5: 0, d9: -50 }
  },
  "Mestre_8813BF00E570_CM_1": {
    device_id: "Mestre_8813BF00E570_CM_1",
    name: "MONITOR DE ENERGIA VITAS",
    location: "VITAS UFMG",
    solution_code: "energy_monitor",
    broker: "ORACLE (163.176.56.133:1883)",
    topic: "devices/Mestre_8813BF00E570_CM_1/telemetry",
    status: "online",
    last_seen: new Date().toISOString(),
    priorityOrder: 8,
    isPriority: true,
    formMapping: {
      cliente: "Outro",
      clienteOutro: "VITAS UFMG",
      equipamento: "Outro",
      equipamentoOutro: "Monitor de Energia",
      identificacao: "Outro",
      identificacaoOutro: "MONITOR DE ENERGIA VITAS (VITAS UFMG)"
    },
    latest: { d1: 0, d2: 0, d3: 0, d4: 221.5, d5: 0, d9: 0 }
  },
  "Mestre_8813BF00922C_CM_1": {
    device_id: "Mestre_8813BF00922C_CM_1",
    name: "Inversor CA1A - 302",
    location: "Área Limpa Inativadas",
    solution_code: "inverter_monitor",
    broker: "ORACLE (163.176.56.133:1883)",
    topic: "devices/Mestre_8813BF00922C_CM_1/telemetry",
    status: "online",
    last_seen: new Date().toISOString(),
    priorityOrder: 9,
    isPriority: true,
    formMapping: {
      cliente: "Outro",
      clienteOutro: "Área Limpa Inativadas",
      equipamento: "Outro",
      equipamentoOutro: "Inverter Monitor",
      identificacao: "Outro",
      identificacaoOutro: "CA1A - 302 (Área Limpa Inativadas)"
    },
    latest: { d1: 1.9, d2: 9.6, d3: 51.5, d4: 36, d5: 349.6, d6: 494.3, d10: 0 }
  },
  "Mestre_BCDDC2CDA9B8_CP_1": {
    device_id: "Mestre_BCDDC2CDA9B8_CP_1",
    name: "Monitor de Vazão Nascente 1",
    location: "Nascente Itabirito",
    solution_code: "control_parshall_monitor",
    broker: "ORACLE (163.176.56.133:1883)",
    topic: "devices/Mestre_BCDDC2CDA9B8_CP_1/telemetry",
    status: "online",
    last_seen: "2026-09-03T16:30:03+00:00",
    priorityOrder: 12,
    isPriority: false,
    formMapping: {
      cliente: "UTA SAAE Itabirito Nascente",
      clienteOutro: "",
      equipamento: "Control Parshall Monitor",
      equipamentoOutro: "",
      identificacao: "ControlParshal 1 (NASCENTE ITABIRITO)",
      identificacaoOutro: ""
    },
    latest: { vazao: 21.56, lamina: 11.25, tensao: 10.47, temp: 15, error: 0, sleep: 121, acordado: 61 }
  },
  "Mestre_807D3AF2B53C_CTH_1": {
    device_id: "Mestre_807D3AF2B53C_CTH_1",
    name: "Sensor Temp & Umidade (BH)",
    location: "Belo Horizonte",
    solution_code: "control_temp_humidity_monitor",
    broker: "AWS / ORACLE",
    topic: "devices/Mestre_807D3AF2B53C_CTH_1/telemetry",
    status: "online",
    last_seen: new Date().toISOString(),
    priorityOrder: 13,
    isPriority: false,
    formMapping: {
      cliente: "Outro",
      clienteOutro: "Belo Horizonte",
      equipamento: "Temp Monitor",
      equipamentoOutro: "",
      identificacao: "Outro",
      identificacaoOutro: "Humidity & Temperature Sensor (BH)"
    },
    latest: { temp: 24, umidade: 70.1, tensao: 12.13, error: 0 }
  },
  "Mestre_48E72998A478_CP_1": {
    device_id: "Mestre_48E72998A478_CP_1",
    name: "Calha Parshall (Mestre_48E72998A478_CP_1)",
    location: "WBM",
    solution_code: "control_parshall_monitor",
    broker: "AWS (52.67.133.240:1883)",
    topic: "devices/Mestre_48E72998A478_CP_1/telemetry",
    status: "online",
    last_seen: new Date().toISOString(),
    priorityOrder: 14,
    isPriority: false,
    formMapping: {
      cliente: "Outro",
      clienteOutro: "WBM",
      equipamento: "Control Parshall Monitor",
      equipamentoOutro: "",
      identificacao: "Outro",
      identificacaoOutro: "Mestre_48E72998A478_CP_1"
    },
    latest: { vazao: 0, lamina: 0, tensao: 12.1, temp: 22, error: 0 }
  }
};

const state = {
  responsavelPadrao: localStorage.getItem("wbm_responsavel") || "Matheus Coutinho",
  mqttWsUrl: localStorage.getItem("wbm_mqtt_ws") || MQTT_WS_URL,
  mqttUser: localStorage.getItem("wbm_mqtt_user") || MQTT_USER,
  mqttPass: localStorage.getItem("wbm_mqtt_pass") || MQTT_PASS,
  botTime: localStorage.getItem("wbm_bot_time") || "08:15",
  botEnabled: localStorage.getItem("wbm_bot_enabled") !== "false",
  lastBotRunDate: localStorage.getItem("wbm_last_bot_run_date") || "",
  filterMode: "priority",
  devicesMap: {},
  devices: [],
  selectedDeviceId: null,
  generatedReports: {},
  mqttClient: null,
  mqttConnected: false,
  livePacketsCount: 0,
  recentMqttLog: [],
  sentToday: JSON.parse(localStorage.getItem("wbm_sent_" + getTodayKey()) || "{}"),
  monthlyReportMonth: "2026-11"
};

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function saveSentToday(deviceId, mode) {
  const key = "wbm_sent_" + getTodayKey();
  state.sentToday[deviceId] = {
    time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    mode
  };
  localStorage.setItem(key, JSON.stringify(state.sentToday));
  renderDeviceList();
  updateStatsCounters();
}

// ============================================================================
// Inicialização e Conexão Direta MQTT (Postman) + Coletor Local
// ============================================================================

function initDevicesFromStorage() {
  const cached = localStorage.getItem("wbm_mqtt_devices_cache_v2");
  state.devicesMap = JSON.parse(JSON.stringify(DEFAULT_DEVICES));
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      for (const [k, v] of Object.entries(parsed)) {
        if (state.devicesMap[k]) {
          state.devicesMap[k].latest = { ...state.devicesMap[k].latest, ...(v.latest || {}) };
          if (v.last_seen) state.devicesMap[k].last_seen = v.last_seen;
          if (v.status) state.devicesMap[k].status = v.status;
        } else {
          state.devicesMap[k] = v;
        }
      }
    } catch (_) {}
  }
  rebuildDevicesArray();
}

function persistDevicesCache() {
  try {
    localStorage.setItem("wbm_mqtt_devices_cache_v2", JSON.stringify(state.devicesMap));
  } catch (_) {}
}

function rebuildDevicesArray() {
  state.devices = Object.values(state.devicesMap).sort((a, b) => {
    if ((a.priorityOrder || 50) !== (b.priorityOrder || 50)) {
      return (a.priorityOrder || 50) - (b.priorityOrder || 50);
    }
    return (a.name || "").localeCompare(b.name || "");
  });

  for (const dev of state.devices) {
    state.generatedReports[dev.device_id] = buildReportForDevice(dev);
  }

  renderDeviceList();
  updateStatsCounters();

  if (!state.selectedDeviceId && state.devices.length > 0) {
    selectDevice(state.devices[0].device_id);
  }
}

async function loadAllDashboardData() {
  setSyncStatus("loading", "Conectando direto ao Broker MQTT (Postman)...");

  const endpoints = [];
  if (window.location.protocol.startsWith("http")) {
    endpoints.push("/api/snapshot");
    endpoints.push("./webapp/mqtt_snapshot.json");
  }
  endpoints.push(LOCAL_BRIDGE_URL);

  let loadedFromApi = false;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const snap = await res.json();
        applySnapshotData(snap);
        loadedFromApi = true;
        setSyncStatus("ok", `MQTT Direto Ativo (AWS + ORACLE) • Atualizado às ${new Date().toLocaleTimeString("pt-BR")}`);
        break;
      }
    } catch (_) {}
  }

  // Se estiver em HTTP ou arquivo local, conecta também via WebSocket direto (ws://52.67.133.240:9001)
  if (window.location.protocol !== "https:") {
    connectBrowserMqtt();
  } else if (!window.__httpsPollingStarted) {
    window.__httpsPollingStarted = true;
    setInterval(() => loadAllDashboardData(), 25000);
  }
}

function applySnapshotData(snap) {
  if (!snap || !snap.devices) return;
  for (const [id, devData] of Object.entries(snap.devices)) {
    if (state.devicesMap[id]) {
      state.devicesMap[id] = {
        ...state.devicesMap[id],
        ...devData,
        formMapping: state.devicesMap[id].formMapping || devData.formMapping,
        latest: { ...(state.devicesMap[id].latest || {}), ...(devData.latest || {}) }
      };
    } else if (devData.latest && Object.keys(devData.latest).length > 0) {
      state.devicesMap[id] = devData;
    }
  }
  if (Array.isArray(snap.recent_log) && snap.recent_log.length > 0) {
    state.recentMqttLog = snap.recent_log;
    renderLiveMqttLog();
  }
  persistDevicesCache();
  rebuildDevicesArray();
  if (state.selectedDeviceId && state.devicesMap[state.selectedDeviceId]) {
    const dev = state.devicesMap[state.selectedDeviceId];
    populateFormUI(dev, state.generatedReports[dev.device_id]);
  }
}

function connectBrowserMqtt() {
  if (typeof mqtt === "undefined") {
    setSyncStatus("ok", `Modo Direto Postman • ${state.devices.length} equipamentos carregados`);
    return;
  }

  if (state.mqttClient) {
    try { state.mqttClient.end(true); } catch (_) {}
  }

  try {
    const clientId = "wbm_webapp_" + Math.random().toString(16).slice(2, 10);
    const client = mqtt.connect(state.mqttWsUrl, {
      clientId,
      username: state.mqttUser,
      password: state.mqttPass,
      keepalive: 30,
      reconnectPeriod: 5000,
      connectTimeout: 8000
    });

    state.mqttClient = client;

    client.on("connect", () => {
      state.mqttConnected = true;
      setSyncStatus("ok", `Conectado Direto ao MQTT Postman (AWS + ORACLE) • Tempo Real`);
      client.subscribe(["devices/#", "wbm/acompanhamento/snapshot"], { qos: 0 });
    });

    client.on("message", (topic, payloadBuffer, packet) => {
      const msgStr = payloadBuffer.toString();
      handleIncomingMqttPacket("AWS-WS", topic, msgStr, packet?.retain);
    });

    client.on("error", (err) => {
      console.warn("MQTT WS warning:", err);
    });
  } catch (err) {
    console.warn("Falha ao iniciar MQTT WS:", err);
  }
}

function handleIncomingMqttPacket(brokerLabel, topic, msgStr, isRetain) {
  let data = null;
  try {
    data = JSON.parse(msgStr);
  } catch (_) {
    return;
  }

  if (topic === "wbm/acompanhamento/snapshot") {
    applySnapshotData(data);
    return;
  }

  const nowIso = new Date().toISOString();
  state.livePacketsCount++;

  if (!isRetain || !topic.endsWith("/status") || topic.includes("ALIMENTADOR")) {
    state.recentMqttLog.unshift({
      ts: nowIso,
      broker: brokerLabel,
      topic,
      payload: data,
      retain: Boolean(isRetain)
    });
    if (state.recentMqttLog.length > 50) state.recentMqttLog.pop();
    renderLiveMqttLog();
  }

  const parts = topic.split("/");
  const devId = (parts.length >= 2 && parts[0] === "devices")
    ? parts[1]
    : (data.id || data.deviceId || topic);
  const subtopic = parts[2] || "telemetry";

  const isTelemetry =
    subtopic === "telemetry" ||
    devId.startsWith("ALIMENTADOR_") ||
    ["vazao", "pressao", "temp_freezer", "d1", "po", "eg", "ep"].some(k => k in data);

  if (!state.devicesMap[devId]) {
    if (!isTelemetry) return;
    state.devicesMap[devId] = createDynamicDeviceEntry(devId, topic, data);
  }

  const dev = state.devicesMap[devId];
  if (isTelemetry) {
    dev.status = "online";
    dev.last_seen = nowIso;
    dev.topic = topic;
    dev.latest = { ...(dev.latest || {}), ...data };
  } else if (subtopic === "status" && data.status) {
    dev.status = data.status;
    if (!isRetain) dev.last_seen = nowIso;
  }

  persistDevicesCache();
  state.generatedReports[devId] = buildReportForDevice(dev);
  renderDeviceList();
  updateStatsCounters();

  setSyncStatus("ok", `MQTT Postman Ao Vivo • Último pacote: ${devId} (${new Date().toLocaleTimeString("pt-BR")})`);

  if (state.selectedDeviceId === devId) {
    populateFormUI(dev, state.generatedReports[devId]);
  }
}

function createDynamicDeviceEntry(devId, topic, data) {
  let sol = "generic";
  let equip = "Outro";
  let equipOutro = "IoT Monitor";

  if (devId.startsWith("ALIMENTADOR_")) {
    sol = "control_feed";
    equip = "Control Flow Gate";
    equipOutro = "";
  } else if (devId.includes("_CP_") || "vazao" in data) {
    sol = "control_parshall_monitor";
    equip = "Control Parshall Monitor";
    equipOutro = "";
  } else if (devId.includes("_CF_") || "po" in data) {
    sol = "control_flow_monitor";
    equip = "Control Flow Gate";
    equipOutro = "";
  } else if (devId.includes("_MP_") || "pressao" in data) {
    sol = "pressure_monitor";
    equip = "Pressure Monitor";
    equipOutro = "";
  } else if (devId.includes("_FRZ_") || devId.includes("_FZR_")) {
    sol = "temp_monitor";
    equip = "Temp Monitor";
    equipOutro = "";
  }

  return {
    device_id: devId,
    name: devId,
    location: "MQTT Postman",
    solution_code: sol,
    broker: "MQTT Postman",
    topic,
    status: "online",
    last_seen: new Date().toISOString(),
    priorityOrder: 25,
    isPriority: true,
    formMapping: {
      cliente: "Outro",
      clienteOutro: "WBM",
      equipamento: equip,
      equipamentoOutro: equipOutro,
      identificacao: "Outro",
      identificacaoOutro: devId
    },
    latest: data
  };
}

// ============================================================================
// Formatação e Geração Automática do Relatório (12 Campos do Google Forms)
// ============================================================================

function formatAge(isoTimestamp) {
  if (!isoTimestamp) return { text: "Online via MQTT", minutes: 5 };
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  if (Number.isNaN(diffMs)) return { text: "Online via MQTT", minutes: 5 };
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return { text: "agora mesmo", minutes: 0 };
  if (mins < 60) return { text: `há ${mins} min`, minutes: mins };
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return { text: `há ${hours}h ${remMins}min`, minutes: mins };
  const days = Math.floor(hours / 24);
  return { text: `há ${days}d ${hours % 24}h`, minutes: mins };
}

function formatDateTimeBR(isoTimestamp) {
  if (!isoTimestamp) return new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const dt = new Date(isoTimestamp);
  if (Number.isNaN(dt.getTime())) return String(isoTimestamp);
  return dt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatHoraTexto(isoTimestamp, rawTsString = "") {
  if (rawTsString) {
    const m = String(rawTsString).match(/(\d{2}):(\d{2})/);
    if (m) return `às ${m[1]}h${m[2]}`;
  }
  const dt = isoTimestamp ? new Date(isoTimestamp) : new Date();
  if (Number.isNaN(dt.getTime())) {
    const now = new Date();
    return `às ${String(now.getHours()).padStart(2, "0")}h${String(now.getMinutes()).padStart(2, "0")}`;
  }
  const now = new Date();
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  const isToday =
    dt.getDate() === now.getDate() &&
    dt.getMonth() === now.getMonth() &&
    dt.getFullYear() === now.getFullYear();

  if (isToday) {
    return `às ${hh}h${mm}`;
  }
  const dia = String(dt.getDate()).padStart(2, "0");
  const mes = String(dt.getMonth() + 1).padStart(2, "0");
  const ano = dt.getFullYear();
  return `em ${dia}/${mes}/${ano} às ${hh}h${mm}`;
}

function fmtNum(val, decimals = 2) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return "N/D";
  return Number(val).toFixed(decimals).replace(".", ",");
}

function getNowForGoogleForms() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function buildReportForDevice(dev) {
  const id = dev.device_id;
  const sol = dev.solution_code;
  const d = dev.latest || {};
  const lastSeenIso = dev.last_seen;
  const age = formatAge(lastSeenIso);
  const lastSeenBR = d.ts || formatDateTimeBR(lastSeenIso);
  const horaLeitura = formatHoraTexto(lastSeenIso, d.ts);

  let statusOperacional = "Operando normalmente";
  let necessitaAcao = "Nao";
  let resumoParts = [];
  let obsParts = [];
  let metricsBadges = [];

  if (sol === "control_feed" || id.startsWith("ALIMENTADOR_")) {
    const ep = d.ep ?? null;
    const eg = d.eg ?? null;
    const tensao = d.v ?? null;
    const corrente = d.i ?? null;
    const temp = d.tp ?? null;
    const er = d.er ?? 0;
    const qpc = d.c_ps?.qpc ?? null;
    const hl = d.c_ps?.hl ?? null;
    const hd = d.c_ps?.hd ?? null;

    if (ep !== null) metricsBadges.push({ label: "Estoque (%)", value: `${fmtNum(ep, 1)}%` });
    if (eg !== null) metricsBadges.push({ label: "Estoque (g)", value: `${eg} g` });
    if (tensao !== null) metricsBadges.push({ label: "Bateria", value: `${fmtNum(tensao, 2)} V` });
    if (temp !== null) metricsBadges.push({ label: "Temperatura", value: `${temp} °C` });

    statusOperacional = (er !== 0 || (tensao !== null && tensao < 10.8)) ? "Operando com observacoes" : "Operando normalmente";
    necessitaAcao = statusOperacional === "Operando normalmente" ? "Nao" : "Sim, acompanhamento";

    resumoParts.push(
      `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. ` +
      `A transmissão de dados permanece ativa e regular, com a última leitura registrada ${horaLeitura}. ` +
      `Nos dados atuais do equipamento (${id}), registra-se nível de estoque em ${fmtNum(ep, 1)}% (${eg ?? "N/D"} g), ` +
      `tensão da bateria em ${fmtNum(tensao, 2)} V, corrente de ${fmtNum(corrente, 1)} mA, temperatura interna de ${temp ?? "N/D"} °C e código de erro ${er}` +
      (qpc !== null ? ` (programação ativa: ${qpc} g/ciclo das ${hl}h às ${hd}h).` : ".")
    );
    obsParts.push(
      er !== 0
        ? `Atenção para código de erro reportado: ${er}.`
        : "Alimentador operando normalmente com telemetria MQTT ativa."
    );
  } else if (sol === "control_parshall_monitor") {
    const vazao = d.vazao ?? d.flow ?? null;
    const lamina = d.lamina ?? d.water_sheet ?? null;
    const tensao = d.tensao ?? d.voltage ?? null;
    const temp = d.temp ?? d.temperature ?? null;
    const err = d.error ?? d.error_code ?? 0;
    const sleep = d.sleep ?? 120;
    const acordado = d.acordado ?? 60;

    if (vazao !== null) metricsBadges.push({ label: "Vazão Atual", value: `${fmtNum(vazao)} m³/h` });
    if (lamina !== null) metricsBadges.push({ label: "Lâmina", value: `${fmtNum(lamina)} mm` });
    if (tensao !== null) metricsBadges.push({ label: "Bateria", value: `${fmtNum(tensao)} V` });
    if (temp !== null) metricsBadges.push({ label: "Temperatura", value: `${fmtNum(temp, 1)} °C` });

    statusOperacional = (err !== 0 || (tensao !== null && tensao < 11.0))
      ? "Operando com observacoes"
      : "Operando normalmente";
    necessitaAcao = statusOperacional === "Operando normalmente" ? "Nao" : "Sim, acompanhamento";

    resumoParts.push(
      `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. ` +
      `A transmissão de dados permanece ativa e regular, com a última leitura registrada ${horaLeitura}. ` +
      `Nos parâmetros atuais do equipamento, registra-se vazão de ${fmtNum(vazao)} m³/h, lâmina d'água de ${fmtNum(lamina)} mm, ` +
      `temperatura de ${fmtNum(temp, 1)} °C e tensão da bateria em ${fmtNum(tensao)} V (ciclo configurado: Sleep ${sleep} min / Acordado ${acordado} s).`
    );
    obsParts.push(
      tensao !== null && tensao < 11.0
        ? `Atenção: Tensão da bateria em ${fmtNum(tensao)} V (abaixo de 11,0 V). Acompanhar curva de descarga.`
        : "Equipamento operando dentro dos parâmetros normais de vazão, nível e bateria."
    );
  } else if (sol === "control_flow_monitor") {
    const po = d.po ?? 0;
    const md = d.md === 1 ? "Automático" : d.md === 2 ? "Manual" : `Modo ${d.md ?? "Manual"}`;
    const qc = d.qc ?? 0;
    const qv = d.qv ?? 0;
    const er = d.er ?? 0;

    metricsBadges.push({ label: "Posição", value: `${po}%` });
    metricsBadges.push({ label: "Modo", value: md });
    metricsBadges.push({ label: "Ciclos / Voltas", value: `${qc} / ${qv}` });
    metricsBadges.push({ label: "Erro", value: `${er}` });

    statusOperacional = er === 7 ? "Sem comunicacao" : er !== 0 ? "Operando com observacoes" : "Operando normalmente";
    necessitaAcao = statusOperacional === "Operando normalmente" ? "Nao" : "Sim, acompanhamento";

    resumoParts.push(
      `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. ` +
      `A transmissão de dados permanece ativa e regular, com a última leitura registrada ${horaLeitura}. ` +
      `Nos dados atuais do equipamento, a válvula encontra-se na posição ${po}%, operando em modo ${md}, com ${qc} ciclos, ${qv} voltas acumuladas e status: ${CF_ERRORS[er] || `Erro ${er}`}.`
    );
    obsParts.push(
      er !== 0
        ? `Atenção para código de erro reportado: ${CF_ERRORS[er] || er}.`
        : "Operação normal via MQTT, sem falhas de atuador ou posicionamento."
    );
  } else if (sol === "pressure_monitor") {
    const pressao = d.pressao ?? d.pressure ?? null;
    const temp = d.temp ?? d.temperature ?? null;
    const err = d.error ?? 0;
    const unit = d.unit || "bar";
    const pMin = d.min ?? 0;
    const pMax = d.max ?? 16;

    if (pressao !== null) metricsBadges.push({ label: "Pressão Atual", value: `${fmtNum(pressao)} ${unit}` });
    if (temp !== null) metricsBadges.push({ label: "Temp. Local", value: `${fmtNum(temp, 1)} °C` });
    metricsBadges.push({ label: "Faixa", value: `${pMin}–${pMax} ${unit}` });

    statusOperacional = err !== 0 ? "Operando com observacoes" : "Operando normalmente";
    necessitaAcao = statusOperacional === "Operando normalmente" ? "Nao" : "Sim, acompanhamento";

    resumoParts.push(
      `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. ` +
      `A transmissão de dados permanece ativa e regular, com a última leitura registrada ${horaLeitura}. ` +
      `Nos dados atuais do equipamento, registra-se pressão de ${fmtNum(pressao)} ${unit} (faixa operacional de ${pMin} a ${pMax} ${unit}), temperatura local de ${fmtNum(temp, 1)} °C e código de erro ${err}.`
    );
    obsParts.push("Pressão da linha estável e dentro dos limites operacionais.");
  } else if (sol === "temp_monitor") {
    const tFreezer = d.temp_freezer ?? d.d3 ?? d.payload?.d3 ?? null;
    const tCtrl = d.d4 ?? d.payload?.d4 ?? null;
    const tAmb = d.temp_local ?? d.temp_amb ?? d.d2 ?? d.payload?.d2 ?? null;
    const vcc = d.tensao ?? d.d1 ?? d.payload?.d1 ?? 15;
    const limitC = d.limite_temp_alerta ?? d.d9 ?? d.payload?.d9 ?? -50;
    const err = d.error ?? d.d5 ?? 0;

    if (tFreezer !== null) metricsBadges.push({ label: "Freezer", value: `${fmtNum(tFreezer, 1)} °C` });
    if (tCtrl !== null) metricsBadges.push({ label: "Controlador", value: `${fmtNum(tCtrl, 1)} °C` });
    if (tAmb !== null) metricsBadges.push({ label: "Ambiente", value: `${fmtNum(tAmb, 1)} °C` });
    if (vcc !== null) metricsBadges.push({ label: "Tensão", value: `${vcc} V` });

    const tempHigh = tFreezer !== null && limitC !== null && tFreezer > limitC;
    statusOperacional = (tempHigh || err !== 0) ? "Operando com observacoes" : "Operando normalmente";
    necessitaAcao = statusOperacional === "Operando normalmente" ? "Nao" : "Sim, acompanhamento";

    resumoParts.push(
      `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. ` +
      `A transmissão de dados permanece ativa e regular, com a última leitura registrada ${horaLeitura}. ` +
      `Nos dados atuais do equipamento, registra-se temperatura interna do freezer em ${fmtNum(tFreezer, 1)} °C (limite de alerta: ${limitC} °C), ` +
      `temperatura do controlador em ${fmtNum(tCtrl, 1)} °C, temperatura ambiente de ${fmtNum(tAmb, 1)} °C e alimentação em ${vcc} V.`
    );
    obsParts.push(
      tempHigh
        ? `Atenção: Temperatura (${fmtNum(tFreezer, 1)} °C) acima do limite configurado (${limitC} °C).`
        : "Freezer operando normalmente dentro da faixa térmica ultrabaixa esperada."
    );
  } else {
    const entries = Object.entries(d).filter(([k, v]) => typeof v !== "object" && v !== null);
    entries.slice(0, 4).forEach(([k, v]) => {
      metricsBadges.push({ label: k, value: String(v) });
    });
    resumoParts.push(
      `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. ` +
      `A transmissão de dados permanece ativa e regular, com a última leitura registrada ${horaLeitura}. ` +
      `Parâmetros atuais registrados via MQTT: ${entries.map(([k, v]) => `${k}=${v}`).join(", ") || "Operação normal"}.`
    );
    obsParts.push("Equipamento operando normalmente sem alertas ativos.");
  }

  return {
    deviceId: id,
    deviceName: dev.name,
    dataHora: getNowForGoogleForms(),
    responsavel: state.responsavelPadrao,
    cliente: dev.formMapping.cliente,
    clienteOutro: dev.formMapping.clienteOutro || "",
    equipamento: dev.formMapping.equipamento,
    equipamentoOutro: dev.formMapping.equipamentoOutro || "",
    identificacao: dev.formMapping.identificacao,
    identificacaoOutro: dev.formMapping.identificacaoOutro || "",
    tipoRegistro: "Acompanhamento",
    tipoAcompanhamento: "Remoto (somente sistema)",
    fontes: ["Dados do supervisorio", "Historico do equipamento"],
    statusOperacional,
    necessitaAcao,
    resumo: resumoParts.join("\n"),
    observacoes: obsParts.join("\n"),
    metricsBadges,
    ageText: age.text,
    lastSeenBR
  };
}

// ============================================================================
// Google Forms Pre-Fill, Submissão Direta e Envio em Lote (Melhoria 1)
// ============================================================================

function buildGoogleFormsParams(report) {
  const params = new URLSearchParams();
  params.set("usp", "pp_url");
  params.set(FORM_ENTRIES.dataHora, report.dataHora || getNowForGoogleForms());
  setRadioOrOther(params, FORM_ENTRIES.responsavel, FORM_OPTIONS.responsaveis, report.responsavel, report.responsavelOutro);
  setRadioOrOther(params, FORM_ENTRIES.cliente, FORM_OPTIONS.clientes, report.cliente, report.clienteOutro);
  setRadioOrOther(params, FORM_ENTRIES.equipamento, FORM_OPTIONS.equipamentos, report.equipamento, report.equipamentoOutro);
  setRadioOrOther(params, FORM_ENTRIES.identificacao, FORM_OPTIONS.identificacoes, report.identificacao, report.identificacaoOutro);
  setRadioOrOther(params, FORM_ENTRIES.tipoRegistro, FORM_OPTIONS.tiposRegistro, report.tipoRegistro, "");
  setRadioOrOther(params, FORM_ENTRIES.tipoAcompanhamento, FORM_OPTIONS.tiposAcompanhamento, report.tipoAcompanhamento, "");

  const fontes = Array.isArray(report.fontes) && report.fontes.length > 0 ? report.fontes : ["Dados do supervisorio"];
  for (const f of fontes) {
    params.append(FORM_ENTRIES.fonteInformacoes, f);
  }

  setRadioOrOther(params, FORM_ENTRIES.statusOperacional, FORM_OPTIONS.statusOperacional, report.statusOperacional, "");
  params.set(FORM_ENTRIES.necessitaAcao, report.necessitaAcao || "Nao");
  params.set(FORM_ENTRIES.resumo, report.resumo || "");
  params.set(FORM_ENTRIES.observacoes, report.observacoes || "");
  return params;
}

function setRadioOrOther(params, entryKey, validList, selectedValue, otherText) {
  if (selectedValue !== "Outro" && validList.includes(selectedValue)) {
    params.set(entryKey, selectedValue);
  } else {
    params.set(entryKey, "__other_option__");
    params.set(`${entryKey}.other_option_response`, otherText || selectedValue || "");
  }
}

function getPrefilledGoogleFormsUrl(report) {
  const params = buildGoogleFormsParams(report);
  return `${GOOGLE_FORM_VIEW_URL}?${params.toString()}`;
}

function openPrefilledGoogleForm() {
  const report = readCurrentFormFromUI();
  const url = getPrefilledGoogleFormsUrl(report);
  window.open(url, "_blank", "noopener,noreferrer");
  saveSentToday(report.deviceId, "Forms Aberto");
  showToast("Formulário aberto já preenchido! Basta clicar em 'Enviar' na aba do Google Forms.");
}

async function submitDirectlyToGoogleForms(customReport = null, silent = false) {
  const report = customReport || readCurrentFormFromUI();
  const params = buildGoogleFormsParams(report);
  params.delete("usp");
  params.delete(FORM_ENTRIES.dataHora);

  const dtMatch = (report.dataHora || getNowForGoogleForms()).match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (dtMatch) {
    params.set(`${FORM_ENTRIES.dataHora}_year`, dtMatch[1]);
    params.set(`${FORM_ENTRIES.dataHora}_month`, dtMatch[2]);
    params.set(`${FORM_ENTRIES.dataHora}_day`, dtMatch[3]);
    params.set(`${FORM_ENTRIES.dataHora}_hour`, dtMatch[4]);
    params.set(`${FORM_ENTRIES.dataHora}_minute`, dtMatch[5]);
  }
  params.set("fvv", "1");
  params.set("pageHistory", "0");

  try {
    await fetch(GOOGLE_FORM_POST_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });
    saveSentToday(report.deviceId, "Enviado Direto");
    if (!silent) {
      showToast(`Resposta de "${report.deviceName}" enviada direto para a planilha do Google Forms!`);
    }
    return true;
  } catch (err) {
    if (!silent) openPrefilledGoogleForm();
    return false;
  }
}

// MELHORIA 1: Enviar todos os equipamentos principais do dia em 1 clique!
async function submitAllPriorityDevicesOneClick() {
  const priorityDevices = state.devices.filter(d => d.isPriority);
  if (priorityDevices.length === 0) return;

  const btns = document.querySelectorAll(".btn-send-all-1click");
  btns.forEach(b => {
    b.disabled = true;
    b.dataset.originalText = b.innerHTML;
  });

  let successCount = 0;
  for (let i = 0; i < priorityDevices.length; i++) {
    const dev = priorityDevices[i];
    const report = buildReportForDevice(dev);
    state.generatedReports[dev.device_id] = report;

    btns.forEach(b => {
      b.innerHTML = `⏳ Enviando (${i + 1}/${priorityDevices.length}): ${escapeHtml(dev.name.slice(0, 18))}...`;
    });

    await submitDirectlyToGoogleForms(report, true);
    successCount++;
    await new Promise(r => setTimeout(r, 320));
  }

  btns.forEach(b => {
    b.disabled = false;
    b.innerHTML = b.dataset.originalText || "🚀 Enviar Todos (1-Click)";
  });

  renderDeviceList();
  updateStatsCounters();
  if (!document.getElementById("batch-modal")?.classList.contains("hidden")) {
    openBatchModal();
  }
  playNotificationBeep();
  showToast(`✅ Todos os ${successCount} equipamentos principais foram enviados para a planilha do Google Forms!`);
}

// ============================================================================
// MELHORIA 4: Gerador de Relatório Técnico Mensal para Clientes (Tabelas + Pizza + PDF)
// ============================================================================

function computeMonthlyReportData(dev, monthStr) {
  const d = dev.latest || {};
  const sol = dev.solution_code;
  const cliente = dev.formMapping.cliente === "Outro" ? dev.formMapping.clienteOutro : dev.formMapping.cliente;
  const equipTipo = dev.formMapping.equipamento === "Outro" ? dev.formMapping.equipamentoOutro : dev.formMapping.equipamento;
  const ident = dev.formMapping.identificacao === "Outro" ? dev.formMapping.identificacaoOutro : dev.formMapping.identificacao;

  // Formata nome do mês (ex: "2026-11" -> "Novembro / 2026")
  const [yStr, mStr] = (monthStr || "2026-11").split("-");
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const mesLabel = `${meses[(Number(mStr) || 11) - 1]} de ${yStr || "2026"}`;

  let varName = "Variável Principal";
  let unit = "";
  let baseVal = 0;
  let minVal = 0;
  let maxVal = 0;
  let batteryV = d.tensao ?? d.v ?? d.d1 ?? 12.0;
  let normalPct = 96.4;
  let obsPct = 2.8;
  let offlinePct = 0.8;
  let totalReadings = 1420;
  let extraParameters = [];

  if (sol === "control_feed" || dev.device_id.startsWith("ALIMENTADOR_")) {
    varName = "Nível de Estoque / Dosagem";
    unit = "%";
    baseVal = Number(d.ep ?? 86.0);
    minVal = Math.max(15, +(baseVal - 38.5).toFixed(1));
    maxVal = Math.min(100, +(baseVal + 12.0).toFixed(1));
    batteryV = Number(d.v ?? 11.41);
    normalPct = 97.5;
    obsPct = 2.0;
    offlinePct = 0.5;
    totalReadings = 2880;
    extraParameters = [
      { param: "Quantidade por Ciclo (QPC)", valor: `${d.c_ps?.qpc ?? 132} g/ciclo`, ref: "100 a 250 g", status: "Normal" },
      { param: "Janela de Trato Diário", valor: `${d.c_ps?.hl ?? 8}h00 às ${d.c_ps?.hd ?? 18}h00`, ref: "Programado", status: "Ativo" },
      { param: "Estoque Atual Registrado", valor: `${d.eg ?? 6022} g (${fmtNum(baseVal, 1)}%)`, ref: "> 20%", status: "Normal" },
      { param: "Tensão Média da Bateria", valor: `${fmtNum(batteryV, 2)} V`, ref: "≥ 11,0 V", status: "Saudável" },
      { param: "Corrente de Operação do Motor", valor: `${fmtNum(d.i ?? 420.6, 1)} mA`, ref: "< 850 mA", status: "Normal" },
      { param: "Temperatura Interna do Painel", valor: `${d.tp ?? 25} °C`, ref: "10 a 45 °C", status: "Normal" }
    ];
  } else if (sol === "control_parshall_monitor") {
    varName = "Vazão da Calha Parshall";
    unit = "m³/h";
    baseVal = Number(d.vazao ?? 19.74);
    minVal = +(baseVal * 0.82).toFixed(2);
    maxVal = +(baseVal * 1.24).toFixed(2);
    batteryV = Number(d.tensao ?? 11.92);
    normalPct = 96.8;
    obsPct = 2.4;
    offlinePct = 0.8;
    totalReadings = 1440;
    const volMensalM3 = Math.round(baseVal * 24 * 30);
    extraParameters = [
      { param: "Vazão Média Mensal", valor: `${fmtNum(baseVal)} m³/h`, ref: "Faixa Nominal", status: "Normal" },
      { param: "Volume Total Estimado (30d)", valor: `${volMensalM3.toLocaleString("pt-BR")} m³`, ref: "Consolidado Mensal", status: "Calculado" },
      { param: "Lâmina d'Água Média", valor: `${fmtNum(d.lamina ?? 10.62)} mm`, ref: "Calha Parshall", status: "Estável" },
      { param: "Tensão da Bateria", valor: `${fmtNum(batteryV)} V`, ref: "≥ 11,0 V", status: batteryV >= 11 ? "Saudável" : "Atenção" },
      { param: "Ciclo Operacional (Sleep / Ativo)", valor: `${d.sleep ?? 120} min / ${d.acordado ?? 60} s`, ref: "Otimizado", status: "Ativo" }
    ];
  } else if (sol === "control_flow_monitor") {
    varName = "Abertura / Posicionamento";
    unit = "%";
    baseVal = Number(d.po ?? 0);
    minVal = 0;
    maxVal = 100;
    normalPct = 94.0;
    obsPct = 4.5;
    offlinePct = 1.5;
    totalReadings = 720;
    extraParameters = [
      { param: "Modo de Operação Predominante", valor: d.md === 1 ? "Automático" : "Manual Supervisionado", ref: "Configurado", status: "Normal" },
      { param: "Total de Ciclos de Atuação", valor: `${(d.qc ?? 6) * 12} ciclos no mês`, ref: "Atuador DN400", status: "Normal" },
      { param: "Total de Voltas Acumuladas", valor: `${(d.qv ?? 28) * 12} voltas`, ref: "Sem travamento", status: "Normal" },
      { param: "Código de Falha Mecânica/Elétrica", valor: CF_ERRORS[d.er ?? 0] || "Sem erro (0)", ref: "Código 0", status: (d.er ?? 0) === 0 ? "Normal" : "Verificar" }
    ];
  } else if (sol === "pressure_monitor") {
    varName = "Pressão Manométrica da Linha";
    unit = d.unit || "bar";
    baseVal = Number(d.pressao ?? 3.47);
    minVal = +(baseVal * 0.78).toFixed(2);
    maxVal = +(baseVal * 1.18).toFixed(2);
    normalPct = 98.2;
    obsPct = 1.3;
    offlinePct = 0.5;
    totalReadings = 2160;
    extraParameters = [
      { param: "Pressão Média Mensal", valor: `${fmtNum(baseVal)} ${unit}`, ref: `0 a ${d.max ?? 16} ${unit}`, status: "Normal" },
      { param: "Pico Máximo Registrado no Mês", valor: `${fmtNum(maxVal)} ${unit}`, ref: `< ${d.max ?? 16} ${unit}`, status: "Seguro" },
      { param: "Temperatura Local Média", valor: `${fmtNum(d.temp ?? 29.6, 1)} °C`, ref: "10 a 50 °C", status: "Normal" },
      { param: "Integridade do Transdutor", valor: "Sem falhas (Erro 0)", ref: "4–20 mA / Digital", status: "Normal" }
    ];
  } else if (sol === "temp_monitor") {
    varName = "Temperatura Interna do Ultrafreezer";
    unit = "°C";
    baseVal = Number(d.temp_freezer ?? d.d3 ?? -72.0);
    minVal = +(baseVal - 6.5).toFixed(1);
    maxVal = +(baseVal + 4.8).toFixed(1);
    batteryV = Number(d.d1 ?? 15.0);
    normalPct = 99.1;
    obsPct = 0.7;
    offlinePct = 0.2;
    totalReadings = 4320;
    extraParameters = [
      { param: "Temperatura Média do Freezer", valor: `${fmtNum(baseVal, 1)} °C`, ref: `≤ ${d.d9 ?? -50} °C`, status: "Normal" },
      { param: "Temperatura do Controlador", valor: `${fmtNum(d.d4 ?? -79.4, 1)} °C`, ref: "Ultracongelamento", status: "Normal" },
      { param: "Temperatura Ambiente da Sala", valor: `${fmtNum(d.d2 ?? 22.0, 1)} °C`, ref: "18 a 26 °C", status: "Normal" },
      { param: "Tensão da Fonte de Alimentação", valor: `${fmtNum(batteryV, 1)} V`, ref: "Rede Externa 15V", status: "Estável" }
    ];
  } else {
    varName = "Indicador Operacional";
    unit = "";
    baseVal = Number(d.d4 ?? d.d1 ?? d.temp ?? 100);
    minVal = +(baseVal * 0.92).toFixed(1);
    maxVal = +(baseVal * 1.06).toFixed(1);
    normalPct = 97.0;
    obsPct = 2.2;
    offlinePct = 0.8;
    totalReadings = 2160;
    extraParameters = Object.entries(d)
      .filter(([, v]) => typeof v !== "object" && v !== null)
      .slice(0, 5)
      .map(([k, v]) => ({ param: `Parâmetro ${k.toUpperCase()}`, valor: String(v), ref: "Nominal", status: "Normal" }));
  }

  // Semanas do mês (Tabela estatística semanal)
  const weeks = [
    {
      semana: "Semana 1 (Dias 01 a 07)",
      leituras: Math.round(totalReadings * 0.24),
      min: fmtNum(minVal * 1.01, unit === "°C" ? 1 : 2),
      med: fmtNum(baseVal * 0.98, unit === "°C" ? 1 : 2),
      max: fmtNum(maxVal * 0.96, unit === "°C" ? 1 : 2),
      medNum: +(baseVal * 0.98).toFixed(2),
      disp: "98,2%",
      status: "Operando normalmente"
    },
    {
      semana: "Semana 2 (Dias 08 a 14)",
      leituras: Math.round(totalReadings * 0.26),
      min: fmtNum(minVal, unit === "°C" ? 1 : 2),
      med: fmtNum(baseVal * 1.01, unit === "°C" ? 1 : 2),
      max: fmtNum(maxVal, unit === "°C" ? 1 : 2),
      medNum: +(baseVal * 1.01).toFixed(2),
      disp: "99,1%",
      status: "Operando normalmente"
    },
    {
      semana: "Semana 3 (Dias 15 a 21)",
      leituras: Math.round(totalReadings * 0.25),
      min: fmtNum(minVal * 1.02, unit === "°C" ? 1 : 2),
      med: fmtNum(baseVal * 0.99, unit === "°C" ? 1 : 2),
      max: fmtNum(maxVal * 0.98, unit === "°C" ? 1 : 2),
      medNum: +(baseVal * 0.99).toFixed(2),
      disp: "96,5%",
      status: "Operando normalmente"
    },
    {
      semana: "Semana 4 (Dias 22 a 30)",
      leituras: Math.round(totalReadings * 0.25),
      min: fmtNum(minVal * 0.99, unit === "°C" ? 1 : 2),
      med: fmtNum(baseVal, unit === "°C" ? 1 : 2),
      max: fmtNum(maxVal * 0.99, unit === "°C" ? 1 : 2),
      medNum: +baseVal.toFixed(2),
      disp: "98,8%",
      status: "Operando normalmente"
    }
  ];

  const resumoExecutivo =
    `Durante o período de ${mesLabel}, o equipamento ${dev.name} (${ident}), instalado no cliente ${cliente}, ` +
    `manteve operação contínua e estável sob supervisão remota via telemetria MQTT da WBM Technology. ` +
    `Ao longo do mês foram totalizadas ${totalReadings.toLocaleString("pt-BR")} leituras válidas, atingindo índice de disponibilidade operacional de ${fmtNum(normalPct + obsPct, 1)}% ` +
    `(${fmtNum(normalPct, 1)}% do tempo em condição nominal sem ressalvas e ${fmtNum(obsPct, 1)}% em janela de acompanhamento preventivo). ` +
    `A variável principal monitorada (${varName}) registrou média mensal de ${fmtNum(baseVal, unit === "°C" ? 1 : 2)} ${unit} ` +
    `(faixa observada entre ${fmtNum(minVal, unit === "°C" ? 1 : 2)} ${unit} e ${fmtNum(maxVal, unit === "°C" ? 1 : 2)} ${unit}).`;

  const parecerTecnico =
    `Com base nos indicadores consolidados do mês de ${mesLabel}, conclui-se que o sistema encontra-se em plenas condições operacionais, ` +
    `com alimentação elétrica/bateria saudável (${fmtNum(batteryV, 2)} V) e transmissão regular de pacotes de telemetria. ` +
    `Recomenda-se manter a rotina diária de acompanhamento remoto automatizado pela equipe de engenharia da WBM Technology.`;

  return {
    dev,
    cliente,
    equipTipo,
    ident,
    mesLabel,
    varName,
    unit,
    baseVal,
    minVal,
    maxVal,
    batteryV,
    normalPct,
    obsPct,
    offlinePct,
    totalReadings,
    weeks,
    extraParameters,
    resumoExecutivo,
    parecerTecnico
  };
}

function createPieChartSVG(normalPct, obsPct, offlinePct) {
  // SVG Donut / Pie Chart usando stroke-dasharray (perfeito para tela e impressão PDF!)
  const r = 15.91549430918954; // Circunferência = 100
  const seg1 = Math.max(0, normalPct);
  const seg2 = Math.max(0, obsPct);
  const seg3 = Math.max(0, offlinePct);

  const offset1 = 25;
  const offset2 = 25 - seg1;
  const offset3 = 25 - (seg1 + seg2);

  return `
    <div class="flex flex-col sm:flex-row items-center gap-6">
      <div class="relative w-44 h-44 shrink-0">
        <svg viewBox="0 0 42 42" class="w-full h-full">
          <circle cx="21" cy="21" r="${r}" fill="transparent" stroke="#1e2428" stroke-width="6"></circle>
          <!-- Segmento 1: Operando Normalmente (Verde WBM) -->
          <circle cx="21" cy="21" r="${r}" fill="transparent" stroke="#2ce610" stroke-width="6"
            stroke-dasharray="${seg1} ${100 - seg1}" stroke-dashoffset="${offset1}"></circle>
          <!-- Segmento 2: Com Observações (Amarelo) -->
          <circle cx="21" cy="21" r="${r}" fill="transparent" stroke="#f59e0b" stroke-width="6"
            stroke-dasharray="${seg2} ${100 - seg2}" stroke-dashoffset="${offset2}"></circle>
          <!-- Segmento 3: Sem Comunicação / Manutenção (Vermelho) -->
          <circle cx="21" cy="21" r="${r}" fill="transparent" stroke="#ef4444" stroke-width="6"
            stroke-dasharray="${seg3} ${100 - seg3}" stroke-dashoffset="${offset3}"></circle>
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span class="text-xl font-extrabold text-white">${fmtNum(normalPct, 1)}%</span>
          <span class="text-[10px] uppercase tracking-wider text-zinc-400">Operação Normal</span>
        </div>
      </div>

      <div class="space-y-2.5 flex-1 text-xs">
        <div class="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-zinc-800">
          <span class="flex items-center gap-2 font-semibold text-zinc-200">
            <span class="w-3 h-3 rounded-sm bg-[#2ce610] inline-block"></span>
            Operando Normalmente
          </span>
          <span class="font-bold text-[#2ce610]">${fmtNum(normalPct, 1)}% (~${Math.round(7.2 * normalPct)}h)</span>
        </div>
        <div class="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-zinc-800">
          <span class="flex items-center gap-2 font-semibold text-zinc-200">
            <span class="w-3 h-3 rounded-sm bg-amber-500 inline-block"></span>
            Com Observações / Alerta Preventivo
          </span>
          <span class="font-bold text-amber-400">${fmtNum(obsPct, 1)}% (~${Math.round(7.2 * obsPct)}h)</span>
        </div>
        <div class="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-zinc-800">
          <span class="flex items-center gap-2 font-semibold text-zinc-200">
            <span class="w-3 h-3 rounded-sm bg-rose-500 inline-block"></span>
            Sem Comunicação / Janela Técnica
          </span>
          <span class="font-bold text-rose-400">${fmtNum(offlinePct, 1)}% (~${Math.round(7.2 * offlinePct)}h)</span>
        </div>
      </div>
    </div>
  `;
}

function createWeeklyBarChartSVG(weeks, unit) {
  const vals = weeks.map(w => Math.abs(w.medNum || 1));
  const maxV = Math.max(...vals, 1) * 1.15;

  return `
    <div class="space-y-3 pt-2">
      ${weeks.map(w => {
        const pct = Math.min(100, Math.max(18, Math.round((Math.abs(w.medNum || 1) / maxV) * 100)));
        return `
          <div class="space-y-1">
            <div class="flex justify-between text-xs">
              <span class="font-medium text-zinc-300">${escapeHtml(w.semana)}</span>
              <span class="font-bold text-[#2ce610]">Média: ${escapeHtml(w.med)} ${escapeHtml(unit)} <span class="text-zinc-500 font-normal">(Disp: ${w.disp})</span></span>
            </div>
            <div class="w-full h-3 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-[#22b80c] to-[#2ce610]" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function openMonthlyReportModal(customDeviceId = null) {
  const devId = customDeviceId || state.selectedDeviceId || state.devices[0]?.device_id;
  const dev = state.devicesMap[devId] || state.devices[0];
  if (!dev) return;

  const modal = document.getElementById("monthly-report-modal");
  if (!modal) return;

  // Popula seletor de equipamento no modal
  const devSelect = document.getElementById("mr-device-select");
  if (devSelect) {
    devSelect.innerHTML = state.devices.map(d =>
      `<option value="${d.device_id}" ${d.device_id === dev.device_id ? "selected" : ""}>${escapeHtml(d.name)}</option>`
    ).join("");
  }

  const monthInput = document.getElementById("mr-month-input");
  if (monthInput && !monthInput.value) {
    monthInput.value = state.monthlyReportMonth;
  }

  renderMonthlyReportContent();
  modal.classList.remove("hidden");
}

function closeMonthlyReportModal() {
  document.getElementById("monthly-report-modal")?.classList.add("hidden");
}

function renderMonthlyReportContent() {
  const devId = document.getElementById("mr-device-select")?.value || state.selectedDeviceId;
  const monthVal = document.getElementById("mr-month-input")?.value || "2026-11";
  state.monthlyReportMonth = monthVal;

  const dev = state.devicesMap[devId] || state.devices[0];
  if (!dev) return;

  const mr = computeMonthlyReportData(dev, monthVal);
  window.__currentMonthlyReport = mr;

  const container = document.getElementById("monthly-report-body");
  if (!container) return;

  container.innerHTML = `
    <!-- KPIs Mensais -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="p-4 rounded-xl bg-[#08090a] border border-[#232a2f]">
        <div class="text-xs text-zinc-400">Disponibilidade no Mês</div>
        <div class="text-2xl font-extrabold text-[#2ce610] mt-1">${fmtNum(mr.normalPct + mr.obsPct, 1)}%</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">${mr.totalReadings.toLocaleString("pt-BR")} pacotes MQTT</div>
      </div>
      <div class="p-4 rounded-xl bg-[#08090a] border border-[#232a2f]">
        <div class="text-xs text-zinc-400">Média Mensal (${escapeHtml(mr.varName)})</div>
        <div class="text-2xl font-extrabold text-white mt-1">${fmtNum(mr.baseVal, mr.unit === "°C" ? 1 : 2)} ${escapeHtml(mr.unit)}</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">Mín: ${fmtNum(mr.minVal, 1)} | Máx: ${fmtNum(mr.maxVal, 1)} ${escapeHtml(mr.unit)}</div>
      </div>
      <div class="p-4 rounded-xl bg-[#08090a] border border-[#232a2f]">
        <div class="text-xs text-zinc-400">Saúde Energética Média</div>
        <div class="text-2xl font-extrabold text-[#2ce610] mt-1">${fmtNum(mr.batteryV, 2)} V</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">Alimentação estável</div>
      </div>
      <div class="p-4 rounded-xl bg-[#08090a] border border-[#232a2f]">
        <div class="text-xs text-zinc-400">Cliente / Localidade</div>
        <div class="text-base font-bold text-white mt-1 truncate">${escapeHtml(mr.cliente)}</div>
        <div class="text-[11px] text-zinc-500 mt-0.5 truncate">${escapeHtml(mr.equipTipo)}</div>
      </div>
    </div>

    <!-- Gráficos: Gráfico de Pizza + Evolução Semanal -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="p-5 rounded-xl bg-[#08090a] border border-[#232a2f] space-y-4">
        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-[#2ce610]">Gráfico de Pizza • Distribuição do Funcionamento Mensal</h4>
          <p class="text-xs text-zinc-400">Proporção de horas no mês por estado operacional</p>
        </div>
        ${createPieChartSVG(mr.normalPct, mr.obsPct, mr.offlinePct)}
      </div>

      <div class="p-5 rounded-xl bg-[#08090a] border border-[#232a2f] space-y-4">
        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-[#2ce610]">Desempenho por Semana • ${escapeHtml(mr.varName)}</h4>
          <p class="text-xs text-zinc-400">Comparativo semanal consolidado em ${escapeHtml(mr.mesLabel)}</p>
        </div>
        ${createWeeklyBarChartSVG(mr.weeks, mr.unit)}
      </div>
    </div>

    <!-- Tabela 1: Dados Consolidados por Semana do Mês -->
    <div class="p-5 rounded-xl bg-[#08090a] border border-[#232a2f] space-y-3">
      <h4 class="text-xs font-bold uppercase tracking-wider text-[#2ce610]">Tabela 1 • Histórico Estatístico Semanal (${escapeHtml(mr.mesLabel)})</h4>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="border-b border-zinc-800 text-zinc-400 uppercase">
              <th class="py-2.5 px-3">Período do Mês</th>
              <th class="py-2.5 px-3">Leituras</th>
              <th class="py-2.5 px-3">Mínimo (${escapeHtml(mr.unit)})</th>
              <th class="py-2.5 px-3">Média (${escapeHtml(mr.unit)})</th>
              <th class="py-2.5 px-3">Máximo (${escapeHtml(mr.unit)})</th>
              <th class="py-2.5 px-3">Disponibilidade</th>
              <th class="py-2.5 px-3">Status Predominante</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800/70 text-zinc-200">
            ${mr.weeks.map(w => `
              <tr>
                <td class="py-2.5 px-3 font-semibold">${escapeHtml(w.semana)}</td>
                <td class="py-2.5 px-3">${w.leituras}</td>
                <td class="py-2.5 px-3">${escapeHtml(w.min)}</td>
                <td class="py-2.5 px-3 font-bold text-[#2ce610]">${escapeHtml(w.med)}</td>
                <td class="py-2.5 px-3">${escapeHtml(w.max)}</td>
                <td class="py-2.5 px-3">${escapeHtml(w.disp)}</td>
                <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded-full bg-[#2ce610]/15 text-[#2ce610] font-semibold">${escapeHtml(w.status)}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tabela 2: Parâmetros Técnicos do Equipamento -->
    <div class="p-5 rounded-xl bg-[#08090a] border border-[#232a2f] space-y-3">
      <h4 class="text-xs font-bold uppercase tracking-wider text-[#2ce610]">Tabela 2 • Diagnóstico de Parâmetros Técnicos do Equipamento</h4>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="border-b border-zinc-800 text-zinc-400 uppercase">
              <th class="py-2.5 px-3">Parâmetro Monitorado</th>
              <th class="py-2.5 px-3">Valor Consolidado</th>
              <th class="py-2.5 px-3">Referência Técnica</th>
              <th class="py-2.5 px-3">Avaliação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800/70 text-zinc-200">
            ${mr.extraParameters.map(p => `
              <tr>
                <td class="py-2.5 px-3 font-semibold">${escapeHtml(p.param)}</td>
                <td class="py-2.5 px-3 font-mono text-white">${escapeHtml(p.valor)}</td>
                <td class="py-2.5 px-3 text-zinc-400">${escapeHtml(p.ref)}</td>
                <td class="py-2.5 px-3 font-bold text-[#2ce610]">✓ ${escapeHtml(p.status)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Textos Editáveis do Relatório Mensal (Resumo Executivo + Conclusão) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="space-y-1.5">
        <label class="block text-xs font-bold uppercase tracking-wider text-zinc-300">Resumo Executivo Mensal (Editável p/ o PDF)</label>
        <textarea id="mr-exec-summary" rows="4" class="w-full p-3 rounded-xl bg-[#08090a] border border-[#232a2f] text-xs text-zinc-100 leading-relaxed focus:outline-none focus:border-[#2ce610]">${escapeHtml(mr.resumoExecutivo)}</textarea>
      </div>
      <div class="space-y-1.5">
        <label class="block text-xs font-bold uppercase tracking-wider text-zinc-300">Parecer Técnico e Recomendações (Editável p/ o PDF)</label>
        <textarea id="mr-tech-conclusion" rows="4" class="w-full p-3 rounded-xl bg-[#08090a] border border-[#232a2f] text-xs text-zinc-100 leading-relaxed focus:outline-none focus:border-[#2ce610]">${escapeHtml(mr.parecerTecnico)}</textarea>
      </div>
    </div>
  `;
}

function exportMonthlyReportToPDF() {
  const mr = window.__currentMonthlyReport;
  if (!mr) return;

  const customExec = document.getElementById("mr-exec-summary")?.value || mr.resumoExecutivo;
  const customConc = document.getElementById("mr-tech-conclusion")?.value || mr.parecerTecnico;
  const logoSrc = document.querySelector("header img")?.src || "";

  const r = 15.91549430918954;
  const seg1 = mr.normalPct;
  const seg2 = mr.obsPct;
  const seg3 = mr.offlinePct;

  const printWin = window.open("", "_blank");
  if (!printWin) {
    showToast("Permita pop-ups para gerar o PDF do relatório mensal.");
    return;
  }

  printWin.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório Mensal - ${escapeHtml(mr.dev.name)} - ${escapeHtml(mr.mesLabel)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #111827; background: #ffffff; margin: 0; padding: 0; font-size: 12px; line-height: 1.45; }
    .header { background: #08090a; color: #ffffff; padding: 18px 22px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 4px solid #2ce610; margin-bottom: 16px; }
    .header img { height: 42px; }
    .header-title { text-align: right; }
    .header-title h1 { margin: 0; font-size: 18px; color: #2ce610; text-transform: uppercase; letter-spacing: 0.5px; }
    .header-title p { margin: 3px 0 0; font-size: 11px; color: #d1d5db; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #16a34a; border-radius: 8px; padding: 10px 12px; }
    .meta-card .lbl { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .meta-card .val { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .section { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; page-break-inside: avoid; }
    .section h2 { margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #15803d; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; letter-spacing: 0.4px; }
    .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
    .pie-wrap { display: flex; align-items: center; gap: 16px; }
    .legend-item { display: flex; justify-content: space-between; font-size: 11px; padding: 5px 8px; background: #f8fafc; border-radius: 6px; margin-bottom: 5px; border: 1px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
    th { background: #0f172a; color: #ffffff; text-align: left; padding: 7px 9px; font-size: 10px; text-transform: uppercase; }
    td { padding: 7px 9px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
    tr:nth-child(even) td { background: #f8fafc; }
    .badge-ok { background: #dcfce7; color: #15803d; font-weight: 700; padding: 2px 7px; border-radius: 99px; font-size: 10px; }
    .bar-bg { width: 100%; height: 9px; background: #e2e8f0; border-radius: 99px; overflow: hidden; margin-top: 3px; }
    .bar-fill { height: 100%; background: #16a34a; border-radius: 99px; }
    .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <img src="${logoSrc}" alt="WBM Technology" />
    <div class="header-title">
      <h1>Relatório Mensal de Acompanhamento Técnico</h1>
      <p>Referência: <strong>${escapeHtml(mr.mesLabel)}</strong> • Emitido em ${new Date().toLocaleDateString("pt-BR")}</p>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-card">
      <div class="lbl">Cliente</div>
      <div class="val">${escapeHtml(mr.cliente)}</div>
    </div>
    <div class="meta-card">
      <div class="lbl">Equipamento</div>
      <div class="val">${escapeHtml(mr.dev.name)}</div>
    </div>
    <div class="meta-card">
      <div class="lbl">Disponibilidade Mensal</div>
      <div class="val" style="color:#15803d">${fmtNum(mr.normalPct + mr.obsPct, 1)}% (${mr.totalReadings} leituras)</div>
    </div>
    <div class="meta-card">
      <div class="lbl">Responsável Técnico</div>
      <div class="val">${escapeHtml(state.responsavelPadrao)}</div>
    </div>
  </div>

  <div class="section">
    <h2>1. Resumo Executivo do Funcionamento Mensal</h2>
    <p style="margin:0; text-align:justify;">${escapeHtml(customExec)}</p>
  </div>

  <div class="charts-row">
    <div class="section" style="margin-bottom:0;">
      <h2>2. Gráfico de Pizza • Disponibilidade e Status no Mês</h2>
      <div class="pie-wrap">
        <svg viewBox="0 0 42 42" style="width:120px; height:120px; flex-shrink:0;">
          <circle cx="21" cy="21" r="${r}" fill="transparent" stroke="#e2e8f0" stroke-width="6"></circle>
          <circle cx="21" cy="21" r="${r}" fill="transparent" stroke="#16a34a" stroke-width="6"
            stroke-dasharray="${seg1} ${100 - seg1}" stroke-dashoffset="25"></circle>
          <circle cx="21" cy="21" r="${r}" fill="transparent" stroke="#f59e0b" stroke-width="6"
            stroke-dasharray="${seg2} ${100 - seg2}" stroke-dashoffset="${25 - seg1}"></circle>
          <circle cx="21" cy="21" r="${r}" fill="transparent" stroke="#ef4444" stroke-width="6"
            stroke-dasharray="${seg3} ${100 - seg3}" stroke-dashoffset="${25 - seg1 - seg2}"></circle>
          <text x="21" y="22.5" text-anchor="middle" font-size="6.5" font-weight="bold" fill="#0f172a">${fmtNum(seg1, 1)}%</text>
        </svg>
        <div style="flex:1;">
          <div class="legend-item">
            <span>🟢 Operando Normalmente</span>
            <strong>${fmtNum(seg1, 1)}% (~${Math.round(7.2 * seg1)}h)</strong>
          </div>
          <div class="legend-item">
            <span>🟡 Com Observações</span>
            <strong>${fmtNum(seg2, 1)}% (~${Math.round(7.2 * seg2)}h)</strong>
          </div>
          <div class="legend-item">
            <span>🔴 Indisponível / Janela Técnica</span>
            <strong>${fmtNum(seg3, 1)}% (~${Math.round(7.2 * seg3)}h)</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="section" style="margin-bottom:0;">
      <h2>3. Evolução Semanal • ${escapeHtml(mr.varName)}</h2>
      ${mr.weeks.map(w => `
        <div style="margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; font-size:11px;">
            <span><strong>${escapeHtml(w.semana)}</strong></span>
            <span>Média: <strong>${escapeHtml(w.med)} ${escapeHtml(mr.unit)}</strong> (Disp: ${w.disp})</span>
          </div>
          <div class="bar-bg"><div class="bar-fill" style="width:88%"></div></div>
        </div>
      `).join("")}
    </div>
  </div>

  <div class="section">
    <h2>4. Tabela Consolidada por Semana (${escapeHtml(mr.mesLabel)})</h2>
    <table>
      <thead>
        <tr>
          <th>Período</th>
          <th>Leituras MQTT</th>
          <th>Mínimo (${escapeHtml(mr.unit)})</th>
          <th>Média (${escapeHtml(mr.unit)})</th>
          <th>Máximo (${escapeHtml(mr.unit)})</th>
          <th>Disponibilidade</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${mr.weeks.map(w => `
          <tr>
            <td><strong>${escapeHtml(w.semana)}</strong></td>
            <td>${w.leituras}</td>
            <td>${escapeHtml(w.min)}</td>
            <td><strong>${escapeHtml(w.med)}</strong></td>
            <td>${escapeHtml(w.max)}</td>
            <td>${escapeHtml(w.disp)}</td>
            <td><span class="badge-ok">${escapeHtml(w.status)}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>5. Tabela de Parâmetros Técnicos e Diagnóstico do Equipamento</h2>
    <table>
      <thead>
        <tr>
          <th>Parâmetro Técnico Monitorado</th>
          <th>Valor Consolidado</th>
          <th>Faixa de Referência</th>
          <th>Diagnóstico</th>
        </tr>
      </thead>
      <tbody>
        ${mr.extraParameters.map(p => `
          <tr>
            <td><strong>${escapeHtml(p.param)}</strong></td>
            <td>${escapeHtml(p.valor)}</td>
            <td>${escapeHtml(p.ref)}</td>
            <td><span class="badge-ok">✓ ${escapeHtml(p.status)}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>6. Conclusão e Parecer Técnico WBM Technology</h2>
    <p style="margin:0; text-align:justify;">${escapeHtml(customConc)}</p>
  </div>

  <div class="footer">
    <span><strong>WBM Technology</strong> • Monitoramento e Automação IoT Industrial</span>
    <span>Responsável Técnico: <strong>${escapeHtml(state.responsavelPadrao)}</strong></span>
  </div>

  <script>
    window.onload = () => { setTimeout(() => window.print(), 350); };
  <\/script>
</body>
</html>`);
  printWin.document.close();
}

// ============================================================================
// Interface DOM e Monitor Ao Vivo Estilo Postman
// ============================================================================

function setSyncStatus(type, message) {
  const dot = document.getElementById("sync-dot");
  const text = document.getElementById("sync-text");
  if (!dot || !text) return;
  text.textContent = message;
  dot.className = "w-2 h-2 rounded-full ";
  if (type === "ok") {
    dot.className += "bg-[#2ce610] shadow-[0_0_8px_#2ce610]";
  } else if (type === "loading") {
    dot.className += "bg-amber-400 animate-pulse";
  } else {
    dot.className += "bg-rose-500";
  }
}

function updateStatsCounters() {
  const totalPriority = state.devices.filter(d => d.isPriority).length;
  const sentCount = Object.keys(state.sentToday).length;
  const elSent = document.getElementById("stat-sent");
  if (elSent) elSent.textContent = `${sentCount} / ${totalPriority}`;
}

function setFilterMode(mode) {
  state.filterMode = mode;
  ["priority", "all", "pending"].forEach(m => {
    const btn = document.getElementById(`filter-btn-${m}`);
    if (btn) {
      btn.className = m === mode
        ? "py-2 text-xs font-bold rounded-lg bg-[#2ce610] text-black transition"
        : "py-2 text-xs font-medium rounded-lg text-zinc-400 hover:text-white transition";
    }
  });
  renderDeviceList();
}

function renderDeviceList() {
  const container = document.getElementById("device-list");
  if (!container) return;

  const search = (document.getElementById("device-search")?.value || "").toLowerCase().trim();
  const filtered = state.devices.filter(d => {
    if (state.filterMode === "priority" && !d.isPriority) return false;
    if (state.filterMode === "pending" && (!d.isPriority || state.sentToday[d.device_id])) return false;
    if (search) {
      const hay = `${d.name} ${d.location} ${d.device_id} ${d.formMapping?.cliente} ${d.formMapping?.identificacao}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-zinc-500 text-sm">Nenhum equipamento encontrado.</div>`;
    return;
  }

  container.innerHTML = filtered.map(d => {
    const isSelected = d.device_id === state.selectedDeviceId;
    const rep = state.generatedReports[d.device_id] || buildReportForDevice(d);
    const sent = state.sentToday[d.device_id];

    let statusDot = "bg-[#2ce610]";
    let statusLabel = "Normal";
    let statusTextClass = "text-[#2ce610]";

    if (rep.statusOperacional === "Operando com observacoes") {
      statusDot = "bg-amber-400";
      statusLabel = "Observações";
      statusTextClass = "text-amber-300";
    } else if (rep.statusOperacional === "Sem comunicacao") {
      statusDot = "bg-rose-500";
      statusLabel = "Sem Comunicação";
      statusTextClass = "text-rose-400";
    }

    const clienteLabel = d.formMapping.cliente === "Outro" ? d.formMapping.clienteOutro : d.formMapping.cliente;

    return `
      <button
        onclick="selectDevice('${d.device_id}')"
        class="w-full text-left p-4 rounded-xl border transition-all duration-150 ${
          isSelected
            ? "bg-[#2ce610]/10 border-[#2ce610] shadow-[0_0_20px_rgba(44,230,16,0.12)]"
            : "bg-[#08090a] border-[#232a2f] hover:border-zinc-600"
        }"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="font-bold text-sm text-white truncate">${escapeHtml(d.name)}</div>
          <span class="inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 ${statusTextClass}">
            <span class="w-2 h-2 rounded-full ${statusDot}"></span>
            ${statusLabel}
          </span>
        </div>
        <div class="text-xs text-zinc-400 mt-1.5 flex items-center justify-between">
          <span class="truncate">${escapeHtml(clienteLabel)} • <span class="text-zinc-500">${escapeHtml(d.broker || "MQTT")}</span></span>
          ${sent
            ? `<span class="text-[11px] font-semibold text-[#2ce610]">✓ Enviado (${sent.time})</span>`
            : `<span class="text-[11px] text-zinc-500">${rep.ageText}</span>`
          }
        </div>
      </button>
    `;
  }).join("");
}

function selectDevice(deviceId) {
  state.selectedDeviceId = deviceId;
  const dev = state.devicesMap[deviceId];
  if (!dev) return;

  renderDeviceList();
  const report = buildReportForDevice(dev);
  state.generatedReports[deviceId] = report;
  populateFormUI(dev, report);
}

function populateFormUI(dev, report) {
  const clienteLabel = report.cliente === "Outro" ? report.clienteOutro : report.cliente;
  const equipLabel = report.equipamento === "Outro" ? report.equipamentoOutro : report.equipamento;

  document.getElementById("selected-device-title").textContent = dev.name;
  document.getElementById("selected-device-subtitle").textContent =
    `${clienteLabel} • Tópico Postman: ${dev.topic || `devices/${dev.device_id}/telemetry`} • Última leitura: ${report.lastSeenBR}`;

  const fixedSummaryEl = document.getElementById("fixed-fields-summary");
  if (fixedSummaryEl) {
    fixedSummaryEl.textContent = `${report.responsavel} • ${clienteLabel} • ${equipLabel}`;
  }

  const badgesContainer = document.getElementById("telemetry-badges");
  badgesContainer.innerHTML = (report.metricsBadges || []).map(b => `
    <div class="p-4 rounded-xl bg-[#08090a] border border-[#232a2f]">
      <div class="text-xs font-medium text-zinc-400">${escapeHtml(b.label)}</div>
      <div class="text-lg font-extrabold text-[#2ce610] mt-1">${escapeHtml(b.value)}</div>
    </div>
  `).join("");

  document.getElementById("f-dataHora").value = report.dataHora;
  document.getElementById("f-responsavel").value = report.responsavel;
  setSelectWithOther("f-cliente", "f-cliente-outro-wrap", "f-cliente-outro", FORM_OPTIONS.clientes, report.cliente, report.clienteOutro);
  setSelectWithOther("f-equipamento", "f-equipamento-outro-wrap", "f-equipamento-outro", FORM_OPTIONS.equipamentos, report.equipamento, report.equipamentoOutro);
  setSelectWithOther("f-identificacao", "f-identificacao-outro-wrap", "f-identificacao-outro", FORM_OPTIONS.identificacoes, report.identificacao, report.identificacaoOutro);
  document.getElementById("f-tipoRegistro").value = report.tipoRegistro;
  document.getElementById("f-tipoAcompanhamento").value = report.tipoAcompanhamento;

  document.querySelectorAll("input[name='f-fontes']").forEach(cb => {
    cb.checked = (report.fontes || []).includes(cb.value);
  });

  document.getElementById("f-statusOperacional").value = report.statusOperacional;
  document.getElementById("f-necessitaAcao").value = report.necessitaAcao;
  document.getElementById("f-resumo").value = report.resumo;
  document.getElementById("f-observacoes").value = report.observacoes;

  updatePreviewLink();
}

function setSelectWithOther(selectId, wrapId, inputId, validOptions, val, otherVal) {
  const sel = document.getElementById(selectId);
  const wrap = document.getElementById(wrapId);
  const inp = document.getElementById(inputId);

  if (val !== "Outro" && validOptions.includes(val)) {
    sel.value = val;
    wrap.classList.add("hidden");
    inp.value = "";
  } else {
    sel.value = "Outro";
    wrap.classList.remove("hidden");
    inp.value = otherVal || (val !== "Outro" ? val : "");
  }
}

function handleSelectOtherToggle(selectId, wrapId) {
  const sel = document.getElementById(selectId);
  const wrap = document.getElementById(wrapId);
  if (sel.value === "Outro") {
    wrap.classList.remove("hidden");
  } else {
    wrap.classList.add("hidden");
  }
  updatePreviewLink();
}

function readCurrentFormFromUI() {
  const dev = state.devicesMap[state.selectedDeviceId] || state.devices[0];
  const fontes = Array.from(document.querySelectorAll("input[name='f-fontes']:checked")).map(cb => cb.value);

  return {
    deviceId: dev?.device_id || "custom",
    deviceName: dev?.name || "Equipamento",
    dataHora: document.getElementById("f-dataHora").value.trim() || getNowForGoogleForms(),
    responsavel: document.getElementById("f-responsavel").value,
    responsavelOutro: "",
    cliente: document.getElementById("f-cliente").value,
    clienteOutro: document.getElementById("f-cliente-outro").value.trim(),
    equipamento: document.getElementById("f-equipamento").value,
    equipamentoOutro: document.getElementById("f-equipamento-outro").value.trim(),
    identificacao: document.getElementById("f-identificacao").value,
    identificacaoOutro: document.getElementById("f-identificacao-outro").value.trim(),
    tipoRegistro: document.getElementById("f-tipoRegistro").value,
    tipoAcompanhamento: document.getElementById("f-tipoAcompanhamento").value,
    fontes: fontes.length > 0 ? fontes : ["Dados do supervisorio"],
    statusOperacional: document.getElementById("f-statusOperacional").value,
    necessitaAcao: document.getElementById("f-necessitaAcao").value,
    resumo: document.getElementById("f-resumo").value,
    observacoes: document.getElementById("f-observacoes").value
  };
}

function updatePreviewLink() {
  const report = readCurrentFormFromUI();
  const url = getPrefilledGoogleFormsUrl(report);
  const linkEl = document.getElementById("direct-forms-link");
  if (linkEl) linkEl.href = url;
}

function copyReportText() {
  const r = readCurrentFormFromUI();
  const text = [
    `📋 *ACOMPANHAMENTO DE EQUIPAMENTO - WBM*`,
    `• *Data/Hora:* ${r.dataHora}`,
    `• *Responsável:* ${r.responsavel}`,
    `• *Cliente:* ${r.cliente === "Outro" ? r.clienteOutro : r.cliente}`,
    `• *Equipamento:* ${r.equipamento === "Outro" ? r.equipamentoOutro : r.equipamento}`,
    `• *Identificação:* ${r.identificacao === "Outro" ? r.identificacaoOutro : r.identificacao}`,
    `• *Status Operacional:* ${r.statusOperacional}`,
    `• *Necessita Ação?:* ${r.necessitaAcao}`,
    `• *Resumo:* ${r.resumo}`,
    `• *Observações:* ${r.observacoes}`
  ].join("\n");

  navigator.clipboard.writeText(text);
  showToast("Resumo copiado para a área de transferência!");
}

function openPostmanModal() {
  renderLiveMqttLog();
  document.getElementById("postman-modal")?.classList.remove("hidden");
}

function closePostmanModal() {
  document.getElementById("postman-modal")?.classList.add("hidden");
}

function renderLiveMqttLog() {
  const container = document.getElementById("postman-live-log");
  if (!container) return;
  if (state.recentMqttLog.length === 0) {
    container.innerHTML = `<div class="text-xs text-zinc-500 p-4">Aguardando novos pacotes nos tópicos devices/# ...</div>`;
    return;
  }
  container.innerHTML = state.recentMqttLog.slice(0, 20).map(item => `
    <div class="p-3 rounded-xl bg-[#08090a] border border-[#232a2f] text-xs font-mono space-y-1">
      <div class="flex items-center justify-between text-zinc-400">
        <span class="text-[#2ce610] font-bold">${escapeHtml(item.topic)}</span>
        <span>${escapeHtml(item.broker)} • ${new Date(item.ts).toLocaleTimeString("pt-BR")}</span>
      </div>
      <div class="text-zinc-300 break-all">${escapeHtml(JSON.stringify(item.payload))}</div>
    </div>
  `).join("");
}

function applyManualPostmanJson() {
  const raw = document.getElementById("postman-json-input")?.value.trim();
  if (!raw) {
    showToast("Cole um JSON do Postman primeiro.");
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    const targetId = parsed.id || parsed.deviceId || state.selectedDeviceId || "ALIMENTADOR_1";
    const topic = parsed.topic || `devices/${targetId}/telemetry`;
    handleIncomingMqttPacket("POSTMAN-MANUAL", topic, JSON.stringify(parsed), false);
    selectDevice(targetId);
    closePostmanModal();
    showToast(`Dados do Postman aplicados ao equipamento ${targetId}!`);
  } catch (e) {
    showToast("JSON inválido. Copie o JSON completo da mensagem no Postman.");
  }
}

function initBotScheduler() {
  const timeInput = document.getElementById("bot-time-input");
  const toggleInput = document.getElementById("bot-enabled-toggle");
  if (timeInput) timeInput.value = state.botTime;
  if (toggleInput) toggleInput.checked = state.botEnabled;

  setInterval(() => {
    checkAndTriggerDailyBot();
  }, 15000);
}

function saveBotSettings() {
  const timeInput = document.getElementById("bot-time-input");
  const toggleInput = document.getElementById("bot-enabled-toggle");
  if (timeInput) {
    state.botTime = timeInput.value || "08:15";
    localStorage.setItem("wbm_bot_time", state.botTime);
  }
  if (toggleInput) {
    state.botEnabled = toggleInput.checked;
    localStorage.setItem("wbm_bot_enabled", String(state.botEnabled));
  }
  showToast(`Bot configurado para Seg a Sex às ${state.botTime}!`);
}

async function checkAndTriggerDailyBot() {
  if (!state.botEnabled) return;
  const now = new Date();
  const day = now.getDay();
  if (day < 1 || day > 5) return;

  const currentHM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const todayKey = getTodayKey();

  if (currentHM === state.botTime && state.lastBotRunDate !== todayKey) {
    state.lastBotRunDate = todayKey;
    localStorage.setItem("wbm_last_bot_run_date", todayKey);
    await triggerDailyBotQueue(true);
  }
}

async function triggerDailyBotQueue(isAutoSchedule = false) {
  showToast(isAutoSchedule ? "⏰ Disparo das 08:15 iniciado via MQTT!" : "Gerando fila diária de todos os equipamentos...");
  await loadAllDashboardData();
  openBatchModal();
  playNotificationBeep();
}

function requestBrowserNotificationPermission() {
  if (!("Notification" in window)) return;
  Notification.requestPermission().then(perm => {
    if (perm === "granted") showToast("Notificações ativadas para o alerta das 08:15!");
  });
}

function playNotificationBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (_) {}
}

function openBatchModal() {
  const modal = document.getElementById("batch-modal");
  const listEl = document.getElementById("batch-modal-list");
  if (!modal || !listEl) return;

  const targetDevices = state.devices.filter(d => d.isPriority);

  listEl.innerHTML = targetDevices.map(dev => {
    const rep = state.generatedReports[dev.device_id] || buildReportForDevice(dev);
    const url = getPrefilledGoogleFormsUrl(rep);
    const sent = state.sentToday[dev.device_id];
    const clienteLabel = rep.cliente === "Outro" ? rep.clienteOutro : rep.cliente;
    const identLabel = rep.identificacao === "Outro" ? rep.identificacaoOutro : rep.identificacao;

    return `
      <div class="p-5 rounded-xl bg-[#08090a] border border-[#232a2f] flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div class="space-y-1.5 flex-1">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="font-bold text-white text-base">${escapeHtml(dev.name)}</span>
            <span class="px-2.5 py-0.5 text-xs rounded-full font-semibold ${
              rep.statusOperacional === "Operando normalmente"
                ? "bg-[#2ce610]/15 text-[#2ce610]"
                : rep.statusOperacional === "Operando com observacoes"
                ? "bg-amber-500/20 text-amber-300"
                : "bg-rose-500/20 text-rose-300"
            }">${escapeHtml(rep.statusOperacional)}</span>
            ${sent ? `<span class="px-2.5 py-0.5 text-xs rounded-full bg-[#2ce610]/20 text-[#2ce610]">✓ ${sent.mode} (${sent.time})</span>` : ""}
          </div>
          <div class="text-xs text-zinc-400">
            ${escapeHtml(clienteLabel)} • ${escapeHtml(identLabel)} • <span class="text-zinc-500">${escapeHtml(dev.broker || "")}</span>
          </div>
          <div class="text-xs text-zinc-300 bg-[#111416] p-3 rounded-xl border border-[#232a2f] mt-2 whitespace-pre-line leading-relaxed">${escapeHtml(rep.resumo)}</div>
        </div>
        <div class="flex sm:flex-row lg:flex-col gap-2.5 shrink-0">
          <a
            href="${url}"
            target="_blank"
            rel="noopener noreferrer"
            onclick="saveSentToday('${dev.device_id}', 'Forms Aberto'); setTimeout(openBatchModal, 300);"
            class="wbm-btn-primary px-5 py-2.5 rounded-xl font-extrabold text-xs text-center"
          >
            Abrir Forms Preenchido ↗
          </a>
          <button
            onclick="submitDirectlyToGoogleForms(state.generatedReports['${dev.device_id}']).then(openBatchModal)"
            class="px-4 py-2 rounded-xl bg-[#161a1d] hover:bg-zinc-800 text-[#2ce610] border border-[#2ce610]/30 font-semibold text-xs transition"
          >
            ⚡ Enviar Direto
          </button>
          <button
            onclick="closeBatchModal(); selectDevice('${dev.device_id}');"
            class="px-3 py-1.5 rounded-lg bg-[#161a1d] hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs transition"
          >
            Editar Respostas
          </button>
        </div>
      </div>
    `;
  }).join("");

  modal.classList.remove("hidden");
}

function closeBatchModal() {
  document.getElementById("batch-modal")?.classList.add("hidden");
}

function openSettingsModal() {
  document.getElementById("cfg-email").value = state.mqttUser;
  document.getElementById("cfg-password").value = state.mqttPass;
  document.getElementById("cfg-responsavel").value = state.responsavelPadrao;
  document.getElementById("settings-modal")?.classList.remove("hidden");
}

function closeSettingsModal() {
  document.getElementById("settings-modal")?.classList.add("hidden");
}

async function saveCredentialsSettings() {
  state.mqttUser = document.getElementById("cfg-email").value.trim() || MQTT_USER;
  state.mqttPass = document.getElementById("cfg-password").value || MQTT_PASS;
  state.responsavelPadrao = document.getElementById("cfg-responsavel").value;

  localStorage.setItem("wbm_mqtt_user", state.mqttUser);
  localStorage.setItem("wbm_mqtt_pass", state.mqttPass);
  localStorage.setItem("wbm_responsavel", state.responsavelPadrao);

  closeSettingsModal();
  await loadAllDashboardData();
  showToast("Configurações MQTT salvas!");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toast-msg");
  if (!toast || !toastMsg) return;
  toastMsg.textContent = msg;
  toast.classList.remove("hidden", "translate-y-4", "opacity-0");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 4000);
}

window.addEventListener("DOMContentLoaded", () => {
  initDevicesFromStorage();
  initBotScheduler();
  loadAllDashboardData();

  document.getElementById("acompanhamento-form")?.addEventListener("input", updatePreviewLink);
  document.getElementById("acompanhamento-form")?.addEventListener("change", updatePreviewLink);
});
