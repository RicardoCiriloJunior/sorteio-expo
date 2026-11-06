function getApiBaseUrl() {
  return "/api/v1";
}

const API_BASE_URL = getApiBaseUrl();

function formatarTelefone(valor) {
  if (!valor) return "";
  let digitos = valor.toString().replace(/\D/g, "");
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    digitos = digitos.slice(2);
  }
  digitos = digitos.slice(0, 11);
  if (digitos.length === 0) return "";
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

function getCookie(name) {
  try {
    const match = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
  } catch (e) {
    return null;
  }
}

function setCookie(name, value, days = 30) {
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch (e) {}
}

function storageGet(key) {
  try {
    const v = localStorage.getItem(key);
    if (v && v !== "null" && v !== "undefined") return v;
  } catch (e) {}
  try {
    const v = sessionStorage.getItem(key);
    if (v && v !== "null" && v !== "undefined") return v;
  } catch (e) {}
  const cv = getCookie(key);
  if (cv && cv !== "null" && cv !== "undefined") return cv;
  return null;
}

function storageSet(key, value) {
  if (!value) return;
  try { localStorage.setItem(key, value); } catch (e) {}
  try { sessionStorage.setItem(key, value); } catch (e) {}
  setCookie(key, value);
}

const STAND_CARDS_META = {
  ouros: {
    slug: "ouros",
    nome: "Ouros",
    brandHtml: `<img src="assets/card-ouros-logo.svg" alt="Ouros">`,
    emblem: "assets/card-ouros-icon.svg"
  },
  ceris: {
    slug: "ceris",
    nome: "Ceris",
    brandHtml: `<span class="stand-card-brand-text-ceris">Ceris</span>`,
    emblem: "assets/card-ceris-icon.svg"
  },
  ecociente: {
    slug: "ecociente",
    nome: "EcoCiente",
    brandHtml: `<img src="assets/card-ecociente-logo.svg" alt="EcoCiente">`,
    emblem: "assets/card-ecociente-icon.svg"
  },
  apollo: {
    slug: "apollo",
    nome: "Apollo",
    brandHtml: `<img src="assets/card-apollo-logo.svg" alt="Apollo">`,
    emblem: "assets/card-apollo-icon.svg"
  }
};

const DEFAULT_STANDS_ORDER = ["ouros", "ceris", "ecociente", "apollo"];

function renderizarStands(standsList) {
  const container = document.getElementById("stands-container");
  if (!container) return;
  container.innerHTML = "";

  standsList.forEach((stand) => {
    const rawKey = (stand.slug || stand.nome || "").toLowerCase();
    const key = rawKey.includes("eco") ? "ecociente" : rawKey;
    const meta = STAND_CARDS_META[key] || {
      slug: key,
      nome: stand.nome,
      brandHtml: `<strong>${stand.nome}</strong>`,
      emblem: "assets/card-ouros-icon.svg"
    };

    const card = document.createElement("div");
    card.className = `stand-card stand-${meta.slug} ${stand.visitado ? "visited" : ""}`;
    card.innerHTML = `
      <div class="stand-card-top-bar"></div>
      <div class="stand-card-body">
        <div class="stand-card-brand">${meta.brandHtml}</div>
        <img src="${meta.emblem}" alt="${meta.nome}" class="stand-card-emblem">
        <div class="stand-card-check">${stand.visitado ? "Visitado" : ""}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function atualizarBarraProgresso(totalVisitados, concluiuTodos) {
  const pill = document.getElementById("progress-pill");
  const fill = document.getElementById("progress-fill");
  const label = document.getElementById("label-status");

  const qtd = Math.max(0, Math.min(4, Number(totalVisitados) || 0));
  const percent = (qtd / 4) * 100;

  if (fill) {
    fill.style.width = qtd === 0 ? "25%" : `${percent}%`;
  }

  if (pill) {
    pill.classList.remove("progress-half", "progress-three", "progress-complete");
    if (qtd === 2) pill.classList.add("progress-half");
    if (qtd === 3) pill.classList.add("progress-three");
    if (qtd === 4 || concluiuTodos) pill.classList.add("progress-complete");
  }

  if (label) {
    if (qtd === 4 || concluiuTodos) {
      label.innerText = "Participação confirmada!";
    } else {
      label.innerText = `Status da Participação`;
    }
  }
}

function exibirModalSucesso() {
  const modal = document.getElementById("modal-sucesso");
  if (!modal) return;
  modal.style.display = "flex";

  const btnClose = document.getElementById("btn-close-modal");
  if (btnClose) {
    btnClose.onclick = () => {
      modal.style.display = "none";
    };
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  renderizarStands(
    DEFAULT_STANDS_ORDER.map((slug) => ({
      slug,
      nome: STAND_CARDS_META[slug].nome,
      visitado: false
    }))
  );
  atualizarBarraProgresso(0, false);

  const urlParams = new URLSearchParams(window.location.search);
  const participanteId = urlParams.get("id") || storageGet("participante_id");
  const demoVisits = urlParams.get("demo");

  if (demoVisits !== null) {
    const count = Math.max(0, Math.min(4, parseInt(demoVisits, 10) || 0));
    const demoStands = DEFAULT_STANDS_ORDER.map((slug, idx) => ({
      slug,
      nome: STAND_CARDS_META[slug].nome,
      visitado: idx < count
    }));
    renderizarStands(demoStands);
    atualizarBarraProgresso(count, count === 4);
    if (count === 4) exibirModalSucesso();
    return;
  }

  if (!participanteId) {
    return;
  }

  storageSet("participante_id", participanteId);

  try {
    const response = await fetch(`${API_BASE_URL}/participantes/${participanteId}/status`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.detail || "Falha ao obter status.");

    renderizarStands(data.stands);
    atualizarBarraProgresso(data.total_visitados, data.concluiu_todos);

    if (data.nome) storageSet("participante_nome", data.nome);
    if (data.telefone) storageSet("participante_telefone", formatarTelefone(data.telefone));
    if (data.participante_id) storageSet("participante_id", data.participante_id);

    if (data.concluiu_todos) {
      exibirModalSucesso();
    }
  } catch (err) {
    console.error("Erro ao consultar progresso do participante:", err);
  }
});
