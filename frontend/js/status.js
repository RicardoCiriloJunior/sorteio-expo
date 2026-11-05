function getApiBaseUrl() {
  return "/api/v1";
}

const API_BASE_URL = getApiBaseUrl();

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
  const participanteId = urlParams.get("id") || localStorage.getItem("participante_id");
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

  try {
    const response = await fetch(`${API_BASE_URL}/participantes/${participanteId}/status`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.detail || "Falha ao obter status.");

    renderizarStands(data.stands);
    atualizarBarraProgresso(data.total_visitados, data.concluiu_todos);

    if (data.concluiu_todos) {
      exibirModalSucesso();
    }
  } catch (err) {
    console.error("Erro ao consultar progresso do participante:", err);
  }
});
