import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const VALID_MODELS = ["flux", "tamarin", "superAnime", "visiCanvas", "realistic", "oldRealistic", "anime", "3danime"];
const VALID_SIZES = ["1:2", "9:16", "3:4", "1:1", "4:3", "16:9", "2:1"];
const CONFIG = {
  TIMEOUT: 12e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
export default {
  name: "mjai",
  aliases: ["midjourney", "mj"],
  description: "AI Image Generator & Editor menggunakan Midjourney AI (T2I & I2I).",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: mjai cute cybernetic cat --model anime --size 16:9\n• Image-to-Image: Reply gambar dengan caption: mjai turn into anime character",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["mjai", "mj", "midjourney"].some(alias => firstWord.endsWith(alias))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        const guideText = `–  *M I D J O U R N E Y  A I*

Layanan rendering visual tingkat tinggi berbasis Midjourney AI (Text-to-Image & Image-to-Image).

┌  ◦  *Text-to-Image (T2I)* :
│  └ \`${prefix}mjai cute cybernetic cat --model anime --size 16:9\`
│
├  ◦  *Image-to-Image (I2I)* :
│  └ Reply / kirim gambar: \`${prefix}mjai turn into anime character\`
│
├  ◦  *Pilihan Model Tersedia* :
│  └ ${VALID_MODELS.map(m => `\`${m}\``).join(", ")}
│
├  ◦  *Pilihan Rasio Aspek (Size)* :
│  └ ${VALID_SIZES.map(s => `\`${s}\``).join(", ")}
│
└  ◦  *Negative Prompt* :
   └ Gunakan flag: \`--neg <teks_negatif>\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      let prompt = text;
      let selectedModel = "realistic";
      let selectedSize = "3:4";
      let negativePrompt = "";
      if (/--model\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--model\s+([^\s]+)/i);
        if (match) {
          const foundModel = VALID_MODELS.find(m => m.toLowerCase() === match[1].toLowerCase());
          if (foundModel) selectedModel = foundModel;
          prompt = prompt.replace(match[0], "").trim();
        }
      }
      if (/--(size|ratio)\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--(size|ratio)\s+([^\s]+)/i);
        if (match && VALID_SIZES.includes(match[2])) {
          selectedSize = match[2];
          prompt = prompt.replace(match[0], "").trim();
        }
      }
      if (/--(neg|negative)\s+(.+?)(?=--|$)/i.test(prompt)) {
        const match = prompt.match(/--(neg|negative)\s+(.+?)(?=--|$)/i);
        if (match) {
          negativePrompt = match[2].trim();
          prompt = prompt.replace(match[0], "").trim();
        }
      }
      let imageUrl = "";
      if (isMedia) {
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
        imageUrl = uploadRes.url;
      }
      const payload = {
        prompt: prompt || "masterpiece, highly detailed, 8k wallpaper",
        negativePrompt: negativePrompt || "",
        model: selectedModel,
        size: selectedSize,
        batchSize: "1",
        imageUrl: imageUrl || "",
        rangeValue: null
      };
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/image/mjai`, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!data || data.state !== "success" && !data.result?.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal generate gambar: ${data?.message || "API tidak mengembalikan hasil."}`);
      }
      const results = data.result || [];
      const mode = imageUrl ? "Image-to-Image (I2I)" : "Text-to-Image (T2I)";
      const caption = `–  *M I D J O U R N E Y  A I*

Proses olah visual berhasil diselesaikan.

┌  ◦  *Mode* : ${mode}
│  ◦  *Model* : \`${selectedModel}\`
│  ◦  *Size* : ${selectedSize}
│  ◦  *Task ID* : \`${data.id || "-"}\`
└  ◦  *Waktu Render* : ${data.completeTime || "-"}

–  *P R O M P T*

“${data.prompt || prompt}”`;
      for (const imgUrl of results) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: imgUrl
          },
          caption: caption.trim()
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Midjourney Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada Midjourney AI: ${errMsg}`);
    }
  }
};