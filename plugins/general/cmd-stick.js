import crypto from "crypto";
import chalk from "chalk";
import db from "../../data/db.js";

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.stickerCmd) global.db.stickerCmd = {};
  if (!global.db.stats) global.db.stats = {};
  if (jid && !jid.includes("BOT") && !global.db.user[jid]) {
    global.db.user[jid] = {
      name: name || "",
      money: 1e4,
      exp: 0,
      limit: 100
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}
const stickerCooldowns = new Map();

function getSha256Hex(rawSha) {
  if (!rawSha) return null;
  try {
    if (Buffer.isBuffer(rawSha) || rawSha instanceof Uint8Array || Array.isArray(rawSha)) {
      return Buffer.from(rawSha).toString("hex").toLowerCase();
    }
    if (typeof rawSha === "string") {
      if (/^[0-9a-f]{64}$/i.test(rawSha)) return rawSha.toLowerCase();
      return Buffer.from(rawSha, "base64").toString("hex").toLowerCase();
    }
    if (typeof rawSha === "object" && rawSha.data) {
      return Buffer.from(rawSha.data).toString("hex").toLowerCase();
    }
  } catch {}
  return null;
}

function extractPageNumber(query = "", args = []) {
  const match = query.match(/--page[=\s]+(\d+)/i) || query.match(/--p[=\s]+(\d+)/i);
  if (match) return parseInt(match[1]);
  for (const arg of args) {
    if (!isNaN(arg) && parseInt(arg) > 0) return parseInt(arg);
  }
  return 1;
}
export default {
  name: "stickercmd",
  aliases: ["addcmd", "setcmd", "delcmd", "deletecmd", "listcmd", "cmdsticker"],
  description: "Pasang perintah pada stiker & kirim stiker langsung dari menu list (Full DB)",
  category: "Tools",
  example: "Reply stiker dengan .addcmd .menu | .delcmd | .listcmd",
  before: async (msg, {
    sock,
    ctx,
    cmd,
    isOwner,
    isROwner,
    isPremium
  }) => {
    try {
      if (!ctx || ctx.isFromMe || ctx.isBot) return false;
      const userTypedText = (typeof ctx.text === "string" && ctx.text.trim() || typeof ctx.body === "string" && ctx.body.trim() || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      if (userTypedText.length > 0) {
        return false;
      }
      let messageRoot = msg?.message;
      if (messageRoot?.ephemeralMessage) messageRoot = messageRoot.ephemeralMessage.message;
      if (messageRoot?.viewOnceMessage) messageRoot = messageRoot.viewOnceMessage.message;
      if (messageRoot?.viewOnceMessageV2) messageRoot = messageRoot.viewOnceMessageV2.message;
      const isActualSticker = Boolean(messageRoot?.stickerMessage);
      if (!isActualSticker) return false;
      initDB();
      const rawSha = messageRoot?.stickerMessage?.fileSha256;
      let shaHex = getSha256Hex(rawSha);
      if (!shaHex && typeof ctx.download === "function") {
        try {
          const buf = await ctx.download();
          if (buf && Buffer.isBuffer(buf)) {
            shaHex = crypto.createHash("sha256").update(buf).digest("hex").toLowerCase();
          }
        } catch (_) {}
      }
      if (!shaHex || !global.db.stickerCmd[shaHex]) return false;
      const targetEntry = global.db.stickerCmd[shaHex];
      const boundCommand = (targetEntry?.command || "").trim();
      if (!boundCommand) return false;
      const prefixConfig = global.bot?.prefix || ["!", ".", "/", "#"];
      let matchedPrefix = "";
      if (prefixConfig instanceof RegExp) {
        matchedPrefix = boundCommand.match(prefixConfig)?.[0] || "";
      } else if (Array.isArray(prefixConfig)) {
        matchedPrefix = prefixConfig.find(p => boundCommand.startsWith(p)) || "";
      } else if (typeof prefixConfig === "string" && boundCommand.startsWith(prefixConfig)) {
        matchedPrefix = prefixConfig;
      }
      const cleanCommand = matchedPrefix ? boundCommand.slice(matchedPrefix.length).trim() : boundCommand;
      const parts = cleanCommand.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(p => p.replace(/^["']|["']$/g, "")) || [];
      const cmdName = (parts[0] || "").toLowerCase();
      const cmdArgs = parts.slice(1);
      const cmdQuery = cleanCommand.slice((parts[0] || "").length).trim();
      const commandObj = cmd?.getCommand?.(cmdName) || cmd?.getCommandByRegex?.(boundCommand);
      if (!commandObj) {
        await ctx.reply(boundCommand);
        return true;
      }
      const execFn = commandObj.execute || commandObj.run || commandObj.handler || commandObj.default || (typeof commandObj === "function" ? commandObj : null);
      if (!execFn || typeof execFn !== "function") return false;
      ctx.prefix = matchedPrefix;
      ctx.cmd = cmdName;
      ctx.command = cmdName;
      ctx.args = cmdArgs;
      ctx.query = cmdQuery;
      ctx.isStickerCmd = true;
      if (global.bot?.autoRead !== false) sock.readMessages([msg.key]).catch(() => {});
      if (global.bot?.autoTyping) sock.sendPresenceUpdate("composing", ctx.chat).catch(() => {});
      const userPhoneJid = ctx.userPhoneJid || ctx.sender;
      const cdTime = (commandObj.cooldown || global.bot?.cooldown || 3) * 1e3;
      const userCdKey = `stk_${userPhoneJid}_${cmdName}`;
      const now = Date.now();
      if (stickerCooldowns.has(userCdKey) && !isOwner) {
        const expirationTime = stickerCooldowns.get(userCdKey) + cdTime;
        if (now < expirationTime) {
          const timeLeft = ((expirationTime - now) / 1e3).toFixed(1);
          await ctx.reply(`⏳ Harap tunggu *${timeLeft}s* sebelum memakai stiker perintah ini lagi.`);
          return true;
        }
      }
      stickerCooldowns.set(userCdKey, now);
      setTimeout(() => stickerCooldowns.delete(userCdKey), cdTime);
      const time = new Date().toLocaleTimeString("id-ID", {
        hour12: false
      });
      const badge = ctx.isGroup ? chalk.bgHex("#0284C7").bold(" GRP ") : chalk.bgHex("#7C3AED").bold(" PVT ");
      const stickerBadge = chalk.bgHex("#10B981").bold(" [STICKER-CMD] ");
      const userName = ctx.pushname || ctx.pushName || "Unknown";
      const userTag = chalk.hex("#F59E0B")(userName) + chalk.hex("#64748B")(` (${ctx.senderNumber})`);
      const groupSubject = ctx.groupMetadata?.subject || "Group";
      const locationTag = ctx.isGroup ? chalk.hex("#38BDF8")(`[${groupSubject}]`) : chalk.hex("#A855F7")("[Private Chat]");
      const cmdFormatted = chalk.hex("#10B981").bold(`${matchedPrefix}${cmdName}`);
      console.log(`${chalk.hex("#475569")(`[${time}]`)} ${badge}${stickerBadge} ${chalk.hex("#EF4444")("⚡")} ${cmdFormatted} ${chalk.hex("#64748B")("from")} ${userTag} ${chalk.hex("#64748B")("in")} ${locationTag}`);
      const msgs = global.bot?.msg || {};
      const userData = global.db?.user?.[userPhoneJid] || {};
      if (commandObj.owner && !isOwner) {
        await ctx.reply(msgs.owner || "❌ Perintah stiker ini hanya untuk Owner Bot.");
        return true;
      }
      if (commandObj.premium && !isPremium) {
        await ctx.reply(msgs.premium || "💎 Perintah stiker ini khusus untuk *Pengguna Premium*.");
        return true;
      }
      if (commandObj.group && !ctx.isGroup) {
        await ctx.reply(msgs.group || "❌ Hanya bisa digunakan di grup.");
        return true;
      }
      if (commandObj.private && ctx.isGroup) {
        await ctx.reply(msgs.private || "❌ Hanya bisa digunakan di chat pribadi.");
        return true;
      }
      if (commandObj.admin && !ctx.isAdmin && !isOwner) {
        await ctx.reply(msgs.admin || "❌ Hanya untuk Admin Grup.");
        return true;
      }
      if (commandObj.botAdmin && !ctx.isBotAdmin) {
        await ctx.reply(msgs.botAdmin || "❌ Jadikan bot sebagai Admin Grup terlebih dahulu.");
        return true;
      }
      if (commandObj.limit && !isOwner && !isPremium) {
        const userLimit = userData?.limit ?? 0;
        if (userLimit <= 0) {
          await ctx.reply(msgs.limit || "❌ *Limit kamu sudah habis!*\n\n📌 Limit reset setiap hari pukul 00.00 WIB.");
          return true;
        }
        userData.limit = userLimit - 1;
        saveDB();
      }
      const extraPayload = {
        sock: sock,
        msg: msg,
        ctx: ctx,
        args: cmdArgs,
        text: cmdQuery,
        query: cmdQuery,
        command: cmdName,
        prefix: matchedPrefix,
        isOwner: isOwner,
        isROwner: isROwner,
        isPremium: isPremium,
        isAdmin: ctx.isAdmin,
        isBotAdmin: ctx.isBotAdmin
      };
      await execFn.call(commandObj, sock, ctx, msg, extraPayload);
      global.db.stats[cmdName] = (global.db.stats[cmdName] || 0) + 1;
      global.db.totalHits = (global.db.totalHits || 0) + 1;
      if (userData) {
        userData.exp = (userData.exp || 0) + Math.floor(Math.random() * 15) + 5;
        userData.money = (userData.money || 0) + Math.floor(Math.random() * 10) + 2;
        saveDB();
      }
      return true;
    } catch (err) {
      console.error(chalk.red("[STICKER CMD DIRECT EXEC ERROR]:"), err);
      await ctx.reply(`⚠️ Terjadi kesalahan saat menjalankan perintah stiker:\n\`\`\`${err?.message || err}\`\`\``);
      return true;
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      initDB();
      const alias = (ctx.cmd || ctx.command || "stickercmd").toLowerCase();
      const rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Sticker Command`;
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      if (rawQuery.startsWith("--get")) {
        const targetHash = rawQuery.replace(/^--get\s*/i, "").trim().toLowerCase();
        const item = global.db.stickerCmd[targetHash];
        if (!item) {
          return ctx.reply("❌ Stiker tidak ditemukan di database.");
        }
        if (item.data) {
          const stickerBuf = Buffer.from(item.data, "base64");
          return await sock.sendMessage(ctx.chat, {
            sticker: stickerBuf
          }, {
            quoted: msg
          });
        } else {
          return ctx.reply(`–  *S T I C K E R  C M D*

Gambar stiker tidak memiliki arsip data di database.

┌  ◦  *Command* : ${item.command}
└  ◦  *Action* : Reply stiker lalu ketik ${prefix}addcmd ${item.command}`);
        }
      }
      if (alias === "listcmd" || rawQuery.startsWith("--list")) {
        const entries = Object.entries(global.db.stickerCmd);
        if (!entries.length) {
          return ctx.reply(`–  *S T I C K E R  C M D*

Belum ada stiker yang dipasangi perintah di dalam database.

┌  ◦  *Action* : Reply stiker lalu ketik ${prefix}addcmd <command>
└  ◦  *Example* : ${prefix}addcmd .menu`);
        }
        const perPage = 10;
        const totalPages = Math.ceil(entries.length / perPage) || 1;
        let page = extractPageNumber(rawQuery, ctx.args || []);
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        const startIndex = (page - 1) * perPage;
        const currentItems = entries.slice(startIndex, startIndex + perPage);
        const currentItemsText = currentItems.map(([hashKey, item], i) => {
          const globalIndex = startIndex + i + 1;
          const isLast = i === currentItems.length - 1;
          const branch = isLast ? "└" : "│";
          const modeTag = item.noPrefix ? "(No-Prefix)" : "(Prefix)";
          return `${branch}  ◦  *${globalIndex}.* ${item.command} ${modeTag}`;
        }).join("\n");
        const rows = currentItems.map(([hashKey, item], idx) => {
          const globalIndex = startIndex + idx + 1;
          const uNum = item.creatorNumber || item.creator?.split("@")[0]?.replace(/\D/g, "") || "Unknown";
          const uName = item.creatorName || (typeof ctx.getName === "function" ? ctx.getName(item.creator) : "User");
          const modeTag = item.noPrefix ? "[NO-PREFIX]" : "[PREFIX]";
          return {
            header: `Stiker #${globalIndex} ${modeTag}`,
            title: `[ Kirim Stiker #${globalIndex} ]`,
            description: `Command: ${item.command} (${uName} - ${uNum})`.slice(0, 50),
            id: `${prefix}stickercmd --get ${hashKey}`
          };
        });
        const sections = [{
          title: `📦 DAFTAR STIKER (Hal ${page}/${totalPages})`,
          rows: rows
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `🖼️ AMBIL STIKER (Hal ${page}/${totalPages})`,
            sections: sections
          })
        }];
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${prefix}listcmd --page ${page - 1}`
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${prefix}listcmd --page ${page + 1}`
            })
          });
        }
        const bodyText = `Hi ${userName}!
Berikut adalah daftar stiker yang terhubung dengan perintah bot.

–  *S T I C K E R  C M D*

┌  ◦  *Total* : ${entries.length} Stiker
│  ◦  *Page* : ${page} / ${totalPages}
│  ◦  *Prefix* : [ ${prefix} ]
└  ◦  *Database* : Full In-DB Persistence

–  *C O M M A N D S*

${currentItemsText}

Pilih stiker dari menu di bawah untuk mengirim stiker fisiknya ke chat.`;
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, botFooter, buttons, {
            jid: ctx.id,
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 1,
                divider_indices: [1],
                list_title: `${botName} • Daftar Stiker Cmd`,
                button_title: `Buka Hal ${page}`
              }
            },
            quoted: msg
          });
        }
        return await ctx.reply(bodyText, {
          quoted: msg
        });
      }
      if (alias === "delcmd" || alias === "deletecmd" || rawQuery.startsWith("--del")) {
        let foundHash = null;
        let targetText = rawQuery.replace(/^--del\s*/i, "").trim().toLowerCase();
        if (ctx.quoted) {
          const qSha = ctx.quoted.msg?.fileSha256 || ctx.quoted.media?.fileSha256;
          const shaHex = getSha256Hex(qSha);
          if (shaHex && global.db.stickerCmd[shaHex]) {
            foundHash = shaHex;
          }
          if (!foundHash && (ctx.quoted.mediaType === "sticker" || /webp/i.test(ctx.quoted.mimetype || ""))) {
            try {
              let buf = null;
              if (typeof ctx.quoted.download === "function") {
                buf = await ctx.quoted.download();
              } else if (typeof ctx.download === "function") {
                buf = await ctx.download(ctx.quoted.msg || ctx.quoted.message);
              }
              if (buf && Buffer.isBuffer(buf)) {
                const bufHash = crypto.createHash("sha256").update(buf).digest("hex").toLowerCase();
                if (global.db.stickerCmd[bufHash]) foundHash = bufHash;
              }
            } catch {}
          }
        }
        if (!foundHash && targetText) {
          const cleanTarget = targetText.replace(/^[!./#]/, "");
          const matchEntry = Object.entries(global.db.stickerCmd).find(([, v]) => {
            const cmdClean = v.command.toLowerCase().replace(/^[!./#]/, "");
            return v.command.toLowerCase() === targetText || v.command.toLowerCase() === `${prefix}${targetText}` || cmdClean === cleanTarget;
          });
          if (matchEntry) foundHash = matchEntry[0];
        }
        if (!foundHash) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`–  *D E L  C M D*

Stiker perintah tidak ditemukan di dalam database.

┌  ◦  *Format* : ${prefix}delcmd <command> atau reply stiker
└  ◦  *Example* : ${prefix}delcmd .menu

Lihat daftar lengkap perintah stiker di *${prefix}listcmd*.`);
        }
        const deletedCmd = global.db.stickerCmd[foundHash]?.command || "Command";
        delete global.db.stickerCmd[foundHash];
        saveDB();
        if (typeof ctx.react === "function") await ctx.react("🗑️");
        return ctx.reply(`–  *D E L  C M D*

Perintah stiker *"${deletedCmd}"* berhasil dihapus dari database.`);
      }
      if (alias === "addcmd" || alias === "setcmd" || rawQuery.startsWith("--add")) {
        let isForcedNoPrefix = false;
        let commandToBind = rawQuery.replace(/^--add\s*/i, "").trim();
        if (/--noprefix|--np/i.test(commandToBind)) {
          isForcedNoPrefix = true;
          commandToBind = commandToBind.replace(/--noprefix|--np/gi, "").trim();
        }
        if (!commandToBind) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`–  *A D D  C M D*

Silakan tentukan perintah yang ingin dipasangkan ke stiker.

┌  ◦  *With Prefix* : reply stiker + ${prefix}addcmd .menu
│  ◦  *No Prefix* : reply stiker + ${prefix}addcmd ping
└  ◦  *Example* : reply stiker + ${prefix}addcmd .menu`);
        }
        const isSticker = ctx.quoted?.mediaType === "sticker" || /webp/i.test(ctx.quoted?.mimetype || "") || Boolean(ctx.quoted?.msg?.fileSha256);
        if (!ctx.quoted || !isSticker) {
          if (typeof ctx.react === "function") await ctx.react("⚠️");
          return ctx.reply("⚠️ Silakan balas (reply) stiker yang ingin dijadikan trigger perintah.");
        }
        if (typeof ctx.react === "function") await ctx.react("⏳");
        let stickerBuffer = null;
        if (typeof ctx.quoted.download === "function") {
          stickerBuffer = await ctx.quoted.download();
        } else if (typeof ctx.download === "function") {
          stickerBuffer = await ctx.download(ctx.quoted.msg || ctx.quoted.message);
        }
        let sha256Hex = getSha256Hex(ctx.quoted.msg?.fileSha256 || ctx.quoted.media?.fileSha256);
        if (!sha256Hex && stickerBuffer && Buffer.isBuffer(stickerBuffer)) {
          sha256Hex = crypto.createHash("sha256").update(stickerBuffer).digest("hex").toLowerCase();
        }
        if (!sha256Hex) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal mengenali identitas stiker.");
        }
        const isUpdate = Boolean(global.db.stickerCmd[sha256Hex]);
        const creatorNumber = ctx.senderNumber || ctx.sender?.split("@")[0]?.replace(/\D/g, "") || "Unknown";
        const creatorName = ctx.pushname || ctx.pushName || (typeof ctx.getName === "function" ? ctx.getName(ctx.sender) : "User");
        const startsWithPrefix = /^[!./#]/.test(commandToBind);
        const finalNoPrefix = isForcedNoPrefix || !startsWithPrefix;
        global.db.stickerCmd[sha256Hex] = {
          command: commandToBind,
          noPrefix: finalNoPrefix,
          hash: sha256Hex,
          data: stickerBuffer && Buffer.isBuffer(stickerBuffer) ? stickerBuffer.toString("base64") : global.db.stickerCmd[sha256Hex]?.data || null,
          creator: ctx.sender,
          creatorName: creatorName,
          creatorNumber: creatorNumber,
          updatedAt: Date.now(),
          createdAt: global.db.stickerCmd[sha256Hex]?.createdAt || Date.now()
        };
        saveDB();
        if (typeof ctx.react === "function") await ctx.react("✅");
        const statusText = isUpdate ? "diperbarui" : "berhasil dipasang";
        const successBody = `–  *A D D  C M D*

Perintah stiker ${statusText}.

┌  ◦  *Command* : ${commandToBind}
│  ◦  *Mode* : ${finalNoPrefix ? "No-Prefix" : "Prefix"}
│  ◦  *Author* : ${creatorName} (${creatorNumber})
└  ◦  *Status* : Active

Kirim stiker ini di chat untuk mengeksekusi perintah.`;
        const successButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📦 Cek Daftar Stiker",
            id: `${prefix}listcmd`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🗑️ Hapus Command Ini",
            id: `${prefix}delcmd ${commandToBind}`
          })
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(successBody, botFooter, successButtons, {
            jid: ctx.id,
            quoted: msg
          });
        }
        return ctx.reply(successBody, {
          mentions: [ctx.sender]
        });
      }
      const helperBody = `Hi ${userName}!
Panduan integrasi stiker WhatsApp menjadi pemicu perintah bot.

–  *S T I C K E R  C M D*

┌  ◦  *Add* : Reply stiker + ${prefix}addcmd .menu
│  ◦  *No-Prefix* : Reply stiker + ${prefix}addcmd ping
│  ◦  *Delete* : Reply stiker + ${prefix}delcmd
└  ◦  *List* : ${prefix}listcmd

Gunakan tombol di bawah untuk melihat daftar stiker terdaftar.`;
      const helperButtons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "📦 Daftar Stiker Command",
          id: `${prefix}listcmd`
        })
      }];
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(helperBody, botFooter, helperButtons, {
          jid: ctx.id,
          quoted: msg
        });
      }
      return await ctx.reply(helperBody, {
        quoted: msg
      });
    } catch (error) {
      console.error("[StickerCmd Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`Error: ${error?.message || error}`);
    }
  }
};