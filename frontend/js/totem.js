const API_BASE = "http://localhost:6767/api/v1";

const TOTEM_LOGOS = {
  ouros: "assets/ouros-logo.svg",
  ceris: "assets/ceris-logo.svg",
  ecociente: "assets/ecociente-logo-text.svg",
  apollo: "assets/apollo-logo.svg"
};

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const rawStand = (urlParams.get("stand") || "ouros").toLowerCase();
  const stand = rawStand === "eco" ? "ecociente" : rawStand;
  const pin = urlParams.get("pin") || "1122"; // PIN do expositor

  const titleEl = document.getElementById("stand-title");
  if (titleEl) {
    titleEl.innerText = `Estande: ${stand.toUpperCase()}`;
  }

  const logoEl = document.getElementById("totem-logo");
  if (logoEl && TOTEM_LOGOS[stand]) {
    logoEl.src = TOTEM_LOGOS[stand];
  }

  const qrContainer = document.getElementById("qrcode");
  const qrcode = new QRCode(qrContainer, { width: 260, height: 260 });

  async function renovarQR() {
    let proximaAtualizacaoMs = 15000;
    try {
      const res = await fetch(`${API_BASE}/stands/${stand}/token`, {
        headers: { "X-Stand-Pin": pin }
      });
      const data = await res.json();
      if (res.ok && data.qr_url) {
        qrcode.clear();
        qrcode.makeCode(data.qr_url);
        const validadeSegundos = Number(data.expires_in_seconds);
        // Renova antes da expiração para manter tempo para preencher o formulário.
        proximaAtualizacaoMs = Number.isFinite(validadeSegundos) && validadeSegundos > 0
          ? Math.max(1000, Math.floor(validadeSegundos * 2 / 3) * 1000)
          : 60000;
      }
    } catch (e) {
      console.error("Falha ao renovar código QR:", e);
      // Fallback visual caso o backend ainda não esteja em execução local
      const fallbackUrl = `${window.location.origin}/frontend/checkin.html?stand=${stand}&token=demo`;
      qrcode.clear();
      qrcode.makeCode(fallbackUrl);
    }
    setTimeout(renovarQR, proximaAtualizacaoMs);
  }

  renovarQR();
});
