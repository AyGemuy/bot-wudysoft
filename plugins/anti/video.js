import {
  areJidsSameUser
} from "@whiskeysockets/baileys";
import chalk from "chalk";
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
      console.log(chalk.yellow(`[ ANTI VIDEO ] Mendeteksi video dari ${senderJid} di grup ${ctx.chat}`));
      if (ctx.isBotAdmin) {
        await ctx.delete().catch(() => {});
      }
      const prefix = ctx.prefix || ".";
      const senderNum = senderJid ? senderJid.split("@")[0] : "User";
      const botName = global.bot?.name || "Security";
      const botFooter = `${botName} • Group Protection`;
      const warningText = `–  *A N T I - V I D E O*

⚠️ Peringatan untuk @${senderNum}!
Dilarang mengirim video di grup ini!

┌  ◦  *Pelanggaran* : Video / Pesan Video Bulat
└  ◦  *Tindakan*    : Pesan telah dihapus oleh bot.

_Admin dapat menentukan tindakan selanjutnya melalui tombol di bawah:_`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🚨 Kick Pelanggar",
          id: `${prefix}kick @${senderNum}`
        })
      }];
      const ctaOptions = {
        contextInfo: {
          mentionedJid: [senderJid]
        }
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(warningText, botFooter, buttons, ctaOptions);
      } else {
        await ctx.reply(warningText, {
          mentions: [senderJid]
        });
      }
      return true;
    } catch (e) {
      console.error("[ANTI VIDEO ERROR]", e);
    }
  }
};