import axios from "axios";
import {
  upload,
  formatBytes
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const safeFormatBytes = bytes => {
  if (typeof formatBytes === "function") return formatBytes(bytes);
  if (!bytes || isNaN(bytes)) return "-";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};
export default {
  name: "mconverter",
  aliases: ["convert", "converter", "toconvert"],
  description: "Konversi format media (Gambar, Video, Audio, Dokumen) via MConverter",
  category: "Tools",
  limit: true,
  example: "reply media lalu ketik mconverter <target_extension> (contoh: mconverter webp)",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      let targetExt = (ctx.args?.[0] || "").trim().toLowerCase().replace(".", "");
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!targetExt || !isMedia) {
        const helpText = `– *M  C O N V E R T E R*\n\n` + `┌ ◦ *Usage* : ${prefix}mconverter <target_ext>\n` + `│ ◦ *Quoted* : Balas media (gambar, video, audio, dokumen)\n` + `└ ◦ *Function* : Konversi berkas media via MConverter API\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Sticker* : ${prefix}mconverter webp (pada gambar)\n` + `│ ◦ *Audio* : ${prefix}mconverter mp3 (pada video)\n` + `│ ◦ *Image* : ${prefix}mconverter png (pada stiker)\n` + `└ ◦ *Animation* : ${prefix}mconverter gif (pada video)\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const buffer = await ctx.download();
      if (!buffer || !Buffer.isBuffer(buffer)) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh media\n` + `└ ◦ *Info* : Berkas media tidak dapat diproses dari WhatsApp.\n\n` + `${footer}`);
      }
      const uploadRes = await upload(buffer);
      if (!uploadRes?.status || !uploadRes?.url) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunggah media\n` + `└ ◦ *Info* : ${uploadRes?.message || "Server upload error"}\n\n` + `${footer}`);
      }
      const mediaUrl = uploadRes.url;
      const sourceExt = (uploadRes.ext || "png").toLowerCase();
      const body = {
        media: mediaUrl,
        source: sourceExt,
        target: targetExt
      };
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/tools/mconverter`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 9e4
      });
      if (!data || data.status !== "finished" || !data.url) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Konversi gagal\n` + `└ ◦ *Info* : ${data?.message || "Format tidak didukung atau server error."}\n\n` + `${footer}`);
      }
      const downloadUrl = data.url;
      const ext = (data.extension || targetExt).toLowerCase();
      const fileName = data.file_name || `converted_${Date.now()}.${ext}`;
      const fileSize = data.size ? safeFormatBytes(data.size) : "-";
      const caption = `– *M  C O N V E R T E R*\n\n` + `┌ ◦ *Filename* : ${fileName}\n` + `│ ◦ *Conversion* : ${sourceExt.toUpperCase()} ➔ ${ext.toUpperCase()}\n` + `└ ◦ *Size* : ${fileSize}\n\n` + `${footer}`;
      const isSticker = ["webp"].includes(ext);
      const isImage = ["jpg", "jpeg", "png", "bmp", "ico"].includes(ext);
      const isVideo = ["mp4", "mkv", "mov", "avi", "webm", "gif"].includes(ext);
      const isAudio = ["mp3", "wav", "ogg", "m4a", "aac", "opus", "flac"].includes(ext);
      if (isSticker) {
        await sock.sendMessage(ctx.id, {
          sticker: {
            url: downloadUrl
          }
        }, {
          quoted: quotedMsg
        });
      } else if (isImage) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: downloadUrl
          },
          caption: caption.trim()
        }, {
          quoted: quotedMsg
        });
      } else if (isVideo) {
        await sock.sendMessage(ctx.id, {
          video: {
            url: downloadUrl
          },
          caption: caption.trim(),
          gifPlayback: ext === "gif"
        }, {
          quoted: quotedMsg
        });
      } else if (isAudio) {
        await sock.sendMessage(ctx.id, {
          audio: {
            url: downloadUrl
          },
          mimetype: ext === "mp3" ? "audio/mpeg" : ext === "ogg" ? "audio/ogg" : "audio/mp4",
          ptt: false
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          document: {
            url: downloadUrl
          },
          fileName: fileName,
          mimetype: data.content_type || "application/octet-stream",
          caption: caption.trim()
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "mconverter"}\n\n` + `${footer}`);
    }
  }
};