import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "tourl",
  aliases: ["upload", "tolink", "phototourl", "uploadlink"],
  description: "Upload media ke link CDN permanen menggunakan lib upload (pone.rs)",
  category: "Tools",
  example: "reply gambar/video/stiker/audio dengan .tourl",
  limit: true,
  execute: async (sock, ctx, msg) => {
    try {
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Media Uploader`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!isMedia) {
        return ctx.reply(`–  *T O  U R L*

Kirim atau balas (reply) media yang ingin diunggah ke server CDN.

┌  ◦  *Format* : ${prefix}tourl
└  ◦  *Supported* : Gambar, Video, Audio, Stiker`);
      }
      await ctx.react("⏳");
      const buffer = await ctx.download();
      if (!buffer || !Buffer.isBuffer(buffer)) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh media dari pesan WhatsApp.");
      }
      const res = await upload(buffer);
      if (!res?.status || !res?.url) {
        await ctx.react("❌");
        return ctx.reply(`❌ Upload gagal: ${res?.message || "Terjadi kesalahan saat mengunggah berkas."}`);
      }
      await ctx.react("✅");
      const responseText = `–  *T O  U R L*

┌  ◦  *URL* : ${res.url}
│  ◦  *Size* : ${res.formattedSize || "N/A"}
│  ◦  *Mime* : ${res.mime}
│  ◦  *File* : ${res.filename}
└  ◦  *Server* : pone.rs CDN`;
      const buttons = [{
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Salin Direct URL",
          copy_code: res.url
        })
      }, {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "🌐 Buka di Browser",
          url: res.url,
          merchant_url: res.url
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(responseText, botFooter, buttons, {
          title: `✦ Media to Link ✦`,
          subtitle: res.filename,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          text: responseText
        }, {
          quoted: quotedMsg
        });
      }
    } catch (e) {
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};