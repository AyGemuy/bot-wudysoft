import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "lovepal",
  aliases: ["lovepalai", "lpal"],
  description: "AI Image Processing via LovePal Engine (Image-to-Image Only)",
  category: "AI",
  limit: true,
  example: "Reply/kirim gambar dengan caption `lovepal [--age Young] [--body_type Slim] [--breast_size Small]`",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("lovepal") || firstWord.endsWith("lovepalai") || firstWord.endsWith("lpal")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!isMedia) {
        return ctx.reply(`🔞 *LOVEPAL AI (IMAGE-TO-IMAGE ONLY)*\n\n` + `Harap kirim atau balas (reply) foto yang ingin diproses!\n\n` + `👉 *Cara Penggunaan:*\n` + `• Balas gambar dengan: \`${ctx.prefix || "."}lovepal\`\n` + `• Kustom Parameter Override:\n` + `  └ \`${ctx.prefix || "."}lovepal --age Young --body_type Slim --breast_size Small\`\n\n` + `*Opsi Parameter Flag (Bebas Override):*\n` + `• \`--age <Young|Mature|...>\`\n` + `• \`--body_type <Slim|Curvy|Fit|...>\`\n` + `• \`--breast_size <Small|Medium|Large>\`\n` + `• \`--pussy_haircut <Shaved|Natural|...>\`\n` + `• \`--prompt <custom_instruction>\``);
      }
      await ctx.react("⏳");
      const restPayload = {};
      const flagRegex = /--([a-zA-Z0-9_]+)\s+([^\s]+)/g;
      let match;
      while ((match = flagRegex.exec(text)) !== null) {
        const key = match[1];
        const value = match[2];
        restPayload[key] = value;
      }
      const buffer = await ctx.download();
      if (!buffer || !Buffer.isBuffer(buffer)) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh gambar dari pesan.");
      }
      const uploadRes = await upload(buffer);
      if (!uploadRes?.status || !uploadRes?.url) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
      }
      const body = {
        image: uploadRes.url,
        ...restPayload
      };
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/lovepal`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 12e4
      });
      const isSuccess = data?.status === 200 || data?.status === "success" || data?.status === true;
      const resObj = data?.result;
      const outputUrls = resObj?.output_urls || resObj?.progress?.output || resObj?.list?.map(item => item.url).filter(Boolean) || [];
      if (!data || !isSuccess || outputUrls.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${data?.message || data?.error || "API tidak mengembalikan hasil."}`);
      }
      const predictionId = resObj?.prediction_id || "-";
      const pid = resObj?.pid || "-";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let caption = `🔞 *LovePal AI Selesai*\n\n`;
      caption += `🆔 *Prediction ID:* \`${predictionId}\`\n`;
      if (pid !== "-") caption += `📌 *PID:* \`${pid}\`\n`;
      const keys = Object.keys(restPayload);
      if (keys.length > 0) {
        caption += `⚙️ *Overrides:* ${keys.map(k => `${k}: ${restPayload[k]}`).join(", ")}\n`;
      }
      for (let i = 0; i < outputUrls.length; i++) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: outputUrls[i]
          },
          caption: i === 0 ? caption.trim() : ""
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ LovePal Error: ${errMsg}`);
    }
  }
};