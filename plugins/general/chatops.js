import {
  metaQuoted,
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "chatops",
  aliases: ["pinchat", "unpinchat", "mutechat", "unmutechat", "archive", "unarchive", "markread", "markunread", "clearchat"],
  description: "Manajemen dan operasi obrolan WhatsApp (Archive, Mute, Pin, Read/Unread) [Owner Only]",
  category: "Owner",
  owner: true,
  example: ".pinchat | .mutechat 8h | .archive | .markread",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const cmd = (ctx.cmd || ctx.command || "").toLowerCase();
      const botMsg = global.bot?.msg || {};
      const botContext = global.bot?.utils?.contextInfo || {};
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!ctx.isOwner) {
        return ctx.reply(botMsg.owner || "–  *A C C E S S  D E N I E D*");
      }
      const chatId = ctx.id;
      ctx.react?.("⏳");
      if (["pinchat", "unpinchat"].includes(cmd)) {
        const isPin = cmd === "pinchat";
        await sock.chatModify({
          pin: isPin
        }, chatId);
        ctx.react?.("✅");
        return ctx.reply(`✅ Obrolan berhasil ${isPin ? "disematkan (Pinned) 📌" : "dilepas sematan (Unpinned)"}.`);
      }
      if (["archive", "unarchive"].includes(cmd)) {
        const isArchive = cmd === "archive";
        await sock.chatModify({
          archive: isArchive,
          lastMessages: [msg]
        }, chatId);
        ctx.react?.("✅");
        return ctx.reply(`✅ Obrolan berhasil ${isArchive ? "diarsipkan 🗄️" : "dikeluarkan dari arsip"}.`);
      }
      if (["mutechat", "unmutechat"].includes(cmd)) {
        if (cmd === "unmutechat") {
          await sock.chatModify({
            mute: null
          }, chatId);
          ctx.react?.("✅");
          return ctx.reply("🔔 Obrolan berhasil di-unmute.");
        }
        const durationArg = (ctx.args?.[0] || "8h").toLowerCase();
        let ms = 8 * 3600 * 1e3;
        if (durationArg.endsWith("h")) ms = parseFloat(durationArg) * 3600 * 1e3;
        else if (durationArg.endsWith("d")) ms = parseFloat(durationArg) * 86400 * 1e3;
        else if (durationArg === "forever" || durationArg === "selamanya") ms = 365 * 86400 * 1e3;
        await sock.chatModify({
          mute: ms
        }, chatId);
        ctx.react?.("✅");
        return ctx.reply(`🔕 Obrolan berhasil dibisukan selama *${durationArg}*.`);
      }
      if (["markread", "markunread"].includes(cmd)) {
        const isRead = cmd === "markread";
        await sock.chatModify({
          markRead: isRead
        }, chatId);
        ctx.react?.("✅");
        return ctx.reply(`✅ Obrolan ditandai sebagai *${isRead ? "Sudah Dibaca" : "Belum Dibaca"}*.`);
      }
      if (cmd === "clearchat") {
        await sock.chatModify({
          delete: true,
          lastMessages: [{
            key: msg.key,
            messageTimestamp: msg.messageTimestamp
          }]
        }, chatId);
        ctx.react?.("✅");
        return ctx.reply("🧹 Riwayat obrolan berhasil dibersihkan.");
      }
    } catch (err) {
      console.error("[CHATOPS Error]:", err);
      ctx.react?.("❌");
      ctx.reply(`❌ Gagal: ${err?.message || err}`);
    }
  }
};