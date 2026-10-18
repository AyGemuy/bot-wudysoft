import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  DEFAULT_VERSION: "v53",
  TIMEOUT: 15e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
export default {
  name: "flixaritek",
  aliases: ["aritek", "flixai"],
  description: "AI Generator & Editor Aritek Multi-Version (T2I, I2I, T2V, I2V).",
  category: "AI",
  limit: true,
  example: "flixaritek <prompt> [--v53/--v52/--v50/--v49/--v48] [--video/--image]",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["flixaritek", "aritek", "flixai"].some(a => firstWord.endsWith(a))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • FlixAritek AI`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        const guideText = `–  *F L I X A R I T E K  A I*

Layanan rendering multi-versi untuk generasi dan transformasi gambar maupun video.

┌  ◦  *Pilihan Versi* : \`--v48\`, \`--v49\`, \`--v50\`, \`--v52\`, \`--v53\` (Default: \`${CONFIG.DEFAULT_VERSION}\`)
└  ◦  *Format Output* : \`--video\` / \`-v\` atau \`--image\` / \`-i\`

–  *C O N T O H  P E N G G U N A A N*

┌  ◦  *Text-to-Image (T2I)* :
│  └ \`${prefix}flixaritek cyberpunk girl neon city --v53\`
│
├  ◦  *Text-to-Video (T2V)* :
│  └ \`${prefix}flixaritek beautiful waterfall --v50 --video\`
│
├  ◦  *Image-to-Image (I2I)* :
│  └ Reply gambar: \`${prefix}flixaritek anime style --v49\`
│
└  ◦  *Image-to-Video (I2V)* :
   └ Reply gambar: \`${prefix}flixaritek camera zoom in --v52 --video\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      let version = CONFIG.DEFAULT_VERSION;
      const versionMatch = text.match(/--v(\d+)\b/i);
      if (versionMatch) {
        version = `v${versionMatch[1]}`;
        text = text.replace(/--v\d+\b/gi, "").trim();
      }
      let outputMode = "image";
      if (/--(video|v)\b/i.test(text)) {
        outputMode = "video";
        text = text.replace(/--(video|v)\b/gi, "").trim();
      } else if (/--(image|i)\b/i.test(text)) {
        outputMode = "image";
        text = text.replace(/--(image|i)\b/gi, "").trim();
      }
      const prompt = text || "masterpiece, high quality, 4k ultra detailed";
      let mediaUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (!buffer || !Buffer.isBuffer(buffer)) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh media dari pesan.");
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengunggah media: ${uploadRes?.message || "Server upload error"}`);
        }
        mediaUrl = uploadRes.url;
      }
      let resolvedMode = outputMode;
      let displayType = "";
      if (version === "v49") {
        if (mediaUrl) {
          resolvedMode = outputMode === "video" ? "i2v" : "t2i";
          displayType = outputMode === "video" ? "Image-to-Video (I2V)" : "Image-to-Image (I2I)";
        } else {
          resolvedMode = outputMode === "video" ? "t2v" : "t2i";
          displayType = outputMode === "video" ? "Text-to-Video (T2V)" : "Text-to-Image (T2I)";
        }
      } else {
        if (mediaUrl) {
          displayType = outputMode === "video" ? "Image-to-Video (I2V)" : "Image-to-Image (I2I)";
        } else {
          displayType = outputMode === "video" ? "Text-to-Video (T2V)" : "Text-to-Image (T2I)";
        }
      }
      const body = {
        action: "generate",
        mode: resolvedMode,
        prompt: prompt
      };
      if (mediaUrl) {
        body.media = mediaUrl;
        body.image = mediaUrl;
      }
      const apiUrl = `${global.bot?.api?.wudysoft}/api/ai/video/${version}?action=generate`;
      const {
        data
      } = await axios.post(apiUrl, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const resultUrl = data?.result?.url || (typeof data?.result === "string" ? data.result : null) || data?.url;
      const isSuccess = data?.status === "success" || data?.status === true;
      if (!isSuccess || !resultUrl) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses pada versi \`${version}\`: ${data?.message || "API tidak mengembalikan file hasil."}`);
      }
      const jobId = data?.result?.jobId || data?.jobId || data?.result?.video_id || "-";
      const bodyText = `–  *F L I X A R I T E K  A I*

Proses olah media berhasil diselesaikan.

┌  ◦  *Versi API* : \`${version.toUpperCase()}\`
│  ◦  *Mode* : ${displayType}
└  ◦  *Job ID* : \`${jobId}\`

–  *P R O M P T*

“${prompt}”`;
      const isVideoResult = outputMode === "video" || /\.(mp4|mov|webm)/i.test(resultUrl);
      if (isVideoResult) {
        await sock.sendMessage(ctx.id, {
          video: {
            url: resultUrl
          },
          caption: bodyText,
          mimetype: "video/mp4"
        }, {
          quoted: quotedMsg
        });
      } else {
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, `${botFooter} • ${version.toUpperCase()}`, [], {
            title: "– FLIXARITEK AI –",
            subtitle: `Mode: ${displayType}`,
            media: resultUrl,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: {
              url: resultUrl
            },
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        }
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[FlixAritek Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada FlixAritek AI: ${errMsg}`);
    }
  }
};