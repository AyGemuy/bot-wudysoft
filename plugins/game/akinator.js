import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/akinator/v1`;
const AKINATOR_AVATAR = "https://en.akinator.com/bundles/elokencesite/images/akitude_defaut.png";

function initDB(chatId = null) {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.akinator) global.db.akinator = {};
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
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

function getAnswerId(input) {
  const text = String(input || "").trim().toLowerCase();
  if (["0", "iya", "ya", "yes", "y"].includes(text)) return "0";
  if (["1", "tidak", "bukan", "no", "t", "ga", "gak"].includes(text)) return "1";
  if (["2", "tidak tahu", "tidak tau", "gatau", "gatahu", "dont know", "unknown"].includes(text)) return "2";
  if (["3", "mungkin", "bisa jadi", "probably"].includes(text)) return "3";
  if (["4", "mungkin tidak", "kayaknya bukan", "probably not"].includes(text)) return "4";
  return null;
}
async function sendAkinatorQuestion(sock, ctx, chatId, session, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const botFooter = global.bot?.footer || `${botName} • Mini Games`;
  const choices = session.choices && session.choices.length > 0 ? session.choices : [{
    id: "0",
    text: "Iya"
  }, {
    id: "1",
    text: "Tidak"
  }, {
    id: "2",
    text: "Tidak tahu"
  }, {
    id: "3",
    text: "Mungkin"
  }, {
    id: "4",
    text: "Mungkin tidak"
  }];
  const choiceRows = choices.map(c => ({
    title: `[ ${c.id} ] ${c.text}`,
    id: `${prefix}akinator ${c.id}`,
    description: `Pilih opsi [${c.id}] : ${c.text}`
  }));
  const progressPercent = Math.min(Math.round(parseFloat(session.progression || 0)), 100);
  const choiceText = choices.map((c, idx) => {
    const isLast = idx === choices.length - 1;
    const branch = isLast ? "└" : "│";
    return `${branch}  ◦  *${c.id}.* ${c.text}`;
  }).join("\n");
  const bodyText = `–  *A K I N A T O R*

Pikirkan satu karakter/tokoh, dan jawab pertanyaan berikut.

–  *Q U E S T I O N*

┌  ◦  *Step* : #${(session.step || 0) + 1}
│  ◦  *Progress* : ${progressPercent}%
└  ◦  *Question* : ${session.question}

–  *O P T I O N S*

${choiceText}

Balas (reply) pesan ini dengan angka 0-4 atau gunakan tombol di bawah.`;
  const footerText = `${botFooter}`;
  const buttons = [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: "🔮 PILIH JAWABAN",
      sections: [{
        title: `Pertanyaan #${(session.step || 0) + 1}`,
        rows: choiceRows
      }]
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "👍 Iya",
      id: `${prefix}akinator 0`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "👎 Tidak",
      id: `${prefix}akinator 1`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🚪 Akhiri",
      id: `${prefix}akinator --end`
    })
  }];
  const avatarBuffer = await fetchMediaBuffer(AKINATOR_AVATAR);
  let sentMsg = null;
  if (typeof ctx?.sendCta === "function") {
    sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
      title: `✦ Akinator Genie • #${(session.step || 0) + 1} ✦`,
      subtitle: `Progress: ${progressPercent}%`,
      ...avatarBuffer ? {
        media: avatarBuffer,
        mediaType: "image"
      } : {},
      quoted: quotedMsg
    });
  } else {
    sentMsg = await sock.sendMessage(chatId, {
      text: bodyText
    }, {
      quoted: quotedMsg
    });
  }
  if (sentMsg?.key?.id) {
    session.questionMsgId = sentMsg.key.id;
    session.questionMsgKey = sentMsg.key;
    saveDB();
  }
  return sentMsg;
}
export default {
  name: "akinator",
  aliases: ["aki", "tebakkarakter", "genie"],
  description: "Akinator Jin Jenius yang dapat menebak karakter/tokoh yang Anda pikirkan (Full DB)",
  category: "Game",
  limit: true,
  example: "akinator atau akinator 0 (untuk menjawab)",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.akinator[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.akinator[chatId];
      if (Date.now() > session.expireTime) {
        delete global.db.akinator[chatId];
        saveDB();
        return;
      }
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      if (!quotedStanzaId || quotedStanzaId !== session.questionMsgId) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (userText.startsWith(`${ctx?.prefix || "."}akinator`)) return;
      const choiceId = getAnswerId(userText);
      if (choiceId === null) {
        if (typeof ctx?.react === "function") await ctx.react("❓");
        const invalidText = `–  *I N V A L I D*

Pilihan tidak valid. Ketik angka 0 sampai 4 (atau: ya, tidak, tidak tahu, mungkin, mungkin tidak).`;
        await sock.sendMessage(chatId, {
          text: invalidText
        }, {
          quoted: msg
        });
        return true;
      }
      if (typeof ctx?.react === "function") await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        action: "step",
        id: session.id,
        answer: choiceId
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      if (data?.finished === true) {
        delete global.db.akinator[chatId];
        saveDB();
        const charName = data.name_proposition || "Karakter Tidak Diketahui";
        const charDesc = data.description_proposition || "-";
        const charPhoto = data.photo || "";
        const winMessage = `–  *A K I N A T O R*

Akinator telah menebak karakter yang Anda pikirkan!

–  *C H A R A C T E R*

┌  ◦  *Name* : ${charName}
│  ◦  *Desc* : ${charDesc}
└  ◦  *Steps* : ${data.step || session.step} Pertanyaan

Apakah tebakan Akinator tepat sasaran?`;
        const photoBuffer = await fetchMediaBuffer(charPhoto);
        if (photoBuffer) {
          await sock.sendMessage(chatId, {
            image: photoBuffer,
            caption: winMessage
          }, {
            quoted: msg
          });
        } else {
          await sock.sendMessage(chatId, {
            text: winMessage
          }, {
            quoted: msg
          });
        }
        if (typeof ctx?.react === "function") await ctx.react("🧞‍♂️");
        return true;
      }
      if (data?.question) {
        session.step = data.step;
        session.question = data.question;
        session.progression = data.progression;
        session.choices = data.choices || session.choices;
        session.expireTime = Date.now() + 180 * 1e3;
        saveDB();
        setTimeout(async () => {
          initDB();
          if (global.db.akinator[chatId] && Date.now() >= global.db.akinator[chatId].expireTime) {
            delete global.db.akinator[chatId];
            saveDB();
            const timeoutText = `–  *T I M E  O U T*

Waktu bermain Akinator telah habis karena tidak ada respon.`;
            await sock.sendMessage(chatId, {
              text: timeoutText
            });
          }
        }, 180 * 1e3);
        await sendAkinatorQuestion(sock, ctx, chatId, session, msg, ctx?.prefix || ".");
        if (typeof ctx?.react === "function") await ctx.react("✨");
        return true;
      }
    } catch (e) {
      console.error("[AKINATOR BEFORE ERROR]:", e.message);
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
      if (rawText.includes("--end") || rawText.includes("--batal") || rawText.includes("--reset") || rawText.includes("nyerah") || rawText.includes("stop")) {
        if (global.db.akinator[chatId]) {
          delete global.db.akinator[chatId];
          saveDB();
          const surrenderMsg = `–  *S U R R E N D E R*

Permainan Akinator telah dihentikan.`;
          return await sock.sendMessage(chatId, {
            text: surrenderMsg
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi permainan Akinator yang sedang aktif.");
      }
      const choiceId = getAnswerId(rawText);
      if (global.db.akinator[chatId] && choiceId !== null) {
        await ctx.react("⏳");
        const session = global.db.akinator[chatId];
        const {
          data
        } = await axios.post(API_URL, {
          action: "step",
          id: session.id,
          answer: choiceId
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 3e4
        });
        if (data?.finished === true) {
          delete global.db.akinator[chatId];
          saveDB();
          const charName = data.name_proposition || "Karakter";
          const charDesc = data.description_proposition || "-";
          const charPhoto = data.photo || "";
          const winMessage = `–  *A K I N A T O R*

Akinator telah menebak karakter yang Anda pikirkan!

–  *C H A R A C T E R*

┌  ◦  *Name* : ${charName}
│  ◦  *Desc* : ${charDesc}
└  ◦  *Steps* : ${data.step || session.step} Pertanyaan

Apakah tebakan Akinator tepat sasaran?`;
          const photoBuffer = await fetchMediaBuffer(charPhoto);
          if (photoBuffer) {
            await sock.sendMessage(chatId, {
              image: photoBuffer,
              caption: winMessage
            }, {
              quoted: quotedMsg
            });
          } else {
            await sock.sendMessage(chatId, {
              text: winMessage
            }, {
              quoted: quotedMsg
            });
          }
          await ctx.react("🎉");
          return;
        }
        if (data?.question) {
          session.step = data.step;
          session.question = data.question;
          session.progression = data.progression;
          session.choices = data.choices || session.choices;
          session.expireTime = Date.now() + 180 * 1e3;
          saveDB();
          setTimeout(async () => {
            initDB();
            if (global.db.akinator[chatId] && Date.now() >= global.db.akinator[chatId].expireTime) {
              delete global.db.akinator[chatId];
              saveDB();
              const timeoutText = `–  *T I M E  O U T*

Waktu bermain Akinator telah habis karena tidak ada respon.`;
              await sock.sendMessage(chatId, {
                text: timeoutText
              });
            }
          }, 180 * 1e3);
          await sendAkinatorQuestion(sock, ctx, chatId, session, quotedMsg, prefix);
          await ctx.react("✅");
          return;
        }
      }
      if (global.db.akinator[chatId]) {
        const session = global.db.akinator[chatId];
        const warningBody = `–  *A C T I V E  G A M E*

Masih ada sesi Akinator yang sedang berlangsung.

┌  ◦  *Step* : #${(session.step || 0) + 1}
└  ◦  *Question* : ${session.question}

Balas (reply) pesan soal dengan angka 0-4 atau gunakan tombol di bawah.`;
        const warningButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "👍 Iya",
            id: `${prefix}akinator 0`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "👎 Tidak",
            id: `${prefix}akinator 1`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Akhiri Game",
            id: `${prefix}akinator --end`
          })
        }];
        return await ctx.sendCta(warningBody, botFooter, warningButtons, {
          title: `✦ Akinator Active • #${(session.step || 0) + 1} ✦`,
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        action: "start"
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      if (!data?.id || !data?.question) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memulai sesi Akinator dari server. Silakan coba lagi.");
      }
      const TIMEOUT_SECONDS = 180;
      global.db.akinator[chatId] = {
        id: data.id,
        step: data.step || 0,
        question: data.question,
        progression: data.progression || 0,
        choices: data.choices || [],
        questionMsgId: null,
        questionMsgKey: null,
        expireTime: Date.now() + TIMEOUT_SECONDS * 1e3
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.akinator[chatId] && Date.now() >= global.db.akinator[chatId].expireTime) {
          delete global.db.akinator[chatId];
          saveDB();
          const timeoutText = `–  *T I M E  O U T*

Waktu bermain Akinator telah habis karena tidak ada aktivitas.`;
          await sock.sendMessage(chatId, {
            text: timeoutText
          });
        }
      }, TIMEOUT_SECONDS * 1e3);
      await sendAkinatorQuestion(sock, ctx, chatId, global.db.akinator[chatId], quotedMsg, prefix);
      await ctx.react("🧞‍♂️");
    } catch (error) {
      console.error("[Akinator Execute Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Akinator Error: ${errMsg}`);
    }
  }
};