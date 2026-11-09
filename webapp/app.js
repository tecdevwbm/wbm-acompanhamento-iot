// ============================================================================
// WBM IoT Control -> Google Forms Automation WebApp & Daily Bot (Seg-Sex 08:15)
// ============================================================================

const SUPABASE_URL = "https://nwdextnlntvixacrjifv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZGV4dG5sbnR2aXhhY3JqaWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MTQyNjQsImV4cCI6MjA4NjA5MDI2NH0.N3bGloWK1RWg6VXKgm2zXxfwOlKn8ubIIzIFSd24BNc";

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

// Opções oficiais do Google Forms (para saber quando usar opção direta vs __other_option__)
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
    "ControlFlow GATE 1  (ETA ITABIRITO)", // Nota: possui 2 espaços entre 1 e (ETA
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

// Erros conhecidos do Control Flow Gate (do bundle do WBM IoT Control)
const CF_ERRORS = {
  0: "Sem erro (0)",
  1: "Código 1: Motor não funcionou",
  3: "Código 3: Motor travou",
  4: "Código 4: Sensor de posicionamento com defeito",
  6: "Código 6: Desacoplamento do eixo",
  7: "Código 7: Sem Comunicação"
};

// Estado global da aplicação
const state = {
  token: null,
  user: null,
  email: localStorage.getItem("wbm_email") || "matheus.coutinho@wbmtechnology.com.br",
  password: localStorage.getItem("wbm_password") || "wbm_technology",
  responsavelPadrao: localStorage.getItem("wbm_responsavel") || "Matheus Coutinho",
  botTime: localStorage.getItem("wbm_bot_time") || "08:15",
  botEnabled: localStorage.getItem("wbm_bot_enabled") !== "false",
  lastBotRunDate: localStorage.getItem("wbm_last_bot_run_date") || "",
  filterMode: "priority", // 'priority' | 'all' | 'pending'
  devices: [],
  latestMap: {
    controlflow: {},
    parshall: {},
    pressure: {},
    temp: {},
    cth: {},
    mappedState: {}
  },
  configMap: {
    device: {},
    parshall: {},
    pressure: {},
    temp: {},
    cth: {}
  },
  selectedDeviceId: null,
  generatedReports: {},
  sentToday: JSON.parse(localStorage.getItem("wbm_sent_" + getTodayKey()) || "{}")
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
// Autenticação e Consultas Supabase
// ============================================================================

async function supabaseLogin(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.msg || "Falha na autenticação com o dashboard.");
  }
  const data = await res.json();
  state.token = data.access_token;
  state.user = data.user;
  return data;
}

async function supabaseQuery(table, queryParams = "select=*") {
  if (!state.token) {
    await supabaseLogin(state.email, state.password);
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${queryParams}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${state.token}`
    }
  });
  if (!res.ok) {
    throw new Error(`Erro ao consultar ${table}: ${res.status}`);
  }
  return await res.json();
}

async function loadAllDashboardData() {
  setSyncStatus("loading", "Sincronizando telemetria com WBM IoT Control...");
  try {
    await supabaseLogin(state.email, state.password);

    const [
      devices,
      cfLatest,
      cpLatest,
      mpLatest,
      tempLatest,
      cthLatest,
      mappedState,
      devCfg,
      cpCfg,
      mpCfg,
      tempCfg,
      cthCfg
    ] = await Promise.all([
      supabaseQuery("devices", "select=*&order=name.asc"),
      supabaseQuery("controlflow_latest", "select=*"),
      supabaseQuery("parshall_latest", "select=*"),
      supabaseQuery("pressure_latest", "select=*"),
      supabaseQuery("temp_latest", "select=*"),
      supabaseQuery("cth_latest", "select=*"),
      supabaseQuery("telemetry_latest_state", "select=*"),
      supabaseQuery("device_config", "select=*"),
      supabaseQuery("parshall_device_config", "select=*"),
      supabaseQuery("pressure_device_config", "select=*"),
      supabaseQuery("temp_device_config", "select=*"),
      supabaseQuery("cth_device_config", "select=*")
    ]);

    state.latestMap.controlflow = indexBy(cfLatest, "device_id");
    state.latestMap.parshall = indexBy(cpLatest, "device_id");
    state.latestMap.pressure = indexBy(mpLatest, "device_id");
    state.latestMap.temp = indexBy(tempLatest, "device_id");
    state.latestMap.cth = indexBy(cthLatest, "device_id");
    state.latestMap.mappedState = indexBy(mappedState, "device_id");

    state.configMap.device = indexBy(devCfg, "device_id");
    state.configMap.parshall = indexBy(cpCfg, "device_id");
    state.configMap.pressure = indexBy(mpCfg, "device_id");
    state.configMap.temp = indexBy(tempCfg, "device_id");
    state.configMap.cth = indexBy(cthCfg, "device_id");

    // Adiciona dispositivos do banco + templates do Forms (ex.: AvantGarde ControlFeed 1 e 2)
    const enrichedDevices = devices
      .filter(d => d.device_id !== "TEST_GENERIC_RETIRE_1")
      .map(d => enrichDeviceMetadata(d));

    // Garante que os 2 equipamentos AvantGarde presentes no Forms também possam ser selecionados rapidamente
    const presetAvantGarde = [
      {
        device_id: "PRESET_AVANTGARDE_CF1",
        name: "CONTROLFEED 1 (AVANTGARDE) NS 2112",
        location: "AvantGarde",
        solution_code: "control_flow_monitor",
        status: "preset",
        last_seen: null,
        isPreset: true,
        priorityOrder: 6,
        isPriority: true,
        formMapping: {
          cliente: "AvantGarde",
          equipamento: "Control Flow Gate",
          identificacao: "CONTROLFEED 1 (AVANTGARDE) NS 2112"
        }
      },
      {
        device_id: "PRESET_AVANTGARDE_CF2",
        name: "CONTROLFEED 2 (AVANTGARDE) NS 2111",
        location: "AvantGarde",
        solution_code: "control_flow_monitor",
        status: "preset",
        last_seen: null,
        isPreset: true,
        priorityOrder: 7,
        isPriority: true,
        formMapping: {
          cliente: "AvantGarde",
          equipamento: "Control Flow Gate",
          identificacao: "CONTROLFEED 2 (AVANTGARDE) NS 2111"
        }
      }
    ];

    state.devices = [...enrichedDevices, ...presetAvantGarde].sort((a, b) => {
      if (a.priorityOrder !== b.priorityOrder) return a.priorityOrder - b.priorityOrder;
      return (a.name || "").localeCompare(b.name || "");
    });

    // Gera diagnóstico inicial para todos os dispositivos carregados
    for (const dev of state.devices) {
      state.generatedReports[dev.device_id] = buildReportForDevice(dev, null);
    }

    setSyncStatus("ok", `Conectado • ${enrichedDevices.length} dispositivos sincronizados (${new Date().toLocaleTimeString("pt-BR")})`);
    renderDeviceList();
    updateStatsCounters();

    if (!state.selectedDeviceId && state.devices.length > 0) {
      selectDevice(state.devices[0].device_id);
    } else if (state.selectedDeviceId) {
      selectDevice(state.selectedDeviceId);
    }
  } catch (err) {
    console.error(err);
    setSyncStatus("error", `Erro: ${err.message}`);
  }
}

function indexBy(arr, key) {
  const map = {};
  for (const item of arr || []) {
    if (item && item[key]) map[item[key]] = item;
  }
  return map;
}

// ============================================================================
// Mapeamento Inteligente Dispositivo (Supabase) <-> Perguntas (Google Forms)
// ============================================================================

function enrichDeviceMetadata(d) {
  const id = d.device_id;
  const name = (d.name || "").trim();
  const loc = (d.location || "").trim();
  const sol = d.solution_code || "";

  let cliente = "Outro";
  let clienteOutro = loc || "WBM Cliente";
  let equipamento = "Outro";
  let equipamentoOutro = sol;
  let identificacao = "Outro";
  let identificacaoOutro = loc ? `${name} (${loc})` : name;
  let priorityOrder = 50;
  let isPriority = false;

  // Mapeia Equipamento pela solution_code
  if (sol === "control_parshall_monitor") {
    equipamento = "Control Parshall Monitor";
    equipamentoOutro = "";
  } else if (sol === "control_flow_monitor") {
    equipamento = "Control Flow Gate";
    equipamentoOutro = "";
  } else if (sol === "pressure_monitor") {
    equipamento = "Pressure Monitor";
    equipamentoOutro = "";
  } else if (sol === "temp_monitor") {
    equipamento = "Temp Monitor";
    equipamentoOutro = "";
  } else if (sol === "control_temp_humidity_monitor") {
    equipamento = "Temp Monitor";
    equipamentoOutro = "Temp&Humid Monitor";
  } else if (sol === "energy_monitor") {
    equipamento = "Outro";
    equipamentoOutro = "Monitor de Energia";
  } else if (sol === "inverter_monitor") {
    equipamento = "Outro";
    equipamentoOutro = "Inverter Monitor";
  }

  // Mapeamentos diretos dos equipamentos principais de clientes instalados
  if (id === "Mestre_CC7B5CF835BC_CP_1" || id === "Mestre_BCDDC2CDA9B8_CP_1") {
    cliente = "UTA SAAE Itabirito Nascente";
    clienteOutro = "";
    equipamento = "Control Parshall Monitor";
    identificacao = "ControlParshal 1 (NASCENTE ITABIRITO)";
    identificacaoOutro = "";
    priorityOrder = id === "Mestre_CC7B5CF835BC_CP_1" ? 1 : 12;
    isPriority = id === "Mestre_CC7B5CF835BC_CP_1";
  } else if (id === "Mestre_CC7B5CF20D9C_CF_1") {
    cliente = "ETA SAAE Itabirito";
    clienteOutro = "";
    equipamento = "Control Flow Gate";
    identificacao = "ControlFlow GATE 1  (ETA ITABIRITO)";
    identificacaoOutro = "";
    priorityOrder = 2;
    isPriority = true;
  } else if (id === "Mestre_CC7B5CF20D9C_MP_1") {
    cliente = "ETA SAAE Itabirito";
    clienteOutro = "";
    equipamento = "Pressure Monitor";
    identificacao = "PressureMonitor 1 (ETA ITABIRITO)";
    identificacaoOutro = "";
    priorityOrder = 3;
    isPriority = true;
  } else if (loc.toUpperCase().includes("VITAS") || name.toUpperCase().includes("VITAS")) {
    cliente = "Outro";
    clienteOutro = "VITAS UFMG";
    identificacao = "Outro";
    identificacaoOutro = `${name} (${loc || "VITAS UFMG"})`;
    priorityOrder = 4;
    isPriority = true;
  } else if (id === "Mestre_8813BF00922C_CM_1") {
    cliente = "Outro";
    clienteOutro = loc || "Área Limpa Inativadas";
    identificacao = "Outro";
    identificacaoOutro = `${name} (${loc})`;
    priorityOrder = 5;
    isPriority = true;
  } else if (d.status === "online") {
    priorityOrder = 10;
    isPriority = true;
  }

  return {
    ...d,
    priorityOrder,
    isPriority,
    formMapping: {
      cliente,
      clienteOutro,
      equipamento,
      equipamentoOutro,
      identificacao,
      identificacaoOutro
    }
  };
}

// ============================================================================
// Análise de Telemetria, Status Operacional e Resumo Técnico
// ============================================================================

function formatAge(isoTimestamp) {
  if (!isoTimestamp) return { text: "Sem registro", minutes: Infinity };
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
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
  if (!isoTimestamp) return "N/D";
  const dt = new Date(isoTimestamp);
  return dt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatHoraTexto(isoTimestamp) {
  if (!isoTimestamp) return "horário não registrado";
  const dt = new Date(isoTimestamp);
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

function buildReportForDevice(dev, historyStats = null) {
  const id = dev.device_id;
  const sol = dev.solution_code;
  const lastSeenIso = dev.last_seen;
  const age = formatAge(lastSeenIso);
  const lastSeenBR = formatDateTimeBR(lastSeenIso);
  const horaLeitura = formatHoraTexto(lastSeenIso);

  // Timeout esperado para classificar comunicação
  const devCfg = state.configMap.device[id];
  const sleepMin = devCfg?.sleep ?? (dev.expected_interval_seconds ? Math.round(dev.expected_interval_seconds / 60) : 60);
  const expectedTimeoutMin = Math.max(60, sleepMin <= 60 ? sleepMin + 30 : Math.round(sleepMin * 1.5));

  let statusOperacional = "Operando normalmente";
  let necessitaAcao = "Nao";
  let resumoParts = [];
  let obsParts = [];
  let metricsBadges = [];

  if (dev.isPreset) {
    const nowHora = formatHoraTexto(new Date().toISOString());
    statusOperacional = "Operando normalmente";
    necessitaAcao = "Nao";
    resumoParts.push(
      `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. ` +
      `A transmissão de dados permanece ativa e regular, com a última verificação registrada ${nowHora}.`
    );
    obsParts.push("Sem ocorrências operacionais registradas no período.");
    metricsBadges.push({ label: "Modo", value: "Template Forms" });
  } else if (sol === "control_parshall_monitor") {
    const cp = state.latestMap.parshall[id];
    const mapped = state.latestMap.mappedState[id]?.variables;
    const vazao = cp?.vazao ?? mapped?.flow?.val ?? null;
    const lamina = cp?.lamina ?? mapped?.water_sheet?.val ?? null;
    const tensao = cp?.tensao ?? mapped?.voltage?.val ?? null;
    const temp = cp?.temp ?? mapped?.temperature?.val ?? null;
    const err = cp?.error ?? mapped?.error_code?.val ?? 0;
    const sleep = cp?.sleep ?? devCfg?.sleep ?? null;
    const acordado = cp?.acordado ?? devCfg?.acordado ?? null;

    if (vazao !== null) metricsBadges.push({ label: "Vazão Atual", value: `${fmtNum(vazao)} m³/h` });
    if (lamina !== null) metricsBadges.push({ label: "Lâmina", value: `${fmtNum(lamina)} mm` });
    if (tensao !== null) metricsBadges.push({ label: "Bateria", value: `${fmtNum(tensao)} V` });

    const isCommOk = dev.status === "online" || age.minutes <= expectedTimeoutMin;
    const isDelayed = !isCommOk && age.minutes <= 1440; // até 24h

    if (!isCommOk && !isDelayed) {
      statusOperacional = "Sem comunicacao";
      necessitaAcao = "Sim, acompanhamento";
      resumoParts.push(
        `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se sem transmissão de dados ativa no momento, com a última leitura registrada ${horaLeitura}. ` +
        (vazao !== null
          ? `Nos dados da última leitura registrada pelo equipamento, constava vazão de ${fmtNum(vazao)} m³/h, lâmina d'água de ${fmtNum(lamina)} mm e tensão da bateria em ${fmtNum(tensao)} V.`
          : "")
      );
      obsParts.push(`Verificar alimentação e conectividade local do equipamento (última comunicação ${age.text}).`);
    } else {
      statusOperacional = (err !== 0 || (tensao !== null && tensao < 11.0) || isDelayed)
        ? "Operando com observacoes"
        : "Operando normalmente";
      necessitaAcao = statusOperacional === "Operando normalmente" ? "Nao" : "Sim, acompanhamento";

      resumoParts.push(
        `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. ` +
        `A transmissão de dados permanece ativa e regular, com a última leitura registrada ${horaLeitura}. ` +
        `Nos parâmetros atuais do equipamento, registra-se vazão de ${fmtNum(vazao)} m³/h, lâmina d'água de ${fmtNum(lamina)} mm, temperatura de ${fmtNum(temp, 1)} °C e tensão da bateria em ${fmtNum(tensao)} V` +
        (sleep !== null ? ` (ciclo configurado: Sleep ${sleep} min / Acordado ${acordado} s).` : ".")
      );
      if (historyStats && historyStats.count > 0) {
        resumoParts.push(
          `Nas últimas 24h (${historyStats.count} leituras recebidas), a vazão média foi de ${fmtNum(historyStats.avg)} m³/h (mínima de ${fmtNum(historyStats.min)} m³/h e máxima de ${fmtNum(historyStats.max)} m³/h).`
        );
      }
      if (tensao !== null && tensao < 11.0) {
        obsParts.push(`Atenção: Tensão da bateria em ${fmtNum(tensao)} V (abaixo de 11,0 V). Acompanhar curva de descarga.`);
      } else if (isDelayed) {
        obsParts.push(`Última atualização recebida ${age.text} (${lastSeenBR}). Segue em acompanhamento.`);
      } else {
        obsParts.push("Equipamento operando dentro dos parâmetros normais de vazão, nível e bateria.");
      }
    }
  } else if (sol === "control_flow_monitor") {
    const cf = state.latestMap.controlflow[id];
    const po = cf?.po ?? null;
    const md = cf?.md === 1 ? "Automático" : cf?.md === 2 ? "Manual" : `Modo ${cf?.md ?? "N/D"}`;
    const qc = cf?.qc ?? null;
    const qv = cf?.qv ?? null;
    const er = cf?.er ?? 0;

    if (po !== null) metricsBadges.push({ label: "Posição", value: `${po}%` });
    metricsBadges.push({ label: "Modo", value: md });
    if (qc !== null) metricsBadges.push({ label: "Ciclos / Voltas", value: `${qc} / ${qv}` });
    metricsBadges.push({ label: "Erro", value: `${er}` });

    const isTodayOrRecent = age.minutes <= 720; // Comunicou nas últimas 12h
    const isWithin24h = age.minutes <= 1440;

    if (er === 7 || !isWithin24h) {
      statusOperacional = "Sem comunicacao";
      necessitaAcao = "Sim, acompanhamento";
      resumoParts.push(
        `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se sem transmissão de dados recente, com a última leitura registrada ${horaLeitura}. ` +
        `Nos últimos dados reportados pelo equipamento, constava posição da válvula em ${po ?? 0}%, modo ${md}, ${qc ?? 0} ciclos, ${qv ?? 0} voltas e status: ${CF_ERRORS[er] || `Erro ${er}`}.`
      );
      obsParts.push(`Equipamento sem comunicação desde ${lastSeenBR}. Verificar status do mestre/válvula em campo.`);
    } else if (!isTodayOrRecent || er !== 0) {
      statusOperacional = "Operando com observacoes";
      necessitaAcao = "Sim, acompanhamento";
      resumoParts.push(
        `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em operação com a última leitura registrada ${horaLeitura}. ` +
        `Nos dados atuais do equipamento, a válvula encontra-se na posição ${po}%, em modo ${md}, contabilizando ${qc} ciclos e ${qv} voltas acumuladas (${CF_ERRORS[er] || `Erro ${er}`}).`
      );
      if (historyStats && historyStats.count > 0) {
        resumoParts.push(`Foram registrados ${historyStats.count} pacotes nas últimas 24h, com posição entre ${historyStats.min}% e ${historyStats.max}%.`);
      }
      obsParts.push(
        er !== 0
          ? `Atenção para código de erro reportado: ${CF_ERRORS[er] || er}.`
          : `Último envio registrado ${horaLeitura} (${age.text}). Manter acompanhamento da periodicidade de comunicação.`
      );
    } else {
      statusOperacional = "Operando normalmente";
      necessitaAcao = "Nao";
      resumoParts.push(
        `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. ` +
        `A transmissão de dados permanece ativa e regular, com a última leitura registrada ${horaLeitura}. ` +
        `Nos dados atuais do equipamento, a válvula encontra-se na posição ${po}%, operando em modo ${md}, com ${qc} ciclos, ${qv} voltas acumuladas e sem códigos de falha (${er}).`
      );
      if (historyStats && historyStats.count > 0) {
        resumoParts.push(`Nas últimas 24h foram recebidas ${historyStats.count} leituras regulares.`);
      }
      obsParts.push("Operação normal via supervisório, sem falhas de atuador ou posicionamento.");
    }
  } else if (sol === "pressure_monitor") {
    const mp = state.latestMap.pressure[id];
    const mpCfg = state.configMap.pressure[id];
    const pressao = mp?.pressao ?? null;
    const temp = mp?.temp ?? null;
    const err = mp?.error ?? 0;
    const unit = mpCfg?.pressure_unit || "bar";
    const pMin = mpCfg?.pressure_min ?? 0;
    const pMax = mpCfg?.pressure_max ?? 16;

    if (pressao !== null) metricsBadges.push({ label: "Pressão Atual", value: `${fmtNum(pressao)} ${unit}` });
    if (temp !== null) metricsBadges.push({ label: "Temp. Local", value: `${fmtNum(temp, 1)} °C` });
    metricsBadges.push({ label: "Faixa", value: `${pMin}–${pMax} ${unit}` });

    const isCommOk = dev.status === "online" || age.minutes <= 180;
    const outOfRange = pressao !== null && (pressao < pMin || pressao > pMax);

    if (!isCommOk && age.minutes > 1440) {
      statusOperacional = "Sem comunicacao";
      necessitaAcao = "Sim, acompanhamento";
      resumoParts.push(
        `Conforme acompanhamento realizado pelo painel de monitoramento, o sensor de pressão encontra-se sem transmissão ativa no momento, com a última leitura registrada ${horaLeitura} (última pressão: ${fmtNum(pressao)} ${unit}).`
      );
      obsParts.push("Verificar comunicação do mestre na ETA.");
    } else {
      statusOperacional = (err !== 0 || outOfRange || !isCommOk) ? "Operando com observacoes" : "Operando normalmente";
      necessitaAcao = statusOperacional === "Operando normalmente" ? "Nao" : "Sim, acompanhamento";
      resumoParts.push(
        `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. ` +
        `A transmissão de dados permanece ativa e regular, com a última leitura registrada ${horaLeitura}. ` +
        `Nos dados atuais do equipamento, registra-se pressão de ${fmtNum(pressao)} ${unit} (faixa operacional de ${pMin} a ${pMax} ${unit}), temperatura local de ${fmtNum(temp, 1)} °C e código de erro ${err}.`
      );
      if (historyStats && historyStats.count > 0) {
        resumoParts.push(
          `Nas últimas 24h (${historyStats.count} leituras), a pressão manteve-se com média de ${fmtNum(historyStats.avg)} ${unit} (mínima de ${fmtNum(historyStats.min)} ${unit} e máxima de ${fmtNum(historyStats.max)} ${unit}).`
        );
      }
      obsParts.push(
        outOfRange
          ? `Pressão fora dos limites configurados (${pMin}–${pMax} ${unit}).`
          : "Pressão da linha estável e dentro dos limites operacionais."
      );
    }
  } else if (sol === "temp_monitor") {
    const mapped = state.latestMap.mappedState[id]?.variables;
    const legacy = state.latestMap.temp[id];
    const tFreezer = mapped?.freezer_temperature_c?.val ?? legacy?.temp_freezer ?? legacy?.payload?.d3 ?? null;
    const tCtrl = mapped?.controller_temperature_c?.val ?? legacy?.payload?.d4 ?? null;
    const tAmb = mapped?.ambient_temperature_c?.val ?? legacy?.temp_local ?? legacy?.payload?.d2 ?? null;
    const vcc = mapped?.supply_voltage_v?.val ?? legacy?.tensao ?? legacy?.payload?.d1 ?? null;
    const limitC = mapped?.temperature_alert_limit_c?.val ?? legacy?.limite_temp_alerta ?? -50;
    const alertActive = mapped?.temperature_alert_active?.val ?? false;
    const err = mapped?.device_error_code?.val ?? legacy?.error ?? 0;

    if (tFreezer !== null) metricsBadges.push({ label: "Freezer", value: `${fmtNum(tFreezer, 1)} °C` });
    if (tCtrl !== null) metricsBadges.push({ label: "Controlador", value: `${fmtNum(tCtrl, 1)} °C` });
    if (tAmb !== null) metricsBadges.push({ label: "Ambiente", value: `${fmtNum(tAmb, 1)} °C` });
    if (vcc !== null) metricsBadges.push({ label: "Tensão", value: `${vcc} V` });

    const isCommOk = dev.status === "online" || age.minutes <= 60;
    const tempHigh = tFreezer !== null && limitC !== null && tFreezer > limitC;

    if (!isCommOk && age.minutes > 1440) {
      statusOperacional = "Sem comunicacao";
      necessitaAcao = "Sim, acompanhamento";
      resumoParts.push(
        `Conforme acompanhamento realizado pelo painel de monitoramento, o monitor de temperatura encontra-se sem comunicação ativa, com a última leitura registrada ${horaLeitura}.`
      );
      obsParts.push("Verificar conectividade e alimentação do sensor.");
    } else {
      statusOperacional = (alertActive || tempHigh || err !== 0 || !isCommOk) ? "Operando com observacoes" : "Operando normalmente";
      necessitaAcao = statusOperacional === "Operando normalmente" ? "Nao" : "Sim, acompanhamento";
      resumoParts.push(
        `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. ` +
        `A transmissão de dados permanece ativa e regular, com a última leitura registrada ${horaLeitura}. ` +
        `Nos dados atuais do equipamento, registra-se temperatura interna do freezer em ${fmtNum(tFreezer, 1)} °C (limite de alerta: ${limitC} °C), temperatura do controlador em ${fmtNum(tCtrl, 1)} °C, temperatura ambiente de ${fmtNum(tAmb, 1)} °C e alimentação em ${vcc ?? "N/D"} V.`
      );
      if (historyStats && historyStats.count > 0) {
        resumoParts.push(
          `Nas últimas 24h (${historyStats.count} leituras), a temperatura do freezer manteve-se com média de ${fmtNum(historyStats.avg, 1)} °C (mínima de ${fmtNum(historyStats.min, 1)} °C e máxima de ${fmtNum(historyStats.max, 1)} °C).`
        );
      }
      obsParts.push(
        tempHigh
          ? `Atenção: Temperatura (${fmtNum(tFreezer, 1)} °C) acima do limite configurado (${limitC} °C).`
          : "Freezer operando normalmente dentro da faixa térmica ultrabaixa esperada."
      );
    }
  } else {
    // Outras soluções (Energy Monitor, Inverter Monitor, CTH)
    const mapped = state.latestMap.mappedState[id]?.variables;
    const cth = state.latestMap.cth[id];
    const isCommOk = dev.status === "online" || age.minutes <= 120;

    statusOperacional = isCommOk ? "Operando normalmente" : (age.minutes > 1440 ? "Sem comunicacao" : "Operando com observacoes");
    necessitaAcao = statusOperacional === "Operando normalmente" ? "Nao" : "Sim, acompanhamento";

    const intro = isCommOk
      ? `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento encontra-se em funcionamento contínuo e sem interrupções. A transmissão de dados permanece ativa e regular, com a última leitura registrada ${horaLeitura}.`
      : `Conforme acompanhamento realizado pelo painel de monitoramento, o equipamento registra última leitura ${horaLeitura} (${age.text}).`;

    if (cth) {
      metricsBadges.push({ label: "Temp", value: `${cth.temp ?? "N/D"} °C` });
      metricsBadges.push({ label: "Umidade", value: `${cth.umidade ?? "N/D"} %` });
      metricsBadges.push({ label: "Tensão", value: `${cth.tensao ?? "N/D"} V` });
      resumoParts.push(
        `${intro} Nos dados atuais do equipamento, registra-se temperatura de ${cth.temp} °C, umidade relativa de ${cth.umidade}% e tensão de alimentação de ${cth.tensao} V.`
      );
    } else if (mapped) {
      const pairs = Object.entries(mapped)
        .filter(([, v]) => v && v.val !== null && v.val !== undefined)
        .map(([k, v]) => `${k}: ${v.val}${v.u ? " " + v.u : ""}`);
      pairs.slice(0, 4).forEach(p => {
        const [k, val] = p.split(": ");
        metricsBadges.push({ label: k.replace(/_/g, " "), value: val });
      });
      resumoParts.push(`${intro} Parâmetros registrados pelo equipamento: ${pairs.join(" | ")}.`);
    } else {
      resumoParts.push(intro);
    }
    obsParts.push(
      statusOperacional === "Operando normalmente"
        ? "Equipamento operando normalmente sem alertas ativos."
        : `Verificar status de comunicação (último pacote ${age.text}).`
    );
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

// Busca estatísticas das últimas 24h no Supabase ao selecionar um dispositivo
async function fetch24hStatsForDevice(dev) {
  if (!dev || dev.isPreset) return null;
  const id = dev.device_id;
  const sol = dev.solution_code;
  const sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  try {
    if (sol === "control_parshall_monitor") {
      const rows = await supabaseQuery(
        "parshall_history",
        `select=vazao,lamina,tensao,received_at&device_id=eq.${encodeURIComponent(id)}&received_at=gte.${encodeURIComponent(sinceIso)}&order=received_at.desc&limit=500`
      );
      const vals = rows.map(r => Number(r.vazao)).filter(v => !Number.isNaN(v));
      if (vals.length > 0) {
        return {
          count: vals.length,
          min: Math.min(...vals),
          max: Math.max(...vals),
          avg: vals.reduce((a, b) => a + b, 0) / vals.length
        };
      }
    } else if (sol === "pressure_monitor") {
      const rows = await supabaseQuery(
        "pressure_history",
        `select=pressao,temp,received_at&device_id=eq.${encodeURIComponent(id)}&received_at=gte.${encodeURIComponent(sinceIso)}&order=received_at.desc&limit=500`
      );
      const vals = rows.map(r => Number(r.pressao)).filter(v => !Number.isNaN(v));
      if (vals.length > 0) {
        return {
          count: vals.length,
          min: Math.min(...vals),
          max: Math.max(...vals),
          avg: vals.reduce((a, b) => a + b, 0) / vals.length
        };
      }
    } else if (sol === "temp_monitor") {
      const rows = await supabaseQuery(
        "temp_history",
        `select=temp_freezer,raw_payload,received_at&device_id=eq.${encodeURIComponent(id)}&received_at=gte.${encodeURIComponent(sinceIso)}&order=received_at.desc&limit=500`
      );
      const vals = rows
        .map(r => r.temp_freezer ?? r.raw_payload?.d3 ?? r.raw_payload?.payload?.d3)
        .map(Number)
        .filter(v => !Number.isNaN(v) && v > -200);
      if (vals.length > 0) {
        return {
          count: vals.length,
          min: Math.min(...vals),
          max: Math.max(...vals),
          avg: vals.reduce((a, b) => a + b, 0) / vals.length
        };
      }
    } else if (sol === "control_flow_monitor") {
      const rows = await supabaseQuery(
        "controlflow_history",
        `select=po,qv,created_at&device_id=eq.${encodeURIComponent(id)}&created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.desc&limit=500`
      );
      const vals = rows.map(r => Number(r.po)).filter(v => !Number.isNaN(v));
      if (vals.length > 0) {
        return {
          count: vals.length,
          min: Math.min(...vals),
          max: Math.max(...vals),
          avg: vals.reduce((a, b) => a + b, 0) / vals.length
        };
      }
    }
  } catch (e) {
    console.warn("Histórico 24h indisponível para", id, e);
  }
  return null;
}

// ============================================================================
// Geração de Link Pré-Preenchido e Envio Direto para o Google Forms
// ============================================================================

function buildGoogleFormsParams(report) {
  const params = new URLSearchParams();
  params.set("usp", "pp_url");

  // 1. Data e Hora (formato aceito pelo Google Forms: YYYY-MM-DD HH:MM)
  params.set(FORM_ENTRIES.dataHora, report.dataHora || getNowForGoogleForms());

  // 2. Responsável
  setRadioOrOther(params, FORM_ENTRIES.responsavel, FORM_OPTIONS.responsaveis, report.responsavel, report.responsavelOutro);

  // 3. Cliente
  setRadioOrOther(params, FORM_ENTRIES.cliente, FORM_OPTIONS.clientes, report.cliente, report.clienteOutro);

  // 4. Equipamento
  setRadioOrOther(params, FORM_ENTRIES.equipamento, FORM_OPTIONS.equipamentos, report.equipamento, report.equipamentoOutro);

  // 5. Identificação do Equipamento
  setRadioOrOther(params, FORM_ENTRIES.identificacao, FORM_OPTIONS.identificacoes, report.identificacao, report.identificacaoOutro);

  // 6. Tipo de Registro
  setRadioOrOther(params, FORM_ENTRIES.tipoRegistro, FORM_OPTIONS.tiposRegistro, report.tipoRegistro, "");

  // 7. Tipo de Acompanhamento
  setRadioOrOther(params, FORM_ENTRIES.tipoAcompanhamento, FORM_OPTIONS.tiposAcompanhamento, report.tipoAcompanhamento, "");

  // 8. Fonte das Informações Registradas (Checkboxes - múltiplos valores com mesma chave)
  const fontes = Array.isArray(report.fontes) && report.fontes.length > 0
    ? report.fontes
    : ["Dados do supervisorio"];
  for (const f of fontes) {
    params.append(FORM_ENTRIES.fonteInformacoes, f);
  }

  // 9. Status Operacional
  setRadioOrOther(params, FORM_ENTRIES.statusOperacional, FORM_OPTIONS.statusOperacional, report.statusOperacional, "");

  // 10. Necessita alguma ação?
  params.set(FORM_ENTRIES.necessitaAcao, report.necessitaAcao || "Nao");

  // 11. Resumo do Acompanhamento
  params.set(FORM_ENTRIES.resumo, report.resumo || "");

  // 12. Observações Gerais
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

async function submitDirectlyToGoogleForms(customReport = null) {
  const report = customReport || readCurrentFormFromUI();
  const params = buildGoogleFormsParams(report);
  params.delete("usp");

  // Para submissão direta POST /formResponse, o Google Forms exige apenas _year, _month, _day, _hour, _minute (sem a chave base)
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
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    saveSentToday(report.deviceId, "Enviado Direto");
    showToast(`Resposta de "${report.deviceName}" enviada direto para a planilha do Google Forms!`);
  } catch (err) {
    console.error("Erro no envio direto, abrindo aba pré-preenchida:", err);
    openPrefilledGoogleForm();
  }
}

// ============================================================================
// Interface e Interação (DOM)
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
  const onlineCount = state.devices.filter(d => d.status === "online").length;
  const sentCount = Object.keys(state.sentToday).length;

  const elPriority = document.getElementById("stat-priority");
  const elOnline = document.getElementById("stat-online");
  const elSent = document.getElementById("stat-sent");

  if (elPriority) elPriority.textContent = totalPriority;
  if (elOnline) elOnline.textContent = onlineCount;
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
    container.innerHTML = `
      <div class="p-8 text-center text-zinc-500 text-sm">
        Nenhum equipamento encontrado.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(d => {
    const isSelected = d.device_id === state.selectedDeviceId;
    const rep = state.generatedReports[d.device_id] || buildReportForDevice(d);
    const sent = state.sentToday[d.device_id];

    let statusDot = "bg-[#2ce610]";
    let statusLabel = "Normal";
    let statusTextClass = "text-[#2ce610]";

    if (d.isPreset) {
      statusDot = "bg-zinc-400";
      statusLabel = "Preset";
      statusTextClass = "text-zinc-300";
    } else if (rep.statusOperacional === "Operando com observacoes") {
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
          <span class="truncate">${escapeHtml(clienteLabel)}</span>
          ${sent
            ? `<span class="text-[11px] font-semibold text-[#2ce610]">✓ Enviado (${sent.time})</span>`
            : `<span class="text-[11px] text-zinc-500">${d.isPreset ? "Manual" : rep.ageText}</span>`
          }
        </div>
      </button>
    `;
  }).join("");
}

async function selectDevice(deviceId) {
  state.selectedDeviceId = deviceId;
  const dev = state.devices.find(d => d.device_id === deviceId);
  if (!dev) return;

  renderDeviceList();

  // Renderiza imediatamente com os dados latest em memória
  let report = buildReportForDevice(dev, null);
  state.generatedReports[deviceId] = report;
  populateFormUI(dev, report);

  // Em seguida, busca estatísticas das últimas 24h e atualiza o resumo
  if (!dev.isPreset) {
    const stats24h = await fetch24hStatsForDevice(dev);
    if (stats24h && state.selectedDeviceId === deviceId) {
      report = buildReportForDevice(dev, stats24h);
      state.generatedReports[deviceId] = report;
      populateFormUI(dev, report);
    }
  }
}

function populateFormUI(dev, report) {
  const clienteLabel = report.cliente === "Outro" ? report.clienteOutro : report.cliente;
  const equipLabel = report.equipamento === "Outro" ? report.equipamentoOutro : report.equipamento;

  document.getElementById("selected-device-title").textContent = dev.name;
  document.getElementById("selected-device-subtitle").textContent =
    dev.isPreset
      ? `${clienteLabel} • ${equipLabel}`
      : `${clienteLabel} • Última comunicação: ${report.lastSeenBR} (${report.ageText})`;

  const fixedSummaryEl = document.getElementById("fixed-fields-summary");
  if (fixedSummaryEl) {
    fixedSummaryEl.textContent = `${report.responsavel} • ${clienteLabel} • ${equipLabel}`;
  }

  // Renderiza cards de telemetria rápida bem espaçados
  const badgesContainer = document.getElementById("telemetry-badges");
  badgesContainer.innerHTML = (report.metricsBadges || []).map(b => `
    <div class="p-4 rounded-xl bg-[#08090a] border border-[#232a2f]">
      <div class="text-xs font-medium text-zinc-400">${escapeHtml(b.label)}</div>
      <div class="text-lg font-extrabold text-[#2ce610] mt-1">${escapeHtml(b.value)}</div>
    </div>
  `).join("");

  // 1. Data e Hora
  document.getElementById("f-dataHora").value = report.dataHora;

  // 2. Responsável
  document.getElementById("f-responsavel").value = report.responsavel;

  // 3. Cliente
  setSelectWithOther("f-cliente", "f-cliente-outro-wrap", "f-cliente-outro", FORM_OPTIONS.clientes, report.cliente, report.clienteOutro);

  // 4. Equipamento
  setSelectWithOther("f-equipamento", "f-equipamento-outro-wrap", "f-equipamento-outro", FORM_OPTIONS.equipamentos, report.equipamento, report.equipamentoOutro);

  // 5. Identificação do Equipamento
  setSelectWithOther("f-identificacao", "f-identificacao-outro-wrap", "f-identificacao-outro", FORM_OPTIONS.identificacoes, report.identificacao, report.identificacaoOutro);

  // 6. Tipo de Registro
  document.getElementById("f-tipoRegistro").value = report.tipoRegistro;

  // 7. Tipo de Acompanhamento
  document.getElementById("f-tipoAcompanhamento").value = report.tipoAcompanhamento;

  // 8. Fontes (checkboxes)
  document.querySelectorAll("input[name='f-fontes']").forEach(cb => {
    cb.checked = (report.fontes || []).includes(cb.value);
  });

  // 9. Status Operacional
  document.getElementById("f-statusOperacional").value = report.statusOperacional;

  // 10. Necessita alguma ação?
  document.getElementById("f-necessitaAcao").value = report.necessitaAcao;

  // 11. Resumo do Acompanhamento
  document.getElementById("f-resumo").value = report.resumo;

  // 12. Observações Gerais
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
  const dev = state.devices.find(d => d.device_id === state.selectedDeviceId) || state.devices[0];
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

// ============================================================================
// Bot Diário Automático (Segunda a Sexta às 08:15) + Fila Diária
// ============================================================================

function initBotScheduler() {
  const timeInput = document.getElementById("bot-time-input");
  const toggleInput = document.getElementById("bot-enabled-toggle");

  if (timeInput) timeInput.value = state.botTime;
  if (toggleInput) toggleInput.checked = state.botEnabled;

  updateBotStatusBanner();

  // Verifica a cada 15 segundos se chegou no horário de Seg a Sex
  setInterval(() => {
    updateBotStatusBanner();
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
  updateBotStatusBanner();
  showToast(`Bot configurado para Seg a Sex às ${state.botTime}!`);
}

function updateBotStatusBanner() {
  const now = new Date();
  const clockEl = document.getElementById("live-clock");
  if (clockEl) {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    clockEl.textContent = `${days[now.getDay()]}, ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  }

  const nextEl = document.getElementById("bot-next-run");
  if (nextEl) {
    if (!state.botEnabled) {
      nextEl.textContent = "Bot pausado";
    } else {
      nextEl.textContent = `Ativo • Seg a Sex às ${state.botTime}`;
    }
  }
}

async function checkAndTriggerDailyBot() {
  if (!state.botEnabled) return;
  const now = new Date();
  const day = now.getDay(); // 1 = Seg ... 5 = Sex
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
  showToast(isAutoSchedule ? "⏰ Disparo das 08:15 iniciado! Atualizando telemetria..." : "Gerando fila diária de todos os equipamentos...");
  await loadAllDashboardData();

  // Busca estatísticas 24h dos dispositivos principais para enriquecer a fila
  const priorityDevices = state.devices.filter(d => d.isPriority && !d.isPreset);
  await Promise.all(
    priorityDevices.map(async dev => {
      const stats = await fetch24hStatsForDevice(dev);
      state.generatedReports[dev.device_id] = buildReportForDevice(dev, stats);
    })
  );

  if (state.selectedDeviceId) {
    const currentDev = state.devices.find(d => d.device_id === state.selectedDeviceId);
    if (currentDev) populateFormUI(currentDev, state.generatedReports[currentDev.device_id]);
  }

  openBatchModal();
  playNotificationBeep();

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("WBM Acompanhamento Diário (08:15)", {
      body: `${priorityDevices.length} equipamentos analisados e prontos para enviar ao Google Forms!`,
      icon: "https://wbmiotmonitor.lovable.app/favicon.png"
    });
  }
}

function requestBrowserNotificationPermission() {
  if (!("Notification" in window)) {
    showToast("Este navegador não suporta notificações nativas.");
    return;
  }
  Notification.requestPermission().then(perm => {
    if (perm === "granted") {
      showToast("Notificações ativadas para o alerta das 08:15!");
    } else {
      showToast("Permissão de notificação negada pelo navegador.");
    }
  });
}

function playNotificationBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
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
            ${escapeHtml(clienteLabel)} • ${escapeHtml(identLabel)}
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

// ============================================================================
// Modal de Configurações (Credenciais Dashboard & Responsável Padrão)
// ============================================================================

function openSettingsModal() {
  document.getElementById("cfg-email").value = state.email;
  document.getElementById("cfg-password").value = state.password;
  document.getElementById("cfg-responsavel").value = state.responsavelPadrao;
  document.getElementById("settings-modal")?.classList.remove("hidden");
}

function closeSettingsModal() {
  document.getElementById("settings-modal")?.classList.add("hidden");
}

async function saveCredentialsSettings() {
  state.email = document.getElementById("cfg-email").value.trim();
  state.password = document.getElementById("cfg-password").value;
  state.responsavelPadrao = document.getElementById("cfg-responsavel").value;

  localStorage.setItem("wbm_email", state.email);
  localStorage.setItem("wbm_password", state.password);
  localStorage.setItem("wbm_responsavel", state.responsavelPadrao);

  closeSettingsModal();
  await loadAllDashboardData();
  showToast("Configurações salvas e dados recarregados!");
}

// ============================================================================
// Utilitários
// ============================================================================

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

// Inicialização ao carregar a página
window.addEventListener("DOMContentLoaded", () => {
  initBotScheduler();
  loadAllDashboardData();

  // Atualiza preview URL sempre que qualquer campo do formulário for editado
  document.getElementById("acompanhamento-form")?.addEventListener("input", updatePreviewLink);
  document.getElementById("acompanhamento-form")?.addEventListener("change", updatePreviewLink);
});
