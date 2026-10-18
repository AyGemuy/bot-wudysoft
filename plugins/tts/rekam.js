import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v49`,
  DEFAULT_VOICE: "af_heart",
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 10
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.rekam) global.db.rekam = {};
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
    if (typeof val === "string" && (val.startsWith('"') || val.startsWith("'"))) {
      val = val.slice(1, -1);
    }
    flags[key] = val;
  }
  const cleanText = rawStr.replace(/--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g, "").trim();
  return {
    flags: flags,
    cleanText: cleanText
  };
}
export default {
  name: "rekam",
  aliases: ["rekamtts", "kokoro", "kokorotts", "ttsv49", "rekamai"],
  description: "Text-to-Speech Kokoro AI (Rekam AI v49) dengan Session Voice, Speed Control & CTA Search (Full DB).",
  category: "AI",
  limit: true,
  example: "rekam Halo selamat pagi\nrekam --search female\nrekam I love you --voice af_heart --speed 1.2\nrekam --info\nrekam --reset",
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
      const userSession = global.db.rekam[senderId] || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        if (global.db.rekam[senderId]) {
          delete global.db.rekam[senderId];
          saveDB();
        }
        return ctx.reply(`– *R E K A M  A I*\n\n` + `┌ ◦ *Status* : Sesi suara berhasil direset\n` + `│ ◦ *Default Voice* : ${CONFIG.DEFAULT_VOICE}\n` + `└ ◦ *Action* : Ketik ${prefix}rekam --search <query> untuk mencari suara lain.\n\n` + `${footer}`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        const currentVoice = userSession?.voice || CONFIG.DEFAULT_VOICE;
        const currentSpeed = userSession?.speed || 1;
        return ctx.reply(`– *S T A T U S*\n\n` + `┌ ◦ *User* : @${senderId.split("@")[0]}\n` + `│ ◦ *Voice Model* : ${currentVoice}\n` + `└ ◦ *Speed* : ${currentSpeed}x\n\n` + `_Ketik ${prefix}rekam <teks> untuk berbicara._\n\n` + `${footer}`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const voiceId = String(flags.setvoice);
        const speed = flags.speed ? parseFloat(flags.speed) : userSession?.speed || 1;
        const newSession = {
          voice: voiceId,
          speed: isNaN(speed) ? 1 : speed,
          updatedAt: Date.now()
        };
        global.db.rekam[senderId] = newSession;
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *R E K A M  A I*\n\n` + `┌ ◦ *Voice Model* : ${newSession.voice}\n` + `│ ◦ *Speed* : ${newSession.speed}x\n` + `└ ◦ *Status* : Tersimpan ke sesi pengguna\n\n` + `_Ketik ${prefix}rekam <teks> untuk mulai berbicara._\n\n` + `${footer}`);
      }
      if (flags.search || flags.query || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        const searchQuery = flags.search || flags.query || !flags.page && cleanText || "female";
        await ctx.react("⏳");
        const {
          data
        } = await axios.post(CONFIG.API_URL, {
          action: "voice_list"
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        const voicesObj = data?.voices || {};
        const voiceKeys = Object.keys(voicesObj);
        if (!voiceKeys.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memuat daftar suara\n` + `└ ◦ *Info* : Server Rekam AI tidak merespons.\n\n` + `${footer}`);
        }
        const filterKeyword = String(searchQuery).toLowerCase();
        const matchedKeys = voiceKeys.filter(id => {
          const v = voicesObj[id];
          const name = v?.name?.toLowerCase() || "";
          const gender = v?.gender?.toLowerCase() || "";
          const lang = v?.language?.toLowerCase() || "";
          return id.toLowerCase().includes(filterKeyword) || name.includes(filterKeyword) || gender.includes(filterKeyword) || lang.includes(filterKeyword);
        });
        if (!matchedKeys.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Model suara tidak ditemukan\n` + `└ ◦ *Query* : "${searchQuery}"\n\n` + `${footer}`);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matchedKeys.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = matchedKeys.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        if (!pageItems.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Halaman kosong\n` + `└ ◦ *Info* : Halaman ${page} tidak memiliki data suara.\n\n` + `${footer}`);
        }
        const voiceRows = pageItems.map((id, i) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + i + 1;
          const v = voicesObj[id];
          const name = v?.name || id;
          const gender = v?.gender || "AI";
          const lang = v?.language || "en-us";
          const traits = v?.traits || "";
          return {
            title: `${globalIdx}. ${name} ${traits}`.trim().slice(0, 24),
            id: `${prefix}rekam --setvoice "${id}"`,
            description: `ID: ${id} | Gender: ${gender} | Lang: ${lang}`.slice(0, 60)
          };
        });
        const baseCmd = `${prefix}rekam --search "${searchQuery}"`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH MODEL SUARA (${pageItems.length})`,
            sections: [{
              title: `HASIL: ${searchQuery.toUpperCase()} (Hal ${page}/${totalPages})`,
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
        const bodyText = `– *R E K A M  A I  -  S E A R C H*\n\n` + `┌ ◦ *Query* : "${searchQuery}"\n` + `│ ◦ *Total* : ${matchedKeys.length} Karakter\n` + `│ ◦ *Page* : ${page} / ${totalPages}\n` + `└ ◦ *Engine* : Kokoro AI TTS (v49)\n\n` + `_Pilih model suara dari menu di bawah atau gunakan tombol navigasi halaman:_`;
        const options = {
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
      const selectedVoice = flags.voice || flags.name || userSession?.voice || CONFIG.DEFAULT_VOICE;
      const speed = flags.speed ? parseFloat(flags.speed) : userSession?.speed || 1;
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        const helpText = `– *R E K A M  A I*\n\n` + `┌ ◦ *Active Voice* : ${selectedVoice}\n` + `│ ◦ *Active Speed* : ${speed}x\n` + `└ ◦ *Engine* : Kokoro AI (Rekam AI v49)\n\n` + `– *U S A G E*\n\n` + `┌ ◦ *Speak* : ${prefix}rekam <teks>\n` + `│ ◦ *Search* : ${prefix}rekam --search <query>\n` + `└ ◦ *Custom* : ${prefix}rekam <teks> --voice <id> --speed 1.2\n\n` + `– *E X A M P L E*\n\n` + `└ ◦ ${prefix}rekam Hello world, Kokoro AI is speaking!\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const payload = {
        action: "create",
        text: String(textToSpeak),
        voice: String(selectedVoice),
        speed: isNaN(speed) ? 1 : speed
      };
      const {
        data
      } = await axios.post(CONFIG.API_URL, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!data?.status || !data?.result?.audio_url) {
        throw new Error(data?.result || data?.message || "Gagal mengenerate suara Rekam AI.");
      }
      global.db.rekam[senderId] = {
        voice: selectedVoice,
        speed: payload.speed,
        updatedAt: Date.now()
      };
      saveDB();
      const audioUrl = data.result.audio_url;
      await sendPTT(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[Rekam AI TTS Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message || "Terjadi kesalahan saat memproses audio Kokoro.";
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "rekam"}\n\n` + `${footer}`);
    }
  }
};