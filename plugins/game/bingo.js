import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.bingo) global.db.bingo = {};
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
  if (global.db?.bingo?.[chatId]) {
    delete global.db.bingo[chatId];
    saveDB();
  }
}

function rewardWinner(jid, name = "", prizeMoney = 2e4, prizeExp = 600) {
  if (!jid || jid === "BOT") return;
  initDB(jid, name);
  global.db.user[jid].money = (Number(global.db.user[jid].money) || 0) + prizeMoney;
  global.db.user[jid].exp = (Number(global.db.user[jid].exp) || 0) + prizeExp;
  saveDB();
}

function cleanExpiredSessions(currentChatId = null) {
  if (!global.db?.bingo) return;
  const now = Date.now();
  let changed = false;
  for (const [cId, session] of Object.entries(global.db.bingo)) {
    const isExpired = session?.expireTime && now > session.expireTime;
    const isCorrupt = !session || !session.state || !session.players && !session.host;
    if (isExpired || isCorrupt) {
      delete global.db.bingo[cId];
      changed = true;
    }
  }
  if (currentChatId && global.db.bingo[currentChatId]) {
    const s = global.db.bingo[currentChatId];
    if (s.expireTime && now > s.expireTime) {
      delete global.db.bingo[currentChatId];
      changed = true;
    }
  }
  if (changed) saveDB();
}

function purgePlayerFromOtherSessions(playerJid) {
  if (!global.db?.bingo || !playerJid) return;
  let changed = false;
  for (const [cId, session] of Object.entries(global.db.bingo)) {
    if (session.state === "LOBBY") {
      if (session.host === playerJid) {
        delete global.db.bingo[cId];
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

function generateShuffledCard() {
  const nums = Array.from({
    length: 25
  }, (_, i) => i + 1);
  return nums.sort(() => Math.random() - .5);
}

function countCompletedLines(card, calledNumbers) {
  const isMarked = idx => calledNumbers.includes(card[idx]);
  let lines = 0;
  for (let r = 0; r < 5; r++) {
    if ([0, 1, 2, 3, 4].every(c => isMarked(r * 5 + c))) lines++;
  }
  for (let c = 0; c < 5; c++) {
    if ([0, 1, 2, 3, 4].every(r => isMarked(r * 5 + c))) lines++;
  }
  if ([0, 6, 12, 18, 24].every(i => isMarked(i))) lines++;
  if ([4, 8, 12, 16, 20].every(i => isMarked(i))) lines++;
  return lines;
}
const BINGO_LETTERS = ["B", "I", "N", "G", "O"];
async function sendCTA(sock, ctx, targetId, {
  text,
  footer,
  buttons = [],
  image = null,
  quoted = null,
  mentions = []
}) {
  const botName = global.bot?.name || "WudysoftBot";
  const finalFooter = footer || `${botName} • Bingo Liquid Glass`;
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
        list_title: `${botName} • Bingo 5x5`,
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

function generatePlayerCardHTML(player, calledNumbers = []) {
  const completedLines = countCompletedLines(player.card, calledNumbers);
  let lettersHTML = "";
  BINGO_LETTERS.forEach((letter, i) => {
    const isLit = completedLines > i;
    lettersHTML += `<div class="letter-capsule ${isLit ? "lit" : ""}">${letter}</div>`;
  });
  let tilesHTML = "";
  player.card.forEach(num => {
    const isCrossed = calledNumbers.includes(num);
    tilesHTML += `
      <div class="card-tile ${isCrossed ? "crossed" : ""}">
        <span class="num">${num}</span>
        ${isCrossed ? '<div class="glow-cross">✕</div>' : ""}
      </div>
    `;
  });
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    :root {
      --bg-dark: #07090e;
      --glass-surface: rgba(255, 255, 255, 0.035);
      --glass-border: rgba(255, 255, 255, 0.12);
      --glass-specular: inset 0 1px 1px rgba(255, 255, 255, 0.4), inset 0 -1px 2px rgba(0, 0, 0, 0.5);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 720px;
      height: auto;
      background-color: var(--bg-dark);
      font-family: 'Segoe UI', Roboto, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .canvas-wrapper {
      width: 720px;
      min-height: 820px;
      padding: 24px 20px 36px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      background: radial-gradient(circle at 50% 25%, #10192b 0%, #07090e 100%);
      overflow: hidden;
    }
    .ambient-blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(70px);
      opacity: 0.35;
      pointer-events: none;
      z-index: 1;
    }
    .blob-1 { width: 300px; height: 300px; background: radial-gradient(circle, #7928ca, #ff0080); top: 10px; left: 10px; }
    .blob-2 { width: 340px; height: 340px; background: radial-gradient(circle, #0070f3, #00dfd8); bottom: 10px; right: 10px; }

    /* Baris Huruf B-I-N-G-O */
    .letters-row {
      display: flex;
      gap: 12px;
      margin-bottom: 22px;
      z-index: 10;
    }
    .letter-capsule {
      width: 62px;
      height: 62px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 30px;
      font-weight: 900;
      color: #64748b;
      box-shadow: 0 8px 20px rgba(0,0,0,0.5), var(--glass-specular);
      backdrop-filter: blur(12px);
    }
    .letter-capsule.lit {
      background: linear-gradient(135deg, #00f2fe, #4facfe);
      border-color: #fff;
      color: #07090e;
      box-shadow: 0 0 25px rgba(0, 242, 254, 0.8), var(--glass-specular);
      transform: scale(1.06);
    }

    /* Grid Kartu 5x5 */
    .card-grid {
      display: grid;
      grid-template-columns: repeat(5, 88px);
      grid-template-rows: repeat(5, 88px);
      gap: 10px;
      padding: 16px;
      background: var(--glass-surface);
      border: 1px solid var(--glass-border);
      border-radius: 32px;
      backdrop-filter: blur(20px);
      box-shadow: 0 20px 50px rgba(0,0,0,0.8), var(--glass-specular);
      z-index: 10;
    }
    .card-tile {
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      font-size: 26px;
      font-weight: 900;
      color: #f1f5f9;
      box-shadow: var(--glass-specular);
    }
    .card-tile.crossed {
      background: linear-gradient(135deg, rgba(255, 8, 68, 0.25), rgba(255, 177, 153, 0.08));
      border-color: rgba(255, 8, 68, 0.6);
      color: #ffa8b8;
      box-shadow: 0 0 15px rgba(255, 8, 68, 0.4);
    }
    .glow-cross {
      position: absolute;
      font-size: 54px;
      color: #ff0844;
      font-weight: 900;
      text-shadow: 0 0 15px #ff0844;
      opacity: 0.85;
    }

    .footer-pill {
      margin-top: 20px;
      padding: 10px 24px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 800;
      color: #94a3b8;
      box-shadow: var(--glass-specular);
      z-index: 10;
    }
    .footer-pill b { color: #00dfd8; }
  </style>
</head>
<body>
  <div class="canvas-wrapper">
    <div class="ambient-blob blob-1"></div>
    <div class="ambient-blob blob-2"></div>

    <div class="letters-row">
      ${lettersHTML}
    </div>

    <div class="card-grid">
      ${tilesHTML}
    </div>

    <div class="footer-pill">
      Progres Garis: <b>${completedLines} / 5</b> (B-I-N-G-O)
    </div>
  </div>
</body>
</html>`;
}

function generateGroupBoardHTML(session) {
  let ballsHTML = "";
  for (let i = 1; i <= 25; i++) {
    const isCalled = session.calledNumbers.includes(i);
    ballsHTML += `
      <div class="glass-ball ${isCalled ? "called" : ""}">
        <span>${i}</span>
      </div>
    `;
  }
  let playersPodsHTML = "";
  session.players.forEach((p, idx) => {
    const isTurn = p.id === session.turn;
    const isBot = p.id === "BOT";
    const rawName = isBot ? "Bot Liquid" : p.name || p.id.split("@")[0];
    const cleanName = rawName.length > 11 ? rawName.slice(0, 10) + ".." : rawName;
    const lines = countCompletedLines(p.card, session.calledNumbers);
    let miniLetters = "";
    BINGO_LETTERS.forEach((l, i) => {
      miniLetters += `<span class="mini-char ${lines > i ? "lit" : ""}">${l}</span>`;
    });
    playersPodsHTML += `
      <div class="player-pod ${isTurn ? "active-pod" : ""}">
        <div class="pod-header">
          <span class="pod-name">${cleanName}</span>
          ${isTurn ? '<span class="turn-chip">GILIRAN</span>' : ""}
        </div>
        <div class="pod-letters">${miniLetters}</div>
        <div class="pod-score"><b>${lines}</b> / 5 Garis</div>
      </div>
    `;
  });
  const lastNum = session.calledNumbers[session.calledNumbers.length - 1] || "-";
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    :root {
      --bg-dark: #07090e;
      --glass-surface: rgba(255, 255, 255, 0.035);
      --glass-border: rgba(255, 255, 255, 0.12);
      --glass-specular: inset 0 1px 1px rgba(255, 255, 255, 0.4), inset 0 -1px 2px rgba(0, 0, 0, 0.5);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 900px;
      height: auto;
      background-color: var(--bg-dark);
      font-family: 'Segoe UI', Roboto, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .canvas-wrapper {
      width: 900px;
      min-height: 920px;
      padding: 24px 20px 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      background: radial-gradient(circle at 50% 25%, #10192b 0%, #07090e 100%);
      overflow: hidden;
    }
    .ambient-blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.35;
      pointer-events: none;
      z-index: 1;
    }
    .blob-1 { width: 360px; height: 360px; background: radial-gradient(circle, #7928ca, #ff0080); top: 10px; left: 10px; }
    .blob-2 { width: 400px; height: 400px; background: radial-gradient(circle, #0070f3, #00dfd8); bottom: 10px; right: 10px; }

    /* Header Bar */
    .header-bar {
      width: 820px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
      padding: 14px 24px;
      background: var(--glass-surface);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      backdrop-filter: blur(15px);
      box-shadow: 0 10px 25px rgba(0,0,0,0.5), var(--glass-specular);
      z-index: 10;
    }
    .title {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 3px;
      color: #00dfd8;
      text-shadow: 0 0 15px rgba(0, 223, 216, 0.6);
    }
    .last-ball-badge {
      font-size: 15px;
      font-weight: 800;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 170, 64, 0.4);
      color: #ffaa40;
      padding: 6px 18px;
      border-radius: 12px;
      box-shadow: 0 0 15px rgba(255, 170, 64, 0.3);
    }

    /* Player Pods */
    .players-bar {
      display: flex;
      gap: 12px;
      width: 820px;
      margin-bottom: 20px;
      justify-content: center;
      flex-wrap: wrap;
      z-index: 10;
    }
    .player-pod {
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 10px 16px;
      border-radius: 16px;
      min-width: 180px;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 18px rgba(0,0,0,0.4), var(--glass-specular);
      position: relative;
    }
    .player-pod.active-pod {
      border: 1.5px solid #00dfd8;
      background: linear-gradient(135deg, rgba(0, 223, 216, 0.15), rgba(255, 255, 255, 0.03));
      box-shadow: 0 0 20px rgba(0, 223, 216, 0.4);
      transform: translateY(-2px);
    }
    .pod-header { display: flex; justify-content: space-between; align-items: center; }
    .pod-name { font-size: 13px; font-weight: 800; color: #f8fafc; }
    .turn-chip {
      background: #00dfd8;
      color: #07090e;
      font-size: 9px;
      font-weight: 900;
      padding: 2px 7px;
      border-radius: 6px;
    }
    .pod-letters { display: flex; gap: 4px; margin: 2px 0; }
    .mini-char {
      width: 18px;
      height: 18px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 5px;
      font-size: 10px;
      font-weight: 900;
    }
    .mini-char.lit {
      background: #00dfd8;
      border-color: #fff;
      color: #07090e;
      box-shadow: 0 0 10px #00dfd8;
    }
    .pod-score { font-size: 11px; color: #94a3b8; }
    .pod-score b { color: #00dfd8; }

    /* Number Ball Tray 5x5 Glass Spheres */
    .balls-tray {
      display: grid;
      grid-template-columns: repeat(5, 76px);
      gap: 14px;
      padding: 20px;
      background: var(--glass-surface);
      border: 1px solid var(--glass-border);
      border-radius: 30px;
      backdrop-filter: blur(20px);
      box-shadow: 0 25px 60px rgba(0,0,0,0.8), var(--glass-specular);
      z-index: 10;
    }
    .glass-ball {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 900;
      color: #64748b;
      box-shadow: var(--glass-specular);
    }
    .glass-ball.called {
      background: radial-gradient(circle at 35% 35%, #ffd200 0%, #ff8c00 60%, #5c3500 100%);
      border: 1.5px solid #fff;
      color: #fff;
      box-shadow: 0 0 22px rgba(255, 140, 0, 0.85), inset 0 2px 4px rgba(255,255,255,0.8);
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="canvas-wrapper">
    <div class="ambient-blob blob-1"></div>
    <div class="ambient-blob blob-2"></div>

    <div class="header-bar">
      <div class="title">🎱 BINGO LIQUID GLASS</div>
      <div class="last-ball-badge">Angka: [ ${lastNum} ]</div>
    </div>

    <div class="players-bar">
      ${playersPodsHTML}
    </div>

    <div class="balls-tray">
      ${ballsHTML}
    </div>
  </div>
</body>
</html>`;
}
async function sendPrivateCardWithCTA(sock, ctx, playerJid, session, gameChatId, prefix = ".") {
  try {
    if (!playerJid || playerJid === "BOT") return;
    const player = session.players.find(p => p.id === playerJid);
    if (!player) return;
    const isMyTurn = session.turn === playerJid;
    const {
      buffer: imgBuffer
    } = await renderHtmlToImage(generatePlayerCardHTML(player, session.calledNumbers));
    const uncalledNumbers = player.card.filter(num => !session.calledNumbers.includes(num));
    const choiceRows = uncalledNumbers.map(num => ({
      title: `🎱 Pilih Angka #${num}`,
      id: `${prefix}bingo pick ${num} ${gameChatId}`,
      description: isMyTurn ? "Klik untuk memanggil angka ini!" : "⏳ Tunggu giliran Anda"
    }));
    const buttons = [{
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "🎯 PILIH ANGKA BINGO",
        sections: [{
          title: `SISA ANGKA KARTU ANDA (${uncalledNumbers.length})`,
          rows: choiceRows
        }]
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🚪 Nyerah",
        id: `${prefix}bingo stop ${gameChatId}`
      })
    }];
    const completedLines = countCompletedLines(player.card, session.calledNumbers);
    const statusTurn = isMyTurn ? "🟢 *GILIRAN ANDA MEMILIH ANGKA!*" : "⏳ *Menunggu Lawan Memilih Angka...*";
    const bodyText = `🎱 *KARTU BINGO LIQUID GLASS (PC)*\n\n` + `📊 *Progres:* ${completedLines}/5 Garis (B-I-N-G-O)\n` + `📌 *Status:* ${statusTurn}\n\n` + `_Pilih angka pada menu dropdown di bawah:_`;
    await sendCTA(sock, ctx, playerJid, {
      text: bodyText,
      buttons: buttons,
      image: imgBuffer
    });
  } catch (err) {
    console.error("[Bingo Send Private Card Error]:", err?.message || err);
  }
}
async function announceGroupBoard(sock, ctx, chatId, session, extraNote = "", prefix = ".") {
  const {
    buffer: bBuf
  } = await renderHtmlToImage(generateGroupBoardHTML(session));
  let text = `🎱 *ARENA BINGO LIQUID GLASS 5x5*\n\n`;
  if (extraNote) text += `📢 ${extraNote}\n\n`;
  const currPlayer = session.players.find(p => p.id === session.turn);
  const nameTurn = currPlayer.id === "BOT" ? "🤖 Bot Liquid" : `@${currPlayer.id.split("@")[0]}`;
  text += `👉 *Giliran Memanggil Angka:* ${nameTurn}\n`;
  text += `💡 _Buka Private Chat (PC) Anda untuk melihat kartu dan memilih angka via tombol!_`;
  const buttons = [{
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🔄 Perbarui Papan",
      id: `${prefix}bingo board`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🚪 Akhiri Game",
      id: `${prefix}bingo stop ${chatId}`
    })
  }];
  const mentions = session.players.filter(p => p.id !== "BOT").map(p => p.id);
  await sendCTA(sock, ctx, chatId, {
    text: text,
    buttons: buttons,
    image: bBuf,
    mentions: mentions
  });
}
async function handleBingoAction(sock, ctx, msg, sender, rawText) {
  initDB(sender, ctx?.pushName || "");
  cleanExpiredSessions();
  const parts = rawText.split(/\s+/);
  const action = (parts[1] || "").toLowerCase();
  let targetChatId = parts[3] || parts[2];
  if (!targetChatId || !global.db.bingo[targetChatId]) {
    for (const [cId, sess] of Object.entries(global.db.bingo)) {
      if (sess.players?.some(p => p.id === sender)) {
        targetChatId = cId;
        break;
      }
    }
  }
  if (!targetChatId) targetChatId = ctx?.id || sender;
  const session = global.db.bingo[targetChatId];
  if (!session) {
    return ctx?.reply ? ctx.reply("❌ Tidak ada sesi Bingo aktif yang Anda ikuti.") : null;
  }
  const prefix = ctx?.prefix || ".";
  if (action === "stop" || action === "nyerah" || action === "batal") {
    clearSession(targetChatId);
    const restartButtons = [{
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🎱 Main Lagi",
        id: `${prefix}bingo`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🤖 Lawan Bot",
        id: `${prefix}bingo bot`
      })
    }];
    await sendCTA(sock, ctx, targetChatId, {
      text: `🏳️ Permainan Bingo dihentikan karena @${sender.split("@")[0]} menyerah / membatalkan sesi. Meja dibersihkan!`,
      buttons: restartButtons,
      mentions: [sender]
    });
    return;
  }
  if (session.state !== "PLAYING") return;
  if (action === "pick") {
    const num = parseInt(parts[2]);
    if (isNaN(num) || num < 1 || num > 25) {
      return sock.sendMessage(sender, {
        text: "❌ Angka yang dipilih tidak valid (1 - 25)!"
      });
    }
    if (session.turn !== sender) {
      return sock.sendMessage(sender, {
        text: "⏳ Bukan giliran Anda! Tunggu pemain lain memilih angka."
      });
    }
    if (session.calledNumbers.includes(num)) {
      return sock.sendMessage(sender, {
        text: `⚠️ Angka #${num} sudah pernah dipanggil sebelumnya! Pilih angka lain.`
      });
    }
    session.calledNumbers.push(num);
    session.expireTime = Date.now() + 6e5;
    saveDB();
    const note = `@${sender.split("@")[0]} memanggil angka: *[ #${num} ]*!`;
    const winners = [];
    session.players.forEach(p => {
      const lines = countCompletedLines(p.card, session.calledNumbers);
      if (lines >= 5) winners.push(p);
    });
    if (winners.length > 0) {
      clearSession(targetChatId);
      const winnerNames = winners.map(w => w.id === "BOT" ? "🤖 Bot Liquid" : `@${w.id.split("@")[0]}`).join(", ");
      winners.forEach(w => {
        if (w.id !== "BOT") rewardWinner(w.id, w.name, 25e3, 750);
      });
      const winButtons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎱 Main Lagi",
          id: `${prefix}bingo`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤖 Lawan Bot",
          id: `${prefix}bingo bot`
        })
      }];
      await sendCTA(sock, ctx, targetChatId, {
        text: `🎉 *B-I-N-G-O!!* 🏆\n\nSelamat kepada ${winnerNames} yang telah menyelesaikan 5 Garis Penuh!\n\n🎁 *Hadiah Juara:* +Rp 25.000 Money & +750 EXP!`,
        buttons: winButtons,
        mentions: winners.filter(w => w.id !== "BOT").map(w => w.id)
      });
      return;
    }
    const currIdx = session.players.findIndex(p => p.id === sender);
    const nextPlayer = session.players[(currIdx + 1) % session.players.length];
    session.turn = nextPlayer.id;
    saveDB();
    for (const p of session.players) {
      if (p.id !== "BOT") {
        await sendPrivateCardWithCTA(sock, ctx, p.id, session, targetChatId, prefix);
      }
    }
    await announceGroupBoard(sock, ctx, targetChatId, session, note, prefix);
    if (session.turn === "BOT") {
      await handleBotTurn(sock, ctx, targetChatId, session);
    }
  }
}
async function handleBotTurn(sock, ctx, chatId, session) {
  const currentSessionId = session.sessionId;
  setTimeout(async () => {
    try {
      const active = global.db.bingo?.[chatId];
      if (!active || active.sessionId !== currentSessionId || active.state !== "PLAYING" || active.turn !== "BOT") return;
      const bot = active.players.find(p => p.id === "BOT");
      if (!bot) return;
      const uncalled = bot.card.filter(n => !active.calledNumbers.includes(n));
      if (uncalled.length === 0) return;
      let bestPick = uncalled[0];
      let maxLines = -1;
      for (const candidate of uncalled) {
        const testCalled = [...active.calledNumbers, candidate];
        const lines = countCompletedLines(bot.card, testCalled);
        if (lines > maxLines) {
          maxLines = lines;
          bestPick = candidate;
        }
      }
      active.calledNumbers.push(bestPick);
      active.expireTime = Date.now() + 6e5;
      saveDB();
      const note = `🤖 Bot Liquid memanggil angka: *[ #${bestPick} ]*!`;
      const winners = [];
      active.players.forEach(p => {
        const lines = countCompletedLines(p.card, active.calledNumbers);
        if (lines >= 5) winners.push(p);
      });
      const prefix = ctx?.prefix || ".";
      if (winners.length > 0) {
        clearSession(chatId);
        const winnerNames = winners.map(w => w.id === "BOT" ? "🤖 Bot Liquid" : `@${w.id.split("@")[0]}`).join(", ");
        winners.forEach(w => {
          if (w.id !== "BOT") rewardWinner(w.id, w.name, 25e3, 750);
        });
        const endButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎱 Main Lagi",
            id: `${prefix}bingo`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤖 Lawan Bot",
            id: `${prefix}bingo bot`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: `🎉 *B-I-N-G-O!!* 🏆\n\nSelamat kepada ${winnerNames} yang telah menyelesaikan 5 Garis Penuh!`,
          buttons: endButtons,
          mentions: winners.filter(w => w.id !== "BOT").map(w => w.id)
        });
      }
      const currIdx = active.players.findIndex(p => p.id === "BOT");
      const nextPlayer = active.players[(currIdx + 1) % active.players.length];
      active.turn = nextPlayer.id;
      saveDB();
      for (const p of active.players) {
        if (p.id !== "BOT") {
          await sendPrivateCardWithCTA(sock, ctx, p.id, active, chatId, prefix);
        }
      }
      await announceGroupBoard(sock, ctx, chatId, active, note, prefix);
    } catch (e) {
      console.error("[BINGO BOT TURN ERROR]:", e);
    }
  }, 2500);
}
async function startBingoGame(sock, ctx, chatId, playerIds, isBot = false, prefix = ".") {
  clearSession(chatId);
  const players = playerIds.map(pId => {
    initDB(pId);
    purgePlayerFromOtherSessions(pId);
    return {
      id: pId,
      name: pId === "BOT" ? "🤖 Bot Liquid" : global.db?.user?.[pId]?.name || pId.split("@")[0],
      card: generateShuffledCard()
    };
  });
  const now = Date.now();
  global.db.bingo[chatId] = {
    sessionId: now,
    state: "PLAYING",
    isBot: isBot,
    players: players,
    calledNumbers: [],
    turn: players[0].id,
    createdAt: now,
    expireTime: now + 6e5
  };
  saveDB();
  for (const p of players) {
    if (p.id !== "BOT") {
      await sendPrivateCardWithCTA(sock, ctx, p.id, global.db.bingo[chatId], chatId, prefix);
    }
  }
  const startNote = `🎯 Giliran Pertama: ${players[0].id === "BOT" ? "🤖 Bot Liquid" : `@${players[0].id.split("@")[0]}`}`;
  await announceGroupBoard(sock, ctx, chatId, global.db.bingo[chatId], startNote, prefix);
  if (players[0].id === "BOT") {
    await handleBotTurn(sock, ctx, chatId, global.db.bingo[chatId]);
  }
}
export default {
  name: "bingo",
  aliases: ["bingogame", "bingo5x5"],
  description: "Bermain Bingo 5x5 Battle Liquid Glass (Hasil di Grup, Kartu & Pilihan di PC)",
  category: "Game",
  limit: true,
  example: ".bingo | .bingo bot | .bingo @user",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      cleanExpiredSessions();
      const sender = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      if (/^[.#/!]?bingo\s+(pick|stop|nyerah|batal)/i.test(text)) {
        return await handleBingoAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[BINGO BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      const sender = ctx.sender;
      const senderName = ctx.pushName || "Player";
      const rawText = (ctx.query || "").trim();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      initDB(sender, senderName);
      cleanExpiredSessions(chatId);
      if (/^(pick|stop|nyerah|batal)/i.test(rawText)) {
        return await handleBingoAction(sock, ctx, msg, sender, `${prefix}bingo ${rawText}`);
      }
      if (rawText.toLowerCase() === "board" || rawText.toLowerCase() === "papan") {
        let activeCId = chatId;
        if (!global.db.bingo[activeCId]) {
          for (const [cId, sess] of Object.entries(global.db.bingo)) {
            if (sess.players?.some(p => p.id === sender)) {
              activeCId = cId;
              break;
            }
          }
        }
        const session = global.db.bingo[activeCId];
        if (!session || session.state !== "PLAYING") {
          return ctx.reply("❌ Tidak ada sesi permainan Bingo aktif yang Anda ikuti.");
        }
        return await announceGroupBoard(sock, ctx, activeCId, session, "", prefix);
      }
      if (rawText.toLowerCase() === "stop" || rawText.toLowerCase() === "reset") {
        let activeCId = chatId;
        if (!global.db.bingo[activeCId]) {
          for (const [cId, sess] of Object.entries(global.db.bingo)) {
            if (sess.players?.some(p => p.id === sender)) {
              activeCId = cId;
              break;
            }
          }
        }
        if (global.db.bingo[activeCId]) {
          clearSession(activeCId);
          const restartButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🎱 Buat Room Bingo",
              id: `${prefix}bingo`
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🤖 Lawan Bot (Solo)",
              id: `${prefix}bingo bot`
            })
          }];
          return await sendCTA(sock, ctx, activeCId, {
            text: "🚪 Sesi Bingo telah dibersihkan secara tuntas.",
            buttons: restartButtons,
            mentions: [sender],
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi Bingo yang sedang aktif.");
      }
      if (rawText.toLowerCase() === "bot" || rawText.toLowerCase() === "solo") {
        const existing = global.db.bingo[chatId];
        if (existing && existing.state === "PLAYING") {
          return ctx.reply("⚠️ Masih ada permainan yang berlangsung. Ketik `.bingo stop` terlebih dahulu.");
        }
        return await startBingoGame(sock, ctx, chatId, [sender, "BOT"], true, prefix);
      }
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        const pcButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤖 Main Lawan Bot (Solo)",
            id: `${prefix}bingo bot`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: "💡 *Mode Multiplayer (2-4 Pemain) membutuhkan Grup.*\nNamun Anda bisa langsung bermain Solo melawan Bot di Private Chat ini!",
          buttons: pcButtons,
          quoted: quotedMsg
        });
      }
      const mentioned = (ctx.mentionedJid || []).filter(id => id !== sender && !id.includes("bot"));
      if (mentioned.length > 0) {
        const existing = global.db.bingo[chatId];
        if (existing && existing.state === "PLAYING") {
          return ctx.reply("⚠️ Sedang ada permainan aktif. Ketik `.bingo stop` terlebih dahulu.");
        }
        const participants = [sender, ...new Set(mentioned)].slice(0, 4);
        if (participants.length < 2) return ctx.reply("❌ Minimal butuh 2 pemain!");
        return await startBingoGame(sock, ctx, chatId, participants, false, prefix);
      }
      const activeSession = global.db.bingo[chatId];
      if (rawText.toLowerCase() === "join" || rawText.toLowerCase() === "gabung") {
        if (!activeSession || activeSession.state !== "LOBBY") {
          return ctx.reply(`❌ Tidak ada lobby Bingo yang sedang dibuka.`);
        }
        if (activeSession.players.includes(sender)) {
          return ctx.reply("⚠️ Anda sudah terdaftar di lobi ini!");
        }
        if (activeSession.players.length >= 4) {
          return ctx.reply("❌ Lobi sudah penuh (Maksimal 4 pemain)!");
        }
        activeSession.players.push(sender);
        activeSession.expireTime = Date.now() + 12e4;
        saveDB();
        let joinText = `🤝 @${sender.split("@")[0]} bergabung ke Lobi Bingo!\n\n*Pemain Terkumpul (${activeSession.players.length}/4):*\n`;
        activeSession.players.forEach((p, idx) => {
          joinText += `${idx + 1}. @${p.split("@")[0]}\n`;
        });
        const lobbyButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Ikut Gabung",
            id: `${prefix}bingo join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "▶️ Mulai Game",
            id: `${prefix}bingo start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal",
            id: `${prefix}bingo stop`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: joinText,
          buttons: lobbyButtons,
          mentions: activeSession.players
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
          return ctx.reply("❌ Minimal butuh 2 pemain untuk mulai! Atau ketik `.bingo bot` untuk main solo lawan Bot.");
        }
        return await startBingoGame(sock, ctx, chatId, activeSession.players, false, prefix);
      }
      if (activeSession) {
        if (activeSession.state === "PLAYING") {
          return ctx.reply("⚠️ Permainan sedang aktif! Ketik `.bingo stop` untuk mereset.");
        }
        let lobbyText = `📢 *LOBBY BINGO 5x5 MASIH DIBUKA!*\n👑 Host: @${activeSession.host.split("@")[0]}\n\n*Daftar Pemain (${activeSession.players.length}/4):*\n`;
        activeSession.players.forEach((p, idx) => {
          lobbyText += `${idx + 1}. @${p.split("@")[0]}\n`;
        });
        const existingButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Ikut Gabung",
            id: `${prefix}bingo join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "▶️ Mulai Game",
            id: `${prefix}bingo start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal",
            id: `${prefix}bingo stop`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: lobbyText,
          buttons: existingButtons,
          mentions: activeSession.players
        });
      }
      clearSession(chatId);
      purgePlayerFromOtherSessions(sender);
      global.db.bingo[chatId] = {
        sessionId: Date.now(),
        state: "LOBBY",
        host: sender,
        players: [sender],
        createdAt: Date.now(),
        expireTime: Date.now() + 12e4
      };
      saveDB();
      const lobbyBody = `🎱 *LOBBY BINGO LIQUID GLASS (5x5 BATTLE)* 🎱\n\n` + `• 👑 *Host:* @${sender.split("@")[0]}\n` + `• 👥 *Pemain:* 1/4 Terdaftar (2-4 Pemain / Lawan Bot)\n\n` + `Papan bola utama tampil di grup, kartu rahasia dikirim ke PC masing-masing!\n` + `Siapa cepat menyelesaikan 5 Garis (B-I-N-G-O) keluar sebagai pemenang.\n` + `_Batas waktu persiapan: 2 Menit._`;
      const lobbyButtons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤝 Ikut Gabung (Join)",
          id: `${prefix}bingo join`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "▶️ Mulai Permainan",
          id: `${prefix}bingo start`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤖 Lawan Bot (Solo)",
          id: `${prefix}bingo bot`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🚪 Batal Lobi",
          id: `${prefix}bingo stop`
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
      console.error("[BINGO EXECUTE ERROR]:", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};