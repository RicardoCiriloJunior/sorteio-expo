function getApiBaseUrl() {
  return "/api/v1";
}

const API_BASE = getApiBaseUrl();

function formatarTelefoneExibicao(valor, mascarar = true) {
  const digitos = String(valor || "").replace(/\D/g, "");
  if (digitos.length === 11) {
    if (mascarar) {
      return `(${digitos.slice(0, 2)}) ${digitos[2]}••••-${digitos.slice(7)}`;
    }
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }
  if (digitos.length === 10) {
    if (mascarar) {
      return `(${digitos.slice(0, 2)}) ••••-${digitos.slice(6)}`;
    }
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return valor || "-";
}

let currentAdminKey = null;
let currentAptosList = [];
let currentWinner = null;
let isPhoneMasked = true;
let isDrawing = false;

document.addEventListener("DOMContentLoaded", () => {
  const loginView = document.getElementById("admin-login-view");
  const panelView = document.getElementById("admin-panel-view");
  const formLogin = document.getElementById("form-admin-login");
  const inputAdminKey = document.getElementById("input-admin-key");
  const btnToggleAdminKey = document.getElementById("btn-toggle-admin-key");
  const loginError = document.getElementById("admin-login-error");
  const btnAdminLogin = document.getElementById("btn-admin-login");

  const panelError = document.getElementById("admin-panel-error");
  const statParticipantes = document.getElementById("stat-participantes");
  const statCheckins = document.getElementById("stat-checkins");
  const statAptos = document.getElementById("stat-aptos");

  const countOuros = document.getElementById("count-ouros");
  const countCeris = document.getElementById("count-ceris");
  const countEcociente = document.getElementById("count-ecociente");
  const countApollo = document.getElementById("count-apollo");

  const stageBox = document.getElementById("admin-stage-box");
  const stageIdle = document.getElementById("stage-idle");
  const stageRolling = document.getElementById("stage-rolling");
  const stageWinner = document.getElementById("stage-winner");
  const stageReadyHint = document.getElementById("stage-ready-hint");
  const rollingName = document.getElementById("rolling-name");
  const rollingPhone = document.getElementById("rolling-phone");

  const winnerNameEl = document.getElementById("winner-name");
  const winnerPhoneEl = document.getElementById("winner-phone");
  const winnerIdEl = document.getElementById("winner-id");
  const btnTogglePhone = document.getElementById("btn-toggle-phone");

  const btnSortear = document.getElementById("btn-sortear");
  const btnToggleAptos = document.getElementById("btn-toggle-aptos");
  const btnRefreshStats = document.getElementById("btn-refresh-stats");
  const btnFullscreen = document.getElementById("btn-admin-fullscreen");
  const btnLogout = document.getElementById("btn-admin-logout");

  const aptosDrawer = document.getElementById("aptos-drawer");
  const aptosListEl = document.getElementById("aptos-list");

  const modalGanhador = document.getElementById("modal-ganhador");
  const modalWinnerName = document.getElementById("modal-winner-name");
  const modalWinnerPhone = document.getElementById("modal-winner-phone");
  const btnCloseWinnerModal = document.getElementById("btn-close-winner-modal");

  if (btnToggleAdminKey && inputAdminKey) {
    btnToggleAdminKey.addEventListener("click", () => {
      const isPassword = inputAdminKey.type === "password";
      inputAdminKey.type = isPassword ? "text" : "password";
    });
  }

  if (btnTogglePhone) {
    btnTogglePhone.addEventListener("click", () => {
      if (!currentWinner) return;
      isPhoneMasked = !isPhoneMasked;
      atualizarTextoTelefoneGanhador();
    });
  }

function atualizarTextoTelefoneGanhador() {
    if (!currentWinner) return;
    const formatted = formatarTelefoneExibicao(currentWinner.telefone, false);
    if (winnerPhoneEl) winnerPhoneEl.innerText = formatted;
    if (modalWinnerPhone) modalWinnerPhone.innerText = formatted;
  }

  if (btnToggleAptos && aptosDrawer) {
    btnToggleAptos.addEventListener("click", () => {
      const open = aptosDrawer.style.display === "block";
      aptosDrawer.style.display = open ? "none" : "block";
      btnToggleAptos.innerText = open ? "Ver Aptos" : "Ocultar Aptos";
    });
  }

  if (btnRefreshStats) {
    btnRefreshStats.addEventListener("click", async () => {
      if (!currentAdminKey) return;
      btnRefreshStats.disabled = true;
      try {
        await carregarResumo(currentAdminKey);
      } catch (err) {
        exibirErroPainel(err.message);
      } finally {
        btnRefreshStats.disabled = false;
      }
    });
  }

  if (btnFullscreen) {
    btnFullscreen.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        btnFullscreen.innerText = "Sair Tela Cheia";
      } else {
        document.exitFullscreen().catch(() => {});
        btnFullscreen.innerText = "Tela Cheia";
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      logout();
    });
  }

  if (btnCloseWinnerModal && modalGanhador) {
    btnCloseWinnerModal.addEventListener("click", () => {
      modalGanhador.style.display = "none";
    });
    modalGanhador.addEventListener("click", (e) => {
      if (e.target === modalGanhador) {
        modalGanhador.style.display = "none";
      }
    });
  }

  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginError) loginError.style.display = "none";
      const key = inputAdminKey.value.trim();

      if (!key) {
        exibirErroLogin("Informe a chave administrativa (ADMIN_KEY).");
        return;
      }

      btnAdminLogin.disabled = true;
      btnAdminLogin.innerText = "Verificando credencial...";

      try {
        await autenticarAdmin(key);
      } catch (err) {
        exibirErroLogin(err.message);
      } finally {
        btnAdminLogin.disabled = false;
        btnAdminLogin.innerText = "Acessar Painel de Sorteio";
      }
    });
  }

  if (btnSortear) {
    btnSortear.addEventListener("click", async () => {
      if (isDrawing || !currentAdminKey) return;
      await executarSorteio();
    });
  }

  function exibirErroLogin(msg) {
    if (loginError) {
      loginError.innerText = msg;
      loginError.style.display = "block";
    }
  }

  function exibirErroPainel(msg) {
    if (panelError) {
      panelError.innerText = msg;
      panelError.style.display = "block";
    }
  }

  async function autenticarAdmin(key) {
    await carregarResumo(key);
    currentAdminKey = key;
    sessionStorage.setItem("expo_admin_key", key);

    loginView.style.display = "none";
    panelView.style.display = "flex";
  }

  function formatarContagem(qtd) {
    const n = Number(qtd) || 0;
    return `${n} ${n === 1 ? "visita" : "visitas"}`;
  }

  async function carregarResumo(key) {
    if (panelError) panelError.style.display = "none";

    const res = await fetch(`${API_BASE}/admin/sorteio/resumo`, {
      headers: { "X-Admin-Key": key }
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Chave administrativa inválida.");
    }

    if (statParticipantes) statParticipantes.innerText = data.total_participantes ?? 0;
    if (statCheckins) statCheckins.innerText = data.total_checkins ?? 0;
    if (statAptos) statAptos.innerText = data.total_aptos ?? 0;

    const countsMap = {};
    (data.stands || []).forEach((s) => {
      countsMap[s.slug] = s.total_checkins;
    });

    if (countOuros) countOuros.innerText = formatarContagem(countsMap.ouros);
    if (countCeris) countCeris.innerText = formatarContagem(countsMap.ceris);
    if (countEcociente) countEcociente.innerText = formatarContagem(countsMap.ecociente);
    if (countApollo) countApollo.innerText = formatarContagem(countsMap.apollo);

    currentAptosList = data.aptos || [];
    renderizarListaAptos(currentAptosList);

    if (stageReadyHint) {
      if (data.total_aptos > 0) {
        stageReadyHint.innerText = `${data.total_aptos} participante(s) apto(s) para o sorteio.`;
      } else {
        stageReadyHint.innerText = "Nenhum participante completou os 4 estandes ainda.";
      }
    }
  }

  function renderizarListaAptos(lista) {
    if (!aptosListEl) return;
    aptosListEl.innerHTML = "";

    if (!lista || lista.length === 0) {
      const li = document.createElement("li");
      li.innerHTML = `<span>Nenhum participante concluiu os 4 estandes até o momento.</span>`;
      aptosListEl.appendChild(li);
      return;
    }

    lista.forEach((p) => {
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = p.nome;
      const span = document.createElement("span");
      span.textContent = formatarTelefoneExibicao(p.telefone, false);
      li.appendChild(strong);
      li.appendChild(span);
      aptosListEl.appendChild(li);
    });
  }

  async function executarSorteio() {
    if (panelError) panelError.style.display = "none";
    isDrawing = true;
    btnSortear.disabled = true;
    btnSortear.innerText = "Sorteando...";

    try {
      const res = await fetch(`${API_BASE}/admin/sorteio/sortear`, {
        headers: { "X-Admin-Key": currentAdminKey }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Falha ao realizar o sorteio.");
      }

      if (statAptos) statAptos.innerText = data.total_aptos ?? 0;

      if (!data.ganhador) {
        exibirErroPainel("Não há participantes aptos (que visitaram os 4 estandes) para sortear no momento.");
        return;
      }

      await animarSuspenseSorteio(data.ganhador);

      currentWinner = data.ganhador;
      isPhoneMasked = true;

      stageBox.classList.remove("is-rolling");
      stageBox.classList.add("has-winner");
      stageIdle.style.display = "none";
      stageRolling.style.display = "none";
      stageWinner.style.display = "flex";

      if (winnerNameEl) winnerNameEl.innerText = currentWinner.nome;
      if (winnerIdEl) winnerIdEl.innerText = `ID: ${currentWinner.id}`;
      if (modalWinnerName) modalWinnerName.innerText = currentWinner.nome;
      atualizarTextoTelefoneGanhador();

      if (modalGanhador) {
        modalGanhador.style.display = "flex";
      }

      btnSortear.innerText = "Sortear Novamente";
    } catch (err) {
      exibirErroPainel(err.message);
      btnSortear.innerText = "Realizar Sorteio Agora";
    } finally {
      isDrawing = false;
      btnSortear.disabled = false;
    }
  }

  function animarSuspenseSorteio(ganhadorFinal) {
    return new Promise((resolve) => {
      stageBox.classList.remove("has-winner");
      stageBox.classList.add("is-rolling");
      stageIdle.style.display = "none";
      stageWinner.style.display = "none";
      stageRolling.style.display = "flex";

      const pool =
        currentAptosList.length > 1
          ? currentAptosList
          : [
              ganhadorFinal,
              { nome: "Validando presenças...", telefone: "11999999999" },
              { nome: "Conferindo 4 estandes...", telefone: "11988888888" },
              ganhadorFinal
            ];

      let ticks = 0;
      const maxTicks = 22;
      const interval = setInterval(() => {
        const candidate = pool[ticks % pool.length];
        if (rollingName) rollingName.innerText = candidate.nome;
        if (rollingPhone) {
          rollingPhone.innerText = formatarTelefoneExibicao(candidate.telefone, false);
        }
        ticks++;
        if (ticks >= maxTicks) {
          clearInterval(interval);
          resolve();
        }
      }, 95);
    });
  }

  function logout() {
    sessionStorage.removeItem("expo_admin_key");
    currentAdminKey = null;
    currentWinner = null;
    if (inputAdminKey) inputAdminKey.value = "";
    if (loginError) loginError.style.display = "none";
    if (panelError) panelError.style.display = "none";

    stageBox.classList.remove("is-rolling", "has-winner");
    stageIdle.style.display = "flex";
    stageRolling.style.display = "none";
    stageWinner.style.display = "none";

    panelView.style.display = "none";
    loginView.style.display = "flex";
  }

  const urlParams = new URLSearchParams(window.location.search);
  const paramKey = urlParams.get("key") || urlParams.get("admin_key");
  const savedKey = sessionStorage.getItem("expo_admin_key");
  const initialKey = paramKey || savedKey;

  if (initialKey) {
    if (inputAdminKey) inputAdminKey.value = initialKey;
    autenticarAdmin(initialKey).catch((err) => {
      logout();
      exibirErroLogin(`Sessão expirada ou chave inválida: ${err.message}`);
    });
  } else {
    loginView.style.display = "flex";
  }
});
