import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
import {
  decodeJid,
  extractNum
} from "../../core/serialize.js";
import db from "../../data/db.js";
export default {
  name: "totalchat",
  aliases: ["memberchat", "topchat", "chatcount", "rankchat"],
  description: "Melihat peringkat dan total pesan yang dikirim oleh setiap member di dalam grup (Full DB)",
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
      const rawGroupId = decodeJid(ctx.id || ctx.chat || msg.key?.remoteJid || "");
      const groupId = rawGroupId.endsWith("@g.us") ? rawGroupId : `${rawGroupId.split("@")[0]}@g.us`;
      const groupNumId = groupId.split("@")[0].replace(/\D/g, "");
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botContext = global.bot?.utils?.contextInfo || {};
      const cachedMeta = global.groupCache?.get(groupId)?.data;
      const groupData = global.db?.group?.[groupId];
      const groupSubject = cachedMeta?.subject || groupData?.subject || ctx.groupMetadata?.subject || "Grup WhatsApp";
      const totalMemberInCache = cachedMeta?.participants?.length || groupData?.memberCount || null;
      const botId = decodeJid(sock.user?.id || sock.user?.jid || "");
      const botLid = sock.user?.lid ? decodeJid(sock.user.lid) : null;
      const botNumber = extractNum(botId);
      const usersDb = global.db?.user || db?.user || {};
      const userMap = new Map();
      let groupTotalMessages = 0;
      for (const [rawJid, uData] of Object.entries(usersDb)) {
        if (!uData || typeof uData !== "object") continue;
        let count = uData.chatCount?.[groupId] || 0;
        if (!count && uData.chatCount) {
          for (const [gid, c] of Object.entries(uData.chatCount)) {
            if (gid.includes(groupNumId)) {
              count = Number(c) || 0;
              break;
            }
          }
        }
        if (!count || count <= 0) continue;
        let cleanJid = decodeJid(rawJid);
        if (cleanJid.endsWith("@lid")) {
          const lidNum = cleanJid.split("@")[0].split(":")[0];
          const cachedPhone = global.lidPhoneCache?.get(lidNum);
          if (cachedPhone) cleanJid = `${cachedPhone}@s.whatsapp.net`;
        }
        const cleanNumber = extractNum(cleanJid);
        const isBotUser = Boolean(uData.isBot === true || uData.isBaileys === true || cleanJid === botId || botLid && cleanJid === botLid || cleanNumber && botNumber && cleanNumber === botNumber);
        groupTotalMessages += count;
        const currentData = userMap.get(cleanJid) || {
          jid: cleanJid,
          name: uData.name || cleanNumber,
          isBot: isBotUser,
          count: 0
        };
        currentData.count += count;
        if (isBotUser) currentData.isBot = true;
        userMap.set(cleanJid, currentData);
      }
      const chatStats = Array.from(userMap.values());
      chatStats.sort((a, b) => b.count - a.count);
      ctx.react?.("✅");
      let responseText = `–  *T O T A L  C H A T  M E M B E R*\n\n`;
      responseText += `┌  ◦  *Grup* : ${groupSubject}\n`;
      if (totalMemberInCache) {
        responseText += `│  ◦  *Total Member* : ${totalMemberInCache}\n`;
      }
      responseText += `└  ◦  *Total Chat Terrekam* : ${groupTotalMessages} pesan\n\n`;
      const mentionedJids = [];
      if (chatStats.length > 0) {
        responseText += `*Peringkat Member Teraktif :*\n`;
        chatStats.slice(0, 50).forEach((item, index) => {
          const num = extractNum(item.jid);
          if (item.jid.endsWith("@s.whatsapp.net")) {
            mentionedJids.push(item.jid);
          }
          const botBadge = item.isBot ? " 🤖 *(Bot)*" : "";
          responseText += `┌  ◦  *${index + 1}.* @${num || item.jid.split("@")[0]}${botBadge}\n`;
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