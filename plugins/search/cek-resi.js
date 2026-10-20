import axios from "axios";
import { simpleQuoted } from "../../lib/quoted.js";

const V17_URL = `${global.bot?.api?.wudysoft}/api/tools/cek-resi/v17`;
const V18_URL = `${global.bot?.api?.wudysoft}/api/tools/cek-resi/v18`;
const ITEMS_PER_PAGE = 8;

// Fallback daftar ekspedisi populer di Indonesia
const POPULAR_COURIERS = [
  { name: "J&T Express", format: "jnt", desc: "J&T Express Standard & EZ" },
  { name: "JNE Express", format: "jne", desc: "Jalur Nugraha Ekakurir (REG/YES/OKE)" },
  { name: "SiCepat Ekspres", format: "sicepat", desc: "SiCepat REG, SIUNTUNG & BEST" },
  { name: "AnterAja", format: "anteraja", desc: "AnterAja Reguler & Next Day" },
  { name: "Shopee Xpress (SPX)", format: "spx", desc: "Shopee Express Standard & Hemat" },
  { name: "Ninja Xpress", format: "ninja", desc: "Ninja Van Logistics Indonesia" },
  { name: "ID Express", format: "ide", desc: "ID Express Service Standard" },
  { name: "Pos Indonesia", format: "pos", desc: "Pos Kilat Khusus & Pos Express" },
  { name: "Wahana Express", format: "wahana", desc: "Wahana Prestasi Logistik" },
  { name: "TIKI", format: "tiki", desc: "Titipan Kilat (REG/ONS/TDS)" },
  { name: "Lion Parcel", format: "lion", desc: "Lion Parcel (ONEPACK/REGPACK)" },
  { name: "Paxel", format: "paxel", desc: "Paxel Same Day Delivery" },
  { name: "SAP Express", format: "sap", desc: "Satria Antaran Prima" }
];

function parseResiFlags(rawStr) {
  const rest = {};
  let cleanText = rawStr;
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|([^-\s]+(?:\s+[^-\s]+)*?(?=\s+--|$))))?/g;
  const matches = [...rawStr.matchAll(flagRegex)];
  for (const match of matches) {
    const key = match[1].toLowerCase();
    let val = match[2] || match[3] || true;
    if (typeof val === "string") {
      val = val.trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
    }
    rest[key] = val;
    cleanText = cleanText.replace(match[0], "");
  }
  return {
    rest,
    cleanText: cleanText.trim()
  };
}

// Render HTML Canvas Tracking ke Gambar via html2img Wudysoft
async function renderHtmlToImage(htmlContent) {
  const rawApi = global.bot?.api?.wudysoft || "";
  const cleanApi = rawApi.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const baseUrl = `https://${cleanApi}/api/tools/html2img/`;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  };
  const payload = {
    html: htmlContent,
    fullPage: true,
    quality: 100
  };
  const versions = ["v5", "v1", "v2", "v3", "v4", "v6", "v7", "v8", "v9", "v10"];
  for (const ver of versions) {
    try {
      const res = await axios.post(`${baseUrl}${ver}`, payload, {
        headers,
        timeout: 15e3
      });
      const imgUrl = res.data?.url || res.data?.result || (typeof res.data === "string" ? res.data : null);
      if (imgUrl && /^https?:\/\//i.test(imgUrl)) {
        let buffer = null;
        try {
          const imgRes = await axios.get(imgUrl, {
            responseType: "arraybuffer",
            timeout: 12e3
          });
          if (imgRes.data) buffer = Buffer.from(imgRes.data);
        } catch {}
        return {
          url: imgUrl,
          buffer
        };
      }
    } catch {
      continue;
    }
  }
  return {
    url: null,
    buffer: null
  };
}

// Template HTML Resi Canvas Card
function generateResiCanvasHtml({ resi, courier, status, service, receiver, history = [] }) {
  const isDelivered = /delivered|terkirim|selesai|sampai/i.test(status);
  const statusColor = isDelivered ? "#10b981" : "#3b82f6";

  const timelineHtml = history.slice(0, 7).map((h, i) => {
    const isLatest = i === 0;
    const time = h.datetime || h.waktu || "-";
    const desc = h.description || h.keterangan || "";
    const loc = h.tempat ? ` (${h.tempat})` : "";
    return `
      <div class="timeline-item">
        <div class="timeline-dot ${isLatest ? "latest" : ""}"></div>
        <div class="timeline-content">
          <div class="timeline-time">${time}</div>
          <div class="timeline-desc ${isLatest ? "latest-text" : ""}">${desc}${loc}</div>
        </div>
      </div>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #090a0f;
      font-family: 'Plus Jakarta Sans', sans-serif;
      display: flex;
      justify-content: center;
      padding: 40px;
    }
    .card {
      width: 680px;
      background: linear-gradient(145deg, #13151f, #0c0d14);
      border-radius: 28px;
      padding: 36px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 30px 60px rgba(0,0,0,0.6);
      color: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 24px;
      margin-bottom: 28px;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-title span { color: #f59e0b; }
    .status-badge {
      background: ${statusColor}1a;
      border: 1px solid ${statusColor}4d;
      color: ${statusColor};
      padding: 6px 14px;
      border-radius: 99px;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .grid-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 16px 20px;
      border-radius: 16px;
    }
    .grid-label {
      font-size: 11px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.4);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .grid-value {
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
    }
    .grid-value.mono {
      font-family: 'Space Mono', monospace;
      color: #f59e0b;
      letter-spacing: 0.5px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.5);
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 20px;
    }
    .timeline {
      position: relative;
      padding-left: 20px;
    }
    .timeline::before {
      content: '';
      position: absolute;
      left: 5px;
      top: 6px;
      bottom: 6px;
      width: 2px;
      background: rgba(255, 255, 255, 0.08);
    }
    .timeline-item {
      position: relative;
      margin-bottom: 20px;
    }
    .timeline-item:last-child { margin-bottom: 0; }
    .timeline-dot {
      position: absolute;
      left: -20px;
      top: 4px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #272838;
      border: 2px solid #0c0d14;
    }
    .timeline-dot.latest {
      background: #f59e0b;
      box-shadow: 0 0 12px #f59e0b;
    }
    .timeline-time {
      font-size: 11px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.4);
      margin-bottom: 2px;
    }
    .timeline-desc {
      font-size: 13.5px;
      font-weight: 500;
      line-height: 1.45;
      color: rgba(255, 255, 255, 0.75);
    }
    .timeline-desc.latest-text {
      color: #ffffff;
      font-weight: 600;
    }
    .footer {
      margin-top: 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 20px;
      font-size: 11px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.3);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand-title">📦 Package <span>Tracker</span></div>
      <div class="status-badge">${status || "IN TRANSIT"}</div>
    </div>

    <div class="grid">
      <div class="grid-item">
        <div class="grid-label">Nomor Resi / Waybill</div>
        <div class="grid-value mono">${resi}</div>
      </div>
      <div class="grid-item">
        <div class="grid-label">Ekspedisi / Kurir</div>
        <div class="grid-value">${courier}</div>
      </div>
      <div class="grid-item">
        <div class="grid-label">Layanan / Service</div>
        <div class="grid-value">${service || "Reguler / Standard"}</div>
      </div>
      <div class="grid-item">
        <div class="grid-label">Penerima</div>
        <div class="grid-value">${receiver || "-"}</div>
      </div>
    </div>

    <div class="section-title">Riwayat Pengiriman Terkini</div>
    <div class="timeline">
      ${timelineHtml || '<div style="color:rgba(255,255,255,0.4); font-size:13px;">Tidak ada riwayat rute terlacak.</div>'}
    </div>

    <div class="footer">
      <span>Wudysoft Logistics Engine</span>
      <span>Live Tracking Status</span>
    </div>
  </div>
</body>
</html>`;
}

export default {
  name: "cekresi",
  aliases: ["resi", "track"],
  description: "Cek resi pengiriman otomatis lengkap dengan menu pemilihan kurir via CTA & Canvas Card.",
  category: "Tools",
  limit: true,
  example: "resi 11004324915349 (Pilih kurir via tombol)\nresi anteraja 11004324915349\nresi --list (Daftar ekspedisi)",

  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const targetJid = ctx.chat || ctx.id;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;

    try {
      let rawText = (ctx.query || "").trim();
      const { rest, cleanText } = parseResiFlags(rawText);

      let expedisi = rest.exp || rest.expedisi || rest.courier || "";
      let resi = rest.resi || rest.no || "";

      // Ambil daftar kurir dari server v17 (fallback ke POPULAR_COURIERS)
      let availableCouriers = POPULAR_COURIERS;
      try {
        const v17ListRes = await axios.get(`${V17_URL}?action=list`, { timeout: 8e3 });
        if (Array.isArray(v17ListRes.data?.couriers) && v17ListRes.data.couriers.length > 0) {
          availableCouriers = v17ListRes.data.couriers.map(c => ({
            name: c.name,
            format: c.format,
            desc: `Ekspedisi ${c.name}`
          }));
        }
      } catch {}

      // Jika user hanya mengirim nomor resi (misal: .resi 123456789)
      const parts = cleanText.split(/\s+/).filter(Boolean);
      if (!expedisi && !resi) {
        if (parts.length === 1 && /^[a-zA-Z0-9_-]{5,}$/.test(parts[0])) {
          resi = parts[0];
        } else if (parts.length >= 2) {
          expedisi = parts[0].toLowerCase();
          resi = parts[1];
        }
      } else if (!resi && parts.length >= 1) {
        resi = parts[0];
      }

      // 1. MENU CTA PEMILIHAN KURIR (Jika belum memilih kurir atau mengetik --list / --couriers)
      if (rest.list || rest.couriers || (!expedisi && resi) || !cleanText) {
        const page = Math.max(1, Number(rest.page) || 1);
        const totalPages = Math.ceil(availableCouriers.length / ITEMS_PER_PAGE) || 1;
        const pageItems = availableCouriers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

        const rows = pageItems.map((c, idx) => {
          const globalIdx = (page - 1) * ITEMS_PER_PAGE + idx + 1;
          const cmdAction = resi
            ? `${prefix}resi ${c.format} ${resi}`
            : `${prefix}resi --exp ${c.format}`;

          return {
            title: `${globalIdx}. ${c.name}`.slice(0, 24),
            id: cmdAction,
            description: `${c.desc || c.name} • [${c.format}]`.slice(0, 60)
          };
        });

        const baseCmd = resi ? `${prefix}resi ${resi}` : `${prefix}resi --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH EKSPEDISI (${pageItems.length})`,
            sections: [{
              title: `DAFTAR KURIR LOGISTIK (Hal ${page}/${totalPages})`,
              rows: rows
            }]
          })
        }];

        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${baseCmd} --page ${page - 1}`
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${baseCmd} --page ${page + 1}`
            })
          });
        }

        const bodyText = resi
          ? `– *P I L I H  E K S P E D I S I*\n\n` +
            `┌ ◦ *Nomor Resi* : \`${resi}\`\n` +
            `├ ◦ *Total Kurir* : ${availableCouriers.length} Layanan\n` +
            `└ ◦ *Halaman* : ${page} / ${totalPages}\n\n` +
            `_Silakan pilih kurir ekspedisi dari menu tombol di bawah untuk melacak paket Anda:_`
          : `– *C E K  R E S I  -  K U R I R*\n\n` +
            `┌ ◦ *Format* : \`${prefix}resi <ekspedisi> <no_resi>\`\n` +
            `├ ◦ *Contoh* : \`${prefix}resi jnt 11004324915349\`\n` +
            `└ ◦ *Total Kurir* : ${availableCouriers.length} Ekspedisi\n\n` +
            `_Pilih kurir di bawah ini:_`;

        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `Daftar Kurir Logistik`,
              button_title: `Buka Hal ${page}`
            }
          },
          quoted: quotedMsg
        };

        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, footer, buttons, options);
        } else {
          let fallback = `${bodyText}\n\n` + rows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
          if (totalPages > 1) {
            fallback += `\n\n_Pindah Halaman: Ketik \`${baseCmd} --page ${page < totalPages ? page + 1 : page - 1}\`_`;
          }
          return await ctx.reply(fallback);
        }
      }

      // 2. PROSES CEK RESI
      await ctx.react("⏳");

      let courierFormat = null;
      let useV17 = false;
      let v17Data = null;
      let v18Data = null;

      const matchV17 = availableCouriers.find(c =>
        c.format.toLowerCase() === expedisi.toLowerCase() ||
        c.name.toLowerCase().includes(expedisi.toLowerCase())
      );
      if (matchV17) {
        courierFormat = matchV17.format;
        useV17 = true;
      }

      if (useV17 && courierFormat) {
        try {
          const v17Check = await axios.get(`${V17_URL}?action=check`, {
            params: { expedisi: courierFormat, resi },
            timeout: 3e4
          });
          if (v17Check.data && v17Check.data.success) {
            v17Data = v17Check.data;
          } else {
            useV17 = false;
          }
        } catch {
          useV17 = false;
        }
      }

      if (!useV17) {
        const v18Check = await axios.get(`${V18_URL}?action=check`, {
          params: { expedisi, resi },
          timeout: 3e4
        });
        v18Data = v18Check.data;
        if (!v18Data || !v18Data.success) {
          throw new Error(v18Data?.pesan || "Gagal melacak resi. Pastikan nomor resi dan kurir sudah sesuai.");
        }
      }

      // Normalisasi Data Pelacakan
      let summaryData = {};
      if (useV17 && v17Data) {
        summaryData = {
          resi: v17Data.resi || resi,
          courier: (v17Data.courier || expedisi).toUpperCase(),
          status: v17Data.status || "DALAM PROSES",
          service: "-",
          receiver: "-",
          history: v17Data.history || []
        };
      } else if (v18Data) {
        const details = v18Data.details || {};
        summaryData = {
          resi: v18Data.resi || resi,
          courier: (v18Data.expedisi || expedisi).toUpperCase(),
          status: v18Data.status || "DALAM PENGIRIMAN",
          service: details.service_code || "-",
          receiver: details.receiver_name || "-",
          history: v18Data.history || []
        };
      }

      // Render Visual Canvas Tracking Card
      const html = generateResiCanvasHtml(summaryData);
      const { url: canvasUrl, buffer: canvasBuffer } = await renderHtmlToImage(html);

      // Susun Format Teks WhatsApp
      let historyStr = "";
      if (Array.isArray(summaryData.history) && summaryData.history.length > 0) {
        historyStr = summaryData.history.map(h => {
          const time = h.datetime || h.waktu || "-";
          const desc = h.description || h.keterangan || "";
          const loc = h.tempat ? ` (${h.tempat})` : "";
          return `• [${time}] ${desc}${loc}`;
        }).join("\n");
      }

      const bodyText = `– *C E K  R E S I*\n\n` +
        `┌ ◦ *Waybill* : ${summaryData.resi}\n` +
        `│ ◦ *Courier* : ${summaryData.courier}\n` +
        `│ ◦ *Service* : ${summaryData.service}\n` +
        `│ ◦ *Receiver* : ${summaryData.receiver}\n` +
        `└ ◦ *Status* : ${summaryData.status}\n\n` +
        (historyStr ? `*Riwayat Perjalanan:*\n${historyStr}\n\n` : "") +
        `${footer}`;

      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin No. Resi",
        copy_code: String(summaryData.resi)
      }];

      if (canvasUrl) {
        buttons.push({
          name: "cta_url",
          display_text: "🖼️ Download Tracking Card",
          url: canvasUrl
        });
      }

      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `_Tracking Update_`, buttons, {
          media: canvasUrl || null,
          quoted: quotedMsg
        });
      } else if (canvasBuffer) {
        await sock.sendMessage(targetJid, {
          image: canvasBuffer,
          caption: bodyText
        }, { quoted: quotedMsg });
      } else {
        await sock.sendMessage(targetJid, {
          text: bodyText
        }, { quoted: quotedMsg });
      }

      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.pesan || error.message;
      ctx.reply(`– *E R R O R*\n\n┌ ◦ *Info* : ${errMsg}\n└ ◦ *Command* : ${ctx.command || "resi"}\n\n${footer}`);
    }
  }
};