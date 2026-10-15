import {
  getMessagePayload
} from "../../core/serialize.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "hidetag",
  aliases: ["ht", "h", "totag", "tagall"],
  description: "Mention / Tag seluruh member grup (Support Teks, Foto, Video, VN, Stiker, Dokumen)",
  category: "Group",
  example: ".hidetag Pengumuman | Reply media/chat dengan .hidetag",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isGroup) {
        return ctx.reply("❌ Fitur ini hanya dapat digunakan di dalam grup.");
      }
      await ctx.react("⏳");
      const participantJids = (ctx.participants || []).map(p => p.jid || p.phoneNumber || p.id).filter(Boolean);
      if (!participantJids.length) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal membaca daftar peserta grup.");
      }
      const target = ctx.quoted || ctx;
      const rawMsgObj = target.message || target.msg || target;
      const {
        mtype,
        msg: innerMsg
      } = getMessagePayload(rawMsgObj);
      const cleanType = String(mtype || "").replace(/Message$/i, "").toLowerCase();
      const inputCaption = (ctx.query || ctx.args?.join(" ") || "").trim();
      const extractedText = inputCaption || target.text || innerMsg?.text || innerMsg?.conversation || innerMsg?.caption || (typeof innerMsg === "string" ? innerMsg : "");
      const mediaTypes = ["image", "video", "audio", "sticker", "document", "ptv"];
      const isMedia = mediaTypes.includes(cleanType) || target.isMedia || /image|video|audio|ogg|webp/i.test(target.mimetype || "");
      let payload = null;
      if (isMedia && typeof target.download === "function") {
        const buffer = await target.download().catch(() => null);
        if (buffer && Buffer.isBuffer(buffer)) {
          const mediaKey = mediaTypes.includes(cleanType) ? cleanType === "ptv" ? "video" : cleanType : "image";
          payload = {
            [mediaKey]: buffer,
            mentions: participantJids
          };
          if (["image", "video", "document"].includes(mediaKey) && extractedText) {
            payload.caption = extractedText;
          }
          if (mediaKey === "audio") {
            payload.mimetype = target.mimetype || innerMsg?.mimetype || "audio/mp4";
            payload.ptt = Boolean(innerMsg?.ptt ?? target.ptt ?? true);
          }
          if (mediaKey === "document") {
            payload.mimetype = target.mimetype || innerMsg?.mimetype || "application/octet-stream";
            payload.fileName = target.fileName || innerMsg?.fileName || "file";
          }
        }
      }
      if (!payload) {
        payload = {
          text: extractedText || "📢 *PENGUMUMAN GRUP*",
          mentions: participantJids
        };
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      await sock.sendMessage(ctx.id, payload, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (e) {
      console.error("[HIDETAG ERROR]", e);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal mengirim hidetag: ${e.message}`);
    }
  }
};