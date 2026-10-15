import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/cak-lontong`;

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.caklontong) global.db.caklontong = {};
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

function generateClue(answer) {
  const chars = answer.trim().split("");
  return chars.map((c, i) => {
    if (c === " ") return "   ";
    if (i === 0 || i === chars.length - 1) return `*${c.toUpperCase()}*`;
    return "•";
  }).join(" ");
}
async function sendCaklontongMessage(sock, ctx, chatId, session, textContent, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const buttons = [{
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "💡 Bantuan Clue",
      id: `${prefix}caklontong --clue`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏳️ Menyerah",
      id: `${prefix}caklontong --nyerah`
    })
  }];
  const options = {
    jid: chatId,
    to: chatId,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Kuis Cak Lontong`,
        button_title: "Menu Bantuan"
      }
    },
    contextInfo: {
      forwardingScore: 0,
      isForwarded: false
    },
    quoted: quotedMsg || undefined
  };
  let sentMsg = null;
  if (typeof ctx?.sendCta === "function" && chatId === ctx.id) {
    try {
      sentMsg = await ctx.sendCta(textContent, footerText, buttons, options);
    } catch (e) {
      console.error("[Cak Lontong sendCta Error]:", e.message);
    }
  }
  if (!sentMsg) {
    try {
      sentMsg = await sock.sendMessage(chatId, {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: {
                text: textContent
              },
              footer: {
                text: footerText
              },
              nativeFlowMessage: {
                buttons: buttons
              },
              contextInfo: options.contextInfo
            }
          }
        }
      }, {
        quoted: quotedMsg
      });
    } catch (e) {}
  }
  if (!sentMsg) {
    sentMsg = await sock.sendMessage(chatId, {
      text: `${textContent}\n\n_${footerText}_`
    }, {
      quoted: quotedMsg
    });
  }
  if (sentMsg?.key?.id) {
    if (!Array.isArray(session.msgIds)) session.msgIds = [];
    if (!session.msgIds.includes(sentMsg.key.id)) {
      session.msgIds.push(sentMsg.key.id);
    }
    session.questionMsgId = sentMsg.key.id;
    saveDB();
  }
  return sentMsg;
}
export default {
  name: "caklontong",
  aliases: ["caklon", "lontong"],
  description: "Game teka-teki logika nyeleneh ala Cak Lontong dengan hadiah DB (Full DB)",
  category: "Game",
  limit: true,
  example: "caklontong",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.caklontong[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.caklontong[chatId];
      if (Date.now() > session.expireTime) {
        delete global.db.caklontong[chatId];
        saveDB();
        return;
      }
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingGame = quotedStanzaId && (quotedStanzaId === session.questionMsgId || Array.isArray(session.msgIds) && session.msgIds.includes(quotedStanzaId));
      if (!isQuotingGame) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanUser = normalizeText(userText);
      const cleanAnswer = normalizeText(session.jawaban);
      if (!cleanUser) return;
      if (cleanUser === cleanAnswer) {
        delete global.db.caklontong[chatId];
        const senderJid = ctx?.sender || msg?.key?.participant;
        const senderName = ctx?.pushName || ctx?.pushname || "Pemain Cerdas";
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].money = (Number(global.db.user[senderJid].money) || 0) + 4e3;
          global.db.user[senderJid].exp = (Number(global.db.user[senderJid].exp) || 0) + 120;
        }
        saveDB();
        const winText = `–  *C O N G R A T U L A T I O N S*

Tebakan logika Anda benar!

┌  ◦  *Player* : @${senderJid.split("@")[0]}
│  ◦  *Question* : ${session.soal}
│  ◦  *Answer* : ${session.jawaban.toUpperCase()}
└  ◦  *Reward* : +Rp 4.000 | +120 EXP

–  *E X P L A N A T I O N*

"${session.deskripsi}"`;
        if (typeof ctx?.react === "function") await ctx.react("🎉");
        await sock.sendMessage(chatId, {
          text: winText,
          mentions: [senderJid]
        }, {
          quoted: msg
        });
        return true;
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const wrongText = `–  *W R O N G*

Jawaban *"${userText}"* salah. Gunakan logika nyeleneh Cak Lontong!`;
        await sock.sendMessage(chatId, {
          text: wrongText
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[CAK LONTONG BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ Fitur Kuis Cak Lontong hanya dapat dimainkan di dalam Grup.");
      }
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      initDB();
      if (rawText.includes("nyerah") || rawText.includes("surrender") || rawText.includes("end") || rawText.includes("batal")) {
        if (global.db.caklontong[chatId]) {
          const session = global.db.caklontong[chatId];
          delete global.db.caklontong[chatId];
          saveDB();
          const surrenderText = `–  *S U R R E N D E R*

Permainan telah dihentikan.

┌  ◦  *Question* : ${session.soal}
└  ◦  *Answer* : ${session.jawaban.toUpperCase()}

–  *E X P L A N A T I O N*

"${session.deskripsi}"`;
          return await sock.sendMessage(chatId, {
            text: surrenderText
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi kuis Cak Lontong yang sedang aktif.");
      }
      if (rawText.includes("clue") || rawText.includes("bantuan") || rawText.includes("hint")) {
        if (!global.db.caklontong[chatId]) {
          return ctx.reply(`❌ Tidak ada game aktif. Mulai game baru dengan mengetik *${prefix}caklontong*`);
        }
        const session = global.db.caklontong[chatId];
        const clueText = generateClue(session.jawaban);
        const clueMsg = `–  *H I N T*

┌  ◦  *Question* : ${session.soal}
└  ◦  *Clue* : [ ${clueText} ] (${session.jawaban.length} Karakter)

Balas (reply) pesan ini langsung untuk menebak.`;
        return await sendCaklontongMessage(sock, ctx, chatId, session, clueMsg, quotedMsg, prefix);
      }
      if (global.db.caklontong[chatId]) {
        const session = global.db.caklontong[chatId];
        const clueText = generateClue(session.jawaban);
        const activeMsg = `–  *A C T I V E  G A M E*

Masih ada pertanyaan Cak Lontong yang sedang berlangsung.

┌  ◦  *Question* : ${session.soal}
└  ◦  *Clue* : [ ${clueText} ] (${session.jawaban.length} Karakter)

Balas (reply) pesan ini langsung untuk menjawab.`;
        return await sendCaklontongMessage(sock, ctx, chatId, session, activeMsg, quotedMsg, prefix);
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
      if (!data || !data.soal || !data.jawaban) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat kuis Cak Lontong dari server. Silakan coba lagi.");
      }
      const TIMEOUT_SECONDS = 120;
      global.db.caklontong[chatId] = {
        index: data.index,
        soal: data.soal,
        jawaban: String(data.jawaban).trim(),
        deskripsi: data.deskripsi || "Tidak ada alasan.",
        msgIds: [],
        questionMsgId: null,
        startTime: Date.now(),
        expireTime: Date.now() + TIMEOUT_SECONDS * 1e3
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.caklontong[chatId] && Date.now() >= global.db.caklontong[chatId].expireTime) {
          const activeSession = global.db.caklontong[chatId];
          delete global.db.caklontong[chatId];
          saveDB();
          const timeoutText = `–  *T I M E  O U T*

Waktu menjawab kuis telah habis.

┌  ◦  *Question* : ${activeSession.soal}
└  ◦  *Answer* : ${activeSession.jawaban.toUpperCase()}

–  *E X P L A N A T I O N*

"${activeSession.deskripsi}"`;
          await sock.sendMessage(chatId, {
            text: timeoutText
          });
        }
      }, TIMEOUT_SECONDS * 1e3);
      const clueText = generateClue(global.db.caklontong[chatId].jawaban);
      const questionMsg = `–  *C A K  L O N T O N G*

Gunakan logika nyeleneh untuk memecahkan teka-teki berikut.

–  *Q U E S T I O N*

${global.db.caklontong[chatId].soal}

–  *I N F O*

┌  ◦  *Clue* : [ ${clueText} ] (${global.db.caklontong[chatId].jawaban.length} Karakter)
│  ◦  *Timeout* : ${TIMEOUT_SECONDS}s
└  ◦  *Reward* : +Rp 4.000 | +120 EXP

Balas (reply) pesan ini langsung dengan jawabanmu.`;
      await sendCaklontongMessage(sock, ctx, chatId, global.db.caklontong[chatId], questionMsg, quotedMsg, prefix);
      await ctx.react("🤔");
    } catch (error) {
      console.error("[Cak Lontong Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Cak Lontong Error: ${errMsg}`);
    }
  }
};