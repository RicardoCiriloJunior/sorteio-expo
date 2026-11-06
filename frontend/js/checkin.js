function getApiBaseUrl() {
  return "/api/v1";
}

const API_BASE_URL = getApiBaseUrl();

const STAND_CONFIGS = {
  ouros: {
    logo: "assets/ouros-logo.svg",
    wave: "assets/header-wave-ouros.svg",
    mascote: "assets/ouros-mascote.svg",
    class: "theme-ouros"
  },
  ceris: {
    logo: "assets/ceris-logo.svg",
    wave: "assets/header-wave-ceris.svg",
    mascote: "assets/ceris-mascote.svg",
    class: "theme-ceris"
  },
  ecociente: {
    logo: "assets/ecociente-logo-text.svg",
    wave: "assets/header-wave-ecociente.svg",
    mascote: "assets/ecociente-mascote.png",
    class: "theme-ecociente"
  },
  apollo: {
    logo: "assets/apollo-logo.svg",
    wave: "assets/header-wave-apollo.svg",
    mascote: "assets/apollo-solar.png",
    class: "theme-apollo"
  }
};

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

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const rawStand = (urlParams.get("stand") || "ouros").toLowerCase();
  const standSlug = rawStand === "eco" ? "ecociente" : rawStand;
  const token = urlParams.get("token") || "";

  // 1. Aplica o tema visual conforme o stand lido
  const config = STAND_CONFIGS[standSlug] || STAND_CONFIGS.ouros;
  const themeWrapper = document.getElementById("theme-wrapper");
  if (themeWrapper) {
    themeWrapper.className = config.class;
  }

  const standLogoEl = document.getElementById("stand-logo");
  if (standLogoEl) {
    standLogoEl.src = config.logo;
  }

  const waveEl = document.getElementById("stand-header-wave");
  if (waveEl) waveEl.src = config.wave;

  const mascoteEl = document.getElementById("stand-mascote");
  if (mascoteEl && standSlug === "ouros") mascoteEl.src = config.mascote;

  const inputNome = document.getElementById("input-nome");
  const inputTelefone = document.getElementById("input-telefone");
  const sessionBanner = document.getElementById("session-message");

  // 2. Auto-preenche os inputs se houver dados guardados na sessão / storage / cookies
  const salvoNome = storageGet("participante_nome");
  const salvoTelefone = storageGet("participante_telefone");

  if (salvoNome && inputNome) {
    inputNome.value = salvoNome;
  }
  if (salvoTelefone && inputTelefone) {
    inputTelefone.value = formatarTelefone(salvoTelefone);
  }

  if (salvoNome && salvoTelefone && sessionBanner) {
    sessionBanner.innerText = "Dados recuperados! Confirme para validar este estande.";
    sessionBanner.style.display = "block";
  }

  // 3. Recuperação inteligente pelo telefone ao digitar ou perder foco
  let lookupDebounce = null;
  async function tentarRecuperarPorTelefone(telValor) {
    if (!token) return;
    const digitos = (telValor || "").replace(/\D/g, "");
    let limpo = digitos;
    if ((limpo.length === 12 || limpo.length === 13) && limpo.startsWith("55")) {
      limpo = limpo.slice(2);
    }
    if (limpo.length !== 10 && limpo.length !== 11) return;

    // Se já temos nome preenchido e já temos ID do mesmo telefone, não repete requisição
    const telSalvo = storageGet("participante_telefone");
    if (inputNome && inputNome.value.trim() && storageGet("participante_id") && telSalvo && telSalvo.replace(/\D/g, "") === limpo) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/checkin/recuperar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone: limpo,
          stand_slug: standSlug,
          token: token
        })
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.encontrado && data.participante) {
        if (inputNome && (!inputNome.value || inputNome.value.trim() === "")) {
          inputNome.value = data.participante.nome;
        }
        storageSet("participante_id", data.participante.id);
        storageSet("participante_nome", data.participante.nome);
        storageSet("participante_telefone", formatarTelefone(data.participante.telefone));
        if (sessionBanner) {
          sessionBanner.innerText = "Dados recuperados! Confirme para validar este estande.";
          sessionBanner.style.display = "block";
        }
      }
    } catch (e) {
      // Ignora falha de rede silenciosamente na recuperação prévia
    }
  }

  // Máscara em tempo real para o campo de telefone e escuta de preenchimento
  if (inputTelefone) {
    inputTelefone.addEventListener("input", (e) => {
      e.target.value = formatarTelefone(e.target.value);
      clearTimeout(lookupDebounce);
      lookupDebounce = setTimeout(() => {
        tentarRecuperarPorTelefone(e.target.value);
      }, 400);
    });
    inputTelefone.addEventListener("blur", (e) => {
      tentarRecuperarPorTelefone(e.target.value);
    });
  }

  // Se havia telefone salvo mas não o nome, tenta recuperar pelo telefone imediatamente
  if (salvoTelefone && (!salvoNome || (inputNome && !inputNome.value))) {
    tentarRecuperarPorTelefone(salvoTelefone);
  }

  // 4. Submissão do formulário
  const form = document.getElementById("form-checkin");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSubmit = document.getElementById("btn-submit");
      const errorBox = document.getElementById("error-message");

      const nome = inputNome ? inputNome.value.trim() : "";
      const telefone = inputTelefone ? inputTelefone.value.trim() : "";
      
      const storedId = storageGet("participante_id");
      const participanteId = (storedId && storedId !== "null" && storedId !== "undefined")
        ? storedId
        : null;

      btnSubmit.disabled = true;
      btnSubmit.innerText = "Validando presença...";
      errorBox.style.display = "none";

      try {
        const response = await fetch(`${API_BASE_URL}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participante_id: participanteId,
            nome: nome,
            telefone: telefone,
            stand_slug: standSlug,
            token: token
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Erro ao registrar presença.");
        }

        // Atualiza os storages com os dados confirmados
        storageSet("participante_id", data.participante.id);
        storageSet("participante_nome", data.participante.nome);
        storageSet("participante_telefone", formatarTelefone(data.participante.telefone));

        // Redireciona para a tela de status do participante
        window.location.href = `status.html?id=${data.participante.id}`;
      } catch (err) {
        errorBox.innerText = err.message;
        errorBox.style.display = "block";
        btnSubmit.disabled = false;
        btnSubmit.innerText = "Continuar";
      }
    });
  }
});
