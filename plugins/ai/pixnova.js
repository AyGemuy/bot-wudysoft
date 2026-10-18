import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  TIMEOUT: 12e4,
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
  name: "pixnova",
  aliases: ["pixnovaai", "pnai"],
  description: "AI Generator & Multi-Tool Image Editor menggunakan Pixnova AI (T2I & I2I).",
  category: "AI",
  limit: true,
  example: "• T2I: pixnova a cute cat wearing sunglasses\n• I2I: Reply foto dengan caption pixnova remove hat\n• Auto I2I: Reply foto dengan caption pixnova - --tool photo2anime",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["pixnova", "pixnovaai", "pnai"].some(alias => firstWord.endsWith(alias))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        const guideText = `–  *P I X N O V A  A I*

Layanan visual AI serbaguna (Text-to-Image & Image-to-Image).

┌  ◦  *Text-to-Image (T2I)* :
│  └ \`${prefix}pixnova cyberpunk samurai girl in neon city\`
│  └ \`${prefix}pixnova dark castle --style dark-fantasy\`
│
├  ◦  *Image-to-Image (I2I)* :
│  ├ Balas gambar: \`${prefix}pixnova remove-hat\`
│  ├ Balas gambar: \`${prefix}pixnova change hair to white --tool change-hair\`
│  ├ Balas gambar: \`${prefix}pixnova - --tool cloth-change --cloth_type full_outfits\`
│  └ Balas gambar: \`${prefix}pixnova - --tool photo2anime\`
│
└  ◦  *Daftar Tool* :
   \`text2image\`, \`image2image\`, \`image-editor\`, \`photo2anime\`, \`cloth-change\`, \`change-hair\`, \`ai-body\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const {
        prompt: rawPrompt,
        flags
      } = parseFlags(text);
      let isI2I = false;
      let imageUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer);
          if (uploadRes?.status && uploadRes?.url) {
            imageUrl = uploadRes.url;
            isI2I = true;
          } else {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal mengunggah media: ${uploadRes?.message || "Server upload error"}`);
          }
        }
      }
      let selectedTool = flags.tool || (isI2I ? "image2image" : "text2image");
      delete flags.tool;
      if (!imageUrl && selectedTool !== "text2image" && selectedTool !== "ai-body") {
        await ctx.react("❌");
        return ctx.reply(`❌ Tool *${selectedTool}* memerlukan gambar. Silakan kirim/balas foto dengan caption perintah.`);
      }
      const finalPrompt = rawPrompt || "-";
      const body = {
        prompt: finalPrompt,
        tool: selectedTool,
        ...imageUrl && {
          imageUrl: imageUrl
        },
        ...flags
      };
      const response = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/pixnova/v1`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const resData = response.data;
      if (!resData?.success || !resData?.result) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${resData?.error || resData?.message || "Tidak ada hasil gambar yang diterima."}`);
      }
      const resultUrl = resData.result;
      const imgRes = await axios.get(resultUrl, {
        responseType: "arraybuffer",
        timeout: CONFIG.TIMEOUT
      });
      const imageBuffer = Buffer.from(imgRes.data);
      const mode = isI2I ? "Image-to-Image (I2I)" : "Text-to-Image (T2I)";
      const appliedFlags = Object.keys(flags).length > 0 ? `\n│  ◦  *Custom Flags* : \`${JSON.stringify(flags)}\`` : "";
      const caption = `–  *P I X N O V A  A I*

Proses olah visual berhasil diselesaikan.

┌  ◦  *Mode* : ${mode}
│  ◦  *Tool* : ${selectedTool}${appliedFlags}
└  ◦  *Status* : Selesai ✅

–  *P R O M P T*

“${finalPrompt}”`;
      await sock.sendMessage(ctx.id, {
        image: imageBuffer,
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[Pixnova AI Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kendala pada Pixnova AI: ${errorMessage}`);
    }
  }
};