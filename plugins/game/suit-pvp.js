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

function buildSuitCanvasHtml(game, statusText = "VS MATCH", p1Choice = null, p2Choice = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const p1Icon = p1Choice ? SUIT_CHOICES[p1Choice]?.icon || "❓" : game?.player1?.choice ? "🔒" : "❓";
  const p2Icon = p2Choice ? SUIT_CHOICES[p2Choice]?.icon || "❓" : game?.player2?.choice ? "🔒" : "❓";
  const isP1Win = statusText.includes("PLAYER 1 WINS");
  const isP2Win = statusText.includes("PLAYER 2 WINS");
  const isDraw = statusText.includes("DRAW");
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@800;900&family=Plus+Jakarta+Sans:wght@700;800;900&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 750px;
        height: 480px;
        background: #07090e;
        font-family: 'Plus Jakarta Sans', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .stage {
        position: relative;
        width: 710px;
        height: 440px;
        background: radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.15) 0%, rgba(8, 11, 18, 0.98) 85%);
        border: 2px solid #252e42;
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
        background: #6366f1;
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
        border: 1px solid #6366f1;
        color: #818cf8;
        background: rgba(15, 23, 42, 0.8);
        padding: 5px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 2px;
        text-transform: uppercase;
      }
      .fight-arena {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 0;
      }
      .fighter-card {
        width: 230px;
        background: #0f1422;
        border: 2px solid #212c44;
        border-radius: 16px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      }
      .fighter-card.winner {
        border-color: #22c55e;
        box-shadow: 0 0 20px rgba(34, 197, 94, 0.35);
      }
      .fighter-card.loser {
        border-color: #ef4444;
        opacity: 0.65;
      }
      .fighter-name {
        font-size: 16px;
        font-weight: 900;
        color: #f1f5f9;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      .hand-bubble {
        width: 105px;
        height: 105px;
        background: radial-gradient(circle, #1a2238 0%, #0d121f 100%);
        border: 3px solid #2d3b5b;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 52px;
        box-shadow: inset 0 0 15px rgba(0,0,0,0.8);
      }
      .fighter-card.winner .hand-bubble {
        border-color: #22c55e;
        background: radial-gradient(circle, #153320 0%, #0d1e13 100%);
      }
      .fighter-card.loser .hand-bubble {
        border-color: #ef4444;
      }
      .vs-badge {
        font-family: 'Orbitron', monospace;
        font-size: 38px;
        font-weight: 900;
        color: #f59e0b;
        letter-spacing: 2px;
        text-shadow: 0 0 15px rgba(245, 158, 11, 0.6);
      }
      .footer-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #1a2234;
        padding-top: 12px;
        color: #94a3b8;
        font-size: 13px;
        font-weight: 700;
      }
      .footer-meta b {
        color: #818cf8;
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <div class="header-meta">
        <div class="brand-title">
          <div class="brand-icon">⚔️</div>
          <div class="brand-text">SUIT <span>PVP ARENA</span></div>
        </div>
        <div class="status-pill">${statusText}</div>
      </div>
      <div class="fight-arena">
        <div class="fighter-card ${isP1Win ? "winner" : isP2Win ? "loser" : ""}">
          <div class="fighter-name">${game?.player1?.name || "Player 1"}</div>
          <div class="hand-bubble">${p1Icon}</div>
          <small style="color: #64748b; font-size: 11px;">${game?.player1?.choice ? "READY" : "CHOOSING..."}</small>
        </div>
        <div class="vs-badge">VS</div>
        <div class="fighter-card ${isP2Win ? "winner" : isP1Win ? "loser" : ""}">
          <div class="fighter-name">${game?.player2?.name || (game?.status === "WAITING" ? "Waiting Opponent..." : "Player 2")}</div>
          <div class="hand-bubble">${p2Icon}</div>
          <small style="color: #64748b; font-size: 11px;">${game?.player2?.choice ? "READY" : "CHOOSING..."}</small>
        </div>
      </div>
      <div class="footer-meta">
        <div>TOTAL TARUHAN : <b style="color: #22c55e;">Rp ${(game?.bet ? game.bet * 2 : 0).toLocaleString()}</b></div>
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
async function sendNeoxrSuit(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null, mentions = [], imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const defaultBanner = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : defaultBanner);
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Suit PvP Arena ✦`,
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
  name: "suit",
  aliases: ["suitpvp", "rps", "jankenpon"],
  description: "Tantang pemain lain bermain Suit (Batu Gunting Kertas) dengan visual canvas arcade bertema Neoxr",
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
      const senderJid = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      if (!senderJid) return;
      initDB();
      const activeEntry = Object.entries(global.db.suit).find(([_, g]) => g.status === "PLAYING" && (g.player1?.jid === senderJid || g.player2?.jid === senderJid));
      if (!activeEntry) return;
      const [groupId, activeGame] = activeEntry;
      if (Date.now() > activeGame.expireTime) {
        delete global.db.suit[groupId];
        saveDB();
        return ctx.reply("⏰ Waktu memilih suit telah habis.");
      }
      const rawText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      let choice = null;
      if (rawText.includes("batu")) choice = "batu";
      else if (rawText.includes("gunting")) choice = "gunting";
      else if (rawText.includes("kertas")) choice = "kertas";
      if (!choice) return;
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

_Hasil pertandingan dan reward akan diumumkan di grup setelah kedua pemain memilih!_`;
      await ctx.reply(successText);
      await updateGroupStatus(sock, ctx, groupId);
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
      const senderName = ctx?.pushName || ctx?.pushname || "Pemain 1";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const args = ctx?.args || [];
      const subCommand = (args[0] || "").trim().toLowerCase();
      initDB(senderJid, senderName);
      if (!isGroup) {
        if (subCommand === "pilih") {
          const choiceArg = (args[1] || "").toLowerCase();
          if (!SUIT_CHOICES[choiceArg]) return ctx.reply("⚠️ Pilihan suit tidak valid. Pilih batu, gunting, atau kertas.");
          const activeEntry = Object.entries(global.db.suit).find(([_, g]) => g.status === "PLAYING" && (g.player1?.jid === senderJid || g.player2?.jid === senderJid));
          if (!activeEntry) return ctx.reply("⚠️ Tidak ada sesi suit yang sedang menunggumu.");
          const [groupId, activeGame] = activeEntry;
          const currentPlayer = activeGame.player1.jid === senderJid ? activeGame.player1 : activeGame.player2;
          if (currentPlayer.choice) {
            return ctx.reply("⚠️ Kamu sudah menentukan pilihan sebelumnya!");
          }
          currentPlayer.choice = choiceArg;
          saveDB();
          await ctx.react("✅");
          await ctx.reply(`Hi ${currentPlayer.name}!\nPilihan *${SUIT_CHOICES[choiceArg].name}* telah disimpan rahasia.`);
          await updateGroupStatus(sock, ctx, groupId);
          return;
        }
        return ctx.reply("❌ *Game Suit PvP ini hanya dapat dimainkan di dalam Grup!*");
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
        const pcText = `Hi Fighter!
Tantangan Suit PvP di grup telah dimulai!

–  *C H O O S E  W E A P O N*

┌  ◦  *Taruhan Meja* : Rp ${game.bet.toLocaleString()}
│  ◦  *Batu* (✊) : Mengalahkan Gunting
│  ◦  *Gunting* (✌️) : Mengalahkan Kertas
└  ◦  *Kertas* (🖐️) : Mengalahkan Batu

_Pilihanmu dirahasiakan dan langsung diproses otomatis di grup!_`;
        await sendNeoxrSuit(sock, ctx, game.player1.jid, pcText, footerText, pcButtons);
        await sendNeoxrSuit(sock, ctx, game.player2.jid, pcText, footerText, pcButtons);
        const groupStartText = `Hi Survivors!
Tantangan diterima! Pertandingan Suit PvP resmi dimulai.

–  *M A T C H  S T A R T E D*

┌  ◦  *Pemain 1* : @${game.player1.jid.split("@")[0]} [Menunggu Memilih ⏳]
│  ◦  *Pemain 2* : @${game.player2.jid.split("@")[0]} [Menunggu Memilih ⏳]
└  ◦  *Total Hadiah* : Rp ${(game.bet * 2).toLocaleString()}

_Buka Private Chat (PC) bot sekarang untuk memilih jagoanmu secara rahasia!_`;
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
        if (!global.db.suit[groupId]) {
          return ctx.reply("⚠️ Tidak ada sesi suit yang sedang aktif di grup ini.");
        }
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
      await ctx.react("🎮");
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
│  ◦  *Target* : ${targetJid ? `@${targetJid.split("@")[0]}` : "Siapa saja di grup ini!"}
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
      await ctx.react("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};
async function updateGroupStatus(sock, ctx, groupId) {
  initDB();
  const game = global.db.suit[groupId];
  if (!game) return;
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const prefix = ctx?.prefix || ".";
  const p1 = game.player1;
  const p2 = game.player2;
  const p1Status = p1.choice ? "Sudah Memilih ✅" : "Menunggu Memilih ⏳";
  const p2Status = p2.choice ? "Sudah Memilih ✅" : "Menunggu Memilih ⏳";
  if (!p1.choice || !p2.choice) {
    const progressText = `Hi Survivors!
Berikut pembaruan status pemilihan jagoan suit.

–  *S T A T U S  C H O I C E*

┌  ◦  @${p1.jid.split("@")[0]} : ${p1Status}
└  ◦  @${p2.jid.split("@")[0]} : ${p2Status}

_Pemain yang belum memilih silakan buka Private Chat dengan bot!_`;
    return await sock.sendMessage(groupId, {
      text: progressText,
      mentions: [p1.jid, p2.jid]
    });
  }
  delete global.db.suit[groupId];
  saveDB();
  const c1 = p1.choice;
  const c2 = p2.choice;
  const bet = game.bet || 0;
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
    rewardText = "Masing-masing pemain mendapatkan +15 EXP.";
  } else if (SUIT_CHOICES[c1].beats === c2) {
    resultStatus = "PLAYER 1 WINS";
    winnerText = `@${p1.jid.split("@")[0]} berhasil mengalahkan @${p2.jid.split("@")[0]}!`;
    if (bet > 0) {
      if (u1 && u2) {
        u1.money = (Number(u1.money) || 0) + bet;
        u2.money = Math.max(0, (Number(u2.money) || 0) - bet);
        u1.exp = (Number(u1.exp) || 0) + 50;
      }
      rewardText = `+Rp ${(bet * 2).toLocaleString()} & +50 EXP`;
    } else {
      if (u1) {
        u1.money = (Number(u1.money) || 0) + 5e3;
        u1.exp = (Number(u1.exp) || 0) + 35;
      }
      rewardText = `+Rp 5.000 & +35 EXP`;
    }
  } else {
    resultStatus = "PLAYER 2 WINS";
    winnerText = `@${p2.jid.split("@")[0]} berhasil mengalahkan @${p1.jid.split("@")[0]}!`;
    if (bet > 0) {
      if (u1 && u2) {
        u2.money = (Number(u2.money) || 0) + bet;
        u1.money = Math.max(0, (Number(u1.money) || 0) - bet);
        u2.exp = (Number(u2.exp) || 0) + 50;
      }
      rewardText = `+Rp ${(bet * 2).toLocaleString()} & +50 EXP`;
    } else {
      if (u2) {
        u2.money = (Number(u2.money) || 0) + 5e3;
        u2.exp = (Number(u2.exp) || 0) + 35;
      }
      rewardText = `+Rp 5.000 & +35 EXP`;
    }
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
  const playAgainButtons = [{
    name: "quick_reply",
    display_text: "🎮 Main Lagi",
    id: `${prefix}suit`
  }];
  await sendNeoxrSuit(sock, ctx, groupId, finalAnnouncement, footerText, playAgainButtons, null, [p1.jid, p2.jid], buffer, url);
}