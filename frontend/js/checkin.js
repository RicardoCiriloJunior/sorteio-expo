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

  // Máscara em tempo real para o campo de telefone
  const inputTelefone = document.getElementById("input-telefone");
  if (inputTelefone) {
    inputTelefone.addEventListener("input", (e) => {
      e.target.value = formatarTelefone(e.target.value);
    });
  }

  // 2. Auto-preenche os inputs se houver dados guardados na sessão
  const salvoNome = localStorage.getItem("participante_nome");
  const salvoTelefone = localStorage.getItem("participante_telefone");
  const sessionBanner = document.getElementById("session-message");

  if (salvoNome) {
    const inputNome = document.getElementById("input-nome");
    if (inputNome) inputNome.value = salvoNome;
  }
  if (salvoTelefone && inputTelefone) {
    inputTelefone.value = formatarTelefone(salvoTelefone);
  }

  if (salvoNome && salvoTelefone && sessionBanner) {
    sessionBanner.innerText = "Dados recuperados! Confirme para validar este estande.";
    sessionBanner.style.display = "block";
  }

  // 3. Submissão do formulário
  const form = document.getElementById("form-checkin");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSubmit = document.getElementById("btn-submit");
      const errorBox = document.getElementById("error-message");

      const nome = document.getElementById("input-nome").value.trim();
      const telefone = inputTelefone.value.trim();
      
      const storedId = localStorage.getItem("participante_id");
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

        // Atualiza o localStorage com os dados confirmados
        localStorage.setItem("participante_id", data.participante.id);
        localStorage.setItem("participante_nome", data.participante.nome);
        localStorage.setItem("participante_telefone", formatarTelefone(data.participante.telefone));

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
