import * as Baileys from "@whiskeysockets/baileys";
import {
  decodeJid
} from "../../core/serialize.js";
const {
  proto,
  generateWAMessageFromContent
} = Baileys;
const WA_DEFAULT_EPHEMERAL = 7 * 24 * 60 * 60;
export default {
  name: "toviewonce",
  aliases: ["tovo", "setvo", "makevo", "viewonce"],
  description: "Ubah pesan atau media apapun menjadi pesan sekali lihat (View Once).",
  category: "Tools",
  example: "Reply pesan dengan .tovo atau ketik .tovo <teks>",
  execute: async (sock, ctx, msg) => {
    try {
      let targetJid = ctx.chat || ctx.id;
      if (!ctx.isGroup && targetJid?.endsWith("@lid")) {
        targetJid = ctx.sender?.endsWith("@s.whatsapp.net") ? ctx.sender : targetJid;
      }
      targetJid = decodeJid(targetJid);
      let innerMessage = null;
      if (ctx.quoted) {
        let m = ctx.quoted.fakeObj?.message || ctx.quoted.message || ctx.quoted.msg || ctx.quoted;
        if (m?.viewOnceMessage?.message) m = m.viewOnceMessage.message;
        if (m?.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
        innerMessage = m?.message || m;
      } else if (ctx.query) {
        innerMessage = {
          extendedTextMessage: {
            text: ctx.query.trim()
          }
        };
      }
      if (!innerMessage) {
        return ctx.reply("❌ Reply pesan yang ingin dijadikan View Once, atau ketik: `.tovo <teks>`!");
      }
      await ctx.react("⏳");
      const viewOnceContent = proto.Message.fromObject({
        viewOnceMessage: {
          message: innerMessage
        }
      });
      const gen = await generateWAMessageFromContent(targetJid, viewOnceContent, {
        quoted: msg,
        ephemeralExpiration: WA_DEFAULT_EPHEMERAL
      });
      await sock.relayMessage(targetJid, gen.message, {
        messageId: gen.key.id
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[toViewOnce Error]:", error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal mengubah ke View Once: ${error?.message || error}`);
    }
  }
};