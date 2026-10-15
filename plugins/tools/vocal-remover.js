import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/tools/audio/vocal-remover`;
const formatSize = bytes => {
  if (!bytes || bytes === 0) return "-";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};
export default {
  name: "vocalremover",
  aliases: ["vocal", "instrumental", "karaoke", "acapella", "splitvocal", "stem"],
  description: "Pisahkan vokal dan instrumen musik (Karaoke/Acapella) menggunakan AI Vocal Remover",
  category: "AI & Audio",
  limit: true,
  example: "reply audio/lagu dengan .vocalremover atau .vocalremover <link_audio>",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      let targetAudioUrl = (ctx.args?.[0] || "").trim();
      const isDirectUrl = /^https?:\/\/.+/i.test(targetAudioUrl);
      if (!isDirectUrl) {
        const isAudio = ctx.quoted?.isMedia && (ctx.quoted?.mediaType === "audio" || /audio/i.test(ctx.quoted?.mimetype || "")) || ctx.isMedia && (ctx.mediaType === "audio" || /audio/i.test(ctx.mimetype || ""));
        if (!isAudio) {
          const helpText = `– *V O C A L  R E M O V E R*\n\n` + `┌ ◦ *Usage* : ${prefix}vocalremover <url>\n` + `│ ◦ *Quoted* : Balas lagu atau audio dengan ${prefix}vocalremover\n` + `└ ◦ *Function* : Memisahkan trek vokal (Acapella) & instrumen (Karaoke)\n\n` + `${footer}`;
          return ctx.reply(helpText);
        }
        await ctx.react("⏳");
        const audioBuffer = await ctx.download();
        if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh audio\n` + `└ ◦ *Info* : Berkas media tidak dapat diproses dari WhatsApp.\n\n` + `${footer}`);
        }
        const uploadRes = await upload(audioBuffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunggah audio\n` + `└ ◦ *Info* : ${uploadRes?.message || "Server upload error"}\n\n` + `${footer}`);
        }
        targetAudioUrl = uploadRes.url;
      } else {
        await ctx.react("⏳");
      }
      const {
        data: res
      } = await axios.post(API_URL, {
        audioUrl: targetAudioUrl
      }, {
        params: {
          audioUrl: targetAudioUrl
        },
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 12e4
      });
      const vocalUrl = res?.dst_vocal;
      const instrumentalUrl = res?.dst_other;
      if (!vocalUrl && !instrumentalUrl) {
        await ctx.react("❌");
        const errMsg = res?.message || res?.error || "Gagal memisahkan vokal dan instrumen dari audio ini.";
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Pemrosesan gagal\n` + `└ ◦ *Info* : ${errMsg}\n\n` + `${footer}`);
      }
      const fileName = res?.origin_file_name || "audio.mp3";
      const durationSec = res?.duration ? `${(res.duration / 1e3).toFixed(1)} detik` : "-";
      const fileSize = formatSize(res?.file_size);
      const infoText = `– *V O C A L  R E M O V E R*\n\n` + `┌ ◦ *Filename* : ${fileName}\n` + `│ ◦ *Duration* : ${durationSec}\n` + `│ ◦ *Size* : ${fileSize}\n` + `│ ◦ *Vocal* : Acapella (Ready)\n` + `└ ◦ *Instrument* : Karaoke (Ready)\n\n` + `${footer}`;
      const buttons = [];
      if (vocalUrl) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "Download Vokal",
            url: vocalUrl
          })
        });
      }
      if (instrumentalUrl) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "Download Instrumen",
            url: instrumentalUrl
          })
        });
      }
      if (typeof ctx.sendCta === "function" && buttons.length > 0) {
        await ctx.sendCta(infoText, `${botName} • Stem Splitter`, buttons, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          text: infoText
        }, {
          quoted: quotedMsg
        });
      }
      if (vocalUrl) {
        try {
          const {
            data: vocalBuffer
          } = await axios.get(vocalUrl, {
            responseType: "arraybuffer",
            timeout: 6e4
          });
          await sock.sendMessage(ctx.id, {
            audio: Buffer.from(vocalBuffer),
            mimetype: "audio/mpeg",
            fileName: `vocal_${fileName}.mp3`
          }, {
            quoted: quotedMsg
          });
        } catch (e) {
          console.error("Gagal mengirim vokal:", e.message);
        }
      }
      if (instrumentalUrl) {
        try {
          const {
            data: instBuffer
          } = await axios.get(instrumentalUrl, {
            responseType: "arraybuffer",
            timeout: 6e4
          });
          await sock.sendMessage(ctx.id, {
            audio: Buffer.from(instBuffer),
            mimetype: "audio/mpeg",
            fileName: `instrumental_${fileName}.mp3`
          }, {
            quoted: quotedMsg
          });
        } catch (e) {
          console.error("Gagal mengirim instrumen:", e.message);
        }
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        errMsg = error.response.data?.message || error.response.data?.error || errMsg;
      }
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "vocalremover"}\n\n` + `${footer}`);
    }
  }
};