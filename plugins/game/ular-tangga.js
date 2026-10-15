import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const SNAKES_AND_LADDERS = [{
  start: 29,
  end: 7
}, {
  start: 24,
  end: 12
}, {
  start: 15,
  end: 37
}, {
  start: 23,
  end: 41
}, {
  start: 72,
  end: 36
}, {
  start: 49,
  end: 86
}, {
  start: 90,
  end: 56
}, {
  start: 75,
  end: 64
}, {
  start: 74,
  end: 95
}, {
  start: 91,
  end: 72
}, {
  start: 97,
  end: 78
}];
const BG_IMAGE_URL = "https://i.pinimg.com/originals/2f/68/a7/2f68a7e1eee18556b055418f7305b3c0.jpg";
const PLAYER_ROLES = [{
  key: "red",
  label: "Merah",
  color: "#e74c3c",
  dark: "#c0392b"
}, {
  key: "green",
  label: "Hijau",
  color: "#2ecc71",
  dark: "#27ae60"
}, {
  key: "blue",
  label: "Biru",
  color: "#3498db",
  dark: "#2980b9"
}, {
  key: "yellow",
  label: "Kuning",
  color: "#f1c40f",
  dark: "#d4ac0d"
}];

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.snakes) global.db.snakes = {};
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
  if (global.db?.snakes?.[chatId]) {
    delete global.db.snakes[chatId];
    saveDB();
  }
}

function rewardWinner(jid, name = "", prizeMoney = 15e3, prizeExp = 500) {
  if (!jid || jid === "BOT") return;
  initDB(jid, name);
  global.db.user[jid].money = (Number(global.db.user[jid].money) || 0) + prizeMoney;
  global.db.user[jid].exp = (Number(global.db.user[jid].exp) || 0) + prizeExp;
  saveDB();
}

function checkAndCleanExpiredSessions(currentChatId = null) {
  if (!global.db?.snakes) return;
  const now = Date.now();
  let changed = false;
  for (const [cId, session] of Object.entries(global.db.snakes)) {
    const isExpired = session?.expireTime && now > session.expireTime;
    const isCorrupt = !session || !session.state || !session.players && !session.host;
    if (isExpired || isCorrupt) {
      delete global.db.snakes[cId];
      changed = true;
    }
  }
  if (currentChatId && global.db.snakes[currentChatId]) {
    const s = global.db.snakes[currentChatId];
    if (s.expireTime && now > s.expireTime) {
      delete global.db.snakes[currentChatId];
      changed = true;
    }
  }
  if (changed) saveDB();
}

function purgePlayerFromOtherSessions(playerJid) {
  if (!global.db?.snakes || !playerJid) return;
  let changed = false;
  for (const [cId, session] of Object.entries(global.db.snakes)) {
    if (session.state === "LOBBY") {
      if (session.host === playerJid) {
        delete global.db.snakes[cId];
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

function checkSnakeOrLadder(pos) {
  const portal = SNAKES_AND_LADDERS.find(item => item.start === pos);
  if (!portal) return null;
  const isLadder = portal.end > portal.start;
  return {
    end: portal.end,
    isLadder: isLadder,
    note: isLadder ? `🪜 *Menaiki Tangga!* Naik dari kotak ${portal.start} ke *${portal.end}*!` : `🐍 *Digigit Ular!* Meluncur turun dari kotak ${portal.start} ke *${portal.end}*!`
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
  const finalFooter = footer || `${botName} • Ular Tangga Arena`;
  const formattedButtons = buttons.map(b => {
    if (b.buttonParamsJson) return b;
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
        list_title: `${botName} • Arena 100`,
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

function generateBoardHTML(players, lastDice = null, lastActionNote = "") {
  const tileClusters = {};
  players.forEach(p => {
    const pos = p.position;
    if (!tileClusters[pos]) tileClusters[pos] = [];
    tileClusters[pos].push(p);
  });
  let pawnsHTML = "";
  for (const [posStr, playerList] of Object.entries(tileClusters)) {
    const tileNum = Number(posStr);
    const rowFromBottom = Math.floor((tileNum - 1) / 10);
    const rowFromTop = 9 - rowFromBottom;
    const col = (tileNum - 1) % 10;
    const leftPercent = 3 + col * 9.4;
    const topPercent = 3 + rowFromTop * 9.4;
    const count = playerList.length;
    let insidePawns = "";
    playerList.forEach(p => {
      insidePawns += `
        <div class="among-pawn pawn-size-${count}" style="--pawn-color: ${p.role.color}; --pawn-dark: ${p.role.dark};">
          <div class="pawn-badge">${p.position}</div>
          <div class="among-visor"></div>
          <div class="among-bag"></div>
          <div class="among-legs">
            <div class="leg"></div>
            <div class="leg"></div>
          </div>
        </div>
      `;
    });
    pawnsHTML += `
      <div class="tile-cell" style="top: ${topPercent}%; left: ${leftPercent}%;">
        <div class="pawns-cluster cluster-${count}">
          ${insidePawns}
        </div>
      </div>
    `;
  }
  let playersPodHTML = "";
  players.forEach(p => {
    const isBot = p.id === "BOT";
    const rawName = isBot ? "Bot Among Us" : global.db?.user?.[p.id]?.name || p.id.split("@")[0];
    const cleanName = rawName.length > 13 ? rawName.slice(0, 11) + ".." : rawName;
    playersPodHTML += `
      <div class="player-pod ${p.isTurn ? "pod-active" : ""}">
        <div class="mini-among" style="--pawn-color: ${p.role.color}; --pawn-dark: ${p.role.dark};">
          <div class="mini-visor"></div>
          <div class="mini-bag"></div>
        </div>
        <div class="pod-meta">
          <div class="pod-name">${cleanName}</div>
          <div class="pod-sub">Kotak: <b>${p.position}</b>/100</div>
        </div>
        ${p.isTurn ? '<div class="turn-badge">GILIRAN</div>' : ""}
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
      width: 980px;
      height: auto;
      background: #0b1120;
      font-family: 'Segoe UI', Roboto, sans-serif;
      color: #fff;
    }
    .wrapper {
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: radial-gradient(circle at 50% 10%, #1e293b 0%, #0b1120 100%);
    }
    .header-bar {
      width: 860px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding: 12px 24px;
      background: rgba(15, 23, 42, 0.85);
      border: 2px solid rgba(255, 215, 0, 0.4);
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    .title {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #ffd700;
      text-shadow: 0 0 10px rgba(255, 215, 0, 0.4);
    }
    .dice-badge {
      font-size: 18px;
      font-weight: 800;
      background: #1e293b;
      border: 2px solid #38bdf8;
      padding: 6px 18px;
      border-radius: 12px;
      color: #38bdf8;
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.3);
    }
    .players-list {
      display: flex;
      gap: 12px;
      width: 860px;
      margin-bottom: 16px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .player-pod {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #1e293b;
      border: 1.5px solid #334155;
      padding: 8px 16px;
      border-radius: 14px;
      min-width: 175px;
      position: relative;
    }
    .player-pod.pod-active {
      border: 2px solid #ffd700;
      background: linear-gradient(145deg, #1e293b, #334155);
      box-shadow: 0 0 16px rgba(255, 215, 0, 0.45);
      transform: translateY(-2px);
    }
    .pod-meta { display: flex; flex-direction: column; }
    .pod-name { font-size: 13px; font-weight: 800; color: #f8fafc; }
    .pod-sub { font-size: 12px; color: #94a3b8; margin-top: 2px; }
    .turn-badge {
      position: absolute;
      top: -8px;
      right: 8px;
      background: #ffd700;
      color: #000;
      font-size: 9px;
      font-weight: 900;
      padding: 2px 8px;
      border-radius: 6px;
    }

    /* MINI AMONG US (HEADER AVATAR) */
    .mini-among {
      width: 26px;
      height: 34px;
      background: var(--pawn-color);
      border-radius: 13px 13px 5px 5px;
      border: 2px solid #111;
      position: relative;
      box-shadow: inset -2.5px -2.5px 0 var(--pawn-dark);
      flex-shrink: 0;
    }
    .mini-visor {
      position: absolute;
      top: 6px;
      left: 3px;
      width: 14px;
      height: 9px;
      background: #81ecec;
      border-radius: 5px;
      border: 1.5px solid #111;
      box-shadow: inset 1px 1px 0 #fff;
    }
    .mini-bag {
      position: absolute;
      top: 8px;
      right: -5px;
      width: 4px;
      height: 16px;
      background: var(--pawn-dark);
      border: 1.5px solid #111;
      border-left: none;
      border-radius: 0 3px 3px 0;
    }

    /* PAPAN & GRID COORD */
    .board-container {
      width: 860px;
      height: 860px;
      position: relative;
      border: 10px solid #1e293b;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 15px 40px rgba(0,0,0,0.8);
      background-image: url('${BG_IMAGE_URL}');
      background-size: 100% 100%;
      background-repeat: no-repeat;
    }
    .tile-cell {
      position: absolute;
      width: 9.4%;
      height: 9.4%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    .pawns-cluster {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      width: 100%;
      height: 100%;
      padding: 2px;
      gap: 3px;
    }

    /* BASE AMONG US PAWN */
    .among-pawn {
      position: relative;
      background: var(--pawn-color);
      box-shadow: 0 4px 8px rgba(0,0,0,0.8), inset -3px -3px 0 var(--pawn-dark);
      display: flex;
      justify-content: center;
    }
    .among-visor {
      position: absolute;
      background: #81ecec;
      box-shadow: inset 1.5px 1.5px 0 #fff;
    }
    .among-bag {
      position: absolute;
      background: var(--pawn-dark);
      border-left: none !important;
    }
    .among-legs {
      position: absolute;
      display: flex;
      justify-content: space-between;
    }
    .leg {
      background: var(--pawn-dark);
      border-top: none !important;
    }
    .pawn-badge {
      position: absolute;
      background: #111;
      color: #fff;
      font-weight: 900;
      border: 1.5px solid var(--pawn-color);
      white-space: nowrap;
      box-shadow: 0 2px 5px rgba(0,0,0,0.8);
      z-index: 15;
    }

    /* UKURAN OTOMATIS: 1 PEMAIN (STANDAR) */
    .pawn-size-1 {
      width: 32px;
      height: 40px;
      border-radius: 14px 14px 6px 6px;
      border: 2.5px solid #111;
    }
    .pawn-size-1 .among-visor {
      top: 7px; left: 4px; width: 17px; height: 11px; border-radius: 6px; border: 2px solid #111;
    }
    .pawn-size-1 .among-bag {
      top: 10px; right: -6px; width: 5px; height: 18px; border-radius: 0 4px 4px 0; border: 2px solid #111;
    }
    .pawn-size-1 .among-legs {
      bottom: -5px; left: 3px; width: 22px;
    }
    .pawn-size-1 .leg {
      width: 8px; height: 6px; border: 1.5px solid #111; border-radius: 0 0 3px 3px;
    }
    .pawn-size-1 .pawn-badge {
      top: -12px; font-size: 9px; padding: 0 5px; border-radius: 6px;
    }

    /* UKURAN OTOMATIS: 2 PEMAIN BERDAMPINGAN */
    .pawn-size-2 {
      width: 25px;
      height: 32px;
      border-radius: 11px 11px 5px 5px;
      border: 2px solid #111;
    }
    .pawn-size-2 .among-visor {
      top: 5px; left: 3px; width: 13px; height: 9px; border-radius: 5px; border: 1.5px solid #111;
    }
    .pawn-size-2 .among-bag {
      top: 8px; right: -5px; width: 4px; height: 14px; border-radius: 0 3px 3px 0; border: 1.5px solid #111;
    }
    .pawn-size-2 .among-legs {
      bottom: -4px; left: 2px; width: 17px;
    }
    .pawn-size-2 .leg {
      width: 6px; height: 5px; border: 1.5px solid #111; border-radius: 0 0 3px 3px;
    }
    .pawn-size-2 .pawn-badge {
      top: -10px; font-size: 8px; padding: 0 4px; border-radius: 5px;
    }

    /* UKURAN OTOMATIS: 3 - 4 PEMAIN DALAM 1 KOTAK */
    .pawn-size-3, .pawn-size-4 {
      width: 20px;
      height: 26px;
      border-radius: 9px 9px 4px 4px;
      border: 1.5px solid #111;
    }
    .pawn-size-3 .among-visor, .pawn-size-4 .among-visor {
      top: 4px; left: 2px; width: 10px; height: 7px; border-radius: 4px; border: 1px solid #111;
    }
    .pawn-size-3 .among-bag, .pawn-size-4 .among-bag {
      top: 6px; right: -4px; width: 3px; height: 11px; border-radius: 0 2px 2px 0; border: 1px solid #111;
    }
    .pawn-size-3 .among-legs, .pawn-size-4 .among-legs {
      bottom: -3px; left: 2px; width: 13px;
    }
    .pawn-size-3 .leg, .pawn-size-4 .leg {
      width: 4.5px; height: 4px; border: 1px solid #111; border-radius: 0 0 2px 2px;
    }
    .pawn-size-3 .pawn-badge, .pawn-size-4 .pawn-badge {
      top: -9px; font-size: 7px; padding: 0 3px; border-radius: 4px;
    }

    .note-box {
      width: 860px;
      text-align: center;
      margin-top: 16px;
      font-size: 14px;
      font-weight: 700;
      color: #e2e8f0;
      background: rgba(15, 23, 42, 0.75);
      padding: 12px;
      border-radius: 12px;
      border-left: 5px solid #38bdf8;
      box-shadow: 0 4px 15px rgba(0,0,0,0.4);
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header-bar">
      <div class="title">🎲 ULAR TANGGA ARENA 100 🎲</div>
      <div class="dice-badge">Dadu: 🎲 <b>${lastDice || "-"}</b></div>
    </div>

    <div class="players-list">
      ${playersPodHTML}
    </div>

    <div class="board-container">
      ${pawnsHTML}
    </div>

    ${lastActionNote ? `<div class="note-box">📢 ${lastActionNote}</div>` : ""}
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

function getNextTurn(players, currentId) {
  const idx = players.findIndex(p => p.id === currentId);
  const nextIdx = (idx + 1) % players.length;
  return players[nextIdx].id;
}
async function renderAndSendBoard(sock, ctx, chatId, session, extraNote = "") {
  const prefix = ctx?.prefix || ".";
  const playersData = session.players.map(p => ({
    ...p,
    isTurn: p.id === session.turn
  }));
  const html = generateBoardHTML(playersData, session.lastDice, extraNote);
  const {
    buffer: imgBuffer
  } = await renderHtmlToImage(html);
  const isCurrentBot = session.turn === "BOT";
  const mentions = session.players.filter(p => p.id !== "BOT").map(p => p.id);
  let currentName = "🤖 Bot AI";
  if (!isCurrentBot) {
    currentName = `@${session.turn.split("@")[0]}`;
  }
  let text = `🎲 *ARENA ULAR TANGGA ROYALE*\n\n`;
  if (extraNote) text += `📢 ${extraNote}\n\n`;
  text += `👉 *Giliran Melangkah:* ${currentName}\n`;
  text += `🎯 *Target:* Tepat mendarat di Kotak 100!\n`;
  text += `_Klik tombol di bawah untuk mengocok dadu._`;
  const buttons = [{
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🎲 Kocok Dadu (Roll)",
      id: `${prefix}ulartangga roll`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🚪 Nyerah / Stop",
      id: `${prefix}ulartangga stop`
    })
  }];
  await sendCTA(sock, ctx, chatId, {
    text: text,
    buttons: buttons,
    image: imgBuffer,
    mentions: mentions
  });
}
async function handleRollDice(sock, ctx, chatId, sender) {
  const session = global.db.snakes?.[chatId];
  if (!session || session.state !== "PLAYING") {
    return ctx.reply("❌ Tidak ada sesi permainan aktif di grup ini.");
  }
  if (session.turn !== sender) {
    return ctx.reply(`⏳ Bukan giliran Anda! Giliran saat ini: @${session.turn.split("@")[0]}`, {
      mentions: [session.turn]
    });
  }
  session.expireTime = Date.now() + 6e5;
  const player = session.players.find(p => p.id === sender);
  const roll = Math.floor(Math.random() * 6) + 1;
  session.lastDice = roll;
  let targetPos = player.position + roll;
  let bounceNote = "";
  if (targetPos > 100) {
    const excess = targetPos - 100;
    targetPos = 100 - excess;
    bounceNote = ` (Memantul ${excess} kotak mundur!)`;
  }
  let actionNote = `@${sender.split("@")[0]} melempar dadu *${roll}* ➔ ke kotak *${targetPos}*${bounceNote}.`;
  const portal = checkSnakeOrLadder(targetPos);
  if (portal) {
    actionNote += `\n${portal.note}`;
    targetPos = portal.end;
  }
  player.position = targetPos;
  if (player.position === 100) {
    clearSession(chatId);
    const prizeMoney = session.players.length > 2 ? 2e4 : 1e4;
    const prizeExp = session.players.length > 2 ? 600 : 300;
    rewardWinner(sender, ctx?.pushName || "", prizeMoney, prizeExp);
    const winButtons = [{
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🎮 Main Lagi",
        id: `${ctx?.prefix || "."}ulartangga`
      })
    }];
    return await sendCTA(sock, ctx, chatId, {
      text: `🎉 *SELAMAT!* @${sender.split("@")[0]} berhasil mencapai kotak 100 dan keluar sebagai *JUARA*! 🏆\n\n🎁 *Hadiah:* +Rp ${prizeMoney.toLocaleString("id-ID")} Money & +${prizeExp} EXP!`,
      buttons: winButtons,
      mentions: [sender]
    });
  }
  session.turn = getNextTurn(session.players, sender);
  saveDB();
  await renderAndSendBoard(sock, ctx, chatId, session, actionNote);
  if (session.turn === "BOT") {
    await handleBotTurn(sock, ctx, chatId, session);
  }
}
async function handleBotTurn(sock, ctx, chatId, session) {
  const currentSessionId = session.sessionId;
  setTimeout(async () => {
    try {
      const active = global.db.snakes?.[chatId];
      if (!active || active.sessionId !== currentSessionId || active.state !== "PLAYING") return;
      const bot = active.players.find(p => p.id === "BOT");
      if (!bot || active.turn !== "BOT") return;
      const roll = Math.floor(Math.random() * 6) + 1;
      active.lastDice = roll;
      let targetPos = bot.position + roll;
      let bounceNote = "";
      if (targetPos > 100) {
        const excess = targetPos - 100;
        targetPos = 100 - excess;
        bounceNote = ` (Memantul ${excess} kotak mundur!)`;
      }
      let actionNote = `🤖 *Bot AI* melempar dadu *${roll}* ➔ ke kotak *${targetPos}*${bounceNote}.`;
      const portal = checkSnakeOrLadder(targetPos);
      if (portal) {
        actionNote += `\n${portal.note}`;
        targetPos = portal.end;
      }
      bot.position = targetPos;
      if (bot.position === 100) {
        clearSession(chatId);
        const retryButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤖 Lawan Balik",
            id: `${ctx?.prefix || "."}ulartangga bot`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: `🤖 *BOT MENANG!* Bot berhasil mencapai kotak 100 lebih dulu. Coba lagi!`,
          buttons: retryButtons
        });
      }
      active.turn = getNextTurn(active.players, "BOT");
      saveDB();
      await renderAndSendBoard(sock, ctx, chatId, active, actionNote);
    } catch (err) {
      console.error("[BOT ROLL ERROR]:", err);
    }
  }, 2200);
}
async function startGame(sock, ctx, chatId, playerIds, isBot = false) {
  clearSession(chatId);
  const players = [];
  playerIds.forEach((pId, idx) => {
    initDB(pId);
    purgePlayerFromOtherSessions(pId);
    players.push({
      id: pId,
      position: 1,
      role: PLAYER_ROLES[idx]
    });
  });
  const now = Date.now();
  global.db.snakes[chatId] = {
    sessionId: now,
    state: "PLAYING",
    isBot: isBot,
    players: players,
    turn: players[0].id,
    lastDice: null,
    createdAt: now,
    expireTime: now + 6e5
  };
  saveDB();
  await renderAndSendBoard(sock, ctx, chatId, global.db.snakes[chatId], "🏁 Permainan dimulai! Semua pemain siap di Kotak 1.");
}
export default {
  name: "ulartangga",
  aliases: ["snakes", "snakeladder", "ut"],
  description: "Bermain Ular Tangga Royale 100 Kotak dengan Grafis Full CSS Among Us",
  category: "Game",
  limit: true,
  example: ".ulartangga",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      checkAndCleanExpiredSessions();
      const sender = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !global.db?.snakes?.[chatId]) return;
      if (/^[.#/!]?(ulartangga|snakes|ut)\s+(roll|kocok|dadu)/i.test(text)) {
        return await handleRollDice(sock, ctx, chatId, sender);
      }
    } catch (e) {
      console.error("[ULARTANGGA BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ Game Ular Tangga hanya dapat dimainkan di dalam Grup!");
      }
      const chatId = ctx.id;
      const sender = ctx.sender;
      const senderName = ctx.pushName || "Player";
      const rawText = (ctx.query || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const bannerImage = BG_IMAGE_URL;
      initDB(sender, senderName);
      checkAndCleanExpiredSessions(chatId);
      if (rawText === "roll" || rawText === "kocok" || rawText === "dadu") {
        return await handleRollDice(sock, ctx, chatId, sender);
      }
      if (rawText === "stop" || rawText === "batal" || rawText === "reset") {
        if (global.db.snakes[chatId]) {
          clearSession(chatId);
          const restartButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🎮 Buat Room Baru",
              id: `${prefix}ulartangga`
            })
          }];
          return await sendCTA(sock, ctx, chatId, {
            text: `🚪 Sesi Ular Tangga telah dihentikan dan dibersihkan oleh @${sender.split("@")[0]}.`,
            buttons: restartButtons,
            mentions: [sender]
          });
        }
        return ctx.reply("❌ Tidak ada sesi yang sedang berlangsung.");
      }
      if (rawText === "bot" || rawText === "solo") {
        const existing = global.db.snakes[chatId];
        if (existing && existing.state === "PLAYING") {
          return ctx.reply("⚠️ Permainan masih berjalan! Ketik `.ulartangga stop` terlebih dahulu.");
        }
        return await startGame(sock, ctx, chatId, [sender, "BOT"], true);
      }
      const mentioned = (ctx.mentionedJid || []).filter(id => id !== sender && !id.includes("bot"));
      if (mentioned.length > 0) {
        const existing = global.db.snakes[chatId];
        if (existing && existing.state === "PLAYING") {
          return ctx.reply("⚠️ Permainan masih berlangsung di grup ini!");
        }
        const participants = [sender, ...new Set(mentioned)].slice(0, 4);
        return await startGame(sock, ctx, chatId, participants, false);
      }
      const activeSession = global.db.snakes[chatId];
      if (rawText === "join" || rawText === "gabung") {
        if (!activeSession || activeSession.state !== "LOBBY") {
          return ctx.reply("❌ Tidak ada lobby yang sedang terbuka.");
        }
        if (activeSession.players.includes(sender)) {
          return ctx.reply("⚠️ Anda sudah terdaftar di dalam lobi!");
        }
        if (activeSession.players.length >= 4) {
          return ctx.reply("❌ Lobi sudah penuh (Maksimal 4 pemain)!");
        }
        activeSession.players.push(sender);
        activeSession.expireTime = Date.now() + 12e4;
        saveDB();
        let joinText = `🤝 @${sender.split("@")[0]} bergabung ke lobby!\n\n*Pemain Terdaftar (${activeSession.players.length}/4):*\n`;
        activeSession.players.forEach((p, idx) => {
          joinText += `${idx + 1}. [${PLAYER_ROLES[idx].label}] @${p.split("@")[0]}\n`;
        });
        const lobbyButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Ikut Gabung",
            id: `${prefix}ulartangga join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "▶️ Mulai Game",
            id: `${prefix}ulartangga start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal",
            id: `${prefix}ulartangga stop`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: joinText,
          buttons: lobbyButtons,
          mentions: activeSession.players
        });
      }
      if (rawText === "start" || rawText === "mulai") {
        if (!activeSession || activeSession.state !== "LOBBY") {
          return ctx.reply("❌ Tidak ada lobby yang menunggu dimulai.");
        }
        if (activeSession.host !== sender) {
          return ctx.reply(`❌ Hanya host @${activeSession.host.split("@")[0]} yang bisa memulai!`, {
            mentions: [activeSession.host]
          });
        }
        if (activeSession.players.length < 2) {
          return ctx.reply("❌ Minimal butuh 2 pemain untuk memulai! Atau ketik `.ulartangga bot` untuk main solo.");
        }
        return await startGame(sock, ctx, chatId, activeSession.players, false);
      }
      if (activeSession) {
        if (activeSession.state === "PLAYING") {
          return ctx.reply("⚠️ Permainan sedang aktif! Ketik `.ulartangga roll` untuk giliran atau `.ulartangga stop` untuk berhenti.");
        }
        let lobbyText = `📢 *LOBBY ULAR TANGGA MASIH DIBUKA!*\n👑 Host: @${activeSession.host.split("@")[0]}\n\n*Pemain (${activeSession.players.length}/4):*\n`;
        activeSession.players.forEach((p, idx) => {
          lobbyText += `${idx + 1}. [${PLAYER_ROLES[idx].label}] @${p.split("@")[0]}\n`;
        });
        const lobbyButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Gabung",
            id: `${prefix}ulartangga join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "▶️ Mulai Game",
            id: `${prefix}ulartangga start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal",
            id: `${prefix}ulartangga stop`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: lobbyText,
          buttons: lobbyButtons,
          mentions: activeSession.players
        });
      }
      clearSession(chatId);
      purgePlayerFromOtherSessions(sender);
      global.db.snakes[chatId] = {
        sessionId: Date.now(),
        state: "LOBBY",
        host: sender,
        players: [sender],
        createdAt: Date.now(),
        expireTime: Date.now() + 12e4
      };
      saveDB();
      const openBody = `🎲 *LOBBY ULAR TANGGA ROYALE (100 KOTAK)* 🎲\n\n` + `• 👑 *Host:* @${sender.split("@")[0]}\n` + `• 👥 *Pemain:* 1/4 (2-4 Pemain atau Lawan Bot)\n` + `• 🎯 *Aturan:* Siapa cepat sampai pas di kotak 100 dialah juaranya!\n\n` + `_Silakan pilih aksi melalui tombol interaktif di bawah:_`;
      const lobbyButtons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤝 Ikut Gabung (Join)",
          id: `${prefix}ulartangga join`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "▶️ Mulai Permainan",
          id: `${prefix}ulartangga start`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤖 Lawan Bot (Solo)",
          id: `${prefix}ulartangga bot`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🚪 Tutup Lobi",
          id: `${prefix}ulartangga stop`
        })
      }];
      await sendCTA(sock, ctx, chatId, {
        text: openBody,
        buttons: lobbyButtons,
        image: bannerImage,
        mentions: [sender],
        quoted: quotedMsg
      });
    } catch (err) {
      console.error("[ULARTANGGA ERROR]:", err);
      ctx.reply(`❌ Terjadi kendala: ${err.message}`);
    }
  }
};