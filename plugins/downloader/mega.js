import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "megadl",
  aliases: ["mega", "meganz", "meganzdl"],
  description: "Download file dari Mega.nz dengan detail & CTA",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const rawArgs = ctx.args || [];
    const url = rawArgs.find(arg => /https?:\/\/(www\.)?mega\.nz\/(file|folder|#)/i.test(arg)) || "";
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Mega Downloader`;
    if (!url) {
      return ctx.reply(`–  *M E G A*

Silakan masukkan tautan berkas Mega.nz yang valid.

┌  ◦  *Format* : ${prefix}mega <link>
└  ◦  *Example* : ${prefix}mega https://mega.nz/file/DtUQWDzA#Qkn5oqvpHoGuFcsYjUbtQJs49iqXLeRxqlQWkyB3CZk`);
    }
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const res = await axios.post(`${global.bot?.api?.wudysoft}/api/download/mega/v1`, {
        url: url,
        output: "base64"
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });
      const data = res.data;
      const info = data.info || {};
      if (!data.base64 && !info.downloadUrl) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh berkas Mega atau tautan tidak valid.");
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const fileName = info.fileName || "mega_download_file";
      const mimeType = info.mimeType || "application/octet-stream";
      const fileSize = info.fileSize || `${Math.round((info.fileSizeBytes || 0) / (1024 * 1024))} MB`;
      const bodyText = `–  *M E G A*

┌  ◦  *Name* : ${fileName}
│  ◦  *Size* : ${fileSize}
│  ◦  *Mime* : ${mimeType}
└  ◦  *ID* : ${info.fileId || "-"}

Berkas sedang dikirimkan ke chat. Anda juga dapat mengunduh langsung melalui tombol di bawah.`;
      const buttons = [];
      if (info.downloadUrl) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "📥 Direct Download Link",
            url: info.downloadUrl,
            merchant_url: info.downloadUrl
          })
        });
        buttons.push({
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "📋 Salin Link Unduhan",
            copy_code: info.downloadUrl
          })
        });
      } else {
        buttons.push({
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "📋 Salin Link Mega",
            copy_code: url
          })
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          title: `✦ Mega Downloader • ${fileName} ✦`,
          subtitle: fileSize,
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      const filePayload = data.base64 ? {
        document: Buffer.from(data.base64, "base64")
      } : {
        document: {
          url: info.downloadUrl
        }
      };
      const docCaption = `–  *M E G A*

┌  ◦  *File* : ${fileName}
└  ◦  *Size* : ${fileSize}`;
      await sock.sendMessage(ctx.id, {
        ...filePayload,
        fileName: fileName,
        mimetype: mimeType,
        caption: docCaption
      }, {
        quoted: quotedMsg
      });
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (e) {
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Mega Download Error: ${e.message}`);
    }
  }
};