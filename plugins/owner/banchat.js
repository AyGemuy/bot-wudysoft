import db from "../../data/db.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";

function initDB(chatId = null) {
  if (!global.db) global.db = {};
  if (!global.db.group) global.db.group = {};
  if (chatId) {
    if (typeof db?.ensureGroup === "function") {
      db.ensureGroup(chatId);
    }
    if (!global.db.group[chatId]) {
      global.db.group[chatId] = {
        bans: false,
        banTimer: null
      };
    }
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function parseDuration(str) {
  if (!str) return 0;
  const match = String(str).trim().match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d|detik|menit|jam|hari)?$/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = (match[2] || "m").toLowerCase();
  switch (unit) {
    case "s":
    case "detik":
      return Math.round(val * 1e3);
    case "m":
    case "menit":
      return Math.round(val * 60 * 1e3);
    case "h":
    case "jam":
      return Math.round(val * 60 * 60 * 1e3);
    case "d":
    case "hari":
      return Math.round(val * 24 * 60 * 60 * 1e3);
    default:
      return Math.round(val * 60 * 1e3);
  }
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1e3 % 60);
  const minutes = Math.floor(ms / (1e3 * 60) % 60);
  const hours = Math.floor(ms / (1e3 * 60 * 60) % 24);
  const days = Math.floor(ms / (1e3 * 60 * 60 * 24));
  const parts = [];
  if (days > 0) parts.push(`${days} Hari`);
  if (hours > 0) parts.push(`${hours} Jam`);
  if (minutes > 0) parts.push(`${minutes} Menit`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} Detik`);
  return parts.join(" ");
}
async function executeBanTimerFromDB(sock, chatId, action) {
  try {
    initDB(chatId);
    const groupDb = global.db.group[chatId];
    const groupName = groupDb.subject || "Grup WhatsApp";
    groupDb.banTimer = null;
    if (action === "unban") {
      groupDb.bans = false;
      saveDB();
      await sock.sendMessage(chatId, {
        text: `–  *U N B A N  C H A T*

┌  ◦  *Grup* : ${groupName}
└  ◦  *Status Bot* : Aktif Kembali (Otomatis) 🔓

Waktu hitung mundur pembatasan telah berakhir. Semua anggota sekarang dapat menggunakan bot kembali.`
      });
    } else if (action === "ban") {
      groupDb.bans = true;
      saveDB();
      await sock.sendMessage(chatId, {
        text: `–  *B A N  C H A T*

┌  ◦  *Grup* : ${groupName}
└  ◦  *Status Bot* : Dinonaktifkan (Otomatis) 🚫

Waktu hitung mundur telah habis, bot telah dinonaktifkan di grup ini sesuai jadwal database.`
      });
    }
  } catch (err) {
    console.error("[Execute Ban DB Timer Error]:", err);
  }
}
async function sendActionMessage(sock, ctx, chatId, textContent, buttons = [], quotedMsg = null) {
  const botName = global.bot?.name || "Paimon-bot";
  const footerText = global.bot?.footer || `${botName} • Security & Moderation`;
  const options = {
    jid: chatId,
    to: chatId,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Pengaturan Ban Chat`,
        button_title: "Opsi Banchat"
      }
    },
    contextInfo: {
      mentionedJid: [ctx?.sender].filter(Boolean),
      forwardingScore: 0,
      isForwarded: false
    },
    quoted: quotedMsg || undefined
  };
  let sentMsg = null;
  if (typeof ctx?.sendCta === "function" && chatId === ctx.id) {
    try {
      sentMsg = await ctx.sendCta(textContent, footerText, buttons, options);
    } catch (e) {
      console.error("[BanChat sendCta Error]:", e.message);
    }
  }
  if (!sentMsg) {
    try {
      const nativeButtons = buttons.map(b => ({
        name: b.name || "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: b.display_text || b.title,
          id: b.id
        })
      }));
      sentMsg = await sock.sendMessage(chatId, {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: {
                text: textContent
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
        quoted: quotedMsg
      });
    } catch (e) {}
  }
  if (!sentMsg) {
    sentMsg = await sock.sendMessage(chatId, {
      text: `${textContent}\n\n_${footerText}_`,
      mentions: options.contextInfo.mentionedJid
    }, {
      quoted: quotedMsg
    });
  }
  return sentMsg;
}
export default {
  name: "banchat",
  aliases: ["unbanchat", "bangc", "unbangc", "botban", "botunban"],
  description: "Menonaktifkan atau mengaktifkan bot di dalam grup secara instan atau via timer",
  category: "Group",
  example: ".banchat 1h (matikan bot di grup selama 1 jam) / .unbanchat",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !chatId.endsWith("@g.us")) return;
      initDB(chatId);
      const groupDb = global.db.group[chatId];
      if (groupDb?.banTimer?.active && Date.now() >= groupDb.banTimer.targetTime) {
        await executeBanTimerFromDB(sock, chatId, groupDb.banTimer.action);
      }
    } catch (e) {
      console.error("[BANCHAT BEFORE CHECK ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!ctx.isGroup) {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Perintah ini hanya dapat digunakan di dalam grup WhatsApp.");
      }
      if (!ctx.isAdmin && !ctx.isOwner && !ctx.isROwner) {
        if (typeof ctx?.react === "function") await ctx.react("🚫");
        return ctx.reply("❌ Perintah ini khusus untuk *Admin Grup* atau *Owner Bot*.");
      }
      const chatId = ctx.id || ctx.chat;
      const groupName = ctx.groupData?.subject || "Grup WhatsApp";
      const cmd = (ctx.cmd || ctx.command || "").toLowerCase();
      const senderNum = ctx.senderNumber || (ctx.sender ? ctx.sender.split("@")[0] : "Admin");
      initDB(chatId);
      const groupDb = global.db.group[chatId];
      let action = null;
      let rawDuration = null;
      if (["banchat", "bangc", "botban"].includes(cmd)) {
        action = "ban";
        rawDuration = ctx.args?.[0];
      } else if (["unbanchat", "unbangc", "botunban"].includes(cmd)) {
        action = "unban";
        rawDuration = ctx.args?.[0];
      } else {
        const firstArg = (ctx.args?.[0] || "").toLowerCase().trim();
        const secondArg = ctx.args?.[1];
        if (["ban", "on", "1", "lock"].includes(firstArg)) {
          action = "ban";
          rawDuration = secondArg;
        } else if (["unban", "off", "0", "unlock"].includes(firstArg)) {
          action = "unban";
          rawDuration = secondArg;
        } else if (["cancel", "batal", "stop"].includes(firstArg)) {
          action = "cancel";
        }
      }
      const isTimerPending = Boolean(groupDb.banTimer && groupDb.banTimer.active && groupDb.banTimer.targetTime > Date.now());
      if (action === "cancel") {
        if (isTimerPending || groupDb.banTimer) {
          groupDb.banTimer = null;
          saveDB();
          if (typeof ctx?.react === "function") await ctx.react("✅");
          return ctx.reply(`–  *T I M E R  C A N C E L E D*

┌  ◦  *Grup* : ${groupName}
└  ◦  *Status* : Dibatalkan

Jadwal hitung mundur ban grup telah dihapus dari sistem database.`);
        } else {
          if (typeof ctx?.react === "function") await ctx.react("ℹ️");
          return ctx.reply("ℹ️ Tidak ada jadwal timer ban yang sedang aktif di grup ini.");
        }
      }
      if (!action) {
        if (typeof ctx?.react === "function") await ctx.react("❓");
        const isBanned = Boolean(groupDb.bans);
        let timerText = "";
        if (isTimerPending) {
          const remaining = Math.max(0, groupDb.banTimer.targetTime - Date.now());
          const targetAction = groupDb.banTimer.action === "unban" ? "Diaktifkan Kembali" : "Dinonaktifkan";
          timerText = `│  ◦  *Jadwal DB* : Akan ${targetAction} dalam ${formatTime(remaining)}\n`;
        }
        const statusText = `–  *B A N  C H A T*

Berikut adalah status respons bot di dalam grup saat ini.

┌  ◦  *Grup* : ${groupName}
│  ◦  *Status Bot* : ${isBanned ? "Dinonaktifkan (Banned) 🚫" : "Aktif (Normal) ✅"}
${timerText}└  ◦  *Role* : Admin & Owner Only

–  *C O N T O H  P E R I N T A H*

┌  ◦  *Matikan Instan* : \`${prefix}banchat\`
│  ◦  *Matikan Bertimer* : \`${prefix}banchat 30m\`
│  ◦  *Aktifkan Kembali* : \`${prefix}unbanchat\`
└  ◦  *Batalkan Timer* : \`${prefix}banchat cancel\`

Atau ubah secara langsung melalui tombol aksi cepat di bawah:`;
        const buttons = [{
          name: "quick_reply",
          display_text: "🚫 Nonaktifkan Bot (Ban)",
          id: `${prefix}banchat`
        }, {
          name: "quick_reply",
          display_text: "✅ Aktifkan Bot (Unban)",
          id: `${prefix}unbanchat`
        }];
        if (isTimerPending) {
          buttons.push({
            name: "quick_reply",
            display_text: "⏱️ Batalkan Timer",
            id: `${prefix}banchat cancel`
          });
        }
        return await sendActionMessage(sock, ctx, chatId, statusText, buttons, quotedMsg);
      }
      if (typeof ctx?.react === "function") await ctx.react("⏳");
      const durationMs = parseDuration(rawDuration);
      if (action === "ban") {
        if (durationMs > 0) {
          const targetTimestamp = Date.now() + durationMs;
          groupDb.bans = true;
          groupDb.banTimer = {
            action: "unban",
            targetTime: targetTimestamp,
            duration: durationMs,
            active: true,
            setBy: ctx.sender,
            createdAt: Date.now()
          };
          saveDB();
          setTimeout(async () => {
            initDB(chatId);
            const currentTimer = global.db.group?.[chatId]?.banTimer;
            if (currentTimer?.active && currentTimer?.targetTime === targetTimestamp) {
              await executeBanTimerFromDB(sock, chatId, "unban");
            }
          }, durationMs);
          const noticeText = `–  *T I M E R  B A N*

┌  ◦  *Grup* : ${groupName}
│  ◦  *Durasi Mute* : ${formatTime(durationMs)}
│  ◦  *Eksekutor* : @${senderNum}
└  ◦  *Status* : Nonaktif Sementara ⏳

Bot tidak akan merespon perintah di grup ini hingga batas waktu berakhir.`;
          const buttons = [{
            name: "quick_reply",
            display_text: "🔓 Aktifkan Sekarang",
            id: `${prefix}unbanchat`
          }];
          return await sendActionMessage(sock, ctx, chatId, noticeText, buttons, quotedMsg);
        }
        groupDb.bans = true;
        groupDb.banTimer = null;
        saveDB();
        const banText = `–  *B A N  C H A T*

┌  ◦  *Grup* : ${groupName}
│  ◦  *Status Bot* : Dinonaktifkan (Muted) 🚫
└  ◦  *Eksekutor* : @${senderNum}

Bot tidak akan merespon perintah apapun dari anggota grup ini sampai di-unban oleh Admin/Owner.`;
        const buttons = [{
          name: "quick_reply",
          display_text: "✅ Aktifkan Bot (Unban)",
          id: `${prefix}unbanchat`
        }];
        if (typeof ctx?.react === "function") await ctx.react("✅");
        return await sendActionMessage(sock, ctx, chatId, banText, buttons, quotedMsg);
      } else if (action === "unban") {
        groupDb.bans = false;
        groupDb.banTimer = null;
        saveDB();
        const unbanText = `–  *U N B A N  C H A T*

┌  ◦  *Grup* : ${groupName}
│  ◦  *Status Bot* : Aktif Kembali (Normal) ✅
└  ◦  *Eksekutor* : @${senderNum}

Semua anggota sekarang dapat menggunakan bot kembali di dalam grup ini.`;
        const buttons = [{
          name: "quick_reply",
          display_text: "🚫 Nonaktifkan Bot",
          id: `${prefix}banchat`
        }];
        if (typeof ctx?.react === "function") await ctx.react("✅");
        return await sendActionMessage(sock, ctx, chatId, unbanText, buttons, quotedMsg);
      }
    } catch (error) {
      console.error("[BANCHAT Error]:", error);
      if (typeof ctx?.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Gagal mengubah status ban bot: ${error?.message || error}`);
    }
  }
};