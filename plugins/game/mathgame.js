import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const MAP_BG_URL = "https://i.pinimg.com/originals/51/06/e6/5106e6ba1ea65882f09d64b2212c91bf.jpg";
const BLUE_TILES = [6, 13, 20, 25, 34, 38];
const RED_TILES = [2, 12, 23, 26, 40, 43];
const TILE_COORDS = {
  1: {
    x: 13.5,
    y: 42.5
  },
  2: {
    x: 13.5,
    y: 48.5
  },
  3: {
    x: 15.5,
    y: 54
  },
  4: {
    x: 21,
    y: 55.5
  },
  5: {
    x: 25.5,
    y: 52.5
  },
  6: {
    x: 28.5,
    y: 46.5
  },
  7: {
    x: 29.5,
    y: 40.5
  },
  8: {
    x: 34,
    y: 36.5
  },
  9: {
    x: 39.5,
    y: 36.5
  },
  10: {
    x: 44.5,
    y: 40
  },
  11: {
    x: 46,
    y: 46
  },
  12: {
    x: 44.5,
    y: 52
  },
  13: {
    x: 40.5,
    y: 56.5
  },
  14: {
    x: 36.5,
    y: 60.5
  },
  15: {
    x: 32,
    y: 64
  },
  16: {
    x: 27.5,
    y: 68
  },
  17: {
    x: 23.5,
    y: 72.5
  },
  18: {
    x: 21.5,
    y: 77.5
  },
  19: {
    x: 23.5,
    y: 83
  },
  20: {
    x: 29.5,
    y: 85.5
  },
  21: {
    x: 35.5,
    y: 87
  },
  22: {
    x: 41.5,
    y: 87
  },
  23: {
    x: 47.5,
    y: 85.5
  },
  24: {
    x: 52.5,
    y: 82.5
  },
  25: {
    x: 56.5,
    y: 78
  },
  26: {
    x: 59,
    y: 72.5
  },
  27: {
    x: 59,
    y: 66.5
  },
  28: {
    x: 59,
    y: 61
  },
  29: {
    x: 58.5,
    y: 55
  },
  30: {
    x: 58.5,
    y: 49.5
  },
  31: {
    x: 60,
    y: 43.5
  },
  32: {
    x: 63.5,
    y: 38.5
  },
  33: {
    x: 68.5,
    y: 35.5
  },
  34: {
    x: 74.5,
    y: 36.5
  },
  35: {
    x: 79.5,
    y: 39.5
  },
  36: {
    x: 82.5,
    y: 45
  },
  37: {
    x: 82.5,
    y: 50.5
  },
  38: {
    x: 83,
    y: 56.5
  },
  39: {
    x: 82,
    y: 62.5
  },
  40: {
    x: 79.5,
    y: 68
  },
  41: {
    x: 76.5,
    y: 73.5
  },
  42: {
    x: 74,
    y: 79
  },
  43: {
    x: 77.5,
    y: 83.5
  },
  44: {
    x: 83,
    y: 84.5
  },
  45: {
    x: 89,
    y: 80
  },
  46: {
    x: 91,
    y: 74.5
  }
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.mathAdventure) global.db.mathAdventure = {};
  if (jid && !jid.includes("BOT") && !global.db.user[jid]) {
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

function clearSession(chatId) {
  if (global.db?.mathAdventure?.[chatId]) {
    delete global.db.mathAdventure[chatId];
    saveDB();
  }
}

function getTileCategory(tileNumber) {
  if (BLUE_TILES.includes(tileNumber)) {
    return {
      level: "easy",
      name: "MUDAH (BIRU)",
      color: "#00b4d8",
      bonus: 2500,
      exp: 80
    };
  }
  if (RED_TILES.includes(tileNumber)) {
    return {
      level: "hard",
      name: "SUSAH (MERAH)",
      color: "#ef233c",
      bonus: 7e3,
      exp: 200
    };
  }
  return {
    level: "medium",
    name: "NORMAL (COKLAT/KUNING)",
    color: "#f77f00",
    bonus: 4e3,
    exp: 120
  };
}

function generateLocalQuestion(level) {
  const ops = level === "easy" ? ["+", "-"] : level === "hard" ? ["*", "+", "-"] : ["+", "-", "*"];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, res;
  if (level === "easy") {
    a = Math.floor(Math.random() * 40) + 10;
    b = Math.floor(Math.random() * 30) + 5;
    res = op === "+" ? a + b : a - b;
  } else if (level === "hard") {
    a = Math.floor(Math.random() * 25) + 6;
    b = Math.floor(Math.random() * 12) + 4;
    const c = Math.floor(Math.random() * 30) + 5;
    res = a * b + c;
    return {
      str: `${a} × ${b} + ${c}`,
      result: res
    };
  } else {
    a = Math.floor(Math.random() * 15) + 3;
    b = Math.floor(Math.random() * 12) + 2;
    res = a * b;
    return {
      str: `${a} × ${b}`,
      result: res
    };
  }
  return {
    str: `${a} ${op === "*" ? "×" : op} ${b}`,
    result: res
  };
}
async function sendCTA(sock, ctx, targetId, {
  text,
  footer,
  buttons = [],
  image = null,
  quoted = null,
  mentions = []
}) {
  const botName = global.bot?.name || "WudysoftBot";
  const finalFooter = footer || `${botName} • Math Adventure`;
  const formattedButtons = buttons.map(b => {
    if (b.buttonParamsJson) return b;
    if (b.name === "cta_url") {
      return {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: b.display_text || b.text || "Buka Tautan",
          url: b.url || ""
        })
      };
    }
    if (b.type === "list" || b.name === "single_select") {
      return {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: b.title || "PILIHAN",
          sections: b.sections || []
        })
      };
    }
    return {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: b.display_text || b.text || "Klik",
        id: b.id || b.command || ""
      })
    };
  });
  const destJid = targetId || ctx?.id;
  const options = {
    jid: destJid,
    to: destJid,
    image: image || undefined,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Ekspedisi Matematika`,
        button_title: "Menu Opsi"
      }
    },
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      mentionedJid: mentions || []
    },
    quoted: quoted || undefined
  };
  return await ctx.sendCta(text, finalFooter, formattedButtons, options);
}

function generateAdventureBoardHTML(currentTile, lastSolverName = "", lastMoveText = "") {
  const pos = TILE_COORDS[currentTile] || TILE_COORDS[1];
  const cat = getTileCategory(currentTile);
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 980px;
      height: auto;
      background: #08121e;
      font-family: 'Segoe UI', Roboto, sans-serif;
      color: #fff;
    }
    .wrapper {
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: radial-gradient(circle at 50% 10%, #1e3a5f 0%, #08121e 100%);
    }
    .header-bar {
      width: 860px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding: 14px 24px;
      background: rgba(13, 27, 42, 0.85);
      border: 2px solid #f39c12;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    }
    .title {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #f1c40f;
      text-shadow: 0 0 10px rgba(241, 196, 15, 0.5);
    }
    .stage-badge {
      font-size: 15px;
      font-weight: 800;
      background: #112233;
      border: 2px solid ${cat.color};
      padding: 6px 16px;
      border-radius: 12px;
      color: ${cat.color};
      box-shadow: 0 0 12px ${cat.color}66;
    }

    .map-container {
      width: 860px;
      height: 860px;
      position: relative;
      border: 10px solid #2c3e50;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 15px 40px rgba(0,0,0,0.85);
      background-image: url('${MAP_BG_URL}');
      background-size: 100% 100%;
      background-repeat: no-repeat;
    }

    .pirate-pawn {
      position: absolute;
      top: ${pos.y}%;
      left: ${pos.x}%;
      transform: translate(-50%, -85%);
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 20;
      transition: all 0.4s ease;
    }
    .tile-tag {
      background: #111;
      color: #f1c40f;
      border: 2px solid #f39c12;
      font-size: 12px;
      font-weight: 900;
      padding: 2px 8px;
      border-radius: 8px;
      box-shadow: 0 3px 8px rgba(0,0,0,0.8);
      margin-bottom: 2px;
      white-space: nowrap;
    }
    .among-pirate {
      width: 36px;
      height: 46px;
      background: #e74c3c;
      border-radius: 16px 16px 6px 6px;
      border: 2.5px solid #111;
      position: relative;
      box-shadow: 0 6px 12px rgba(0,0,0,0.8), inset -3px -3px 0 #c0392b;
    }
    .pirate-hat {
      position: absolute;
      top: -12px;
      left: -8px;
      width: 48px;
      height: 18px;
      background: #111;
      border-radius: 14px 14px 2px 2px;
      border: 2px solid #f39c12;
      box-shadow: 0 2px 5px rgba(0,0,0,0.5);
    }
    .pirate-skull {
      position: absolute;
      top: 2px;
      left: 17px;
      width: 8px;
      height: 8px;
      background: #fff;
      border-radius: 50%;
    }
    .pirate-visor {
      position: absolute;
      top: 9px;
      left: 5px;
      width: 18px;
      height: 12px;
      background: #81ecec;
      border-radius: 6px;
      border: 2px solid #111;
      box-shadow: inset 1.5px 1.5px 0 #fff;
    }
    .pirate-legs {
      position: absolute;
      bottom: -6px;
      left: 3px;
      width: 25px;
      display: flex;
      justify-content: space-between;
    }
    .leg {
      width: 9px;
      height: 7px;
      background: #c0392b;
      border: 1.5px solid #111;
      border-top: none;
      border-radius: 0 0 3px 3px;
    }

    .info-box {
      width: 860px;
      text-align: center;
      margin-top: 16px;
      font-size: 14px;
      font-weight: 700;
      color: #ecf0f1;
      background: rgba(13, 27, 42, 0.85);
      padding: 12px 20px;
      border-radius: 12px;
      border-left: 5px solid #f39c12;
      box-shadow: 0 4px 15px rgba(0,0,0,0.4);
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header-bar">
      <div class="title">🏴‍☠️ MATH ADVENTURE ARENA 🏴‍☠️</div>
      <div class="stage-badge">Kotak ${currentTile}/46 • ${cat.name}</div>
    </div>

    <div class="map-container">
      <div class="pirate-pawn">
        <div class="tile-tag">📍 Kotak ${currentTile}</div>
        <div class="among-pirate">
          <div class="pirate-hat"><div class="pirate-skull"></div></div>
          <div class="pirate-visor"></div>
          <div class="pirate-legs">
            <div class="leg"></div>
            <div class="leg"></div>
          </div>
        </div>
      </div>
    </div>

    ${lastMoveText ? `<div class="info-box">📢 ${lastMoveText}</div>` : ""}
  </div>
</body>
</html>`;
}
async function renderHtmlToImage(htmlContent) {
  const rawApi = global.bot?.api?.wudysoft || "";
  const cleanApi = rawApi.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const baseUrl = `https://${cleanApi}/api/tools/html2img/`;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
  };
  const payload = {
    html: htmlContent,
    fullPage: true,
    quality: 100
  };
  const versions = ["v5", "v1", "v2", "v3", "v4", "v6", "v7", "v8", "v9", "v10"];
  for (const ver of versions) {
    try {
      const res = await axios.post(`${baseUrl}${ver}`, payload, {
        headers: headers,
        timeout: 15e3
      });
      const imgUrl = res.data?.url || res.data?.result || (typeof res.data === "string" ? res.data : null);
      if (imgUrl && /^https?:\/\//i.test(imgUrl)) {
        let buffer = null;
        try {
          const imgRes = await axios.get(imgUrl, {
            responseType: "arraybuffer",
            timeout: 12e3
          });
          if (imgRes.data) buffer = Buffer.from(imgRes.data);
        } catch {}
        return {
          url: imgUrl,
          buffer: buffer
        };
      }
    } catch {
      continue;
    }
  }
  return {
    url: null,
    buffer: null
  };
}
async function generateAndSendNextQuestion(sock, ctx, chatId, session, extraNote = "", mentions = []) {
  const currentTile = session.position || 1;
  const cat = getTileCategory(currentTile);
  const prefix = ctx?.prefix || ".";
  let questionStr = "";
  let questionResult = null;
  try {
    const apiLevel = cat.level === "hard" ? "hard" : cat.level === "easy" ? "easy" : "medium";
    const requestUrl = `${global.bot?.api?.wudysoft}/api/game/math?level=${encodeURIComponent(apiLevel)}`;
    const {
      data
    } = await axios.get(requestUrl, {
      timeout: 1e4
    });
    if (data?.str !== undefined && data?.result !== undefined) {
      questionStr = String(data.str).trim();
      questionResult = Number(data.result);
    }
  } catch {}
  if (!questionStr || questionResult === null) {
    const local = generateLocalQuestion(cat.level);
    questionStr = local.str;
    questionResult = local.result;
  }
  session.str = questionStr;
  session.result = questionResult;
  session.currentCategory = cat;
  session.expireTime = Date.now() + 6e4;
  saveDB();
  const html = generateAdventureBoardHTML(currentTile, session.lastSolver || "", extraNote);
  const {
    buffer: imgBuffer
  } = await renderHtmlToImage(html);
  let text = `🗺️ *PETUALANGAN MATEMATIKA BAJAK LAUT*\n\n`;
  if (extraNote) text += `📢 ${extraNote}\n\n`;
  text += `📍 *Posisi:* Kotak *${currentTile} / 46*\n`;
  text += `🎨 *Tipe Kotak:* ${cat.name}\n`;
  text += `🎯 *Soal:* 👉 *${questionStr} = ?*\n\n`;
  text += `⏳ *Waktu:* 60 Detik\n`;
  text += `🎁 *Hadiah Soal:* +Rp ${cat.bonus.toLocaleString("id-ID")} & +${cat.exp} EXP\n`;
  text += `🏆 *Hadiah Tamat (Kotak 46):* Paket Lengkap Emas (+Rp 100.000 & +2.500 EXP)!\n\n`;
  text += `👉 *Reply (balas) pesan ini langsung dengan jawabanmu!*`;
  const buttons = [{
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🔄 Perbarui Peta",
      id: `${prefix}mathgame board`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏳️ Nyerah / Reset",
      id: `${prefix}mathgame reset`
    })
  }];
  const sentMsg = await sendCTA(sock, ctx, chatId, {
    text: text,
    buttons: buttons,
    image: imgBuffer,
    mentions: mentions || []
  });
  if (sentMsg?.key?.id) {
    session.questionMsgId = sentMsg.key.id;
    saveDB();
  }
}
export default {
  name: "mathgame",
  aliases: ["gamemath", "kuismath", "mathadventure", "math"],
  description: "Petualangan Matematika Peta Bajak Laut 46 Kotak dengan Visual Dinamis & Hadiah Tamat",
  category: "Game",
  limit: true,
  example: ".mathgame",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !global.db?.mathAdventure?.[chatId]) return;
      const session = global.db.mathAdventure[chatId];
      if (Date.now() > session.expireTime) return;
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      if (session.questionMsgId && quotedStanzaId !== session.questionMsgId) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanInput = userText.replace(/,/g, ".").trim();
      const userNumber = Number(cleanInput);
      if (isNaN(userNumber)) return;
      const isCorrect = Math.abs(userNumber - Number(session.result)) < .01;
      const senderJid = ctx?.sender || msg?.key?.participant;
      const senderName = ctx?.pushName || ctx?.pushname || "Petualang";
      if (isCorrect) {
        initDB(senderJid, senderName);
        const cat = session.currentCategory || getTileCategory(session.position);
        global.db.user[senderJid].money = (Number(global.db.user[senderJid].money) || 0) + cat.bonus;
        global.db.user[senderJid].exp = (Number(global.db.user[senderJid].exp) || 0) + cat.exp;
        session.lastSolver = senderName;
        session.position = (session.position || 1) + 1;
        if (typeof ctx?.react === "function") await ctx.react("🎉");
        if (session.position >= 46) {
          clearSession(chatId);
          const grandMoney = 1e5;
          const grandExp = 2500;
          global.db.user[senderJid].money += grandMoney;
          global.db.user[senderJid].exp += grandExp;
          saveDB();
          const winButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🏴‍☠️ Mulai Ekspedisi Baru",
              id: `${ctx?.prefix || "."}mathgame`
            })
          }];
          return await sendCTA(sock, ctx, chatId, {
            text: `👑 *EKSPEDISI TAMAT! HARTA KARUN DITEMUKAN!* 👑\n\nSelamat kepada @${senderJid.split("@")[0]} yang telah membawa kapal ke kotak 46 (Peti Emas)!\n\n🎁 *PAKET LENGKAP JUARA:*\n• +Rp ${grandMoney.toLocaleString("id-ID")} Money\n• +${grandExp} EXP\n\n_Peta telah direset untuk ekspedisi selanjutnya!_`,
            buttons: winButtons,
            mentions: [senderJid]
          });
        }
        saveDB();
        const note = `Benar! @${senderJid.split("@")[0]} menjawab *${session.result}* (+Rp ${cat.bonus.toLocaleString("id-ID")})! Kapal maju ke kotak ${session.position}.`;
        await generateAndSendNextQuestion(sock, ctx, chatId, session, note, [senderJid]);
        return true;
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        await sock.sendMessage(chatId, {
          text: `❌ *Jawaban Salah!*\n"${userText}" bukan jawaban yang tepat. Silakan coba tebak lagi!`,
          mentions: [senderJid]
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[MATH ADVENTURE BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ Game Math Adventure hanya dapat dimainkan di dalam Grup!");
      }
      const chatId = ctx.id;
      const sender = ctx.sender;
      const senderName = ctx.pushName || "Player";
      const rawText = (ctx.query || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      initDB(sender, senderName);
      if (rawText === "reset" || rawText === "nyerah" || rawText === "stop") {
        if (global.db.mathAdventure?.[chatId]) {
          clearSession(chatId);
          const restartButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🏴‍☠️ Mulai Lagi",
              id: `${prefix}mathgame`
            })
          }];
          return await sendCTA(sock, ctx, chatId, {
            text: `🏳️ Ekspedisi matematika dihentikan karena @${sender.split("@")[0]} menyerah / mereset permainan. Peta telah dibersihkan!`,
            buttons: restartButtons,
            mentions: [sender],
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada ekspedisi matematika yang sedang berlangsung.");
      }
      if (rawText === "board" || rawText === "peta") {
        const session = global.db.mathAdventure?.[chatId];
        if (!session) return ctx.reply(`❌ Belum ada permainan aktif. Ketik \`${prefix}mathgame\` untuk memulai.`);
        return await generateAndSendNextQuestion(sock, ctx, chatId, session, "Peta perjalanan diperbarui.", [sender]);
      }
      if (global.db.mathAdventure?.[chatId]) {
        const session = global.db.mathAdventure[chatId];
        return await generateAndSendNextQuestion(sock, ctx, chatId, session, `Ekspedisi sedang berada di kotak ${session.position}/46. Jawab soal aktif berikut!`, [sender]);
      }
      global.db.mathAdventure[chatId] = {
        position: 1,
        lastSolver: "",
        str: "",
        result: null,
        currentCategory: null,
        questionMsgId: null,
        startTime: Date.now(),
        expireTime: Date.now() + 6e4
      };
      saveDB();
      await generateAndSendNextQuestion(sock, ctx, chatId, global.db.mathAdventure[chatId], `🏁 Ekspedisi Baru Dimulai oleh @${sender.split("@")[0]}! Kapal berlayar dari Kotak 1.`, [sender]);
    } catch (err) {
      console.error("[MATHGAME ERROR]:", err);
      ctx.reply(`❌ Terjadi kendala: ${err.message}`);
    }
  }
};