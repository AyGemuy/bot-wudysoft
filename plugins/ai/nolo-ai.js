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
export default {
  name: "noloai",
  aliases: ["noloai", "nolo"],
  description: "Chat dengan Nolo AI (Custom State & Direct Image Support) via CTA Response.",
  category: "AI",
  limit: true,
  example: "• Obrolan: noloai siapa presiden pertama indonesia?\n• Sesi Lanjutan: nolo jelaskan lebih lanjut --state <token>\n• Analisis Foto: Reply gambar dengan caption nolo analisis",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["noloai", "nolo"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Nolo AI Assistant`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText && !isMedia) {
        const guideText = `–  *N O L O  A I*

Layanan asisten percakapan cerdas multimodal dengan memori sesi (Custom State) dan analisis gambar.

┌  ◦  *Format Standar (Teks)* :
│  └ \`${prefix}noloai jelaskan teori relativitas\`
│
├  ◦  *Lanjut Percakapan (State)* :
│  └ \`${prefix}nolo jelaskan poin keduanya --state <state_token>\`
│
└  ◦  *Analisis Gambar (Vision)* :
   └ Reply / kirim gambar: \`${prefix}nolo analisis gambar ini secara detail\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("💭");
      let state = null;
      let prompt = rawText;
      const stateMatch = rawText.match(/--state\s+([^\s]+)/i);
      if (stateMatch) {
        state = stateMatch[1];
        prompt = rawText.replace(stateMatch[0], "").trim();
      }
      const payload = {
        prompt: prompt || "Jelaskan gambar ini secara detail"
      };
      if (state) payload.state = state;
      let uploadedImageUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedImageUrl = uploadRes.url;
            payload.image = uploadRes.url;
          } else {
            payload.image = `data:image/jpeg;base64,${buffer.toString("base64")}`;
          }
        }
      }
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/nolo-ai`, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!data || !data.status) {
        throw new Error(data?.message || "Gagal mendapatkan balasan dari Nolo AI.");
      }
      const answerText = data.result?.text || data.result?.job_result?.cleaned_text || "Tidak ada balasan.";
      const creditsLeft = data.result?.credits_left ?? "-";
      const title = data.result?.title || "Nolo AI Response";
      const returnedState = data.state || "";
      const usageChunk = data.chunks?.find(c => c.type === "usage");
      const promptTokens = usageChunk?.promptTokens ?? "-";
      const completionTokens = usageChunk?.completionTokens ?? "-";
      const bodyText = `–  *N O L O  A I*

┌  ◦  *Topik* : ${title}
│  ◦  *Sisa Kredit* : ${creditsLeft}
└  ◦  *Tokens* : ${promptTokens} (In) / ${completionTokens} (Out)

${answerText.trim()}`;
      const buttons = [];
      if (returnedState && returnedState !== "-") {
        const nextCommand = `${prefix}nolo <tulis_pertanyaan_lanjutan> --state ${returnedState}`;
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Lanjutan Sesi",
          copy_code: nextCommand
        }, {
          name: "cta_copy",
          display_text: "🔑 Salin State Token",
          copy_code: returnedState
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          title: "– NOLO AI –",
          subtitle: `Topik: ${title}`,
          media: uploadedImageUrl || null,
          quoted: quotedMsg
        });
      } else if (uploadedImageUrl) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: uploadedImageUrl
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          text: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✨");
    } catch (error) {
      console.error("[Nolo AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada Nolo AI: ${errMsg}`);
    }
  }
};