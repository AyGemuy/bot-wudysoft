import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
import {
  resolveLidToJid,
  resolveLidProactively,
  decodeJid,
  extractNum
} from "../../core/serialize.js";
import db from "../../data/db.js";

function ensureUserDb(jid, name = "Member") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  try {
    db?.ensureUser?.(jid);
  } catch (_) {}
  if (!global.db.user[jid]) {
    global.db.user[jid] = {
      id: jid,
      name: name,
      lastSeen: 0,
      presence: "offline",
      chatCount: {}
    };
  }
  if (!global.db.user[jid].chatCount) {
    global.db.user[jid].chatCount = {};
  }
  return global.db.user[jid];
}
export default {
  name: "totalchat",
  aliases: ["memberchat", "topchat", "chatcount", "rankchat"],
  description: "Melihat peringkat dan total pesan yang dikirim oleh setiap member di dalam grup",
  category: "Group",
  group: true,
  admin: false,
  example: ".totalchat",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isGroup && !ctx.id?.endsWith("@g.us")) {
        return ctx.reply("❌ Fitur ini khusus hanya dapat digunakan di dalam grup.");
      }
      ctx.react?.("⏳");
      const groupId = ctx.id;
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botContext = global.bot?.utils?.contextInfo || {};
      const groupMeta = await sock.groupMetadata(groupId).catch(() => null);
      if (!groupMeta || !groupMeta.participants?.length) {
        ctx.react?.("❌");
        return ctx.reply("❌ Gagal memuat metadata anggota grup.");
      }
      const participants = groupMeta.participants;
      const memberList = [];
      for (const p of participants) {
        const rawJid = decodeJid(p.id || p.jid || p.phoneNumber || "");
        if (!rawJid) continue;
        let userJid = rawJid;
        const isLid = rawJid.endsWith("@lid");
        if (isLid) {
          if (p.phoneNumber) {
            const clean = String(p.phoneNumber).replace(/\D/g, "");
            if (clean.length >= 6) userJid = `${clean}@s.whatsapp.net`;
          }
          if (userJid.endsWith("@lid")) {
            userJid = await resolveLidToJid(rawJid, sock, null, participants);
          }
          if (userJid.endsWith("@lid") && typeof resolveLidProactively === "function") {
            const pro = await resolveLidProactively(sock, userJid);
            if (pro.jid) userJid = pro.jid;
          }
          if (userJid.endsWith("@lid")) {
            const num = extractNum(userJid);
            if (num) userJid = `${num}@s.whatsapp.net`;
          }
        }
        memberList.push({
          rawJid: rawJid,
          userJid: userJid
        });
      }
      const usersDb = global.db?.user || db?.user || {};
      const chatStats = [];
      let groupTotalMessages = 0;
      for (const m of memberList) {
        const cleanNumber = extractNum(m.userJid);
        const userData = usersDb[m.userJid] || (cleanNumber ? usersDb[`${cleanNumber}@s.whatsapp.net`] : null) || usersDb[m.rawJid];
        const count = userData?.chatCount?.[groupId] || 0;
        groupTotalMessages += count;
        if (count > 0) {
          const displayJid = !m.userJid.endsWith("@lid") ? m.userJid : m.rawJid;
          chatStats.push({
            jid: displayJid,
            count: count
          });
        }
      }
      chatStats.sort((a, b) => b.count - a.count);
      ctx.react?.("✅");
      let responseText = `–  *T O T A L  C H A T  M E M B E R*\n\n`;
      responseText += `┌  ◦  *Grup* : ${groupMeta.subject}\n`;
      responseText += `│  ◦  *Total Member* : ${participants.length}\n`;
      responseText += `└  ◦  *Total Chat Terrekam* : ${groupTotalMessages} pesan\n\n`;
      const mentionedJids = [];
      if (chatStats.length > 0) {
        responseText += `*Peringkat Member Teraktif :*\n`;
        chatStats.forEach((item, index) => {
          const num = extractNum(item.jid);
          mentionedJids.push(item.jid);
          responseText += `┌  ◦  *${index + 1}.* @${num || item.jid.split("@")[0]}\n`;
          responseText += `└  ◦  *Pesan* : ${item.count} chat\n`;
        });
      } else {
        responseText += `_Belum ada riwayat akumulasi chat yang terdaftar untuk grup ini._`;
      }
      return await sock.sendMessage(ctx.id, {
        text: responseText,
        mentions: mentionedJids,
        contextInfo: {
          ...botContext,
          mentionedJid: mentionedJids
        }
      }, {
        quoted: quotedMsg
      });
    } catch (error) {
      console.error("[TotalChat Error]:", error);
      ctx.react?.("❌");
      ctx.reply(`❌ Gagal menampilkan total chat: ${error?.message || error}`);
    }
  }
};