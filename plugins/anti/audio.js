import {
  areJidsSameUser
} from "@whiskeysockets/baileys";
export default {
  name: "antiaudio",
  description: "Mendeteksi dan menghapus audio/voice note yang dikirim di dalam grup",
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
      const isAntiAudio = groupData?.antiaudio === true || global.bot?.antiaudio === true;
      if (!isAntiAudio) return;
      const rawMsgObj = msg?.message || ctx.rawMessage || {};
      const innerMessage = rawMsgObj?.ephemeralMessage?.message || rawMsgObj?.viewOnceMessage?.message || rawMsgObj?.viewOnceMessageV2?.message || rawMsgObj?.documentWithCaptionMessage?.message || rawMsgObj;
      const isAudio = Boolean(innerMessage?.audioMessage || rawMsgObj?.audioMessage || ctx.mtype === "audioMessage" || ctx.msgType === "audioMessage" || ctx.isAudio === true);
      const senderJid = msg?.key?.participant || msg?.key?.remoteJid || ctx.sender;
      const myId = sock.user?.id || sock.user?.jid || "";
      const isFromMe = Boolean(msg?.key?.fromMe || ctx.isFromMe || senderJid && myId && areJidsSameUser(senderJid, myId));
      if (!isAudio || isFromMe) return;
      console.log(`[ ANTI AUDIO ] Mendeteksi audio dari ${senderJid} di grup ${ctx.chat}`);
      if (ctx.isBotAdmin) {
        await ctx.delete().catch(() => {});
      }
      const senderNum = senderJid ? senderJid.split("@")[0] : "User";
      await ctx.reply(`–  *A N T I - A U D I O*\n\nMaaf @${senderNum}, dilarang mengirim pesan suara/audio di grup ini!`, {
        mentions: [senderJid]
      });
      return true;
    } catch (e) {
      console.error("[ANTI AUDIO ERROR]", e);
    }
  }
};