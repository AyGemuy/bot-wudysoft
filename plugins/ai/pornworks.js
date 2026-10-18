import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_BASE = `${global.bot?.api?.wudysoft}/api/ai/pornworks`;
export default {
  name: "pornworks",
  aliases: ["pwai", "pornwork"],
  description: "AI Image Generator & Undress via Pornworks Engine (T2I & I2I)",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: `pornworks cute cat walk`\n• Image-to-Image: Reply gambar dengan caption `pornworks cyberpunk style`\n• Undress: Reply gambar dengan caption `pornworks --undress`",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("pornworks") || firstWord.endsWith("pwai") || firstWord.endsWith("pornwork")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        return ctx.reply(`🔞 *PORNWORKS AI GENERATOR & UNDRESS*\n\n` + `*Cara Penggunaan:*\n` + `• *Text-to-Image (T2I):*\n` + `  └ \`${prefix}pornworks a beautiful woman in sunset\`\n\n` + `• *Image-to-Image (I2I):*\n` + `  └ Reply/kirim gambar: \`${prefix}pornworks make it realistic\`\n\n` + `• *Mode Undress (Wajib Gambar):*\n` + `  └ Reply/kirim gambar: \`${prefix}pornworks --undress\`\n\n` + `*Opsi Flag:*\n` + `• \`--undress\` : Mengaktifkan mode undress\n` + `• \`--token <token>\` : Token sesi akun (opsional)`);
      }
      await ctx.react("⏳");
      let isUndress = false;
      let token = "";
      let prompt = text;
      if (/--undress/i.test(prompt) || prompt.toLowerCase() === "undress") {
        isUndress = true;
        prompt = prompt.replace(/--undress/gi, "").trim();
      }
      if (/--token\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--token\s+([^\s]+)/i);
        if (match) token = match[1];
        prompt = prompt.replace(/--token\s+[^\s]+/gi, "").trim();
      }
      let imageUrl = null;
      if (isMedia) {
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
        imageUrl = uploadRes.url;
      }
      if (isUndress && !imageUrl) {
        await ctx.react("❌");
        return ctx.reply("❌ Mode undress memerlukan gambar! Harap kirim/reply gambar.");
      }
      let action = "generate";
      const body = {};
      if (isUndress) {
        action = "undress";
        body.action = "undress";
        body.image = imageUrl;
      } else {
        action = "generate";
        body.action = "generate";
        body.prompt = prompt || (imageUrl ? "enhance details, masterpiece" : "masterpiece, ultra detail");
        if (imageUrl) body.image = imageUrl;
      }
      if (token) body.token = token;
      const {
        data
      } = await axios.post(`${API_BASE}?action=${action}`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 12e4
      });
      const resData = data?.result?.data;
      const resultImageUrl = resData?.image || data?.result?.image || (typeof data?.result === "string" ? data.result : null);
      if (!data || data.status !== "success" && data.status !== true || !resultImageUrl) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${data?.message || "API tidak mengembalikan hasil."}`);
      }
      const mode = isUndress ? "UNDRESS" : imageUrl ? "IMAGE-TO-IMAGE (I2I)" : "TEXT-TO-IMAGE (T2I)";
      const returnedToken = data.token || token || "";
      let bodyText = `🔞 *PORNWORKS AI COMPLETED*\n\n` + (body.prompt ? `📝 *Prompt:* ${body.prompt}\n` : "") + `🎭 *Mode:* \`${mode}\`\n`;
      if (resData?.size) bodyText += `📐 *Size:* \`${resData.size}\`\n`;
      if (resData?.type) bodyText += `⚙️ *Type:* \`${resData.type}\`\n`;
      bodyText += `\n_💡 Klik tombol copy di bawah untuk menyimpan sesi token akun Anda._`;
      const footerText = `${botName} • Pornworks AI`;
      const buttons = [];
      if (returnedToken) {
        const nextCommand = `${prefix}pornworks --token ${returnedToken}`;
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Sesi Token",
          copy_code: nextCommand
        }, {
          name: "cta_copy",
          display_text: "🔑 Salin Token Saja",
          copy_code: returnedToken
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, {
          title: `乂 PORNWORKS AI - ${mode} 乂`,
          subtitle: `Engine: Pornworks`,
          media: resultImageUrl,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: resultImageUrl
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Pornworks Error: ${errMsg}`);
    }
  }
};