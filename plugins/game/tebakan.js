import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const GAME_TYPES = {
  gambar: {
    name: "Tebak Gambar",
    url: `${global.bot?.api?.wudysoft}/api/game/tebak-gambar`,
    emoji: "🖼️"
  },
  hewan: {
    name: "Tebak Hewan",
    url: `${global.bot?.api?.wudysoft}/api/game/tebak-hewan`,
    emoji: "🦁"
  },
  kabupaten: {
    name: "Tebak Kabupaten",
    url: `${global.bot?.api?.wudysoft}/api/game/tebak-kabupaten`,
    emoji: "🏛️"
  },
  logo: {
    name: "Tebak Logo",
    url: `${global.bot?.api?.wudysoft}/api/game/tebak-logo`,
    emoji: "📱"
  },
  heroml: {
    name: "Tebak Hero MLBB",
    url: `${global.bot?.api?.wudysoft}/api/game/tebak-hero-ml`,
    emoji: "⚔️"
  },
  genshin: {
    name: "Tebak Genshin",
    url: `${global.bot?.api?.wudysoft}/api/game/tebak-hero-genshin`,
    emoji: "✨"
  }
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.tebak) global.db.tebak = {};
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
  name: "tebak",
  aliases: ["tebak-game", "kuis", "game-tebak"],
  description: "Game kuis tebak gambar, hewan, kabupaten, logo aplikasi, hero MLBB, dan Genshin Impact (Full DB)",
  category: "Game",
  limit: true,
  example: "tebak --gambar atau tebak --hewan atau tebak --kabupaten",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.tebak[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.tebak[chatId];
      if (Date.now() > session.expireTime) {
        delete global.db.tebak[chatId];
        saveDB();
        return;
      }
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      if (!quotedStanzaId || quotedStanzaId !== session.questionMsgId) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanUser = normalizeText(userText);
      const cleanAns = normalizeText(session.answer);
      const isCorrect = cleanUser === cleanAns || cleanUser.includes(cleanAns) || cleanAns.includes(cleanUser) && cleanUser.length >= 4;
      if (isCorrect) {
        const duration = ((Date.now() - session.startTime) / 1e3).toFixed(1);
        const senderName = ctx?.pushname || "Pemain";
        const senderJid = ctx?.sender;
        delete global.db.tebak[chatId];
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 250;
        }
        saveDB();
        const winMessage = `–  *C O N G R A T U L A T I O N S*

Selamat, tebakan Anda benar!

┌  ◦  *Player* : ${senderName}
│  ◦  *Game* : ${session.gameName}
│  ◦  *Answer* : ${session.answer}
│  ◦  *Duration* : ${duration}s
└  ◦  *Reward* : +250 EXP

${session.hintMessage ? `_${session.hintMessage}_\n` : ""}`;
        await sock.sendMessage(chatId, {
          text: winMessage.trim()
        }, {
          quoted: msg
        });
        if (typeof ctx?.react === "function") await ctx.react("🎉");
        return true;
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const wrongMessage = `–  *W R O N G*

Jawaban *"${userText}"* salah. Silakan coba tebak lagi.`;
        await sock.sendMessage(chatId, {
          text: wrongMessage
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[TEBAK BEFORE HANDLER ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Mini Games`;
      initDB();
      if (global.db.tebak[chatId]) {
        const session = global.db.tebak[chatId];
        if (rawText.includes("--clue") || rawText.includes("--hint") || rawText.includes("hint")) {
          const hintButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🏳️ Menyerah",
              id: `${prefix}tebak --nyerah`
            })
          }];
          const hintBody = `–  *H I N T*

┌  ◦  *Game* : ${session.gameName}
│  ◦  *Clue* : ${session.clue}
└  ◦  *Desc* : ${session.hintMessage || "Tebak sebelum waktu habis."}`;
          return await ctx.sendCta(hintBody, botFooter, hintButtons, {
            title: `✦ ${session.gameName} • Hint ✦`,
            quoted: quotedMsg
          });
        }
        if (rawText.includes("--nyerah") || rawText.includes("--surrender") || rawText.includes("nyerah")) {
          const gameName = session.gameName;
          const answer = session.answer;
          const hintMessage = session.hintMessage;
          delete global.db.tebak[chatId];
          saveDB();
          const surrenderText = `–  *S U R R E N D E R*

Permainan telah dihentikan.

┌  ◦  *Game* : ${gameName}
│  ◦  *Answer* : ${answer}
└  ◦  *Desc* : ${hintMessage || "-"}`;
          return await sock.sendMessage(chatId, {
            text: surrenderText
          }, {
            quoted: quotedMsg
          });
        }
        const activeWarningBody = `–  *A C T I V E  G A M E*

Masih ada permainan ${session.gameName} yang sedang berlangsung.

┌  ◦  *Clue* : ${session.clue}
└  ◦  *Action* : Reply soal dengan jawabanmu

Gunakan tombol di bawah jika butuh petunjuk atau ingin menyerah.`;
        const activeButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💡 Minta Petunjuk",
            id: `${prefix}tebak --hint`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏳️ Menyerah",
            id: `${prefix}tebak --nyerah`
          })
        }];
        return await ctx.sendCta(activeWarningBody, botFooter, activeButtons, {
          title: `✦ ${session.gameName} ✦`,
          quoted: quotedMsg
        });
      }
      let selectedKey = null;
      if (rawText.includes("--gambar") || rawText.includes("gambar") || rawText.includes("--tebakgambar")) selectedKey = "gambar";
      else if (rawText.includes("--hewan") || rawText.includes("hewan")) selectedKey = "hewan";
      else if (rawText.includes("--kabupaten") || rawText.includes("kabupaten") || rawText.includes("--daerah")) selectedKey = "kabupaten";
      else if (rawText.includes("--logo") || rawText.includes("logo") || rawText.includes("--app")) selectedKey = "logo";
      else if (rawText.includes("--heroml") || rawText.includes("--ml") || rawText.includes("mlbb")) selectedKey = "heroml";
      else if (rawText.includes("--genshin") || rawText.includes("--gi") || rawText.includes("genshin")) selectedKey = "genshin";
      if (!selectedKey) {
        const userName = ctx.pushname || ctx.sender.split("@")[0];
        const categoryRows = Object.keys(GAME_TYPES).map(key => {
          const item = GAME_TYPES[key];
          return {
            title: `${item.emoji} ${item.name}`,
            id: `${prefix}tebak --${key}`,
            description: `Mulai kuis ${item.name}`
          };
        });
        const bodyText = `Hi ${userName}!
Uji wawasan dan ketangkasanmu dalam berbagai pilihan game tebak kuis.

–  *C A T E G O R Y*

┌  ◦  *${prefix}tebak --gambar* : Tebak Gambar
│  ◦  *${prefix}tebak --hewan* : Tebak Hewan
│  ◦  *${prefix}tebak --kabupaten* : Tebak Kabupaten
│  ◦  *${prefix}tebak --logo* : Tebak Logo Aplikasi
│  ◦  *${prefix}tebak --heroml* : Tebak Hero MLBB
└  ◦  *${prefix}tebak --genshin* : Tebak Karakter Genshin

Pilih kategori melalui menu di bawah untuk langsung bermain.`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🎯 PILIH KATEGORI GAME",
            sections: [{
              title: `${botName} • MINI GAMES`,
              rows: categoryRows
            }]
          })
        }];
        return await ctx.sendCta(bodyText, botFooter, buttons, {
          title: `✦ ${botName} • Mini Games ✦`,
          subtitle: "Pilihan Kategori Kuis",
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const gameConfig = GAME_TYPES[selectedKey];
      const {
        data
      } = await axios.get(gameConfig.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4,
        validateStatus: status => status < 500
      });
      if (!data) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat soal kuis dari server. Silakan coba lagi.");
      }
      let question = "";
      let answer = "";
      let clue = "";
      let hintMessage = "";
      let rawImageUrl = "";
      let rawAudioUrl = "";
      if (selectedKey === "gambar") {
        question = `Tebak susunan kata dari gambar berikut (Level #${data.index || "Acak"})`;
        answer = data.jawaban || data.answer || "";
        clue = answer.replace(/[a-zA-Z0-9]/g, "_ ");
        hintMessage = data.deskripsi || data.description || "";
        rawImageUrl = data.img || data.image || "";
      } else if (selectedKey === "genshin") {
        const q = data.quiz || data;
        question = q.question || "Siapakah karakter Genshin Impact ini?";
        answer = q.answer || "";
        clue = q.mark_ans || "";
        hintMessage = q.quote ? `Quote: "${q.quote}"` : q.description || "";
        rawImageUrl = q.image || data.image || "";
      } else {
        question = data.question || "";
        answer = data.answer || "";
        clue = data.hint?.underline || data.clue || "";
        hintMessage = data.hint?.message || data.description || "";
        rawImageUrl = data.image || data.logo || data.portrait_images?.[0] || data.img || data.gambar || "";
        rawAudioUrl = data.quiz?.audio_url || data.hint?.audio || data.audio || "";
      }
      if (!answer) {
        throw new Error("Format jawaban dari API tidak valid.");
      }
      let mediaBuffer = null;
      if (rawImageUrl) {
        mediaBuffer = await fetchMediaBuffer(rawImageUrl);
      }
      const TIMEOUT_SECONDS = 120;
      const gameTitleNeoxr = gameConfig.name.toUpperCase().split("").join(" ");
      const bodyText = `–  *${gameTitleNeoxr}*

┌  ◦  *Question* : ${question}
│  ◦  *Clue* : ${clue || answer.replace(/[a-zA-Z0-9]/g, "_ ")}
│  ◦  *Timeout* : ${TIMEOUT_SECONDS}s
└  ◦  *Reward* : +250 EXP

Balas (reply) pesan ini langsung dengan jawabanmu.`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "💡 Minta Petunjuk",
          id: `${prefix}tebak --hint`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🏳️ Menyerah",
          id: `${prefix}tebak --nyerah`
        })
      }];
      const sentMsg = await ctx.sendCta(bodyText, botFooter, buttons, {
        title: `✦ ${gameConfig.name} ✦`,
        subtitle: `Timeout: ${TIMEOUT_SECONDS}s`,
        ...mediaBuffer ? {
          media: mediaBuffer,
          mediaType: "image"
        } : {},
        quoted: quotedMsg
      });
      const questionMsgId = sentMsg?.key?.id;
      global.db.tebak[chatId] = {
        questionMsgId: questionMsgId,
        gameKey: selectedKey,
        gameName: gameConfig.name,
        answer: answer.trim(),
        clue: clue || answer.replace(/[a-zA-Z0-9]/g, "_ "),
        hintMessage: hintMessage,
        startTime: Date.now(),
        expireTime: Date.now() + TIMEOUT_SECONDS * 1e3
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.tebak[chatId] && Date.now() >= global.db.tebak[chatId].expireTime) {
          const current = global.db.tebak[chatId];
          delete global.db.tebak[chatId];
          saveDB();
          const timeoutMsg = `–  *T I M E  O U T*

Waktu menjawab kuis telah habis.

┌  ◦  *Game* : ${current.gameName}
│  ◦  *Answer* : ${current.answer}
└  ◦  *Desc* : ${current.hintMessage || "-"}`;
          await sock.sendMessage(chatId, {
            text: timeoutMsg
          });
        }
      }, TIMEOUT_SECONDS * 1e3);
      if (rawAudioUrl) {
        const audioBuffer = await fetchMediaBuffer(rawAudioUrl);
        if (audioBuffer) {
          await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: "audio/mp4",
            ptt: true
          }, {
            quoted: sentMsg
          });
        }
      }
      await ctx.react("🎯");
    } catch (error) {
      console.error("[Tebak Execute Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Tebak Game Error: ${errMsg}`);
    }
  }
};