import axios from "axios";
import db from "../../data/db.js";
import { simpleQuoted } from "../../lib/quoted.js";
import { sendPTT } from "../../lib/audio.js";
import { upload } from "../../lib/upload.js";

const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/voice/cravnn`,
  DEFAULT_PRESET_ID: "7256b304-3e46-41a0-9378-226bf03fb0e5",
  DEFAULT_VOICE_NAME: "Santa",
  TIMEOUT: 120000,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 10
};

function initDB(jid = null, name = "") {
  try {
    if (!global.db) global.db = {};
    if (!global.db.user) global.db.user = {};
    if (!global.db.cravnn) global.db.cravnn = {};
    if (jid && !global.db.user[jid]) {
      global.db.user[jid] = {
        name: name || "",
        money: 10000,
        exp: 0
      };
    }
  } catch (err) {
    console.error("[Cravnn initDB Error]:", err?.message || err);
  }
}

function saveDB() {
  try {
    if (typeof db?.write === "function" && global.db) {
      db.write(global.db);
    }
  } catch (err) {
    console.error("[Cravnn saveDB Error]:", err?.message || err);
  }
}

function parseFlags(rawStr = "") {
  try {
    const flags = {};
    const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s--]+))?/g;
    let match;

    while ((match = flagRegex.exec(rawStr)) !== null) {
      let key = match[1].toLowerCase();
      let rawVal = match[2];
      let val = true;

      if (["v", "voice", "preset", "preset_id"].includes(key)) key = "preset";
      if (["l", "lang", "language"].includes(key)) key = "lang";
      if (["s", "search", "q", "query"].includes(key)) key = "search";
      if (["p", "page", "hal"].includes(key)) key = "page";
      if (["bal", "saldo", "coin"].includes(key)) key = "balance";
      if (["c", "cloning"].includes(key)) key = "clone";
      if (["m", "music", "lagu"].includes(key)) key = "song";
      if (["lyr", "lirik"].includes(key)) key = "lyrics";

      if (rawVal !== undefined) {
        if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
          rawVal = rawVal.slice(1, -1);
        }
        if (rawVal === "true") val = true;
        else if (rawVal === "false") val = false;
        else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
        else val = rawVal;
      }
      flags[key] = val;
    }

    const cleanText = rawStr.replace(/(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s--]+))?/g, "").trim();
    return { flags, cleanText };
  } catch (err) {
    console.error("[Cravnn parseFlags Error]:", err?.message || err);
    return { flags: {}, cleanText: rawStr };
  }
}

async function requestCravnnAPI(action, payload = {}) {
  try {
    const { data } = await axios.post(CONFIG.API_URL, {
      action: action,
      ...payload
    }, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": CONFIG.USER_AGENT
      },
      timeout: CONFIG.TIMEOUT
    });

    if (!data?.status) {
      throw new Error(data?.error || data?.result?.error || "Gagal memproses request Cravnn API.");
    }
    return data;
  } catch (error) {
    const errMsg = error.response?.data?.error || error.response?.data?.result?.error || error.message;
    throw new Error(errMsg || "Terjadi kesalahan pada server Cravnn.");
  }
}

export default {
  name: "cravnn",
  aliases: ["dazed", "clonetts", "cravnnvoice", "cvn"],
  description: "AI Voice Studio Cravnn (TTS Presets, Voice Cloning, AI Music/Song & Lyrics Generator)",
  category: "AI",
  limit: true,
  example: "cravnn Halo semua --preset Santa atau cravnn --song lirik lagu pop",

  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "Cravnn AI";
    const botFooter = `${botName} • AI Voice & Audio Engine`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const targetJid = ctx.chat || ctx.id;
    const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;

    try {
      initDB(senderId, ctx.pushName);

      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();

      const userSession = global.db.cravnn[senderId] || {};
      const { flags, cleanText } = parseFlags(rawText);

      // 1. Reset Sesi
      if (flags.reset || rawText === "--reset") {
        if (global.db.cravnn[senderId]) {
          delete global.db.cravnn[senderId];
          saveDB();
        }
        return ctx.reply(`– *C R A V N N  A U D I O*\n\n` +
          `┌ ◦ *Status* : Sesi pengguna berhasil direset.\n` +
          `│ ◦ *Default Voice* : ${CONFIG.DEFAULT_VOICE_NAME}\n` +
          `└ ◦ *Pilihan Suara* : Ketik \`${prefix}cravnn --list\` untuk melihat daftar preset.\n\n` +
          `${botFooter}`);
      }

      // 2. Cek Saldo & Auto Claim Reward
      if (flags.balance || flags.claim || rawText === "--balance" || rawText === "--claim") {
        await ctx.react("💰");
        if (flags.claim) {
          await requestCravnnAPI("auto_claim", { state: userSession.state || undefined }).catch(() => null);
        }
        const balRes = await requestCravnnAPI("get_bal", { state: userSession.state || undefined });
        if (balRes.state) {
          userSession.state = balRes.state;
          global.db.cravnn[senderId] = userSession;
          saveDB();
        }

        const balData = balRes.result || {};
        return ctx.reply(`– *C R A V N N  A K U N*\n\n` +
          `┌ ◦ *Pengguna* : @${senderId.split("@")[0]}\n` +
          `│ ◦ *Saldo Token* : *${balData.balance ?? 0}* Tokens\n` +
          `│ ◦ *Total Didapat* : ${balData.lifetime_earned ?? 0}\n` +
          `└ ◦ *Total Dipakai* : ${balData.lifetime_spent ?? 0}\n\n` +
          `💡 _Ketik \`${prefix}cravnn --claim\` untuk mengklaim hadiah harian & spin!_\n\n` +
          `${botFooter}`, { mentions: [senderId] });
      }

      // 3. Set Voice Preset Aktif
      if (flags.setvoice) {
        const presetId = String(flags.setvoice).trim();
        const presetName = flags.name || presetId;
        userSession.preset_id = presetId;
        userSession.voice_name = presetName;
        userSession.updatedAt = Date.now();
        global.db.cravnn[senderId] = userSession;
        saveDB();

        await ctx.react("✅");
        return ctx.reply(`– *C R A V N N  V O I C E*\n\n` +
          `┌ ◦ *Model Aktif* : ${presetName}\n` +
          `│ ◦ *Preset ID* : \`${presetId}\`\n` +
          `└ ◦ *Status* : Tersimpan sebagai suara utama.\n\n` +
          `_Ketik \`${prefix}cravnn <teks>\` untuk mulai berbicara._\n\n` +
          `${botFooter}`);
      }

      // 4. Daftar Preset Suara (List & Search)
      if (flags.list || flags.search || rawText.startsWith("--list") || rawText.startsWith("--search") || flags.page) {
        await ctx.react("⏳");
        const searchQuery = typeof flags.search === "string" ? flags.search : (typeof flags.list === "string" ? flags.list : cleanText);
        const listData = await requestCravnnAPI("list_voice", {
          state: userSession.state || undefined,
          search: searchQuery && searchQuery !== "true" ? searchQuery : ""
        });

        if (listData.state) {
          userSession.state = listData.state;
          global.db.cravnn[senderId] = userSession;
          saveDB();
        }

        const presets = listData?.result?.presets || [];
        if (!presets.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan model suara untuk kata kunci "${searchQuery}".`);
        }

        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(presets.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = presets.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);

        const rows = pageItems.map((p, i) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + i + 1;
          const pId = p.id || p.preset_id;
          const pName = p.name || pId;
          return {
            title: `${globalIdx}. ${pName}`.slice(0, 24),
            id: `${prefix}cravnn --setvoice "${pId}" --name "${pName}"`,
            description: `Gunakan suara: ${pName} (${p.gender || "Voice"})`.slice(0, 60)
          };
        });

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH PRESET SUARA (${pageItems.length})`,
            sections: [{
              title: `DAFTAR MODEL SUARA (Hal ${page}/${totalPages})`,
              rows: rows
            }]
          })
        }];

        const baseCmd = `${prefix}cravnn ${searchQuery && searchQuery !== "true" ? `--search "${searchQuery}"` : "--list"}`;
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

        const bodyList = `– *C R A V N N  V O I C E  L I S T*\n\n` +
          `┌ ◦ *Total Model* : ${presets.length} Karakter\n` +
          `│ ◦ *Halaman* : ${page} dari ${totalPages}\n` +
          (searchQuery && searchQuery !== "true" ? `│ ◦ *Pencarian* : "${searchQuery}"\n` : "") +
          `└ ◦ *Engine* : Cravnn Neural Voice\n\n` +
          `_Pilih suara dari menu bawah atau ketik langsung ID preset:_`;

        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyList, botFooter, buttons, { quoted: quotedMsg });
        } else {
          let textFallback = `${bodyList}\n\n`;
          rows.forEach(r => {
            textFallback += `• *${r.title}*\n  Perintah: \`${r.id}\`\n\n`;
          });
          await ctx.reply(textFallback.trim(), { quoted: quotedMsg });
        }

        await ctx.react("✅");
        return;
      }

      // Deteksi Media Audio bila dikirim / di-quote
      let audioBuffer = null;
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const mediaType = ctx.type || ctx.quoted?.type || "";

      if (isMedia && (mediaType.includes("audio") || ctx.quoted?.isAudio)) {
        try {
          audioBuffer = await ctx.download();
        } catch (_) {}
      }

      // 5. Generate Lirik Musik (AI Lyrics)
      if (flags.lyrics || flags.lyr) {
        const theme = cleanText || (typeof flags.lyrics === "string" ? flags.lyrics : "");
        if (!theme) {
          return ctx.reply(`❌ Masukkan tema lirik lagu yang ingin dibuat!\nContoh: \`${prefix}cravnn --lyrics perjalanan cinta di tepi pantai --genre pop\``);
        }
        await ctx.react("✍️");
        const lyrRes = await requestCravnnAPI("gen_lyr", {
          state: userSession.state || undefined,
          theme: theme,
          genre: flags.genre || "pop",
          mood: flags.mood || "happy"
        });

        const lyrData = lyrRes.result || {};
        return ctx.reply(`– *C R A V N N  L Y R I C S*\n\n` +
          `┌ ◦ *Tema* : ${lyrData.theme}\n` +
          `└ ◦ *Genre* : ${lyrData.genre}\n\n` +
          `${lyrData.lyrics}\n\n` +
          `${botFooter}`);
      }

      // 6. Generate Musik / Lagu (AI Song)
      if (flags.song || flags.music) {
        const lyrics = cleanText || (typeof flags.song === "string" ? flags.song : "");
        if (!lyrics) {
          return ctx.reply(`❌ Masukkan lirik lagu yang ingin dinyanyikan!\nContoh: \`${prefix}cravnn --song [Verse] Hello world [Chorus] La la la --genre pop\``);
        }
        await ctx.react("🎵");
        const songRes = await requestCravnnAPI("gen_song", {
          state: userSession.state || undefined,
          lyrics: lyrics,
          tags: flags.genre || flags.tags || "pop",
          wait: true
        });

        const songUrl = songRes?.result?.audio_url;
        if (!songUrl) throw new Error("Gagal mendapatkan audio lagu hasil generate.");

        await sendPTT(sock, targetJid, songUrl, quotedMsg);
        await ctx.react("🎶");
        return;
      }

      // 7. Voice Cloning (Tiru Suara dari Audio VN / Rekaman)
      if (flags.clone || audioBuffer) {
        const textToClone = cleanText || flags.text;
        if (!textToClone) {
          return ctx.reply(`❌ Harap masukkan teks yang ingin diucapkan dengan suara kloning!\n\n*Format:*\nBalas VN/Audio dengan: \`${prefix}cravnn <teks>\``);
        }

        let audioSource = null;
        if (audioBuffer && Buffer.isBuffer(audioBuffer)) {
          const uploadRes = await upload(audioBuffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            audioSource = uploadRes.url;
          }
        }

        if (!audioSource && !flags.audio && !flags.upload_id) {
          return ctx.reply(`❌ Harap lampirkan atau balas (*reply*) pesan suara/audio sebagai sampel suara.`);
        }

        await ctx.react("🎙️");
        const cloneRes = await requestCravnnAPI("clone", {
          state: userSession.state || undefined,
          text: textToClone,
          audio: audioSource || flags.audio,
          upload_id: flags.upload_id,
          name: flags.name || `Clone_${senderId.split("@")[0]}`,
          lang: flags.lang || "Indonesian",
          wait: true
        });

        if (cloneRes.state) {
          userSession.state = cloneRes.state;
          global.db.cravnn[senderId] = userSession;
          saveDB();
        }

        const cloneAudio = cloneRes.result?.audio_url;
        if (!cloneAudio) throw new Error("Gagal memproses hasil suara kloning.");

        await sendPTT(sock, targetJid, cloneAudio, quotedMsg);
        await ctx.react("✨");
        return;
      }

      // 8. Text-to-Speech (TTS Standar / Preset)
      const textToSpeak = cleanText || flags.text;

      // Panduan jika tanpa teks & tanpa audio
      if (!textToSpeak) {
        const activeName = userSession.voice_name || CONFIG.DEFAULT_VOICE_NAME;
        const guideText = `– *C R A V N N  V O I C E  S T U D I O*\n\n` +
          `┌ ◦ *Voice Aktif* : ${activeName}\n` +
          `└ ◦ *Engine* : Neural Speech Synthesis\n\n` +
          `– *P E R I N T A H  U T A M A*\n\n` +
          `┌ ◦ *Bicara (TTS)* :\n│   \`${prefix}cravnn Halo semuanya, selamat pagi\`\n` +
          `├ ◦ *Ganti Suara Preset* :\n│   \`${prefix}cravnn --preset "7256b304-..." <teks>\`\n` +
          `├ ◦ *Kloning Suara (Voice Clone)* :\n│   Kirim/balas audio VN: \`${prefix}cravnn Halo aku tiru suaramu\`\n` +
          `├ ◦ *Bikin Lagu (AI Song)* :\n│   \`${prefix}cravnn --song [Verse] Lirik lagu disini\`\n` +
          `├ ◦ *Bikin Lirik (Lyrics)* :\n│   \`${prefix}cravnn --lyrics perjalanan malam di kota\`\n` +
          `├ ◦ *Daftar Suara* :\n│   \`${prefix}cravnn --list\`\n` +
          `└ ◦ *Cek Saldo Akun* :\n    \`${prefix}cravnn --balance\` (Klaim: \`--claim\`)`;

        return ctx.reply(guideText, { quoted: quotedMsg });
      }

      if (textToSpeak.length > 500) {
        return ctx.reply(`❌ Teks terlalu panjang! Maksimal 500 karakter per permintaan.`);
      }

      await ctx.react("⏳");

      const presetIdToUse = flags.preset || userSession.preset_id || CONFIG.DEFAULT_PRESET_ID;
      const ttsRes = await requestCravnnAPI("tts", {
        state: userSession.state || undefined,
        text: textToSpeak,
        preset_id: presetIdToUse,
        lang: flags.lang || "Indonesian",
        wait: true
      });

      if (ttsRes.state) {
        userSession.state = ttsRes.state;
        global.db.cravnn[senderId] = userSession;
        saveDB();
      }

      const audioUrl = ttsRes?.result?.audio_url;
      if (!audioUrl) throw new Error("Gagal memperoleh link audio hasil konversi.");

      await sendPTT(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");

    } catch (error) {
      console.error("[Cravnn Voice Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.message || "Terjadi kesalahan pada pemrosesan audio.";
      ctx.reply(`❌ *Kendala Cravnn Voice*: ${errMsg}`);
    }
  }
};