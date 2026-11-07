import {
  areJidsSameUser
} from "@whiskeysockets/baileys";
import chalk from "chalk";
export default {
  name: "antiimage",
  description: "Mendeteksi dan menghapus foto/gambar yang dikirim di dalam grup jika fitur diaktifkan",
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
      const isAntiImage = groupData?.antiimage === true || global.bot?.antiimage === true;
      if (!isAntiImage) return;
      const rawMsgObj = msg?.message || ctx.rawMessage || {};
      const innerMessage = rawMsgObj?.ephemeralMessage?.message || rawMsgObj?.viewOnceMessage?.message || rawMsgObj?.viewOnceMessageV2?.message || rawMsgObj?.documentWithCaptionMessage?.message || rawMsgObj;
      const isImage = Boolean(innerMessage?.imageMessage || rawMsgObj?.imageMessage || ctx.mtype === "imageMessage" || ctx.msgType === "imageMessage" || ctx.isImage === true);
      if (!isImage) return;
      const senderJid = msg?.key?.participant || msg?.key?.remoteJid || ctx.sender;
      const myId = sock.user?.id || sock.user?.jid || "";
      const isFromMe = Boolean(msg?.key?.fromMe || ctx.isFromMe || senderJid && myId && areJidsSameUser(senderJid, myId));
      if (isFromMe) return;
      console.log(chalk.yellow(`[ ANTI IMAGE ] Mendeteksi gambar/foto dari ${senderJid} di grup ${ctx.chat}`));
      if (ctx.isBotAdmin) {
        await ctx.delete().catch(() => {});
      }
      const prefix = ctx.prefix || ".";
      const senderNum = senderJid ? senderJid.split("@")[0] : "User";
      const botName = global.bot?.name || "Security";
      const botFooter = `${botName} • Group Protection`;
      const warningText = `–  *A N T I - I M A G E*

⚠️ Peringatan untuk @${senderNum}!
Dilarang mengirim foto / gambar di grup ini!

┌  ◦  *Pelanggaran* : Foto / Gambar
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
      console.error("[ANTI IMAGE ERROR]", e);
    }
  }
};