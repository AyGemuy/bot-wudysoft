import {
  areJidsSameUser
} from "@whiskeysockets/baileys";
export default {
  name: "antivideo",
  description: "Mendeteksi dan menghapus video yang dikirim di dalam grup",
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
      const isAntiVideo = groupData?.antivideo === true || global.bot?.antivideo === true;
      if (!isAntiVideo) return;
      const rawMsgObj = msg?.message || ctx.rawMessage || {};
      const innerMessage = rawMsgObj?.ephemeralMessage?.message || rawMsgObj?.viewOnceMessage?.message || rawMsgObj?.viewOnceMessageV2?.message || rawMsgObj?.documentWithCaptionMessage?.message || rawMsgObj;
      const isVideo = Boolean(innerMessage?.videoMessage || innerMessage?.ptvMessage || rawMsgObj?.videoMessage || rawMsgObj?.ptvMessage || ctx.mtype === "videoMessage" || ctx.mtype === "ptvMessage" || ctx.msgType === "videoMessage" || ctx.msgType === "ptvMessage" || ctx.isVideo === true);
      const senderJid = msg?.key?.participant || msg?.key?.remoteJid || ctx.sender;
      const myId = sock.user?.id || sock.user?.jid || "";
      const isFromMe = Boolean(msg?.key?.fromMe || ctx.isFromMe || senderJid && myId && areJidsSameUser(senderJid, myId));
      if (!isVideo || isFromMe) return;
      console.log(`[ ANTI VIDEO ] Mendeteksi video dari ${senderJid} di grup ${ctx.chat}`);
      if (ctx.isBotAdmin) {
        await ctx.delete().catch(() => {});
      }
      const senderNum = senderJid ? senderJid.split("@")[0] : "User";
      await ctx.reply(`–  *A N T I - V I D E O*\n\nMaaf @${senderNum}, dilarang mengirim video di grup ini!`, {
        mentions: [senderJid]
      });
      return true;
    } catch (e) {
      console.error("[ANTI VIDEO ERROR]", e);
    }
  }
};