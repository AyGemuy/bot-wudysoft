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
  name: "photoeditorai",
  aliases: ["photoeditor", "peai", "editfotoai"],
  description: "AI Image Editor menggunakan PhotoEditor AI Engine (Image-to-Image).",
  category: "AI",
  limit: true,
  example: "photoeditorai remove hat --mask_blur 5",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["photoeditorai", "photoeditor", "peai", "editfotoai"].some(alias => firstWord.endsWith(alias))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!isMedia || !text) {
        const guideText = `–  *P H O T O  E D I T O R  A I*

Layanan manipulasi dan pengeditan gambar berbasis instruksi AI.

┌  ◦  *Cara Penggunaan* :
│  └ Kirim / Balas gambar dengan caption instruksi edit.
│
├  ◦  *Contoh Dasar* :
│  └ \`${prefix}photoeditorai remove hat\`
│  └ \`${prefix}photoeditorai change hair to blonde\`
│
└  ◦  *Override Flags* :
   └ \`${prefix}photoeditorai remove hat --mode inpaint --strength 0.8\``;
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
        imageUrl: uploadRes.url,
        prompt: prompt || text,
        ...flags
      };
      const response = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/img2img/gen/v18`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const result = response.data;
      if (result?.error) {
        await ctx.react("❌");
        return ctx.reply(`❌ Error dari PhotoEditor AI: ${result.error}`);
      }
      const outputUrl = result?.output?.[0];
      if (!outputUrl) {
        await ctx.react("❌");
        return ctx.reply("❌ Tidak ada hasil gambar yang diterima dari server.");
      }
      const imgRes = await axios.get(outputUrl, {
        responseType: "arraybuffer",
        timeout: CONFIG.TIMEOUT
      });
      const imageBuffer = Buffer.from(imgRes.data);
      const appliedFlags = Object.keys(flags).length > 0 ? `\n│  ◦  *Custom Flags* : \`${JSON.stringify(flags)}\`` : "";
      const caption = `–  *P H O T O  E D I T O R  A I*

Proses manipulasi gambar berhasil diselesaikan.

┌  ◦  *Job ID* : ${result.jobId || "-"}${appliedFlags}
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
      console.error("[PhotoEditor AI Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kendala pada PhotoEditor AI: ${errorMessage}`);
    }
  }
};