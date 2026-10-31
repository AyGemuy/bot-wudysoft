import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
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

function buildRouletteCanvasHtml(game, statusText = "DUEL READY", deathChance = "16.7%") {
  const botName = global.bot?.name || "WudysoftBot";
  const currentChamber = game?.currentChamber || 0;
  const isShot = statusText === "BOOM! SHOT DEAD";
  const isClick = statusText === "CLICK! EMPTY";
  const angles = [0, 60, 120, 180, 240, 300];
  const chambersHtml = angles.map((deg, i) => {
    let chamberClass = "unfired";
    let icon = i + 1;
    if (i < currentChamber) {
      chamberClass = "empty";
      icon = "✕";
    } else if (i === currentChamber) {
      if (isShot) {
        chamberClass = "fired-bullet";
        icon = "💥";
      } else {
        chamberClass = "active-next";
        icon = "●";
      }
    }
    const rad = deg * Math.PI / 180;
    const x = Math.round(75 * Math.sin(rad));
    const y = Math.round(-75 * Math.cos(rad));
    return `
      <div class="chamber-hole ${chamberClass}" style="transform: translate(${x}px, ${y}px);">
        ${icon}
      </div>
    `;
  }).join("");
  const statusColor = isShot ? "#ef4444" : isClick ? "#10b981" : "#f59e0b";
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800;900&family=Rajdhani:wght@700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 750px;
        height: 480px;
        background: #090a0f;
        font-family: 'Plus Jakarta Sans', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .duel-card {
        width: 710px;
        height: 440px;
        background: radial-gradient(circle at 50% 50%, rgba(220, 38, 38, 0.15) 0%, rgba(10, 12, 18, 0.98) 75%);
        border: 2px solid #2d2629;
        border-radius: 20px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.85);
        padding: 22px 28px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .header-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .brand-title {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .brand-icon {
        background: #dc2626;
        color: #fff;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      }
      .brand-text {
        color: #f8fafc;
        font-size: 18px;
        font-weight: 900;
        letter-spacing: 0.5px;
      }
      .status-pill {
        border: 1px solid ${statusColor};
        color: ${statusColor};
        background: rgba(15, 23, 42, 0.8);
        padding: 5px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 2px;
        text-transform: uppercase;
      }
      .arena-stage {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 0;
      }
      .player-panel {
        width: 200px;
        background: #11141e;
        border: 1px solid #202738;
        border-radius: 12px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .player-panel.active {
        border-color: #f59e0b;
        background: rgba(245, 158, 11, 0.08);
      }
      .panel-tag {
        font-size: 11px;
        font-weight: 800;
        color: #94a3b8;
        letter-spacing: 1.5px;
      }
      .panel-name {
        font-size: 16px;
        font-weight: 900;
        color: #f1f5f9;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cylinder-hub {
        width: 210px;
        height: 210px;
        background: radial-gradient(circle, #2b3345 0%, #151922 100%);
        border-radius: 50%;
        border: 4px solid #3c475d;
        box-shadow: inset 0 0 25px rgba(0,0,0,0.9), 0 10px 25px rgba(0,0,0,0.6);
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .cylinder-center {
        width: 50px;
        height: 50px;
        background: #11141c;
        border: 3px solid #3a455a;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: 'Rajdhani', sans-serif;
        font-size: 12px;
        font-weight: 800;
        color: #94a3b8;
        z-index: 2;
      }
      .chamber-hole {
        position: absolute;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: 'Rajdhani', sans-serif;
        font-size: 16px;
        font-weight: 800;
        box-shadow: inset 0 3px 6px rgba(0,0,0,0.8);
      }
      .chamber-hole.unfired {
        background: #1e2638;
        border: 2px solid #344055;
        color: #64748b;
      }
      .chamber-hole.active-next {
        background: #d97706;
        border: 2px solid #fbbf24;
        color: #000;
        box-shadow: 0 0 14px #d97706;
      }
      .chamber-hole.empty {
        background: #0d1117;
        border: 2px solid #1a222d;
        color: #475569;
      }
      .chamber-hole.fired-bullet {
        background: #dc2626;
        border: 2px solid #f87171;
        color: #fff;
        box-shadow: 0 0 20px #dc2626;
      }
      .footer-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #1e2535;
        padding-top: 12px;
        color: #94a3b8;
        font-size: 13px;
        font-weight: 700;
      }
      .footer-meta b {
        color: #ef4444;
      }
    </style>
  </head>
  <body>
    <div class="duel-card">
      <div class="header-meta">
        <div class="brand-title">
          <div class="brand-icon">🔫</div>
          <div class="brand-text">RUSSIAN <span>ROULETTE</span></div>
        </div>
        <div class="status-pill">${statusText}</div>
      </div>
      <div class="arena-stage">
        <div class="player-panel ${game?.turnJid === game?.player1?.jid ? "active" : ""}">
          <div class="panel-tag">${game?.turnJid === game?.player1?.jid ? "● CURRENT TURN" : "PLAYER 1"}</div>
          <div class="panel-name">${game?.player1?.name || "Player 1"}</div>
          <small style="color: #64748b; font-size: 11px;">SPIN: ${game?.player1?.hasSpun ? "USED (1x)" : "AVAILABLE"}</small>
        </div>
        <div class="cylinder-hub">
          <div class="cylinder-center">REVOLVER</div>
          ${chambersHtml}
        </div>
        <div class="player-panel ${game?.turnJid === game?.player2?.jid ? "active" : ""}">
          <div class="panel-tag">${game?.turnJid === game?.player2?.jid ? "● CURRENT TURN" : "PLAYER 2"}</div>
          <div class="panel-name">${game?.player2?.name || (game?.status === "WAITING" ? "Waiting Opponent..." : "Player 2")}</div>
          <small style="color: #64748b; font-size: 11px;">SPIN: ${game?.player2?.hasSpun ? "USED (1x)" : "AVAILABLE"}</small>
        </div>
      </div>
      <div class="footer-meta">
        <div>DEATH CHANCE : <b>${deathChance}</b></div>
        <div>POT TARUHAN : <b style="color: #22c55e;">Rp ${(game?.bet ? game.bet * 2 : 0).toLocaleString()}</b></div>
        <div>BOT : <b>${botName}</b></div>
      </div>
    </div>
  </body>
  </html>
  `;
}

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.roulette) global.db.roulette = {};
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
async function sendNeoxrRoulette(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null, mentions = [], imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const defaultBanner = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : defaultBanner);
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Russian Roulette Duel ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 3,
        divider_indices: [2],
        list_title: `${botName} • Aksi Revolver`,
        button_title: "🔫 Tarik Pelatuk"
      }
    },
    contextInfo: {
      mentionedJid: mentions.length ? mentions : [ctx?.sender].filter(Boolean),
      forwardingScore: 999,
      isForwarded: true
    },
    quoted: quoted || undefined
  };
  if (typeof ctx?.sendCta === "function" && targetJid === ctx.id) {
    try {
      return await ctx.sendCta(bodyText, footerText, buttons, options);
    } catch (e) {
      console.error("[Roulette ctx.sendCta Error]:", e.message);
    }
  }
  try {
    const nativeButtons = buttons.map(b => ({
      name: b.name || "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: b.display_text,
        id: b.id || b.copy_code || ""
      })
    }));
    const mediaPayload = imageBuffer ? {
      image: imageBuffer
    } : imageUrl ? {
      image: {
        url: imageUrl
      }
    } : {};
    return await sock.sendMessage(targetJid, {
      ...mediaPayload,
      caption: bodyText,
      footer: footerText,
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: bodyText
            },
            footer: {
              text: footerText
            },
            nativeFlowMessage: {
              buttons: nativeButtons
            },
            contextInfo: options.contextInfo
          }
        }
      }
    }, {
      quoted: quoted
    });
  } catch (e) {}
  if (imageBuffer || imageUrl) {
    return await sock.sendMessage(targetJid, {
      image: imageBuffer || {
        url: imageUrl
      },
      caption: `${bodyText}\n\n_${footerText}_`,
      mentions: mentions
    }, {
      quoted: quoted
    });
  }
  return await sock.sendMessage(targetJid, {
    text: `${bodyText}\n\n_${footerText}_`,
    mentions: mentions
  }, {
    quoted: quoted
  });
}
export default {
  name: "roulette",
  aliases: ["russianroulette", "rr", "revolver", "duel"],
  description: "Duel maut Russian Roulette bergantian menarik pelatuk revolver dengan canvas realistis bertema Neoxr",
  category: "Game",
  limit: false,
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us") || msg?.key?.remoteJid?.endsWith("@g.us"));
      if (!isGroup) return;
      const groupId = ctx.id;
      initDB();
      const game = global.db.roulette[groupId];
      if (!game || game.status !== "PLAYING") return;
      const senderJid = ctx?.sender || msg?.key?.participant;
      if (!senderJid) return;
      if (Date.now() > game.expireTime) {
        const loser = game.player1.jid === game.turnJid ? game.player1 : game.player2;
        const winner = game.player1.jid === game.turnJid ? game.player2 : game.player1;
        delete global.db.roulette[groupId];
        saveDB();
        const timeoutText = `Hi All!
Waktu giliran telah habis! 🐔

–  *T I M E O U T  C O W A R D*

┌  ◦  *Pengecut* : @${loser.jid.split("@")[0]}
└  ◦  *Pemenang Duel* : @${winner.jid.split("@")[0]}

_Pemain terlalu takut menarik pelatuk dan dinyatakan gugur!_`;
        return await handleGameOver(sock, ctx, groupId, game, winner, loser, "timeout", timeoutText);
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      const prefix = ctx?.prefix || ".";
      if (userText.startsWith(prefix)) return;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (["tembak", "tarik", "shoot", "fire", "dor"].includes(userText)) {
        return await handlePullTrigger(sock, ctx, groupId, senderJid, quotedMsg);
      }
      if (["putar", "spin", "kocok"].includes(userText)) {
        return await handleSpinCylinder(sock, ctx, groupId, senderJid, quotedMsg);
      }
    } catch (err) {
      console.error("[ROULETTE BEFORE ERROR]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ Game Duel Russian Roulette hanya dapat dimainkan di dalam Grup.");
      }
      const groupId = ctx.id;
      const botName = global.bot?.name || "WudysoftBot";
      const footerText = `${global.bot?.footer || botName}`;
      const prefix = ctx?.prefix || ".";
      const senderJid = ctx?.sender || msg?.key?.participant;
      const senderName = ctx?.pushName || ctx?.pushname || "Koboi";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      initDB(senderJid, senderName);
      const userData = global.db.user[senderJid];
      const args = ctx?.args || [];
      const subCommand = (args[0] || "").trim().toLowerCase();
      if (["join", "terima", "accept", "gas"].includes(subCommand)) {
        if (!global.db.roulette[groupId]) {
          return ctx.reply(`⚠️ Tidak ada tantangan duel aktif. Ketik \`${prefix}roulette\` untuk menantang seseorang!`);
        }
        const game = global.db.roulette[groupId];
        if (game.status !== "WAITING") {
          return ctx.reply("⚠️ Duel di grup ini sudah berjalan!");
        }
        if (game.player1.jid === senderJid) {
          return ctx.reply("❌ Kamu tidak bisa berduel melawan dirimu sendiri!");
        }
        if (game.targetJid && game.targetJid !== senderJid) {
          return ctx.reply(`❌ Tantangan ini khusus untuk @${game.targetJid.split("@")[0]}!`, {
            mentions: [game.targetJid]
          });
        }
        if (game.bet > 0) {
          const p2Money = Number(userData.money) || 0;
          if (p2Money < game.bet) {
            return ctx.reply(`❌ Saldo tidak cukup untuk taruhan *Rp ${game.bet.toLocaleString()}* (Saldo: Rp ${p2Money.toLocaleString()}).`);
          }
        }
        game.player2 = {
          jid: senderJid,
          name: senderName,
          hasSpun: false
        };
        game.status = "PLAYING";
        game.turnJid = game.player1.jid;
        game.expireTime = Date.now() + 45 * 1e3;
        saveDB();
        startTurnTimer(sock, ctx, groupId);
        await ctx.react("🔫");
        const buttons = [{
          name: "quick_reply",
          display_text: "💥 Tarik Pelatuk",
          id: `${prefix}roulette shoot`
        }, {
          name: "quick_reply",
          display_text: "🔄 Putar Silinder (1x)",
          id: `${prefix}roulette spin`
        }];
        const startDuelText = `Hi Survivors!
Tantangan diterima! Duel Russian Roulette resmi dimulai.

–  *D U E L  A R E N A*

┌  ◦  *Challenger* : @${game.player1.jid.split("@")[0]}
│  ◦  *Opponent* : @${game.player2.jid.split("@")[0]}
│  ◦  *Total Taruhan* : Rp ${(game.bet * 2).toLocaleString()}
│  ◦  *Revolver* : 6 Ruang Silinder (1 Peluru Tajam)
└  ◦  *Peluang Awal* : 1/6 (16.7%)

–  *T U R N  I N F O*

👉 *Giliran Pertama:* @${game.turnJid.split("@")[0]}
Arahkan moncong revolver ke kepala dan tarik pelatuknya!

_Ketuk tombol di bawah atau balas dengan kata "tembak"!_`;
        const canvasHtml = buildRouletteCanvasHtml(game, "DUEL STARTED", "16.7%");
        const {
          buffer,
          url
        } = await renderHtmlToImage(canvasHtml);
        return await sendNeoxrRoulette(sock, ctx, groupId, startDuelText, footerText, buttons, quotedMsg, [game.player1.jid, game.player2.jid, game.turnJid], buffer, url);
      }
      if (["shoot", "tembak", "dor"].includes(subCommand)) {
        if (!global.db.roulette[groupId] || global.db.roulette[groupId].status !== "PLAYING") {
          return ctx.reply("⚠️ Tidak ada duel aktif saat ini.");
        }
        return await handlePullTrigger(sock, ctx, groupId, senderJid, quotedMsg);
      }
      if (["spin", "putar"].includes(subCommand)) {
        if (!global.db.roulette[groupId] || global.db.roulette[groupId].status !== "PLAYING") {
          return ctx.reply("⚠️ Tidak ada duel aktif saat ini.");
        }
        return await handleSpinCylinder(sock, ctx, groupId, senderJid, quotedMsg);
      }
      if (["batal", "cancel", "surrender", "nyerah"].includes(subCommand)) {
        if (!global.db.roulette[groupId]) {
          return ctx.reply("⚠️ Tidak ada sesi duel roulette yang aktif.");
        }
        const game = global.db.roulette[groupId];
        if (game.status === "WAITING") {
          if (game.player1.jid !== senderJid) return ctx.reply("❌ Hanya penantang yang berhak membatalkan tantangan.");
          delete global.db.roulette[groupId];
          saveDB();
          return ctx.reply("🛑 Tantangan duel roulette dibatalkan.");
        }
        if (game.status === "PLAYING") {
          if (game.player1.jid !== senderJid && game.player2?.jid !== senderJid) {
            return ctx.reply("❌ Kamu bukan peserta dalam duel ini!");
          }
          const winner = game.player1.jid === senderJid ? game.player2 : game.player1;
          const loser = game.player1.jid === senderJid ? game.player1 : game.player2;
          delete global.db.roulette[groupId];
          saveDB();
          await handleGameOver(sock, ctx, groupId, game, winner, loser, "surrender");
          return;
        }
      }
      if (global.db.roulette[groupId]) {
        return ctx.reply("⚠️ Masih ada duel roulette yang sedang berlangsung di grup ini!");
      }
      const mentioned = ctx?.mentionedJid || [];
      const targetJid = mentioned[0] || null;
      if (targetJid && targetJid === senderJid) {
        return ctx.reply("❌ Kamu tidak bisa menantang diri sendiri!");
      }
      let betAmount = 0;
      for (const arg of args) {
        const cleanNum = parseInt(arg.replace(/[^0-9]/g, ""));
        if (!isNaN(cleanNum) && cleanNum > 0 && !arg.startsWith("@")) {
          betAmount = cleanNum;
          break;
        }
      }
      if (betAmount > 0) {
        const p1Money = Number(userData.money) || 0;
        if (p1Money < betAmount) {
          return ctx.reply(`❌ Saldo tidak cukup untuk taruhan *Rp ${betAmount.toLocaleString()}* (Saldo: Rp ${p1Money.toLocaleString()}).`);
        }
      }
      await ctx.react("🤠");
      const chambers = [false, false, false, false, false, false];
      const bulletIndex = Math.floor(Math.random() * 6);
      chambers[bulletIndex] = true;
      global.db.roulette[groupId] = {
        groupId: groupId,
        status: "WAITING",
        bet: betAmount,
        chambers: chambers,
        currentChamber: 0,
        targetJid: targetJid,
        expireTime: Date.now() + 60 * 1e3,
        player1: {
          jid: senderJid,
          name: senderName,
          hasSpun: false
        },
        player2: null,
        turnJid: null
      };
      saveDB();
      setTimeout(async () => {
        if (global.db.roulette[groupId]?.status === "WAITING") {
          delete global.db.roulette[groupId];
          saveDB();
          await sock.sendMessage(groupId, {
            text: `⌛ Waktu tantangan duel habis! Tidak ada yang berani menerima tantangan dari @${senderJid.split("@")[0]}.`,
            mentions: [senderJid]
          });
        }
      }, 60 * 1e3);
      const buttons = [{
        name: "quick_reply",
        display_text: "⚔️ Terima Tantangan",
        id: `${prefix}roulette join`
      }, {
        name: "quick_reply",
        display_text: "❌ Batal",
        id: `${prefix}roulette batal`
      }];
      const inviteText = `Hi Survivors!
Tantangan maut Russian Roulette telah dilemparkan!

–  *C H A L L E N G E*

┌  ◦  *Penantang* : @${senderJid.split("@")[0]}
│  ◦  *Target* : ${targetJid ? `@${targetJid.split("@")[0]}` : "Siapa saja yang berani!"}
│  ◦  *Taruhan Meja* : Rp ${betAmount.toLocaleString()}
│  ◦  *Hadiah Tambahan* : +40 EXP (Free Bot Reward)
└  ◦  *Batas Waktu* : 60 Detik

_Ketuk tombol di bawah atau ketik \`${prefix}roulette join\` untuk bertaruh nyawa!_`;
      const mentions = targetJid ? [senderJid, targetJid] : [senderJid];
      const canvasHtml = buildRouletteCanvasHtml(global.db.roulette[groupId], "WAITING OPPONENT", "16.7%");
      const {
        buffer,
        url
      } = await renderHtmlToImage(canvasHtml);
      await sendNeoxrRoulette(sock, ctx, groupId, inviteText, footerText, buttons, quotedMsg, mentions, buffer, url);
    } catch (e) {
      console.error("[ROULETTE ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};
async function handlePullTrigger(sock, ctx, groupId, senderJid, quotedMsg) {
  initDB();
  const game = global.db.roulette[groupId];
  if (!game) return;
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const prefix = ctx?.prefix || ".";
  if (game.turnJid !== senderJid) {
    return ctx.reply(`⚠️ Bukan giliranmu! Saat ini giliran @${game.turnJid.split("@")[0]} memegang pistol.`, {
      mentions: [game.turnJid]
    });
  }
  const isBullet = game.chambers[game.currentChamber];
  const currentPlayer = game.player1.jid === senderJid ? game.player1 : game.player2;
  const opponent = game.player1.jid === senderJid ? game.player2 : game.player1;
  if (isBullet) {
    delete global.db.roulette[groupId];
    saveDB();
    await ctx.react("💥");
    const canvasHtml = buildRouletteCanvasHtml(game, "BOOM! SHOT DEAD", "100%");
    const {
      buffer,
      url
    } = await renderHtmlToImage(canvasHtml);
    const boomText = `Hi All!
DUAAARRRRRRRRRR! Peluru tajam meletus! 💥💥

–  *F A T A L  S H O T*

┌  ◦  *Korban* : @${currentPlayer.jid.split("@")[0]}
│  ◦  *Ruang Silinder* : #${game.currentChamber + 1}
└  ◦  *Pemenang Duel* : @${opponent.jid.split("@")[0]}

_Peluru menembus kepala! Duel selesai._`;
    return await handleGameOver(sock, ctx, groupId, game, opponent, currentPlayer, "shot", boomText, buffer, url);
  }
  game.currentChamber += 1;
  const remainingSlots = 6 - game.currentChamber;
  const nextChance = (1 / remainingSlots * 100).toFixed(1);
  game.turnJid = opponent.jid;
  game.expireTime = Date.now() + 45 * 1e3;
  saveDB();
  startTurnTimer(sock, ctx, groupId);
  await ctx.react("😅");
  const buttons = [{
    name: "quick_reply",
    display_text: "💥 Tarik Pelatuk",
    id: `${prefix}roulette shoot`
  }];
  if (!opponent.hasSpun) {
    buttons.push({
      name: "quick_reply",
      display_text: "🔄 Putar Silinder (1x)",
      id: `${prefix}roulette spin`
    });
  }
  const safeText = `Hi ${currentPlayer.name}!
*KLIK...!* Ruang silinder #${game.currentChamber} KOSONG! 😮‍💨

–  *S U R V I V E D*

┌  ◦  *Selamat* : @${currentPlayer.jid.split("@")[0]}
│  ◦  *Sisa Slot* : ${remainingSlots} Ruang Silinder
└  ◦  *Peluang Maut Berikutnya* : 1/${remainingSlots} (${nextChance}%)

–  *N E X T  T U R N*

👉 Revolver diserahkan ke: @${opponent.jid.split("@")[0]}
_Ketuk tombol di bawah atau ketik "tembak" di chat!_`;
  const canvasHtml = buildRouletteCanvasHtml(game, "CLICK! EMPTY", `${nextChance}%`);
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  return await sendNeoxrRoulette(sock, ctx, groupId, safeText, footerText, buttons, quotedMsg, [currentPlayer.jid, opponent.jid], buffer, url);
}
async function handleSpinCylinder(sock, ctx, groupId, senderJid, quotedMsg) {
  initDB();
  const game = global.db.roulette[groupId];
  if (!game) return;
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const prefix = ctx?.prefix || ".";
  if (game.turnJid !== senderJid) {
    return ctx.reply("⚠️ Bukan giliranmu untuk memutar silinder!");
  }
  const currentPlayer = game.player1.jid === senderJid ? game.player1 : game.player2;
  if (currentPlayer.hasSpun) {
    return ctx.reply("❌ Kamu sudah pernah menggunakan hak 1x memutar silinder!");
  }
  currentPlayer.hasSpun = true;
  const remaining = 6 - game.currentChamber;
  const newChambers = new Array(remaining).fill(false);
  const newBulletIdx = Math.floor(Math.random() * remaining);
  newChambers[newBulletIdx] = true;
  for (let i = 0; i < remaining; i++) {
    game.chambers[game.currentChamber + i] = newChambers[i];
  }
  saveDB();
  await ctx.react("🔄");
  const buttons = [{
    name: "quick_reply",
    display_text: "💥 Tarik Pelatuk Sekarang",
    id: `${prefix}roulette shoot`
  }];
  const spinnerText = `Hi ${currentPlayer.name}!
SREEEKKK...! Silinder revolver berhasil diputar ulang! 🔄

–  *C Y L I N D E R  S P U N*

┌  ◦  *Pemutar* : @${currentPlayer.jid.split("@")[0]}
└  ◦  *Posisi Peluru* : Diacak kembali di sisa ${remaining} slot

_Silinder telah berhenti berputar. Pelatuk tetap harus ditarik!_`;
  const chance = (1 / remaining * 100).toFixed(1);
  const canvasHtml = buildRouletteCanvasHtml(game, "CYLINDER SPUN", `${chance}%`);
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  return await sendNeoxrRoulette(sock, ctx, groupId, spinnerText, footerText, buttons, quotedMsg, [currentPlayer.jid], buffer, url);
}

function startTurnTimer(sock, ctx, groupId) {
  setTimeout(async () => {
    initDB();
    const g = global.db.roulette[groupId];
    if (g && g.status === "PLAYING" && Date.now() >= g.expireTime) {
      delete global.db.roulette[groupId];
      saveDB();
      const loser = g.player1.jid === g.turnJid ? g.player1 : g.player2;
      const winner = g.player1.jid === g.turnJid ? g.player2 : g.player1;
      const timeoutText = `Hi All!
Waktu giliran telah habis! ⌛

–  *T I M E O U T*

┌  ◦  *Pengecut* : @${loser.jid.split("@")[0]}
└  ◦  *Pemenang Duel* : @${winner.jid.split("@")[0]}

_Peserta kabur karena ketakutan. Kemenangan otomatis diberikan!_`;
      await handleGameOver(sock, ctx, groupId, g, winner, loser, "timeout", timeoutText);
    }
  }, 45 * 1e3);
}
async function handleGameOver(sock, ctx, groupId, game, winner, loser, reason, customHeader = "", imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const prefix = ctx?.prefix || ".";
  initDB(winner.jid, winner.name);
  initDB(loser.jid, loser.name);
  const wUser = global.db.user[winner.jid];
  const lUser = global.db.user[loser.jid];
  let rewardMsg = "";
  if (game.bet > 0) {
    if (wUser && lUser) {
      wUser.money = (Number(wUser.money) || 0) + game.bet;
      lUser.money = Math.max(0, (Number(lUser.money) || 0) - game.bet);
      wUser.exp = (Number(wUser.exp) || 0) + 60;
    }
    rewardMsg = `+Rp ${(game.bet * 2).toLocaleString()} & +60 EXP`;
  } else {
    if (wUser) {
      wUser.money = (Number(wUser.money) || 0) + 5e3;
      wUser.exp = (Number(wUser.exp) || 0) + 40;
    }
    rewardMsg = `+Rp 5.000 & +40 EXP`;
  }
  saveDB();
  let finalContent = customHeader ? `${customHeader}\n\n` : "";
  finalContent += `–  *D U E L  R E S U L T*

┌  ◦  *Champion* : @${winner.jid.split("@")[0]}
│  ◦  *Fallen* : @${loser.jid.split("@")[0]}
└  ◦  *Reward* : ${rewardMsg}

_Ketik \`${prefix}roulette\` untuk menantang lawan baru!_`;
  const buttons = [{
    name: "quick_reply",
    display_text: "🔁 Tantang Lagi",
    id: `${prefix}roulette`
  }];
  return await sendNeoxrRoulette(sock, ctx, groupId, finalContent, footerText, buttons, null, [winner.jid, loser.jid], imageBuffer, imageUrl);
}