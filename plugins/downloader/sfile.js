import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "sfiledl",
  aliases: ["sfile", "sfilemobi", "sfiled"],
  description: "Download file dari Sfile.co / Sfile.mobi dengan detail & CTA",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const url = (ctx.args[0] || ctx.query || "").trim();
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Sfile Downloader`;
    if (!url) {
      return ctx.reply(`–  *S F I L E*

Silakan masukkan tautan berkas Sfile yang valid.

┌  ◦  *Format* : ${prefix}sfile <link>
└  ◦  *Example* : ${prefix}sfile https://sfile.co/mG4XRoq3WLn`);
    }
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const res = await axios.post(`${global.bot?.api?.wudysoft}/api/download/sfile/v1`, {
        url: url
      });
      const data = res.data;
      const downloadUrl = data.result || data.direct || data.cdnDirect;
      if (!downloadUrl) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Gagal mendapatkan tautan unduhan atau berkas tidak ditemukan.");
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const trendingRows = (data.trending || []).slice(0, 10).map((item, i) => ({
        title: `[#${i + 1}] ${item.name.slice(0, 24)}`,
        id: `${prefix}sfile ${item.link}`,
        description: `🔗 ${item.name}`.slice(0, 60)
      }));
      const listSections = [];
      if (trendingRows.length > 0) {
        listSections.push({
          title: `${botName} • SFILE TRENDING`,
          rows: trendingRows
        });
      }
      const bodyText = `–  *S F I L E*

┌  ◦  *Name* : ${data.name || "Sfile Document"}
│  ◦  *Uploader* : ${data.user || "-"}
│  ◦  *Size* : ${data.size || "-"}
│  ◦  *Uploaded* : ${data.date || "-"}
│  ◦  *Downloads* : ${data.dlCount || "0"}x
└  ◦  *Mime* : ${data.mime || "application/octet-stream"}

Berkas sedang dikirimkan ke chat. Anda juga dapat mengunduh langsung melalui tombol di bawah.`;
      const buttons = [];
      if (listSections.length > 0) {
        buttons.push({
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🔥 PILIH TRENDING FILE",
            sections: listSections
          })
        });
      }
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "📥 Direct Download Link",
          url: downloadUrl,
          merchant_url: downloadUrl
        })
      }, {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Salin Link Unduhan",
          copy_code: downloadUrl
        })
      });
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          title: `✦ Sfile Downloader • ${data.name} ✦`,
          subtitle: data.size || "-",
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      const docCaption = `–  *S F I L E*

┌  ◦  *File* : ${data.name}
└  ◦  *Size* : ${data.size || "-"}`;
      await sock.sendMessage(ctx.id, {
        document: {
          url: downloadUrl
        },
        fileName: data.name || "download_file",
        mimetype: data.mime || "application/octet-stream",
        caption: docCaption
      }, {
        quoted: quotedMsg
      });
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (e) {
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Sfile Download Error: ${e.message}`);
    }
  }
};