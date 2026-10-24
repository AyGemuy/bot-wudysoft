import {
  getMessagePayload
} from "../../core/serialize.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function getFullText(m) {
  if (!m) return "";
  const raw = m.message || m.msg || m;
  return (m.text || m.caption || m.body || raw?.conversation || raw?.extendedTextMessage?.text || raw?.imageMessage?.caption || raw?.videoMessage?.caption || raw?.ephemeralMessage?.message?.extendedTextMessage?.text || raw?.ephemeralMessage?.message?.conversation || "").trim();
}

function detectMedia(mtype = "", mime = "") {
  mtype = mtype.toLowerCase();
  mime = mime.toLowerCase();
  if (mtype.includes("image") || mime.startsWith("image/")) return "image";
  if (mtype.includes("video") || mime.startsWith("video/")) return "video";
  if (mtype.includes("audio") || mime.startsWith("audio/")) return "audio";
  return null;
}
export default {
  name: "swbot",
  aliases: ["statusbot", "storybot", "upsw", "upstory"],
  description: "Upload status WhatsApp langsung pada akun Bot (status@broadcast)",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isOwner) return ctx.reply("❌ Fitur ini khusus hanya untuk *Owner Bot*.");
      const rawText = (ctx.text || ctx.body || "").trim();
      const userQuery = rawText.replace(/^[\\/\\.!#$]?(swbot|statusbot|storybot|upsw|upstory)\s*/i, "").trim();
      const target = ctx.quoted || ctx;
      const targetMsg = target.message || target.msg || target;
      const meta = getMessagePayload(targetMsg) || {};
      const mediaType = detectMedia(meta?.mtype || target.mtype || "", target.mimetype || meta?.msg?.mimetype);
      const fullCaption = userQuery || (ctx.quoted ? getFullText(ctx.quoted) : getFullText(ctx));
      let buffer = null;
      if (mediaType && typeof target.download === "function") {
        ctx.react?.("⏳");
        buffer = await target.download().catch(() => null);
      }
      if (!buffer && !fullCaption) {
        ctx.react?.("❓");
        const p = ctx.prefix || ".";
        return ctx.reply(`–  *S W  B O T*\n\n` + `Format penggunaan:\n` + `┌  ◦  *Status Teks* : \`${p}swbot Halo dunia!\`\n` + `└  ◦  *Reply Media/Teks* : Balas pesan/media dengan \`${p}swbot\``);
      }
      ctx.react?.("⏳");
      const storyPayload = {};
      if (mediaType === "image") storyPayload.image = buffer;
      else if (mediaType === "video") storyPayload.video = buffer;
      else if (mediaType === "audio") {
        storyPayload.audio = buffer;
        storyPayload.ptt = false;
      } else storyPayload.text = fullCaption || "";
      if (fullCaption && mediaType !== "audio") storyPayload.caption = fullCaption;
      const mentionedJids = ctx.mentionedJid || [];
      if (ctx.quoted?.sender && !mentionedJids.includes(ctx.quoted.sender)) {
        mentionedJids.push(ctx.quoted.sender);
      }
      let sentResult = null;
      if (mentionedJids.length > 0 && typeof sock.sendStatusMentions === "function") {
        try {
          sentResult = await sock.sendStatusMentions(storyPayload, mentionedJids);
        } catch (_) {}
      }
      if (!sentResult) {
        sentResult = await sock.sendMessage("status@broadcast", storyPayload, {
          ...mentionedJids.length ? {
            statusJidList: mentionedJids
          } : {}
        });
      }
      ctx.react?.("✅");
      const previewText = fullCaption ? fullCaption.length > 60 ? fullCaption.slice(0, 60) + "..." : fullCaption : "(Tanpa Teks / Polos)";
      const resText = `–  *S W  B O T*\n\n` + `┌  ◦  *Status* : Berhasil Terpublikasi ✅\n` + `│  ◦  *Target* : \`status@broadcast\`\n` + `│  ◦  *Tipe Konten* : ${(mediaType || "TEXT").toUpperCase()}\n` + `│  ◦  *Teks Salinan* : ${previewText}\n` + `└  ◦  *Mentioned* : ${mentionedJids.length ? `${mentionedJids.length} Kontak` : "Semua Kontak"}`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
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