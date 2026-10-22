import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/search/kbbi/v4`;
const ITEMS_PER_PAGE = 6;
const CONFIG = {
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["q", "kata", "word"].includes(key)) key = "query";
    if (["vn", "audio", "suara"].includes(key)) key = "is_audio";
    if (["card", "img", "image"].includes(key)) key = "is_canvas";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
      else val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
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
        headers: headers,
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

function generateKbbiCanvasHtml(item) {
  const word = (item.kata_asli || "Kata").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const kelas = (Array.isArray(item.kelas_kata) && item.kelas_kata.length > 0 ? item.kelas_kata.join(", ") : "Peribahasa/Leksikon").toUpperCase();
  const def = (item.teks_definisi || "-").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const contohHtml = (item.contoh_penggunaan || []).slice(0, 3).map(c => {
    return `<div class="contoh-item">• "${c.replace(/</g, "&lt;").replace(/>/g, "&gt;")}"</div>`;
  }).join("");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Lora:ital,wght@0,500;0,700;1,400&display=swap" rel="stylesheet">
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
      width: 700px;
      background: linear-gradient(145deg, #13151f, #0c0d14);
      border-radius: 28px;
      padding: 38px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 30px 60px rgba(0,0,0,0.6);
      color: #ffffff;
    }
    .top-badge {
      font-size: 11px;
      font-weight: 700;
      color: #f59e0b;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .word-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 22px;
      margin-bottom: 26px;
    }
    .word {
      font-size: 32px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.2;
    }
    .class-tag {
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #f59e0b;
      padding: 6px 14px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .definition-box {
      font-family: 'Lora', serif;
      font-size: 18px;
      line-height: 1.65;
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.02);
      border-left: 4px solid #f59e0b;
      padding: 20px 24px;
      border-radius: 0 16px 16px 0;
      margin-bottom: 26px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.45);
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 12px;
    }
    .contoh-item {
      font-size: 14px;
      line-height: 1.55;
      color: rgba(255, 255, 255, 0.65);
      font-style: italic;
      margin-bottom: 6px;
    }
    .footer {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 18px;
      font-size: 11px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.3);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="top-badge">Kamus Besar Bahasa Indonesia</div>
    <div class="word-header">
      <div class="word">${word}</div>
      <div class="class-tag">${kelas}</div>
    </div>

    <div class="definition-box">${def}</div>

    ${contohHtml ? `
      <div class="section-title">Contoh Penggunaan</div>
      ${contohHtml}
    ` : ""}

    <div class="footer">
      <span>Wudysoft KBBI Canvas Engine</span>
      <span>Leksikografi Resmi Indonesia</span>
    </div>
  </div>
</body>
</html>`;
}
export default {
  name: "kbbi",
  aliases: ["kamus", "artikata", "makna"],
  description: "Pencarian definisi resmi leksikon & peribahasa KBBI lengkap dengan Canvas Card & Voice Note.",
  category: "Information",
  limit: true,
  example: "kbbi ubi\nkbbi merdeka --audio\nkbbi ada ubi ada talas --card",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const targetJid = ctx.chat || ctx.id;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["kbbi", "kamus", "artikata", "makna"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const query = flags.query || cleanPrompt;
      if (!query) {
        const guideText = `–  *K B B I  E D I T I O N*

Cari arti kata resmi, peribahasa, kelas kata, hingga audio pelafalan lisan.

┌  ◦  *Cari Definisi* : \`${prefix}kbbi ubi\`
│  ◦  *Dengan Audio Pelafalan* : \`${prefix}kbbi cendekiawan --audio\`
└  ◦  *Dengan Visual Canvas* : \`${prefix}kbbi ada ubi ada talas --card\`

${footer}`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("📖");
      const {
        data
      } = await axios.get(API_URL, {
        params: {
          query: query
        },
        headers: {
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: 35e3
      });
      const results = Array.isArray(data?.results) ? data.results : [];
      if (!data?.status || results.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`–  *K B B I  N O T  F O U N D*\n\n` + `┌  ◦  *Kata* : "${query}"\n` + `└  ◦  *Status* : Leksikon tidak ditemukan di KBBI.\n\n` + `${footer}`, {
          quoted: quotedMsg
        });
      }
      const selectedIndex = flags.index !== undefined ? Number(flags.index) - 1 : 0;
      const targetItem = results[selectedIndex] || results[0];
      const kata = targetItem.kata_asli || query;
      const kelasKata = Array.isArray(targetItem.kelas_kata) && targetItem.kelas_kata.length > 0 ? targetItem.kelas_kata.join(", ").toUpperCase() : "Peribahasa/Ungkapan";
      const definisi = targetItem.teks_definisi || "-";
      let output = `–  *K A M U S  B E S A R  B A H A S A  I N D O N E S I A*\n\n` + `┌  ◦  *Entri* : ${kata.toUpperCase()}\n` + `├  ◦  *Kelas Kata* : ${kelasKata}\n` + `└  ◦  *Ditemukan* : ${results.length} Makna\n\n` + `┌  ◦  *D E F I N I S I* :\n` + definisi.split("\n").map(l => l ? `│  ${l}` : "│").join("\n") + "\n" + `└  ◦\n\n`;
      if (Array.isArray(targetItem.contoh_penggunaan) && targetItem.contoh_penggunaan.length > 0) {
        output += `┌  ◦  *C O N T O H  P E N G G U N A A N* :\n` + targetItem.contoh_penggunaan.slice(0, 4).map(c => `│  • "${c}"`).join("\n") + "\n" + `└  ◦\n\n`;
      }
      output += `${footer}`;
      const html = generateKbbiCanvasHtml(targetItem);
      const {
        url: canvasUrl,
        buffer: canvasBuffer
      } = await renderHtmlToImage(html);
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Definisi",
        copy_code: definisi
      }];
      if (canvasUrl) {
        buttons.push({
          name: "cta_url",
          display_text: "🖼️ Download Canvas Card",
          url: canvasUrl
        });
      }
      if (results.length > 1) {
        const rows = results.slice(0, ITEMS_PER_PAGE).map((item, idx) => ({
          title: `${idx + 1}. ${item.kata_asli}`.slice(0, 24),
          id: `${prefix}kbbi ${query} --index ${idx + 1}`,
          description: (item.teks_definisi || "").slice(0, 55)
        }));
        buttons.push({
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `LIHAT MAKNA LAIN (${results.length})`,
            sections: [{
              title: `VARIASI ARTI: "${query.toUpperCase()}"`,
              rows: rows
            }]
          })
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(output, "", buttons, {
          media: canvasUrl || null,
          quoted: quotedMsg
        });
      } else if (canvasBuffer) {
        await sock.sendMessage(targetJid, {
          image: canvasBuffer,
          caption: output
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(targetJid, {
          text: output
        }, {
          quoted: quotedMsg
        });
      }
      const audioUrl = targetItem.audio?.url_alternatif_tts;
      if ((flags.is_audio || flags.vn) && audioUrl) {
        try {
          await sendPTT(sock, targetJid, audioUrl, quotedMsg);
        } catch (audioErr) {
          console.error("[KBBI Audio Error]:", audioErr.message);
        }
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[KBBI Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.message || "Gagal memproses pencarian KBBI.";
      ctx.reply(`–  *E R R O R*\n\n┌  ◦  *Info* : ${errMsg}\n└  ◦  *Command* : ${ctx.command || "kbbi"}\n\n${footer}`);
    }
  }
};