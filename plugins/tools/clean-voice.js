import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/tools/audio/clean-voice`;
export default {
  name: "cleanvoice",
  aliases: ["cleanaudio", "denoise", "jernihkansound", "removebreath"],
  description: "Hilangkan noise, suara napas, dan jeda kosong pada rekaman audio menggunakan Cleanvoice AI",
  category: "AI & Audio",
  limit: true,
  example: "reply voice note/audio dengan .cleanvoice atau .cleanvoice <link_audio>",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      let targetAudioUrl = (ctx.args?.[0] || "").trim();
      const isDirectUrl = /^https?:\/\/.+/i.test(targetAudioUrl);
      if (!isDirectUrl) {
        const isAudio = ctx.quoted?.isMedia && (ctx.quoted?.mediaType === "audio" || /audio/i.test(ctx.quoted?.mimetype || "")) || ctx.isMedia && (ctx.mediaType === "audio" || /audio/i.test(ctx.mimetype || ""));
        if (!isAudio) {
          const helpText = `– *C L E A N  V O I C E*\n\n` + `┌ ◦ *Usage* : ${prefix}cleanvoice <url>\n` + `│ ◦ *Quoted* : Balas audio/VN dengan ${prefix}cleanvoice\n` + `└ ◦ *Function* : Membersihkan desis, napas (breath), & jeda kosong (dead-air)\n\n` + `${footer}`;
          return ctx.reply(helpText);
        }
        await ctx.react("⏳");
        const audioBuffer = await ctx.download();
        if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh audio\n` + `└ ◦ *Info* : Audio tidak dapat diproses dari pesan WhatsApp.\n\n` + `${footer}`);
        }
        const uploadRes = await upload(audioBuffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunggah audio\n` + `└ ◦ *Info* : ${uploadRes?.message || "Uploader error"}\n\n` + `${footer}`);
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
      const previewEditedUrl = res?.results?.merged_audio_url?.preview_edited || res?.results?.preview_edited || res?.preview_edited || res?.download_url || res?.url;
      if (!previewEditedUrl) {
        await ctx.react("❌");
        const errMsg = res?.message || res?.error || "AI gagal memproses file audio ini.";
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Proses Gagal\n` + `└ ◦ *Info* : ${errMsg}\n\n` + `${footer}`);
      }
      const stats = res?.results?.statistics || {};
      const breathCount = stats.BREATH ?? 0;
      const deadAirCount = stats.DEADAIR ?? 0;
      const filename = res.filename || "clean_voice.m4a";
      const status = res.status || "DONE";
      const infoText = `– *C L E A N  V O I C E*\n\n` + `┌ ◦ *Filename* : ${filename}\n` + `│ ◦ *Status* : ${status}\n` + `│ ◦ *Breath Removed* : ${breathCount} titik\n` + `│ ◦ *Dead-air Trimmed* : ${deadAirCount} segmen\n` + `└ ◦ *Engine* : Cleanvoice AI\n\n` + `${footer}`;
      await sock.sendMessage(ctx.id, {
        text: infoText
      }, {
        quoted: quotedMsg
      });
      try {
        const {
          data: cleanBuffer
        } = await axios.get(previewEditedUrl, {
          responseType: "arraybuffer",
          timeout: 6e4
        });
        await sock.sendMessage(ctx.id, {
          audio: Buffer.from(cleanBuffer),
          mimetype: "audio/mpeg",
          fileName: `${filename}.mp3`
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
      } catch (mediaErr) {
        if (typeof ctx.sendCta === "function") {
          const fallbackText = `– *C L E A N  V O I C E*\n\n` + `┌ ◦ *Status* : Pengiriman file langsung gagal\n` + `└ ◦ *Detail* : Gunakan tombol di bawah untuk mendengarkan/mengunduh.\n\n` + `${footer}`;
          await ctx.sendCta(fallbackText, `${botName} • Audio Player`, [{
            name: "cta_url",
            display_text: "Dengarkan Audio",
            url: previewEditedUrl
          }], {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(`– *C L E A N  V O I C E*\n\n` + `┌ ◦ *Link Audio* : ${previewEditedUrl}\n` + `└ ◦ *Info* : Audio siap diakses melalui tautan di atas.\n\n` + `${footer}`, {
            quoted: quotedMsg
          });
        }
        await ctx.react("⚠️");
      }
    } catch (error) {
      await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        errMsg = error.response.data?.message || error.response.data?.error || errMsg;
      }
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "cleanvoice"}\n\n` + `${footer}`);
    }
  }
};