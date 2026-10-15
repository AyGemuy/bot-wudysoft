import {
  copyNForward,
  decodeJid
} from "../../core/serialize.js";
export default {
  name: "q",
  aliases: ["quoted", "getquoted", "r", "rquoted"],
  description: "Ambil dan forward pesan yang dikutip di dalam reply (nested quoted)",
  category: "Tools",
  example: "Balas pesan yang memiliki kutipan lalu ketik .q",
  execute: async (sock, ctx, msg) => {
    if (!ctx.quoted) {
      return ctx.reply("❌ Balas pesan yang mengandung kutipan (reply)!");
    }
    try {
      await ctx.react?.("⏳");
      const chatId = decodeJid(ctx.chat || ctx.id);
      const q = await ctx.getQuotedObj?.().catch(() => null) || ctx.quoted;
      const nested = q?.quoted || ctx.quoted?.quoted;
      if (!nested) {
        await ctx.react?.("❌");
        return ctx.reply("❌ Pesan yang Anda balas tidak memiliki kutipan (nested reply) di dalamnya!");
      }
      const targetObj = nested.fakeObj || nested.vM || nested.rawMessage || nested.message || nested;
      if (typeof nested.copyNForward === "function") {
        await nested.copyNForward(chatId, true, {}, msg);
      } else if (typeof ctx.copyNForward === "function") {
        await ctx.copyNForward(chatId, targetObj, true, {}, msg);
      } else if (typeof copyNForward === "function") {
        await copyNForward(sock, chatId, targetObj, true, {}, msg);
      } else if (typeof sock.copyNForward === "function") {
        await sock.copyNForward(chatId, targetObj, true, {}, msg);
      }
      await ctx.react?.("✅");
    } catch (e) {
      console.error("[Q COMMAND ERROR]:", e);
      await ctx.react?.("❌");
      ctx.reply(`❌ Gagal mengambil kutipan pesan: ${e.message || e}`);
    }
  }
};