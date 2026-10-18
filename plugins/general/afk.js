import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  parseMention,
  decodeJid,
  extractNum,
  safeSendMessage
} from "../../core/serialize.js";
export default {
  name: "afk",
  aliases: ["away"],
  description: "Mengaktifkan mode AFK (Away From Keyboard) dengan alasan",
  category: "General",
  example: ".afk Sedang makan / tidur",
  execute: async (sock, ctx, msg) => {
    let inputReason = (ctx.query || "").trim();
    if (!inputReason && ctx.quoted?.senderNumber) {
      inputReason = `Ada urusan dengan @${ctx.quoted.senderNumber}`;
    }
    let parsedReason = inputReason ? inputReason.replace(/([0-9]{8,20})@s\.whatsapp\.net/gi, "@$1").replace(/(^|\s)([0-9]{8,20})(?=\s|$)/g, "$1@$2") : "Tanpa alasan";
    const reason = parsedReason;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const userJid = ctx.userPhoneJid || ctx.sender;
    const senderNumber = ctx.senderNumber || extractNum(userJid);
    if (typeof db?.ensureUser === "function") {
      db.ensureUser(userJid, ctx.pushname || senderNumber);
    }
    const userObj = ctx.user || global.db?.user?.[userJid];
    if (userObj) {
      userObj.afk = {
        afkTime: Date.now(),
        reason: reason
      };
    }
    if (typeof db?.write === "function") {
      db.write(global.db);
    }
    await ctx.react("💤").catch(() => {});
    const timeNow = new Date().toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta"
    }) + " WIB";
    const text = `–  *A F K*

Mode AFK (Away From Keyboard) berhasil diaktifkan.

┌  ◦  *User* : @${senderNumber}
│  ◦  *Reason* : ${reason}
└  ◦  *Time* : ${timeNow}

Sistem akan otomatis memberitahu siapa saja yang menandai Anda.`;
    const rawMentions = [userJid, `${senderNumber}@s.whatsapp.net`, ...ctx.mentionedJid || [], ...ctx.mentions || [], ...ctx.quoted?.sender ? [ctx.quoted.sender] : [], ...parseMention(reason), ...parseMention(text)];
    const cleanMentions = [...new Set(rawMentions.filter(Boolean).map(j => {
      let clean = decodeJid(String(j).trim());
      if (clean.endsWith("@lid") && global.lidPhoneCache?.has(clean)) {
        clean = global.lidPhoneCache.get(clean);
      }
      const num = clean.split("@")[0].replace(/\D/g, "");
      return num.length >= 6 ? `${num}@s.whatsapp.net` : null;
    }).filter(Boolean))];
    return await ctx.reply(text, {
      quoted: quotedMsg,
      mentions: cleanMentions
    });
  }
};