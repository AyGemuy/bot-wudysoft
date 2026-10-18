import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v45`,
  DEFAULT_VOICE: "id-ID-Standard-A",
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 10
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.voxClone) global.db.voxClone = {};
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
async function requestVoxClone(payload, senderId) {
  initDB(senderId);
  const userSession = global.db.voxClone[senderId];
  if (userSession?.state && !payload.state) {
    payload.state = userSession.state;
  }
  const makeRequest = async body => {
    return await axios.post(CONFIG.API_URL, body, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": CONFIG.USER_AGENT
      },
      timeout: CONFIG.TIMEOUT
    });
  };
  try {
    const res = await makeRequest(payload);
    const data = res.data;
    if (!data?.status) {
      throw new Error(data?.error || data?.message || "Response status false dari server.");
    }
    if (data.state) {
      if (!global.db.voxClone[senderId]) {
        global.db.voxClone[senderId] = {
          voice: CONFIG.DEFAULT_VOICE,
          state: null
        };
      }
      global.db.voxClone[senderId].state = data.state;
      global.db.voxClone[senderId].updatedAt = Date.now();
      saveDB();
    }
    return data;
  } catch (error) {
    if (payload.state) {
      console.warn(`[VoxClone] Sesi state kedaluwarsa untuk user ${senderId}. Memulai auto-refresh sesi baru...`);
      delete payload.state;
      if (global.db.voxClone[senderId]) {
        global.db.voxClone[senderId].state = null;
        saveDB();
      }
      const retryRes = await makeRequest(payload);
      const retryData = retryRes.data;
      if (!retryData?.status) {
        throw new Error(retryData?.error || retryData?.message || "Gagal saat auto-refresh sesi.");
      }
      if (retryData.state) {
        if (!global.db.voxClone[senderId]) {
          global.db.voxClone[senderId] = {
            voice: CONFIG.DEFAULT_VOICE,
            state: null
          };
        }
        global.db.voxClone[senderId].state = retryData.state;
        global.db.voxClone[senderId].updatedAt = Date.now();
        saveDB();
        console.log(`[VoxClone] Sesi state baru berhasil disimpan untuk user ${senderId}.`);
      }
      return retryData;
    }
    throw error;
  }
}
export default {
  name: "voxclone",
  aliases: ["vox", "voxtts", "ttsv45", "gcloudtts"],
  description: "Text-to-Speech AI VoxClone (Google Cloud TTS v45) dengan Auto Refresh Session & Full DB.",
  category: "AI",
  limit: true,
  example: "voxclone --search id-ID\nvoxclone Halo selamat pagi\nvoxclone --info\nvoxclone --reset",
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
      const userSession = global.db.voxClone[senderId] || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        if (global.db.voxClone[senderId]) {
          delete global.db.voxClone[senderId];
          saveDB();
        }
        return ctx.reply(`– *V O X  C L O N E*\n\n` + `┌ ◦ *Status* : Sesi suara & token berhasil direset\n` + `│ ◦ *Default Voice* : ${CONFIG.DEFAULT_VOICE}\n` + `└ ◦ *Action* : Ketik ${prefix}voxclone --search <query> untuk mencari suara.\n\n` + `${footer}`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        const currentVoice = userSession?.voice || CONFIG.DEFAULT_VOICE;
        return ctx.reply(`– *S T A T U S*\n\n` + `┌ ◦ *User* : @${senderId.split("@")[0]}\n` + `│ ◦ *Voice* : ${currentVoice}\n` + `└ ◦ *Session State* : ${userSession?.state ? "Active (Auto-Refresh)" : "Not Generated"}\n\n` + `_Ketik ${prefix}voxclone <teks> untuk berbicara._\n\n` + `${footer}`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const voiceName = String(flags.setvoice);
        const newSession = {
          voice: voiceName,
          state: userSession?.state || null,
          updatedAt: Date.now()
        };
        global.db.voxClone[senderId] = newSession;
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *V O X  C L O N E*\n\n` + `┌ ◦ *Voice* : ${newSession.voice}\n` + `└ ◦ *Status* : Tersimpan ke sesi pengguna\n\n` + `_Ketik ${prefix}voxclone <teks> untuk mulai berbicara._\n\n` + `${footer}`);
      }
      if (flags.search || flags.query || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        const searchQuery = flags.search || flags.query || !flags.page && cleanText || "id-ID";
        await ctx.react("⏳");
        const data = await requestVoxClone({
          action: "voice_list"
        }, senderId);
        const allVoices = Array.isArray(data?.result) ? data.result : [];
        if (!allVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memuat daftar suara\n` + `└ ◦ *Info* : Server VoxClone tidak merespons.\n\n` + `${footer}`);
        }
        const filterKeyword = String(searchQuery).toLowerCase();
        const matchedVoices = allVoices.filter(v => typeof v === "string" && v.toLowerCase().includes(filterKeyword));
        if (!matchedVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Model suara tidak ditemukan\n` + `└ ◦ *Query* : "${searchQuery}"\n\n` + `${footer}`);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matchedVoices.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = matchedVoices.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        if (!pageItems.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Halaman kosong\n` + `└ ◦ *Info* : Halaman ${page} tidak memiliki data suara.\n\n` + `${footer}`);
        }
        const voiceRows = pageItems.map((voiceName, i) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + i + 1;
          const parts = voiceName.split("-");
          const locale = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : "Global";
          const type = parts.slice(2).join("-") || "Standard";
          return {
            title: `${globalIdx}. ${voiceName}`.slice(0, 24),
            id: `${prefix}voxclone --setvoice "${voiceName}"`,
            description: `Locale: ${locale} | Type: ${type}`.slice(0, 60)
          };
        });
        const baseCmd = `${prefix}voxclone --search "${searchQuery}"`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH MODEL SUARA (${pageItems.length})`,
            sections: [{
              title: `HASIL FILTER: ${searchQuery.toUpperCase()} (Hal ${page}/${totalPages})`,
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
        const bodyText = `– *V O X  C L O N E  -  S E A R C H*\n\n` + `┌ ◦ *Query* : "${searchQuery}"\n` + `│ ◦ *Total* : ${matchedVoices.length} Model\n` + `│ ◦ *Page* : ${page} / ${totalPages}\n` + `└ ◦ *Engine* : Google Cloud TTS (v45)\n\n` + `_Pilih model suara dari menu di bawah atau gunakan tombol navigasi halaman:_`;
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
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        const helpText = `– *V O X  C L O N E*\n\n` + `┌ ◦ *Active Voice* : ${selectedVoice}\n` + `└ ◦ *Engine* : Google Cloud TTS (v45)\n\n` + `– *U S A G E*\n\n` + `┌ ◦ *Speak* : ${prefix}voxclone <teks>\n` + `│ ◦ *Search* : ${prefix}voxclone --search <kata_kunci>\n` + `└ ◦ *Custom* : ${prefix}voxclone <teks> --voice <voice_id>\n\n` + `– *E X A M P L E*\n\n` + `└ ◦ ${prefix}voxclone Halo semuanya selamat datang!\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const payload = {
        action: "generate",
        text: String(textToSpeak),
        voice: String(selectedVoice),
        ...flags
      };
      delete payload.search;
      delete payload.query;
      delete payload.list;
      delete payload.setvoice;
      const data = await requestVoxClone(payload, senderId);
      const audioUrl = data?.result?.audio_url;
      if (!audioUrl) {
        throw new Error(data?.error || data?.message || "Gagal mendapatkan URL audio.");
      }
      if (!global.db.voxClone[senderId]) {
        global.db.voxClone[senderId] = {
          voice: selectedVoice,
          state: null
        };
      }
      global.db.voxClone[senderId].voice = selectedVoice;
      global.db.voxClone[senderId].updatedAt = Date.now();
      saveDB();
      await sendPTT(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[VoxClone TTS Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Terjadi kesalahan internal saat memproses suara.";
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "voxclone"}\n\n` + `${footer}`);
    }
  }
};