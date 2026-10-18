import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function parseFlags(text) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:\s+([^-][^\s]*|\"[^\"]*\"|'[^']*'))?/g;
  let cleanText = text.replace(flagRegex, (match, key, val) => {
    if (val === undefined) {
      flags[key] = true;
    } else {
      let cleanVal = val.trim();
      if (cleanVal.startsWith('"') && cleanVal.endsWith('"') || cleanVal.startsWith("'") && cleanVal.endsWith("'")) {
        cleanVal = cleanVal.slice(1, -1);
      }
      if (!isNaN(cleanVal) && cleanVal !== "") {
        flags[key] = Number(cleanVal);
      } else if (cleanVal.toLowerCase() === "true") {
        flags[key] = true;
      } else if (cleanVal.toLowerCase() === "false") {
        flags[key] = false;
      } else {
        flags[key] = cleanVal;
      }
    }
    return "";
  }).trim();
  return {
    prompt: cleanText.replace(/\s+/g, " "),
    flags: flags
  };
}
export default {
  name: "luckiss",
  aliases: ["luckissai", "lkai"],
  description: "AI Image Editor menggunakan Luckiss AI Engine (Image-to-Image).",
  category: "AI",
  limit: true,
  example: "luckiss remove hat --model Base --aspect_ratio match_input_image",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["luckiss", "luckissai", "lkai"].some(alias => firstWord.endsWith(alias))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!isMedia || !text) {
        const guideText = `–  *L U C K I S S  A I*

Layanan manipulasi dan modifikasi gambar dengan Luckiss AI Engine.

┌  ◦  *Cara Penggunaan* :
│  └ Kirim / Balas gambar dengan caption instruksi modifikasi.
│
├  ◦  *Contoh Dasar* :
│  └ \`${prefix}luckiss remove hat\`
│  └ \`${prefix}luckiss make it anime style\`
│
└  ◦  *Override Flags* :
   └ \`${prefix}luckiss remove hat --model Base --aspect_ratio 1:1\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const {
        prompt,
        flags
      } = parseFlags(text);
      const buffer = await ctx.download();
      if (!buffer || !Buffer.isBuffer(buffer)) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh media dari pesan.");
      }
      const uploadRes = await upload(buffer);
      if (!uploadRes?.status || !uploadRes?.url) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
      }
      const body = {
        image: uploadRes.url,
        prompt: prompt || text,
        ...flags
      };
      const response = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/img2img/gen/v36`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const resData = response.data;
      if (!resData?.status || !resData?.result?.image_url) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${resData?.message || resData?.error || "Tidak ada hasil gambar yang diterima."}`);
      }
      const result = resData.result;
      const imgRes = await axios.get(result.image_url, {
        responseType: "arraybuffer",
        timeout: CONFIG.TIMEOUT
      });
      const imageBuffer = Buffer.from(imgRes.data);
      const appliedFlags = Object.keys(flags).length > 0 ? `\n│  ◦  *Custom Flags* : \`${JSON.stringify(flags)}\`` : "";
      const caption = `–  *L U C K I S S  A I*

Proses manipulasi gambar berhasil diselesaikan.

┌  ◦  *Job ID* : ${result.job_id || "-"}
│  ◦  *Model* : ${result.model || "Base"}
│  ◦  *Aspect Ratio* : ${result.aspect_ratio || "Auto"}${appliedFlags}
└  ◦  *Status* : Selesai ✅

–  *I N S T R U K S I*

“${prompt || text}”`;
      await sock.sendMessage(ctx.id, {
        image: imageBuffer,
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[Luckiss AI Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kendala pada Luckiss AI: ${errorMessage}`);
    }
  }
};