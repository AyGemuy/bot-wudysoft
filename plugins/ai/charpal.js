import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/charpal`;
const SESSION_TIMEOUT = 30 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
const PRESET_CHARACTERS = [{
  role_uuid: "596119627990315548",
  name: "Overprotective CEO Husband",
  alias: "liam",
  gender: "Male",
  tagline: "Suami CEO kaya yang sangat posesif dan protektif terhadapmu.",
  greeting: "*Liam and you have shared a marriage for three years now, both employed at his leading corporate firm.*\n*You've frequently witnessed his secretary's playful advances toward him, though Liam remains utterly indifferent to them—yet it stirs jealousy within you.*\n*He summons you into his private office, gesturing for you to settle onto his lap as you enter.*\n\"Darling, come closer... Let's discuss this. Why do you seem so envious whenever I interact with my assistant?\" *His voice is gentle, paired with a warm, knowing smile as he regards you.*",
  image_url: "https://os.charmsa.app/avatars/596119627990315548_manual.png",
  isPreset: true
}, {
  role_uuid: "596119721305190940",
  name: "Your Brother's Best Friend",
  alias: "ethan",
  gender: "Male",
  tagline: "Sahabat kakakmu yang diam-diam memendam rasa cinta mendalam padamu.",
  greeting: "Ethan and your brother have been inseparable since childhood, but what you never realized was that Ethan has harbored feelings for you all these years, keeping his distance and acting aloof around you.\n\nOn this typical weekend, your brother's best friend is over at your place like always—he practically lives there. You're getting ready to head out to a party when Ethan (**your brother's best friend**) suddenly turns to you with a piercing gaze and asks, \"Where do you think you're headed?\" His voice is steady, eyes locked on yours without flinching.",
  image_url: "https://os.charmsa.app/avatars/596119721305190940_manual.png",
  isPreset: true
}, {
  role_uuid: "596119689143267868",
  name: "Bloody Queen",
  alias: "valeria",
  gender: "Female",
  tagline: "Ratu penguasa berdarah dingin yang penuh wibawa dan misterius.",
  greeting: "**You stand as the sole surviving heir of your family following the devastating war, now thrust into the role of your people's new leader. Facing Valeria, the infamous Bloody Queen, you sense your presence here carries weight for the eras to come. She lounges upon her grand throne, eyeing you with an air of unchallenged authority before speaking.**\nHmm, you're far younger than I expected... Regardless, welcome. I am Valeria.",
  image_url: "https://os.charmsa.app/avatars/596119689143267868_manual.png",
  isPreset: true
}];

function initDB(jid = null, name = "") {
  try {
    if (!global.db) global.db = {};
    if (!global.db.user) global.db.user = {};
    if (!global.db.charpal) global.db.charpal = {};
    if (!global.db.charpal_characters) global.db.charpal_characters = {};
    if (jid && !global.db.user[jid]) {
      global.db.user[jid] = {
        name: name || "",
        money: 1e4,
        exp: 0
      };
    }
  } catch (err) {
    console.error("[CharPal initDB Error]:", err?.message || err);
  }
}

function saveDB() {
  try {
    if (typeof db?.write === "function" && global.db) {
      db.write(global.db);
    }
  } catch (err) {
    console.error("[CharPal saveDB Error]:", err?.message || err);
  }
}

function parseFlags(input = "") {
  try {
    const flags = {};
    const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
    let match;
    while ((match = flagRegex.exec(input)) !== null) {
      let key = match[1].toLowerCase();
      let rawVal = match[2];
      let val = true;
      if (["char", "character", "c", "role"].includes(key)) key = "character";
      if (["restart", "reset", "clear"].includes(key)) key = "reset";
      if (["add", "create", "new"].includes(key)) key = "create";
      if (["edit", "update", "ubah"].includes(key)) key = "edit";
      if (["del", "delete", "remove", "hapus"].includes(key)) key = "delete";
      if (["info", "detail", "view"].includes(key)) key = "info";
      if (["img", "image", "avatar", "foto"].includes(key)) key = "image";
      if (["greet", "greeting", "intro"].includes(key)) key = "greeting";
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
  } catch (err) {
    console.error("[CharPal parseFlags Error]:", err?.message || err);
    return {
      flags: {},
      cleanPrompt: input
    };
  }
}

function getAllCharacters() {
  try {
    initDB();
    const customList = Object.values(global.db.charpal_characters || {});
    return [...PRESET_CHARACTERS, ...customList];
  } catch (err) {
    console.error("[CharPal getAllCharacters Error]:", err?.message || err);
    return PRESET_CHARACTERS;
  }
}

function resolveCharacter(query = "") {
  try {
    const all = getAllCharacters();
    const q = (query || "").toString().trim().toLowerCase();
    const found = all.find(c => c.alias.toLowerCase() === q || c.role_uuid === query || c.name.toLowerCase().includes(q));
    return found || PRESET_CHARACTERS[0];
  } catch (err) {
    console.error("[CharPal resolveCharacter Error]:", err?.message || err);
    return PRESET_CHARACTERS[0];
  }
}
async function requestCharPalAPI(payload = {}) {
  try {
    const {
      data
    } = await axios.post(API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": CONFIG.USER_AGENT
      },
      timeout: CONFIG.TIMEOUT
    });
    return data;
  } catch (err) {
    console.error("[CharPal requestCharPalAPI Error]:", err?.message || err);
    throw err;
  }
}

function recordSession(chatId, messageId, characterData, history = []) {
  try {
    if (!messageId || !chatId) return;
    initDB();
    if (!global.db.charpal[chatId]) {
      global.db.charpal[chatId] = {
        character: characterData?.alias || "liam",
        role_uuid: characterData?.role_uuid,
        character_name: characterData?.name,
        history: [],
        msgIds: [],
        lastMsgId: null,
        updatedAt: Date.now(),
        expireTime: Date.now() + SESSION_TIMEOUT
      };
    }
    const s = global.db.charpal[chatId];
    if (characterData) {
      s.character = characterData.alias;
      s.role_uuid = characterData.role_uuid;
      s.character_name = characterData.name;
    }
    if (Array.isArray(history) && history.length > 0) {
      s.history = history;
    }
    if (!Array.isArray(s.msgIds)) s.msgIds = [];
    if (!s.msgIds.includes(messageId)) {
      s.msgIds.push(messageId);
    }
    s.lastMsgId = messageId;
    s.updatedAt = Date.now();
    s.expireTime = Date.now() + SESSION_TIMEOUT;
    saveDB();
  } catch (err) {
    console.error("[CharPal recordSession Error]:", err?.message || err);
  }
}
export default {
  name: "charpal",
  aliases: ["cpal", "roleplay", "airoleplay", "crp"],
  description: "AI Roleplay Character Chat with Full CRUD Custom Character Management via Wudysoft API",
  category: "AI",
  limit: true,
  example: "charpal --char liam halo sayang atau charpal --create --alias gojo --name 'Gojo Satoru'",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.charpal[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.charpal[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.charpal[chatId];
        saveDB();
        return;
      }
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingAi = quotedStanzaId && (quotedStanzaId === sessionData.lastMsgId || Array.isArray(sessionData.msgIds) && sessionData.msgIds.includes(quotedStanzaId));
      if (!isQuotingAi) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      if (!userText) return;
      if (typeof ctx?.react === "function") await ctx.react("💬");
      const currentChar = resolveCharacter(sessionData.character || sessionData.role_uuid);
      const payload = {
        mode: "chat",
        prompt: userText,
        character: currentChar.alias,
        role_uuid: currentChar.role_uuid,
        name: currentChar.name,
        greeting: currentChar.greeting,
        image_url: currentChar.image_url,
        messages: Array.isArray(sessionData.history) ? sessionData.history : []
      };
      const res = await requestCharPalAPI(payload);
      if (!res || !res.status) {
        throw new Error(res?.result?.error_message || res?.error || "Gagal mendapatkan balasan dari karakter.");
      }
      const result = res.result || {};
      const answerText = (result.response || "No response received.").trim();
      const updatedHistory = result.history || [...payload.messages, {
        role: "user",
        content: userText
      }, {
        role: "ai",
        content: answerText
      }];
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Balasan",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, `${currentChar.name} • CharPal AI`, buttons, {
          quoted: msg
        });
      } else {
        sentMsg = await sock.sendMessage(chatId, {
          text: bodyText
        }, {
          quoted: msg
        });
      }
      const newMsgId = sentMsg?.key?.id;
      if (newMsgId) {
        recordSession(chatId, newMsgId, currentChar, updatedHistory);
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[CHARPAL BEFORE ERROR]:", e?.message || e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      initDB();
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["charpal", "cpal", "roleplay", "airoleplay", "crp"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botFooter = `${global.bot?.name || "CharPal"} • Roleplay AI Engine`;
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      let uploadedMediaUrl = flags.image || null;
      if (isMedia) {
        try {
          const buffer = await ctx.download();
          if (buffer && Buffer.isBuffer(buffer)) {
            const uploadRes = await upload(buffer).catch(() => null);
            if (uploadRes?.status && uploadRes?.url) {
              uploadedMediaUrl = uploadRes.url;
            }
          }
        } catch (_) {}
      }
      if (flags.create) {
        const alias = (typeof flags.create === "string" ? flags.create : flags.alias || flags.character || "").toString().toLowerCase().trim().replace(/[^a-z0-9_-]/g, "");
        const name = (flags.name || cleanPrompt || alias).toString().trim();
        const greeting = (flags.greeting || `Halo, aku adalah ${name}. Senang bertemu denganmu di sini.`).toString().trim();
        if (!alias) {
          return ctx.reply(`❌ Masukkan alias id karakter unik!\n\n*Format*:\n\`${prefix}charpal --create --alias <id_alias> --name "<Nama Lengkap>" --greeting "<Intro/Sapaan>"\`\n\n*Contoh*:\n\`${prefix}charpal --create --alias gojo --name "Satoru Gojo" --greeting "Yowai mo! Ada apa memanggilku?"\``);
        }
        if (PRESET_CHARACTERS.some(p => p.alias === alias)) {
          return ctx.reply(`❌ Alias \`${alias}\` sudah digunakan oleh karakter preset sistem! Gunakan alias lain.`);
        }
        global.db.charpal_characters[alias] = {
          role_uuid: flags.role_uuid || "596119627990315548",
          name: name,
          alias: alias,
          gender: flags.gender || "Custom",
          tagline: flags.tagline || `Karakter kustom buatan komunitas.`,
          greeting: greeting,
          image_url: uploadedMediaUrl || global.bot?.media?.banner1 || "https://os.charmsa.app/avatars/596119627990315548_manual.png",
          author: ctx.pushname || ctx.sender?.split("@")[0] || "User",
          createdAt: Date.now(),
          isPreset: false
        };
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`✨ *BERHASIL MEMBUAT KARAKTER BARU!*

┌  ◦  *Nama* : ${name}
│  ◦  *Alias* : \`${alias}\`
│  ◦  *Avatar* : ${uploadedMediaUrl ? "Tersimpan 🖼️" : "Default 👤"}
└  ◦  *Intro / Greeting* :
"${greeting}"

_Mulai bermain sekarang dengan ketik:_\n\`${prefix}charpal --char ${alias} Halo!\``, {
          quoted: quotedMsg
        });
      }
      if (flags.edit) {
        const targetAlias = (typeof flags.edit === "string" ? flags.edit : flags.alias || flags.character || "").toString().toLowerCase().trim();
        if (!targetAlias || !global.db.charpal_characters[targetAlias]) {
          return ctx.reply(`❌ Karakter kustom dengan alias \`${targetAlias || "-"}\` tidak ditemukan di database.`);
        }
        const charItem = global.db.charpal_characters[targetAlias];
        if (flags.name) charItem.name = flags.name.trim();
        if (flags.greeting) charItem.greeting = flags.greeting.trim();
        if (flags.gender) charItem.gender = flags.gender.trim();
        if (flags.tagline) charItem.tagline = flags.tagline.trim();
        if (uploadedMediaUrl) charItem.image_url = uploadedMediaUrl;
        charItem.updatedAt = Date.now();
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`✅ *Karakter [${charItem.name}] Berhasil Diperbarui!*\n\nKetik \`${prefix}charpal --info ${targetAlias}\` untuk melihat profil terbaru.`);
      }
      if (flags.delete) {
        const targetAlias = (typeof flags.delete === "string" ? flags.delete : flags.alias || flags.character || cleanPrompt).toString().toLowerCase().trim();
        if (PRESET_CHARACTERS.some(p => p.alias === targetAlias)) {
          return ctx.reply(`❌ Karakter \`${targetAlias}\` adalah karakter bawaan sistem dan tidak dapat dihapus.`);
        }
        if (!global.db.charpal_characters[targetAlias]) {
          return ctx.reply(`❌ Karakter kustom \`${targetAlias}\` tidak ditemukan.`);
        }
        const deletedName = global.db.charpal_characters[targetAlias].name;
        delete global.db.charpal_characters[targetAlias];
        saveDB();
        if (global.db.charpal[chatId]?.character === targetAlias) {
          delete global.db.charpal[chatId];
          saveDB();
        }
        await ctx.react("🗑️");
        return ctx.reply(`🗑️ *Karakter "${deletedName}" (\`${targetAlias}\`) berhasil dihapus dari database!*`);
      }
      if (flags.info) {
        const targetAlias = (typeof flags.info === "string" ? flags.info : cleanPrompt || flags.character).toString().toLowerCase().trim();
        const found = resolveCharacter(targetAlias);
        const infoCaption = `–  *P R O F I L  K A R A K T E R*

┌  ◦  *Nama* : ${found.name}
│  ◦  *Alias* : \`${found.alias}\`
│  ◦  *Tipe* : ${found.isPreset ? "Preset Sistem 🔒" : "Kustom User 👤"}
│  ◦  *Gender* : ${found.gender || "Tidak ditentukan"}
└  ◦  *Tagline* : ${found.tagline || "-"}

–  *I N T R O  /  G R E E T I N G*
"${found.greeting}"

_Mulai cerita: \`${prefix}charpal --char ${found.alias} <pesan>\`_`;
        if (found.image_url) {
          return await sock.sendMessage(chatId, {
            image: {
              url: found.image_url
            },
            caption: infoCaption
          }, {
            quoted: quotedMsg
          });
        } else {
          return ctx.reply(infoCaption, {
            quoted: quotedMsg
          });
        }
      }
      if (["--chars", "--list", "list", "chars", "characters"].includes(rawText.toLowerCase()) || flags.list) {
        const all = getAllCharacters();
        let listText = `–  *D A F T A R  K A R A K T E R  C H A R P A L*\n\n`;
        all.forEach((c, idx) => {
          const typeBadge = c.isPreset ? "[Preset]" : "[Custom]";
          listText += `*${idx + 1}. ${c.name}* (\`${c.alias}\`) ${typeBadge}\n`;
          listText += `└ _${c.tagline || c.greeting?.slice(0, 50) + "..."}_\n\n`;
        });
        listText += `┌  ◦  *Mulai Chat* : \`${prefix}charpal --char <alias> <pesan>\`\n`;
        listText += `├  ◦  *Lihat Detail* : \`${prefix}charpal --info <alias>\`\n`;
        listText += `├  ◦  *Bikin Karakter* : \`${prefix}charpal --create --alias <id> --name "<nama>"\`\n`;
        listText += `└  ◦  *Hapus Karakter* : \`${prefix}charpal --delete <alias>\``;
        return ctx.reply(listText, {
          quoted: quotedMsg
        });
      }
      if (["--reset", "--clear", "reset", "clear"].includes(rawText.toLowerCase()) || flags.reset) {
        if (global.db.charpal[chatId]) {
          delete global.db.charpal[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi obrolan roleplay berhasil direset!* Cerita dimulai kembali dari awal.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi aktif roleplay di obrolan ini.");
      }
      if (!rawText && !isMedia) {
        const all = getAllCharacters();
        const rows = all.map(c => ({
          title: c.name,
          id: `${prefix}charpal --char ${c.alias} Halo, aku ada di sini...`,
          description: `Alias: ${c.alias} • ${c.isPreset ? "Preset" : "Custom"}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🎭 PILIH KARAKTER ROLEPLAY",
            sections: [{
              title: `SEMUA KARAKTER TERSEDIA (${all.length})`,
              rows: rows
            }]
          })
        }];
        const guideText = `–  *C H A R P A L  R O L E P L A Y*

Bermain peran secara mendalam dengan AI. Kamu juga bisa *membuat karakter kustom sendiri*!

–  *M A N A J E M E N  K A R A K T E R  ( C R U D )*

┌  ◦  *Create* : \`${prefix}charpal --create --alias <id> --name "<nama>" --greeting "<teks>"\`
│     *(Bisa kirim/balas foto langsung untuk avatar)*
├  ◦  *Read*   : \`${prefix}charpal --list\` atau \`${prefix}charpal --info <alias>\`
├  ◦  *Update* : \`${prefix}charpal --edit <alias> --name "<nama_baru>"\`
└  ◦  *Delete* : \`${prefix}charpal --delete <alias>\`

–  *P E N G G U N A A N  C H A T*

┌  ◦  *Mulai Chat* : \`${prefix}charpal --char liam kamu sedang apa?\`
├  ◦  *Lanjut Chat* : Cukup *balas (reply) pesan bot* untuk melanjutkan cerita.
└  ◦  *Pilih Cepat* : Klik tombol *PILIH KARAKTER ROLEPLAY* di bawah.`;
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(guideText, botFooter, buttons, {
            image: PRESET_CHARACTERS[0].image_url,
            quoted: quotedMsg
          });
        } else {
          return ctx.reply(guideText, {
            quoted: quotedMsg
          });
        }
      }
      await ctx.react("💬");
      const existingSession = global.db.charpal[chatId];
      let targetCharQuery = flags.character;
      if (!targetCharQuery && existingSession?.character) {
        targetCharQuery = existingSession.character;
      }
      const charData = resolveCharacter(targetCharQuery || "liam");
      let currentHistory = [];
      if (existingSession && existingSession.character === charData.alias && Array.isArray(existingSession.history)) {
        currentHistory = existingSession.history;
      }
      const promptText = cleanPrompt || flags.prompt || "Halo";
      const payload = {
        mode: "chat",
        prompt: promptText,
        character: charData.alias,
        role_uuid: charData.role_uuid,
        name: charData.name,
        greeting: charData.greeting,
        image_url: charData.image_url,
        messages: currentHistory
      };
      const res = await requestCharPalAPI(payload);
      if (!res || !res.status) {
        throw new Error(res?.result?.error_message || res?.error || "Gagal mendapatkan respon roleplay dari server.");
      }
      const result = res.result || {};
      const answerText = (result.response || "No response received.").trim();
      const updatedHistory = result.history || [...currentHistory, {
        role: "user",
        content: promptText
      }, {
        role: "ai",
        content: answerText
      }];
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Cerita",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, `${charData.name} • CharPal AI`, buttons, {
          image: charData.image_url,
          quoted: quotedMsg
        });
      } else {
        sentMsg = await sock.sendMessage(chatId, {
          image: charData.image_url ? {
            url: charData.image_url
          } : undefined,
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      const sentMsgId = sentMsg?.key?.id;
      if (sentMsgId) {
        recordSession(chatId, sentMsgId, charData, updatedHistory);
      }
      await ctx.react("✨");
    } catch (error) {
      console.error("[CharPal Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.response?.data?.result?.error_message || error.response?.data?.error || error.message;
      ctx.reply(`❌ Kendala CharPal Roleplay: ${errMsg}`);
    }
  }
};