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
  name: "imagetoimageai",
  aliases: ["imagetoimageai", "i2iai"],
  description: "Generate / Transformasi Gambar AI via ImageToImageAI.",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: imagetoimageai a cute cat in the garden --ratio 16:9\n• Image-to-Image: Reply gambar dengan caption imagetoimageai add sunglasses",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("imagetoimageai") || firstWord.endsWith("i2iai")) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • ImageToImageAI`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText && !isMedia) {
        const guideText = `–  *I M A G E  T O  I M A G E  A I*

Layanan rendering visual dan transformasi foto berbasis kecerdasan buatan.

┌  ◦  *Text-to-Image (T2I)* :
│  └ \`${prefix}imagetoimageai cyberpunk city landscape --ratio 16:9\`
│
├  ◦  *Image-to-Image (I2I)* :
│  └ Reply / kirim gambar: \`${prefix}imagetoimageai anime illustration style\`
│
└  ◦  *Parameter Flag Opsional* :
   ├ \`--ratio <1:1 | 16:9 | 9:16 | 4:3>\`
   ├ \`--model <nama_model>\`
   ├ \`--resolution <1k | 2k | 4k>\`
   └ \`--state <state_token>\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      let ratio = "";
      let model = "";
      let resolution = "";
      let state = "";
      let prompt = rawText;
      const ratioMatch = prompt.match(/--(?:ratio|aspect_ratio|ar)\s+([^\s]+)/i);
      if (ratioMatch) {
        ratio = String(ratioMatch[1]);
        prompt = prompt.replace(ratioMatch[0], "").trim();
      }
      const modelMatch = prompt.match(/--model\s+([^\s]+)/i);
      if (modelMatch) {
        model = String(modelMatch[1]);
        prompt = prompt.replace(modelMatch[0], "").trim();
      }
      const resMatch = prompt.match(/--resolution\s+([^\s]+)/i);
      if (resMatch) {
        resolution = String(resMatch[1]);
        prompt = prompt.replace(resMatch[0], "").trim();
      }
      const stateMatch = prompt.match(/--state\s+([^\s]+)/i);
      if (stateMatch) {
        state = String(stateMatch[1]);
        prompt = prompt.replace(stateMatch[0], "").trim();
      }
      let imageUrlInput = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer);
          if (uploadRes?.status && uploadRes?.url) {
            imageUrlInput = uploadRes.url;
          } else {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
          }
        }
      }
      const payload = {
        prompt: prompt || "enhance and beautify this image into 4k ultra detailed"
      };
      if (ratio) {
        payload.ratio = ratio;
        payload.aspect_ratio = ratio;
      }
      if (model) payload.model = model;
      if (resolution) payload.resolution = resolution;
      if (state) payload.state = state;
      if (imageUrlInput) {
        payload.image = imageUrlInput;
        payload.image_input = imageUrlInput;
      }
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/imagetoimageai`, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal me-render gambar dari server AI.");
      }
      const resObj = data.result;
      const imageUrl = resObj.imageUrl || resObj.images?.[0] || resObj.taskResult?.resultJson?.resultUrls?.[0] || (typeof resObj === "string" ? resObj : null);
      if (!imageUrl) {
        throw new Error("Gambar tidak ditemukan pada respon API.");
      }
      const sceneType = String(resObj.scene || (imageUrlInput ? "Image-to-Image (I2I)" : "Text-to-Image (T2I)"));
      const costTime = resObj.taskResult?.costTime ? `${resObj.taskResult.costTime}s` : "-";
      const returnedState = String(resObj.state || data.state || "");
      const usedModel = String(resObj.model || model || "Default");
      const usedPrompt = String(resObj.prompt || prompt);
      let bodyText = `–  *I M A G E  T O  I M A G E  A I*

Proses olah visual berhasil diselesaikan.

┌  ◦  *Mode* : ${sceneType}
│  ◦  *Model* : \`${usedModel}\`
│  ◦  *Rasio* : ${ratio || "Default"}
└  ◦  *Render Time* : ${costTime}

–  *P R O M P T*

“${usedPrompt}”`;
      const buttons = [];
      if (returnedState && returnedState !== "-") {
        const nextCommand = `${prefix}imagetoimageai <tulis_prompt_edit_lanjutan> --state ${returnedState}`;
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Lanjutan Edit",
          copy_code: nextCommand
        }, {
          name: "cta_copy",
          display_text: "🔑 Salin State Token",
          copy_code: returnedState
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          title: "– IMAGE TO IMAGE AI –",
          subtitle: `Model: ${usedModel} • Time: ${costTime}`,
          media: imageUrl,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: imageUrl
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[ImageToImageAI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada ImageToImageAI: ${errMsg}`);
    }
  }
};