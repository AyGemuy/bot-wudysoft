import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.mines) global.db.mines = {};
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
  if (global.db?.mines?.[chatId]) {
    delete global.db.mines[chatId];
    saveDB();
  }
}

function rewardPlayer(jid, name = "", prizeMoney = 1e4, prizeExp = 300) {
  if (!jid || jid.includes("BOT")) return;
  initDB(jid, name);
  global.db.user[jid].money = (Number(global.db.user[jid].money) || 0) + prizeMoney;
  global.db.user[jid].exp = (Number(global.db.user[jid].exp) || 0) + prizeExp;
  saveDB();
}

function cleanExpiredSessions(currentChatId = null) {
  if (!global.db?.mines) return;
  const now = Date.now();
  let changed = false;
  for (const [cId, session] of Object.entries(global.db.mines)) {
    const isExpired = session?.expireTime && now > session.expireTime;
    const isCorrupt = !session || !session.state || !session.players && !session.host;
    if (isExpired || isCorrupt) {
      delete global.db.mines[cId];
      changed = true;
    }
  }
  if (currentChatId && global.db.mines[currentChatId]) {
    const s = global.db.mines[currentChatId];
    if (s.expireTime && now > s.expireTime) {
      delete global.db.mines[currentChatId];
      changed = true;
    }
  }
  if (changed) saveDB();
}

function purgePlayerFromOtherSessions(playerJid) {
  if (!global.db?.mines || !playerJid) return;
  let changed = false;
  for (const [cId, session] of Object.entries(global.db.mines)) {
    if (session.state === "LOBBY") {
      if (session.host === playerJid) {
        delete global.db.mines[cId];
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
const MULTIPLIERS = [1, 1.25, 1.6, 2.1, 2.8, 3.8, 5.2, 7.5, 11, 16.5, 26, 42, 75];
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

function generateMinesHTML(session) {
  const isSolo = session.mode === "SOLO";
  let gridHTML = "";
  for (let i = 0; i < 25; i++) {
    const isOpened = session.revealed.includes(i);
    const tileVal = session.grid[i];
    if (!isOpened) {
      gridHTML += `
        <div class="tile crate">
          <div class="crate-brace brace-1"></div>
          <div class="crate-brace brace-2"></div>
          <div class="crate-corner tl"></div>
          <div class="crate-corner tr"></div>
          <div class="crate-corner bl"></div>
          <div class="crate-corner br"></div>
          <span class="tile-num">${i + 1}</span>
        </div>
      `;
    } else {
      if (tileVal === "BOMB") {
        gridHTML += `
          <div class="tile floor bomb-tile">
            <div class="round-bomb">
              <div class="bomb-spark"></div>
              <div class="bomb-cap"></div>
              <div class="bomb-body"></div>
            </div>
          </div>
        `;
      } else if (tileVal === "CROWN") {
        gridHTML += `
          <div class="tile floor crown-tile">
            <span class="powerup-icon">👑</span>
          </div>
        `;
      } else {
        gridHTML += `
          <div class="tile floor gem-tile">
            <span class="powerup-icon">💎</span>
          </div>
        `;
      }
    }
  }
  let hudPlayersHTML = "";
  if (isSolo) {
    const mult = MULTIPLIERS[session.safeCount] || 1;
    const currentPrize = Math.floor(session.baseBet * mult);
    hudPlayersHTML = `
      <div class="hud-character">
        <div class="char-avatar-box">
          <div class="mini-dynamite"></div>
        </div>
        <div class="char-stats">
          <span>💣 <b>3</b></span>
          <span>💎 <b>${session.safeCount}</b></span>
          <span>🔥 <b>${mult}x</b></span>
        </div>
      </div>
      <div class="hud-banner-solo">
        <span>💰 POT: <b>Rp ${currentPrize.toLocaleString("id-ID")}</b></span>
      </div>
    `;
  } else {
    session.players.slice(0, 4).forEach(p => {
      const isTurn = p.id === session.turn;
      const rawName = p.name || p.id.split("@")[0];
      const cleanName = rawName.length > 8 ? rawName.slice(0, 7) + ".." : rawName;
      hudPlayersHTML += `
        <div class="hud-character ${isTurn ? "active-turn" : ""}">
          <div class="char-avatar-box">
            <div class="mini-dynamite"></div>
          </div>
          <div class="char-stats">
            <span class="hud-pname">${cleanName}</span>
            <span>⭐ <b>${p.score || 0}</b></span>
          </div>
        </div>
      `;
    });
  }
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 960px;
      height: auto;
      background: #140905;
      font-family: 'Courier New', Courier, monospace, sans-serif;
    }
    .wrapper {
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #1a0c07;
    }

    /* TOP STATUS BAR RETRO DENGAN TIMER JAM */
    .top-hud-bar {
      width: 880px;
      height: 70px;
      background: #3d1c13;
      border: 4px solid #1a0904;
      border-bottom: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      box-shadow: inset 0 4px 6px rgba(255,255,255,0.15), inset 0 -4px 6px rgba(0,0,0,0.6);
    }
    .hud-team-list {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .hud-character {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(0, 0, 0, 0.4);
      padding: 4px 10px;
      border-radius: 4px;
      border: 2px solid #5a2e22;
    }
    .hud-character.active-turn {
      border-color: #f1c40f;
      background: rgba(241, 196, 15, 0.15);
      box-shadow: 0 0 10px #f1c40f;
    }
    .char-avatar-box {
      width: 28px;
      height: 38px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mini-dynamite {
      width: 20px;
      height: 30px;
      background: #d63031;
      border-radius: 4px 4px 2px 2px;
      border: 2px solid #111;
      position: relative;
    }
    .mini-dynamite::before {
      content: '';
      position: absolute;
      top: -6px;
      left: 7px;
      width: 2px;
      height: 5px;
      background: #fff;
    }
    .mini-dynamite::after {
      content: '';
      position: absolute;
      top: 6px;
      left: 2px;
      width: 12px;
      height: 6px;
      background: #0984e3;
      border-radius: 2px;
    }
    .char-stats {
      display: flex;
      flex-direction: column;
      color: #fff;
      font-size: 11px;
      font-weight: 900;
      line-height: 1.2;
    }
    .hud-pname {
      color: #ffd166;
      font-size: 10px;
      text-transform: uppercase;
    }
    .hud-banner-solo {
      color: #f1c40f;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .hud-clock-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(0,0,0,0.5);
      padding: 6px 14px;
      border-radius: 6px;
      border: 2px solid #6b7280;
    }
    .clock-dial {
      font-size: 22px;
      line-height: 1;
    }
    .clock-val {
      font-size: 24px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: 2px;
    }

    /* BINGKAI BETON & ARENA DINDING BATA */
    .arena-frame {
      width: 880px;
      height: 800px;
      background: #472118;
      border: 18px solid #7d8590;
      box-shadow: inset 0 0 40px rgba(0,0,0,0.9), 0 12px 25px rgba(0,0,0,0.8);
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background-image:
        linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)),
        repeating-linear-gradient(0deg, #3d1b13, #3d1b13 28px, #260f0a 28px, #260f0a 32px),
        repeating-linear-gradient(90deg, transparent, transparent 56px, #260f0a 56px, #260f0a 60px);
    }

    /* GRID 5X5 MINES ARENA */
    .grid-battlefield {
      width: 660px;
      height: 660px;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      grid-template-rows: repeat(5, 1fr);
      gap: 10px;
      padding: 10px;
      background: rgba(0, 0, 0, 0.4);
      border: 4px solid #2b110b;
      box-shadow: inset 0 0 30px rgba(0,0,0,0.85);
    }

    /* PETI KAYU (UNOPENED CRATE X) */
    .tile.crate {
      background: linear-gradient(135deg, #d39e56 0%, #b88037 50%, #9e6928 100%);
      border: 4px solid #4a280e;
      border-radius: 4px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 2px 2px 0 rgba(255,255,255,0.4), inset -2px -2px 0 rgba(0,0,0,0.4), 0 4px 6px rgba(0,0,0,0.6);
      overflow: hidden;
    }
    .crate-brace {
      position: absolute;
      width: 145%;
      height: 12px;
      background: #734316;
      border-top: 2px solid #945821;
      border-bottom: 2px solid #422307;
    }
    .brace-1 { transform: rotate(45deg); }
    .brace-2 { transform: rotate(-45deg); }
    .crate-corner {
      position: absolute;
      width: 10px;
      height: 10px;
      background: #2b1406;
    }
    .crate-corner.tl { top: 0; left: 0; }
    .crate-corner.tr { top: 0; right: 0; }
    .crate-corner.bl { bottom: 0; left: 0; }
    .crate-corner.br { bottom: 0; right: 0; }

    .tile-num {
      position: relative;
      z-index: 10;
      background: rgba(26, 12, 4, 0.9);
      color: #ffe6a7;
      font-weight: 900;
      font-size: 18px;
      padding: 2px 8px;
      border-radius: 4px;
      border: 2px solid #f39c12;
      box-shadow: 0 3px 6px rgba(0,0,0,0.8);
    }

    /* LANTAI BATU TERBUKA (OPENED FLOOR) */
    .tile.floor {
      background: #576574;
      border: 3px solid #222f3e;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 0 15px rgba(0,0,0,0.7);
      position: relative;
    }

    /* POWER-UP GEMS & CROWN */
    .powerup-icon {
      font-size: 42px;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.8));
    }
    .gem-tile {
      background: radial-gradient(circle, #0984e3 0%, #2c3e50 80%) !important;
      border-color: #74b9ff !important;
    }
    .crown-tile {
      background: radial-gradient(circle, #f39c12 0%, #3e2723 80%) !important;
      border-color: #f1c40f !important;
    }

    /* BOM RETRO BERPIJAR */
    .bomb-tile {
      background: radial-gradient(circle, #c0392b 0%, #1e272e 80%) !important;
      border-color: #e74c3c !important;
    }
    .round-bomb {
      width: 52px;
      height: 52px;
      position: relative;
    }
    .bomb-body {
      width: 48px;
      height: 48px;
      background: radial-gradient(circle at 35% 35%, #57606f 0%, #1e272e 60%, #000 100%);
      border-radius: 50%;
      border: 2px solid #111;
      position: absolute;
      bottom: 0;
      left: 2px;
    }
    .bomb-cap {
      width: 14px;
      height: 8px;
      background: #747d8c;
      position: absolute;
      top: 0;
      left: 19px;
      border-radius: 2px;
      border: 1px solid #111;
    }
    .bomb-spark {
      width: 10px;
      height: 10px;
      background: #f1c40f;
      border-radius: 50%;
      position: absolute;
      top: -8px;
      left: 21px;
      box-shadow: 0 0 10px #ff7675, 0 0 16px #e84118;
    }

    /* FOOTER TEKS RETRO */
    .retro-footer {
      width: 880px;
      text-align: center;
      background: #110704;
      color: #95a5a6;
      font-size: 13px;
      font-weight: 700;
      padding: 10px;
      border-top: 4px solid #3d1c13;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <!-- TOP HUD RETRO -->
    <div class="top-hud-bar">
      <div class="hud-team-list">
        ${hudPlayersHTML}
      </div>
      <div class="hud-clock-box">
        <span class="clock-dial">⏱️</span>
        <span class="clock-val">95</span>
      </div>
    </div>

    <!-- ARENA AREAL PERTEMPURAN -->
    <div class="arena-frame">
      <div class="grid-battlefield">
        ${gridHTML}
      </div>
    </div>

    <div class="retro-footer">
      PLAY MINES BATTLE ROYALE • BLOW THE CRATES & FIND GEMS
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
  const finalFooter = footer || `${botName} • Bomberman Mines`;
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
          title: b.title || "PILIH PETI",
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
        list_title: `${botName} • Mines Battle`,
        button_title: "Buka Peti"
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
async function announceMinesBoard(sock, ctx, chatId, session, extraLog = "", prefix = ".") {
  const {
    buffer: imgBuffer
  } = await renderHtmlToImage(generateMinesHTML(session));
  const unrevealedTiles = [];
  for (let i = 0; i < 25; i++) {
    if (!session.revealed.includes(i)) {
      unrevealedTiles.push({
        title: `📦 Ledakkan Peti #${i + 1}`,
        id: `${prefix}mines open ${i + 1} ${chatId}`,
        description: `Baris ${Math.floor(i / 5) + 1}, Kolom ${i % 5 + 1}`
      });
    }
  }
  const buttons = [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: "🎯 PILIH PETI UNTUK DILEDAKKAN",
      sections: [{
        title: `SISA PETI KAYU (${unrevealedTiles.length})`,
        rows: unrevealedTiles
      }]
    })
  }];
  if (session.mode === "SOLO") {
    const mult = MULTIPLIERS[session.safeCount] || 1;
    const currentPrize = Math.floor(session.baseBet * mult);
    if (session.safeCount > 0) {
      buttons.push({
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: `💰 Tarik Uang (Rp ${currentPrize.toLocaleString("id-ID")})`,
          id: `${prefix}mines cashout ${chatId}`
        })
      });
    }
  }
  buttons.push({
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🚪 Akhiri Permainan",
      id: `${prefix}mines stop ${chatId}`
    })
  });
  let caption = `💣 *ARENA BOMBERMAN MINES BATTLE* 💣\n\n`;
  if (extraLog) caption += `📢 ${extraLog}\n\n`;
  if (session.mode === "SOLO") {
    const mult = MULTIPLIERS[session.safeCount] || 1;
    caption += `👤 *Pemain:* @${session.host.split("@")[0]}\n`;
    caption += `✨ *Multiplier:* ${mult}x\n`;
    caption += `🎁 *Pot Hadiah:* Rp ${Math.floor(session.baseBet * mult).toLocaleString("id-ID")}\n\n`;
    caption += `_Pilih peti berikutnya via menu pilihan atau amankan saldo lewat tombol Tarik Uang!_`;
  } else {
    caption += `🎯 *Giliran Beraksi:* @${session.turn.split("@")[0]}\n\n`;
    caption += `_Pilih peti kayu misterius dan hindari ranjau dinamit!_`;
  }
  const mentions = session.mode === "SOLO" ? [session.host] : session.players.map(p => p.id);
  await sendCTA(sock, ctx, chatId, {
    text: caption,
    buttons: buttons,
    image: imgBuffer,
    mentions: mentions
  });
}
async function handleMinesAction(sock, ctx, msg, sender, rawText) {
  initDB(sender, ctx?.pushName || "");
  cleanExpiredSessions();
  const parts = rawText.split(/\s+/);
  const action = (parts[1] || "").toLowerCase();
  const tileParam = parseInt(parts[2]);
  const targetChatId = parts[3] || parts[2] || ctx?.id;
  const session = global.db.mines[targetChatId];
  if (!session) {
    return ctx?.reply ? ctx.reply("❌ Tidak ada sesi Mines yang sedang berjalan.") : null;
  }
  const prefix = ctx?.prefix || ".";
  if (action === "stop" || action === "nyerah" || action === "batal") {
    clearSession(targetChatId);
    const restartButtons = [{
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "💣 Main Solo Mines",
        id: `${prefix}mines solo`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "👥 Buka Lobby Grup",
        id: `${prefix}mines`
      })
    }];
    return await sendCTA(sock, ctx, targetChatId, {
      text: `🚪 Permainan Mines dihentikan atas permintaan @${sender.split("@")[0]}. Ruangan telah dibersihkan!`,
      buttons: restartButtons,
      mentions: [sender]
    });
  }
  if (session.state !== "PLAYING") return;
  if (action === "cashout") {
    if (session.mode !== "SOLO" || session.host !== sender) return;
    if (session.safeCount === 0) {
      return sock.sendMessage(sender, {
        text: "❌ Anda belum membuka peti satupun untuk ditarik!"
      });
    }
    const mult = MULTIPLIERS[session.safeCount] || 1;
    const finalPrize = Math.floor(session.baseBet * mult);
    const finalExp = Math.floor(120 * mult);
    rewardPlayer(sender, ctx?.pushName || "", finalPrize, finalExp);
    clearSession(targetChatId);
    const winButtons = [{
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "💣 Main Lagi (Solo)",
        id: `${prefix}mines solo`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "👥 Tantang Teman Grup",
        id: `${prefix}mines`
      })
    }];
    return await sendCTA(sock, ctx, targetChatId, {
      text: `💰 *CASHOUT BERHASIL! (MENANG BESAR)* 💰\n\n` + `👤 *Pemenang:* @${sender.split("@")[0]}\n` + `💎 *Peti Aman Terbuka:* ${session.safeCount}\n` + `🔥 *Multiplier Akhir:* ${mult}x\n\n` + `🎁 *Hadiah Masuk Saldo:* +Rp ${finalPrize.toLocaleString("id-ID")} Money & +${finalExp} EXP!`,
      buttons: winButtons,
      mentions: [sender]
    });
  }
  if (action === "open") {
    const tileIdx = tileParam - 1;
    if (isNaN(tileIdx) || tileIdx < 0 || tileIdx >= 25) return;
    if (session.revealed.includes(tileIdx)) {
      return sock.sendMessage(sender, {
        text: "⚠️ Peti tersebut sudah diledakkan! Pilih peti lain."
      });
    }
    if (session.mode !== "SOLO" && session.turn !== sender) {
      return sock.sendMessage(sender, {
        text: "⏳ Bukan giliran Anda! Tunggu pemain lain melangkah."
      });
    }
    session.revealed.push(tileIdx);
    session.expireTime = Date.now() + 3e5;
    const tileContent = session.grid[tileIdx];
    if (session.mode === "SOLO") {
      if (tileContent === "BOMB") {
        clearSession(targetChatId);
        const {
          buffer: imgBuffer
        } = await renderHtmlToImage(generateMinesHTML(session));
        const retryButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💣 Coba Lagi",
            id: `${prefix}mines solo`
          })
        }];
        return await sendCTA(sock, ctx, targetChatId, {
          text: `💥 *BOOOOM! PETI BERISI BOM MESIU!* 💥\n\n@${sender.split("@")[0]} terkena ledakan bom pada Peti #${tileParam}. Seluruh potensi hadiah hangus terbakar!`,
          buttons: retryButtons,
          image: imgBuffer,
          mentions: [sender]
        });
      }
      session.safeCount += 1;
      saveDB();
      if (session.safeCount >= 22) {
        const grandPrize = session.baseBet * 100;
        rewardPlayer(sender, ctx?.pushName || "", grandPrize, 2e3);
        clearSession(targetChatId);
        return await sendCTA(sock, ctx, targetChatId, {
          text: `👑 *JACKPOT SEMPURNA (CLEARED ALL MINES)!* 👑\n\n@${sender.split("@")[0]} berhasil meledakkan 22 peti tanpa terkena bom satupun!\n\n🎁 *Hadiah Utama:* +Rp ${grandPrize.toLocaleString("id-ID")} Money & +2.000 EXP!`,
          mentions: [sender]
        });
      }
      const mult = MULTIPLIERS[session.safeCount] || 1;
      const log = `💎 Peti #${tileParam} AMAN! Multiplier naik menjadi *${mult}x*.`;
      return await announceMinesBoard(sock, ctx, targetChatId, session, log, prefix);
    }
    const player = session.players.find(p => p.id === sender);
    let logMsg = "";
    if (tileContent === "BOMB") {
      player.score = Math.max(0, (player.score || 0) - 150);
      logMsg = `💥 *KABOOM!* @${sender.split("@")[0]} terkena bom di Peti #${tileParam} (-150 Poin)!`;
    } else if (tileContent === "CROWN") {
      player.score = (player.score || 0) + 250;
      logMsg = `👑 *LUCKY!* @${sender.split("@")[0]} menemukan Mahkota Emas di Peti #${tileParam} (+250 Poin)!`;
    } else {
      player.score = (player.score || 0) + 100;
      logMsg = `💎 @${sender.split("@")[0]} menemukan Permata Biru di Peti #${tileParam} (+100 Poin)!`;
    }
    if (session.revealed.length >= 25) {
      session.players.sort((a, b) => b.score - a.score);
      const winner = session.players[0];
      clearSession(targetChatId);
      if (winner.id !== "BOT") rewardPlayer(winner.id, winner.name, 15e3, 400);
      let endText = `🏁 *PERTEMPURAN BOMBERMAN SELESAI!* 🏁\n\n*Klasemen Akhir Poin:*\n`;
      session.players.forEach((p, idx) => {
        endText += `${idx + 1}. @${p.id.split("@")[0]}: *${p.score} Poin*\n`;
      });
      endText += `\n🏆 *Juara 1:* @${winner.id.split("@")[0]}!\n🎁 *Hadiah:* +Rp 15.000 Money & +400 EXP!`;
      const endButtons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "💣 Main Lagi",
          id: `${prefix}mines`
        })
      }];
      return await sendCTA(sock, ctx, targetChatId, {
        text: endText,
        buttons: endButtons,
        mentions: session.players.map(p => p.id)
      });
    }
    const currentIdx = session.players.findIndex(p => p.id === sender);
    const nextPlayer = session.players[(currentIdx + 1) % session.players.length];
    session.turn = nextPlayer.id;
    saveDB();
    await announceMinesBoard(sock, ctx, targetChatId, session, logMsg, prefix);
  }
}
async function startMinesGame(sock, ctx, chatId, playerIds, isSolo = false, prefix = ".") {
  clearSession(chatId);
  const grid = Array(25).fill("GEM");
  const bombPositions = new Set();
  while (bombPositions.size < 3) {
    bombPositions.add(Math.floor(Math.random() * 25));
  }
  bombPositions.forEach(pos => grid[pos] = "BOMB");
  const crownPositions = new Set();
  while (crownPositions.size < 3) {
    const pos = Math.floor(Math.random() * 25);
    if (!bombPositions.has(pos)) crownPositions.add(pos);
  }
  crownPositions.forEach(pos => grid[pos] = "CROWN");
  const now = Date.now();
  if (isSolo) {
    initDB(playerIds[0]);
    purgePlayerFromOtherSessions(playerIds[0]);
    global.db.mines[chatId] = {
      sessionId: now,
      state: "PLAYING",
      mode: "SOLO",
      host: playerIds[0],
      grid: grid,
      revealed: [],
      safeCount: 0,
      baseBet: 5e3,
      expireTime: now + 3e5
    };
  } else {
    const players = playerIds.map(pId => {
      initDB(pId);
      purgePlayerFromOtherSessions(pId);
      return {
        id: pId,
        name: global.db?.user?.[pId]?.name || pId.split("@")[0],
        score: 0
      };
    });
    global.db.mines[chatId] = {
      sessionId: now,
      state: "PLAYING",
      mode: "MULTI",
      players: players,
      turn: players[0].id,
      grid: grid,
      revealed: [],
      expireTime: now + 4e5
    };
  }
  saveDB();
  await announceMinesBoard(sock, ctx, chatId, global.db.mines[chatId], "Arena Bomberman siap dimulai!", prefix);
}
export default {
  name: "mines",
  aliases: ["mine", "tambang", "ranjau", "bomberman"],
  description: "Mini-game Mines Retro Bomberman 5x5 Grid Full CTA (Solo Cashout & Multiplayer)",
  category: "Game",
  limit: true,
  example: ".mines | .mines solo | .mines @user",
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
      if (/^[.#/!]?mines\s+(open|cashout|stop|nyerah|batal)/i.test(text)) {
        return await handleMinesAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[MINES BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ *Mines Game hanya dapat dimainkan di dalam Grup!*");
      }
      const chatId = ctx.id;
      const sender = ctx.sender;
      const senderName = ctx.pushName || "Player";
      const rawText = (ctx.query || "").trim();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      initDB(sender, senderName);
      cleanExpiredSessions(chatId);
      if (/^(open|cashout|stop|nyerah|batal)/i.test(rawText)) {
        return await handleMinesAction(sock, ctx, msg, sender, `${prefix}mines ${rawText}`);
      }
      if (rawText.toLowerCase() === "stop" || rawText.toLowerCase() === "reset") {
        if (global.db.mines[chatId]) {
          clearSession(chatId);
          const restartButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "💣 Main Solo Mines",
              id: `${prefix}mines solo`
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "👥 Buka Lobby Baru",
              id: `${prefix}mines`
            })
          }];
          return await sendCTA(sock, ctx, chatId, {
            text: "🚪 Sesi Bomberman Mines telah dibersihkan secara tuntas.",
            buttons: restartButtons,
            mentions: [sender],
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi Mines yang sedang aktif.");
      }
      if (rawText.toLowerCase() === "solo") {
        const existing = global.db.mines[chatId];
        if (existing && existing.state === "PLAYING") {
          return ctx.reply("⚠️ Masih ada permainan yang berjalan. Tekan tombol Akhiri Game terlebih dahulu.");
        }
        return await startMinesGame(sock, ctx, chatId, [sender], true, prefix);
      }
      const mentioned = (ctx.mentionedJid || []).filter(id => id !== sender && !id.includes("bot"));
      if (mentioned.length > 0) {
        const existing = global.db.mines[chatId];
        if (existing && existing.state === "PLAYING") {
          return ctx.reply("⚠️ Sedang ada permainan aktif di room ini. Ketik `.mines stop` terlebih dahulu.");
        }
        const participants = [sender, ...new Set(mentioned)].slice(0, 4);
        return await startMinesGame(sock, ctx, chatId, participants, false, prefix);
      }
      const activeSession = global.db.mines[chatId];
      if (rawText.toLowerCase() === "join" || rawText.toLowerCase() === "gabung") {
        if (!activeSession || activeSession.state !== "LOBBY") {
          return ctx.reply(`❌ Tidak ada lobby Mines yang terbuka. Buka baru dengan \`${prefix}mines\``);
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
        let joinText = `🤝 @${sender.split("@")[0]} bergabung ke Lobi Bomberman!\n\n*Pemain Terkumpul (${activeSession.players.length}/4):*\n`;
        activeSession.players.forEach((p, idx) => {
          joinText += `${idx + 1}. @${p.split("@")[0]}\n`;
        });
        const lobbyButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Gabung (Join)",
            id: `${prefix}mines join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎮 Mulai Game",
            id: `${prefix}mines start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal",
            id: `${prefix}mines stop`
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
        return await startMinesGame(sock, ctx, chatId, activeSession.players, false, prefix);
      }
      if (activeSession) {
        if (activeSession.state === "PLAYING") {
          return ctx.reply("⚠️ Permainan sedang berlangsung! Ketik `.mines stop` untuk mereset.");
        }
        let lobbyText = `📢 *LOBBY BOMBERMAN MINES MASIH TERBUKA!*\n👑 Host: @${activeSession.host.split("@")[0]}\n\n*Daftar Pemain (${activeSession.players.length}/4):*\n`;
        activeSession.players.forEach((p, idx) => {
          lobbyText += `${idx + 1}. @${p.split("@")[0]}\n`;
        });
        lobbyText += `\n_Klik tombol di bawah untuk bergabung atau mulai!_`;
        const existingButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Gabung (Join)",
            id: `${prefix}mines join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎮 Mulai Game",
            id: `${prefix}mines start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal",
            id: `${prefix}mines stop`
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
      global.db.mines[chatId] = {
        sessionId: Date.now(),
        state: "LOBBY",
        host: sender,
        players: [sender],
        createdAt: Date.now(),
        expireTime: Date.now() + 12e4
      };
      saveDB();
      const lobbyBody = `💣 *LOBBY BOMBERMAN MINES BATTLE (5x5 GRID)* 💣\n\n` + `• 👑 *Host:* @${sender.split("@")[0]}\n` + `• 👥 *Pemain:* 1/4 Terkumpul\n\n` + `Ledakkan peti kayu dan kumpulkan permata tanpa memicu ranjau bom mesiu!\n` + `_Batas waktu persiapan: 2 Menit._`;
      const lobbyButtons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤝 Gabung Lobi",
          id: `${prefix}mines join`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎮 Mulai Multiplayer",
          id: `${prefix}mines start`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "💣 Main Solo Cashout",
          id: `${prefix}mines solo`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🚪 Batal Lobi",
          id: `${prefix}mines stop`
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
      console.error("[MINES EXECUTE ERROR]:", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};