import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const ROOMS = [{
  id: "reactor",
  name: "⚡ Reactor"
}, {
  id: "electrical",
  name: "💡 Electrical"
}, {
  id: "medbay",
  name: "🧪 MedBay"
}, {
  id: "navigation",
  name: "🧭 Navigation"
}, {
  id: "shields",
  name: "🛡️ Shields"
}, {
  id: "o2",
  name: "🌱 Oxygen"
}];
const SUIT_COLORS = [{
  name: "Red",
  hex: "#ef4444"
}, {
  name: "Blue",
  hex: "#3b82f6"
}, {
  name: "Green",
  hex: "#10b981"
}, {
  name: "Yellow",
  hex: "#f59e0b"
}, {
  name: "Purple",
  hex: "#8b5cf6"
}, {
  name: "Cyan",
  hex: "#06b6d4"
}, {
  name: "Pink",
  hex: "#ec4899"
}, {
  name: "Orange",
  hex: "#f97316"
}, {
  name: "White",
  hex: "#e2e8f0"
}, {
  name: "Black",
  hex: "#334155"
}];
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

function buildAmongUsCanvasHtml(game, statusText = "LOBBY RECRUITMENT", showRoles = false) {
  const botName = global.bot?.name || "WudysoftBot";
  const players = game?.players || [];
  const isEmergency = statusText.includes("EMERGENCY") || statusText.includes("BODY");
  const isTask = statusText.includes("TASK");
  const taskProgress = Math.min(100, Math.round((game?.totalTasksDone || 0) / Math.max(1, game?.totalTasksRequired || 1) * 100));
  const playersHtml = players.map((p, idx) => {
    let roleBadge = "CREWMATE";
    if (showRoles && p.role) {
      if (p.role === "impostor") roleBadge = "🔪 IMPOSTOR";
      else if (p.role === "sheriff") roleBadge = "🔫 SHERIFF";
      else if (p.role === "engineer") roleBadge = "🔧 ENGINEER";
      else roleBadge = "👨‍🚀 CREW";
    }
    return `
      <div class="crew-card ${p.isAlive ? "alive" : "dead"}">
        <div class="crew-avatar" style="--suit-color: ${p.color?.hex || "#3b82f6"};">
          <div class="visor"></div>
        </div>
        <div class="crew-details">
          <div class="crew-name">${idx + 1}. ${p.name ? p.name.slice(0, 10) : "Player"}</div>
          <div class="crew-status">${p.isAlive ? p.currentRoom ? p.currentRoom.toUpperCase() : "IN SHIP" : "DEAD 💀"}</div>
        </div>
        ${showRoles ? `<div class="role-pill ${p.role === "impostor" ? "imp" : ""}">${roleBadge}</div>` : ""}
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
        height: 520px;
        background: #04060a;
        font-family: 'Plus Jakarta Sans', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .spaceship-hud {
        width: 710px;
        height: 480px;
        background: radial-gradient(circle at 50% 20%, rgba(14, 165, 233, 0.2) 0%, rgba(5, 10, 20, 0.98) 85%);
        border: 2px solid #1e293b;
        border-radius: 20px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.85);
        padding: 22px 26px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .header-bar {
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
        background: #ef4444;
        color: #fff;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      }
      .brand-title {
        color: #f8fafc;
        font-size: 18px;
        font-weight: 900;
        letter-spacing: 1px;
      }
      .status-pill {
        border: 1px solid ${isEmergency ? "#ef4444" : "#0ea5e9"};
        color: ${isEmergency ? "#f87171" : "#38bdf8"};
        background: rgba(15, 23, 42, 0.85);
        padding: 4px 14px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }
      .task-container {
        background: #09101d;
        border: 1px solid #1e293b;
        border-radius: 10px;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .task-label {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        font-weight: 800;
        color: #94a3b8;
        letter-spacing: 1px;
      }
      .task-bar-bg {
        width: 100%;
        height: 12px;
        background: #1e293b;
        border-radius: 6px;
        overflow: hidden;
      }
      .task-bar-fill {
        width: ${taskProgress}%;
        height: 100%;
        background: linear-gradient(90deg, #10b981, #34d399);
        box-shadow: 0 0 10px #10b981;
      }
      .crew-roster {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px 12px;
        margin: 6px 0;
      }
      .crew-card {
        height: 48px;
        background: #0b1322;
        border: 1px solid #1e293b;
        border-radius: 10px;
        padding: 0 10px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .crew-card.dead {
        border-color: #7f1d1d;
        background: rgba(127, 29, 29, 0.2);
        opacity: 0.6;
      }
      .crew-avatar {
        width: 28px;
        height: 34px;
        background: var(--suit-color);
        border-radius: 10px 10px 4px 4px;
        position: relative;
        box-shadow: inset -2px 0 4px rgba(0,0,0,0.4);
      }
      .visor {
        position: absolute;
        top: 6px;
        right: -2px;
        width: 16px;
        height: 12px;
        background: #93c5fd;
        border-radius: 6px;
        border: 2px solid #1e293b;
      }
      .crew-details {
        flex: 1;
        overflow: hidden;
      }
      .crew-name {
        font-size: 13px;
        font-weight: 800;
        color: #f8fafc;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .crew-status {
        font-size: 10px;
        font-weight: 700;
        color: #38bdf8;
      }
      .crew-card.dead .crew-status {
        color: #ef4444;
      }
      .role-pill {
        font-size: 10px;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(0,0,0,0.5);
        color: #e2e8f0;
      }
      .role-pill.imp {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.2);
      }
      .footer-hud {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #1e293b;
        padding-top: 10px;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 700;
      }
      .footer-hud b {
        color: #38bdf8;
      }
    </style>
  </head>
  <body>
    <div class="spaceship-hud">
      <div class="header-bar">
        <div class="brand">
          <div class="brand-icon">🚀</div>
          <div class="brand-text">THE SKELD <span>AMONG US</span></div>
        </div>
        <div class="status-pill">${statusText}</div>
      </div>
      <div class="task-container">
        <div class="task-label">
          <div>TOTAL TASKS COMPLETED</div>
          <div style="color: #34d399;">${taskProgress}%</div>
        </div>
        <div class="task-bar-bg">
          <div class="task-bar-fill"></div>
        </div>
      </div>
      <div class="crew-roster">
        ${playersHtml}
      </div>
      <div class="footer-hud">
        <div>CREW SURVIVORS : <b>${players.filter(p => p.isAlive).length} / ${players.length} CREWMATE</b></div>
        <div>RONDE : <b>${game?.round || 1}</b></div>
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
  if (!global.db.amongus) global.db.amongus = {};
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
async function sendNeoxrAmongUs(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null, mentions = [], imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const defaultBanner = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : defaultBanner);
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Among Us The Skeld ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 3,
        divider_indices: [2],
        list_title: `${botName} • Aksi Pesawat`,
        button_title: "🚀 Menu Aksi"
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
      console.error("[AmongUs ctx.sendCta Error]:", e.message);
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
  name: "amongus",
  aliases: ["amg", "impostor", "crewmate", "skeld"],
  description: "Game sosial deduksi panjang Among Us (Crewmate vs Impostor) dengan aksi rahasia di PC & canvas realistis bertema Neoxr",
  category: "Game",
  limit: false,
  example: "amongus create (buka room) | amongus join (gabung) | amongus start (mulai)",
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
        const gameEntry = Object.entries(global.db.amongus).find(([_, g]) => g.status === "TASKS" && g.players.some(p => p.jid === senderJid && p.isAlive));
        if (!gameEntry) return;
        const [groupId, game] = gameEntry;
        const player = game.players.find(p => p.jid === senderJid);
        if (!player || !player.isAlive) return;
        const prefix = ctx?.prefix || ".";
        if (userText.startsWith(prefix)) return;
        return await handlePlayerRoomChoice(sock, ctx, groupId, senderJid, userText);
      }
      if (isGroup) {
        const groupId = ctx.id;
        const game = global.db.amongus[groupId];
        if (!game || game.status !== "MEETING") return;
        const voter = game.players.find(p => p.jid === senderJid);
        if (!voter || !voter.isAlive) return;
        const prefix = ctx?.prefix || ".";
        if (userText.startsWith(prefix)) return;
        const targetVoteNum = parseInt(userText);
        if (!isNaN(targetVoteNum)) {
          return await processMeetingVote(sock, ctx, groupId, senderJid, targetVoteNum);
        }
      }
    } catch (err) {
      console.error("[AMONG US BEFORE ERROR]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      const botName = global.bot?.name || "WudysoftBot";
      const footerText = `${global.bot?.footer || botName}`;
      const prefix = ctx?.prefix || ".";
      const senderJid = ctx?.sender || msg?.key?.participant;
      const senderName = ctx?.pushName || ctx?.pushname || "Crewmate";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const args = ctx?.args || [];
      const subCommand = (args[0] || "").trim().toLowerCase();
      initDB(senderJid, senderName);
      if (!isGroup) {
        if (["room", "pilih", "kill", "task"].includes(subCommand)) {
          const gameEntry = Object.entries(global.db.amongus).find(([_, g]) => g.status === "TASKS" && g.players.some(p => p.jid === senderJid && p.isAlive));
          if (!gameEntry) {
            return ctx.reply("⚠️ Kamu sedang tidak berada dalam sesi aksi kapal The Skeld.");
          }
          const [groupId] = gameEntry;
          const choiceInput = args[1] || "";
          return await handlePlayerRoomChoice(sock, ctx, groupId, senderJid, choiceInput);
        }
        return ctx.reply("❌ *Game Among Us hanya dapat dimulai di dalam Grup!*");
      }
      const groupId = ctx.id;
      if (["join", "gabung", "ikut"].includes(subCommand)) {
        if (!global.db.amongus[groupId]) {
          return ctx.reply(`⚠️ Belum ada lobby The Skeld yang dibuka. Ketik \`${prefix}amongus create\` untuk membuka room!`);
        }
        const game = global.db.amongus[groupId];
        if (game.status !== "LOBBY") {
          return ctx.reply("⚠️ Pesawat luar angkasa The Skeld sudah lepas landas!");
        }
        if (game.players.some(p => p.jid === senderJid)) {
          return ctx.reply("⚠️ Kamu sudah terdaftar di dalam kru kapal!");
        }
        if (game.players.length >= 10) {
          return ctx.reply("⚠️ Kapasitas pesawat (10 kru) telah penuh!");
        }
        const assignedColor = SUIT_COLORS[game.players.length] || SUIT_COLORS[0];
        game.players.push({
          jid: senderJid,
          name: senderName,
          color: assignedColor,
          role: null,
          isAlive: true,
          currentRoom: null,
          votedFor: null,
          tasksDone: 0
        });
        saveDB();
        await ctx.react("✅");
        const joinNotif = `Hi ${senderName}!
Kamu berhasil bergabung ke armada pesawat The Skeld.

–  *C R E W  U P D A T E*

┌  ◦  *Kru Baru* : @${senderJid.split("@")[0]} (${assignedColor.name} Suit)
└  ◦  *Total Kru* : ${game.players.length} / 10

_Minimal 4 pemain untuk lepas landas. Ketik \`${prefix}amongus start\` jika sudah siap!_`;
        return await sock.sendMessage(groupId, {
          text: joinNotif,
          mentions: [senderJid]
        }, {
          quoted: quotedMsg
        });
      }
      if (["start", "mulai"].includes(subCommand)) {
        if (!global.db.amongus[groupId]) {
          return ctx.reply(`⚠️ Buat room terlebih dahulu dengan mengetik \`${prefix}amongus create\``);
        }
        const game = global.db.amongus[groupId];
        if (game.status !== "LOBBY") {
          return ctx.reply("⚠️ Game sudah dimulai!");
        }
        if (game.players.length < 4) {
          return ctx.reply(`❌ Kru belum mencukupi! Minimal 4 kru untuk memulai ekspedisi. (Saat ini: ${game.players.length} kru)`);
        }
        return await startSpaceshipGame(sock, ctx, groupId);
      }
      if (["emergency", "meet", "meeting"].includes(subCommand)) {
        const game = global.db.amongus[groupId];
        if (!game || game.status !== "TASKS") {
          return ctx.reply("⚠️ Tombol Emergency Meeting hanya dapat ditekan saat fase task!");
        }
        const caller = game.players.find(p => p.jid === senderJid);
        if (!caller || !caller.isAlive) {
          return ctx.reply("❌ Kamu bukan kru yang masih hidup!");
        }
        return await triggerEmergencyMeeting(sock, ctx, groupId, `@${caller.jid.split("@")[0]} menekan tombol DARURAT (Emergency Meeting)!`);
      }
      if (["vote", "pilih"].includes(subCommand)) {
        const game = global.db.amongus[groupId];
        if (!game || game.status !== "MEETING") {
          return ctx.reply("⚠️ Sesi voting pengeluaran kru (ejection) belum dibuka.");
        }
        const voter = game.players.find(p => p.jid === senderJid);
        if (!voter || !voter.isAlive) {
          return ctx.reply("❌ Kamu bukan kru hidup yang berhak memberikan suara.");
        }
        const targetNum = parseInt(args[1]);
        if (isNaN(targetNum)) {
          return ctx.reply(`⚠️ Masukkan nomor kru target! Contoh: \`${prefix}amongus vote 2\``);
        }
        return await processMeetingVote(sock, ctx, groupId, senderJid, targetNum);
      }
      if (["stop", "cancel", "batal", "delete"].includes(subCommand)) {
        if (!global.db.amongus[groupId]) {
          return ctx.reply("⚠️ Tidak ada ekspedisi The Skeld yang sedang aktif.");
        }
        const game = global.db.amongus[groupId];
        if (game.host !== senderJid) {
          return ctx.reply("❌ Hanya kapten pembuat room yang berhak membatalkan permainan.");
        }
        delete global.db.amongus[groupId];
        saveDB();
        return ctx.reply("🛑 Ekspedisi pesawat The Skeld berhasil dibatalkan.");
      }
      if (global.db.amongus[groupId]) {
        const game = global.db.amongus[groupId];
        if (game.status === "LOBBY") {
          return ctx.reply(`⚠️ Lobby sudah terbuka! Ketik \`${prefix}amongus join\` untuk bergabung (${game.players.length} kru).`);
        }
        return ctx.reply("⚠️ Masih ada game Among Us yang sedang berlangsung di grup ini!");
      }
      await ctx.react("🚀");
      const assignedColor = SUIT_COLORS[0];
      global.db.amongus[groupId] = {
        groupId: groupId,
        host: senderJid,
        status: "LOBBY",
        round: 1,
        totalTasksDone: 0,
        totalTasksRequired: 12,
        expireTime: Date.now() + 60 * 1e3,
        players: [{
          jid: senderJid,
          name: senderName,
          color: assignedColor,
          role: null,
          isAlive: true,
          currentRoom: null,
          votedFor: null,
          tasksDone: 0
        }],
        roundKills: []
      };
      saveDB();
      const buttons = [{
        name: "quick_reply",
        display_text: "👨‍🚀 Join Game",
        id: `${prefix}amongus join`
      }, {
        name: "quick_reply",
        display_text: "🚀 Lepas Landas",
        id: `${prefix}amongus start`
      }, {
        name: "quick_reply",
        display_text: "🛑 Batal",
        id: `${prefix}amongus stop`
      }];
      const lobbyText = `Hi Survivors!
Pintu palka pesawat The Skeld telah dibuka untuk ekspedisi luar angkasa!

–  *L O B B Y  T H E  S K E L D*

┌  ◦  *Kapten Host* : @${senderJid.split("@")[0]}
│  ◦  *Kapasitas* : 4 - 10 Kru
└  ◦  *Status* : Menunggu Kru Bergabung

–  *D A F T A R  K R U*

┌  ◦  [1] @${senderJid.split("@")[0]} (${assignedColor.name} Suit)

_Waspadalah! Salah satu di antara kita mungkin adalah Impostor..._`;
      const canvasHtml = buildAmongUsCanvasHtml(global.db.amongus[groupId], "LOBBY RECRUITMENT");
      const {
        buffer,
        url
      } = await renderHtmlToImage(canvasHtml);
      await sendNeoxrAmongUs(sock, ctx, groupId, lobbyText, footerText, buttons, quotedMsg, [senderJid], buffer, url);
    } catch (e) {
      console.error("[AMONG US ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};
async function startSpaceshipGame(sock, ctx, groupId) {
  initDB();
  const game = global.db.amongus[groupId];
  if (!game) return;
  const count = game.players.length;
  let roles = [];
  if (count === 4) {
    roles = ["impostor", "sheriff", "crewmate", "crewmate"];
  } else if (count === 5) {
    roles = ["impostor", "sheriff", "engineer", "crewmate", "crewmate"];
  } else if (count <= 7) {
    roles = ["impostor", "impostor", "sheriff", "engineer"];
    while (roles.length < count) roles.push("crewmate");
  } else {
    roles = ["impostor", "impostor", "sheriff", "engineer", "engineer"];
    while (roles.length < count) roles.push("crewmate");
  }
  roles = roles.sort(() => Math.random() - .5);
  game.players.forEach((p, idx) => {
    p.role = roles[idx];
  });
  game.totalTasksRequired = count * 3;
  saveDB();
  for (const p of game.players) {
    let roleTitle = "";
    let roleDesc = "";
    if (p.role === "impostor") {
      roleTitle = "🔪 IMPOSTOR (Penyusup)";
      roleDesc = "Bunuh para kru di ruangan yang sepi dan lakukan sabotase tanpa ketahuan!";
    } else if (p.role === "sheriff") {
      roleTitle = "🔫 SHERIFF (Penegak Hukum)";
      roleDesc = "Kamu memiliki pistol! Bunuh orang yang kamu curigai sebagai Impostor (Hati-hati: menembak kru polos akan mengeliminasimu!).";
    } else if (p.role === "engineer") {
      roleTitle = "🔧 ENGINEER (Teknisi)";
      roleDesc = "Kamu dapat menggunakan ventilasi ruangan dan menyelesaikan tugas 2x lebih cepat.";
    } else {
      roleTitle = "👨‍🚀 CREWMATE (Kru Polos)";
      roleDesc = "Selesaikan seluruh task kapal dan cari tahu siapa penyusup di Emergency Meeting!";
    }
    const pcRoleText = `Hi ${p.name}!
Peran rahasiamu dalam misi The Skeld telah ditentukan.

–  *S E C R E T  I D E N T I T Y*

┌  ◦  *Peran* : ${roleTitle}
└  ◦  *Instruksi* : ${roleDesc}

_Jaga rahasiamu dan selesaikan misi pesawat sekarang!_`;
    await sock.sendMessage(p.jid, {
      text: pcRoleText
    }).catch(() => {});
  }
  await sock.sendMessage(game.groupId, {
    text: `🚀 *Pesawat The Skeld lepas landas!* Peran rahasia telah dikirimkan ke Private Chat masing-masing pemain.`,
    mentions: game.players.map(p => p.jid)
  });
  await enterTaskPhase(sock, ctx, groupId);
}
async function enterTaskPhase(sock, ctx, groupId) {
  initDB();
  const game = global.db.amongus[groupId];
  if (!game) return;
  game.status = "TASKS";
  game.expireTime = Date.now() + 60 * 1e3;
  game.roundKills = [];
  game.players.forEach(p => {
    p.currentRoom = null;
    p.votedFor = null;
  });
  saveDB();
  const alivePlayers = game.players.filter(p => p.isAlive);
  const prefix = ctx?.prefix || ".";
  const taskPhaseText = `Hi Survivors!
Fase Task Ronde #${game.round} dimulai! Seluruh kru kapal menyebar... 🧭

–  *T A S K  P H A S E*

┌  ◦  *Waktu Bergerak* : 60 Detik
│  ◦  *Ruangan Tersedia* : 6 Sektor Kapal
└  ◦  *Aksi PC* : Buka Private Chat bot untuk memilih ruangan tujuan

_Waspadalah saat berada sendirian di ruangan sepi!_`;
  const canvasHtml = buildAmongUsCanvasHtml(game, `ROUND ${game.round} - TASK PHASE`);
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  await sendNeoxrAmongUs(sock, ctx, game.groupId, taskPhaseText, "Waktu Sesi: 60s", [{
    name: "quick_reply",
    display_text: "🚨 Emergency Meeting",
    id: `${prefix}amongus emergency`
  }], null, alivePlayers.map(p => p.jid), buffer, url);
  for (const p of alivePlayers) {
    const buttons = ROOMS.map(r => ({
      name: "quick_reply",
      display_text: r.name,
      id: `${prefix}amongus room ${r.id}`
    }));
    const pcMsg = `Hi ${p.name}!\nPilih ruangan tujuan untuk menjalankan tugas atau mengintai target:\n\n` + ROOMS.map((r, i) => `┌  ◦  [${i + 1}] ${r.name}`).join("\n") + `\n\n_Ketuk tombol di bawah atau balas dengan nama/nomor ruangan!_`;
    await sendNeoxrAmongUs(sock, ctx, p.jid, pcMsg, "Pilih Ruangan Skeld", buttons);
  }
  setTimeout(async () => {
    initDB();
    if (global.db.amongus[groupId]?.status === "TASKS" && Date.now() >= global.db.amongus[groupId].expireTime) {
      await resolveTaskPhase(sock, ctx, groupId);
    }
  }, 60 * 1e3);
}
async function handlePlayerRoomChoice(sock, ctx, groupId, playerJid, input) {
  initDB();
  const game = global.db.amongus[groupId];
  if (!game || game.status !== "TASKS") return;
  const player = game.players.find(p => p.jid === playerJid);
  if (!player || !player.isAlive) return;
  const matchedRoom = ROOMS.find(r => r.id === input || r.name.toLowerCase().includes(input) || input.includes(r.id));
  if (!matchedRoom) {
    return ctx.reply("⚠️ Ruangan tidak valid! Pilih: Reactor, Electrical, MedBay, Navigation, Shields, atau Oxygen.");
  }
  player.currentRoom = matchedRoom.id;
  player.tasksDone += player.role === "engineer" ? 2 : 1;
  game.totalTasksDone += player.role === "engineer" ? 2 : 1;
  saveDB();
  await ctx.reply(`🚀 Kamu telah memasuki ruangan *${matchedRoom.name}* dan menyelesaikan tugas!`);
  const alivePlayers = game.players.filter(p => p.isAlive);
  const allMoved = alivePlayers.every(p => p.currentRoom !== null);
  if (allMoved) {
    await resolveTaskPhase(sock, ctx, groupId);
  }
}
async function resolveTaskPhase(sock, ctx, groupId) {
  initDB();
  const game = global.db.amongus[groupId];
  if (!game) return;
  const alivePlayers = game.players.filter(p => p.isAlive);
  const impostors = alivePlayers.filter(p => p.role === "impostor");
  let deadVictims = [];
  for (const imp of impostors) {
    if (!imp.currentRoom) continue;
    const targetsInSameRoom = alivePlayers.filter(p => p.isAlive && p.currentRoom === imp.currentRoom && p.role !== "impostor");
    if (targetsInSameRoom.length > 0) {
      const victim = targetsInSameRoom[Math.floor(Math.random() * targetsInSameRoom.length)];
      victim.isAlive = false;
      deadVictims.push({
        victim: victim,
        room: imp.currentRoom
      });
    }
  }
  saveDB();
  if (await checkAmongUsWin(sock, ctx, groupId)) return;
  if (deadVictims.length > 0) {
    const reportNotice = deadVictims.map(d => `💀 *DEAD BODY FOUND!* Mayat @${d.victim.jid.split("@")[0]} ditemukan di ruangan *${d.room.toUpperCase()}*!`).join("\n");
    return await triggerEmergencyMeeting(sock, ctx, groupId, reportNotice, deadVictims.map(d => d.victim.jid));
  }
  game.round++;
  saveDB();
  await enterTaskPhase(sock, ctx, groupId);
}
async function triggerEmergencyMeeting(sock, ctx, groupId, reasonText, mentionsExtra = []) {
  initDB();
  const game = global.db.amongus[groupId];
  if (!game) return;
  game.status = "MEETING";
  game.expireTime = Date.now() + 60 * 1e3;
  game.players.forEach(p => p.votedFor = null);
  saveDB();
  const alivePlayers = game.players.filter(p => p.isAlive);
  const prefix = ctx?.prefix || ".";
  const meetingText = `Hi Survivors!
Sirene darurat berbunyi keras di seluruh penjuru pesawat! 🚨

–  *E M E R G E N C Y  M E E T I N G*

${reasonText}

–  *K R U  H I D U P  (V O T I N G)*

${alivePlayers.map((p, idx) => `┌  ◦  [${idx + 1}] @${p.jid.split("@")[0]}`).join("\n")}

_Diskusikan siapa penyusupnya dan balas pesan ini dengan nomor kru yang ingin kamu eject!_`;
  const buttons = alivePlayers.map((p, idx) => ({
    name: "quick_reply",
    display_text: `${idx + 1}. Eject @${p.jid.split("@")[0]}`,
    id: `${prefix}amongus vote ${idx + 1}`
  }));
  const allMentions = [...new Set([...alivePlayers.map(p => p.jid), ...mentionsExtra])];
  const canvasHtml = buildAmongUsCanvasHtml(game, "EMERGENCY MEETING");
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  await sendNeoxrAmongUs(sock, ctx, game.groupId, meetingText, "Waktu Diskusi & Vote: 60s", buttons, null, allMentions, buffer, url);
  setTimeout(async () => {
    initDB();
    if (global.db.amongus[groupId]?.status === "MEETING" && Date.now() >= global.db.amongus[groupId].expireTime) {
      await resolveMeetingVoting(sock, ctx, groupId);
    }
  }, 60 * 1e3);
}
async function processMeetingVote(sock, ctx, groupId, voterJid, targetNum) {
  initDB();
  const game = global.db.amongus[groupId];
  if (!game || game.status !== "MEETING") return;
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
  await ctx.reply(`🗳️ @${voter.jid.split("@")[0]} memilih untuk mengeluarkan @${target.jid.split("@")[0]} (${totalVoted}/${alivePlayers.length} suara)`, {
    mentions: [voter.jid, target.jid]
  });
  if (totalVoted >= alivePlayers.length) {
    await resolveMeetingVoting(sock, ctx, groupId);
  }
}
async function resolveMeetingVoting(sock, ctx, groupId) {
  initDB();
  const game = global.db.amongus[groupId];
  if (!game) return;
  const alivePlayers = game.players.filter(p => p.isAlive);
  const voteCounts = {};
  alivePlayers.forEach(p => {
    if (p.votedFor) {
      voteCounts[p.votedFor] = (voteCounts[p.votedFor] || 0) + 1;
    }
  });
  let maxVotes = 0;
  let ejectedJid = null;
  let isTie = false;
  for (const [jid, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      ejectedJid = jid;
      isTie = false;
    } else if (count === maxVotes) {
      isTie = true;
    }
  }
  if (!ejectedJid || isTie || maxVotes === 0) {
    await sock.sendMessage(game.groupId, {
      text: `⚖️ Suara seimbang (Tie)! Tidak ada kru yang dikeluarkan dari pesawat (Skipped).`
    });
  } else {
    const ejectedPlayer = game.players.find(p => p.jid === ejectedJid);
    if (ejectedPlayer) {
      ejectedPlayer.isAlive = false;
      saveDB();
      const isImp = ejectedPlayer.role === "impostor";
      await sock.sendMessage(game.groupId, {
        text: `🚀 @${ejectedPlayer.jid.split("@")[0]} telah di-eject ke luar angkasa!\n${isImp ? "🔴 *Dia adalah seorang IMPOSTOR!*" : "⚪ *Dia BUKAN seorang Impostor.*"}`,
        mentions: [ejectedPlayer.jid]
      });
    }
  }
  if (await checkAmongUsWin(sock, ctx, groupId)) return;
  game.round++;
  saveDB();
  await enterTaskPhase(sock, ctx, groupId);
}
async function checkAmongUsWin(sock, ctx, groupId) {
  initDB();
  const game = global.db.amongus[groupId];
  if (!game) return false;
  const alive = game.players.filter(p => p.isAlive);
  const impostors = alive.filter(p => p.role === "impostor");
  const crewmates = alive.filter(p => p.role !== "impostor");
  let winnerTeam = null;
  if (impostors.length === 0) {
    winnerTeam = "CREWMATES";
  } else if (impostors.length >= crewmates.length) {
    winnerTeam = "IMPOSTORS";
  } else if (game.totalTasksDone >= game.totalTasksRequired) {
    winnerTeam = "CREWMATES";
  }
  if (!winnerTeam) return false;
  delete global.db.amongus[groupId];
  saveDB();
  const prefix = ctx?.prefix || ".";
  let winText = "";
  if (winnerTeam === "CREWMATES") {
    winText = `Hi Survivors!
Kemenangan bagi Kru Kapal The Skeld! 🎉

–  *C R E W M A T E S  V I C T O R Y*

┌  ◦  *Pemenang* : Crewmates & Penegak Hukum
└  ◦  *Reward* : +Rp 20.000 | +120 EXP / Pemain`;
  } else {
    winText = `Hi Survivors!
Penyusup berhasil menguasai pesawat The Skeld! 🔪

–  *I M P O S T O R S  V I C T O R Y*

┌  ◦  *Pemenang* : Impostor Team
└  ◦  *Reward* : +Rp 30.000 | +180 EXP / Pemain`;
  }
  winText += `\n\n–  *F I N A L  C R E W  R O L E S*\n\n`;
  game.players.forEach((p, idx) => {
    let rName = "👨‍🚀 Crewmate";
    if (p.role === "impostor") rName = "🔪 Impostor";
    if (p.role === "sheriff") rName = "🔫 Sheriff";
    if (p.role === "engineer") rName = "🔧 Engineer";
    winText += `┌  ◦  [${idx + 1}] @${p.jid.split("@")[0]} : ${rName} (${p.isAlive ? "Selamat" : "Gugur"})\n`;
  });
  for (const p of game.players) {
    initDB(p.jid, p.name);
    const user = global.db.user[p.jid];
    if (user) {
      const isWinner = winnerTeam === "CREWMATES" && p.role !== "impostor" || winnerTeam === "IMPOSTORS" && p.role === "impostor";
      if (isWinner) {
        const rewardMoney = winnerTeam === "IMPOSTORS" ? 3e4 : 2e4;
        const rewardExp = winnerTeam === "IMPOSTORS" ? 180 : 120;
        user.money = (Number(user.money) || 0) + rewardMoney;
        user.exp = (Number(user.exp) || 0) + rewardExp;
      }
    }
  }
  saveDB();
  const canvasHtml = buildAmongUsCanvasHtml(game, `${winnerTeam} WIN!`, true);
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  await sendNeoxrAmongUs(sock, ctx, game.groupId, winText, "Mission Concluded", [{
    name: "quick_reply",
    display_text: "🚀 Misi Baru",
    id: `${prefix}amongus create`
  }], null, game.players.map(p => p.jid), buffer, url);
  return true;
}