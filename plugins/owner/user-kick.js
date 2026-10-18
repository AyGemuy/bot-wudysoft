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
      global.db.group[chatId] = {};
    }
    if (!Array.isArray(global.db.group[chatId].memberTimers)) {
      global.db.group[chatId].memberTimers = [];
    }
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function extractTargetJids(ctx, msg) {
  const targets = new Set();
  if (ctx.quoted?.sender) {
    targets.add(ctx.quoted.sender);
  } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
    targets.add(msg.message.extendedTextMessage.contextInfo.participant);
  }
  const mentioned = ctx.mentionedJid || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  for (const jid of mentioned) {
    if (jid) targets.add(jid);
  }
  if (ctx.args && ctx.args.length > 0) {
    const rawNumbers = ctx.args.join(" ").match(/\+?[0-9]{8,16}/g) || [];
    for (let num of rawNumbers) {
      num = num.replace(/[^0-9]/g, "");
      if (num.startsWith("0")) num = "62" + num.slice(1);
      targets.add(`${num}@s.whatsapp.net`);
    }
  }
  return Array.from(targets);
}

function parseDuration(args = []) {
  for (const arg of args) {
    const match = String(arg).trim().match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d|detik|menit|jam|hari)$/i);
    if (match) {
      const val = parseFloat(match[1]);
      const unit = (match[2] || "s").toLowerCase();
      let ms = val * 1e3;
      if (unit.startsWith("m")) ms = val * 60 * 1e3;
      else if (unit.startsWith("h") || unit.startsWith("j")) ms = val * 3600 * 1e3;
      else if (unit.startsWith("d")) ms = val * 86400 * 1e3;
      return {
        ms: Math.round(ms),
        raw: arg
      };
    }
  }
  return {
    ms: 0,
    raw: null
  };
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
async function safeGroupParticipantsUpdate(sock, chatId, jids, action) {
  try {
    return await sock.groupParticipantsUpdate(chatId, jids, action);
  } catch (err) {
    if (typeof sock.aiGroupParticipantsUpdate === "function") {
      return await sock.aiGroupParticipantsUpdate(chatId, jids, action);
    }
    throw err;
  }
}
async function executeMemberAction(sock, chatId, targets, action, adminJid = "") {
  try {
    const isAdd = action === "add";
    const botContext = global.bot?.utils?.contextInfo || {};
    const results = await safeGroupParticipantsUpdate(sock, chatId, targets, isAdd ? "add" : "remove");
    const successList = [];
    const failedList = [];
    if (Array.isArray(results)) {
      for (const res of results) {
        const jid = res.jid || targets[0];
        const status = String(res.status);
        const userTag = `@${jid.split("@")[0]}`;
        if (status === "200") {
          successList.push(`• ${isAdd ? "✅" : "🚪"} ${userTag} _(${isAdd ? "Berhasil ditambahkan" : "Dikeluarkan"})_`);
        } else if (isAdd && status === "403") {
          failedList.push(`• 🔒 ${userTag} _(Privasi undangan aktif, butuh link grup)_`);
        } else if (isAdd && status === "408") {
          failedList.push(`• ⏱️ ${userTag} _(Baru saja keluar dari grup)_`);
        } else if (isAdd && status === "409") {
          failedList.push(`• ℹ️ ${userTag} _(Sudah berada di dalam grup)_`);
        } else {
          failedList.push(`• ❌ ${userTag} _(Gagal: Status ${status})_`);
        }
      }
    } else {
      for (const jid of targets) {
        const userTag = `@${jid.split("@")[0]}`;
        successList.push(`• ${isAdd ? "✅" : "🚪"} ${userTag} _(Diproses via AI System)_`);
      }
    }
    const adminDisplay = adminJid ? `@${adminJid.split("@")[0]}` : "Otomatis (Sistem)";
    const actionLabel = isAdd ? "A D D" : "K I C K";
    let bodyText = `–  *G R O U P  ${actionLabel}*

┌  ◦  *Admin* : ${adminDisplay}
│  ◦  *Total Target* : ${targets.length} Pengguna
└  ◦  *Status* : Selesai Dieksekusi\n\n`;
    if (successList.length) {
      bodyText += `┌  ◦  *B E R H A S I L*
│  ${successList.join("\n│  ")}
└  ◦  *Total* : ${successList.length} Sukses\n\n`;
    }
    if (failedList.length) {
      bodyText += `┌  ◦  *G A G A L / C A T A T A N*
│  ${failedList.join("\n│  ")}
└  ◦  *Total* : ${failedList.length} Gagal\n\n`;
    }
    const allMentions = [adminJid, ...targets].filter(Boolean);
    await sock.sendMessage(chatId, {
      text: bodyText.trimEnd(),
      mentions: allMentions,
      contextInfo: {
        ...botContext,
        mentionedJid: allMentions
      }
    });
  } catch (err) {
    console.error(`[EXECUTE ${action.toUpperCase()} ERROR]:`, err);
  }
}
export default {
  name: "kick",
  aliases: ["tendang", "remove", "keluarkan", "dor", "add", "tambah", "invite", "masukkan"],
  description: "Mengeluarkan (kick) atau menambahkan (add) anggota grup secara instan atau dengan jadwal hitung mundur (AI Group Supported)",
  category: "Group",
  group: true,
  admin: true,
  botAdmin: true,
  example: ".kick @user 10s / .add 628123456789 1m",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !chatId.endsWith("@g.us")) return;
      initDB(chatId);
      const timers = global.db.group[chatId]?.memberTimers;
      if (Array.isArray(timers) && timers.length > 0) {
        const now = Date.now();
        const expired = timers.filter(t => now >= t.targetTime);
        if (expired.length > 0) {
          global.db.group[chatId].memberTimers = timers.filter(t => now < t.targetTime);
          saveDB();
          for (const item of expired) {
            await executeMemberAction(sock, chatId, item.targets, item.action, item.adminJid);
          }
        }
      }
    } catch (e) {
      console.error("[MEMBER BEFORE TIMER ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Wudysoft";
      const botFooter = global.bot?.footer || "– Wudysoft • Multi-Device";
      const botMsg = global.bot?.msg || {};
      const botContext = global.bot?.utils?.contextInfo || {};
      const chatId = ctx.id || ctx.chat;
      if (!ctx.isGroup && !chatId?.endsWith("@g.us")) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(botMsg.group || "–  *G R O U P  O N L Y*\n\nFitur ini hanya dapat digunakan di dalam *Grup*.");
      }
      if (!ctx.isAdmin && !ctx.isOwner && !ctx.isROwner) {
        if (typeof ctx.react === "function") await ctx.react("🚫");
        return ctx.reply(botMsg.admin || "–  *A D M I N  O N L Y*\n\nPerintah ini hanya dapat dijalankan oleh *Admin Grup*.");
      }
      if (!ctx.isBotAdmin) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(botMsg.botAdmin || "–  *B O T  N O T  A D M I N*\n\nJadikan bot sebagai *Admin Grup* untuk menggunakan fitur ini.");
      }
      initDB(chatId);
      const cmd = (ctx.cmd || ctx.command || "").toLowerCase();
      const isAdd = ["add", "tambah", "invite", "masukkan"].includes(cmd);
      const actionType = isAdd ? "add" : "remove";
      const actionTitle = isAdd ? "ADD" : "KICK";
      const rawText = (ctx.query || ctx.text || "").toLowerCase();
      if (rawText.includes("cancel") || rawText.includes("batal")) {
        const existingTimers = global.db.group[chatId].memberTimers || [];
        const filtered = existingTimers.filter(t => t.action !== actionType);
        if (filtered.length !== existingTimers.length) {
          global.db.group[chatId].memberTimers = filtered;
          saveDB();
          if (typeof ctx.react === "function") await ctx.react("✅");
          return ctx.reply(`–  *T I M E R  C A N C E L E D*

┌  ◦  *Tindakan* : ${actionTitle} Member
└  ◦  *Status* : Dibatalkan

Semua antrean jadwal ${actionTitle.toLowerCase()} yang tertunda di grup ini telah dibersihkan.`);
        } else {
          if (typeof ctx.react === "function") await ctx.react("ℹ️");
          return ctx.reply(`ℹ️ Tidak ada jadwal antrean ${actionTitle} yang sedang menunggu.`);
        }
      }
      const allTargets = extractTargetJids(ctx, msg);
      const duration = parseDuration(ctx.args || []);
      if (!allTargets.length) {
        return ctx.reply(`–  *G R O U P  ${actionTitle}*

Silakan tentukan target peserta grup yang ingin diproses.

┌  ◦  *Tag / Mention* : \`${prefix}${cmd} @user\`
│  ◦  *Reply Pesan* : Balas pesan user lalu ketik \`${prefix}${cmd}\`
└  ◦  *Input Nomor* : \`${prefix}${cmd} 6281234567890\`

–  *D E L A Y  T I M E R*

┌  ◦  *Detik* : \`${prefix}${cmd} @user 10s\`
│  ◦  *Menit* : \`${prefix}${cmd} 628xxx 5m\`
└  ◦  *Batalkan* : \`${prefix}${cmd} cancel\``);
      }
      const botJid = (sock.user?.id?.split(":")[0] || ctx.botNumber) + "@s.whatsapp.net";
      const targets = isAdd ? allTargets : allTargets.filter(jid => jid !== ctx.sender && jid !== botJid);
      if (!targets.length && !isAdd) {
        if (typeof ctx.react === "function") await ctx.react("⚠️");
        return ctx.reply("⚠️ Anda tidak dapat mengeluarkan diri sendiri atau bot menggunakan perintah ini.");
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (duration.ms > 0) {
        const targetTimestamp = Date.now() + duration.ms;
        global.db.group[chatId].memberTimers.push({
          action: actionType,
          targets: targets,
          targetTime: targetTimestamp,
          duration: duration.ms,
          adminJid: ctx.sender,
          createdAt: Date.now()
        });
        saveDB();
        setTimeout(async () => {
          initDB(chatId);
          const currentTimers = global.db.group[chatId]?.memberTimers || [];
          const taskIndex = currentTimers.findIndex(t => t.action === actionType && t.targetTime === targetTimestamp);
          if (taskIndex !== -1) {
            const task = currentTimers[taskIndex];
            global.db.group[chatId].memberTimers.splice(taskIndex, 1);
            saveDB();
            await executeMemberAction(sock, chatId, task.targets, task.action, task.adminJid);
          }
        }, duration.ms);
        const targetTags = targets.map(t => `@${t.split("@")[0]}`).join(", ");
        const scheduleNotice = `–  *T I M E R  A C T I V A T E D*

┌  ◦  *Tindakan* : ${isAdd ? "Penambahan (Add)" : "Pelepasan (Kick)"}
│  ◦  *Target* : ${targetTags}
│  ◦  *Admin* : @${ctx.sender.split("@")[0]}
└  ◦  *Hitung Mundur* : ${formatTime(duration.ms)}

Target akan diproses otomatis oleh sistem setelah waktu tercapai.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⏱️ Batalkan ${actionTitle}`,
            id: `${prefix}${cmd} cancel`
          })
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(scheduleNotice, botFooter, buttons, {
            quoted: msg,
            contextInfo: {
              ...botContext,
              mentionedJid: [ctx.sender, ...targets]
            }
          });
        }
        return await sock.sendMessage(chatId, {
          text: scheduleNotice,
          mentions: [ctx.sender, ...targets],
          contextInfo: {
            ...botContext,
            mentionedJid: [ctx.sender, ...targets]
          }
        }, {
          quoted: msg
        });
      }
      await executeMemberAction(sock, chatId, targets, actionType, ctx.sender);
      if (typeof ctx.react === "function") await ctx.react(isAdd ? "✅" : "🚪");
    } catch (err) {
      console.error("[MEMBER ACTION ERROR]:", err);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errText = global.bot?.msg?.error || "–  *E R R O R*\n\nTerjadi kesalahan saat mengeksekusi permintaan.";
      ctx.reply(`${errText}\n\n*Detail*: ${err.message || err}`);
    }
  }
};