import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "snappyit",
  aliases: ["snappy", "snappyai"],
  description: "AI Image Processor via SnappyIt Engine",
  category: "AI",
  limit: true,
  example: "Reply/kirim gambar dengan caption `snappyit [--vibe soft] [--count 1] [--token <token>]`",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("snappyit") || firstWord.endsWith("snappy") || firstWord.endsWith("snappyai")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!isMedia) {
        return ctx.reply(`📸 *SNAPPYIT AI IMAGE PROCESSOR*\n\n` + `Harap kirim atau balas (reply) foto yang ingin diproses!\n\n` + `👉 *Cara Penggunaan:*\n` + `• Balas gambar: \`${prefix}snappyit\`\n` + `• Kustom vibe & count: \`${prefix}snappyit --vibe soft --count 1\`\n` + `• Dengan Token Akun: \`${prefix}snappyit --token <token_jwt>\`\n\n` + `*Opsi Parameter Flag:*\n` + `• \`--vibe <soft|hard|...>\` (Default: \`soft\`)\n` + `• \`--count <1-4>\` (Default: \`1\`)\n` + `• \`--token <jwt_token>\` (Opsional untuk melanjutkan sesi akun)`);
      }
      await ctx.react("⏳");
      let vibe = "soft";
      let count = "1";
      let token = null;
      if (/--vibe\s+([^\s]+)/i.test(text)) {
        const match = text.match(/--vibe\s+([^\s]+)/i);
        if (match) vibe = match[1];
      }
      if (/--count\s+([^\s]+)/i.test(text)) {
        const match = text.match(/--count\s+([^\s]+)/i);
        if (match) count = String(match[1]);
      }
      if (/--token\s+([^\s]+)/i.test(text)) {
        const match = text.match(/--token\s+([^\s]+)/i);
        if (match) token = match[1];
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
        count: count,
        vibe: vibe,
        ...token ? {
          token: token
        } : {}
      };
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/snappyit`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 12e4
      });
      if (!data || !data.status || !data.result) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${data?.message || "API tidak mengembalikan hasil."}`);
      }
      const resObj = data.result;
      const returnedToken = data.token || token || "";
      const resultUrls = resObj.urls || (resObj.url ? [resObj.url] : []);
      if (resultUrls.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gambar hasil tidak ditemukan pada respon API.");
      }
      const undressVibe = resObj.setting?.undress_vibe || vibe;
      const imageCount = resObj.setting?.image_count || count;
      const creditsLeft = resObj.user_profile?.available_balance ?? "-";
      let bodyText = `📸 *SNAPPYIT AI COMPLETED*\n\n` + `🎭 *Vibe:* \`${undressVibe}\`\n` + `🔢 *Count:* \`${imageCount}\`\n`;
      if (resObj.history_id) bodyText += `🆔 *History ID:* \`${resObj.history_id}\`\n`;
      bodyText += `🪙 *Credits Sisa:* \`${creditsLeft}\`\n\n` + `_💡 Klik tombol copy di bawah untuk menyimpan sesi token akun Anda._`;
      const footerText = `${botName} • SnappyIt AI`;
      const buttons = [];
      if (returnedToken) {
        const nextCommand = `${prefix}snappyit --token ${returnedToken}`;
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
          title: `乂 SNAPPYIT AI 乂`,
          subtitle: `Vibe: ${undressVibe} • Credits: ${creditsLeft}`,
          media: resultUrls[0],
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: resultUrls[0]
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      for (let i = 1; i < resultUrls.length; i++) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: resultUrls[i]
          }
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ SnappyIt Error: ${errMsg}`);
    }
  }
};