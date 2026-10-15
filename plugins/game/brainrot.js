import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/brainrot/v3?mode=random`;

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.brainrot) global.db.brainrot = {};
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

function cleanMediaUrl(url) {
  if (!url || typeof url !== "string") return null;
  return url.replace(/\\+/g, "/");
}

function normalizeText(str) {
  return (str || "").toLowerCase().replace(/[^\w\s]/gi, "").replace(/\s+/g, " ").trim();
}
async function fetchMediaBuffer(url) {
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 15e3
    });
    if (res.data) return Buffer.from(res.data);
  } catch (err) {
    console.error("[Fetch Media Buffer Error]:", err.message);
  }
  return null;
}
export default {
  name: "brainrot",
  aliases: ["rotquiz", "tebakbrainrot", "brainrotquiz", "rotrivals"],
  description: "Game kuis tebak karakter meme Italian Brainrot dari gambar dan audio (Full DB)",
  category: "Game",
  limit: true,
  example: "brainrot atau brainrot 1 (untuk menjawab)",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.brainrot[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.brainrot[chatId];
      if (Date.now() > session.expireTime) {
        delete global.db.brainrot[chatId];
        saveDB();
        return;
      }
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isReplyingToQuiz = quotedStanzaId && (quotedStanzaId === session.questionMsgId || quotedStanzaId === session.audioMsgId);
      if (!isReplyingToQuiz) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p)) && !userText.startsWith(`${ctx?.prefix || "."}brainrot`)) return;
      let selectedIndex = -1;
      const cleanUser = normalizeText(userText.replace(`${ctx?.prefix || "."}brainrot`, "").trim());
      if (["1", "2", "3", "4"].includes(cleanUser)) {
        selectedIndex = parseInt(cleanUser, 10) - 1;
      } else {
        selectedIndex = session.characters.findIndex(c => {
          const charName = normalizeText(c.name);
          return charName === cleanUser || cleanUser.includes(charName) || charName.includes(cleanUser) && cleanUser.length >= 4;
        });
      }
      if (selectedIndex === -1) return;
      const isCorrect = selectedIndex === session.correctIndex;
      const targetChar = session.characters[session.correctIndex];
      if (isCorrect) {
        const duration = ((Date.now() - session.startTime) / 1e3).toFixed(1);
        const senderName = ctx?.pushname || "Pemain";
        const senderJid = ctx?.sender;
        delete global.db.brainrot[chatId];
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 200;
        }
        saveDB();
        const winMessage = `🧠 *SELAMAT TEBAKAN BRAINROT BENAR!* 🎉\n\n` + `👤 *Penebak:* ${senderName}\n` + `🎭 *Karakter:* *${targetChar.name}*\n` + (targetChar.description ? `📝 *Deskripsi:* _${targetChar.description}_\n` : "") + `⏱️ *Waktu Menjawab:* ${duration} detik\n` + `🎁 *Hadiah:* +200 EXP`;
        if (typeof ctx?.react === "function") await ctx.react("🎉");
        await sock.sendMessage(chatId, {
          text: winMessage
        }, {
          quoted: msg
        });
        return true;
      } else {
        const chosenChar = session.characters[selectedIndex];
        if (typeof ctx?.react === "function") await ctx.react("❌");
        await sock.sendMessage(chatId, {
          text: `❌ *Salah!* Karakter ini bukan *${chosenChar.name}*. Ayo coba tebak lagi!`
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[BRAINROT BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      initDB();
      if (rawText.includes("end") || rawText.includes("batal") || rawText.includes("nyerah") || rawText.includes("surrender")) {
        if (global.db.brainrot[chatId]) {
          const session = global.db.brainrot[chatId];
          const targetChar = session.characters[session.correctIndex];
          delete global.db.brainrot[chatId];
          saveDB();
          return await sock.sendMessage(chatId, {
            text: `🏳️ *Kamu Menyerah!*\n\nJawaban yang benar adalah: *${targetChar.name}*` + (targetChar.description ? `\n📝 _${targetChar.description}_` : "")
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi game Brainrot yang sedang aktif.");
      }
      if (global.db.brainrot[chatId] && ["1", "2", "3", "4"].includes(rawText)) {
        const session = global.db.brainrot[chatId];
        const selectedIndex = parseInt(rawText, 10) - 1;
        const targetChar = session.characters[session.correctIndex];
        if (selectedIndex === session.correctIndex) {
          const duration = ((Date.now() - session.startTime) / 1e3).toFixed(1);
          const senderName = ctx?.pushname || "Pemain";
          const senderJid = ctx?.sender;
          delete global.db.brainrot[chatId];
          if (senderJid) {
            initDB(senderJid, senderName);
            global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 200;
          }
          saveDB();
          const winMessage = `🧠 *TEBAKAN KAMU BENAR!* 🎉\n\n` + `🎭 *Karakter:* *${targetChar.name}*\n` + (targetChar.description ? `📝 *Deskripsi:* _${targetChar.description}_\n` : "") + `⏱️ *Waktu:* ${duration} detik\n` + `🎁 *Hadiah:* +200 EXP`;
          await ctx.react("🎉");
          return await sock.sendMessage(chatId, {
            text: winMessage
          }, {
            quoted: quotedMsg
          });
        } else {
          const chosenChar = session.characters[selectedIndex];
          await ctx.react("❌");
          return await sock.sendMessage(chatId, {
            text: `❌ *Salah!* Bukan *${chosenChar.name}*. Coba lagi!`
          }, {
            quoted: quotedMsg
          });
        }
      }
      if (global.db.brainrot[chatId]) {
        const warningBody = `⚠️ *Masih ada kuis Brainrot yang aktif di chat ini!*\n\n` + `Pilih jawaban 1-4 di menu atau reply pesan soal dengan tebakanmu.`;
        const warningButtons = [{
          name: "quick_reply",
          display_text: "🏳️ Menyerah",
          id: `${prefix}brainrot --nyerah`
        }];
        return await ctx.sendCta(warningBody, `${global.bot?.name || "WudysoftBot"} • Game Sedang Berjalan`, warningButtons, {
          title: "乂 GAME MASIH AKTIF 乂",
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.get(API_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      if (!data || data.error || !data.result?.characters?.length) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat soal kuis Brainrot dari server.");
      }
      const characters = data.result.characters;
      const selection = data.result.selection ?? 0;
      const targetChar = characters[selection] || characters[0];
      const targetImage = cleanMediaUrl(targetChar.image);
      const targetAudio = cleanMediaUrl(targetChar.short_audio);
      const TIMEOUT_SECONDS = 90;
      const choiceRows = characters.map((c, i) => ({
        title: `[${i + 1}] ${c.name}`.slice(0, 24),
        id: `${prefix}brainrot ${i + 1}`,
        description: c.description ? c.description.slice(0, 60) : `Pilih karakter ${c.name}`
      }));
      const listSections = [{
        title: "🧠 PILIH NAMA KARAKTER BRAINROT",
        rows: choiceRows
      }];
      const bodyText = `🧠 *KUIS TEBAK KARAKTER BRAINROT*\n\n` + `Siapakah nama karakter meme Brainrot pada gambar ini?\n\n` + `📋 *Pilihan Karakter:*\n` + characters.map((c, i) => `• *${i + 1}.* ${c.name}`).join("\n") + `\n\n⏱️ *Waktu:* ${TIMEOUT_SECONDS} detik\n\n` + `👉 *Reply pesan soal/audio ini dengan angka 1-4 atau pilih dari menu di bawah!*`;
      const footerText = `${global.bot?.name || "WudysoftBot"} • Reply pesan ini untuk menjawab`;
      const buttons = [{
        name: "single_select",
        title: "🎯 PILIH JAWABAN",
        sections: listSections
      }, {
        name: "quick_reply",
        display_text: "🏳️ Menyerah",
        id: `${prefix}brainrot --nyerah`
      }];
      const imageBuffer = await fetchMediaBuffer(targetImage);
      const sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
        title: "乂 BRAINROT MEME QUIZ 乂",
        subtitle: `Batas Waktu: ${TIMEOUT_SECONDS}s`,
        ...imageBuffer ? {
          media: imageBuffer,
          mediaType: "image"
        } : {},
        quoted: quotedMsg
      });
      const questionMsgId = sentMsg?.key?.id;
      let sentAudioMsg = null;
      if (targetAudio) {
        const audioBuffer = await fetchMediaBuffer(targetAudio);
        if (audioBuffer) {
          sentAudioMsg = await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: "audio/mp4",
            ptt: true
          }, {
            quoted: sentMsg
          });
        }
      }
      global.db.brainrot[chatId] = {
        questionMsgId: questionMsgId,
        audioMsgId: sentAudioMsg?.key?.id || null,
        characters: characters,
        correctIndex: selection,
        startTime: Date.now(),
        expireTime: Date.now() + TIMEOUT_SECONDS * 1e3
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.brainrot[chatId] && Date.now() >= global.db.brainrot[chatId].expireTime) {
          const current = global.db.brainrot[chatId];
          const ans = current.characters[current.correctIndex];
          delete global.db.brainrot[chatId];
          saveDB();
          await sock.sendMessage(chatId, {
            text: `⏰ *Waktu Menjawab Brainrot Habis!*\nJawaban yang benar adalah: *${ans?.name}*`
          });
        }
      }, TIMEOUT_SECONDS * 1e3);
      await ctx.react("🧠");
    } catch (error) {
      console.error("[Brainrot Quiz Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Brainrot Quiz Error: ${errMsg}`);
    }
  }
};