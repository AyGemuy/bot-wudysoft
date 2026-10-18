import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/cosmicup`;
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function parseFlags(input) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    if (key.toLowerCase() === "chat" || key.toLowerCase() === "chat_id") key = "chatID";
    if (key.toLowerCase() === "token_jwt") key = "token";
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
  name: "cosmicup",
  aliases: ["cosmic", "cupai"],
  description: "AI Multimodal Cosmicup (Chat, Image Generator, & Audio Agent).",
  category: "AI",
  limit: true,
  example: "cosmicup Mobil antik di kota --mode image --image_resolution 1:1",
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim();
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Cosmicup AI`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText) {
        const helpText = `–  *C O S M I C U P  A I*

Layanan kecerdasan buatan multimodal terpadu untuk obrolan teks, pembuatan visual, dan komposisi audio.

┌  ◦  *Chat Mode* :
│  └ \`${prefix}cosmicup Halo, jelaskan tentang Black Hole\`
│
├  ◦  *Image Generator* :
│  └ \`${prefix}cosmicup vintage sports car --mode image --model gpt-image-1-mini\`
│
├  ◦  *Audio / Music Agent* :
│  └ \`${prefix}cosmicup buatkan beat lofi santai --mode audio\`
│
└  ◦  *Dukungan Parameter Flag* :
   ├ \`--mode <chat | image | audio>\`
   ├ \`--model <nama_model>\`
   ├ \`--image_resolution <1:1 | 16:9 | 9:16>\`
   ├ \`--chatID <id>\`
   ├ \`--token <token>\`
   └ \`--<custom_key> <value>\``;
        return ctx.reply(helpText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const mode = (flags.mode || "chat").toLowerCase();
      let defaultModel = "openai/gpt-5.4-mini";
      if (mode === "image") defaultModel = "gpt-image-1-mini";
      else if (mode === "audio") defaultModel = "cosmicup_music_agent";
      const bodyPayload = {
        prompt: flags.prompt || cleanPrompt || "Halo",
        mode: mode,
        model: flags.model || defaultModel,
        ...flags
      };
      const {
        data
      } = await axios.post(API_URL, bodyPayload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!data || !data.status || !data.result) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses permintaan: ${data?.message || "Format respon API tidak valid."}`);
      }
      const resObj = data.result;
      const returnedChatId = data.chatID || resObj.chat_id || bodyPayload.chatID || "";
      const returnedToken = data.token || bodyPayload.token || "";
      const returnedMsg = resObj.message || resObj.formatted_message || "-";
      const imageUrls = resObj.image_urls || [];
      const attachments = resObj.attachments || [];
      let finalImageUrl = imageUrls[0] || null;
      if (!finalImageUrl && typeof resObj.formatted_message === "string") {
        const matchUrl = resObj.formatted_message.match(/https?:\/\/[^\s]+\.(?:png|jpg|jpeg|webp)/i);
        if (matchUrl) finalImageUrl = matchUrl[0];
      }
      let finalAudioUrl = null;
      if (bodyPayload.mode === "audio") {
        const audioAttach = attachments.find(att => att.type === "audio" || att.url && att.url.match(/\.(?:mp3|wav|ogg|m4a)/i));
        if (audioAttach?.url) finalAudioUrl = audioAttach.url;
        else if (data.audio || resObj.audio) finalAudioUrl = data.audio || resObj.audio;
      }
      if (finalAudioUrl) {
        await sock.sendMessage(ctx.id, {
          audio: {
            url: finalAudioUrl
          },
          mimetype: "audio/mp4",
          ptt: false
        }, {
          quoted: quotedMsg
        });
        await ctx.react("🎶");
        return;
      }
      const bodyText = `–  *C O S M I C U P  A I*

┌  ◦  *Mode* : ${bodyPayload.mode.toUpperCase()}
│  ◦  *Model* : \`${resObj.model || bodyPayload.model}\`
└  ◦  *Chat ID* : \`${returnedChatId || "-"}\`

${returnedMsg}`;
      const nextSessionCommand = `${prefix}cosmicup <tulis_prompt_disini> --mode ${bodyPayload.mode} --chatID ${returnedChatId} --token ${returnedToken}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin Lanjutan Sesi",
        copy_code: nextSessionCommand
      }];
      if (returnedToken) {
        buttons.push({
          name: "cta_copy",
          display_text: "🔑 Salin Token Saja",
          copy_code: returnedToken
        });
      }
      if (finalImageUrl) {
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            title: "– COSMICUP AI –",
            subtitle: `Model: ${resObj.model || bodyPayload.model}`,
            media: finalImageUrl,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: {
              url: finalImageUrl
            },
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        }
      } else {
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            title: "– COSMICUP AI –",
            subtitle: `Mode: ${bodyPayload.mode.toUpperCase()}`,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            text: bodyText
          }, {
            quoted: quotedMsg
          });
        }
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kesalahan pada Cosmicup AI: ${errMsg}`);
    }
  }
};