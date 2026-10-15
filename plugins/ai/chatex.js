import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/chatex`;

function parseFlags(input) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["media", "img"].includes(key)) key = "image";
    if (["token", "token_state"].includes(key)) key = "state";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
      else val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "chatex",
  aliases: ["chatexai", "luna", "gpt56"],
  description: "Advanced AI Chat & Vision via ChatEx (GPT-5.6 Luna Engine)",
  category: "AI",
  limit: true,
  example: "chatex Jelaskan teori kuantum secara sederhana atau reply gambar dengan chatex",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("chatex") || firstWord.endsWith("chatexai") || firstWord.endsWith("luna") || firstWord.endsWith("gpt56")) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText && !isMedia) {
        const guideText = `–  *C H A T E X  A I*

Layanan kecerdasan buatan GPT-5.6 Luna dengan fitur sesi percakapan berkelanjutan (state) dan vision.

┌  ◦  *Chat Standar* :
│  └ \`${prefix}chatex Jelaskan cara kerja fusi nuklir\`
│
├  ◦  *Lanjut Percakapan (Multi-Turn State)* :
│  └ \`${prefix}chatex Lanjutkan penjelasan tadi --state <state_token>\`
│
├  ◦  *Analisis Gambar / Vision* :
│  └ Kirim / balas gambar: \`${prefix}chatex Jelaskan apa yang ada di gambar ini\`
│
└  ◦  *Parameter Flag* :
   ├ \`--state <state_token>\` (Melanjutkan sesi chat)
   └ \`--image <url>\` (Input URL gambar langsung)`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("💭");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      let uploadedImageUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedImageUrl = uploadRes.url;
          }
        }
      }
      const promptText = flags.prompt || cleanPrompt || (uploadedImageUrl ? "Jelaskan gambar ini secara detail" : "Halo");
      const bodyPayload = {
        prompt: promptText,
        state: flags.state || null,
        ...uploadedImageUrl ? {
          image: uploadedImageUrl
        } : flags.image ? {
          image: flags.image
        } : {},
        ...flags.messages ? {
          messages: typeof flags.messages === "string" ? JSON.parse(flags.messages) : flags.messages
        } : {},
        ...flags
      };
      const {
        data
      } = await axios.post(API_URL, bodyPayload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 9e4
      });
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan balasan dari ChatEx AI.");
      }
      const answerText = typeof data.result === "string" ? data.result : data.result?.content || "Tidak ada respon.";
      const returnedState = data.state || bodyPayload.state || "";
      const chunks = Array.isArray(data.chunks) ? data.chunks : [];
      const usageChunk = chunks.find(c => c.type === "data-usage")?.data;
      const modelId = usageChunk?.modelId || "openai/gpt-5.6-luna";
      const totalTokens = usageChunk?.totalTokens ?? "-";
      let bodyText = `–  *C H A T E X  A I*

┌  ◦  *Model* : \`${modelId}\`
│  ◦  *Tokens* : \`${totalTokens}\`
└  ◦  *Prompt* : ${promptText}

${answerText.trim()}`;
      const footerText = `${botName} • ChatEx Engine`;
      let nextCommand = `${prefix}chatex <tulis_prompt_lanjutan>`;
      if (returnedState) nextCommand += ` --state ${returnedState}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin Lanjutan Sesi",
        copy_code: nextCommand
      }];
      if (returnedState) {
        buttons.push({
          name: "cta_copy",
          display_text: "🔑 Salin State Saja",
          copy_code: returnedState
        });
      }
      buttons.push({
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      });
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, {
          title: "– CHATEX AI –",
          subtitle: `Model: ${modelId}`,
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
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ ChatEx AI Error: ${errMsg}`);
    }
  }
};