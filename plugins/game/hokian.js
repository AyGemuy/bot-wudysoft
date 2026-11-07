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
  if (!global.db.hokian) global.db.hokian = {};
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

function clearSession(chatId) {
  if (global.db?.hokian?.[chatId]) {
    delete global.db.hokian[chatId];
    saveDB();
  }
}

function rewardPlayer(jid, name = "", money = 0, exp = 0) {
  if (!jid) return;
  initDB(jid, name);
  global.db.user[jid].money = Math.max(0, (Number(global.db.user[jid].money) || 0) + money);
  global.db.user[jid].exp = Math.max(0, (Number(global.db.user[jid].exp) || 0) + exp);
  saveDB();
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

function generateMysteryBoxes(totalBoxes = 16) {
  const boxes = [{
    type: "BOMB",
    value: 0,
    label: "💣 BOM!",
    isBomb: true
  }, {
    type: "BOMB",
    value: 0,
    label: "💣 BOM!",
    isBomb: true
  }, {
    type: "TRAP",
    value: 0,
    label: "🧨 TRAP -50%",
    isTrap: true
  }, {
    type: "SHIELD",
    value: 500,
    exp: 50,
    label: "🛡️ PERISAI"
  }, {
    type: "RADAR",
    value: 750,
    exp: 60,
    label: "🔮 X-RAY BOM"
  }, {
    type: "CLOVER",
    value: 1e3,
    exp: 80,
    label: "🍀 +1 GILIRAN"
  }, {
    type: "JACKPOT",
    value: 12500,
    exp: 400,
    label: "👑 MEGA JACKPOT"
  }, {
    type: "MULTI_3X",
    value: 3,
    label: "⚡ MULTI x3"
  }, {
    type: "MULTI_2X",
    value: 2,
    label: "⚡ MULTI x2"
  }, {
    type: "EXP_STAR",
    value: 1500,
    exp: 650,
    label: "🌟 EXP SULTAN"
  }, {
    type: "GOLD",
    value: 5e3,
    exp: 200,
    label: "💰 PUNDI EMAS"
  }, {
    type: "MONEY",
    value: 3500,
    exp: 150,
    label: "💎 BERLIAN"
  }, {
    type: "MONEY",
    value: 2500,
    exp: 120,
    label: "💎 BERLIAN"
  }, {
    type: "MONEY",
    value: 2e3,
    exp: 100,
    label: "💎 BERLIAN"
  }, {
    type: "MONEY",
    value: 1500,
    exp: 80,
    label: "💎 KOIN EMAS"
  }, {
    type: "MONEY",
    value: 1e3,
    exp: 50,
    label: "💎 KOIN EMAS"
  }];
  if (totalBoxes < 16) {
    boxes.splice(12, totalBoxes - 12);
  }
  boxes.sort(() => Math.random() - .5);
  return boxes.map((item, index) => ({
    id: index + 1,
    opened: false,
    revealed: false,
    openedBy: null,
    ...item
  }));
}

function generateBoardHTML(session, lastActionText = "") {
  const boxes = session.boxes || [];
  let boxesHTML = "";
  boxes.forEach(b => {
    if (!b.opened) {
      if (b.revealed) {
        boxesHTML += `
          <div class="box-card revealed">
            <div class="box-num">#${b.id}</div>
            <div class="box-icon">⚠️</div>
            <div class="box-status">AWAS BOM!</div>
          </div>
        `;
      } else {
        boxesHTML += `
          <div class="box-card closed">
            <div class="box-num">#${b.id}</div>
            <div class="box-icon">🎁</div>
            <div class="box-status">MISTERI</div>
          </div>
        `;
      }
    } else if (b.type === "BOMB") {
      boxesHTML += `
        <div class="box-card bomb">
          <div class="box-num">#${b.id}</div>
          <div class="box-icon">💥</div>
          <div class="box-status">BOOM!</div>
        </div>
      `;
    } else if (b.type === "TRAP") {
      boxesHTML += `
        <div class="box-card trap">
          <div class="box-num">#${b.id}</div>
          <div class="box-icon">🧨</div>
          <div class="box-status">-50% POIN</div>
        </div>
      `;
    } else if (b.type === "SHIELD") {
      boxesHTML += `
        <div class="box-card shield">
          <div class="box-num">#${b.id}</div>
          <div class="box-icon">🛡️</div>
          <div class="box-status">PERISAI</div>
        </div>
      `;
    } else if (b.type === "RADAR") {
      boxesHTML += `
        <div class="box-card radar">
          <div class="box-num">#${b.id}</div>
          <div class="box-icon">🔮</div>
          <div class="box-status">X-RAY AKTIF</div>
        </div>
      `;
    } else if (b.type === "CLOVER") {
      boxesHTML += `
        <div class="box-card clover">
          <div class="box-num">#${b.id}</div>
          <div class="box-icon">🍀</div>
          <div class="box-status">+1 GILIRAN</div>
        </div>
      `;
    } else if (b.type === "JACKPOT") {
      boxesHTML += `
        <div class="box-card jackpot">
          <div class="box-num">#${b.id}</div>
          <div class="box-icon">👑</div>
          <div class="box-status">+12.500</div>
        </div>
      `;
    } else if (b.type === "MULTI_3X") {
      boxesHTML += `
        <div class="box-card multi3">
          <div class="box-num">#${b.id}</div>
          <div class="box-icon">⚡</div>
          <div class="box-status">x3 TRIPLE</div>
        </div>
      `;
    } else if (b.type === "MULTI_2X") {
      boxesHTML += `
        <div class="box-card multi">
          <div class="box-num">#${b.id}</div>
          <div class="box-icon">⚡</div>
          <div class="box-status">x2 DOUBLE</div>
        </div>
      `;
    } else if (b.type === "EXP_STAR") {
      boxesHTML += `
        <div class="box-card expstar">
          <div class="box-num">#${b.id}</div>
          <div class="box-icon">🌟</div>
          <div class="box-status">+650 EXP</div>
        </div>
      `;
    } else if (b.type === "GOLD") {
      boxesHTML += `
        <div class="box-card gold">
          <div class="box-num">#${b.id}</div>
          <div class="box-icon">💰</div>
          <div class="box-status">+5.000</div>
        </div>
      `;
    } else {
      boxesHTML += `
        <div class="box-card safe">
          <div class="box-num">#${b.id}</div>
          <div class="box-icon">💎</div>
          <div class="box-status">+${b.value.toLocaleString("id-ID")}</div>
        </div>
      `;
    }
  });
  let playersPodHTML = "";
  session.players.forEach((p, idx) => {
    const isCurrent = session.state === "PLAYING" && session.players[session.turnIndex]?.id === p.id;
    let statusBadge = "";
    if (p.status === "CLAIMED") {
      statusBadge = '<span class="badge safe">KLAIM 💰</span>';
    } else if (p.status === "BOOM") {
      statusBadge = '<span class="badge boom">GUGUR 💀</span>';
    } else {
      statusBadge = isCurrent ? '<span class="badge turn">GILIRAN</span>' : '<span class="badge wait">BERMAIN</span>';
    }
    const shieldBadge = p.shield > 0 ? `<span class="shield-tag">🛡️ x${p.shield}</span>` : "";
    playersPodHTML += `
      <div class="player-card ${isCurrent ? "active-player" : ""}">
        <div class="player-header">
          <div class="player-name">${idx + 1}. ${p.name}</div>
          <div class="header-badges">${shieldBadge}${statusBadge}</div>
        </div>
        <div class="player-body">
          <div class="score-line">Kantong: <b class="gold">Rp ${p.accumulatedMoney.toLocaleString("id-ID")}</b></div>
          <div class="score-line">EXP: <b class="cyan">+${p.accumulatedExp}</b></div>
        </div>
      </div>
    `;
  });
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 960px;
      height: 600px;
      background: #07090e;
      font-family: 'Plus Jakarta Sans', sans-serif;
      color: #fff;
      overflow: hidden;
    }
    .wrapper {
      position: relative;
      width: 960px;
      height: 600px;
      padding: 22px;
      background: radial-gradient(circle at 50% 10%, #1e1b4b 0%, #090d16 65%, #05070c 100%);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid rgba(99, 102, 241, 0.25);
      padding-bottom: 12px;
    }
    .title {
      font-family: 'Orbitron', sans-serif;
      font-size: 24px;
      font-weight: 900;
      color: #f59e0b;
      letter-spacing: 2px;
      text-shadow: 0 0 15px rgba(245, 158, 11, 0.5);
    }
    .meta-tag {
      font-family: 'Orbitron', sans-serif;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid #6366f1;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 13px;
      color: #818cf8;
      font-weight: 800;
    }
    .main-body {
      display: flex;
      gap: 18px;
      align-items: center;
      margin: 10px 0;
    }
    .grid-container {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      width: 630px;
      background: rgba(0, 0, 0, 0.45);
      padding: 14px;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 0 25px rgba(0, 0, 0, 0.8);
    }
    .box-card {
      height: 94px;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      box-shadow: 0 6px 15px rgba(0, 0, 0, 0.5);
    }
    .box-card.closed {
      background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
      border: 2px solid #3b82f6;
    }
    .box-card.revealed {
      background: linear-gradient(145deg, #451a03 0%, #290e02 100%);
      border: 2px solid #ea580c;
      animation: pulse 1s infinite alternate;
    }
    .box-card.safe {
      background: linear-gradient(145deg, #064e3b 0%, #022c22 100%);
      border: 2px solid #10b981;
    }
    .box-card.gold {
      background: linear-gradient(145deg, #713f12 0%, #422006 100%);
      border: 2px solid #eab308;
    }
    .box-card.jackpot {
      background: linear-gradient(145deg, #78350f 0%, #451a03 100%);
      border: 2px solid #f59e0b;
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.6);
    }
    .box-card.multi {
      background: linear-gradient(145deg, #4c1d95 0%, #2e1065 100%);
      border: 2px solid #a855f7;
    }
    .box-card.multi3 {
      background: linear-gradient(145deg, #831843 0%, #500724 100%);
      border: 2px solid #ec4899;
      box-shadow: 0 0 16px rgba(236, 72, 153, 0.5);
    }
    .box-card.shield {
      background: linear-gradient(145deg, #083344 0%, #041f2d 100%);
      border: 2px solid #06b6d4;
      box-shadow: 0 0 15px rgba(6, 182, 212, 0.4);
    }
    .box-card.radar {
      background: linear-gradient(145deg, #312e81 0%, #1e1b4b 100%);
      border: 2px solid #6366f1;
    }
    .box-card.clover {
      background: linear-gradient(145deg, #14532d 0%, #052e16 100%);
      border: 2px solid #22c55e;
    }
    .box-card.expstar {
      background: linear-gradient(145deg, #1e1b4b 0%, #0f172a 100%);
      border: 2px solid #38bdf8;
    }
    .box-card.trap {
      background: linear-gradient(145deg, #7c2d12 0%, #431407 100%);
      border: 2px solid #f97316;
    }
    .box-card.bomb {
      background: linear-gradient(145deg, #7f1d1d 0%, #450a0a 100%);
      border: 2px solid #ef4444;
      box-shadow: 0 0 18px rgba(239, 68, 68, 0.5);
    }
    .box-num {
      position: absolute;
      top: 4px;
      left: 6px;
      font-size: 10px;
      font-weight: 800;
      color: #94a3b8;
    }
    .box-icon {
      font-size: 30px;
      margin-bottom: 2px;
    }
    .box-status {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .players-sidebar {
      width: 275px;
      display: flex;
      flex-direction: column;
      gap: 9px;
    }
    .player-card {
      background: rgba(15, 23, 42, 0.8);
      border: 1.5px solid #334155;
      border-radius: 12px;
      padding: 9px 12px;
    }
    .player-card.active-player {
      border-color: #f59e0b;
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.45);
    }
    .player-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3px;
    }
    .header-badges {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .player-name {
      font-size: 13px;
      font-weight: 800;
      color: #f8fafc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 130px;
    }
    .badge {
      font-size: 9px;
      font-weight: 900;
      padding: 2px 6px;
      border-radius: 6px;
    }
    .badge.turn { background: #f59e0b; color: #000; }
    .badge.safe { background: #10b981; color: #fff; }
    .badge.boom { background: #ef4444; color: #fff; }
    .badge.wait { background: #475569; color: #cbd5e1; }
    .shield-tag {
      font-size: 9px;
      font-weight: 800;
      background: #0891b2;
      color: #fff;
      padding: 2px 5px;
      border-radius: 5px;
    }
    .player-body { font-size: 11.5px; color: #94a3b8; }
    .gold { color: #facc15; font-weight: 800; }
    .cyan { color: #38bdf8; font-weight: 800; }
    .footer {
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 10px;
      font-size: 12.5px;
      color: #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .action-note { color: #fef08a; font-weight: 700; max-width: 700px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="title">🎁 KOTAK MISTERI HOKI ROYALE 🎁</div>
      <div class="meta-tag">SISA KOTAK: ${boxes.filter(b => !b.opened).length} / ${boxes.length}</div>
    </div>
    <div class="main-body">
      <div class="grid-container">${boxesHTML}</div>
      <div class="players-sidebar">${playersPodHTML}</div>
    </div>
    <div class="footer">
      <div class="action-note">${lastActionText || "Pilih nomor kotak atau amankan poinmu sekarang!"}</div>
      <div>WudysoftBot • Hoki Mystery Arena</div>
    </div>
  </div>
</body>
</html>`;
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
  const finalFooter = footer || `${botName} • Game Hoki`;
  const formattedButtons = buttons.map(b => {
    if (b.buttonParamsJson) return b;
    if (b.type === "list" || b.name === "single_select") {
      return {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: b.title || "PILIH KOTAK",
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
        list_title: `${botName} • Kotak Hoki`,
        button_title: "Menu Kotak"
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
async function renderAndSendHokiBoard(sock, ctx, chatId, session, extraNote = "") {
  const prefix = ctx?.prefix || ".";
  const html = generateBoardHTML(session, extraNote);
  const {
    buffer: imgBuffer
  } = await renderHtmlToImage(html);
  const currentPlayer = session.players[session.turnIndex];
  const unopenedBoxes = session.boxes.filter(b => !b.opened);
  const mentions = session.players.map(p => p.id);
  let text = `🎁 *ARENA KOTAK MISTERI HOKI*\n\n`;
  if (extraNote) text += `📢 ${extraNote}\n\n`;
  text += `👉 *Giliran Membuka:* @${currentPlayer.id.split("@")[0]}\n`;
  text += `💰 *Poin di Kantong:* Rp ${currentPlayer.accumulatedMoney.toLocaleString("id-ID")} (+${currentPlayer.accumulatedExp} EXP)\n`;
  if (currentPlayer.shield > 0) {
    text += `🛡️ *Perisai Aktif:* ${currentPlayer.shield}x Perlindungan Bom!\n`;
  }
  text += `📦 *Sisa Kotak:* ${unopenedBoxes.length} buah\n\n`;
  text += `_Pilih kotak yang ingin dibuka atau klik **Klaim & Stop** untuk mengamankan hadiahmu!_`;
  const choiceRows = unopenedBoxes.map(b => ({
    title: b.revealed ? `⚠️ Kotak #${b.id} (TERDETEKSI BOM)` : `🎁 Kotak #${b.id}`,
    id: `${prefix}hokian buka ${b.id}`,
    description: b.revealed ? "AWAS! Radar mendeteksi adanya bom di kotak ini!" : `Buka kotak misteri nomor #${b.id}`
  }));
  const buttons = [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: `🎁 PILIH KOTAK UNTUK DIBUKA`,
      sections: [{
        title: "DAFTAR KOTAK MISTERI TERSEDIA",
        rows: choiceRows
      }]
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: `🛑 Klaim & Stop (Rp ${currentPlayer.accumulatedMoney.toLocaleString("id-ID")})`,
      id: `${prefix}hokian stop`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🚪 Batal Sesi",
      id: `${prefix}hokian batal`
    })
  }];
  await sendCTA(sock, ctx, chatId, {
    text: text,
    buttons: buttons,
    image: imgBuffer,
    mentions: mentions
  });
}

function getNextActiveTurnIndex(players, currentIndex) {
  const total = players.length;
  for (let i = 1; i <= total; i++) {
    const nextIdx = (currentIndex + i) % total;
    if (players[nextIdx].status === "PLAYING") {
      return nextIdx;
    }
  }
  return -1;
}
export default {
  name: "hokian",
  aliases: ["hoki", "kotakhoki", "kotakmisteri", "minesbox"],
  description: "Game Kotak Misteri Hoki-Hokian dengan 10+ Jenis Hadiah (Shield, Radar, Jackpot, Multiplier, dsb).",
  category: "Game",
  limit: true,
  example: ".hokian (Buat room), .hokian solo (Main sendiri), atau .hokian buka <nomor>",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !global.db?.hokian?.[chatId]) return;
      const sender = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (/^[.#/!]?(hokian|hoki|kotakhoki)\s+(buka|open|stop|klaim|claim)/i.test(text)) {
        const msgId = msg?.key?.id;
        if (isDuplicateMessage(msgId)) return;
        const session = global.db.hokian[chatId];
        if (!session || session.state !== "PLAYING") return;
        const currentPlayer = session.players[session.turnIndex];
        if (currentPlayer.id !== sender) return;
        const prefix = ctx?.prefix || ".";
        if (text.includes("stop") || text.includes("klaim") || text.includes("claim")) {
          return await handlePlayerClaim(sock, ctx, chatId, session, sender, prefix);
        }
        const match = text.match(/\b(?:buka|open)\s+(\d+)\b/i);
        if (match) {
          const boxNum = parseInt(match[1], 10);
          return await handleOpenBox(sock, ctx, chatId, session, sender, boxNum, prefix);
        }
      }
    } catch (e) {
      console.error("[HOKIAN BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      const chatId = ctx.id;
      const sender = ctx.sender;
      const senderName = ctx.pushName || "Player";
      const rawText = (ctx.query || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      initDB(sender, senderName);
      const msgId = msg?.key?.id;
      if (rawText.startsWith("buka") || rawText.startsWith("open")) {
        if (isDuplicateMessage(msgId)) return;
        const session = global.db.hokian[chatId];
        if (!session || session.state !== "PLAYING") {
          return ctx.reply("❌ Tidak ada sesi game hoki aktif di chat ini.");
        }
        const boxNum = parseInt(rawText.replace(/[^0-9]/g, ""), 10);
        return await handleOpenBox(sock, ctx, chatId, session, sender, boxNum, prefix);
      }
      if (rawText === "stop" || rawText === "klaim" || rawText === "claim") {
        if (isDuplicateMessage(msgId)) return;
        const session = global.db.hokian[chatId];
        if (!session || session.state !== "PLAYING") {
          return ctx.reply("❌ Tidak ada sesi game aktif.");
        }
        return await handlePlayerClaim(sock, ctx, chatId, session, sender, prefix);
      }
      if (rawText === "batal" || rawText === "cancel" || rawText === "reset") {
        if (global.db.hokian[chatId]) {
          clearSession(chatId);
          return ctx.reply("🛑 Sesi permainan Kotak Misteri berhasil dibatalkan dan dibersihkan.");
        }
        return ctx.reply("❌ Tidak ada sesi yang sedang berlangsung.");
      }
      if (rawText === "solo" || !isGroup) {
        const existing = global.db.hokian[chatId];
        if (existing && existing.state === "PLAYING") {
          return ctx.reply("⚠️ Masih ada permainan yang sedang berlangsung! Ketik `.hokian batal` untuk mereset.");
        }
        const totalBoxes = 16;
        const boxes = generateMysteryBoxes(totalBoxes);
        global.db.hokian[chatId] = {
          sessionId: Date.now(),
          state: "PLAYING",
          isSolo: true,
          boxes: boxes,
          turnIndex: 0,
          players: [{
            id: sender,
            name: senderName,
            status: "PLAYING",
            accumulatedMoney: 0,
            accumulatedExp: 0,
            shield: 0
          }],
          createdAt: Date.now(),
          expireTime: Date.now() + 6e5
        };
        saveDB();
        return await renderAndSendHokiBoard(sock, ctx, chatId, global.db.hokian[chatId], "🏁 Mode Solo Dimulai! Buka kotak dan uji keberuntunganmu.");
      }
      const activeSession = global.db.hokian[chatId];
      if (rawText === "join" || rawText === "gabung") {
        if (!activeSession || activeSession.state !== "LOBBY") {
          return ctx.reply("❌ Tidak ada lobi yang sedang terbuka. Buat dengan `.hokian`");
        }
        if (activeSession.players.some(p => p.id === sender)) {
          return ctx.reply("⚠️ Kamu sudah terdaftar di lobi ini!");
        }
        if (activeSession.players.length >= 6) {
          return ctx.reply("❌ Lobi sudah penuh (Maksimal 6 pemain)!");
        }
        activeSession.players.push({
          id: sender,
          name: senderName,
          status: "PLAYING",
          accumulatedMoney: 0,
          accumulatedExp: 0,
          shield: 0
        });
        activeSession.expireTime = Date.now() + 12e4;
        saveDB();
        let joinText = `🤝 @${sender.split("@")[0]} bergabung ke lobi!\n\n*Pemain Terdaftar (${activeSession.players.length}/6):*\n`;
        activeSession.players.forEach((p, idx) => {
          joinText += `${idx + 1}. ${p.name}\n`;
        });
        const lobbyButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Ikut Gabung",
            id: `${prefix}hokian join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚀 Mulai Permainan",
            id: `${prefix}hokian start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal Lobi",
            id: `${prefix}hokian batal`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: joinText,
          buttons: lobbyButtons,
          mentions: activeSession.players.map(p => p.id)
        });
      }
      if (rawText === "start" || rawText === "mulai") {
        if (!activeSession || activeSession.state !== "LOBBY") {
          return ctx.reply("❌ Tidak ada lobi yang menunggu dimulai.");
        }
        if (activeSession.host !== sender) {
          return ctx.reply(`❌ Hanya host @${activeSession.host.split("@")[0]} yang dapat memulai game!`, {
            mentions: [activeSession.host]
          });
        }
        const totalBoxes = 16;
        activeSession.boxes = generateMysteryBoxes(totalBoxes);
        activeSession.state = "PLAYING";
        activeSession.turnIndex = 0;
        activeSession.expireTime = Date.now() + 6e5;
        saveDB();
        return await renderAndSendHokiBoard(sock, ctx, chatId, activeSession, "🏁 Permainan Kotak Hoki Royale Resmi Dimulai!");
      }
      if (activeSession) {
        if (activeSession.state === "PLAYING") {
          return ctx.reply("⚠️ Permainan sedang aktif! Ketik `.hokian buka <nomor>` atau `.hokian batal`.");
        }
        let lobbyText = `📢 *LOBBY KOTAK MISTERI MASIH DIBUKA!*\n👑 Host: @${activeSession.host.split("@")[0]}\n\n*Pemain (${activeSession.players.length}/6):*\n`;
        activeSession.players.forEach((p, idx) => {
          lobbyText += `${idx + 1}. ${p.name}\n`;
        });
        const existingButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Ikut Gabung",
            id: `${prefix}hokian join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚀 Mulai Game",
            id: `${prefix}hokian start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal Lobi",
            id: `${prefix}hokian batal`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: lobbyText,
          buttons: existingButtons,
          mentions: activeSession.players.map(p => p.id)
        });
      }
      clearSession(chatId);
      global.db.hokian[chatId] = {
        sessionId: Date.now(),
        state: "LOBBY",
        host: sender,
        isSolo: false,
        players: [{
          id: sender,
          name: senderName,
          status: "PLAYING",
          accumulatedMoney: 0,
          accumulatedExp: 0,
          shield: 0
        }],
        boxes: [],
        createdAt: Date.now(),
        expireTime: Date.now() + 12e4
      };
      saveDB();
      const openBody = `🎁 *LOBBY GAME HOKI-HOKIAN ROYALE (16 KOTAK)* 🎁\n\n` + `• 👑 *Host:* @${sender.split("@")[0]}\n` + `• 👥 *Pemain:* 1 / 6 Terkumpul\n` + `• 🎯 *Hadiah:* Mega Jackpot, Multiplier x3, Perisai Kebal Bom, Radar X-Ray, Daun Extra Turn, dan Koin Emas!\n\n` + `_Pilih aksi melalui tombol di bawah atau ketik \`${prefix}hokian solo\` untuk main sendiri._`;
      const lobbyButtons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤝 Gabung (Join)",
          id: `${prefix}hokian join`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🚀 Mulai Game",
          id: `${prefix}hokian start`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎮 Main Solo (Langsung)",
          id: `${prefix}hokian solo`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🚪 Tutup Lobi",
          id: `${prefix}hokian batal`
        })
      }];
      await sendCTA(sock, ctx, chatId, {
        text: openBody,
        buttons: lobbyButtons,
        mentions: [sender],
        quoted: quotedMsg
      });
    } catch (err) {
      console.error("[HOKIAN EXECUTE ERROR]:", err);
      ctx.reply(`❌ Terjadi kendala: ${err.message}`);
    }
  }
};
async function handleOpenBox(sock, ctx, chatId, session, sender, boxNum, prefix) {
  const currentPlayer = session.players[session.turnIndex];
  if (currentPlayer.id !== sender) {
    return ctx.reply(`⏳ Bukan giliranmu! Saat ini giliran @${currentPlayer.id.split("@")[0]}`, {
      mentions: [currentPlayer.id]
    });
  }
  const box = session.boxes.find(b => b.id === boxNum);
  if (!box) {
    return ctx.reply("❌ Nomor kotak tidak valid!");
  }
  if (box.opened) {
    return ctx.reply(`⚠️ Kotak #${boxNum} sudah dibuka sebelumnya! Pilih kotak lain.`);
  }
  box.opened = true;
  box.openedBy = sender;
  let actionNote = "";
  let givesExtraTurn = false;
  if (box.type === "BOMB") {
    if (currentPlayer.shield > 0) {
      currentPlayer.shield -= 1;
      actionNote = `🛡️ *PERISAI AKTIF!* @${sender.split("@")[0]} membuka Kotak #${boxNum} yang berisi *BOM*, tapi Perisai menahan ledakan! Poinmu selamat dan kamu tetap hidup! 🔥`;
    } else {
      currentPlayer.status = "BOOM";
      const lostMoney = currentPlayer.accumulatedMoney;
      currentPlayer.accumulatedMoney = 0;
      currentPlayer.accumulatedExp = 0;
      actionNote = `💥 *BOOOM!* @${sender.split("@")[0]} membuka Kotak #${boxNum} dan terkena *BOM NUKLIR*! Hadiah Rp ${lostMoney.toLocaleString("id-ID")} hangus dan gugur dari ronde! 💀`;
    }
  } else if (box.type === "TRAP") {
    if (currentPlayer.accumulatedMoney > 0) {
      const lostHalf = Math.floor(currentPlayer.accumulatedMoney / 2);
      currentPlayer.accumulatedMoney -= lostHalf;
      actionNote = `🧨 *JEBAKAN TRAP!* @${sender.split("@")[0]} membuka Kotak #${boxNum}! Uang kantong berkurang 50% (-Rp ${lostHalf.toLocaleString("id-ID")}), tapi masih selamat bertahan hidup! ⚠️`;
    } else {
      actionNote = `🧨 *JEBAKAN TRAP!* @${sender.split("@")[0]} membuka Kotak #${boxNum}! Beruntung kantong masih kosong sehingga tidak ada poin yang terpotong!`;
    }
  } else if (box.type === "SHIELD") {
    currentPlayer.shield = (currentPlayer.shield || 0) + 1;
    currentPlayer.accumulatedMoney += box.value;
    currentPlayer.accumulatedExp += box.exp;
    actionNote = `🛡️ *PERISAI DIPEROLEH!* @${sender.split("@")[0]} membuka Kotak #${boxNum}! Mendapatkan *Perisai Anti-Bom* (+Rp ${box.value})! Ledakan berikutnya akan otomatis ditahan! 🛡️`;
  } else if (box.type === "RADAR") {
    currentPlayer.accumulatedMoney += box.value;
    currentPlayer.accumulatedExp += box.exp;
    const hiddenBombs = session.boxes.filter(b => !b.opened && b.type === "BOMB" && !b.revealed);
    if (hiddenBombs.length > 0) {
      const spiedBomb = hiddenBombs[Math.floor(Math.random() * hiddenBombs.length)];
      spiedBomb.revealed = true;
      actionNote = `🔮 *RADAR X-RAY DIAKTIFKAN!* @${sender.split("@")[0]} membuka Kotak #${boxNum} (+Rp ${box.value})! Radar mendeteksi adanya *BOM di Kotak #${spiedBomb.id}*! ⚠️`;
    } else {
      actionNote = `🔮 *RADAR X-RAY!* @${sender.split("@")[0]} membuka Kotak #${boxNum} (+Rp ${box.value})! Sensor aman, sebagian besar bom telah terbuka!`;
    }
  } else if (box.type === "CLOVER") {
    currentPlayer.accumulatedMoney += box.value;
    currentPlayer.accumulatedExp += box.exp;
    givesExtraTurn = true;
    actionNote = `🍀 *DAUN KEBERUNTUNGAN!* @${sender.split("@")[0]} membuka Kotak #${boxNum} (+Rp ${box.value})! Mendapatkan *BONUS 1 GILIRAN LAGI*! Silakan pilih kotak berikutnya! 🎉`;
  } else if (box.type === "MULTI_3X") {
    if (currentPlayer.accumulatedMoney === 0) {
      currentPlayer.accumulatedMoney = 2500;
      currentPlayer.accumulatedExp += 100;
      actionNote = `⚡ *TRIPLE MULTIPLIER!* @${sender.split("@")[0]} membuka Kotak #${boxNum} (x3)! Karena kantong kosong, diberikan modal dasar Rp 2.500!`;
    } else {
      currentPlayer.accumulatedMoney *= 3;
      currentPlayer.accumulatedExp *= 2;
      actionNote = `⚡ *TRIPLE SULTAN (x3)!* @${sender.split("@")[0]} membuka Kotak #${boxNum}! Poin di kantong meledak 3x lipat menjadi *Rp ${currentPlayer.accumulatedMoney.toLocaleString("id-ID")}*! 🔥`;
    }
  } else if (box.type === "MULTI_2X") {
    if (currentPlayer.accumulatedMoney === 0) {
      currentPlayer.accumulatedMoney = 1500;
      currentPlayer.accumulatedExp += 50;
      actionNote = `⚡ *DOUBLE MULTIPLIER!* @${sender.split("@")[0]} membuka Kotak #${boxNum} (x2)! Mendapatkan modal dasar Rp 1.500!`;
    } else {
      currentPlayer.accumulatedMoney *= 2;
      currentPlayer.accumulatedExp = Math.floor(currentPlayer.accumulatedExp * 1.5);
      actionNote = `⚡ *DOUBLE BOOSTER (x2)!* @${sender.split("@")[0]} membuka Kotak #${boxNum}! Poin di kantong berlipat menjadi *Rp ${currentPlayer.accumulatedMoney.toLocaleString("id-ID")}*! ✨`;
    }
  } else if (box.type === "EXP_STAR") {
    currentPlayer.accumulatedMoney += box.value;
    currentPlayer.accumulatedExp += box.exp;
    actionNote = `🌟 *BINTANG EXP SULTAN!* @${sender.split("@")[0]} membuka Kotak #${boxNum} dan meraup *+${box.exp} EXP* & +Rp ${box.value.toLocaleString("id-ID")}! 🌌`;
  } else if (box.type === "JACKPOT") {
    currentPlayer.accumulatedMoney += box.value;
    currentPlayer.accumulatedExp += box.exp;
    actionNote = `👑 *MEGA JACKPOT SULTAN!* @${sender.split("@")[0]} membuka Kotak #${boxNum} dan menyapu *+Rp ${box.value.toLocaleString("id-ID")}* (+${box.exp} EXP)! 🏆`;
  } else if (box.type === "GOLD") {
    currentPlayer.accumulatedMoney += box.value;
    currentPlayer.accumulatedExp += box.exp;
    actionNote = `💰 *PUNDI EMAS!* @${sender.split("@")[0]} membuka Kotak #${boxNum} dan mengantongi *+Rp ${box.value.toLocaleString("id-ID")}* (+${box.exp} EXP)!`;
  } else {
    currentPlayer.accumulatedMoney += box.value;
    currentPlayer.accumulatedExp += box.exp;
    actionNote = `💎 @${sender.split("@")[0]} membuka Kotak #${boxNum} dan mendapatkan *+Rp ${box.value.toLocaleString("id-ID")}* (+${box.exp} EXP)!`;
  }
  const activePlayers = session.players.filter(p => p.status === "PLAYING");
  const unopenedBoxes = session.boxes.filter(b => !b.opened);
  const unopenedSafeBoxes = unopenedBoxes.filter(b => b.type !== "BOMB");
  if (activePlayers.length === 0 || unopenedSafeBoxes.length === 0) {
    activePlayers.forEach(p => {
      if (p.accumulatedMoney > 0) {
        rewardPlayer(p.id, p.name, p.accumulatedMoney, p.accumulatedExp);
      }
    });
    clearSession(chatId);
    let endCaption = `🏁 *PERMAINAN KOTAK HOKI BERAKHIR!*\n\n${actionNote}\n\n*Rekapitulasi Hadiah:*\n`;
    session.players.forEach((p, idx) => {
      const isClaimed = p.status === "CLAIMED" || p.status === "PLAYING" && p.accumulatedMoney > 0;
      const rewardStr = isClaimed ? `✅ Berhasil Mengamankan: *Rp ${p.accumulatedMoney.toLocaleString("id-ID")}* (+${p.accumulatedExp} EXP)` : `💀 Hangus Terkena Bom`;
      endCaption += `${idx + 1}. @${p.id.split("@")[0]}: ${rewardStr}\n`;
    });
    endCaption += `\n_Ketik \`${prefix}hokian\` untuk membuka sesi baru!_`;
    const endButtons = [{
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🎮 Main Lagi",
        id: `${prefix}hokian`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🕹️ Solo Lagi",
        id: `${prefix}hokian solo`
      })
    }];
    return await sendCTA(sock, ctx, chatId, {
      text: endCaption,
      buttons: endButtons,
      mentions: session.players.map(p => p.id)
    });
  }
  if (!givesExtraTurn || currentPlayer.status !== "PLAYING") {
    const nextIdx = getNextActiveTurnIndex(session.players, session.turnIndex);
    session.turnIndex = nextIdx;
  }
  saveDB();
  await renderAndSendHokiBoard(sock, ctx, chatId, session, actionNote);
}
async function handlePlayerClaim(sock, ctx, chatId, session, sender, prefix) {
  const player = session.players.find(p => p.id === sender);
  if (!player || player.status !== "PLAYING") {
    return ctx.reply("❌ Kamu tidak memiliki poin aktif untuk diklaim!");
  }
  const claimedMoney = player.accumulatedMoney;
  const claimedExp = player.accumulatedExp;
  player.status = "CLAIMED";
  if (claimedMoney > 0) {
    rewardPlayer(player.id, player.name, claimedMoney, claimedExp);
  }
  const claimNote = `🛑 *KLAIM AMAN!* @${sender.split("@")[0]} memutuskan BERHENTI dan mengamankan *Rp ${claimedMoney.toLocaleString("id-ID")}* (+${claimedExp} EXP)! 💰`;
  const remainingActive = session.players.filter(p => p.status === "PLAYING");
  if (remainingActive.length === 0) {
    clearSession(chatId);
    let endCaption = `🏁 *PERMAINAN BERAKHIR!*\n\n${claimNote}\n\n*Semua pemain telah selesai bermain.*\n`;
    session.players.forEach((p, idx) => {
      const res = p.status === "CLAIMED" ? `✅ Mengamankan: *Rp ${p.accumulatedMoney.toLocaleString("id-ID")}* (+${p.accumulatedExp} EXP)` : `💀 Meledak`;
      endCaption += `${idx + 1}. @${p.id.split("@")[0]}: ${res}\n`;
    });
    endCaption += `\n_Ketik \`${prefix}hokian\` untuk membuat sesi baru!_`;
    const endButtons = [{
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🎮 Main Lagi",
        id: `${prefix}hokian`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🕹️ Main Solo",
        id: `${prefix}hokian solo`
      })
    }];
    return await sendCTA(sock, ctx, chatId, {
      text: endCaption,
      buttons: endButtons,
      mentions: session.players.map(p => p.id)
    });
  }
  const nextIdx = getNextActiveTurnIndex(session.players, session.turnIndex);
  session.turnIndex = nextIdx;
  saveDB();
  await renderAndSendHokiBoard(sock, ctx, chatId, session, claimNote);
}