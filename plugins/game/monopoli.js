import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const BOARD_TILES = [{
  id: 0,
  name: "GO ➔",
  type: "go",
  price: 0,
  rent: 0,
  color: "c-corner",
  icon: "✨"
}, {
  id: 1,
  name: "Mediter.",
  type: "property",
  price: 60,
  rent: 10,
  color: "c-brown",
  group: "brown"
}, {
  id: 2,
  name: "Vault",
  type: "chest",
  price: 0,
  rent: 0,
  color: "c-special",
  icon: "💎"
}, {
  id: 3,
  name: "Baltic",
  type: "property",
  price: 60,
  rent: 10,
  color: "c-brown",
  group: "brown"
}, {
  id: 4,
  name: "Income Tax",
  type: "tax",
  price: 200,
  rent: 200,
  color: "c-special",
  icon: "🪙"
}, {
  id: 5,
  name: "Reading RR",
  type: "railroad",
  price: 200,
  rent: 35,
  color: "c-special",
  icon: "🚆"
}, {
  id: 6,
  name: "Oriental",
  type: "property",
  price: 100,
  rent: 15,
  color: "c-lblue",
  group: "lblue"
}, {
  id: 7,
  name: "Chance",
  type: "chance",
  price: 0,
  rent: 0,
  color: "c-special",
  icon: "⚡"
}, {
  id: 8,
  name: "Vermont",
  type: "property",
  price: 100,
  rent: 15,
  color: "c-lblue",
  group: "lblue"
}, {
  id: 9,
  name: "Conn. Ave",
  type: "property",
  price: 120,
  rent: 20,
  color: "c-lblue",
  group: "lblue"
}, {
  id: 10,
  name: "JUST VISIT",
  type: "jail",
  price: 0,
  rent: 0,
  color: "c-corner",
  icon: "⛓️"
}, {
  id: 11,
  name: "St. Charles",
  type: "property",
  price: 140,
  rent: 25,
  color: "c-pink",
  group: "pink"
}, {
  id: 12,
  name: "Electric Co",
  type: "utility",
  price: 150,
  rent: 30,
  color: "c-special",
  icon: "💡"
}, {
  id: 13,
  name: "States Ave",
  type: "property",
  price: 140,
  rent: 25,
  color: "c-pink",
  group: "pink"
}, {
  id: 14,
  name: "Virginia",
  type: "property",
  price: 160,
  rent: 30,
  color: "c-pink",
  group: "pink"
}, {
  id: 15,
  name: "Penn Rail",
  type: "railroad",
  price: 200,
  rent: 35,
  color: "c-special",
  icon: "🚆"
}, {
  id: 16,
  name: "St. James",
  type: "property",
  price: 180,
  rent: 35,
  color: "c-orange",
  group: "orange"
}, {
  id: 17,
  name: "Vault",
  type: "chest",
  price: 0,
  rent: 0,
  color: "c-special",
  icon: "💎"
}, {
  id: 18,
  name: "Tennessee",
  type: "property",
  price: 180,
  rent: 35,
  color: "c-orange",
  group: "orange"
}, {
  id: 19,
  name: "New York",
  type: "property",
  price: 200,
  rent: 40,
  color: "c-orange",
  group: "orange"
}, {
  id: 20,
  name: "FREE PARK",
  type: "parking",
  price: 0,
  rent: 0,
  color: "c-corner",
  icon: "🚗"
}, {
  id: 21,
  name: "Kentucky",
  type: "property",
  price: 220,
  rent: 45,
  color: "c-red",
  group: "red"
}, {
  id: 22,
  name: "Chance",
  type: "chance",
  price: 0,
  rent: 0,
  color: "c-special",
  icon: "⚡"
}, {
  id: 23,
  name: "Indiana",
  type: "property",
  price: 220,
  rent: 45,
  color: "c-red",
  group: "red"
}, {
  id: 24,
  name: "Illinois",
  type: "property",
  price: 240,
  rent: 50,
  color: "c-red",
  group: "red"
}, {
  id: 25,
  name: "B.&O. Rail",
  type: "railroad",
  price: 200,
  rent: 35,
  color: "c-special",
  icon: "🚆"
}, {
  id: 26,
  name: "Atlantic",
  type: "property",
  price: 260,
  rent: 55,
  color: "c-yellow",
  group: "yellow"
}, {
  id: 27,
  name: "Ventnor",
  type: "property",
  price: 260,
  rent: 55,
  color: "c-yellow",
  group: "yellow"
}, {
  id: 28,
  name: "Water Works",
  type: "utility",
  price: 150,
  rent: 30,
  color: "c-special",
  icon: "💧"
}, {
  id: 29,
  name: "Marvin",
  type: "property",
  price: 280,
  rent: 60,
  color: "c-yellow",
  group: "yellow"
}, {
  id: 30,
  name: "GO TO JAIL",
  type: "gotojail",
  price: 0,
  rent: 0,
  color: "c-corner",
  icon: "🚨"
}, {
  id: 31,
  name: "Pacific",
  type: "property",
  price: 300,
  rent: 70,
  color: "c-green",
  group: "green"
}, {
  id: 32,
  name: "N. Carolina",
  type: "property",
  price: 300,
  rent: 70,
  color: "c-green",
  group: "green"
}, {
  id: 33,
  name: "Vault",
  type: "chest",
  price: 0,
  rent: 0,
  color: "c-special",
  icon: "💎"
}, {
  id: 34,
  name: "Penn. Ave",
  type: "property",
  price: 320,
  rent: 75,
  color: "c-green",
  group: "green"
}, {
  id: 35,
  name: "Short Line",
  type: "railroad",
  price: 200,
  rent: 35,
  color: "c-special",
  icon: "🚆"
}, {
  id: 36,
  name: "Chance",
  type: "chance",
  price: 0,
  rent: 0,
  color: "c-special",
  icon: "⚡"
}, {
  id: 37,
  name: "Park Place",
  type: "property",
  price: 350,
  rent: 85,
  color: "c-blue",
  group: "blue"
}, {
  id: 38,
  name: "Luxury Tax",
  type: "tax",
  price: 100,
  rent: 100,
  color: "c-special",
  icon: "🪐"
}, {
  id: 39,
  name: "Boardwalk",
  type: "property",
  price: 400,
  rent: 100,
  color: "c-blue",
  group: "blue"
}];
const TOKEN_COLORS = [{
  name: "Cyan",
  color: "#00dfd8",
  grad: "radial-gradient(circle at 35% 35%, #ffffff 0%, #00dfd8 50%, #004b75 100%)",
  glow: "0 0 12px #00dfd8"
}, {
  name: "Pink",
  color: "#ff007f",
  grad: "radial-gradient(circle at 35% 35%, #ffffff 0%, #ff007f 50%, #750035 100%)",
  glow: "0 0 12px #ff007f"
}, {
  name: "Green",
  color: "#00f5a0",
  grad: "radial-gradient(circle at 35% 35%, #ffffff 0%, #00f5a0 50%, #005e3a 100%)",
  glow: "0 0 12px #00f5a0"
}, {
  name: "Yellow",
  color: "#ffd200",
  grad: "radial-gradient(circle at 35% 35%, #ffffff 0%, #ffd200 50%, #735a00 100%)",
  glow: "0 0 12px #ffd200"
}];
const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.monopoly) global.db.monopoly = {};
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
  if (global.db?.monopoly?.[chatId]) {
    delete global.db.monopoly[chatId];
    saveDB();
  }
}

function rewardWinner(jid, name = "", prizeMoney = 25e3, prizeExp = 800) {
  if (!jid || jid === "BOT") return;
  initDB(jid, name);
  global.db.user[jid].money = (Number(global.db.user[jid].money) || 0) + prizeMoney;
  global.db.user[jid].exp = (Number(global.db.user[jid].exp) || 0) + prizeExp;
  saveDB();
}

function cleanExpiredSessions(currentChatId = null) {
  if (!global.db?.monopoly) return;
  const now = Date.now();
  let changed = false;
  for (const [cId, session] of Object.entries(global.db.monopoly)) {
    const isExpired = session?.expireTime && now > session.expireTime;
    const isCorrupt = !session || !session.state || !session.players && !session.host;
    if (isExpired || isCorrupt) {
      delete global.db.monopoly[cId];
      changed = true;
    }
  }
  if (currentChatId && global.db.monopoly[currentChatId]) {
    const s = global.db.monopoly[currentChatId];
    if (s.expireTime && now > s.expireTime) {
      delete global.db.monopoly[currentChatId];
      changed = true;
    }
  }
  if (changed) saveDB();
}

function purgePlayerFromOtherSessions(playerJid) {
  if (!global.db?.monopoly || !playerJid) return;
  let changed = false;
  for (const [cId, session] of Object.entries(global.db.monopoly)) {
    if (session.state === "LOBBY") {
      if (session.host === playerJid) {
        delete global.db.monopoly[cId];
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
async function sendCTA(sock, ctx, targetId, {
  text,
  footer,
  buttons = [],
  image = null,
  quoted = null,
  mentions = []
}) {
  const botName = global.bot?.name || "WudysoftBot";
  const finalFooter = footer || `${botName} • Monopoly Liquid Glass`;
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
        list_title: `${botName} • Arena Monopoli`,
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
        timeout: 16e3
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

function getCellGridStyle(id) {
  if (id === 20) return "grid-column: 1; grid-row: 1;";
  if (id >= 21 && id <= 29) return `grid-column: ${id - 19}; grid-row: 1;`;
  if (id === 30) return "grid-column: 11; grid-row: 1;";
  if (id >= 31 && id <= 39) return `grid-column: 11; grid-row: ${id - 29};`;
  if (id === 0) return "grid-column: 11; grid-row: 11;";
  if (id >= 1 && id <= 9) return `grid-column: ${11 - id}; grid-row: 11;`;
  if (id === 10) return "grid-column: 1; grid-row: 11;";
  if (id >= 11 && id <= 19) return `grid-column: 1; grid-row: ${21 - id};`;
  return "";
}

function generateMonopolyHTML(session) {
  const d1 = session.lastDice?.[0] || 5;
  const d2 = session.lastDice?.[1] || 3;
  const face1 = DICE_FACES[d1] || "⚄";
  const face2 = DICE_FACES[d2] || "⚂";
  const pawnsMap = {};
  session.players.forEach((p, idx) => {
    if (!pawnsMap[p.position]) pawnsMap[p.position] = [];
    pawnsMap[p.position].push({
      ...p,
      token: TOKEN_COLORS[idx]
    });
  });
  let cellsHTML = "";
  BOARD_TILES.forEach(tile => {
    const gridStyle = getCellGridStyle(tile.id);
    const isCorner = [0, 10, 20, 30].includes(tile.id);
    const ownerId = session.properties?.[tile.id];
    let ownerChip = "";
    if (ownerId) {
      const ownerIdx = session.players.findIndex(p => p.id === ownerId);
      if (ownerIdx !== -1) {
        ownerChip = `<div class="owner-badge" style="background:${TOKEN_COLORS[ownerIdx].color};">P${ownerIdx + 1}</div>`;
      }
    }
    let insidePawns = "";
    if (pawnsMap[tile.id]) {
      pawnsMap[tile.id].forEach(pw => {
        insidePawns += `<div class="token-pawn" style="background:${pw.token.grad}; box-shadow:${pw.token.glow};"></div>`;
      });
    }
    if (isCorner) {
      cellsHTML += `
        <div class="cell corner" style="${gridStyle}">
          <span class="corner-icon">${tile.icon || "🏛️"}</span>
          <span class="corner-name">${tile.name}</span>
          <div class="pawns-container">${insidePawns}</div>
        </div>
      `;
    } else {
      let orientation = "";
      if (tile.id >= 21 && tile.id <= 29) orientation = "top";
      else if (tile.id >= 31 && tile.id <= 39) orientation = "right";
      else if (tile.id >= 11 && tile.id <= 19) orientation = "left";
      cellsHTML += `
        <div class="cell ${orientation}" style="${gridStyle}">
          ${ownerChip}
          ${tile.color.startsWith("c-") && tile.type === "property" ? `<div class="color-bar ${tile.color}"></div>` : `<span class="tile-icon">${tile.icon || "⚡"}</span>`}
          <div class="title">${tile.name}</div>
          <div class="price">${tile.price ? `$${tile.price}` : ""}</div>
          <div class="pawns-container">${insidePawns}</div>
        </div>
      `;
    }
  });
  let playersPodHTML = "";
  session.players.forEach((p, idx) => {
    const isTurn = p.id === session.turn;
    const isBot = p.id === "BOT";
    const rawName = isBot ? "Bot Liquid" : global.db?.user?.[p.id]?.name || p.id.split("@")[0];
    const cleanName = rawName.length > 10 ? rawName.slice(0, 9) + ".." : rawName;
    const tCol = TOKEN_COLORS[idx];
    playersPodHTML += `
      <div class="player-card ${isTurn ? "active-card" : ""}" style="--token-glow: ${tCol.color}">
        <div class="card-avatar" style="background:${tCol.grad}; box-shadow:${tCol.glow};"></div>
        <div class="card-meta">
          <div class="card-name">${cleanName}</div>
          <div class="card-cash">💵 <b>$${p.cash.toLocaleString()}</b></div>
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
    :root {
      --bg-dark: #07090e;
      --glass-surface: rgba(255, 255, 255, 0.035);
      --glass-border: rgba(255, 255, 255, 0.14);
      --glass-specular: inset 0 1px 1px rgba(255, 255, 255, 0.4), inset 0 -1px 2px rgba(0, 0, 0, 0.5);
      
      --c-brown: linear-gradient(135deg, #a0522d, #5c2c16);
      --c-lblue: linear-gradient(135deg, #00f2fe, #4facfe);
      --c-pink:  linear-gradient(135deg, #ff0844, #ffb199);
      --c-orange:linear-gradient(135deg, #fa709a, #fee140);
      --c-red:   linear-gradient(135deg, #f83600, #f9d423);
      --c-yellow:linear-gradient(135deg, #ffe600, #ff8c00);
      --c-green: linear-gradient(135deg, #0ba360, #3cba92);
      --c-blue:  linear-gradient(135deg, #4481eb, #04befe);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    /* ANTI-CROP CANVAS CONTAINER */
    html, body {
      width: 960px;
      height: auto;
      background: #07090e;
      font-family: 'Segoe UI', Roboto, sans-serif;
      color: #ffffff;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .canvas-wrapper {
      width: 960px;
      min-height: 980px;
      padding: 24px 20px 42px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      background: radial-gradient(circle at 50% 30%, #101624 0%, #07090e 100%);
      overflow: hidden;
    }

    /* Ambient Blobs (Terkunci di dalam Canvas) */
    .ambient-blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.35;
      pointer-events: none;
      z-index: 1;
    }
    .blob-1 { width: 340px; height: 340px; background: radial-gradient(circle, #7928ca, #ff0080); top: 10px; left: 10px; }
    .blob-2 { width: 380px; height: 380px; background: radial-gradient(circle, #0070f3, #00dfd8); bottom: 20px; right: 20px; }

    /* Player Pods Header */
    .players-bar {
      display: flex;
      gap: 12px;
      width: 840px;
      margin-bottom: 18px;
      justify-content: center;
      z-index: 10;
      flex-wrap: wrap;
    }
    .player-card {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(15px);
      padding: 8px 16px;
      border-radius: 14px;
      min-width: 180px;
      position: relative;
      box-shadow: 0 8px 20px rgba(0,0,0,0.6);
    }
    .player-card.active-card {
      border: 2px solid var(--token-glow);
      box-shadow: 0 0 18px var(--token-glow), inset 0 0 8px rgba(255,255,255,0.1);
      transform: translateY(-2px);
    }
    .card-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 1.5px solid #fff;
    }
    .card-meta { display: flex; flex-direction: column; }
    .card-name { font-size: 13px; font-weight: 800; color: #fff; }
    .card-cash { font-size: 12px; color: #00dfd8; margin-top: 2px; }
    .turn-chip {
      position: absolute;
      top: -8px;
      right: 8px;
      background: #ffd200;
      color: #000;
      font-size: 9px;
      font-weight: 900;
      padding: 2px 7px;
      border-radius: 6px;
    }

    /* Papan Monopoli 11x11 Grid (Proporsional & Anti-Crop) */
    .board {
      width: 840px;
      height: 840px;
      background: var(--glass-surface);
      backdrop-filter: blur(20px);
      border-radius: 40px;
      border: 1px solid var(--glass-border);
      box-shadow: 0 30px 80px -15px rgba(0, 0, 0, 0.9), var(--glass-specular);
      display: grid;
      grid-template-columns: 96px repeat(9, 1fr) 96px;
      grid-template-rows: 96px repeat(9, 1fr) 96px;
      gap: 6px;
      padding: 8px;
      position: relative;
      z-index: 10;
    }

    /* Liquid Glass Cell */
    .cell {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      font-size: 8px;
      font-weight: 700;
      padding: 4px 2px;
      position: relative;
      overflow: hidden;
      box-shadow: var(--glass-specular);
    }
    .cell.top { transform: rotate(180deg); }
    .cell.left { transform: rotate(90deg); }
    .cell.right { transform: rotate(-90deg); }

    .cell .title {
      text-transform: uppercase;
      font-size: 7.5px;
      text-align: center;
      color: #d1d5db;
      margin: auto 0;
      line-height: 1.1;
    }
    .cell .price { font-size: 8px; font-weight: 800; color: #00dfd8; }
    .cell .color-bar {
      width: 100%;
      height: 11px;
      border-radius: 9999px;
      box-shadow: inset 0 1px 2px rgba(255,255,255,0.6), 0 2px 6px rgba(0,0,0,0.4);
    }
    .corner-icon { font-size: 16px; margin-bottom: 2px; }
    .corner-name { line-height: 1.1; }

    .corner {
      border-radius: 22px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      font-size: 9.5px;
      font-weight: 800;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      gap: 3px;
    }

    /* Property Colors */
    .c-brown  { background: var(--c-brown); }
    .c-lblue  { background: var(--c-lblue); }
    .c-pink   { background: var(--c-pink); }
    .c-orange { background: var(--c-orange); }
    .c-red    { background: var(--c-red); }
    .c-yellow { background: var(--c-yellow); }
    .c-green  { background: var(--c-green); }
    .c-blue   { background: var(--c-blue); }

    /* Center Glass Logo & Decks */
    .center {
      grid-column: 2 / 11;
      grid-row: 2 / 11;
      background: rgba(10, 14, 22, 0.55);
      border-radius: 30px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      position: relative;
      box-shadow: inset 0 2px 25px rgba(0, 0, 0, 0.85);
    }
    .monopoly-logo {
      padding: 12px 36px;
      background: linear-gradient(135deg, rgba(255, 51, 102, 0.25), rgba(255, 51, 102, 0.05));
      border: 1px solid rgba(255, 51, 102, 0.4);
      backdrop-filter: blur(15px);
      border-radius: 9999px;
      transform: rotate(-25deg);
      box-shadow: 0 12px 30px rgba(255, 51, 102, 0.2);
    }
    .monopoly-logo h1 {
      font-size: 30px;
      font-weight: 900;
      letter-spacing: 5px;
      background: linear-gradient(180deg, #ffffff, #ffb3c1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .deck {
      position: absolute;
      padding: 8px 16px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      box-shadow: var(--glass-specular);
    }
    .deck.chance { top: 45px; right: 55px; transform: rotate(-25deg); color: #ffaa40; border-color: rgba(255, 170, 64, 0.3); }
    .deck.chest { bottom: 45px; left: 55px; transform: rotate(-25deg); color: #00dfd8; border-color: rgba(0, 223, 216, 0.3); }

    /* Dices */
    .dice-tray {
      position: absolute;
      bottom: 24px;
      display: flex;
      gap: 12px;
    }
    .glass-dice {
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 20px;
      color: #fff;
      box-shadow: 0 8px 16px rgba(0,0,0,0.5), var(--glass-specular);
    }

    /* Pion / Tokens */
    .pawns-container {
      display: flex;
      gap: 2px;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      min-height: 12px;
      margin-top: 1px;
    }
    .token-pawn {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      border: 1px solid #fff;
    }
    .owner-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      font-size: 6.5px;
      font-weight: 900;
      color: #000;
      padding: 1px 3px;
      border-radius: 3px;
      z-index: 5;
    }
  </style>
</head>
<body>
  <div class="canvas-wrapper">
    <div class="ambient-blob blob-1"></div>
    <div class="ambient-blob blob-2"></div>

    <div class="players-bar">
      ${playersPodHTML}
    </div>

    <div class="board">
      ${cellsHTML}

      <div class="center">
        <div class="deck chance">⚡ Chance</div>
        <div class="monopoly-logo">
          <h1>MONOPOLY</h1>
        </div>
        <div class="deck chest">💎 Vault</div>

        <div class="dice-tray">
          <div class="glass-dice">${face1}</div>
          <div class="glass-dice">${face2}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
async function announceMonopolyBoard(sock, ctx, chatId, session, extraLog = "", prefix = ".") {
  const {
    buffer: imgBuffer
  } = await renderHtmlToImage(generateMonopolyHTML(session));
  const currentPlayer = session.players.find(p => p.id === session.turn);
  const currentTile = BOARD_TILES[currentPlayer.position];
  const mentions = session.players.filter(p => p.id !== "BOT").map(p => p.id);
  let buttons = [];
  if (session.subState === "WAIT_ROLL") {
    buttons.push({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🎲 Kocok Dadu (Roll)",
        id: `${prefix}monopoli roll`
      })
    });
  } else if (session.subState === "CAN_BUY") {
    buttons.push({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: `🏢 Beli Properti ($${currentTile.price})`,
        id: `${prefix}monopoli buy`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "⏩ Lewati (Next)",
        id: `${prefix}monopoli pass`
      })
    });
  } else {
    buttons.push({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "⏩ Selesai Giliran (Next)",
        id: `${prefix}monopoli pass`
      })
    });
  }
  buttons.push({
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🚪 Nyerah / Bangkrut",
      id: `${prefix}monopoli stop`
    })
  });
  const rawName = currentPlayer.id === "BOT" ? "🤖 Bot Liquid" : `@${currentPlayer.id.split("@")[0]}`;
  let caption = `🎩 *MONOPOLY LIQUID GLASS DARK EDITION* 🎩\n\n`;
  if (extraLog) caption += `📢 ${extraLog}\n\n`;
  caption += `👉 *Giliran Pemain:* ${rawName}\n`;
  caption += `📍 *Posisi:* Kotak #${currentTile.id} [ *${currentTile.name}* ]\n`;
  caption += `💵 *Saldo Saat Ini:* $${currentPlayer.cash.toLocaleString()}\n\n`;
  caption += `_Gunakan tombol di bawah untuk melangkah atau mengelola properti:_`;
  await sendCTA(sock, ctx, chatId, {
    text: caption,
    buttons: buttons,
    image: imgBuffer,
    mentions: mentions
  });
}
async function handleMonopolyAction(sock, ctx, msg, sender, rawText) {
  initDB(sender, ctx?.pushName || "");
  cleanExpiredSessions();
  const parts = rawText.split(/\s+/);
  const action = (parts[1] || "").toLowerCase();
  let targetChatId = parts[2];
  if (!targetChatId || !global.db.monopoly[targetChatId]) {
    for (const [cId, sess] of Object.entries(global.db.monopoly)) {
      if (sess.players?.some(p => p.id === sender)) {
        targetChatId = cId;
        break;
      }
    }
  }
  if (!targetChatId) targetChatId = ctx?.id || sender;
  const session = global.db.monopoly[targetChatId];
  if (!session) {
    return ctx?.reply ? ctx.reply("❌ Tidak ada sesi Monopoli aktif yang Anda ikuti.") : null;
  }
  const prefix = ctx?.prefix || ".";
  if (action === "stop" || action === "nyerah" || action === "batal") {
    clearSession(targetChatId);
    const restartButtons = [{
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🎲 Buat Room Monopoli",
        id: `${prefix}monopoli`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🤖 Lawan Bot (Solo)",
        id: `${prefix}monopoli bot`
      })
    }];
    return await sendCTA(sock, ctx, targetChatId, {
      text: `🏳️ Permainan Monopoli dihentikan karena @${sender.split("@")[0]} menyerah / membatalkan sesi. Meja dibersihkan!`,
      buttons: restartButtons,
      mentions: [sender]
    });
  }
  if (session.state !== "PLAYING") return;
  if (session.turn !== sender) {
    return sock.sendMessage(targetChatId, {
      text: `⏳ Bukan giliran Anda! Giliran saat ini: @${session.turn.split("@")[0]}`,
      mentions: [session.turn]
    });
  }
  session.expireTime = Date.now() + 6e5;
  const player = session.players.find(p => p.id === sender);
  if (action === "roll") {
    if (session.subState !== "WAIT_ROLL") {
      return sock.sendMessage(targetChatId, {
        text: "⚠️ Anda sudah melempar dadu! Ambil keputusan atau lewati giliran."
      });
    }
    const r1 = Math.floor(Math.random() * 6) + 1;
    const r2 = Math.floor(Math.random() * 6) + 1;
    const totalRoll = r1 + r2;
    session.lastDice = [r1, r2];
    const prevPos = player.position;
    const newPos = (prevPos + totalRoll) % 40;
    let passedGo = newPos < prevPos;
    player.position = newPos;
    let log = `@${sender.split("@")[0]} melempar dadu [ ${r1} + ${r2} = *${totalRoll}* ] ➔ maju ke petak *${BOARD_TILES[newPos].name}*.`;
    if (passedGo) {
      player.cash += 200;
      log += `\n✨ *Lewat GO!* Mendapat bonus gaji +$200.`;
    }
    const tile = BOARD_TILES[newPos];
    if (tile.type === "gotojail") {
      player.position = 10;
      player.cash = Math.max(0, player.cash - 50);
      log += `\n🚨 *DITANGKAP POLISI!* Masuk penjara dan bayar denda $50.`;
      session.subState = "CAN_PASS";
    } else if (tile.type === "tax") {
      player.cash = Math.max(0, player.cash - tile.price);
      log += `\n🪙 Membayar pajak sebesar *$${tile.price}*.`;
      session.subState = "CAN_PASS";
    } else if (["property", "railroad", "utility"].includes(tile.type)) {
      const ownerId = session.properties[tile.id];
      if (!ownerId) {
        if (player.cash >= tile.price) {
          session.subState = "CAN_BUY";
          log += `\n🏢 Petak belum dimiliki! Anda bisa membelinya seharga *$${tile.price}*.`;
        } else {
          session.subState = "CAN_PASS";
          log += `\n🏢 Uang Anda tidak cukup untuk membeli petak ini ($${tile.price}).`;
        }
      } else if (ownerId === sender) {
        session.subState = "CAN_PASS";
        log += `\n🏠 Anda beristirahat di properti milik sendiri.`;
      } else {
        const owner = session.players.find(p => p.id === ownerId);
        const rentFee = tile.rent;
        player.cash -= rentFee;
        if (owner) owner.cash += rentFee;
        session.subState = "CAN_PASS";
        log += `\n💸 Membayar uang sewa *$${rentFee}* kepada @${ownerId.split("@")[0]}!`;
      }
    } else if (tile.type === "chance" || tile.type === "chest") {
      const bonusChance = [50, 100, -50, 150, -100];
      const picked = bonusChance[Math.floor(Math.random() * bonusChance.length)];
      player.cash = Math.max(0, player.cash + picked);
      log += `\n🎁 Membuka kartu ${tile.name}: ${picked >= 0 ? `Dapat rezeki +$${picked}` : `Denda -$${Math.abs(picked)}`}.`;
      session.subState = "CAN_PASS";
    } else {
      session.subState = "CAN_PASS";
    }
    saveDB();
    return await announceMonopolyBoard(sock, ctx, targetChatId, session, log, prefix);
  }
  if (action === "buy") {
    if (session.subState !== "CAN_BUY") {
      return sock.sendMessage(targetChatId, {
        text: "❌ Anda tidak sedang berada di petak yang dapat dibeli."
      });
    }
    const tile = BOARD_TILES[player.position];
    if (player.cash < tile.price) {
      return sock.sendMessage(targetChatId, {
        text: `❌ Saldo tidak cukup! Butuh $${tile.price}, saldo Anda $${player.cash}.`
      });
    }
    player.cash -= tile.price;
    session.properties[tile.id] = sender;
    session.subState = "WAIT_ROLL";
    const currIdx = session.players.findIndex(p => p.id === sender);
    const nextPlayer = session.players[(currIdx + 1) % session.players.length];
    session.turn = nextPlayer.id;
    saveDB();
    const buyLog = `🏢 @${sender.split("@")[0]} resmi membeli properti *${tile.name}* seharga *$${tile.price}*!`;
    await announceMonopolyBoard(sock, ctx, targetChatId, session, buyLog, prefix);
    if (session.turn === "BOT") {
      await handleBotTurn(sock, ctx, targetChatId, session);
    }
    return;
  }
  if (action === "pass") {
    session.subState = "WAIT_ROLL";
    const currIdx = session.players.findIndex(p => p.id === sender);
    const nextPlayer = session.players[(currIdx + 1) % session.players.length];
    session.turn = nextPlayer.id;
    saveDB();
    const passLog = `@${sender.split("@")[0]} mengakhiri gilirannya.`;
    await announceMonopolyBoard(sock, ctx, targetChatId, session, passLog, prefix);
    if (session.turn === "BOT") {
      await handleBotTurn(sock, ctx, targetChatId, session);
    }
  }
}
async function handleBotTurn(sock, ctx, chatId, session) {
  const currentSessionId = session.sessionId;
  setTimeout(async () => {
    try {
      const active = global.db.monopoly?.[chatId];
      if (!active || active.sessionId !== currentSessionId || active.state !== "PLAYING" || active.turn !== "BOT") return;
      const bot = active.players.find(p => p.id === "BOT");
      if (!bot) return;
      const r1 = Math.floor(Math.random() * 6) + 1;
      const r2 = Math.floor(Math.random() * 6) + 1;
      active.lastDice = [r1, r2];
      const prevPos = bot.position;
      const newPos = (prevPos + r1 + r2) % 40;
      bot.position = newPos;
      let log = `🤖 Bot Liquid melempar dadu [ ${r1} + ${r2} ] ➔ mendarat di *${BOARD_TILES[newPos].name}*.`;
      if (newPos < prevPos) {
        bot.cash += 200;
        log += `\n✨ Bot melewati GO (+$200).`;
      }
      const tile = BOARD_TILES[newPos];
      if (["property", "railroad", "utility"].includes(tile.type)) {
        const ownerId = active.properties[tile.id];
        if (!ownerId && bot.cash >= tile.price) {
          bot.cash -= tile.price;
          active.properties[tile.id] = "BOT";
          log += `\n🏢 Bot memutuskan membeli properti *${tile.name}* ($${tile.price})!`;
        } else if (ownerId && ownerId !== "BOT") {
          const owner = active.players.find(p => p.id === ownerId);
          bot.cash -= tile.rent;
          if (owner) owner.cash += tile.rent;
          log += `\n💸 Bot membayar sewa *$${tile.rent}* kepada @${ownerId.split("@")[0]}.`;
        }
      }
      const currIdx = active.players.findIndex(p => p.id === "BOT");
      const nextPlayer = active.players[(currIdx + 1) % active.players.length];
      active.turn = nextPlayer.id;
      active.subState = "WAIT_ROLL";
      saveDB();
      await announceMonopolyBoard(sock, ctx, chatId, active, log, ctx?.prefix || ".");
    } catch (e) {
      console.error("[MONOPOLY BOT ERROR]:", e);
    }
  }, 2400);
}
async function startMonopolyGame(sock, ctx, chatId, playerIds, isBot = false, prefix = ".") {
  clearSession(chatId);
  const players = playerIds.map(pId => {
    initDB(pId);
    purgePlayerFromOtherSessions(pId);
    return {
      id: pId,
      cash: 1500,
      position: 0,
      inJail: false
    };
  });
  const now = Date.now();
  global.db.monopoly[chatId] = {
    sessionId: now,
    state: "PLAYING",
    subState: "WAIT_ROLL",
    isBot: isBot,
    players: players,
    turn: players[0].id,
    properties: {},
    lastDice: [5, 3],
    createdAt: now,
    expireTime: now + 9e5
  };
  saveDB();
  await announceMonopolyBoard(sock, ctx, chatId, global.db.monopoly[chatId], "🏁 Permainan Dimulai! Semua pemain berkumpul di GO dengan modal awal $1,500.", prefix);
}
export default {
  name: "monopoli",
  aliases: ["monopoly", "mono"],
  description: "Game Monopoli Liquid Glass Dark Edition 40 Petak Full CTA (Anti-Crop)",
  category: "Game",
  limit: true,
  example: ".monopoli | .monopoli bot | .monopoli @user",
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
      if (/^[.#/!]?(monopoli|monopoly|mono)\s+(roll|buy|pass|stop|nyerah)/i.test(text)) {
        return await handleMonopolyAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[MONOPOLY BEFORE ERROR]:", e);
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
      if (/^(roll|buy|pass|stop|nyerah)/i.test(rawText)) {
        return await handleMonopolyAction(sock, ctx, msg, sender, `${prefix}monopoli ${rawText}`);
      }
      if (rawText.toLowerCase() === "stop" || rawText.toLowerCase() === "reset") {
        let activeCId = chatId;
        if (!global.db.monopoly[activeCId]) {
          for (const [cId, sess] of Object.entries(global.db.monopoly)) {
            if (sess.players?.some(p => p.id === sender)) {
              activeCId = cId;
              break;
            }
          }
        }
        if (global.db.monopoly[activeCId]) {
          clearSession(activeCId);
          const restartButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🎲 Main Monopoli",
              id: `${prefix}monopoli`
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🤖 Lawan Bot",
              id: `${prefix}monopoli bot`
            })
          }];
          return await sendCTA(sock, ctx, activeCId, {
            text: "🚪 Sesi permainan Monopoli telah dibersihkan.",
            buttons: restartButtons,
            mentions: [sender],
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi Monopoli yang sedang aktif.");
      }
      if (rawText.toLowerCase() === "board" || rawText.toLowerCase() === "papan") {
        let activeCId = chatId;
        if (!global.db.monopoly[activeCId]) {
          for (const [cId, sess] of Object.entries(global.db.monopoly)) {
            if (sess.players?.some(p => p.id === sender)) {
              activeCId = cId;
              break;
            }
          }
        }
        const session = global.db.monopoly[activeCId];
        if (!session || session.state !== "PLAYING") {
          return ctx.reply("❌ Tidak ada permainan Monopoli yang sedang berjalan.");
        }
        return await announceMonopolyBoard(sock, ctx, activeCId, session, "", prefix);
      }
      if (rawText.toLowerCase() === "bot" || rawText.toLowerCase() === "solo") {
        const existing = global.db.monopoly[chatId];
        if (existing && existing.state === "PLAYING") {
          return ctx.reply("⚠️ Masih ada permainan yang berlangsung. Ketik `.monopoli stop` terlebih dahulu.");
        }
        return await startMonopolyGame(sock, ctx, chatId, [sender, "BOT"], true, prefix);
      }
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        const pcButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤖 Main Lawan Bot (Solo)",
            id: `${prefix}monopoli bot`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: "💡 *Mode Multiplayer Monopoli membutuhkan Grup.*\nNamun Anda bisa langsung bermain Solo melawan Bot di Private Chat ini!",
          buttons: pcButtons,
          quoted: quotedMsg
        });
      }
      const mentioned = (ctx.mentionedJid || []).filter(id => id !== sender && !id.includes("bot"));
      if (mentioned.length > 0) {
        const existing = global.db.monopoly[chatId];
        if (existing && existing.state === "PLAYING") {
          return ctx.reply("⚠️ Sedang ada permainan aktif. Ketik `.monopoli stop` terlebih dahulu.");
        }
        const participants = [sender, ...new Set(mentioned)].slice(0, 4);
        return await startMonopolyGame(sock, ctx, chatId, participants, false, prefix);
      }
      const activeSession = global.db.monopoly[chatId];
      if (rawText.toLowerCase() === "join" || rawText.toLowerCase() === "gabung") {
        if (!activeSession || activeSession.state !== "LOBBY") {
          return ctx.reply(`❌ Tidak ada lobby Monopoli yang terbuka.`);
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
        let joinText = `🤝 @${sender.split("@")[0]} bergabung ke Lobi Monopoli!\n\n*Pemain Terkumpul (${activeSession.players.length}/4):*\n`;
        activeSession.players.forEach((p, idx) => {
          joinText += `${idx + 1}. @${p.split("@")[0]}\n`;
        });
        const lobbyButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Ikut Gabung",
            id: `${prefix}monopoli join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "▶️ Mulai Game",
            id: `${prefix}monopoli start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal",
            id: `${prefix}monopoli stop`
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
          return ctx.reply("❌ Tidak ada lobi yang menunggu dimulai.");
        }
        if (activeSession.host !== sender) {
          return ctx.reply(`❌ Hanya Host lobi (@${activeSession.host.split("@")[0]}) yang bisa memulai!`, {
            mentions: [activeSession.host]
          });
        }
        if (activeSession.players.length < 2) {
          return ctx.reply("❌ Minimal butuh 2 pemain untuk memulai! Atau ketik `.monopoli bot` untuk main solo lawan Bot.");
        }
        return await startMonopolyGame(sock, ctx, chatId, activeSession.players, false, prefix);
      }
      if (activeSession) {
        if (activeSession.state === "PLAYING") {
          return ctx.reply("⚠️ Permainan sedang berlangsung! Ketik `.monopoli stop` untuk berhenti.");
        }
        let lobbyText = `📢 *LOBBY MONOPOLI MASIH TERBUKA!*\n👑 Host: @${activeSession.host.split("@")[0]}\n\n*Daftar Pemain (${activeSession.players.length}/4):*\n`;
        activeSession.players.forEach((p, idx) => {
          lobbyText += `${idx + 1}. @${p.split("@")[0]}\n`;
        });
        const existingButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Ikut Gabung",
            id: `${prefix}monopoli join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "▶️ Mulai Game",
            id: `${prefix}monopoli start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal",
            id: `${prefix}monopoli stop`
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
      global.db.monopoly[chatId] = {
        sessionId: Date.now(),
        state: "LOBBY",
        host: sender,
        players: [sender],
        createdAt: Date.now(),
        expireTime: Date.now() + 12e4
      };
      saveDB();
      const lobbyBody = `🎩 *LOBBY MONOPOLY LIQUID GLASS (40 PETAK)* 🎩\n\n` + `• 👑 *Host:* @${sender.split("@")[0]}\n` + `• 👥 *Pemain:* 1/4 Terdaftar (2-4 Pemain / Lawan Bot)\n\n` + `Kumpulkan properti terbaik, tarik uang sewa, dan buat lawan Anda bangkrut!\n` + `_Batas persiapan lobi: 2 Menit._`;
      const lobbyButtons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤝 Ikut Gabung (Join)",
          id: `${prefix}monopoli join`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "▶️ Mulai Permainan",
          id: `${prefix}monopoli start`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤖 Lawan Bot (Solo)",
          id: `${prefix}monopoli bot`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🚪 Batal Lobi",
          id: `${prefix}monopoli stop`
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
      console.error("[MONOPOLY EXECUTE ERROR]:", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};