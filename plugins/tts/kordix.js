import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v46`,
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  ITEMS_PER_PAGE: 10
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.kordix) global.db.kordix = {};
  if (jid && !global.db.user[jid]) {
    global.db.user[jid] = {
      name: name || "",
      money: 1e4,
      exp: 0
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function parseFlags(rawStr = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g;
  let match;
  while ((match = flagRegex.exec(rawStr)) !== null) {
    const key = match[1].toLowerCase();
    let val = match[2] ? match[2].trim() : true;
    if (typeof val === "string" && (val.startsWith('"') || val.startsWith("'"))) val = val.slice(1, -1);
    flags[key] = val;
  }
  const cleanText = rawStr.replace(/--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g, "").trim();
  return {
    flags: flags,
    cleanText: cleanText
  };
}
export default {
  name: "kordix",
  aliases: ["kordixtts", "kordixvoice", "kordixai", "ksearch"],
  description: "Text-to-Speech AI Kordix v46 dengan Session Voice, CTA Search & PTT Opus (Full DB)",
  category: "AI",
  limit: true,
  example: "kordix --search anime\nkordix halo kawan\nkordix --info\nkordix --reset",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const targetJid = ctx.chat || ctx.id;
    try {
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      initDB(senderId, ctx.pushName);
      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();
      const userSession = global.db.kordix[senderId] || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        if (global.db.kordix[senderId]) {
          delete global.db.kordix[senderId];
          saveDB();
        }
        return ctx.reply(`– *K O R D I X*\n\n` + `┌ ◦ *Status* : Sesi suara berhasil direset\n` + `└ ◦ *Action* : Ketik ${prefix}kordix --search <nama> untuk mencari karakter baru.\n\n` + `${footer}`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        if (!userSession) {
          return ctx.reply(`– *S T A T U S*\n\n` + `┌ ◦ *Status* : Belum ada karakter suara aktif\n` + `└ ◦ *Action* : Cari suara dengan ${prefix}kordix --search <nama>\n\n` + `${footer}`);
        }
        return ctx.reply(`– *S T A T U S*\n\n` + `┌ ◦ *User* : @${senderId.split("@")[0]}\n` + `│ ◦ *Character* : ${userSession.name}\n` + `│ ◦ *ID* : ${userSession.id}\n` + `└ ◦ *Language* : ${userSession.language || "-"}\n\n` + `_Ketik ${prefix}kordix <teks> untuk berbicara._\n\n` + `${footer}`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const voiceName = String(flags.setvoice);
        const voiceId = flags.id ? String(flags.id) : voiceName;
        const newSession = {
          id: voiceId,
          name: voiceName,
          language: flags.lang || "en",
          gender: flags.gender || "AI",
          updatedAt: Date.now()
        };
        global.db.kordix[senderId] = newSession;
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *K O R D I X*\n\n` + `┌ ◦ *Character* : ${newSession.name}\n` + `│ ◦ *ID* : ${newSession.id}\n` + `└ ◦ *Status* : Tersimpan ke sesi pengguna\n\n` + `_Ketik ${prefix}kordix <teks> untuk mulai menghasilkan suara._\n\n` + `${footer}`);
      }
      if (flags.search || flags.query || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        const searchQuery = flags.search || flags.query || !flags.page && cleanText;
        if (!searchQuery || searchQuery === true) {
          return ctx.reply(`– *K O R D I X*\n\n` + `┌ ◦ *Usage* : ${prefix}kordix --search <nama>\n` + `└ ◦ *Example* : ${prefix}kordix --search anime\n\n` + `${footer}`);
        }
        await ctx.react("⏳");
        const {
          data
        } = await axios.post(CONFIG.API_URL, {
          action: "search",
          query: String(searchQuery)
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        const voiceItems = data?.result?.items || [];
        if (!voiceItems.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Karakter tidak ditemukan\n` + `└ ◦ *Query* : "${searchQuery}"\n\n` + `${footer}`);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(voiceItems.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = voiceItems.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        if (!pageItems.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Halaman kosong\n` + `└ ◦ *Info* : Halaman ${page} tidak memiliki data suara.\n\n` + `${footer}`);
        }
        const topVoice = pageItems[0];
        const previewThumb = topVoice.image || "https://public-platform.r2.fish.audio/cdn-cgi/image/width=256,format=webp/coverimage/a4af569aa1c84e18a28a19cbbaca7be7";
        const voiceRows = pageItems.map((v, i) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + i + 1;
          return {
            title: `${globalIdx}. ${v.name}`.slice(0, 24),
            id: `${prefix}kordix --setvoice "${v.name}" --id "${v.id}" --lang "${v.language || "en"}" --gender "${v.gender || "AI"}"`,
            description: `Bahasa: ${v.language || "-"} | Gender: ${v.gender || "-"}`.slice(0, 60)
          };
        });
        const baseCmd = `${prefix}kordix --search "${searchQuery}"`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH MODEL SUARA (${pageItems.length})`,
            sections: [{
              title: `HASIL PENCARIAN (Hal ${page}/${totalPages})`,
              rows: voiceRows
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
        const bodyText = `– *K O R D I X  -  S E A R C H*\n\n` + `┌ ◦ *Query* : "${searchQuery}"\n` + `│ ◦ *Total* : ${voiceItems.length} Karakter\n` + `│ ◦ *Page* : ${page} / ${totalPages}\n` + `│ ◦ *Top Voice* : ${topVoice.name} (${topVoice.language || "-"})\n` + `└ ◦ *Engine* : Kordix AI TTS\n\n` + `_Pilih karakter suara dari menu di bawah atau gunakan navigasi halaman:_`;
        const options = {
          media: previewThumb,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Voice Explorer`,
              button_title: `Buka Hal ${page}`
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footer, buttons, options);
        } else {
          let fallback = `${bodyText}\n\n`;
          fallback += voiceRows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
          if (totalPages > 1) {
            fallback += `\n\n_Pindah Halaman: Ketik \`${baseCmd} --page ${page < totalPages ? page + 1 : page - 1}\`_`;
          }
          await ctx.reply(fallback);
        }
        await ctx.react("✅");
        return;
      }
      const selectedVoice = flags.voice || flags.name || (userSession ? userSession.name : null);
      if (!selectedVoice) {
        return ctx.reply(`– *K O R D I X*\n\n` + `┌ ◦ *Status* : Belum memilih karakter suara\n` + `│ ◦ *Usage* : ${prefix}kordix --search <nama>\n` + `└ ◦ *Example* : ${prefix}kordix --search anime\n\n` + `${footer}`);
      }
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        return ctx.reply(`– *K O R D I X*\n\n` + `┌ ◦ *Active* : ${selectedVoice}\n` + `│ ◦ *Usage* : ${prefix}kordix <teks>\n` + `└ ◦ *Example* : ${prefix}kordix Halo apa kabar?\n\n` + `${footer}`);
      }
      await ctx.react("⏳");
      await ctx.reply(`– *P R O C E S S*\n\n` + `┌ ◦ *Character* : ${selectedVoice}\n` + `│ ◦ *Text* : "${textToSpeak}"\n` + `└ ◦ *Status* : Memproses audio Kordix...\n\n` + `${footer}`);
      const payload = {
        action: "generate",
        text: String(textToSpeak),
        name: String(selectedVoice),
        ...flags
      };
      delete payload.voice;
      delete payload.search;
      delete payload.query;
      delete payload.list;
      delete payload.setvoice;
      const {
        data
      } = await axios.post(CONFIG.API_URL, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const audioUrl = data?.result?.audio_url || data?.result?.audioUrl;
      if (!audioUrl || !audioUrl.startsWith("http")) {
        throw new Error(data?.message || data?.result || "Gagal membuat audio Kordix.");
      }
      await sendPTT(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[Kordix Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "kordix"}\n\n` + `${footer}`);
    }
  }
};