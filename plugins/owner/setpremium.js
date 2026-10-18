import {
  makeJid,
  ensureUser
} from "../../core/tools.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";

function parseDuration(durationStr = "") {
  const d = String(durationStr).toLowerCase().trim();
  if (["permanen", "permanent", "unlimited", "forever", "inf"].includes(d)) {
    return {
      ms: Number.MAX_SAFE_INTEGER,
      label: "Permanen (Selamanya)"
    };
  }
  const match = d.match(/^(\d+)\s*(j|jam|h|hari|d|day|days|m|minggu|w|week|weeks|b|bulan|mon|month|months)$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const mul = {
    j: 36e5,
    jam: 36e5,
    h: 864e5,
    hari: 864e5,
    d: 864e5,
    day: 864e5,
    days: 864e5,
    m: 6048e5,
    minggu: 6048e5,
    w: 6048e5,
    week: 6048e5,
    weeks: 6048e5,
    b: 2592e6,
    bulan: 2592e6,
    mon: 2592e6,
    month: 2592e6,
    months: 2592e6
  };
  const ms = num * (mul[unit] || 0);
  let unitLabel = "Hari";
  if (["j", "jam"].includes(unit)) unitLabel = "Jam";
  else if (["m", "minggu", "w", "week", "weeks"].includes(unit)) unitLabel = "Minggu";
  else if (["b", "bulan", "mon", "month", "months"].includes(unit)) unitLabel = "Bulan";
  return {
    ms: ms,
    label: `${num} ${unitLabel}`
  };
}

function formatDate(timestamp) {
  if (timestamp === Number.MAX_SAFE_INTEGER || !timestamp) return "Permanen";
  return new Date(timestamp).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "short"
  }) + " WIB";
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["user", "u", "target", "nomor", "num"].includes(key)) key = "user";
    if (["duration", "d", "time", "durasi", "t"].includes(key)) key = "duration";
    if (["action", "a", "act"].includes(key)) key = "action";
    if (["list", "l", "menu"].includes(key)) key = "list";
    if (["help", "h"].includes(key)) key = "help";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "setpremium",
  aliases: ["addprem", "delprem", "premiumset", "setprem", "prem"],
  description: "Atur status dan durasi user premium via CLI & Interactive CTA Sheet",
  category: "Owner",
  owner: true,
  example: "setprem 628xxx 30hari atau setprem -u 628xxx -d 1bulan atau setprem --del 628xxx",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isOwner) {
        return ctx.reply("❌ Perintah ini hanya dapat diakses oleh Owner bot.");
      }
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["setpremium", "addprem", "delprem", "premiumset", "setprem", "prem"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Paimon-bot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const footerText = `${botName} • Premium Subscription Manager`;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const freeTokens = cleanPrompt.split(/\s+/).filter(Boolean);
      let targetNumber = flags.user || (freeTokens[0] && /\d{5,}/.test(freeTokens[0]) ? freeTokens[0] : null);
      if (!targetNumber && ctx.quoted?.sender) {
        targetNumber = ctx.quoted.sender.replace(/\D/g, "");
      }
      let durationInput = flags.duration || (freeTokens[1] && !["add", "min", "del", "remove"].includes(freeTokens[1].toLowerCase()) ? freeTokens[1] : null);
      if (!durationInput && freeTokens[0] && !/\d{5,}/.test(freeTokens[0])) {
        durationInput = freeTokens[0];
      }
      let actionInput = flags.action || (freeTokens[2] || freeTokens[1] || "").toLowerCase();
      if (["min", "del", "remove", "hapus"].some(a => rawText.toLowerCase().includes(a))) {
        actionInput = "remove";
      }
      const hasAction = Boolean(targetNumber || durationInput || flags.list);
      if (!hasAction || flags.help) {
        return ctx.reply(`–  *S E T  P R E M I U M*

Silakan tentukan nomor target dan durasi akses premium yang ingin diberikan.

┌  ◦  *Tambah* : ${prefix}setprem <nomor> <durasi>
│  ◦  *Cabut* : ${prefix}setprem <nomor> min
│  ◦  *Preset CTA* : ${prefix}setprem <nomor>
└  ◦  *Example* : ${prefix}setprem 6281234567890 30hari

–  *D U R A S I*

┌  ◦  *Jam* : 1jam, 12jam
│  ◦  *Hari* : 1hari, 7hari, 30hari
│  ◦  *Bulan* : 1bulan, 3bulan
└  ◦  *Permanen* : permanen

–  *F L A G S*

┌  ◦  *-u, --user* : Nomor WhatsApp target
│  ◦  *-d, --duration* : Durasi waktu premium
└  ◦  *-a, --action* : Aksi (\`add\` / \`remove\`)`);
      }
      const cleanNum = String(targetNumber).replace(/\D/g, "");
      if (!cleanNum || cleanNum.length < 5) {
        return ctx.reply("❌ Nomor target tidak valid. Pastikan menyertakan kode negara (contoh: 628xxx).");
      }
      const targetJid = typeof makeJid === "function" ? makeJid(cleanNum) : `${cleanNum}@s.whatsapp.net`;
      if (typeof ensureUser === "function") {
        ensureUser(targetJid, cleanNum);
      }
      if (!durationInput && actionInput !== "remove") {
        if (typeof ctx.react === "function") await ctx.react("⏳");
        const userDb = global.db?.user?.[targetJid] || {};
        const isPrem = Boolean(userDb.premium?.status && (userDb.premium.expiredAt > Date.now() || userDb.premium.expiredAt === Number.MAX_SAFE_INTEGER));
        const currentExp = isPrem ? formatDate(userDb.premium.expiredAt) : "Tidak Aktif";
        const listSections = [{
          title: "⚡ PAKET DURASI CEPAT",
          rows: [{
            title: "⏱️ 1 Hari Trial",
            id: `${prefix}setprem -u ${cleanNum} -d 1hari -a add`,
            description: "Aktifkan akses premium selama 24 jam"
          }, {
            title: "📅 7 Hari (1 Minggu)",
            id: `${prefix}setprem -u ${cleanNum} -d 7hari -a add`,
            description: "Aktifkan akses premium selama 7 hari"
          }, {
            title: "🌟 30 Hari (1 Bulan)",
            id: `${prefix}setprem -u ${cleanNum} -d 30hari -a add`,
            description: "Aktifkan akses premium selama 30 hari penuh"
          }, {
            title: "👑 Akses Permanen",
            id: `${prefix}setprem -u ${cleanNum} -d permanen -a add`,
            description: "Akses premium tanpa batas waktu (Forever)"
          }]
        }, {
          title: "🗑️ MANAJEMEN AKSES",
          rows: [{
            title: "❌ Cabut Status Premium",
            id: `${prefix}setprem -u ${cleanNum} -a remove`,
            description: "Nonaktifkan status premium nomor ini sekarang"
          }]
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🌟 PILIH DURASI PREMIUM",
            sections: listSections
          })
        }];
        const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
        const bodyText = `–  *S E T  P R E M I U M*

┌  ◦  *Target* : @${cleanNum}
│  ◦  *Status Saat Ini* : ${isPrem ? "Aktif ✅" : "Non-Aktif ❌"}
└  ◦  *Masa Berlaku* : ${currentExp}

Silakan pilih durasi paket pada menu tombol di bawah ini untuk mengonfirmasi aktivasi.`;
        const options = {
          image: bannerMedia,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Atur Premium`,
              button_title: "Pilih Durasi"
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            mentionedJid: [targetJid]
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footerText, buttons, options);
        } else {
          await ctx.reply(bodyText, {
            mentions: [targetJid],
            quoted: quotedMsg
          });
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (!global.db.user[targetJid]) {
        global.db.user[targetJid] = {};
      }
      if (!global.db.user[targetJid].premium) {
        global.db.user[targetJid].premium = {
          status: false,
          expiredAt: 0
        };
      }
      const userPremium = global.db.user[targetJid].premium;
      const now = Date.now();
      if (actionInput === "remove" || actionInput === "del" || actionInput === "min") {
        userPremium.status = false;
        userPremium.expiredAt = 0;
        if (typeof db?.write === "function") {
          db.write(global.db);
        }
        const removeText = `–  *S E T  P R E M I U M*

┌  ◦  *Status* : Non-Aktif (Free Member)
│  ◦  *Target* : @${cleanNum}
└  ◦  *Akses* : Premium Dicabut

Akses fitur premium pada pengguna tersebut telah resmi dinonaktifkan.`;
        await sock.sendMessage(ctx.id, {
          text: removeText,
          mentions: [targetJid]
        }, {
          quoted: quotedMsg
        });
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      const parsed = parseDuration(durationInput);
      if (!parsed) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`–  *S E T  P R E M I U M*

Format durasi *"${durationInput}"* tidak valid.

┌  ◦  *Contoh Format* : 1jam, 3hari, 1minggu, 1bulan, permanen
└  ◦  *Example* : ${prefix}setprem ${cleanNum} 30hari`);
      }
      if (parsed.ms === Number.MAX_SAFE_INTEGER) {
        userPremium.expiredAt = Number.MAX_SAFE_INTEGER;
      } else {
        const baseTime = userPremium.status && userPremium.expiredAt > now ? userPremium.expiredAt : now;
        userPremium.expiredAt = baseTime + parsed.ms;
      }
      userPremium.status = true;
      if (typeof db?.write === "function") {
        db.write(global.db);
      }
      const successText = `–  *S E T  P R E M I U M*

┌  ◦  *Status* : Sukses (VIP Member)
│  ◦  *Target* : @${cleanNum}
│  ◦  *Durasi Tambahan* : +${parsed.label}
└  ◦  *Expired* : ${formatDate(userPremium.expiredAt)}

Pengguna di atas telah berhasil diberikan akses penuh ke seluruh fitur premium bot.`;
      await sock.sendMessage(ctx.id, {
        text: successText,
        mentions: [targetJid]
      }, {
        quoted: quotedMsg
      });
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (e) {
      console.error("[SetPremium Error]:", e?.message || e);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ SetPremium Error: ${e?.message || e}`);
    }
  }
};