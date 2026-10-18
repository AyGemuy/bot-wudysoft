import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/random/cerpen/v3`;

function parseFlags(input) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["judul", "name"].includes(key)) key = "title";
    if (["kategori", "cat"].includes(key)) key = "category";
    if (["token_jwt"].includes(key)) key = "token";
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
export default {
  name: "cerpen",
  aliases: ["ceritapendek", "story", "cerpenku"],
  description: "Membaca dan mencari cerita pendek (Cerpen) berbagai genre secara acak atau berdasarkan judul",
  category: "Fun",
  limit: true,
  example: "cerpen atau cerpen PHP atau cerpen --category Drama",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("cerpen") || firstWord.endsWith("ceritapendek") || firstWord.endsWith("story")) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Paimon-bot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (typeof ctx.react === "function") await ctx.react("📖");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const bodyPayload = {
        ...cleanPrompt ? {
          title: cleanPrompt
        } : {},
        ...flags
      };
      const {
        data
      } = await axios.post(API_URL, bodyPayload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const cerpenList = data?.result || [];
      if (!data || data.status !== "success" && data.status !== true || cerpenList.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`–  *C E R P E N*

Cerita pendek tidak ditemukan.

┌  ◦  *Pencarian* : ${cleanPrompt || "Acak"}
└  ◦  *Catatan* : Coba gunakan kata kunci atau judul lainnya.`);
      }
      const cerpen = cerpenList[0];
      const judul = cerpen.judul || "Tanpa Judul";
      const kategori = cerpen.category || "Umum";
      const isiCerita = (cerpen.isi || "").replace(/\r\n/g, "\n").trim();
      const likes = cerpen.likes || "0";
      const returnedToken = data.token || "";
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      const bodyText = `–  *C E R P E N*

┌  ◦  *Judul* : ${judul}
│  ◦  *Kategori* : ${kategori}
└  ◦  *Apresiasi* : ${likes} Likes

${isiCerita}

Gunakan tombol di bawah untuk menyalin teks cerita lengkap atau membaca cerpen lainnya.`;
      const footerText = `${botName} • Cerpen Library`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📖 Salin Cerita Lengkap",
        copy_code: `*${judul}*\nKategori: ${kategori}\n\n${isiCerita}`
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔄 Cerpen Acak Lain",
          id: `${prefix}cerpen`
        })
      }];
      if (returnedToken) {
        buttons.push({
          name: "cta_copy",
          display_text: "🔑 Salin Token Saja",
          copy_code: returnedToken
        });
      }
      buttons.push({
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🏠 Menu Utama",
          id: `${prefix}menu`
        })
      });
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1, 99],
            list_title: `${judul} • ${kategori}`,
            button_title: "Baca Cerita"
          },
          limited_time_offer: {
            text: `✦ ${judul} (${kategori}) ✦`,
            url: `${global.bot?.api?.wudysoft || ""}`,
            copy_code: `*${judul}*\n\n${isiCerita}`,
            expiration_time: Date.now() + 3600 * 1e3
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        await sock.sendMessage(ctx.id, {
          text: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[CERPEN ERROR]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Cerpen Error: ${errMsg}`);
    }
  }
};