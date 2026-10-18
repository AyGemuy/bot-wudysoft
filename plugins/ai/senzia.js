import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  DEFAULT_MODEL: "wan2.6-image",
  DEFAULT_RATIO: "16:9",
  DEFAULT_AGENT: "uncensored-ai-image-editor",
  TIMEOUT: 12e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
export default {
  name: "senzia",
  aliases: ["senziaai", "szai"],
  description: "AI Image Generator & Editor menggunakan Senzia (T2I & I2I).",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: senzia a cute cat --ratio 1:1\n• List Model: senzia --models\n• Filter Model: senzia models t2i",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["senzia", "szai", "senziaai"].some(alias => firstWord.endsWith(alias))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Senzia AI`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        const helpText = `–  *S E N Z I A  A I*

Layanan rendering visual dan modifikasi gambar berbasis multi-model engine.

┌  ◦  *Text-to-Image (T2I)* :
│  └ \`${prefix}senzia cyberpunk city --ratio 16:9 --model wan2.6-image\`
│
├  ◦  *Image-to-Image (I2I)* :
│  └ Reply gambar: \`${prefix}senzia change hair to blonde --ratio 1:1\`
│
├  ◦  *Lanjut Sesi / Edit State* :
│  └ \`${prefix}senzia add glowing neon lights --state <state_token>\`
│
├  ◦  *Daftar Model Tersedia* :
│  ├ \`${prefix}senzia --models\` (Semua model)
│  ├ \`${prefix}senzia models t2i\` (Khusus Text to Image)
│  └ \`${prefix}senzia models i2i\` (Khusus Image to Image)
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--model <nama_model>\` (Default: \`${CONFIG.DEFAULT_MODEL}\`)
   ├ \`--ratio <16:9 | 9:16 | 1:1 | 4:3 | 3:4 | 3:2 | 2:3>\`
   ├ \`--res <resolusi>\` (Contoh: 1024*1024, 1280*720)
   ├ \`--state <token>\`
   └ \`--agent <nama_agent>\``;
        return ctx.reply(helpText, {
          quoted: quotedMsg
        });
      }
      const lowerText = text.toLowerCase();
      if (lowerText.startsWith("models") || lowerText.includes("--models")) {
        await ctx.react("⏳");
        let type = "all";
        if (lowerText.includes("t2i")) type = "t2i";
        else if (lowerText.includes("i2i")) type = "i2i";
        const {
          data
        } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/senzia`, {
          action: "models",
          type: type
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: 3e4
        });
        if (!data || !data.status) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengambil daftar model dari server.");
        }
        let modelList = `–  *S E N Z I A  M O D E L S  (${type.toUpperCase()})*\n`;
        if (data.t2i?.models?.length > 0) {
          modelList += `\n┌  ◦  *TEXT TO IMAGE (T2I)*\n`;
          data.t2i.models.forEach(m => {
            modelList += `│  • *${m.displayName}*\n`;
            modelList += `│    Tag: \`--model ${m.modelName}\`\n`;
            if (m.supportedAspectRatios?.length) {
              modelList += `│    Ratio: ${m.supportedAspectRatios.join(", ")}\n`;
            }
          });
          modelList += `└  ◦  *Total T2I* : ${data.t2i.models.length} Models\n`;
        }
        if (data.i2i?.models?.length > 0) {
          modelList += `\n┌  ◦  *IMAGE TO IMAGE (I2I)*\n`;
          data.i2i.models.forEach(m => {
            modelList += `│  • *${m.displayName}*\n`;
            modelList += `│    Tag: \`--model ${m.modelName}\`\n`;
            if (m.supportedAspectRatios?.length) {
              modelList += `│    Ratio: ${m.supportedAspectRatios.join(", ")}\n`;
            }
          });
          modelList += `└  ◦  *Total I2I* : ${data.i2i.models.length} Models\n`;
        }
        await ctx.react("📋");
        return ctx.reply(modelList.trim());
      }
      await ctx.react("⏳");
      let prompt = text;
      let state = "";
      let model = CONFIG.DEFAULT_MODEL;
      let ratio = CONFIG.DEFAULT_RATIO;
      let resolution = "";
      let agentRoute = CONFIG.DEFAULT_AGENT;
      if (/--state\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--state\s+([^\s]+)/i);
        if (match) state = match[1];
        prompt = prompt.replace(/--state\s+[^\s]+/gi, "").trim();
      }
      if (/--model\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--model\s+([^\s]+)/i);
        if (match) model = match[1];
        prompt = prompt.replace(/--model\s+[^\s]+/gi, "").trim();
      }
      if (/--(?:ratio|ar)\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--(?:ratio|ar)\s+([^\s]+)/i);
        if (match) ratio = match[1];
        prompt = prompt.replace(/--(?:ratio|ar)\s+[^\s]+/gi, "").trim();
      }
      if (/--res\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--res\s+([^\s]+)/i);
        if (match) resolution = match[1];
        prompt = prompt.replace(/--res\s+[^\s]+/gi, "").trim();
      }
      if (/--agent\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--agent\s+([^\s]+)/i);
        if (match) agentRoute = match[1];
        prompt = prompt.replace(/--agent\s+[^\s]+/gi, "").trim();
      }
      const body = {
        action: "generate",
        prompt: prompt || "masterpiece, ultra detail, high quality",
        model: model,
        ratio: ratio,
        agentRoute: agentRoute
      };
      if (state) body.state = state;
      if (resolution) body.resolution = resolution;
      if (isMedia) {
        const buffer = await ctx.download();
        if (!buffer) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh media dari pesan.");
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
        }
        body.image = uploadRes.url;
      }
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/senzia`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!data || !data.status || !data.resultUrl) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${data?.message || "API tidak mengembalikan hasil."}`);
      }
      const returnedState = data.state || "";
      const usedModel = data.modelDisplayName || data.model || model;
      const usedRatio = data.aspectRatio || ratio;
      let bodyText = `–  *S E N Z I A  A I*

Proses olah visual berhasil diselesaikan.

┌  ◦  *Model* : \`${usedModel}\`
│  ◦  *Ratio* : ${usedRatio}
└  ◦  *Task ID* : \`${data.taskId || "-"}\`

–  *P R O M P T*

“${prompt || "-"}”`;
      const buttons = [];
      if (returnedState) {
        const nextCommand = `${prefix}senzia <tulis_prompt_edit_lanjutan> --state ${returnedState}`;
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
          title: "– SENZIA AI –",
          subtitle: `Model: ${usedModel}`,
          media: data.resultUrl,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: data.resultUrl
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Senzia Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada Senzia AI: ${errMsg}`);
    }
  }
};