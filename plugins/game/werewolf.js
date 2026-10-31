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

function buildWerewolfCanvasHtml(game, phaseText = "LOBBY", dayCount = 1, showRoles = false) {
  const botName = global.bot?.name || "WudysoftBot";
  const players = game?.players || [];
  const isNight = phaseText.includes("NIGHT");
  const isDay = phaseText.includes("DAY");
  const isEnd = phaseText.includes("WIN");
  const bgGradient = isNight ? "radial-gradient(circle at 80% 20%, rgba(147, 51, 234, 0.25) 0%, rgba(8, 10, 18, 0.98) 85%)" : isDay ? "radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.22) 0%, rgba(10, 13, 20, 0.98) 85%)" : "radial-gradient(circle at 50% 50%, rgba(220, 38, 38, 0.25) 0%, rgba(9, 10, 16, 0.98) 85%)";
  const statusColor = isNight ? "#c084fc" : isDay ? "#f59e0b" : "#ef4444";
  const playersHtml = players.map((p, idx) => {
    let roleBadge = "SECRET";
    if (showRoles && p.role) {
      if (p.role === "werewolf") roleBadge = "🐺 WOLF";
      else if (p.role === "seer") roleBadge = "🔮 SEER";
      else if (p.role === "guardian") roleBadge = "🛡️ GUARD";
      else roleBadge = "👨‍🌾 VILLAGER";
    }
    return `
      <div class="player-card ${p.isAlive ? "alive" : "dead"}">
        <div class="p-num">${idx + 1}</div>
        <div class="p-info">
          <div class="p-name">${p.name ? p.name.slice(0, 10) : "Player"}</div>
          <div class="p-status">${p.isAlive ? "● ALIVE" : "💀 DEAD"}</div>
        </div>
        ${showRoles ? `<div class="p-role">${roleBadge}</div>` : ""}
      </div>
    `;
  }).join("");
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
        height: 500px;
        background: #080a10;
        font-family: 'Plus Jakarta Sans', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .village-card {
        width: 710px;
        height: 460px;
        background: ${bgGradient};
        border: 2px solid #23293a;
        border-radius: 20px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.85);
        padding: 22px 26px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .brand-icon {
        background: ${isNight ? "#9333ea" : "#d97706"};
        color: #fff;
        width: 34px;
        height: 34px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }
      .brand-text {
        color: #f8fafc;
        font-size: 19px;
        font-weight: 900;
        letter-spacing: 0.5px;
      }
      .status-pill {
        border: 1px solid ${statusColor};
        color: ${statusColor};
        background: rgba(15, 23, 42, 0.85);
        padding: 5px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 2px;
        text-transform: uppercase;
      }
      .players-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px 12px;
        margin: 10px 0;
      }
      .player-card {
        height: 46px;
        background: #111420;
        border: 1px solid #1f2738;
        border-radius: 10px;
        padding: 0 12px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .player-card.alive {
        border-color: #2b354c;
      }
      .player-card.dead {
        border-color: #7f1d1d;
        background: rgba(127, 29, 29, 0.2);
        opacity: 0.6;
      }
      .p-num {
        width: 24px;
        height: 24px;
        background: #1c2436;
        color: #94a3b8;
        border-radius: 6px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: 900;
        font-size: 12px;
      }
      .p-info {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .p-name {
        font-size: 13px;
        font-weight: 800;
        color: #f1f5f9;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .p-status {
        font-size: 10px;
        font-weight: 700;
        color: #10b981;
      }
      .player-card.dead .p-status {
        color: #ef4444;
      }
      .p-role {
        font-size: 11px;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(0,0,0,0.4);
        color: #fbbf24;
      }
      .footer-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #1c2333;
        padding-top: 10px;
        color: #94a3b8;
        font-size: 13px;
        font-weight: 700;
      }
      .footer-meta b {
        color: ${statusColor};
      }
    </style>
  </head>
  <body>
    <div class="village-card">
      <div class="top-row">
        <div class="brand">
          <div class="brand-icon">🐺</div>
          <div class="brand-text">WEREWOLF <span>VILLAGE</span></div>
        </div>
        <div class="status-pill">${phaseText}</div>
      </div>
      <div class="players-grid">
        ${playersHtml}
      </div>
      <div class="footer-meta">
        <div>WARGA HIDUP : <b>${players.filter(p => p.isAlive).length} / ${players.length} PEMAIN</b></div>
        <div>HARI KE : <b>${dayCount}</b></div>
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
  if (!global.db.werewolf) global.db.werewolf = {};
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
async function sendNeoxrWw(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null, mentions = [], imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const defaultBanner = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : defaultBanner);
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Werewolf Village ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 3,
        divider_indices: [2],
        list_title: `${botName} • Aksi Desa`,
        button_title: "🐺 Menu Aksi"
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
      console.error("[sendNeoxrWw ctx.sendCta Error]:", e.message);
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
  name: "werewolf",
  aliases: ["ww", "warewolf", "desaserigala"],
  description: "Bermain game Werewolf PvP bersama anggota grup dengan canvas realistis bertema Neoxr",
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
      const senderJid = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      if (!senderJid) return;
      initDB();
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (!isGroup) {
        const gameEntry = Object.entries(global.db.werewolf).find(([_, g]) => g.status === "NIGHT" && g.players.some(p => p.jid === senderJid && p.isAlive));
        if (!gameEntry) return;
        const [groupId, game] = gameEntry;
        const player = game.players.find(p => p.jid === senderJid);
        if (!player || !player.isAlive) return;
        const prefix = ctx?.prefix || ".";
        if (userText.startsWith(prefix)) return;
        return await handleNightAction(sock, ctx, groupId, senderJid, userText);
      }
      if (isGroup) {
        const groupId = ctx.id;
        const game = global.db.werewolf[groupId];
        if (!game || game.status !== "DAY") return;
        const voter = game.players.find(p => p.jid === senderJid);
        if (!voter || !voter.isAlive) return;
        const prefix = ctx?.prefix || ".";
        if (userText.startsWith(prefix)) return;
        const voteTargetNum = parseInt(userText);
        if (!isNaN(voteTargetNum)) {
          return await processVote(sock, ctx, groupId, senderJid, voteTargetNum);
        }
      }
    } catch (err) {
      console.error("[WEREWOLF BEFORE ERROR]:", err);
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
      initDB(senderJid, senderName);
      if (!isGroup) {
        if (["act", "aksi", "kill", "check", "protect"].includes(subCommand)) {
          const gameEntry = Object.entries(global.db.werewolf).find(([_, g]) => g.status === "NIGHT" && g.players.some(p => p.jid === senderJid && p.isAlive));
          if (!gameEntry) {
            return ctx.reply("⚠️ Kamu sedang tidak berada dalam sesi malam game Werewolf.");
          }
          const [groupId] = gameEntry;
          const targetInput = args[1] || "";
          return await handleNightAction(sock, ctx, groupId, senderJid, targetInput);
        }
        return ctx.reply("❌ *Game Werewolf hanya dapat dimulai di dalam Grup!*");
      }
      const groupId = ctx.id;
      if (["join", "gabung", "ikut"].includes(subCommand)) {
        if (!global.db.werewolf[groupId]) {
          return ctx.reply(`⚠️ Belum ada lobby Werewolf yang dibuka. Ketik \`${prefix}ww create\` untuk membuka room!`);
        }
        const game = global.db.werewolf[groupId];
        if (game.status !== "LOBBY") {
          return ctx.reply("⚠️ Game Werewolf di grup ini sudah dimulai.");
        }
        if (game.players.some(p => p.jid === senderJid)) {
          return ctx.reply("⚠️ Kamu sudah berada di dalam lobby!");
        }
        if (game.players.length >= 10) {
          return ctx.reply("⚠️ Kapasitas maksimal lobby (10 pemain) telah tercapai.");
        }
        game.players.push({
          jid: senderJid,
          name: senderName,
          role: null,
          isAlive: true,
          votedFor: null
        });
        saveDB();
        await ctx.react("✅");
        const joinNotif = `Hi ${senderName}!
Kamu berhasil bergabung ke dalam Werewolf Village.

–  *L O B B Y  U P D A T E*

┌  ◦  *Player Baru* : @${senderJid.split("@")[0]}
└  ◦  *Total Pemain* : ${game.players.length} / 10

_Minimal 4 pemain untuk memulai. Ketik \`${prefix}ww start\` jika sudah siap!_`;
        return await sock.sendMessage(groupId, {
          text: joinNotif,
          mentions: [senderJid]
        }, {
          quoted: quotedMsg
        });
      }
      if (["start", "mulai"].includes(subCommand)) {
        if (!global.db.werewolf[groupId]) {
          return ctx.reply(`⚠️ Buat lobby terlebih dahulu dengan mengetik \`${prefix}ww create\``);
        }
        const game = global.db.werewolf[groupId];
        if (game.status !== "LOBBY") {
          return ctx.reply("⚠️ Game Werewolf sudah berjalan!");
        }
        if (game.players.length < 4) {
          return ctx.reply(`❌ Pemain belum mencukupi! Minimal 4 pemain untuk bermain. (Saat ini: ${game.players.length} pemain)`);
        }
        return await startGameSession(sock, ctx, groupId);
      }
      if (["vote", "pilih"].includes(subCommand)) {
        const game = global.db.werewolf[groupId];
        if (!game || game.status !== "DAY") {
          return ctx.reply("⚠️ Sesi voting eksekusi desa belum dibuka.");
        }
        const voter = game.players.find(p => p.jid === senderJid);
        if (!voter || !voter.isAlive) {
          return ctx.reply("❌ Kamu bukan pemain yang masih hidup di game ini.");
        }
        const targetNum = parseInt(args[1]);
        if (isNaN(targetNum)) {
          return ctx.reply(`⚠️ Masukkan nomor pemain target! Contoh: \`${prefix}ww vote 2\``);
        }
        return await processVote(sock, ctx, groupId, senderJid, targetNum);
      }
      if (["stop", "cancel", "batal", "delete"].includes(subCommand)) {
        if (!global.db.werewolf[groupId]) {
          return ctx.reply("⚠️ Tidak ada sesi Werewolf yang aktif di grup ini.");
        }
        const game = global.db.werewolf[groupId];
        if (game.host !== senderJid) {
          return ctx.reply("❌ Hanya host (pembuat room) yang berhak membatalkan permainan.");
        }
        delete global.db.werewolf[groupId];
        saveDB();
        return ctx.reply("🛑 Sesi permainan Werewolf berhasil dibatalkan.");
      }
      if (global.db.werewolf[groupId]) {
        const game = global.db.werewolf[groupId];
        if (game.status === "LOBBY") {
          return ctx.reply(`⚠️ Lobby sudah dibuka sebelumnya! Ketik \`${prefix}ww join\` untuk ikut bergabung (${game.players.length} pemain).`);
        }
        return ctx.reply("⚠️ Masih ada game Werewolf yang sedang berlangsung di grup ini!");
      }
      await ctx.react("🐺");
      global.db.werewolf[groupId] = {
        groupId: groupId,
        host: senderJid,
        status: "LOBBY",
        dayCount: 1,
        expireTime: Date.now() + 60 * 1e3,
        players: [{
          jid: senderJid,
          name: senderName,
          role: null,
          isAlive: true,
          votedFor: null
        }],
        nightActions: {
          killTarget: null,
          protectTarget: null,
          checkTarget: null
        }
      };
      saveDB();
      const buttons = [{
        name: "quick_reply",
        display_text: "⚔️ Join Game",
        id: `${prefix}ww join`
      }, {
        name: "quick_reply",
        display_text: "🚀 Mulai Game",
        id: `${prefix}ww start`
      }, {
        name: "quick_reply",
        display_text: "🛑 Batal",
        id: `${prefix}ww stop`
      }];
      const lobbyText = `Hi Survivors!
Lobby desa misterius Werewolf Village telah dibuka!

–  *L O B B Y  W E R E W O L F*

┌  ◦  *Host* : @${senderJid.split("@")[0]}
│  ◦  *Kapasitas* : 4 - 10 Pemain
└  ◦  *Status* : Rekrutmen Terbuka

–  *D A F T A R  W A R G A*

┌  ◦  [1] @${senderJid.split("@")[0]}

_Ketuk tombol Join di bawah atau ketik \`${prefix}ww join\` untuk bergabung!_`;
      const canvasHtml = buildWerewolfCanvasHtml(global.db.werewolf[groupId], "LOBBY RECRUITMENT", 1);
      const {
        buffer,
        url
      } = await renderHtmlToImage(canvasHtml);
      await sendNeoxrWw(sock, ctx, groupId, lobbyText, footerText, buttons, quotedMsg, [senderJid], buffer, url);
    } catch (e) {
      console.error("[WEREWOLF ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};
async function startGameSession(sock, ctx, groupId) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return;
  const count = game.players.length;
  let roles = [];
  if (count === 4) {
    roles = ["werewolf", "seer", "villager", "villager"];
  } else if (count === 5) {
    roles = ["werewolf", "seer", "guardian", "villager", "villager"];
  } else if (count === 6) {
    roles = ["werewolf", "werewolf", "seer", "guardian", "villager", "villager"];
  } else {
    roles = ["werewolf", "werewolf", "seer", "guardian"];
    while (roles.length < count) roles.push("villager");
  }
  roles = roles.sort(() => Math.random() - .5);
  game.players.forEach((p, idx) => {
    p.role = roles[idx];
  });
  saveDB();
  for (const p of game.players) {
    let roleName = "";
    let roleDesc = "";
    if (p.role === "werewolf") {
      roleName = "🐺 WEREWOLF";
      roleDesc = "Tugasmu memangsa para warga desa di setiap malam secara rahasia!";
    } else if (p.role === "seer") {
      roleName = "🔮 SEER (Penerawang)";
      roleDesc = "Kamu dapat menerawang 1 identitas asli pemain lain di setiap malam.";
    } else if (p.role === "guardian") {
      roleName = "🛡️ GUARDIAN (Pelindung)";
      roleDesc = "Kamu dapat melindungi 1 orang setiap malam dari serangan serigala.";
    } else {
      roleName = "👨‍🌾 VILLAGER (Warga Desa)";
      roleDesc = "Cari dan gantung seluruh serigala di siang hari melalui voting!";
    }
    const pcRoleText = `Hi ${p.name}!
Kartu identitas rahasiamu dalam Werewolf Village telah diterbitkan.

–  *S E C R E T  R O L E*

┌  ◦  *Peran* : ${roleName}
└  ◦  *Misi* : ${roleDesc}

_Simpan rahasiamu rapat-rapat dan jangan biarkan warga lain mengetahuinya!_`;
    await sock.sendMessage(p.jid, {
      text: pcRoleText
    }).catch(() => {});
  }
  const allMentions = game.players.map(p => p.jid);
  await sock.sendMessage(game.groupId, {
    text: `🎴 Seluruh kartu peran telah dikirimkan ke Private Chat masing-masing pemain! Sesi malam pertama segera tiba...`,
    mentions: allMentions
  });
  await enterNightPhase(sock, ctx, groupId);
}
async function enterNightPhase(sock, ctx, groupId) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return;
  game.status = "NIGHT";
  game.expireTime = Date.now() + 60 * 1e3;
  game.nightActions = {
    killTarget: null,
    protectTarget: null,
    checkTarget: null
  };
  saveDB();
  const alivePlayers = game.players.filter(p => p.isAlive);
  const prefix = ctx?.prefix || ".";
  const nightText = `Hi Survivors!
Malam hari ke-${game.dayCount} telah tiba. Kabut dingin menyelimuti desa... 🌙

–  *N I G H T  P H A S E*

┌  ◦  *Kondisi* : Seluruh warga tertidur lelap
│  ◦  *Aksi Khusus* : Werewolf, Seer, & Guardian
└  ◦  *Waktu Malam* : 60 Detik

_Pemilik peran malam, buka Private Chat (PC) bot sekarang untuk memilih targetmu!_`;
  const canvasHtml = buildWerewolfCanvasHtml(game, `NIGHT ${game.dayCount}`, game.dayCount);
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  await sendNeoxrWw(sock, ctx, game.groupId, nightText, "Waktu Malam: 60s", [], null, alivePlayers.map(p => p.jid), buffer, url);
  const targetListText = alivePlayers.map((p, idx) => `┌  ◦  [${idx + 1}] @${p.jid.split("@")[0]}`).join("\n");
  const mentions = alivePlayers.map(p => p.jid);
  for (const p of alivePlayers) {
    if (["werewolf", "seer", "guardian"].includes(p.role)) {
      const buttons = alivePlayers.map((target, idx) => ({
        name: "quick_reply",
        display_text: `${idx + 1}. @${target.jid.split("@")[0]}`,
        id: `${prefix}ww act ${idx + 1}`
      }));
      let actionTitle = "";
      if (p.role === "werewolf") actionTitle = "🐺 PILIH MANGSA UNTUK DIMANGSA:";
      if (p.role === "seer") actionTitle = "🔮 PILIH PEMAIN UNTUK DITERAWANG:";
      if (p.role === "guardian") actionTitle = "🛡️ PILIH PEMAIN UNTUK DILINDUNGI:";
      const body = `Hi ${p.name}!\n${actionTitle}\n\n–  *T A R G E T  L I S T*\n\n${targetListText}\n\n_Tekan tombol di bawah atau balas chat ini dengan angka targetmu!_`;
      await sendNeoxrWw(sock, ctx, p.jid, body, "Aksi Malam Rahasia", buttons, null, mentions);
    }
  }
  setTimeout(async () => {
    initDB();
    if (global.db.werewolf[groupId]?.status === "NIGHT" && Date.now() >= global.db.werewolf[groupId].expireTime) {
      await resolveNightPhase(sock, ctx, groupId);
    }
  }, 60 * 1e3);
}
async function handleNightAction(sock, ctx, groupId, playerJid, input) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return;
  const player = game.players.find(p => p.jid === playerJid);
  const alivePlayers = game.players.filter(p => p.isAlive);
  const targetIdx = parseInt(input) - 1;
  if (isNaN(targetIdx) || targetIdx < 0 || targetIdx >= alivePlayers.length) {
    return ctx.reply(`⚠️ Nomor tidak valid! Pilih angka 1 sampai ${alivePlayers.length}.`);
  }
  const targetPlayer = alivePlayers[targetIdx];
  if (player.role === "werewolf") {
    game.nightActions.killTarget = targetPlayer.jid;
    saveDB();
    await ctx.reply(`🐺 Pilihanmu dikunci: Memangsa *@${targetPlayer.jid.split("@")[0]}* malam ini.`, {
      mentions: [targetPlayer.jid]
    });
  } else if (player.role === "guardian") {
    game.nightActions.protectTarget = targetPlayer.jid;
    saveDB();
    await ctx.reply(`🛡️ Pilihanmu dikunci: Melindungi *@${targetPlayer.jid.split("@")[0]}* malam ini.`, {
      mentions: [targetPlayer.jid]
    });
  } else if (player.role === "seer") {
    game.nightActions.checkTarget = targetPlayer.jid;
    saveDB();
    const isWolf = targetPlayer.role === "werewolf";
    await ctx.reply(`🔮 Hasil penerawangan mata batin:\n@${targetPlayer.jid.split("@")[0]} adalah seorang *${isWolf ? "🐺 WEREWOLF" : "👨‍🌾 WARGA DESA (BAIK)"}*!`, {
      mentions: [targetPlayer.jid]
    });
  }
  const wolves = alivePlayers.filter(p => p.role === "werewolf");
  const seers = alivePlayers.filter(p => p.role === "seer");
  const guards = alivePlayers.filter(p => p.role === "guardian");
  const wolfDone = wolves.length === 0 || game.nightActions.killTarget !== null;
  const seerDone = seers.length === 0 || game.nightActions.checkTarget !== null;
  const guardDone = guards.length === 0 || game.nightActions.protectTarget !== null;
  if (wolfDone && seerDone && guardDone) {
    await resolveNightPhase(sock, ctx, groupId);
  }
}
async function resolveNightPhase(sock, ctx, groupId) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return;
  let victimJid = null;
  if (game.nightActions.killTarget) {
    if (game.nightActions.protectTarget && game.nightActions.protectTarget === game.nightActions.killTarget) {
      victimJid = null;
    } else {
      victimJid = game.nightActions.killTarget;
      const vPlayer = game.players.find(p => p.jid === victimJid);
      if (vPlayer) vPlayer.isAlive = false;
    }
  }
  saveDB();
  if (await checkWinConditions(sock, ctx, groupId)) return;
  await enterDayPhase(sock, ctx, groupId, victimJid);
}
async function enterDayPhase(sock, ctx, groupId, victimJid) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return;
  game.status = "DAY";
  game.expireTime = Date.now() + 60 * 1e3;
  game.players.forEach(p => p.votedFor = null);
  saveDB();
  const alivePlayers = game.players.filter(p => p.isAlive);
  const prefix = ctx?.prefix || ".";
  let morningNews = `Hi Survivors!
Matahari terbit di hari ke-${game.dayCount}. Sesi voting desa dibuka! ☀️\n\n`;
  if (victimJid) {
    morningNews += `–  *N I G H T  C A S U A L T Y*\n\n` + `🩸 Korban Terbunuh: @${victimJid.split("@")[0]} ditemukan tewas tercabik cakar serigala!\n\n`;
  } else {
    morningNews += `–  *P E A C E F U L  N I G H T*\n\n` + `✨ Tidak ada korban semalam! Penjaga desa berhasil melindungi target.\n\n`;
  }
  morningNews += `–  *D I S C U S S I O N  &  V O T E*\n\n`;
  alivePlayers.forEach((p, idx) => {
    morningNews += `┌  ◦  [${idx + 1}] @${p.jid.split("@")[0]}\n`;
  });
  morningNews += `\n_Ketik \`${prefix}ww vote <nomor>\` atau balas dengan angka untuk menggantung tersangka!_`;
  const buttons = alivePlayers.map((p, idx) => ({
    name: "quick_reply",
    display_text: `${idx + 1}. @${p.jid.split("@")[0]}`,
    id: `${prefix}ww vote ${idx + 1}`
  }));
  const mentions = victimJid ? [...alivePlayers.map(p => p.jid), victimJid] : alivePlayers.map(p => p.jid);
  const canvasHtml = buildWerewolfCanvasHtml(game, `DAY ${game.dayCount}`, game.dayCount);
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  await sendNeoxrWw(sock, ctx, game.groupId, morningNews, "Waktu Voting: 60s", buttons, null, mentions, buffer, url);
  setTimeout(async () => {
    initDB();
    if (global.db.werewolf[groupId]?.status === "DAY" && Date.now() >= global.db.werewolf[groupId].expireTime) {
      await resolveDayVoting(sock, ctx, groupId);
    }
  }, 60 * 1e3);
}
async function processVote(sock, ctx, groupId, voterJid, targetNum) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return;
  const voter = game.players.find(p => p.jid === voterJid);
  const alivePlayers = game.players.filter(p => p.isAlive);
  const targetIdx = targetNum - 1;
  if (targetIdx < 0 || targetIdx >= alivePlayers.length) {
    return ctx.reply(`⚠️ Nomor tidak valid! Pilih angka 1 sampai ${alivePlayers.length}.`);
  }
  const target = alivePlayers[targetIdx];
  voter.votedFor = target.jid;
  saveDB();
  const totalVoted = alivePlayers.filter(p => p.votedFor !== null).length;
  await ctx.reply(`🗳️ @${voter.jid.split("@")[0]} memberikan suara untuk menggantung @${target.jid.split("@")[0]} (${totalVoted}/${alivePlayers.length} suara)`, {
    mentions: [voter.jid, target.jid]
  });
  if (totalVoted >= alivePlayers.length) {
    await resolveDayVoting(sock, ctx, groupId);
  }
}
async function resolveDayVoting(sock, ctx, groupId) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return;
  const alivePlayers = game.players.filter(p => p.isAlive);
  const voteCounts = {};
  alivePlayers.forEach(p => {
    if (p.votedFor) {
      voteCounts[p.votedFor] = (voteCounts[p.votedFor] || 0) + 1;
    }
  });
  let maxVotes = 0;
  let lynchedJid = null;
  let isTie = false;
  for (const [jid, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      lynchedJid = jid;
      isTie = false;
    } else if (count === maxVotes) {
      isTie = true;
    }
  }
  if (!lynchedJid || isTie || maxVotes === 0) {
    await sock.sendMessage(game.groupId, {
      text: `⚖️ Hasil voting imbang atau tidak ada suara bulat! Tidak ada warga yang digantung hari ini.`
    });
  } else {
    const lynchedPlayer = game.players.find(p => p.jid === lynchedJid);
    if (lynchedPlayer) {
      lynchedPlayer.isAlive = false;
      saveDB();
      const roleName = lynchedPlayer.role === "werewolf" ? "🐺 WEREWOLF" : "👨‍🌾 WARGA DESA";
      await sock.sendMessage(game.groupId, {
        text: `⚰️ @${lynchedPlayer.jid.split("@")[0]} memperoleh suara terbanyak dan digantung di tiang eksekusi desa!\nPeran aslinya: *${roleName}*`,
        mentions: [lynchedPlayer.jid]
      });
    }
  }
  if (await checkWinConditions(sock, ctx, groupId)) return;
  game.dayCount++;
  saveDB();
  await enterNightPhase(sock, ctx, groupId);
}
async function checkWinConditions(sock, ctx, groupId) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return false;
  const alive = game.players.filter(p => p.isAlive);
  const wolves = alive.filter(p => p.role === "werewolf");
  const villagers = alive.filter(p => p.role !== "werewolf");
  let winnerTeam = null;
  if (wolves.length === 0) {
    winnerTeam = "VILLAGERS";
  } else if (wolves.length >= villagers.length) {
    winnerTeam = "WEREWOLVES";
  }
  if (!winnerTeam) return false;
  delete global.db.werewolf[groupId];
  saveDB();
  const prefix = ctx?.prefix || ".";
  let winText = "";
  if (winnerTeam === "VILLAGERS") {
    winText = `Hi Survivors!
Seluruh Werewolf telah dibinasakan! Desa kembali damai. 🎉

–  *V I L L A G E R S  W I N*

┌  ◦  *Tim Pemenang* : Warga Desa & Pelindung
└  ◦  *Reward* : +Rp 15.000 | +100 EXP / Pemain`;
  } else {
    winText = `Hi Survivors!
Kawanan Werewolf berhasil membantai mayoritas warga desa! 🐺

–  *W E R E W O L V E S  W I N*

┌  ◦  *Tim Pemenang* : Kawanan Serigala (Werewolves)
└  ◦  *Reward* : +Rp 25.000 | +150 EXP / Pemain`;
  }
  winText += `\n\n–  *F I N A L  R O L E S*\n\n`;
  game.players.forEach((p, idx) => {
    let rIcon = "👨‍🌾 Villager";
    if (p.role === "werewolf") rIcon = "🐺 Werewolf";
    if (p.role === "seer") rIcon = "🔮 Seer";
    if (p.role === "guardian") rIcon = "🛡️ Guardian";
    winText += `┌  ◦  [${idx + 1}] @${p.jid.split("@")[0]} : ${rIcon} (${p.isAlive ? "Hidup" : "Gugur"})\n`;
  });
  for (const p of game.players) {
    initDB(p.jid, p.name);
    const user = global.db.user[p.jid];
    if (user) {
      const isWinner = winnerTeam === "VILLAGERS" && p.role !== "werewolf" || winnerTeam === "WEREWOLVES" && p.role === "werewolf";
      if (isWinner) {
        const rewardMoney = winnerTeam === "WEREWOLVES" ? 25e3 : 15e3;
        const rewardExp = winnerTeam === "WEREWOLVES" ? 150 : 100;
        user.money = (Number(user.money) || 0) + rewardMoney;
        user.exp = (Number(user.exp) || 0) + rewardExp;
      }
    }
  }
  saveDB();
  const playAgainBtn = [{
    name: "quick_reply",
    display_text: "🐺 Buat Room Baru",
    id: `${prefix}ww create`
  }];
  const canvasHtml = buildWerewolfCanvasHtml(game, `${winnerTeam} WIN`, game.dayCount, true);
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  await sendNeoxrWw(sock, ctx, game.groupId, winText, "Game Over", playAgainBtn, null, game.players.map(p => p.jid), buffer, url);
  return true;
}