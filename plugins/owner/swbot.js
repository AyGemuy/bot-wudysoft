import {
  getMessagePayload
} from "../../core/serialize.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function detectMediaType(typeStr = "", mimetype = "") {
  const clean = String(typeStr || "").toLowerCase().replace(/message$/i, "");
  const mime = String(mimetype || "").toLowerCase();
  if (clean.includes("image") || mime.startsWith("image/")) return "image";
  if (clean.includes("video") || clean === "ptv" || mime.startsWith("video/")) return "video";
  if (clean.includes("audio") || clean.includes("voice") || mime.startsWith("audio/")) return "audio";
  return null;
}
async function extractPayload(ctx, cleanQuery = "") {
  let target = ctx;
  const targetMsgInit = ctx.message || ctx.msg || ctx;
  const metaInit = getMessagePayload(targetMsgInit) || {};
  const isMedia = /image|video|audio|ptv|voice|viewonce/i.test(metaInit?.mtype || "") || ctx.isMedia;
  if (!isMedia && ctx.quoted) {
    target = ctx.quoted;
  }
  const targetMsg = target?.message || target?.msg || target || {};
  const targetMeta = getMessagePayload(targetMsg) || {};
  const rawType = String(targetMeta?.mtype || "").replace(/Message$/i, "");
  const mimetype = target?.mimetype || targetMeta?.msg?.mimetype || "";
  const mediaType = detectMediaType(rawType, mimetype);
  const isTargetMedia = Boolean(mediaType) || target?.isMedia;
  if (isTargetMedia && typeof target.download === "function") {
    const buffer = await target.download().catch(() => null);
    if (Buffer.isBuffer(buffer)) {
      const caption = cleanQuery || (target !== ctx ? target.text || targetMeta?.msg?.caption || "" : "");
      return {
        mediaType: mediaType,
        buffer: buffer,
        caption: caption
      };
    }
  }
  const text = cleanQuery || (target !== ctx ? target.text || targetMeta?.msg?.conversation || targetMeta?.msg?.text || "" : "");
  return text ? {
    mediaType: "text",
    buffer: null,
    caption: text
  } : null;
}
export default {
  name: "swbot",
  aliases: ["statusbot", "storybot", "upsw", "upstory"],
  description: "Upload WhatsApp Story/Status langsung pada akun Bot (status@broadcast)",
  category: "Owner",
  owner: true,
  example: ".swbot Teks status (atau balas Foto/Video dengan .swbot [@tag])",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isOwner) return ctx.reply("❌ Fitur ini khusus hanya dapat digunakan oleh *Owner Bot*.");
      const fullInput = ctx.query || ctx.args?.join(" ") || ctx.text || ctx.body || "";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      ctx.react?.("⏳");
      const payload = await extractPayload(ctx, fullInput);
      if (!payload) {
        ctx.react?.("❓");
        const p = ctx.prefix || ".";
        return ctx.reply(`–  *S W  B O T  (Story Dispatcher)*

Format penggunaan:
┌  ◦  *Status Teks* : \`${p}swbot Halo dunia!\`
│  ◦  *Reply Media* : Balas gambar/video/audio dengan \`${p}swbot [caption]\`
└  ◦  *Status Mention* : Sertakan @user atau grup pada teks/caption`);
      }
      const mentionedJids = ctx.mentionedJid || [];
      if (ctx.quoted?.sender && !mentionedJids.includes(ctx.quoted.sender)) {
        mentionedJids.push(ctx.quoted.sender);
      }
      const storyPayload = {};
      if (payload.mediaType === "image") {
        storyPayload.image = payload.buffer;
        if (payload.caption) storyPayload.caption = payload.caption;
      } else if (payload.mediaType === "video") {
        storyPayload.video = payload.buffer;
        if (payload.caption) storyPayload.caption = payload.caption;
      } else if (payload.mediaType === "audio") {
        storyPayload.audio = payload.buffer;
        storyPayload.ptt = false;
      } else {
        storyPayload.text = payload.caption || "";
      }
      let sentResult = null;
      if (mentionedJids.length > 0 && typeof sock.sendStatusMentions === "function") {
        try {
          sentResult = await sock.sendStatusMentions(storyPayload, mentionedJids);
        } catch (e) {
          console.warn("[SWBOT] sendStatusMentions gagal, beralih ke broadcast...", e?.message);
        }
      }
      if (!sentResult) {
        const sendOptions = {};
        if (mentionedJids.length > 0) {
          sendOptions.statusJidList = mentionedJids;
        }
        sentResult = await sock.sendMessage("status@broadcast", storyPayload, sendOptions);
      }
      ctx.react?.("✅");
      const resText = `–  *S W  B O T*

┌  ◦  *Status* : Berhasil Terpublikasi
│  ◦  *Target* : \`status@broadcast\`
│  ◦  *Tipe Konten* : ${payload.mediaType?.toUpperCase()}
└  ◦  *Mentioned* : ${mentionedJids.length ? `${mentionedJids.length} Kontak/Grup` : "Semua Kontak"}

Status bot telah tayang ke publikasi WhatsApp Story.`;
      await sock.sendMessage(ctx.id, {
        text: resText
      }, {
        quoted: quotedMsg
      });
    } catch (error) {
      console.error("[SWBOT Error]:", error);
      ctx.react?.("❌");
      ctx.reply(`❌ Gagal mengunggah status bot: ${error?.message || error}`);
    }
  }
};