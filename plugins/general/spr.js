import sPR from "../../core/spr.js";
import {
  decodeJid
} from "../../core/serialize.js";
export default {
  name: "spr",
  aliases: ["privaterelay", "secretmsg", "pesanrahasia", "stealth"],
  description: "Kirim pesan terenkripsi di grup yang hanya bisa dibuka/dibaca oleh target tertentu.",
  category: "Group",
  example: ["Tag target: .spr @tag Halo, cuma kamu yang bisa baca pesan ini", "Reply pesan target: .spr Pesan rahasia untukmu", "Mode sembunyikan dari target: .spr --exclude @tag Pesan untuk semua orang selain target"].join("\n"),
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isGroup) {
        return ctx.reply("❌ Fitur Private Relay (sPR) hanya dapat digunakan di dalam grup!");
      }
      await ctx.react("⏳");
      const rawText = ctx.text || ctx.args?.join(" ") || "";
      const isExclude = rawText.includes("--exclude");
      const isPrimaryOnly = rawText.includes("--primary") || rawText.includes("--pri");
      const isSecondaryOnly = rawText.includes("--secondary") || rawText.includes("--sec");
      let cleanText = rawText.replace(/--exclude/gi, "").replace(/--primary|--pri/gi, "").replace(/--secondary|--sec/gi, "").replace(/@\d+/g, "").trim();
      let targets = [];
      if (ctx.mentionedJid && ctx.mentionedJid.length > 0) {
        targets.push(...ctx.mentionedJid);
      }
      if (ctx.quoted?.sender) {
        targets.push(ctx.quoted.sender);
      }
      targets = [...new Set(targets.map(jid => decodeJid(jid)).filter(Boolean))];
      if (targets.length === 0) {
        await ctx.react("❓");
        return ctx.reply("❌ Harap mention (@target) atau reply chat seseorang yang ingin dijadikan target relay!");
      }
      let messagePayload = null;
      if (cleanText) {
        messagePayload = {
          extendedTextMessage: {
            text: cleanText,
            contextInfo: {
              mentionedJid: targets
            }
          }
        };
      } else if (ctx.quoted) {
        let m = ctx.quoted.fakeObj?.message || ctx.quoted.message || ctx.quoted.rawMessage?.message || ctx.quoted;
        if (m?.viewOnceMessage?.message) m = m.viewOnceMessage.message;
        if (m?.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
        messagePayload = m;
      } else {
        await ctx.react("❌");
        return ctx.reply("❌ Masukkan teks pesan atau reply sebuah pesan yang ingin dikirim secara private!");
      }
      let deviceMode = "all";
      if (isPrimaryOnly) deviceMode = "primary";
      if (isSecondaryOnly) deviceMode = "secondary";
      const targetJid = decodeJid(ctx.chat || ctx.id);
      await sPR(sock, targetJid, messagePayload, {
        mode: isExclude ? "exclude" : "include",
        target: targets,
        deviceMode: deviceMode,
        targetMe: true,
        hideDecryptFail: true
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[sPR Error]:", error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal mengirim Private Relay: ${error?.message || error}`);
    }
  }
};