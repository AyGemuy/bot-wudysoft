import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const SUIT_CHOICES = {
  batu: {
    name: "✊ Batu",
    icon: "✊",
    beats: "gunting"
  },
  gunting: {
    name: "✌️ Gunting",
    icon: "✌️",
    beats: "kertas"
  },
  kertas: {
    name: "🖐️ Kertas",
    icon: "🖐️",
    beats: "batu"
  }
};
const getRandomChoice = () => {
  const choices = ["batu", "gunting", "kertas"];
  return choices[Math.floor(Math.random() * choices.length)];
};
const escapeHtml = (str = "") => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
    width: 850,
    height: 480,
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

function buildSuitCanvasHtml(game, statusText = "VS MATCH", p1Choice = null, p2Choice = null) {
  const botName = escapeHtml(global.bot?.name || "WudysoftBot");
  const p1Name = escapeHtml(game?.player1?.name || "Player 1");
  const p2Name = escapeHtml(game?.player2?.name || (game?.status === "WAITING" ? "Waiting..." : "Player 2"));
  const p1Icon = p1Choice ? SUIT_CHOICES[p1Choice]?.icon || "❓" : game?.player1?.choice ? "🔒" : "❓";
  const p2Icon = p2Choice ? SUIT_CHOICES[p2Choice]?.icon || "❓" : game?.player2?.choice ? "🔒" : "❓";
  const isP1Win = statusText.includes("PLAYER 1 WINS");
  const isP2Win = statusText.includes("PLAYER 2 WINS");
  const isDraw = statusText.includes("DRAW");
  const p1CardClass = isP1Win ? "winner" : isP2Win ? "loser" : "";
  const p2CardClass = isP2Win ? "winner" : isP1Win ? "loser" : "";
  const p1Tag = isP1Win ? '<span class="status-tag win">WINNER</span>' : isP2Win ? '<span class="status-tag lose">DEFEAT</span>' : game?.player1?.choice ? '<span class="status-tag ready">READY</span>' : '<span class="status-tag">CHOOSING...</span>';
  const p2Tag = isP2Win ? '<span class="status-tag win">WINNER</span>' : isP1Win ? '<span class="status-tag lose">DEFEAT</span>' : game?.player2?.choice ? '<span class="status-tag ready">READY</span>' : '<span class="status-tag">CHOOSING...</span>';
  const badgeClass = isP1Win || isP2Win ? "win" : isDraw ? "draw" : "";
  const betText = (game?.bet || 500).toLocaleString("id-ID");
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;800;900&family=Plus+Jakarta+Sans:wght@700;800;900&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body {
        width: 850px;
        height: 480px;
        background: #07090e;
        font-family: 'Plus Jakarta Sans', sans-serif;
        overflow: hidden;
      }
      .banner {
        position: relative;
        width: 850px;
        height: 480px;
        background: radial-gradient(circle at 50% 15%, #1e1b4b 0%, #0a0d18 55%, #05070c 100%);
        padding: 24px 32px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
      }
      .banner::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image: 
          linear-gradient(rgba(99, 102, 241, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99, 102, 241, 0.08) 1px, transparent 1px);
        background-size: 32px 32px;
        pointer-events: none;
      }
      .glow-left {
        position: absolute;
        top: -60px;
        left: -60px;
        width: 260px;
        height: 260px;
        background: rgba(99, 102, 241, 0.28);
        filter: blur(80px);
        border-radius: 50%;
        pointer-events: none;
      }
      .glow-right {
        position: absolute;
        bottom: -60px;
        right: -60px;
        width: 260px;
        height: 260px;
        background: rgba(236, 72, 153, 0.2);
        filter: blur(80px);
        border-radius: 50%;
        pointer-events: none;
      }
      .header {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 2;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .brand-icon {
        width: 38px;
        height: 38px;
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        box-shadow: 0 0 15px rgba(99, 102, 241, 0.5);
      }
      .brand-text {
        font-family: 'Orbitron', sans-serif;
        font-size: 20px;
        font-weight: 900;
        color: #f8fafc;
        letter-spacing: 1px;
      }
      .brand-text span {
        color: #818cf8;
      }
      .status-pill {
        font-family: 'Orbitron', sans-serif;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 2px;
        padding: 6px 18px;
        border-radius: 30px;
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid #6366f1;
        color: #a5b4fc;
        text-transform: uppercase;
        box-shadow: 0 0 15px rgba(99, 102, 241, 0.35);
      }
      .status-pill.win {
        border-color: #10b981;
        color: #34d399;
        box-shadow: 0 0 18px rgba(16, 185, 129, 0.45);
      }
      .status-pill.draw {
        border-color: #f59e0b;
        color: #fbbf24;
        box-shadow: 0 0 18px rgba(245, 158, 11, 0.45);
      }
      .arena {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 10px;
        z-index: 2;
      }
      .fighter-card {
        width: 270px;
        background: rgba(15, 23, 42, 0.82);
        border: 2px solid rgba(99, 102, 241, 0.3);
        border-radius: 20px;
        padding: 18px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.7);
      }
      .fighter-card.winner {
        border-color: #10b981;
        background: radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.16) 0%, rgba(15, 23, 42, 0.9) 100%);
        box-shadow: 0 0 25px rgba(16, 185, 129, 0.45);
      }
      .fighter-card.loser {
        border-color: #ef4444;
        opacity: 0.65;
      }
      .fighter-header {
        width: 100%;
        text-align: center;
      }
      .fighter-tag {
        font-size: 11px;
        font-weight: 800;
        color: #818cf8;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin-bottom: 2px;
      }
      .fighter-name {
        font-size: 18px;
        font-weight: 800;
        color: #f1f5f9;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 230px;
        margin: 0 auto;
      }
      .hand-bubble {
        width: 115px;
        height: 115px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 35%, #242d4a 0%, #0d1222 100%);
        border: 3px solid rgba(129, 140, 248, 0.45);
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 54px;
        box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.8), 0 0 20px rgba(99, 102, 241, 0.25);
      }
      .fighter-card.winner .hand-bubble {
        border-color: #10b981;
        box-shadow: inset 0 0 20px rgba(16, 185, 129, 0.5), 0 0 25px rgba(16, 185, 129, 0.4);
        background: radial-gradient(circle at 35% 35%, #064e3b 0%, #022c22 100%);
      }
      .fighter-card.loser .hand-bubble {
        border-color: #ef4444;
      }
      .status-tag {
        font-size: 11px;
        font-weight: 800;
        padding: 4px 12px;
        border-radius: 12px;
        background: rgba(30, 41, 59, 0.85);
        color: #94a3b8;
        letter-spacing: 1px;
      }
      .status-tag.ready {
        color: #34d399;
        background: rgba(6, 78, 59, 0.7);
        border: 1px solid rgba(52, 211, 153, 0.4);
      }
      .status-tag.win {
        color: #ffffff;
        background: #10b981;
        font-weight: 900;
      }
      .status-tag.lose {
        color: #fca5a5;
        background: rgba(127, 29, 29, 0.7);
      }
      .vs-badge {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }
      .vs-text {
        font-family: 'Orbitron', monospace;
        font-size: 46px;
        font-weight: 900;
        letter-spacing: 2px;
        background: linear-gradient(180deg, #fef08a 0%, #f59e0b 60%, #b45309 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        filter: drop-shadow(0 0 16px rgba(245, 158, 11, 0.65));
      }
      .vs-sub {
        font-family: 'Orbitron', monospace;
        font-size: 11px;
        font-weight: 800;
        color: #94a3b8;
        letter-spacing: 3px;
      }
      .footer {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        padding-top: 14px;
        color: #94a3b8;
        font-size: 13px;
        font-weight: 700;
        z-index: 2;
      }
      .footer b {
        color: #f8fafc;
      }
      .bet-val {
        color: #34d399 !important;
        font-family: 'Orbitron', sans-serif;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div class="banner">
      <div class="glow-left"></div>
      <div class="glow-right"></div>
      <div class="header">
        <div class="brand">
          <div class="brand-icon">⚔️</div>
          <div class="brand-text">SUIT <span>ARENA</span></div>
        </div>
        <div class="status-pill ${badgeClass}">${statusText}</div>
      </div>
      <div class="arena">
        <div class="fighter-card ${p1CardClass}">
          <div class="fighter-header">
            <div class="fighter-tag">Player 1</div>
            <div class="fighter-name">${p1Name}</div>
          </div>
          <div class="hand-bubble">${p1Icon}</div>
          ${p1Tag}
        </div>
        <div class="vs-badge">
          <div class="vs-text">VS</div>
          <div class="vs-sub">PVP DUEL</div>
        </div>
        <div class="fighter-card ${p2CardClass}">
          <div class="fighter-header">
            <div class="fighter-tag">Player 2</div>
            <div class="fighter-name">${p2Name}</div>
          </div>
          <div class="hand-bubble">${p2Icon}</div>
          ${p2Tag}
        </div>
      </div>
      <div class="footer">
        <div>TARUHAN : <b class="bet-val">Rp ${betText}</b></div>
        <div>RULES : <b>BATU > GUNTING > KERTAS</b></div>
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
  if (!global.db.suit) global.db.suit = {};
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
async function handlePlayerChoice(sock, ctx, senderJid, choice) {
  initDB();
  const activeEntry = Object.entries(global.db.suit || {}).find(([_, g]) => g.status === "PLAYING" && (g.player1?.jid === senderJid || g.player2?.jid === senderJid));
  if (!activeEntry) {
    return ctx.reply("⚠️ Tidak ada sesi suit yang sedang menunggumu.");
  }
  const [groupId, activeGame] = activeEntry;
  if (Date.now() > activeGame.expireTime) {
    delete global.db.suit[groupId];
    saveDB();
    return ctx.reply("⏰ Waktu memilih suit telah habis.");
  }
  const isPlayer1 = activeGame.player1.jid === senderJid;
  const currentPlayer = isPlayer1 ? activeGame.player1 : activeGame.player2;
  if (currentPlayer.choice) {
    return ctx.reply("⚠️ Kamu sudah menentukan pilihan! Harap tunggu lawanmu memilih.");
  }
  currentPlayer.choice = choice;
  saveDB();
  if (typeof ctx?.react === "function") await ctx.react("✅");
  const successText = `Hi ${currentPlayer.name}!
Pilihan jagoanmu berhasil disimpan secara rahasia.

–  *C H O I C E  L O C K E D*

┌  ◦  *Pilihanmu* : ${SUIT_CHOICES[choice].name}
└  ◦  *Status* : Dirahasiakan dari Lawan

_Hasil pertandingan akan diumumkan di grup!_`;
  await ctx.reply(successText);
  await updateGroupStatus(sock, ctx, groupId);
  return true;
}
async function sendNeoxrSuit(sock, ctx, targetJid, bodyText, footerText, buttons = [], quoted = null, mentions = [], imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const defaultBanner = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : defaultBanner);
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Suit Arena ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 3,
        divider_indices: [2],
        list_title: `${botName} • Pilihan Suit`,
        button_title: "🎮 Menu Interaksi"
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
      console.error("[Suit ctx.sendCta Error]:", e.message);
    }
  }
  const imagePayload = imageBuffer ? {
    image: imageBuffer
  } : imageUrl ? {
    image: {
      url: imageUrl
    }
  } : null;
  if (buttons && buttons.length > 0) {
    try {
      const nativeButtons = buttons.map(b => ({
        name: b.name || "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: b.display_text,
          id: b.id || b.copy_code || ""
        })
      }));
      return await sock.sendMessage(targetJid, {
        ...imagePayload || {
          image: typeof defaultBanner === "string" ? {
            url: defaultBanner
          } : defaultBanner
        },
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
        quoted: quoted || undefined
      });
    } catch (e) {}
  }
  if (imagePayload) {
    return await sock.sendMessage(targetJid, {
      ...imagePayload,
      caption: `${bodyText}\n\n_${footerText}_`,
      mentions: mentions
    }, {
      quoted: quoted || undefined
    });
  }
  return await sock.sendMessage(targetJid, {
    text: `${bodyText}\n\n_${footerText}_`,
    mentions: mentions
  }, {
    quoted: quoted || undefined
  });
}
export default {
  name: "suit",
  aliases: ["suitpvp", "rps", "jankenpon"],
  description: "Bermain Suit (Batu Gunting Kertas) melawan Bot atau Member dengan default taruhan Rp 500",
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
      if (isGroup) return;
      const rawText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (!rawText) return;
      const prefix = ctx?.prefix || ".";
      if (rawText.startsWith(prefix) || /^(?:\.|\/|#|!)?suit\b/i.test(rawText)) {
        return;
      }
      let choice = null;
      if (rawText.includes("batu")) choice = "batu";
      else if (rawText.includes("gunting")) choice = "gunting";
      else if (rawText.includes("kertas")) choice = "kertas";
      if (!choice) return;
      const senderJid = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      if (!senderJid) return;
      initDB();
      const hasActiveGame = Object.values(global.db.suit || {}).some(g => g.status === "PLAYING" && (g.player1?.jid === senderJid || g.player2?.jid === senderJid) && !(g.player1?.jid === senderJid ? g.player1 : g.player2)?.choice);
      if (!hasActiveGame) return;
      await handlePlayerChoice(sock, ctx, senderJid, choice);
      return true;
    } catch (err) {
      console.error("[SUIT BEFORE ERROR]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      const botName = global.bot?.name || "WudysoftBot";
      const footerText = `${global.bot?.footer || botName}`;
      const prefix = ctx?.prefix || ".";
      const senderJid = ctx?.sender || msg?.key?.participant;
      const senderName = ctx?.pushName || ctx?.pushname || "Pemain";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const args = ctx?.args || [];
      const subCommand = (args[0] || "").trim().toLowerCase();
      const rawBotJid = sock?.user?.id || sock?.user?.jid || "";
      const botJid = rawBotJid.includes(":") ? `${rawBotJid.split(":")[0]}@s.whatsapp.net` : rawBotJid;
      initDB(senderJid, senderName);
      if (!isGroup) {
        if (subCommand === "pilih") {
          let choiceArg = (args[1] || "").toLowerCase();
          if (!choiceArg) {
            const fullText = (ctx?.text || "").toLowerCase();
            if (fullText.includes("batu")) choiceArg = "batu";
            else if (fullText.includes("gunting")) choiceArg = "gunting";
            else if (fullText.includes("kertas")) choiceArg = "kertas";
          }
          if (!SUIT_CHOICES[choiceArg]) {
            return ctx.reply("⚠️ Pilihan suit tidak valid. Pilih batu, gunting, atau kertas.");
          }
          return await handlePlayerChoice(sock, ctx, senderJid, choiceArg);
        }
        return ctx.reply("❌ *Game Suit ini hanya dapat dimainkan di dalam Grup!*");
      }
      const groupId = ctx.id;
      const userData = global.db.user[senderJid];
      if (["join", "terima", "accept", "gas"].includes(subCommand)) {
        if (!global.db.suit[groupId]) {
          return ctx.reply(`⚠️ Tidak ada tantangan suit yang aktif di grup ini.\nKetik \`${prefix}suit\` untuk membuat tantangan baru.`);
        }
        const game = global.db.suit[groupId];
        if (game.status !== "WAITING") {
          return ctx.reply("⚠️ Game suit di grup ini sudah berjalan.");
        }
        if (game.player1.jid === senderJid) {
          return ctx.reply("❌ Kamu tidak bisa bertanding melawan dirimu sendiri!");
        }
        if (game.targetJid && game.targetJid !== senderJid) {
          return ctx.reply(`❌ Tantangan ini khusus ditujukan untuk @${game.targetJid.split("@")[0]}!`, {
            mentions: [game.targetJid]
          });
        }
        if (game.bet > 0) {
          const p2Money = Number(userData.money) || 0;
          if (p2Money < game.bet) {
            return ctx.reply(`❌ Saldo tidak mencukupi untuk taruhan sebesar *Rp ${game.bet.toLocaleString()}* (Saldo: Rp ${p2Money.toLocaleString()}).`);
          }
        }
        game.player2 = {
          jid: senderJid,
          name: senderName,
          choice: null
        };
        game.status = "PLAYING";
        game.expireTime = Date.now() + 90 * 1e3;
        saveDB();
        setTimeout(async () => {
          initDB();
          if (global.db.suit[groupId]?.status === "PLAYING" && Date.now() >= global.db.suit[groupId].expireTime) {
            const current = global.db.suit[groupId];
            delete global.db.suit[groupId];
            saveDB();
            await sock.sendMessage(groupId, {
              text: `⌛ Waktu memilih habis! Duel suit antara @${current.player1.jid.split("@")[0]} dan @${current.player2.jid.split("@")[0]} dibatalkan.`,
              mentions: [current.player1.jid, current.player2.jid]
            });
          }
        }, 90 * 1e3);
        const pcButtons = [{
          name: "quick_reply",
          display_text: "✊ Batu",
          id: `${prefix}suit pilih batu`
        }, {
          name: "quick_reply",
          display_text: "✌️ Gunting",
          id: `${prefix}suit pilih gunting`
        }, {
          name: "quick_reply",
          display_text: "🖐️ Kertas",
          id: `${prefix}suit pilih kertas`
        }];
        const pcText = `Hi Fighter!\nTantangan Suit di grup telah dimulai!\n\nTaruhan: *Rp ${game.bet.toLocaleString()}*\nSilakan tentukan pilihan jagoanmu:`;
        await sendNeoxrSuit(sock, ctx, game.player1.jid, pcText, footerText, pcButtons);
        await sendNeoxrSuit(sock, ctx, game.player2.jid, pcText, footerText, pcButtons);
        const groupStartText = `Hi Survivors!
Tantangan diterima! Pertandingan Suit PvP resmi dimulai.

–  *M A T C H  S T A R T E D*

┌  ◦  *Pemain 1* : @${game.player1.jid.split("@")[0]} [Menunggu Memilih ⏳]
│  ◦  *Pemain 2* : @${game.player2.jid.split("@")[0]} [Menunggu Memilih ⏳]
└  ◦  *Taruhan Meja* : Rp ${game.bet.toLocaleString()}

_Buka Private Chat (PC) bot sekarang untuk memilih jagoanmu!_`;
        const canvasHtml = buildSuitCanvasHtml(game, "VS MATCH IN PROGRESS");
        const {
          buffer,
          url
        } = await renderHtmlToImage(canvasHtml);
        return await sendNeoxrSuit(sock, ctx, groupId, groupStartText, footerText, [{
          name: "quick_reply",
          display_text: "❌ Batalkan",
          id: `${prefix}suit tolak`
        }], quotedMsg, [game.player1.jid, game.player2.jid], buffer, url);
      }
      if (["tolak", "cancel", "batal"].includes(subCommand)) {
        if (!global.db.suit[groupId]) return ctx.reply("⚠️ Tidak ada sesi suit yang sedang aktif di grup ini.");
        const game = global.db.suit[groupId];
        if (game.player1.jid !== senderJid && game.targetJid !== senderJid) {
          return ctx.reply("❌ Kamu tidak berhak membatalkan tantangan ini.");
        }
        delete global.db.suit[groupId];
        saveDB();
        return ctx.reply("🛑 Tantangan suit berhasil dibatalkan.");
      }
      if (global.db.suit[groupId]) {
        return ctx.reply(`⚠️ Masih ada sesi suit yang sedang berlangsung di grup ini!\nGunakan \`${prefix}suit tolak\` jika ingin membatalkannya.`);
      }
      let betAmount = 500;
      for (const arg of args) {
        const cleanNum = parseInt(arg.replace(/[^0-9]/g, ""));
        if (!isNaN(cleanNum) && cleanNum > 0 && !arg.startsWith("@")) {
          betAmount = cleanNum;
          break;
        }
      }
      const p1Money = Number(userData.money) || 0;
      if (p1Money < betAmount) {
        return ctx.reply(`❌ Saldo kamu tidak cukup untuk taruhan *Rp ${betAmount.toLocaleString()}* (Saldo: Rp ${p1Money.toLocaleString()}).`);
      }
      const mentioned = ctx?.mentionedJid || [];
      const targetJid = mentioned[0] || null;
      const isTargetBot = subCommand === "bot" || targetJid && targetJid === botJid;
      let directChoice = null;
      for (const arg of args) {
        const lower = arg.toLowerCase();
        if (SUIT_CHOICES[lower]) {
          directChoice = lower;
          break;
        }
      }
      if (isTargetBot || directChoice) {
        const botChoice = getRandomChoice();
        if (directChoice) {
          if (typeof ctx?.react === "function") await ctx.react("🎮");
          const gameObj = {
            groupId: groupId,
            bet: betAmount,
            player1: {
              jid: senderJid,
              name: senderName,
              choice: directChoice
            },
            player2: {
              jid: botJid,
              name: botName,
              choice: botChoice
            }
          };
          return await finishBotMatch(sock, ctx, groupId, gameObj);
        }
        if (typeof ctx?.react === "function") await ctx.react("🎮");
        global.db.suit[groupId] = {
          groupId: groupId,
          status: "PLAYING",
          isBot: true,
          targetJid: botJid,
          bet: betAmount,
          expireTime: Date.now() + 60 * 1e3,
          player1: {
            jid: senderJid,
            name: senderName,
            choice: null
          },
          player2: {
            jid: botJid,
            name: botName,
            choice: botChoice
          }
        };
        saveDB();
        setTimeout(async () => {
          initDB();
          if (global.db.suit[groupId]?.status === "PLAYING" && Date.now() >= global.db.suit[groupId].expireTime) {
            delete global.db.suit[groupId];
            saveDB();
            await sock.sendMessage(groupId, {
              text: `⌛ Waktu memilih habis! Pertandingan suit melawan bot dibatalkan.`
            });
          }
        }, 60 * 1e3);
        const pcButtons = [{
          name: "quick_reply",
          display_text: "✊ Batu",
          id: `${prefix}suit pilih batu`
        }, {
          name: "quick_reply",
          display_text: "✌️ Gunting",
          id: `${prefix}suit pilih gunting`
        }, {
          name: "quick_reply",
          display_text: "🖐️ Kertas",
          id: `${prefix}suit pilih kertas`
        }];
        await sendNeoxrSuit(sock, ctx, senderJid, `Hi ${senderName}!\nKamu menantang ${botName}.\nTaruhan: *Rp ${betAmount.toLocaleString()}*\nSilakan tentukan pilihanmu:`, footerText, pcButtons);
        const canvasHtml = buildSuitCanvasHtml(global.db.suit[groupId], "VS BOT MATCH");
        const {
          buffer,
          url
        } = await renderHtmlToImage(canvasHtml);
        return await sendNeoxrSuit(sock, ctx, groupId, `Hi @${senderJid.split("@")[0]}!\nKamu memulai duel suit melawan *${botName}*!\n\nTaruhan: *Rp ${betAmount.toLocaleString()}*\nSilakan buka Private Chat (PC) bot untuk menentukan pilihanmu!`, footerText, [{
          name: "quick_reply",
          display_text: "❌ Batalkan",
          id: `${prefix}suit tolak`
        }], quotedMsg, [senderJid], buffer, url);
      }
      if (targetJid && targetJid === senderJid) {
        return ctx.reply("❌ Kamu tidak bisa menantang diri sendiri!");
      }
      if (typeof ctx?.react === "function") await ctx.react("🎮");
      global.db.suit[groupId] = {
        groupId: groupId,
        status: "WAITING",
        targetJid: targetJid,
        bet: betAmount,
        expireTime: Date.now() + 60 * 1e3,
        player1: {
          jid: senderJid,
          name: senderName,
          choice: null
        },
        player2: null
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.suit[groupId]?.status === "WAITING" && Date.now() >= global.db.suit[groupId].expireTime) {
          delete global.db.suit[groupId];
          saveDB();
          await sock.sendMessage(groupId, {
            text: `⌛ Waktu menunggu habis! Tantangan suit dari @${senderJid.split("@")[0]} telah kedaluwarsa.`,
            mentions: [senderJid]
          });
        }
      }, 60 * 1e3);
      const buttons = [{
        name: "quick_reply",
        display_text: "⚔️ Join / Terima",
        id: `${prefix}suit join`
      }, {
        name: "quick_reply",
        display_text: "❌ Tolak",
        id: `${prefix}suit tolak`
      }];
      const challengeText = `Hi Survivors!
Tantangan Suit PvP (Batu Gunting Kertas) telah dibuka!

–  *C H A L L E N G E*

┌  ◦  *Penantang* : @${senderJid.split("@")[0]}
│  ◦  *Target* : ${targetJid ? `@${targetJid.split("@")[0]}` : `Siapa saja di grup ini / Ketik \`${prefix}suit bot\``}
│  ◦  *Taruhan Meja* : Rp ${betAmount.toLocaleString()}
└  ◦  *Timeout* : 60 Detik

_Klik tombol di bawah atau ketik \`${prefix}suit join\` untuk bertanding!_`;
      const mentions = targetJid ? [senderJid, targetJid] : [senderJid];
      const canvasHtml = buildSuitCanvasHtml(global.db.suit[groupId], "WAITING OPPONENT");
      const {
        buffer,
        url
      } = await renderHtmlToImage(canvasHtml);
      await sendNeoxrSuit(sock, ctx, groupId, challengeText, footerText, buttons, quotedMsg, mentions, buffer, url);
    } catch (e) {
      console.error("[SUIT COMMAND ERROR]:", e);
      if (typeof ctx?.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};
async function finishBotMatch(sock, ctx, groupId, game) {
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const prefix = ctx?.prefix || ".";
  const p1 = game.player1;
  const p2 = game.player2;
  const bet = game.bet || 500;
  initDB(p1.jid, p1.name);
  const u1 = global.db.user[p1.jid];
  let resultStatus = "";
  let rewardText = "";
  let winnerText = "";
  if (p1.choice === p2.choice) {
    resultStatus = "MATCH DRAW";
    winnerText = "Keduanya mengeluarkan jagoan yang sama!";
    if (u1) u1.exp = (Number(u1.exp) || 0) + 15;
    rewardText = "Mendapatkan +15 EXP (Taruhan kembali).";
  } else if (SUIT_CHOICES[p1.choice].beats === p2.choice) {
    resultStatus = "PLAYER 1 WINS";
    winnerText = `@${p1.jid.split("@")[0]} berhasil mengalahkan ${p2.name}!`;
    if (u1) {
      u1.money = (Number(u1.money) || 0) + bet;
      u1.exp = (Number(u1.exp) || 0) + 50;
    }
    rewardText = `+Rp ${bet.toLocaleString()} & +50 EXP`;
  } else {
    resultStatus = "PLAYER 2 WINS";
    winnerText = `${p2.name} berhasil mengalahkan @${p1.jid.split("@")[0]}!`;
    if (u1) {
      u1.money = Math.max(0, (Number(u1.money) || 0) - bet);
    }
    rewardText = `-Rp ${bet.toLocaleString()}`;
  }
  saveDB();
  const canvasHtml = buildSuitCanvasHtml(game, resultStatus, p1.choice, p2.choice);
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  const finalAnnouncement = `Hi Survivors!
Pertandingan Suit melawan Bot telah selesai!

–  *M A T C H  R E S U L T*

┌  ◦  *Player* : @${p1.jid.split("@")[0]} (${SUIT_CHOICES[p1.choice].name})
│  ◦  *Bot* : ${p2.name} (${SUIT_CHOICES[p2.choice].name})
└  ◦  *Status* : ${resultStatus}

–  *O U T C O M E*

${winnerText}
🎁 *Hasil:* ${rewardText}

_Ketik \`${prefix}suit bot\` untuk bermain lagi!_`;
  await sendNeoxrSuit(sock, ctx, groupId, finalAnnouncement, footerText, [{
    name: "quick_reply",
    display_text: "🎮 Main Lagi",
    id: `${prefix}suit bot`
  }], null, [p1.jid], buffer, url);
}
async function updateGroupStatus(sock, ctx, groupId) {
  initDB();
  const game = global.db.suit[groupId];
  if (!game) return;
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const prefix = ctx?.prefix || ".";
  const p1 = game.player1;
  const p2 = game.player2;
  if (game.isBot) {
    if (!p1.choice) return;
    delete global.db.suit[groupId];
    saveDB();
    return await finishBotMatch(sock, ctx, groupId, game);
  }
  const p1Status = p1.choice ? "Sudah Memilih ✅" : "Menunggu Memilih ⏳";
  const p2Status = p2.choice ? "Sudah Memilih ✅" : "Menunggu Memilih ⏳";
  if (!p1.choice || !p2.choice) {
    const progressText = `Hi Survivors!
Berikut pembaruan status pemilihan jagoan suit.

–  *S T A T U S  C H O I C E*

┌  ◦  @${p1.jid.split("@")[0]} : ${p1Status}
└  ◦  @${p2.jid.split("@")[0]} : ${p2Status}

_Pemain yang belum memilih silakan buka Private Chat dengan bot!_`;
    const canvasHtml = buildSuitCanvasHtml(game, "VS MATCH IN PROGRESS");
    const {
      buffer,
      url
    } = await renderHtmlToImage(canvasHtml);
    return await sendNeoxrSuit(sock, ctx, groupId, progressText, footerText, [{
      name: "quick_reply",
      display_text: "❌ Batalkan",
      id: `${prefix}suit tolak`
    }], null, [p1.jid, p2.jid], buffer, url);
  }
  delete global.db.suit[groupId];
  saveDB();
  const c1 = p1.choice;
  const c2 = p2.choice;
  const bet = game.bet || 500;
  initDB(p1.jid, p1.name);
  initDB(p2.jid, p2.name);
  const u1 = global.db.user[p1.jid];
  const u2 = global.db.user[p2.jid];
  let resultStatus = "";
  let rewardText = "";
  let winnerText = "";
  if (c1 === c2) {
    resultStatus = "MATCH DRAW";
    winnerText = "Keduanya mengeluarkan jagoan yang sama!";
    if (u1 && u2) {
      u1.exp = (Number(u1.exp) || 0) + 15;
      u2.exp = (Number(u2.exp) || 0) + 15;
    }
    rewardText = "Masing-masing pemain mendapatkan +15 EXP (Taruhan kembali).";
  } else if (SUIT_CHOICES[c1].beats === c2) {
    resultStatus = "PLAYER 1 WINS";
    winnerText = `@${p1.jid.split("@")[0]} berhasil mengalahkan @${p2.jid.split("@")[0]}!`;
    if (u1 && u2) {
      u1.money = (Number(u1.money) || 0) + bet;
      u2.money = Math.max(0, (Number(u2.money) || 0) - bet);
      u1.exp = (Number(u1.exp) || 0) + 50;
    }
    rewardText = `+Rp ${bet.toLocaleString()} & +50 EXP`;
  } else {
    resultStatus = "PLAYER 2 WINS";
    winnerText = `@${p2.jid.split("@")[0]} berhasil mengalahkan @${p1.jid.split("@")[0]}!`;
    if (u1 && u2) {
      u2.money = (Number(u2.money) || 0) + bet;
      u1.money = Math.max(0, (Number(u1.money) || 0) - bet);
      u2.exp = (Number(u2.exp) || 0) + 50;
    }
    rewardText = `+Rp ${bet.toLocaleString()} & +50 EXP`;
  }
  saveDB();
  const canvasHtml = buildSuitCanvasHtml(game, resultStatus, c1, c2);
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  const finalAnnouncement = `Hi Survivors!
Pertandingan Suit PvP telah selesai!

–  *M A T C H  R E S U L T*

┌  ◦  *Player 1* : @${p1.jid.split("@")[0]} (${SUIT_CHOICES[c1].name})
│  ◦  *Player 2* : @${p2.jid.split("@")[0]} (${SUIT_CHOICES[c2].name})
└  ◦  *Status* : ${resultStatus}

–  *O U T C O M E*

${winnerText}
🎁 *Reward:* ${rewardText}

_Ketik \`${prefix}suit\` untuk bermain kembali!_`;
  await sendNeoxrSuit(sock, ctx, groupId, finalAnnouncement, footerText, [{
    name: "quick_reply",
    display_text: "🎮 Main Lagi",
    id: `${prefix}suit`
  }], null, [p1.jid, p2.jid], buffer, url);
}