import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function getAccuWeatherIconUrl(iconNum) {
  if (!iconNum) return "https://developer.accuweather.com/sites/default/files/01-s.png";
  return `https://developer.accuweather.com/sites/default/files/${String(iconNum).padStart(2, "0")}-s.png`;
}
async function renderHtmlToImage(htmlContent) {
  const rawApi = global.bot?.api?.wudysoft || "";
  const cleanApi = rawApi.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const baseUrl = `https://${cleanApi}/api/tools/html2img/`;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
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
        headers: headers,
        timeout: 16e3
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
          buffer: buffer
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
async function sendCTA(sock, ctx, targetId, {
  text,
  footer,
  buttons = [],
  image = null,
  quoted = null,
  mentions = []
}) {
  const botName = global.bot?.name || "WudysoftBot";
  const finalFooter = footer || `${botName} • AccuWeather Report`;
  const formattedButtons = buttons.map(b => {
    if (b.buttonParamsJson) return b;
    if (b.name === "cta_url" || b.url) {
      return {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: b.display_text || b.text || "Buka Tautan",
          url: b.url || ""
        })
      };
    }
    if (b.type === "list" || b.name === "single_select" || b.sections) {
      return {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: b.title || "PILIHAN PRAKIRAAN",
          sections: b.sections || []
        })
      };
    }
    return {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: b.display_text || b.text || "Pilih",
        id: b.id || b.command || ""
      })
    };
  });
  const destJid = targetId || ctx?.id;
  const options = {
    jid: destJid,
    to: destJid,
    image: image || undefined,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • AccuWeather`,
        button_title: "Menu Cuaca"
      }
    },
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      mentionedJid: mentions || []
    },
    quoted: quoted || undefined
  };
  return await ctx.sendCta(text, finalFooter, formattedButtons, options);
}

function generateWeatherHTML(viewMode, data) {
  const loc = data.location;
  const curr = data.current?.[0] || {};
  const cityName = `${loc.localized_name}, ${loc.administrative_area?.localized_name || loc.country?.localized_name || ""}`;
  const iconUrl = getAccuWeatherIconUrl(curr.weather_icon || 1);
  const baseHead = `
    <style>
      :root {
        --bg-dark: #07090e;
        --glass-surface: rgba(255, 255, 255, 0.035);
        --glass-border: rgba(255, 255, 255, 0.12);
        --glass-specular: inset 0 1px 1px rgba(255, 255, 255, 0.4), inset 0 -1px 2px rgba(0, 0, 0, 0.5);
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body {
        width: 900px;
        height: auto;
        background-color: var(--bg-dark);
        font-family: 'Segoe UI', Roboto, sans-serif;
        color: #fff;
        display: flex;
        justify-content: center;
        align-items: flex-start;
      }
      .canvas-wrapper {
        width: 900px;
        min-height: 520px;
        padding: 24px 24px 34px 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
        background: radial-gradient(circle at 50% 20%, #101a2d 0%, #07090e 100%);
        overflow: hidden;
      }
      .ambient-blob {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.35;
        pointer-events: none;
        z-index: 1;
      }
      .blob-1 { width: 340px; height: 340px; background: radial-gradient(circle, #0070f3, #00dfd8); top: 10px; left: 10px; }
      .blob-2 { width: 380px; height: 380px; background: radial-gradient(circle, #7928ca, #ff0080); bottom: 10px; right: 10px; }
      
      .header-capsule {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        background: var(--glass-surface);
        border: 1px solid var(--glass-border);
        border-radius: 18px;
        backdrop-filter: blur(15px);
        box-shadow: 0 8px 20px rgba(0,0,0,0.5), var(--glass-specular);
        margin-bottom: 20px;
        z-index: 10;
      }
      .city-title {
        font-size: 18px;
        font-weight: 800;
        color: #f1f5f9;
        letter-spacing: 1px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .badge-mode {
        font-size: 11px;
        font-weight: 900;
        background: linear-gradient(135deg, #00f2fe, #4facfe);
        color: #07090e;
        padding: 4px 12px;
        border-radius: 9999px;
        letter-spacing: 0.8px;
      }
    </style>
  `;
  if (viewMode === "hourly") {
    let hourlyRows = "";
    (data.hourly || []).slice(0, 7).forEach(h => {
      const timeStr = h.date_time?.slice(11, 16) || "--:--";
      const icon = getAccuWeatherIconUrl(h.weather_icon || 1);
      hourlyRows += `
        <div class="hourly-pod">
          <span class="h-time">${timeStr}</span>
          <img src="${icon}" class="h-icon" alt="" />
          <span class="h-temp">${h.temperature?.value}°C</span>
          <span class="h-phrase">${h.icon_phrase || "-"}</span>
          <span class="h-rain">🌧️ ${h.precipitation_probability}%</span>
        </div>
      `;
    });
    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  ${baseHead}
  <style>
    .hourly-track {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 10px;
      z-index: 10;
    }
    .hourly-pod {
      background: var(--glass-surface);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      backdrop-filter: blur(15px);
      padding: 14px 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5), var(--glass-specular);
    }
    .h-time { font-size: 12px; font-weight: 800; color: #94a3b8; }
    .h-icon { width: 44px; height: 30px; object-fit: contain; }
    .h-temp { font-size: 18px; font-weight: 900; color: #00dfd8; }
    .h-phrase { font-size: 9px; font-weight: 700; color: #cbd5e1; text-align: center; height: 22px; display: flex; align-items: center; }
    .h-rain { font-size: 10px; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.15); padding: 2px 6px; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="canvas-wrapper">
    <div class="ambient-blob blob-1"></div>
    <div class="ambient-blob blob-2"></div>
    <div class="header-capsule">
      <div class="city-title">📍 ${cityName.toUpperCase()}</div>
      <div class="badge-mode">PRAKIRAAN TIAP JAM</div>
    </div>
    <div class="hourly-track">
      ${hourlyRows}
    </div>
  </div>
</body>
</html>`;
  }
  if (viewMode === "daily") {
    let dailyRows = "";
    (data.daily?.daily_forecasts || []).slice(0, 5).forEach(d => {
      const dateStr = d.date?.slice(0, 10) || "Tanggal";
      const icon = getAccuWeatherIconUrl(d.day?.icon || 1);
      dailyRows += `
        <div class="daily-item">
          <div class="daily-date">📅 <b>${dateStr}</b></div>
          <div class="daily-condition">
            <img src="${icon}" class="d-icon" alt="" />
            <span>${d.day?.short_phrase || "-"}</span>
          </div>
          <div class="daily-temp">
            <span class="temp-min">🔻 ${d.temperature?.minimum?.value}°C</span>
            <span class="temp-sep">~</span>
            <span class="temp-max">🔺 ${d.temperature?.maximum?.value}°C</span>
          </div>
        </div>
      `;
    });
    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  ${baseHead}
  <style>
    .daily-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 10;
    }
    .daily-item {
      background: var(--glass-surface);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      backdrop-filter: blur(15px);
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 6px 15px rgba(0,0,0,0.4), var(--glass-specular);
    }
    .daily-date { font-size: 13px; color: #cbd5e1; min-width: 130px; }
    .daily-condition { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #f8fafc; flex: 1; }
    .d-icon { width: 38px; height: 26px; object-fit: contain; }
    .daily-temp { display: flex; gap: 8px; font-size: 13px; font-weight: 800; }
    .temp-min { color: #38bdf8; }
    .temp-max { color: #f43f5e; }
    .temp-sep { color: #64748b; }
  </style>
</head>
<body>
  <div class="canvas-wrapper">
    <div class="ambient-blob blob-1"></div>
    <div class="ambient-blob blob-2"></div>
    <div class="header-capsule">
      <div class="city-title">📍 ${cityName.toUpperCase()}</div>
      <div class="badge-mode">PRAKIRAAN 5 HARI</div>
    </div>
    <div class="daily-container">
      ${dailyRows}
    </div>
  </div>
</body>
</html>`;
  }
  if (viewMode === "index") {
    let indexCards = "";
    (data.indices || []).slice(0, 8).forEach(idx => {
      indexCards += `
        <div class="idx-card">
          <div class="idx-name">${idx.name}</div>
          <div class="idx-cat">${idx.category}</div>
          <div class="idx-desc">${idx.text || "-"}</div>
        </div>
      `;
    });
    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  ${baseHead}
  <style>
    .indices-grid {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      z-index: 10;
    }
    .idx-card {
      background: var(--glass-surface);
      border: 1px solid var(--glass-border);
      border-radius: 18px;
      backdrop-filter: blur(15px);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: 0 8px 18px rgba(0,0,0,0.4), var(--glass-specular);
    }
    .idx-name { font-size: 12px; font-weight: 800; color: #f1c40f; }
    .idx-cat { font-size: 14px; font-weight: 900; color: #00dfd8; }
    .idx-desc { font-size: 11px; font-weight: 600; color: #94a3b8; line-height: 1.3; }
  </style>
</head>
<body>
  <div class="canvas-wrapper">
    <div class="ambient-blob blob-1"></div>
    <div class="ambient-blob blob-2"></div>
    <div class="header-capsule">
      <div class="city-title">📍 ${cityName.toUpperCase()}</div>
      <div class="badge-mode">INDEKS AKTIVITAS & KESEHATAN</div>
    </div>
    <div class="indices-grid">
      ${indexCards}
    </div>
  </div>
</body>
</html>`;
  }
  const tempVal = curr.temperature?.metric?.value ?? "--";
  const realFeel = curr.real_feel_temperature?.metric?.value ?? tempVal;
  const humidity = curr.relative_humidity ?? "--";
  const windSpeed = curr.wind?.speed?.metric?.value ?? "--";
  const uvIdx = `${curr.u_v_index || 0} (${curr.u_v_index_text || "Aman"})`;
  const minuteCast = data.minute_cast?.summary?.phrase || "Kondisi presipitasi stabil saat ini.";
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  ${baseHead}
  <style>
    .hero-weather {
      width: 100%;
      background: var(--glass-surface);
      border: 1px solid var(--glass-border);
      border-radius: 28px;
      backdrop-filter: blur(20px);
      padding: 22px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 20px 45px rgba(0,0,0,0.6), var(--glass-specular);
      margin-bottom: 16px;
      z-index: 10;
    }
    .hero-left { display: flex; flex-direction: column; }
    .temp-row { display: flex; align-items: baseline; gap: 8px; }
    .temp-value {
      font-size: 64px;
      font-weight: 900;
      letter-spacing: -2px;
      background: linear-gradient(135deg, #ffffff 0%, #00f2fe 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .temp-feel {
      font-size: 13px;
      font-weight: 700;
      color: #94a3b8;
    }
    .condition-badge {
      font-size: 16px;
      font-weight: 800;
      color: #f8fafc;
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .hero-right {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .big-icon {
      width: 90px;
      height: 60px;
      object-fit: contain;
      filter: drop-shadow(0 8px 12px rgba(0,0,0,0.6));
    }

    /* Grid Metrik 4 Kolom */
    .metrics-grid {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;
      z-index: 10;
    }
    .metric-card {
      background: var(--glass-surface);
      border: 1px solid var(--glass-border);
      border-radius: 18px;
      backdrop-filter: blur(15px);
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.4), var(--glass-specular);
    }
    .metric-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
    .metric-value { font-size: 16px; font-weight: 900; color: #00dfd8; }

    /* MinuteCast Strip */
    .minutecast-box {
      width: 100%;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid var(--glass-border);
      border-radius: 14px;
      padding: 10px 18px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      font-weight: 700;
      color: #cbd5e1;
      backdrop-filter: blur(10px);
      box-shadow: var(--glass-specular);
      z-index: 10;
    }
  </style>
</head>
<body>
  <div class="canvas-wrapper">
    <div class="ambient-blob blob-1"></div>
    <div class="ambient-blob blob-2"></div>

    <div class="header-capsule">
      <div class="city-title">📍 ${cityName.toUpperCase()}</div>
      <div class="badge-mode">ACCUWEATHER REALTIME</div>
    </div>

    <div class="hero-weather">
      <div class="hero-left">
        <div class="temp-row">
          <div class="temp-value">${tempVal}°C</div>
          <div class="temp-feel">Terasa ${realFeel}°C</div>
        </div>
        <div class="condition-badge">${curr.weather_text || "Cerah Berawan"}</div>
      </div>
      <div class="hero-right">
        <img src="${iconUrl}" class="big-icon" alt="" />
      </div>
    </div>

    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">💧 Kelembapan</span>
        <span class="metric-value">${humidity}%</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">💨 Kecepatan Angin</span>
        <span class="metric-value">${windSpeed} km/j</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">☀️ Indeks UV</span>
        <span class="metric-value">${uvIdx}</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">📊 Status Udara</span>
        <span class="metric-value">Normal</span>
      </div>
    </div>

    <div class="minutecast-box">
      <span>⏱️ <b>MinuteCast:</b> ${minuteCast}</span>
    </div>
  </div>
</body>
</html>`;
}
export default {
  name: "cuaca",
  aliases: ["weather", "accuweather", "infocuaca"],
  description: "Informasi cuaca realtime, hourly, daily, & indeks dengan grafis Liquid Glass Dark",
  category: "Info",
  execute: async (sock, ctx, msg) => {
    const rawText = (ctx.args || []).join(" ").trim();
    const prefix = ctx.prefix || ".";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const isHourly = /--hourly|--jam/i.test(rawText);
    const isDaily = /--daily|--harian|--forecast/i.test(rawText);
    const isIndex = /--index|--aktivitas|--kesehatan/i.test(rawText);
    const cityQuery = rawText.replace(/--(hourly|jam|daily|harian|forecast|index|aktivitas|kesehatan)/gi, "").trim();
    if (!cityQuery) {
      return ctx.reply(`🌤️ Masukkan nama kota!\nContoh: \`${prefix}cuaca Bandung\` atau \`${prefix}cuaca Jakarta --hourly\``);
    }
    try {
      await ctx.react("⏳");
      const res = await axios.post(`${global.bot?.api?.wudysoft}/api/info/cuaca/accuweather`, {
        query: cityQuery
      });
      const data = res.data;
      if (!data?.location || !data.current?.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Informasi cuaca untuk kota *${cityQuery}* tidak ditemukan.`);
      }
      const loc = data.location;
      const curr = data.current[0];
      const cityName = `${loc.localized_name}, ${loc.administrative_area?.localized_name || ""}`;
      let viewMode = "current";
      let captionTitle = "CUACA REALTIME";
      if (isHourly) {
        viewMode = "hourly";
        captionTitle = "PRAKIRAAN TIAP JAM";
      } else if (isDaily) {
        viewMode = "daily";
        captionTitle = "PRAKIRAAN 5 HARI";
      } else if (isIndex) {
        viewMode = "index";
        captionTitle = "INDEKS KESEHATAN & AKTIVITAS";
      }
      const htmlContent = generateWeatherHTML(viewMode, data);
      const {
        buffer: imgBuffer
      } = await renderHtmlToImage(htmlContent);
      const bodyText = `🌤️ *ACCUWEATHER REPORT: ${cityName.toUpperCase()}*\n\n` + `• 📊 *Tampilan:* ${captionTitle}\n` + `• 🌡️ *Suhu Saat Ini:* ${curr.temperature?.metric?.value || "-"}°C (Terasa: ${curr.real_feel_temperature?.metric?.value || "-"}°C)\n` + `• 🌤️ *Kondisi:* ${curr.weather_text || "-"}\n\n` + `_Pilih detail prakiraan lainnya melalui tombol menu di bawah:_`;
      const actionRows = [{
        title: "🌤️ Cuaca Realtime",
        id: `${prefix}cuaca ${cityQuery}`,
        description: "Lihat kondisi cuaca saat ini"
      }, {
        title: "⏱️ Prakiraan Tiap Jam",
        id: `${prefix}cuaca ${cityQuery} --hourly`,
        description: "Prakiraan 7 jam ke depan"
      }, {
        title: "📅 Prakiraan 5 Hari",
        id: `${prefix}cuaca ${cityQuery} --daily`,
        description: "Prakiraan suhu & cuaca 5 hari"
      }, {
        title: "🏃 Indeks Aktivitas",
        id: `${prefix}cuaca ${cityQuery} --index`,
        description: "Indeks kesehatan, UV & olahraga"
      }];
      const buttons = [{
        title: "📊 PILIH DETAIL PRAKIRAAN",
        sections: [{
          title: `Menu Cuaca (${loc.localized_name})`,
          rows: actionRows
        }]
      }];
      if (curr.link) {
        buttons.push({
          text: "🌐 Buka di AccuWeather",
          url: curr.link
        });
      }
      await sendCTA(sock, ctx, ctx.id, {
        text: bodyText,
        buttons: buttons,
        image: imgBuffer,
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (e) {
      await ctx.react("❌");
      ctx.reply(`❌ Gagal memuat data cuaca: ${e.message}`);
    }
  }
};