import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const processedMsgIds = new Set();

function isDuplicateMessage(msgId) {
  if (!msgId) return false;
  if (processedMsgIds.has(msgId)) return true;
  processedMsgIds.add(msgId);
  if (processedMsgIds.size > 200) {
    const firstItem = processedMsgIds.values().next().value;
    processedMsgIds.delete(firstItem);
  }
  return false;
}

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.domino) global.db.domino = {};
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
  if (global.db?.domino?.[chatId]) {
    delete global.db.domino[chatId];
    saveDB();
  }
}

function rewardWinner(jid, name = "", prizeMoney = 1e4, prizeExp = 300) {
  if (!jid || jid.includes("BOT")) return;
  initDB(jid, name);
  global.db.user[jid].money = (Number(global.db.user[jid].money) || 0) + prizeMoney;
  global.db.user[jid].exp = (Number(global.db.user[jid].exp) || 0) + prizeExp;
  saveDB();
}

function checkAndCleanExpiredSessions(currentChatId = null) {
  if (!global.db?.domino) return;
  const now = Date.now();
  let changed = false;
  for (const [cId, session] of Object.entries(global.db.domino)) {
    const isExpired = session?.expireTime && now > session.expireTime;
    const isCorrupt = !session || !session.state || !session.players && !session.host;
    if (isExpired || isCorrupt) {
      delete global.db.domino[cId];
      changed = true;
    }
  }
  if (currentChatId && global.db.domino[currentChatId]) {
    const s = global.db.domino[currentChatId];
    if (s.expireTime && now > s.expireTime) {
      delete global.db.domino[currentChatId];
      changed = true;
    }
  }
  if (changed) saveDB();
}

function purgePlayerFromOtherSessions(playerJid) {
  if (!global.db?.domino || !playerJid || playerJid.includes("BOT")) return;
  let changed = false;
  for (const [cId, session] of Object.entries(global.db.domino)) {
    if (session.state === "LOBBY") {
      if (session.host === playerJid) {
        delete global.db.domino[cId];
        changed = true;
      } else if (Array.isArray(session.players)) {
        const idx = session.players.indexOf(playerJid);
        if (idx !== -1) {
          session.players.splice(idx, 1);
          changed = true;
        }
      }
    }
  }
  if (changed) saveDB();
}
const PIP_PATTERNS = {
  0: [],
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

function renderHalfSlotsHTML(pips) {
  const active = PIP_PATTERNS[pips] || [];
  let slots = "";
  for (let i = 0; i < 9; i++) {
    slots += active.includes(i) ? `<div class="slot"><div class="pip"></div></div>` : `<div class="slot"></div>`;
  }
  return slots;
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
  const finalFooter = footer || `${botName} • Domino Arena`;
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
          title: b.title || "PILIH KARTU",
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
        list_title: `${botName} • Domino Gaple`,
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
  if (typeof ctx?.sendCta === "function" && (!targetId || targetId === ctx?.id)) {
    try {
      return await ctx.sendCta(text, finalFooter, formattedButtons, options);
    } catch (e) {}
  }
  try {
    return await sock.sendMessage(destJid, {
      ...image ? {
        image: image
      } : {},
      caption: text,
      footer: finalFooter,
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: text
            },
            footer: {
              text: finalFooter
            },
            nativeFlowMessage: {
              buttons: formattedButtons
            },
            contextInfo: options.contextInfo
          }
        }
      }
    }, {
      quoted: quoted || undefined
    });
  } catch (e) {
    if (image) {
      return await sock.sendMessage(destJid, {
        image: image,
        caption: `${text}\n\n_${finalFooter}_`,
        mentions: mentions
      }, {
        quoted: quoted || undefined
      });
    }
    return await sock.sendMessage(destJid, {
      text: `${text}\n\n_${finalFooter}_`,
      mentions: mentions
    }, {
      quoted: quoted || undefined
    });
  }
}

function generateDominoHTML(cardsArray) {
  const total = cardsArray.length;
  const spreadAngle = 6;
  const xSpread = 86;
  let wrappers = "";
  cardsArray.forEach((c, idx) => {
    const [t, b] = c.split("/").map(Number);
    const offset = idx - (total - 1) / 2;
    const transform = `transform: translateX(${offset * xSpread}px) translateY(${Math.abs(offset) * 8}px) rotateZ(${offset * spreadAngle}deg); z-index: ${idx + 1};`;
    wrappers += `
      <div class="card-wrapper" style="${transform}">
        <div class="domino-card">
          <div class="half-box">${renderHalfSlotsHTML(t)}</div>
          <div class="divider"></div>
          <div class="half-box">${renderHalfSlotsHTML(b)}</div>
          <div class="badge-num">${t}:${b}</div>
        </div>
      </div>
    `;
  });
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 960px;
      height: 440px;
      background: #0d131a;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: 'Segoe UI', Arial, sans-serif;
      overflow: hidden;
    }
    .wrapper-canvas {
      width: 100%;
      height: 440px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      background: radial-gradient(circle at 50% 30%, #1a2634 0%, #0d131a 100%);
      padding: 30px 20px 40px 20px;
      position: relative;
    }
    .hand-container {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: flex-end;
      width: 860px;
      height: 320px;
    }
    .card-wrapper {
      position: absolute;
      bottom: 10px;
      transform-origin: bottom center;
      filter: drop-shadow(0 15px 15px rgba(0, 0, 0, 0.65));
    }
    .domino-card {
      position: relative;
      width: 96px;
      height: 190px;
      border-radius: 12px;
      background: linear-gradient(145deg, #fffbee 0%, #f7efd2 60%, #e2d2a4 100%);
      border: 1px solid #d5c396;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 8px 6px;
      box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.9), 0 4px 8px rgba(0, 0, 0, 0.4);
    }
    .divider { width: 84%; height: 3px; background: #735404; border-radius: 2px; }
    .half-box { width: 80px; height: 80px; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); padding: 4px; }
    .slot { display: flex; justify-content: center; align-items: center; }
    .pip { width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(circle at 60% 60%, #ff4d4d 0%, #b71c1c 70%, #5f0909 100%); box-shadow: inset 1.5px 1.5px 2px rgba(0,0,0,0.9); }
    .badge-num { position: absolute; bottom: 4px; right: 6px; font-size: 11px; font-weight: 800; color: #8c6808; opacity: 0.6; }
  </style>
</head>
<body>
  <div class="wrapper-canvas">
    <div class="hand-container">${wrappers}</div>
  </div>
</body>
</html>`;
}

function generateDominoBoardHTML(boardArray = [], leftEnd = null, rightEnd = null, players = [], currentTurn = null) {
  let tilesHTML = "";
  if (boardArray.length === 0) {
    tilesHTML = `
      <div class="empty-board">
        <div class="empty-icon">🪵</div>
        <div class="empty-title">MEJA MASIH KOSONG</div>
        <div class="empty-sub">Menunggu giliran pertama melangkah...</div>
      </div>
    `;
  } else {
    boardArray.forEach((t, idx) => {
      const [a, b] = t.split("/").map(Number);
      const isDouble = a === b;
      if (isDouble) {
        tilesHTML += `
          <div class="domino-tile-v">
            <div class="half-box-v">${renderHalfSlotsHTML(a)}</div>
            <div class="divider-h"></div>
            <div class="half-box-v">${renderHalfSlotsHTML(b)}</div>
            <div class="tile-tag">${a}:${b}</div>
          </div>
        `;
      } else {
        tilesHTML += `
          <div class="domino-tile-h">
            <div class="half-box-h">${renderHalfSlotsHTML(a)}</div>
            <div class="divider-v"></div>
            <div class="half-box-h">${renderHalfSlotsHTML(b)}</div>
            <div class="tile-tag">${a}:${b}</div>
          </div>
        `;
      }
      if (idx < boardArray.length - 1) {
        tilesHTML += `<div class="chain-dot"></div>`;
      }
    });
  }
  let playersHTML = "";
  players.forEach(p => {
    const isBot = p.id.includes("BOT");
    const botName = global.bot?.name || "WudysoftBot";
    const rawName = isBot ? `🤖 ${botName}` : global.db?.user?.[p.id]?.name || p.id.split("@")[0];
    const cleanName = rawName.length > 13 ? rawName.slice(0, 11) + ".." : rawName;
    const isTurn = p.id === currentTurn;
    const cardCount = p.cards ? p.cards.length : 0;
    const icon = isBot ? "🤖" : "👤";
    playersHTML += `
      <div class="player-pod ${isTurn ? "active-pod" : ""}">
        <div class="player-avatar">${icon}</div>
        <div class="player-meta">
          <div class="player-name">${cleanName}</div>
          <div class="player-cards">🎴 <b>${cardCount}</b> Kartu</div>
        </div>
        ${isTurn ? '<div class="turn-chip">GILIRAN</div>' : ""}
      </div>
    `;
  });
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 1080px;
      height: 560px;
      background: #061f0f;
      font-family: 'Segoe UI', Arial, sans-serif;
      overflow: hidden;
    }
    .board-frame {
      width: 100%;
      height: 560px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      background: radial-gradient(circle at 50% 50%, #175e33 0%, #0c381c 70%, #061f0f 100%);
      border: 14px solid #2b1708;
      border-radius: 24px;
      padding: 20px;
      box-shadow: inset 0 0 60px rgba(0,0,0,0.9), 0 10px 30px rgba(0,0,0,0.7);
    }
    .header-bar {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 10px 14px 10px;
      border-bottom: 2px solid rgba(226, 186, 85, 0.25);
    }
    .end-tag {
      background: rgba(0,0,0,0.75);
      border: 2px solid #e2ba55;
      border-radius: 12px;
      padding: 6px 18px;
      color: #fff;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 1px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    }
    .table-title {
      color: #f6e27a;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: uppercase;
      text-shadow: 0 3px 8px rgba(0,0,0,0.85);
    }
    .players-bar {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 14px;
      width: 100%;
      margin: 16px 0;
      flex-wrap: wrap;
    }
    .player-pod {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 14px;
      background: rgba(8, 24, 14, 0.75);
      border: 2px solid rgba(226, 186, 85, 0.35);
      border-radius: 14px;
      color: #fff;
      min-width: 170px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.4);
      position: relative;
    }
    .player-pod.active-pod {
      background: linear-gradient(135deg, rgba(30, 85, 48, 0.95), rgba(16, 52, 27, 0.95));
      border: 2px solid #ffd700;
      box-shadow: 0 0 16px rgba(255, 215, 0, 0.7), inset 0 0 10px rgba(255, 215, 0, 0.3);
      transform: translateY(-2px);
    }
    .player-avatar {
      font-size: 20px;
      background: rgba(0,0,0,0.35);
      border-radius: 50%;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .player-meta { display: flex; flex-direction: column; }
    .player-name { font-size: 13px; font-weight: 700; color: #f7eed2; }
    .player-cards { font-size: 11px; color: #d1c5a5; margin-top: 1px; }
    .turn-chip {
      position: absolute;
      top: -9px;
      right: 10px;
      background: #ffb703;
      color: #000;
      font-size: 9px;
      font-weight: 900;
      padding: 2px 7px;
      border-radius: 8px;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.6);
    }
    .board-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-height: 250px;
      padding: 20px;
      background: rgba(0, 0, 0, 0.32);
      border-radius: 18px;
      box-shadow: inset 0 0 30px rgba(0,0,0,0.7);
      border: 1px solid rgba(226, 186, 85, 0.2);
      margin-top: 4px;
    }
    .empty-board { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
    .empty-icon { font-size: 38px; }
    .empty-title { color: #f6e27a; font-size: 19px; font-weight: 800; letter-spacing: 1px; }
    .empty-sub { color: #d0c4a4; font-size: 13px; font-style: italic; }
    .domino-tile-h {
      width: 90px;
      height: 48px;
      border-radius: 8px;
      background: linear-gradient(145deg, #ffffff 0%, #f7f3e8 60%, #e2d9c4 100%);
      border: 1px solid #c2b598;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px;
      box-shadow: 3px 5px 10px rgba(0,0,0,0.5);
      position: relative;
    }
    .domino-tile-v {
      width: 48px;
      height: 90px;
      border-radius: 8px;
      background: linear-gradient(145deg, #ffffff 0%, #f7f3e8 60%, #e2d9c4 100%);
      border: 1px solid #c2b598;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 4px;
      box-shadow: 3px 5px 10px rgba(0,0,0,0.5);
      position: relative;
    }
    .divider-v { width: 2.5px; height: 80%; background: #735404; border-radius: 1px; }
    .divider-h { width: 80%; height: 2.5px; background: #735404; border-radius: 1px; }
    .half-box-h, .half-box-v { width: 38px; height: 38px; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); padding: 2px; }
    .slot { display: flex; justify-content: center; align-items: center; }
    .pip { width: 7.5px; height: 7.5px; border-radius: 50%; background: radial-gradient(circle at 60% 60%, #ff3b30 0%, #c41c14 70%, #680904 100%); }
    .tile-tag { position: absolute; bottom: 1px; right: 3px; font-size: 8.5px; font-weight: 800; color: #680904; opacity: 0.55; }
    .chain-dot { width: 5px; height: 5px; border-radius: 50%; background: #e2ba55; box-shadow: 0 0 5px #e2ba55; }
  </style>
</head>
<body>
  <div class="board-frame">
    <div class="header-bar">
      <div class="end-tag">◀ KIRI: [ ${leftEnd ?? "Bebas"} ]</div>
      <div class="table-title">🎲 MEJA DOMINO GAPLE 🎲</div>
      <div class="end-tag">KANAN: [ ${rightEnd ?? "Bebas"} ] ▶</div>
    </div>
    <div class="players-bar">${playersHTML}</div>
    <div class="board-container">${tilesHTML}</div>
  </div>
</body>
</html>`;
}
async function renderHtmlToImage(htmlContent) {
  const rawApi = global.bot?.api?.wudysoft || "https://api.wudysoft.com";
  const cleanApi = rawApi.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const baseUrl = `https://${cleanApi}/api/tools/html2img/`;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
  };
  const payload = {
    html: htmlContent,
    fullPage: false,
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

function generateFullDeck() {
  const deck = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      deck.push(`${i}/${j}`);
    }
  }
  return deck.sort(() => Math.random() - .5);
}

function canPlay(card, leftEnd, rightEnd) {
  if (leftEnd === null || rightEnd === null) return true;
  const [a, b] = card.split("/").map(Number);
  return a === leftEnd || b === leftEnd || a === rightEnd || b === rightEnd;
}

function getHighestDouble(cards) {
  let highest = -1;
  for (const c of cards) {
    const [a, b] = c.split("/").map(Number);
    if (a === b && a > highest) highest = a;
  }
  return highest;
}

function getFirstTurnMulti(players) {
  let highestDouble = -1;
  let starterJid = players[0].id;
  for (const p of players) {
    const d = getHighestDouble(p.cards);
    if (d > highestDouble) {
      highestDouble = d;
      starterJid = p.id;
    }
  }
  if (highestDouble !== -1) return starterJid;
  let maxPip = -1;
  for (const p of players) {
    for (const c of p.cards) {
      const [a, b] = c.split("/").map(Number);
      if (a + b > maxPip) {
        maxPip = a + b;
        starterJid = p.id;
      }
    }
  }
  return starterJid;
}

function getNextPlayer(players, currentTurnId) {
  const currentIndex = players.findIndex(p => p.id === currentTurnId);
  if (currentIndex === -1) return players[0];
  const nextIndex = (currentIndex + 1) % players.length;
  return players[nextIndex];
}

function countTotalPips(cards) {
  return cards.reduce((sum, c) => {
    const [a, b] = c.split("/").map(Number);
    return sum + a + b;
  }, 0);
}
async function sendPrivateHandWithCTA(sock, ctx, playerJid, session, gameChatId, prefix = ".") {
  try {
    if (!playerJid || playerJid.includes("BOT")) return;
    const player = session.players.find(p => p.id === playerJid);
    if (!player) return;
    const cards = player.cards;
    const isMyTurn = session.turn === playerJid;
    const left = session.leftEnd;
    const right = session.rightEnd;
    const botName = global.bot?.name || "WudysoftBot";
    const {
      buffer: imgBuffer
    } = await renderHtmlToImage(generateDominoHTML(cards));
    const choiceRows = cards.map((c, idx) => {
      const playable = canPlay(c, left, right) && isMyTurn;
      return {
        title: `[ ${c} ] - Kartu #${idx + 1}`,
        id: `${prefix}domino play ${idx + 1} ${gameChatId}`,
        description: isMyTurn ? playable ? "✅ Cocok! Klik untuk mainkan kartu ini" : "❌ Tidak cocok dengan angka meja" : "⏳ Tunggu giliran Anda"
      };
    });
    const buttons = [{
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "🎴 PILIH KARTU UNTUK DIMAINKAN",
        sections: [{
          title: `KARTU ANDA (${cards.length} BATU)`,
          rows: choiceRows
        }]
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "⏩ Lewat (Pass)",
        id: `${prefix}domino pass ${gameChatId}`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🚪 Nyerah",
        id: `${prefix}domino stop ${gameChatId}`
      })
    }];
    const boardText = session.board.length > 0 ? session.board.map(c => `[${c}]`).join("-") : "_(Meja Masih Kosong)_";
    const statusTurn = isMyTurn ? "🟢 *GILIRAN ANDA!*" : "⏳ *Menunggu Giliran Lawan...*";
    const bodyText = `🎴 *KARTU DOMINO ANDA (PC RAHASIA)*\n\n` + `🪵 *Rangkaian Meja:* \n${boardText}\n\n` + `🎯 *Ujung Sambungan:* [ ${left ?? "Bebas"} ] ↔ [ ${right ?? "Bebas"} ]\n` + `📌 *Status:* ${statusTurn}\n\n` + `_Pilih kartu pada tombol pilihan di bawah:_`;
    await sendCTA(sock, ctx, playerJid, {
      text: bodyText,
      footer: `${botName} • Sisa ${cards.length} Kartu`,
      buttons: buttons,
      image: imgBuffer
    });
  } catch (err) {
    console.error("[Send Hand Error]:", err?.message || err);
  }
}
async function announceGameState(sock, ctx, chatId, session, extraNote = "", prefix = ".") {
  const boardStr = session.board.map(c => `[${c}]`).join("-");
  let playersListStr = "";
  const mentions = [];
  const botName = global.bot?.name || "WudysoftBot";
  session.players.forEach((p, idx) => {
    const isBot = p.id.includes("BOT");
    const nameStr = isBot ? `🤖 ${botName}` : `@${p.id.split("@")[0]}`;
    const turnIndicator = p.id === session.turn ? " 👈 *[GILIRAN BERJALAN]*" : "";
    playersListStr += `${idx + 1}. ${nameStr} (${p.cards.length} kartu)${turnIndicator}\n`;
    if (!isBot) mentions.push(p.id);
  });
  let text = `🎲 *ARENA MEJA DOMINO GAPLE*\n\n`;
  if (extraNote) text += `📢 ${extraNote}\n\n`;
  text += `👥 *Pemain (${session.players.length}/4):*\n${playersListStr}\n`;
  text += `🪵 *Rangkaian Meja:* \n${boardStr || "_(Belum ada kartu di meja)_"}\n\n`;
  text += `🎯 *Ujung Sambung:* [ ${session.leftEnd ?? "Bebas"} ] ↔ [ ${session.rightEnd ?? "Bebas"} ]\n\n`;
  text += `💡 _Buka Private Chat (PC) Anda untuk memilih kartu via tombol interaktif!_`;
  let boardImg = null;
  try {
    const {
      buffer: bBuf
    } = await renderHtmlToImage(generateDominoBoardHTML(session.board, session.leftEnd, session.rightEnd, session.players, session.turn));
    boardImg = bBuf;
  } catch (e) {}
  const groupButtons = [{
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🔄 Perbarui Meja",
      id: `${prefix}domino board`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "⏩ Lewat (Pass)",
      id: `${prefix}domino pass ${chatId}`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🚪 Akhiri Game",
      id: `${prefix}domino stop ${chatId}`
    })
  }];
  await sendCTA(sock, ctx, chatId, {
    text: text,
    buttons: groupButtons,
    image: boardImg,
    mentions: mentions
  });
}
async function handleBotTurn(sock, ctx, chatId, session) {
  const currentSessionId = session?.sessionId;
  setTimeout(async () => {
    try {
      const active = global.db.domino?.[chatId];
      if (!active || active.sessionId !== currentSessionId || active.state !== "PLAYING") {
        return;
      }
      const bot = active.players.find(p => p.id.includes("BOT"));
      if (!bot) return;
      let validIndex = -1;
      let placeSide = null;
      if (active.board.length === 0) {
        let bestIdx = 0;
        let bestScore = -1;
        for (let i = 0; i < bot.cards.length; i++) {
          const [a, b] = bot.cards[i].split("/").map(Number);
          const score = (a === b ? 100 : 0) + (a + b);
          if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }
        validIndex = bestIdx;
      } else {
        for (let i = 0; i < bot.cards.length; i++) {
          const [a, b] = bot.cards[i].split("/").map(Number);
          if (a === active.leftEnd || b === active.leftEnd) {
            validIndex = i;
            placeSide = "left";
            break;
          }
          if (a === active.rightEnd || b === active.rightEnd) {
            validIndex = i;
            placeSide = "right";
            break;
          }
        }
      }
      const prefix = ctx?.prefix || ".";
      if (validIndex === -1) {
        active.consecutivePasses = (active.consecutivePasses || 0) + 1;
        if (active.consecutivePasses >= active.players.length) {
          const p1 = active.players.find(p => !p.id.includes("BOT")) || active.players[0];
          const p1Total = countTotalPips(p1.cards);
          const botTotal = countTotalPips(bot.cards);
          clearSession(chatId);
          let buntuText = `🛑 *PERMAINAN BUNTU (GAPLE DEADLOCK)!* 🛑\n\n` + `• Titik @${p1.id.split("@")[0]}: *${p1Total} titik*\n` + `• Titik 🤖 Bot: *${botTotal} titik*\n\n`;
          if (p1Total < botTotal) {
            rewardWinner(p1.id, "", 8e3, 200);
            buntuText += `🏆 *Pemenang:* @${p1.id.split("@")[0]}!\n🎁 *Hadiah:* +Rp 8.000 Money & +200 EXP!`;
          } else if (botTotal < p1Total) {
            buntuText += `🤖 *Bot Menang!*`;
          } else {
            buntuText += `🤝 *Hasil Seri!*`;
          }
          const overButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🎮 Main Lagi",
              id: `${prefix}domino`
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🤖 Lawan Bot",
              id: `${prefix}domino bot`
            })
          }];
          return await sendCTA(sock, ctx, chatId, {
            text: buntuText,
            buttons: overButtons,
            mentions: [p1.id]
          });
        }
        const nextPlayer = getNextPlayer(active.players, bot.id);
        active.turn = nextPlayer.id;
        saveDB();
        if (!nextPlayer.id.includes("BOT")) {
          await sendPrivateHandWithCTA(sock, ctx, active.turn, active, chatId, prefix);
        }
        await announceGameState(sock, ctx, chatId, active, "🤖 *Bot memilih PASS* karena tidak memiliki kartu cocok.", prefix);
        if (nextPlayer.id.includes("BOT")) {
          await handleBotTurn(sock, ctx, chatId, active);
        }
        return;
      }
      const card = bot.cards.splice(validIndex, 1)[0];
      const [a, b] = card.split("/").map(Number);
      if (active.board.length === 0) {
        active.board.push(card);
        active.leftEnd = a;
        active.rightEnd = b;
      } else if (placeSide === "left") {
        if (b === active.leftEnd) {
          active.board.unshift(card);
          active.leftEnd = a;
        } else {
          active.board.unshift(`${b}/${a}`);
          active.leftEnd = b;
        }
      } else {
        if (a === active.rightEnd) {
          active.board.push(card);
          active.rightEnd = b;
        } else {
          active.board.push(`${b}/${a}`);
          active.rightEnd = a;
        }
      }
      active.consecutivePasses = 0;
      if (bot.cards.length === 0) {
        clearSession(chatId);
        const retryButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎮 Main Lagi",
            id: `${prefix}domino`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤖 Tantang Balik",
            id: `${prefix}domino bot`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: "🤖 *Bot berhasil menghabiskan kartu dan menang!* Tetap semangat dan coba lagi.",
          buttons: retryButtons
        });
      }
      const nextPlayer = getNextPlayer(active.players, bot.id);
      active.turn = nextPlayer.id;
      saveDB();
      if (!nextPlayer.id.includes("BOT")) {
        await sendPrivateHandWithCTA(sock, ctx, active.turn, active, chatId, prefix);
      }
      await announceGameState(sock, ctx, chatId, active, `🤖 Bot memainkan kartu: *[ ${card} ]*`, prefix);
      if (nextPlayer.id.includes("BOT")) {
        await handleBotTurn(sock, ctx, chatId, active);
      }
    } catch (e) {
      console.error("[BOT TURN ERROR]:", e);
    }
  }, 1600);
}
async function handleDominoAction(sock, ctx, msg, sender, rawText) {
  initDB(sender, ctx?.pushName || "");
  checkAndCleanExpiredSessions();
  const parts = rawText.split(/\s+/);
  const action = (parts[1] || "").toLowerCase();
  let targetChatId = parts[3] || parts[2];
  if (!targetChatId || !global.db.domino[targetChatId]) {
    for (const [cId, sess] of Object.entries(global.db.domino)) {
      if (sess.players?.some(p => p.id === sender)) {
        targetChatId = cId;
        break;
      }
    }
  }
  if (!targetChatId && global.db.domino[ctx?.id]) {
    targetChatId = ctx?.id;
  }
  const session = global.db.domino[targetChatId];
  if (!session) {
    return ctx.reply("❌ Tidak ada sesi Domino aktif yang Anda ikuti.");
  }
  const prefix = ctx?.prefix || ".";
  if (action === "stop" || action === "nyerah" || action === "batal") {
    clearSession(targetChatId);
    const restartButtons = [{
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🎮 Main Lagi",
        id: `${prefix}domino`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🤖 Lawan Bot",
        id: `${prefix}domino bot`
      })
    }];
    await sendCTA(sock, ctx, targetChatId, {
      text: `🏳️ Permainan Domino dihentikan oleh @${sender.split("@")[0]}. Meja telah dibersihkan!`,
      buttons: restartButtons,
      mentions: [sender]
    });
    return ctx.reply("🚪 Sesi permainan Domino telah dihentikan.");
  }
  if (session.state !== "PLAYING") {
    return ctx.reply("⏳ Permainan belum dimulai. Masih menunggu di lobi!");
  }
  session.expireTime = Date.now() + 6e5;
  saveDB();
  if (action === "pass") {
    if (session.turn !== sender) {
      return ctx.reply("⏳ Bukan giliran Anda untuk melangkah!");
    }
    const player = session.players.find(p => p.id === sender);
    const hasMove = player.cards.some(c => canPlay(c, session.leftEnd, session.rightEnd));
    if (hasMove) {
      return ctx.reply(`❌ Anda masih memiliki kartu yang cocok dengan meja [ ${session.leftEnd} ] atau [ ${session.rightEnd} ]!`);
    }
    session.consecutivePasses = (session.consecutivePasses || 0) + 1;
    if (session.consecutivePasses >= session.players.length) {
      const scores = session.players.map(p => ({
        id: p.id,
        name: p.id.includes("BOT") ? "🤖 Bot" : `@${p.id.split("@")[0]}`,
        pips: countTotalPips(p.cards),
        cardsCount: p.cards.length
      }));
      scores.sort((a, b) => a.pips - b.pips);
      const winner = scores[0];
      clearSession(targetChatId);
      if (!winner.id.includes("BOT")) {
        rewardWinner(winner.id, "", 8e3, 200);
      }
      let buntuText = `🛑 *PERMAINAN BUNTU (GAPLE DEADLOCK)!* 🛑\n\nSemua pemain tidak dapat melangkah lagi.\n\n*Rekapitulasi Titik:* \n`;
      scores.forEach((s, idx) => {
        buntuText += `${idx + 1}. ${s.name}: *${s.pips} titik* (${s.cardsCount} kartu)\n`;
      });
      buntuText += `\n🏆 *Pemenang:* ${winner.name} (Titik kartu terendah)!\n🎁 *Hadiah:* +Rp 8.000 Money & +200 EXP!`;
      const mentions = session.players.filter(p => !p.id.includes("BOT")).map(p => p.id);
      const endButtons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎮 Main Lagi",
          id: `${prefix}domino`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤖 Lawan Bot",
          id: `${prefix}domino bot`
        })
      }];
      await sendCTA(sock, ctx, targetChatId, {
        text: buntuText,
        buttons: endButtons,
        mentions: mentions
      });
      return;
    }
    const nextPlayer = getNextPlayer(session.players, sender);
    session.turn = nextPlayer.id;
    saveDB();
    const note = `@${sender.split("@")[0]} memilih *PASS/LEWAT*.`;
    if (session.isBot && session.turn.includes("BOT")) {
      await announceGameState(sock, ctx, targetChatId, session, note, prefix);
      await handleBotTurn(sock, ctx, targetChatId, session);
    } else {
      await sendPrivateHandWithCTA(sock, ctx, session.turn, session, targetChatId, prefix);
      await announceGameState(sock, ctx, targetChatId, session, note, prefix);
    }
    return true;
  }
  if (action === "play") {
    const cardIndex = parseInt(parts[2]) - 1;
    if (session.turn !== sender) {
      return ctx.reply("⏳ Bukan giliran Anda! Tunggu giliran pemain lain.");
    }
    const player = session.players.find(p => p.id === sender);
    if (!player || isNaN(cardIndex) || cardIndex < 0 || cardIndex >= player.cards.length) {
      return ctx.reply("❌ Kartu yang dipilih tidak valid!");
    }
    const selectedCard = player.cards[cardIndex];
    const [a, b] = selectedCard.split("/").map(Number);
    let placed = false;
    if (session.board.length === 0) {
      session.board.push(selectedCard);
      session.leftEnd = a;
      session.rightEnd = b;
      placed = true;
    } else {
      if (b === session.leftEnd) {
        session.board.unshift(selectedCard);
        session.leftEnd = a;
        placed = true;
      } else if (a === session.leftEnd) {
        session.board.unshift(`${b}/${a}`);
        session.leftEnd = b;
        placed = true;
      } else if (a === session.rightEnd) {
        session.board.push(selectedCard);
        session.rightEnd = b;
        placed = true;
      } else if (b === session.rightEnd) {
        session.board.push(`${b}/${a}`);
        session.rightEnd = a;
        placed = true;
      }
    }
    if (!placed) {
      return ctx.reply(`❌ Kartu [ ${selectedCard} ] tidak cocok dengan ujung meja [ ${session.leftEnd} ] atau [ ${session.rightEnd} ]!`);
    }
    player.cards.splice(cardIndex, 1);
    session.consecutivePasses = 0;
    if (player.cards.length === 0) {
      clearSession(targetChatId);
      const prizeMoney = session.players.length > 2 ? 15e3 : 8e3;
      const prizeExp = session.players.length > 2 ? 400 : 200;
      rewardWinner(sender, ctx?.pushName || "", prizeMoney, prizeExp);
      const winButtons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎮 Main Lagi",
          id: `${prefix}domino`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤖 Lawan Bot",
          id: `${prefix}domino bot`
        })
      }];
      await sendCTA(sock, ctx, targetChatId, {
        text: `🎉 *KARTU HABIS!* @${sender.split("@")[0]} memenangkan game Domino! 🏆\n🎁 *Hadiah:* +Rp ${prizeMoney.toLocaleString("id-ID")} Money & +${prizeExp} EXP!`,
        buttons: winButtons,
        mentions: [sender]
      });
      return ctx.reply("🏆 *Selamat! Anda memenangkan permainan Domino!*");
    }
    const nextPlayer = getNextPlayer(session.players, sender);
    session.turn = nextPlayer.id;
    saveDB();
    const note = `@${sender.split("@")[0]} memainkan kartu: *[ ${selectedCard} ]*`;
    await sendPrivateHandWithCTA(sock, ctx, sender, session, targetChatId, prefix);
    if (session.isBot && session.turn.includes("BOT")) {
      await announceGameState(sock, ctx, targetChatId, session, note, prefix);
      await handleBotTurn(sock, ctx, targetChatId, session);
    } else {
      await sendPrivateHandWithCTA(sock, ctx, nextPlayer.id, session, targetChatId, prefix);
      await announceGameState(sock, ctx, targetChatId, session, note, prefix);
    }
    return true;
  }
}
async function startMultiplayerGame(sock, ctx, chatId, playerIds, isBot = false, prefix = ".") {
  clearSession(chatId);
  const deck = generateFullDeck();
  const players = [];
  for (const pId of playerIds) {
    if (!pId.includes("BOT")) {
      initDB(pId);
      purgePlayerFromOtherSessions(pId);
    }
    players.push({
      id: pId,
      cards: deck.splice(0, 7)
    });
  }
  const firstTurn = getFirstTurnMulti(players);
  const now = Date.now();
  global.db.domino[chatId] = {
    sessionId: now,
    state: "PLAYING",
    isBot: isBot,
    players: players,
    board: [],
    leftEnd: null,
    rightEnd: null,
    turn: firstTurn,
    consecutivePasses: 0,
    deck: deck,
    startTime: now,
    expireTime: now + 6e5
  };
  saveDB();
  for (const p of players) {
    if (!p.id.includes("BOT")) {
      await sendPrivateHandWithCTA(sock, ctx, p.id, global.db.domino[chatId], chatId, prefix);
    }
  }
  const botName = global.bot?.name || "WudysoftBot";
  const startNote = `🎯 Giliran Pertama: ${firstTurn.includes("BOT") ? `🤖 ${botName}` : `@${firstTurn.split("@")[0]}`}`;
  await announceGameState(sock, ctx, chatId, global.db.domino[chatId], startNote, prefix);
  if (firstTurn.includes("BOT")) {
    await handleBotTurn(sock, ctx, chatId, global.db.domino[chatId]);
  }
}
export default {
  name: "domino",
  aliases: ["gaple", "balak"],
  description: "Bermain Domino Gaple Full CTA: Solo lawan Bot atau Multiplayer",
  category: "Game",
  limit: true,
  example: ".domino atau .domino bot",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sender = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      if (/^[.#/!]?domino\s+(play|pass|stop|nyerah|batal)/i.test(text)) {
        const msgId = msg?.key?.id;
        if (isDuplicateMessage(msgId)) return;
        return await handleDominoAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[DOMINO BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      const chatId = ctx.id;
      const sender = ctx.sender;
      const senderName = ctx.pushName || "Player";
      const rawText = (ctx.query || "").trim();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const rawBotJid = sock?.user?.id || sock?.user?.jid || "";
      const botJid = rawBotJid.includes(":") ? `${rawBotJid.split(":")[0]}@s.whatsapp.net` : rawBotJid;
      initDB(sender, senderName);
      checkAndCleanExpiredSessions(chatId);
      const msgId = msg?.key?.id;
      if (/^(play|pass|stop|nyerah|batal)/i.test(rawText)) {
        if (isDuplicateMessage(msgId)) return;
        return await handleDominoAction(sock, ctx, msg, sender, `${prefix}domino ${rawText}`);
      }
      if (rawText.toLowerCase() === "board" || rawText.toLowerCase() === "meja") {
        const session = global.db.domino[chatId];
        if (!session || session.state !== "PLAYING") {
          return ctx.reply("❌ Tidak ada permainan domino aktif di room ini.");
        }
        return await announceGameState(sock, ctx, chatId, session, "", prefix);
      }
      if (rawText.toLowerCase() === "stop" || rawText.toLowerCase() === "reset") {
        if (global.db.domino[chatId]) {
          clearSession(chatId);
          const newButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🎴 Buat Lobi Baru",
              id: `${prefix}domino`
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🤖 Lawan Bot (Solo)",
              id: `${prefix}domino bot`
            })
          }];
          return await sendCTA(sock, ctx, chatId, {
            text: "🚪 Sesi permainan / lobby domino telah dibersihkan secara tuntas.",
            buttons: newButtons,
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi domino yang sedang berlangsung.");
      }
      if (rawText.toLowerCase() === "bot" || rawText.toLowerCase() === "solo") {
        const existing = global.db.domino[chatId];
        if (existing && existing.state === "PLAYING") {
          return ctx.reply("⚠️ Masih ada sesi domino aktif. Ketik `.domino stop` untuk menghentikan terlebih dahulu.");
        }
        return await startMultiplayerGame(sock, ctx, chatId, [sender, "BOT"], true, prefix);
      }
      if (rawText.toLowerCase() === "addbot") {
        const activeSession = global.db.domino[chatId];
        if (!activeSession || activeSession.state !== "LOBBY") {
          return ctx.reply("❌ Tidak ada lobi yang sedang terbuka.");
        }
        if (activeSession.players.includes("BOT")) {
          return ctx.reply("⚠️ Bot sudah ada di dalam lobi ini!");
        }
        if (activeSession.players.length >= 4) {
          return ctx.reply("❌ Lobi sudah penuh (Maksimal 4 pemain)!");
        }
        activeSession.players.push("BOT");
        activeSession.isBot = true;
        saveDB();
        let addBotText = `🤖 Bot berhasil ditambahkan ke lobi!\n\n*Pemain Terkumpul (${activeSession.players.length}/4):*\n`;
        activeSession.players.forEach((p, idx) => {
          addBotText += `${idx + 1}. ${p.includes("BOT") ? "🤖 Bot Gaple" : `@${p.split("@")[0]}`}\n`;
        });
        const lobbyButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Gabung (Join)",
            id: `${prefix}domino join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎮 Mulai Game",
            id: `${prefix}domino start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal",
            id: `${prefix}domino stop`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: addBotText,
          buttons: lobbyButtons,
          mentions: activeSession.players.filter(p => !p.includes("BOT"))
        });
      }
      const mentioned = (ctx.mentionedJid || []).filter(id => id !== sender);
      if (mentioned.length > 0 && mentioned.includes(botJid)) {
        return await startMultiplayerGame(sock, ctx, chatId, [sender, "BOT"], true, prefix);
      }
      if (!isGroup) {
        return await startMultiplayerGame(sock, ctx, chatId, [sender, "BOT"], true, prefix);
      }
      if (mentioned.length > 0) {
        const existing = global.db.domino[chatId];
        if (existing && existing.state === "PLAYING") {
          return ctx.reply("⚠️ Masih ada sesi domino aktif di grup ini. Ketik `.domino stop` terlebih dahulu.");
        }
        const participants = [sender, ...new Set(mentioned)].slice(0, 4);
        if (participants.length < 2) {
          return ctx.reply("❌ Minimal butuh 2 pemain!");
        }
        return await startMultiplayerGame(sock, ctx, chatId, participants, false, prefix);
      }
      const activeSession = global.db.domino[chatId];
      if (rawText.toLowerCase() === "join" || rawText.toLowerCase() === "gabung") {
        if (!activeSession || activeSession.state !== "LOBBY") {
          return ctx.reply(`❌ Tidak ada lobby domino yang sedang terbuka.`);
        }
        if (activeSession.players.includes(sender)) {
          return ctx.reply("⚠️ Anda sudah terdaftar di dalam lobi ini!");
        }
        if (activeSession.players.length >= 4) {
          return ctx.reply("❌ Lobi sudah penuh (Maksimal 4 pemain)!");
        }
        activeSession.players.push(sender);
        activeSession.expireTime = Date.now() + 12e4;
        saveDB();
        let joinText = `🤝 @${sender.split("@")[0]} bergabung ke lobi!\n\n*Pemain Terkumpul (${activeSession.players.length}/4):*\n`;
        activeSession.players.forEach((p, idx) => {
          joinText += `${idx + 1}. ${p.includes("BOT") ? "🤖 Bot Gaple" : `@${p.split("@")[0]}`}\n`;
        });
        const lobbyButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Gabung (Join)",
            id: `${prefix}domino join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎮 Mulai Game",
            id: `${prefix}domino start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤖 Tambah Bot",
            id: `${prefix}domino addbot`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal",
            id: `${prefix}domino stop`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: joinText,
          buttons: lobbyButtons,
          mentions: activeSession.players.filter(p => !p.includes("BOT"))
        });
      }
      if (rawText.toLowerCase() === "start" || rawText.toLowerCase() === "mulai") {
        if (!activeSession || activeSession.state !== "LOBBY") {
          return ctx.reply("❌ Tidak ada lobi yang siap dimulai.");
        }
        if (activeSession.host !== sender) {
          return ctx.reply(`❌ Hanya Host lobi (@${activeSession.host.split("@")[0]}) yang berhak memulai game!`, {
            mentions: [activeSession.host]
          });
        }
        if (activeSession.players.length < 2) {
          return ctx.reply(`❌ Minimal butuh 2 pemain untuk mulai! Saat ini baru ada ${activeSession.players.length} orang (bisa tambah dengan \`${prefix}domino addbot\`).`);
        }
        return await startMultiplayerGame(sock, ctx, chatId, activeSession.players, activeSession.isBot || false, prefix);
      }
      if (activeSession) {
        if (activeSession.state === "PLAYING") {
          return ctx.reply("⚠️ Permainan sedang berlangsung! Ketik `.domino stop` untuk menghentikan paksa.");
        }
        let lobbyText = `📢 *LOBBY DOMINO MASIH TERBUKA!*\n👑 Host: @${activeSession.host.split("@")[0]}\n\n*Daftar Pemain (${activeSession.players.length}/4):*\n`;
        activeSession.players.forEach((p, idx) => {
          lobbyText += `${idx + 1}. ${p.includes("BOT") ? "🤖 Bot Gaple" : `@${p.split("@")[0]}`}\n`;
        });
        lobbyText += `\n_Klik tombol di bawah untuk bergabung atau mulai!_`;
        const existingButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Gabung (Join)",
            id: `${prefix}domino join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎮 Mulai Game",
            id: `${prefix}domino start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤖 Tambah Bot",
            id: `${prefix}domino addbot`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal",
            id: `${prefix}domino stop`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: lobbyText,
          buttons: existingButtons,
          mentions: activeSession.players.filter(p => !p.includes("BOT"))
        });
      }
      clearSession(chatId);
      purgePlayerFromOtherSessions(sender);
      global.db.domino[chatId] = {
        sessionId: Date.now(),
        state: "LOBBY",
        host: sender,
        players: [sender],
        isBot: false,
        createdAt: Date.now(),
        expireTime: Date.now() + 12e4
      };
      saveDB();
      const lobbyBody = `🎴 *LOBBY DOMINO GAPLE (2 - 4 PEMAIN)* 🎴\n\n` + `• 👑 *Host:* @${sender.split("@")[0]}\n` + `• 👥 *Pemain:* 1/4 Terkumpul\n\n` + `Silakan klik tombol di bawah untuk bergabung, bermain 1v1 lawan Bot, atau tambah Bot ke lobi!\n` + `_Batas waktu persiapan: 2 Menit._`;
      const lobbyButtons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤝 Gabung (Join)",
          id: `${prefix}domino join`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎮 Mulai Game",
          id: `${prefix}domino start`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤖 Lawan Bot (Solo)",
          id: `${prefix}domino bot`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🚪 Batal Lobi",
          id: `${prefix}domino stop`
        })
      }];
      await sendCTA(sock, ctx, chatId, {
        text: lobbyBody,
        buttons: lobbyButtons,
        image: bannerImage,
        mentions: [sender],
        quoted: quotedMsg
      });
    } catch (err) {
      console.error("[DOMINO EXECUTE ERROR]:", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};