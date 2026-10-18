import {
  copyNForward,
  decodeJid
} from "../../core/serialize.js";
export default {
  name: "rvo",
  aliases: ["readviewonce", "readvo", "antiviewonce", "openvo", "lihatvo"],
  description: "Buka pesan sekali lihat (View Once) apa adanya langsung dikirim tanpa tanda diteruskan.",
  category: "Tools",
  example: "Reply pesan view once dengan .rvo",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.quoted) {
        return ctx.reply("❌ Harap reply pesan sekali lihat (View Once) yang ingin dibuka!");
      }
      await ctx.react("⏳");
      let targetJid = ctx.chat || ctx.id;
      if (!ctx.isGroup && targetJid?.endsWith("@lid")) {
        targetJid = ctx.sender?.endsWith("@s.whatsapp.net") ? ctx.sender : targetJid;
      }
      targetJid = decodeJid(targetJid);
      let m = ctx.quoted.fakeObj?.message || ctx.quoted.message || ctx.quoted.rawMessage?.message || ctx.quoted;
      if (m?.viewOnceMessage?.message) m = m.viewOnceMessage.message;
      if (m?.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
      if (m?.viewOnceMessageV2Extension?.message) m = m.viewOnceMessageV2Extension.message;
      await copyNForward(sock, targetJid, m, false, {}, msg);
      await ctx.react("✅");
    } catch (error) {
      console.error("[RVO Error]:", error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal membuka View Once: ${error?.message || error}`);
    }
  }
};