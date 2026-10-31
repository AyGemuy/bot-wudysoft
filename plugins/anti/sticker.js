import {
  areJidsSameUser
} from "@whiskeysockets/baileys";
import chalk from "chalk";
export default {
  name: "antisticker",
  description: "Mendeteksi dan menghapus stiker yang dikirim di dalam grup jika fitur diaktifkan",
  category: "Handler",
  execute: async () => {},
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isGroup = ctx.isGroup;
      if (!isGroup) return;
      const groupData = global.db?.group?.[ctx.chat] || {};
      const isAntiSticker = groupData?.antisticker === true || global.bot?.antisticker === true;
      if (!isAntiSticker) return;
      const rawMsgObj = msg?.message || ctx.rawMessage || {};
      const innerMessage = rawMsgObj?.ephemeralMessage?.message || rawMsgObj?.viewOnceMessage?.message || rawMsgObj?.viewOnceMessageV2?.message || rawMsgObj?.documentWithCaptionMessage?.message || rawMsgObj;
      const isSticker = Boolean(innerMessage?.stickerMessage || rawMsgObj?.stickerMessage || ctx.mtype === "stickerMessage" || ctx.msgType === "stickerMessage" || ctx.isSticker === true);
      if (!isSticker) return;
      const senderJid = msg?.key?.participant || msg?.key?.remoteJid || ctx.sender;
      const myId = sock.user?.id || sock.user?.jid || "";
      const isFromMe = Boolean(msg?.key?.fromMe || ctx.isFromMe || senderJid && myId && areJidsSameUser(senderJid, myId));
      if (isFromMe) return;
      console.log(chalk.green(`[ ANTI STICKER ] Mendeteksi stiker dari ${senderJid}`));
      if (ctx.isBotAdmin) {
        await ctx.delete().catch(() => {});
      }
      const senderNum = senderJid ? senderJid.split("@")[0] : "User";
      await ctx.reply(`–  *A N TI - S T I C K E R*\n\nMaaf @${senderNum}, dilarang mengirim stiker di grup ini!`, {
        mentions: [senderJid]
      });
      return true;
    } catch (e) {
      console.error("[ANTI STICKER ERROR]", e);
    }
  }
};