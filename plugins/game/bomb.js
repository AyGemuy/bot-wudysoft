import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const WIRE_COLORS = [{
  id: "merah",
  num: "1",
  name: "🔴 Kabel Merah",
  hex: "#ff2a2a"
}, {
  id: "biru",
  num: "2",
  name: "🔵 Kabel Biru",
  hex: "#00a2ff"
}, {
  id: "hijau",
  num: "3",
  name: "🟢 Kabel Hijau",
  hex: "#00e676"
}, {
  id: "kuning",
  num: "4",
  name: "🟡 Kabel Kuning",
  hex: "#ffd600"
}, {
  id: "putih",
  num: "5",
  name: "⚪ Kabel Putih",
  hex: "#eceff1"
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

function buildBombCanvasHtml(game, statusText = "ARMED", timerSeconds = 60) {
  const cutList = game?.cutWires || [];
  const isExploded = statusText === "EXPLODED" || statusText === "TIMEOUT";
  const isDefused = statusText === "DEFUSED";
  const displayTime = isExploded ? "88:88" : isDefused ? "00:00" : `00:${String(timerSeconds).padStart(2, "0")}`;
  const displayColor = isExploded ? "#ff2a44" : isDefused ? "#00e676" : "#ff5252";
  const bgOverlay = isExploded ? "radial-gradient(circle at center, rgba(255, 42, 68, 0.45) 0%, rgba(13, 10, 12, 0.98) 85%)" : isDefused ? "radial-gradient(circle at center, rgba(0, 230, 118, 0.3) 0%, rgba(9, 15, 12, 0.98) 85%)" : "radial-gradient(circle at center, rgba(30, 41, 59, 0.6) 0%, rgba(11, 14, 20, 0.98) 85%)";
  const wiresHtml = WIRE_COLORS.map(w => {
    const isCut = cutList.includes(w.id);
    return `
      <div class="wire-channel">
        <div class="terminal top"></div>
        <div class="wire-body ${isCut ? "cut" : ""}" style="--wire-color: ${w.hex};">
          ${isCut ? '<div class="spark">⚡</div>' : ""}
        </div>
        <div class="terminal btm"></div>
        <div class="wire-label">${w.num}</div>
      </div>
    `;
  }).join("");
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@600;700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 750px;
        height: 500px;
        background: #090b0e;
        font-family: 'Rajdhani', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .scene {
        position: relative;
        width: 710px;
        height: 460px;
        background: ${bgOverlay};
        border-radius: 18px;
        border: 2px solid #242c38;
        box-shadow: 0 25px 60px rgba(0,0,0,0.85);
        padding: 24px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .c4-packs {
        position: absolute;
        top: 20px;
        left: 20px;
        right: 20px;
        height: 110px;
        display: flex;
        gap: 15px;
        z-index: 1;
      }
      .brick {
        flex: 1;
        background: linear-gradient(135deg, #8c6743 0%, #54391e 100%);
        border-radius: 8px;
        box-shadow: inset 0 0 15px rgba(0,0,0,0.65), 0 6px 12px rgba(0,0,0,0.4);
        border: 1px solid #412c17;
        position: relative;
        overflow: hidden;
      }
      .brick::after {
        content: "C-4 HIGH EXPLOSIVE • COMP-B";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 2px;
        color: rgba(15, 10, 5, 0.4);
        white-space: nowrap;
      }
      .tape {
        position: absolute;
        width: 100%;
        height: 22px;
        background: #141414;
        box-shadow: 0 2px 4px rgba(0,0,0,0.5);
      }
      .tape-top { top: 18px; }
      .tape-btm { bottom: 18px; }
      .device-core {
        position: relative;
        z-index: 2;
        margin-top: 45px;
        background: #13171f;
        border-radius: 12px;
        border: 1px solid #232b38;
        box-shadow: 0 10px 30px rgba(0,0,0,0.8);
        padding: 16px 22px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .timer-box {
        background: #07090c;
        padding: 10px 24px;
        border-radius: 8px;
        border: 1px solid #1f2733;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .timer-display {
        font-family: 'Orbitron', monospace;
        font-size: 42px;
        font-weight: 900;
        color: ${displayColor};
        letter-spacing: 4px;
        text-shadow: 0 0 16px ${displayColor};
      }
      .status-badge {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 3px;
        text-transform: uppercase;
        color: ${displayColor};
        margin-top: -3px;
      }
      .info-box {
        text-align: right;
        color: #94a3b8;
        font-size: 15px;
        line-height: 1.4;
      }
      .info-box b {
        color: #f8fafc;
        font-size: 16px;
      }
      .wires-bay {
        position: relative;
        z-index: 2;
        background: #10141b;
        border-radius: 12px;
        border: 1px solid #1c232f;
        padding: 14px 20px;
        display: flex;
        justify-content: space-around;
        align-items: center;
        box-shadow: inset 0 0 15px rgba(0,0,0,0.7);
      }
      .wire-channel {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }
      .terminal {
        width: 20px;
        height: 10px;
        background: linear-gradient(90deg, #d4af37, #997310);
        border-radius: 2px;
      }
      .wire-body {
        width: 14px;
        height: 75px;
        background: var(--wire-color);
        border-radius: 6px;
        box-shadow: inset -2px 0 4px rgba(0,0,0,0.4), inset 2px 0 4px rgba(255,255,255,0.4), 0 0 8px var(--wire-color);
        position: relative;
      }
      .wire-body.cut {
        background: transparent;
        box-shadow: none;
      }
      .wire-body.cut::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 14px;
        height: 22px;
        background: var(--wire-color);
        border-radius: 6px 6px 2px 2px;
      }
      .wire-body.cut::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 0;
        width: 14px;
        height: 22px;
        background: var(--wire-color);
        border-radius: 2px 2px 6px 6px;
      }
      .spark {
        position: absolute;
        top: 28px;
        left: -2px;
        font-size: 15px;
        color: #ffeb3b;
        filter: drop-shadow(0 0 4px #ff9800);
      }
      .wire-label {
        font-size: 13px;
        font-weight: 700;
        color: #64748b;
      }
    </style>
  </head>
  <body>
    <div class="scene">
      <div class="c4-packs">
        <div class="brick"><div class="tape tape-top"></div><div class="tape tape-btm"></div></div>
        <div class="brick"><div class="tape tape-top"></div><div class="tape tape-btm"></div></div>
        <div class="brick"><div class="tape tape-top"></div><div class="tape tape-btm"></div></div>
      </div>
      <div class="device-core">
        <div class="timer-box">
          <div class="timer-display">${displayTime}</div>
          <div class="status-badge">${statusText}</div>
        </div>
        <div class="info-box">
          <div>TERRORIST : <b>${game?.planterName || "Secret"}</b></div>
          <div>BET POOL : <b style="color: #4ade80;">Rp ${(game?.bet ? game.bet * 2 : 0).toLocaleString()}</b></div>
          <div>CIRCUIT : <b>5 MODULAR WIRES</b></div>
        </div>
      </div>
      <div class="wires-bay">
        ${wiresHtml}
      </div>
    </div>
  </body>
  </html>
  `;
}

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.bombs) global.db.bombs = {};
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
async function sendNeoxrBomb(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null, mentions = [], imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const defaultBanner = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : defaultBanner);
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Bomb Defusal Arena ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 3,
        divider_indices: [2],
        list_title: `${botName} • Bomb Wire Controls`,
        button_title: "✂️ Potong Kabel"
      }
    },
    contextInfo: {
      mentionedJid: mentions,
      forwardingScore: 999,
      isForwarded: true
    },
    quoted: quoted || undefined
  };
  if (typeof ctx?.sendCta === "function" && targetJid === ctx.id) {
    try {
      return await ctx.sendCta(bodyText, footerText, buttons, options);
    } catch (e) {
      console.error("[sendNeoxrBomb ctx.sendCta error]:", e.message);
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
  } catch (e) {
    console.error("[sendNeoxrBomb native interactive error]:", e.message);
  }
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
async function applyWireSetup(sock, ctx, groupId, wireInput) {
  initDB();
  const game = global.db.bombs[groupId];
  if (!game || game.status !== "SETTING_UP") return;
  const matchedWire = WIRE_COLORS.find(w => w.id === wireInput || w.num === wireInput || wireInput.includes(w.id) || wireInput.includes(w.name.toLowerCase()));
  if (!matchedWire) {
    return ctx.reply("⚠️ Pilihan kabel tidak valid! Ketik angka 1 - 5 atau nama warnanya.");
  }
  game.detonateWire = matchedWire.id;
  const remainingWires = WIRE_COLORS.filter(w => w.id !== matchedWire.id);
  game.defuseWire = remainingWires[Math.floor(Math.random() * remainingWires.length)].id;
  game.status = "ARMED";
  game.expireTime = Date.now() + 60 * 1e3;
  saveDB();
  if (typeof ctx?.react === "function") await ctx.react("💣");
  const successText = `Hi ${game.planterName}!
Bom berhasil kamu pasang dan telah aktif di grup.

–  *D E T O N A T O R  S E T U P*

┌  ◦  *Kabel Detonator* : ${matchedWire.name}
│  ◦  *Durasi Timer* : 60 Detik
│  ◦  *Taruhan* : Rp ${(game.bet || 0).toLocaleString()}
└  ◦  *Status* : Siap Meledak

_Pantau grup dan biarkan anggota lain mencoba menjinakkannya!_`;
  await ctx.reply(successText);
  return await armBombInGroup(sock, ctx, groupId);
}
export default {
  name: "bomb",
  aliases: ["bom", "defuse", "pasangbom"],
  description: "Pasang bom rahasia dengan tema Neoxr dan visual canvas realistis",
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
        const setupEntry = Object.entries(global.db.bombs).find(([_, g]) => g.status === "SETTING_UP" && g.planterJid === senderJid);
        if (!setupEntry) return;
        const [groupId, game] = setupEntry;
        if (Date.now() > game.expireTime) {
          delete global.db.bombs[groupId];
          saveDB();
          return ctx.reply("⌛ Waktu penyetelan kabel bom di private chat telah habis.");
        }
        const prefix = ctx?.prefix || ".";
        if (userText.startsWith(prefix)) return;
        return await applyWireSetup(sock, ctx, groupId, userText);
      }
      if (isGroup) {
        const groupId = ctx.id;
        const game = global.db.bombs[groupId];
        if (!game || game.status !== "ARMED") return;
        if (Date.now() > game.expireTime) {
          delete global.db.bombs[groupId];
          saveDB();
          await distributeReward(game.planterJid, game.planterName, null, null, game.bet, "timeout");
          const bombHtml = buildBombCanvasHtml(game, "TIMEOUT", 0);
          const {
            buffer,
            url
          } = await renderHtmlToImage(bombHtml);
          const timeOutText = `Hi All!
Waktu defuse telah habis! DUAAARRRRR! 💥💥

–  *B O M B  E X P L O D E D*

┌  ◦  *Winner* : @${game.planterJid.split("@")[0]}
│  ◦  *Defuse Cable* : ${WIRE_COLORS.find(w => w.id === game.defuseWire)?.name}
└  ◦  *Status* : Kehabisan Waktu (60s)

_Bom meledak dan pemasang bom memenangkan sesi ini._`;
          const footerText = `${global.bot?.footer || global.bot?.name || "WudysoftBot"}`;
          await sendNeoxrBomb(sock, ctx, groupId, timeOutText, footerText, [{
            name: "quick_reply",
            display_text: "💣 Pasang Bom Baru",
            id: `${ctx?.prefix || "."}bomb`
          }], null, [game.planterJid], buffer, url);
          return;
        }
        const prefix = ctx?.prefix || ".";
        if (userText.startsWith(prefix)) return;
        const matchedWire = WIRE_COLORS.find(w => w.id === userText || w.num === userText || userText.includes(w.id) || userText.includes(w.name.toLowerCase()));
        if (!matchedWire) return;
        const senderName = ctx?.pushname || ctx?.pushName || "Penjinak";
        const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
        await handleCutWire(sock, ctx, groupId, matchedWire.id, senderJid, senderName, prefix, quotedMsg);
        return true;
      }
    } catch (err) {
      console.error("[BOMB BEFORE ERROR]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      const botName = global.bot?.name || "WudysoftBot";
      const footerText = `${global.bot?.footer || botName}`;
      const prefix = ctx?.prefix || ".";
      const senderJid = ctx?.sender || msg?.key?.participant;
      const senderName = ctx?.pushname || ctx?.pushName || senderJid.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const args = ctx?.args || [];
      const subCommand = (args[0] || "").trim().toLowerCase();
      initDB(senderJid, senderName);
      if (!isGroup) {
        if (subCommand === "set") {
          const setupEntry = Object.entries(global.db.bombs).find(([_, g]) => g.status === "SETTING_UP" && g.planterJid === senderJid);
          if (!setupEntry) {
            return ctx.reply("❌ Sesi penyetelan kabel tidak ditemukan atau sudah kedaluwarsa.");
          }
          const [groupId] = setupEntry;
          const targetWire = (args[1] || "").trim().toLowerCase();
          return await applyWireSetup(sock, ctx, groupId, targetWire);
        }
        return ctx.reply("❌ *Fitur ini hanya dapat dijalankan di dalam Grup!*");
      }
      const groupId = ctx.id;
      const userData = global.db.user[senderJid];
      if (subCommand === "cut" || subCommand === "potong") {
        const game = global.db.bombs[groupId];
        if (!game || game.status !== "ARMED") {
          return ctx.reply("⚠️ Tidak ada bom aktif yang siap dijinakkan di grup ini.");
        }
        const targetWire = (args[1] || "").trim().toLowerCase();
        return await handleCutWire(sock, ctx, groupId, targetWire, senderJid, senderName, prefix, quotedMsg);
      }
      if (["surrender", "nyerah", "batal", "cancel"].includes(subCommand)) {
        if (!global.db.bombs[groupId]) {
          return ctx.reply("⚠️ Tidak ada sesi bom yang aktif saat ini.");
        }
        const game = global.db.bombs[groupId];
        if (game.planterJid !== senderJid) {
          return ctx.reply("❌ Hanya pemasang bom yang berhak membatalkan sesi ini.");
        }
        delete global.db.bombs[groupId];
        saveDB();
        return ctx.reply("🛑 Sesi bom berhasil dibatalkan.");
      }
      if (global.db.bombs[groupId]) {
        const existing = global.db.bombs[groupId];
        if (existing.status === "SETTING_UP") {
          return ctx.reply(`⏳ @${existing.planterJid.split("@")[0]} sedang menyetel kabel jebakan di Private Chat!`, {
            mentions: [existing.planterJid]
          });
        }
        return ctx.reply("⚠️ Masih ada bom aktif di grup ini! Segera jinakkan sebelum meledak.");
      }
      const mentioned = ctx?.mentionedJid || [];
      const targetJid = mentioned[0] || null;
      let betAmount = 0;
      for (const arg of args) {
        const cleanNum = parseInt(arg.replace(/[^0-9]/g, ""));
        if (!isNaN(cleanNum) && cleanNum > 0 && !arg.startsWith("@")) {
          betAmount = cleanNum;
          break;
        }
      }
      if (betAmount > 0) {
        const pMoney = Number(userData.money) || 0;
        if (pMoney < betAmount) {
          return ctx.reply(`❌ Saldo uangmu tidak mencukupi untuk taruhan *Rp ${betAmount.toLocaleString()}* (Saldo: Rp ${pMoney.toLocaleString()}).`);
        }
      }
      await ctx.react("⏳");
      global.db.bombs[groupId] = {
        groupId: groupId,
        planterJid: senderJid,
        planterName: senderName,
        targetJid: targetJid,
        bet: betAmount,
        status: "SETTING_UP",
        detonateWire: null,
        defuseWire: null,
        cutWires: [],
        expireTime: Date.now() + 60 * 1e3
      };
      saveDB();
      setTimeout(async () => {
        if (global.db.bombs[groupId]?.status === "SETTING_UP") {
          delete global.db.bombs[groupId];
          saveDB();
          await sock.sendMessage(groupId, {
            text: `⌛ Waktu penyetelan habis! Pemasang @${senderJid.split("@")[0]} tidak menyetel bom di PC, sesi dibatalkan.`,
            mentions: [senderJid]
          });
        }
      }, 60 * 1e3);
      const pcButtons = WIRE_COLORS.map(w => ({
        name: "quick_reply",
        display_text: `${w.num}. ${w.name}`,
        id: `${prefix}bomb set ${w.id}`
      }));
      const pcBody = `Hi ${senderName}!
Silakan tentukan kabel yang dijadikan *JEBAKAN DETONATOR* rahasia.

–  *W I R E  S E T T I N G*

┌  ◦  *Total Kabel* : 5 Pilihan
│  ◦  *Taruhan* : Rp ${betAmount.toLocaleString()}
│  ◦  *Timeout PC* : 60 Detik
└  ◦  *Sistem* : 1 Detonator, 1 Defuse, 3 Netral

_Gunakan tombol di bawah atau balas chat ini dengan angka (1 - 5) / nama warna kabel._`;
      await sendNeoxrBomb(sock, ctx, senderJid, pcBody, footerText, pcButtons);
      const groupAnnounce = `Hi All!
Seseorang sedang merakit bom di arena grup.

–  *B O M B  I N I T I A L*

┌  ◦  *Pemasang* : @${senderJid.split("@")[0]}
${targetJid ? `│  ◦  *Target* : @${targetJid.split("@")[0]}\n` : ""}\
│  ◦  *Hadiah Taruhan* : Rp ${(betAmount * 2).toLocaleString()}
└  ◦  *Status* : Menunggu Pemasang Memilih Detonator

_Bot telah mengirimkan panel aktivasi ke Private Chat pemasang._`;
      const mentions = targetJid ? [senderJid, targetJid] : [senderJid];
      await sock.sendMessage(groupId, {
        text: groupAnnounce,
        mentions: mentions
      }, {
        quoted: quotedMsg
      });
    } catch (e) {
      console.error("[BOMB ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};
async function armBombInGroup(sock, ctx, groupId) {
  initDB();
  const game = global.db.bombs[groupId];
  if (!game) return;
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const prefix = ctx?.prefix || ".";
  const buttons = WIRE_COLORS.map(w => ({
    name: "quick_reply",
    display_text: `${w.num}. ${w.name}`,
    id: `${prefix}bomb cut ${w.id}`
  }));
  const armedText = `Hi Survivors!
Sebuah bom waktu aktif telah ditempatkan di dalam arena grup.

–  *B O M B  A R E N A*

┌  ◦  *Pemasang* : @${game.planterJid.split("@")[0]}
${game.targetJid ? `│  ◦  *Target* : @${game.targetJid.split("@")[0]}\n` : ""}\
│  ◦  *Total Hadiah* : Rp ${(game.bet * 2).toLocaleString()}
│  ◦  *Countdown* : 60 Detik
└  ◦  *Status* : ARMED & TICKING

–  *C I R C U I T  L I S T*

┌  ◦  [1] 🔴 Kabel Merah
│  ◦  [2] 🔵 Kabel Biru
│  ◦  [3] 🟢 Kabel Hijau
│  ◦  [4] 🟡 Kabel Kuning
└  ◦  [5] ⚪ Kabel Putih

_Pilih dan potong kabel menggunakan tombol di bawah atau ketik nomor 1 - 5 di chat!_`;
  const mentions = game.targetJid ? [game.planterJid, game.targetJid] : [game.planterJid];
  const bombHtml = buildBombCanvasHtml(game, "ARMED", 60);
  const {
    buffer,
    url
  } = await renderHtmlToImage(bombHtml);
  await sendNeoxrBomb(sock, ctx, groupId, armedText, footerText, buttons, null, mentions, buffer, url);
}
async function handleCutWire(sock, ctx, groupId, wireInput, defuserJid, defuserName, prefix, quotedMsg) {
  initDB();
  const game = global.db.bombs[groupId];
  if (!game) return;
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  if (defuserJid === game.planterJid) {
    return ctx.reply("❌ Kamu adalah pemasang bom! Biarkan peserta lain yang memotong kabel.");
  }
  if (game.targetJid && game.targetJid !== defuserJid) {
    return ctx.reply(`❌ Bom ini ditujukan khusus untuk dijinakkan oleh @${game.targetJid.split("@")[0]}!`, {
      mentions: [game.targetJid]
    });
  }
  const matched = WIRE_COLORS.find(w => w.id === wireInput || w.num === wireInput || wireInput.includes(w.id) || wireInput.includes(w.name.toLowerCase()));
  if (!matched) {
    return ctx.reply("⚠️ Pilihan kabel tidak valid! Ketik angka 1 - 5 atau nama warnanya.");
  }
  const wireId = matched.id;
  if (game.cutWires.includes(wireId)) {
    return ctx.reply(`⚠️ Kabel *${matched.name}* sudah pernah dipotong! Silakan pilih kabel yang lain.`);
  }
  game.cutWires.push(wireId);
  saveDB();
  if (wireId === game.defuseWire) {
    delete global.db.bombs[groupId];
    saveDB();
    const rewardMsg = await distributeReward(defuserJid, defuserName, game.planterJid, game.planterName, game.bet, "defuse");
    const winText = `Hi ${defuserName}!
Kerja bagus! Bom berhasil kamu jinakkan dengan sukses.

–  *B O M B  D E F U S E D*

┌  ◦  *Penjinak* : @${defuserJid.split("@")[0]}
│  ◦  *Pemasang* : @${game.planterJid.split("@")[0]}
│  ◦  *Kabel Tepat* : ${matched.name}
└  ◦  *Reward* : ${rewardMsg}

_Gunakan perintah \`${prefix}bomb\` untuk memulai game kembali._`;
    const canvasHtml = buildBombCanvasHtml(game, "DEFUSED", 0);
    const {
      buffer,
      url
    } = await renderHtmlToImage(canvasHtml);
    return await sendNeoxrBomb(sock, ctx, groupId, winText, footerText, [{
      name: "quick_reply",
      display_text: "💣 Pasang Bom Baru",
      id: `${prefix}bomb`
    }], quotedMsg, [defuserJid, game.planterJid], buffer, url);
  }
  if (wireId === game.detonateWire) {
    delete global.db.bombs[groupId];
    saveDB();
    const rewardMsg = await distributeReward(game.planterJid, game.planterName, defuserJid, defuserName, game.bet, "explode");
    const boomText = `Hi All!
DUAAARRRRR! Bom meledak berkeping-keping! 💥💥

–  *B O M B  D E T O N A T E D*

┌  ◦  *Korban* : @${defuserJid.split("@")[0]}
│  ◦  *Pemenang* : @${game.planterJid.split("@")[0]}
│  ◦  *Kabel Jebakan* : ${matched.name}
│  ◦  *Kabel Asli* : ${WIRE_COLORS.find(w => w.id === game.defuseWire)?.name}
└  ◦  *Reward* : ${rewardMsg}

_Pemasang berhasil menjebak penjinak dan memenangkan pertaruhan._`;
    const canvasHtml = buildBombCanvasHtml(game, "EXPLODED", 0);
    const {
      buffer,
      url
    } = await renderHtmlToImage(canvasHtml);
    return await sendNeoxrBomb(sock, ctx, groupId, boomText, footerText, [{
      name: "quick_reply",
      display_text: "🔁 Main Lagi",
      id: `${prefix}bomb`
    }], quotedMsg, [defuserJid, game.planterJid], buffer, url);
  }
  const remainingWires = WIRE_COLORS.filter(w => !game.cutWires.includes(w.id));
  const remainingSec = Math.max(1, Math.round((game.expireTime - Date.now()) / 1e3));
  const buttons = remainingWires.map(w => ({
    name: "quick_reply",
    display_text: `${w.num}. ${w.name}`,
    id: `${prefix}bomb cut ${w.id}`
  }));
  const neutralText = `Hi ${defuserName}!
Kabel ${matched.name} telah dipotong dan ternyata netral!

–  *S T A T U S  C U T*

┌  ◦  *Dipotong Oleh* : @${defuserJid.split("@")[0]}
│  ◦  *Sisa Waktu* : ~${remainingSec} Detik
└  ◦  *Kondisi* : Bom masih aktif berdetik!

–  *S I S A  K A B E L*

${remainingWires.map(w => `┌  ◦  [${w.num}] ${w.name}`).join("\n")}

_Segera pilih kabel berikutnya sebelum timer habis!_`;
  const canvasHtml = buildBombCanvasHtml(game, "ARMED", remainingSec);
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  return await sendNeoxrBomb(sock, ctx, groupId, neutralText, footerText, buttons, quotedMsg, [defuserJid], buffer, url);
}
async function distributeReward(winnerJid, winnerName, loserJid, loserName, bet, type) {
  if (winnerJid) initDB(winnerJid, winnerName);
  if (loserJid) initDB(loserJid, loserName);
  const winner = global.db.user[winnerJid];
  const loser = loserJid ? global.db.user[loserJid] : null;
  let text = "";
  if (bet > 0) {
    if (winner && loser) {
      winner.money = (Number(winner.money) || 0) + bet;
      loser.money = Math.max(0, (Number(loser.money) || 0) - bet);
      winner.exp = (Number(winner.exp) || 0) + 50;
    } else if (winner) {
      winner.money = (Number(winner.money) || 0) + bet;
      winner.exp = (Number(winner.exp) || 0) + 50;
    }
    text = `+Rp ${bet.toLocaleString()} & +50 EXP`;
  } else {
    if (winner) {
      winner.money = (Number(winner.money) || 0) + 5e3;
      winner.exp = (Number(winner.exp) || 0) + 35;
    }
    text = `+Rp 5.000 & +35 EXP`;
  }
  saveDB();
  return text;
}