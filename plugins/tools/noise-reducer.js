import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/tools/audio/noise-reducer`;
export default {
  name: "noisereducer",
  aliases: ["denoiser", "reducenoise", "nr", "hilangkanbising"],
  description: "Hilangkan suara bising/kresek pada audio menggunakan Machine Learning Noise Reducer v4",
  category: "AI & Audio",
  limit: true,
  example: "reply voice note/audio dengan .noisereducer atau .noisereducer <link_audio>",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      let targetAudioUrl = (ctx.args?.[0] || "").trim();
      const isDirectUrl = /^https?:\/\/.+/i.test(targetAudioUrl);
      if (!isDirectUrl) {
        const isAudio = ctx.quoted?.isMedia && (ctx.quoted?.mediaType === "audio" || /audio/i.test(ctx.quoted?.mimetype || "")) || ctx.isMedia && (ctx.mediaType === "audio" || /audio/i.test(ctx.mimetype || ""));
        if (!isAudio) {
          const helpText = `– *N O I S E  R E D U C E R*\n\n` + `┌ ◦ *Usage* : ${prefix}noisereducer <url>\n` + `│ ◦ *Quoted* : Balas audio/VN dengan ${prefix}noisereducer\n` + `└ ◦ *Function* : Menghilangkan noise/bising rekaman menggunakan Machine Learning\n\n` + `${footer}`;
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
      const outputAudioUrl = res?.output_audio || res?.output_audio_denoised || res?.url || res?.download_url;
      if (!outputAudioUrl) {
        await ctx.react("❌");
        const errMsg = res?.message || res?.error || "Gagal memproses peredaman bising pada audio ini.";
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Pemrosesan gagal\n` + `└ ◦ *Info* : ${errMsg}\n\n` + `${footer}`);
      }
      const mlModel = res?.ml_model?.title || "NR v4.0";
      const modelDesc = res?.ml_model?.short_description || "Background Noise Suppression";
      const progress = res?.progress_percentage ? `${res.progress_percentage}%` : "100%";
      const audioId = res?.id || "-";
      const infoText = `– *N O I S E  R E D U C E R*\n\n` + `┌ ◦ *Job ID* : ${audioId}\n` + `│ ◦ *Model* : ${mlModel}\n` + `│ ◦ *Process* : ${progress}\n` + `└ ◦ *Description* : ${modelDesc}\n\n` + `${footer}`;
      await sock.sendMessage(ctx.id, {
        text: infoText
      }, {
        quoted: quotedMsg
      });
      try {
        const {
          data: cleanBuffer
        } = await axios.get(outputAudioUrl, {
          responseType: "arraybuffer",
          timeout: 6e4
        });
        await sock.sendMessage(ctx.id, {
          audio: Buffer.from(cleanBuffer),
          mimetype: "audio/mpeg",
          fileName: `${audioId}.mp3`
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
      } catch (mediaErr) {
        const fallbackText = `– *N O I S E  R E D U C E R*\n\n` + `┌ ◦ *Status* : Pengiriman file langsung gagal\n` + `└ ◦ *Action* : Buka tautan di bawah untuk mendengarkan audio.\n\n` + `${footer}`;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(fallbackText, `${botName} • Audio Player`, [{
            name: "cta_url",
            display_text: "Dengarkan Audio",
            url: outputAudioUrl
          }], {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(`– *N O I S E  R E D U C E R*\n\n` + `┌ ◦ *Link Audio* : ${outputAudioUrl}\n` + `└ ◦ *Status* : Siap diunduh melalui tautan di atas.\n\n` + `${footer}`, {
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
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "noisereducer"}\n\n` + `${footer}`);
    }
  }
};