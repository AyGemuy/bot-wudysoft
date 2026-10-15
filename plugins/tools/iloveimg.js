import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  upload
} from "../../lib/upload.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/tools/iloveimg`;
const MODE_MAP = {
  removebg: "remove-background",
  nobg: "remove-background",
  hapusbg: "remove-background",
  transparent: "remove-background",
  "remove-background": "remove-background",
  upscale: "upscale-image",
  hd: "upscale-image",
  perjelas: "upscale-image",
  "upscale-image": "upscale-image",
  compress: "compress-image",
  kompres: "compress-image",
  kecilkan: "compress-image",
  "compress-image": "compress-image",
  blurface: "blur-face",
  sensor: "blur-face",
  sensorwajah: "blur-face",
  "blur-face": "blur-face",
  convert: "convert-to-jpg",
  tojpg: "convert-to-jpg",
  jpg: "convert-to-jpg",
  "convert-to-jpg": "convert-to-jpg",
  resize: "resize-image",
  "resize-image": "resize-image",
  crop: "crop-image",
  "crop-image": "crop-image"
};
export default {
  name: "iloveimg",
  aliases: ["iloveimage", "imgtools", "removebg", "nobg", "upscale", "hd", "blurface", "compress"],
  description: "Pengolah gambar pintar (Upscale HD, Hapus Background, Kompres, Blur Face) via iLoveIMG API",
  category: "Tools",
  example: "iloveimg upscale / balas gambar dengan .removebg",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx?.prefix || ".";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const chatId = ctx.chat || ctx.id;
    const isMedia = Boolean(ctx?.isMedia || ctx?.quoted?.isMedia || msg?.message?.imageMessage || ctx?.quoted?.message?.imageMessage || ctx?.quoted?.msg?.mimetype?.includes("image"));
    const rawCommand = (ctx?.command || "").toLowerCase();
    const rawArg = (ctx?.args?.[0] || ctx?.query || "").trim().toLowerCase();
    const inputMode = MODE_MAP[rawArg] || MODE_MAP[rawCommand] || null;
    if (!isMedia) {
      const helpText = `– *I L O V E  I M G*\n\n` + `┌ ◦ *Usage* : ${prefix}iloveimg <mode>\n` + `│ ◦ *Quoted* : Balas atau kirim gambar dengan ${prefix}iloveimg\n` + `└ ◦ *Function* : Pengolah gambar cerdas via iLoveIMG Cloud\n\n` + `– *M O D E*\n\n` + `┌ ◦ *upscale* : Tingkatkan kualitas & ketajaman foto (HD)\n` + `│ ◦ *removebg* : Hapus latar belakang foto (Transparan)\n` + `│ ◦ *compress* : Perkecil ukuran file tanpa merusak kualitas\n` + `│ ◦ *blurface* : Sensor blur otomatis pada wajah\n` + `└ ◦ *convert* : Ubah format file gambar ke standar JPG\n\n` + `${footer}`;
      return ctx.reply(helpText);
    }
    if (!inputMode) {
      const bodyText = `– *I L O V E  I M G*\n\n` + `┌ ◦ *Media* : Foto Terdeteksi\n` + `│ ◦ *Server* : iLoveIMG Cloud Processing\n` + `└ ◦ *Action* : Pilih alat pengolah gambar pada tombol di bawah\n\n` + `${footer}`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "PILIH ALAT",
          sections: [{
            title: "ALAT PENGOLAH GAMBAR",
            rows: [{
              title: "Hapus Background",
              description: "Hapus latar belakang menjadi transparan",
              id: `${prefix}iloveimg removebg`
            }, {
              title: "Upscale HD (2x)",
              description: "Tingkatkan resolusi & kejernihan foto",
              id: `${prefix}iloveimg upscale`
            }, {
              title: "Kompres Ukuran",
              description: "Perkecil ukuran file gambar",
              id: `${prefix}iloveimg compress`
            }, {
              title: "Sensor Wajah",
              description: "Sensor blur otomatis pada wajah",
              id: `${prefix}iloveimg blurface`
            }, {
              title: "Konversi ke JPG",
              description: "Ubah format file gambar ke JPG",
              id: `${prefix}iloveimg convert`
            }]
          }]
        })
      }];
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Image Tools`,
            button_title: "Buka Menu Alat"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, footer, buttons, options);
      }
      return ctx.reply(bodyText);
    }
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const downloadFn = typeof ctx?.download === "function" ? ctx.download : ctx?.quoted?.download;
      let mediaBuffer = null;
      if (typeof downloadFn === "function") {
        mediaBuffer = await downloadFn().catch(() => null);
      }
      if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer)) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh gambar\n` + `└ ◦ *Info* : Media tidak dapat diproses dari WhatsApp.\n\n` + `${footer}`);
      }
      const uploadRes = await upload(mediaBuffer).catch(() => null);
      const mediaUrl = uploadRes?.url || uploadRes?.status?.url || (typeof uploadRes === "string" ? uploadRes : null);
      if (!mediaUrl) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunggah media\n` + `└ ◦ *Info* : Server uploader tidak merespons.\n\n` + `${footer}`);
      }
      const requestPayload = {
        mode: inputMode,
        media: mediaUrl,
        output: "url"
      };
      if (inputMode === "upscale-image") {
        requestPayload.multiplier = "2";
      }
      const {
        data
      } = await axios.post(API_URL, requestPayload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0"
        },
        timeout: 9e4
      });
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal memproses gambar melalui server iLoveIMG.");
      }
      const captionText = `– *I L O V E  I M G*\n\n` + `┌ ◦ *Mode* : ${data.info?.mode || inputMode}\n` + `│ ◦ *Tool* : ${data.info?.tool || "-"}\n` + `│ ◦ *Server* : ${data.info?.server || "api"}\n` + `└ ◦ *Task ID* : ${data.info?.taskId?.slice(0, 16) || "-"}...\n\n` + `${footer}`;
      await sock.sendMessage(chatId, {
        image: {
          url: data.result
        },
        caption: captionText
      }, {
        quoted: quotedMsg
      });
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (e) {
      console.error("[iLoveIMG Plugin Error]:", e);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = e.response?.data?.message || e.response?.data?.error || e.message;
      return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${rawCommand || "iloveimg"}\n\n` + `${footer}`);
    }
  }
};