function getApiBaseUrl() {
  return "/api/v1";
}

const API_BASE = getApiBaseUrl();

function getClientBaseUrl() {
  const href = window.location.href;
  const lastSlash = href.lastIndexOf("/");
  if (lastSlash > 0) {
    return href.substring(0, lastSlash);
  }
  return window.location.origin;
}

const STAND_CONFIGS = {
  ouros: {
    nome: "Ouros",
    logo: "assets/ouros-logo.svg",
    wave: "assets/header-wave-ouros.svg",
    mascote: "assets/ouros-mascote.svg",
    class: "theme-ouros"
  },
  ceris: {
    nome: "Ceris",
    logo: "assets/ceris-logo.svg",
    wave: "assets/header-wave-ceris.svg",
    mascote: "assets/ceris-mascote.svg",
    class: "theme-ceris"
  },
  ecociente: {
    nome: "EcoCiente",
    logo: "assets/ecociente-logo-text.svg",
    wave: "assets/header-wave-ecociente.svg",
    mascote: "assets/ecociente-mascote.png",
    class: "theme-ecociente"
  },
  apollo: {
    nome: "apollo >",
    logo: "assets/apollo-logo.svg",
    wave: "assets/header-wave-apollo.svg",
    mascote: "assets/apollo-solar.png",
    class: "theme-apollo"
  }
};

// Mapeamento rápido de PINs padrão para pré-visualização instantânea do tema ao digitar
const PIN_PREVIEW_MAP = {
  "573550": "ouros",
  "729460": "ceris",
  "865686": "ecociente",
  "641450": "apollo"
};

let currentStand = null;
let currentStandName = null;
let currentPin = null;
let renewTimeoutId = null;
let countdownIntervalId = null;
let qrCodeInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  const themeWrapper = document.getElementById("theme-wrapper");
  const standLogoEl = document.getElementById("stand-logo");
  const waveEl = document.getElementById("stand-header-wave");
  const mascoteEl = document.getElementById("stand-mascote");

  const loginView = document.getElementById("totem-login-view");
  const activeView = document.getElementById("totem-active-view");
  const formLogin = document.getElementById("form-totem-login");
  const inputPin = document.getElementById("input-pin");
  const btnTogglePin = document.getElementById("btn-toggle-pin");
  const loginError = document.getElementById("login-error");
  const btnLoginSubmit = document.getElementById("btn-login-submit");
  const btnLogout = document.getElementById("btn-logout");
  const btnFullscreen = document.getElementById("btn-fullscreen");

  const standTitleEl = document.getElementById("stand-title");
  const badgeLabelEl = document.getElementById("totem-badge-label");
  const qrContainer = document.getElementById("qrcode");
  const countdownTextEl = document.getElementById("countdown-text");
  const timerProgressFill = document.getElementById("timer-progress-fill");

  const loginBrandIcons = document.querySelectorAll(".totem-brands-bar img[data-stand]");
  const activeBrandIcons = document.querySelectorAll(".totem-brands-active img[data-stand-active]");

  function normalizarStandSlug(raw) {
    if (!raw) return "ouros";
    const s = raw.trim().toLowerCase();
    if (s === "eco" || s.includes("ecociente")) return "ecociente";
    if (STAND_CONFIGS[s]) return s;
    return "ouros";
  }

  function aplicarTemaStand(slug) {
    const cleanSlug = normalizarStandSlug(slug);
    const config = STAND_CONFIGS[cleanSlug] || STAND_CONFIGS.ouros;

    if (themeWrapper) {
      themeWrapper.className = config.class;
    }
    if (standLogoEl) {
      standLogoEl.src = config.logo;
    }
    if (waveEl) {
      waveEl.src = config.wave;
    }
    if (mascoteEl && cleanSlug === "ouros") {
      mascoteEl.src = config.mascote;
    }

    loginBrandIcons.forEach((img) => {
      img.classList.toggle("brand-active", img.dataset.stand === cleanSlug);
    });

    activeBrandIcons.forEach((img) => {
      img.classList.toggle("brand-active", img.dataset.standActive === cleanSlug);
    });
  }

  // Permite clicar nos ícones dos 4 estandes para visualizar o tema
  loginBrandIcons.forEach((img) => {
    img.addEventListener("click", () => {
      const slug = img.dataset.stand;
      if (slug) {
        aplicarTemaStand(slug);
      }
    });
  });

  // Identificação automática de tema enquanto o usuário digita o PIN
  if (inputPin) {
    inputPin.addEventListener("input", () => {
      if (loginError) loginError.style.display = "none";
      const val = inputPin.value.trim();
      const matchedStand = PIN_PREVIEW_MAP[val];

      if (matchedStand && STAND_CONFIGS[matchedStand]) {
        aplicarTemaStand(matchedStand);
      }
    });
  }

  // Alternar visualização do PIN
  if (btnTogglePin && inputPin) {
    btnTogglePin.addEventListener("click", () => {
      const isPassword = inputPin.type === "password";
      inputPin.type = isPassword ? "text" : "password";
      btnTogglePin.innerHTML = isPassword
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    });
  }

  // Alternar tela cheia
  if (btnFullscreen) {
    btnFullscreen.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn("Não foi possível entrar em tela cheia:", err);
        });
        btnFullscreen.innerText = "Sair da Tela Cheia";
      } else {
        document.exitFullscreen().catch(() => {});
        btnFullscreen.innerText = "Tela Cheia";
      }
    });
  }

  // Logout / Trocar PIN
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      logout();
    });
  }

  // Submissão do formulário de login (identifica o estande automaticamente pelo PIN)
  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginError) loginError.style.display = "none";
      const pin = inputPin.value.trim();

      if (!pin) {
        exibirErroLogin("Por favor, informe o PIN de acesso do estande.");
        return;
      }

      btnLoginSubmit.disabled = true;
      btnLoginSubmit.innerText = "Identificando estande...";

      try {
        await realizarLogin(pin);
      } catch (err) {
        exibirErroLogin(err.message);
      } finally {
        btnLoginSubmit.disabled = false;
        btnLoginSubmit.innerText = "Gerar QR Code";
      }
    });
  }

  function exibirErroLogin(msg) {
    if (loginError) {
      loginError.innerText = msg;
      loginError.style.display = "block";
    }
  }

  function formatarTempo(segundos) {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  }

  function iniciarCountdown(tempoTotalSegundos) {
    if (countdownIntervalId) clearInterval(countdownIntervalId);
    const total = Math.max(1, Math.floor(tempoTotalSegundos));
    let restante = total;

    function atualizarTexto() {
      if (countdownTextEl) {
        countdownTextEl.innerText = `Próxima renovação em ${formatarTempo(restante)}`;
      }
      if (timerProgressFill) {
        const pct = Math.max(0, Math.min(100, (restante / total) * 100));
        timerProgressFill.style.width = `${pct}%`;
      }
      if (restante <= 0) {
        clearInterval(countdownIntervalId);
      }
      restante--;
    }

    atualizarTexto();
    countdownIntervalId = setInterval(atualizarTexto, 1000);
  }

  function desenharQRCode(url) {
    qrContainer.innerHTML = "";
    qrCodeInstance = new QRCode(qrContainer, {
      text: url,
      width: 300,
      height: 300,
      colorDark: "#171438",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  async function realizarLogin(pin) {
    const baseUrl = getClientBaseUrl();
    const payload = {
      pin: pin,
      stand_slug: null,
      base_url: baseUrl
    };

    const res = await fetch(`${API_BASE}/stands/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "PIN inválido ou não encontrado.");
    }

    currentStand = normalizarStandSlug(data.stand);
    currentStandName = data.nome || STAND_CONFIGS[currentStand]?.nome || currentStand.toUpperCase();
    currentPin = pin;

    // Salva sessão local para manter conectado caso recarregue
    sessionStorage.setItem("totem_stand", currentStand);
    sessionStorage.setItem("totem_stand_name", currentStandName);
    sessionStorage.setItem("totem_pin", currentPin);

    ativarModoTotem(data.qr_url, data.expires_in_seconds);
  }

  function ativarModoTotem(qrUrl, expiresSeconds) {
    aplicarTemaStand(currentStand);

    if (standTitleEl) {
      standTitleEl.innerText = currentStandName || currentStand.toUpperCase();
    }
    if (badgeLabelEl) {
      badgeLabelEl.innerText = `Token Oficial • ${currentStandName || currentStand.toUpperCase()}`;
    }

    loginView.style.display = "none";
    activeView.style.display = "flex";

    desenharQRCode(qrUrl);

    const validade = Number(expiresSeconds) || 300;
    const tempoRenovacaoSegundos = Math.max(10, Math.floor((validade * 2) / 3));

    iniciarCountdown(tempoRenovacaoSegundos);

    if (renewTimeoutId) clearTimeout(renewTimeoutId);
    renewTimeoutId = setTimeout(renovarTokenAutomaticamente, tempoRenovacaoSegundos * 1000);
  }

  async function renovarTokenAutomaticamente() {
    if (!currentStand || !currentPin) return;
    try {
      const baseUrl = getClientBaseUrl();
      const res = await fetch(
        `${API_BASE}/stands/${currentStand}/token?base_url=${encodeURIComponent(baseUrl)}`,
        {
          headers: { "X-Stand-Pin": currentPin }
        }
      );
      const data = await res.json();
      if (res.ok && data.qr_url) {
        desenharQRCode(data.qr_url);
        const validade = Number(data.expires_in_seconds) || 300;
        const tempoRenovacaoSegundos = Math.max(10, Math.floor((validade * 2) / 3));
        iniciarCountdown(tempoRenovacaoSegundos);
        if (renewTimeoutId) clearTimeout(renewTimeoutId);
        renewTimeoutId = setTimeout(renovarTokenAutomaticamente, tempoRenovacaoSegundos * 1000);
      } else {
        console.warn("Resposta inesperada ao renovar QR Code:", data);
        if (renewTimeoutId) clearTimeout(renewTimeoutId);
        renewTimeoutId = setTimeout(renovarTokenAutomaticamente, 15000);
      }
    } catch (e) {
      console.error("Erro ao renovar QR Code:", e);
      if (renewTimeoutId) clearTimeout(renewTimeoutId);
      renewTimeoutId = setTimeout(renovarTokenAutomaticamente, 10000);
    }
  }

  function logout() {
    const ultimoStand = currentStand || "ouros";
    sessionStorage.removeItem("totem_stand");
    sessionStorage.removeItem("totem_stand_name");
    sessionStorage.removeItem("totem_pin");
    currentStand = null;
    currentStandName = null;
    currentPin = null;

    if (renewTimeoutId) clearTimeout(renewTimeoutId);
    if (countdownIntervalId) clearInterval(countdownIntervalId);

    if (qrCodeInstance) {
      qrCodeInstance.clear();
      qrContainer.innerHTML = "";
      qrCodeInstance = null;
    }

    if (inputPin) inputPin.value = "";
    if (loginError) loginError.style.display = "none";

    aplicarTemaStand(ultimoStand);
    activeView.style.display = "none";
    loginView.style.display = "flex";
  }

  // Inicialização: verifica parâmetros na URL (?pin=... ou ?stand=...) ou sessão
  const urlParams = new URLSearchParams(window.location.search);
  const paramPin = urlParams.get("pin");
  const paramStand = urlParams.get("stand");

  const savedPin = sessionStorage.getItem("totem_pin");
  const savedStand = sessionStorage.getItem("totem_stand");

  const standInicial = paramStand || savedStand || "ouros";
  aplicarTemaStand(standInicial);

  const pinInicial = paramPin || savedPin;

  if (pinInicial) {
    if (inputPin) {
      inputPin.value = pinInicial;
    }
    realizarLogin(pinInicial).catch((err) => {
      console.warn("Autenticação automática falhou:", err.message);
      logout();
      exibirErroLogin(`Falha na autenticação automática: ${err.message}`);
    });
  } else {
    loginView.style.display = "flex";
  }
});
