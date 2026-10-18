import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_BASE = `${global.bot?.api?.wudysoft}/api/ai/lupin-ai`;
const CONFIG = {
  DEFAULT_MODEL: "fal-ai/nano-banana",
  TIMEOUT: 45e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
export default {
  name: "lupinai",
  aliases: ["lupin", "aivideo", "sora2", "veo3"],
  description: "AI Video & Image Generator via Lupin AI (Veo 3, Sora 2, Kling, Nano Banana).",
  category: "AI",
  limit: true,
  example: "• Generate: lupinai drone view of neon tokyo --model fal-ai/sora-2/text-to-video\n• Cek Status: lupinai --status <task_id> --token <token>\n• List Model: lupinai --models",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["lupinai", "lupin", "aivideo", "sora2", "veo3"].some(a => firstWord.endsWith(a))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Lupin AI`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        const guideText = `–  *L U P I N  A I*

Layanan rendering visual dan generasi video tingkat lanjut berbasis kecerdasan buatan (Veo 3, Sora 2, Kling, Nano Banana).

┌  ◦  *Generate AI Baru* :
│  ├ \`${prefix}lupinai a cute car in the sky moon --model fal-ai/nano-banana\`
│  └ \`${prefix}lupinai drone view of neon tokyo --model fal-ai/sora-2/text-to-video\`
│
├  ◦  *Image-to-Video (I2V)* :
│  └ Reply / kirim gambar: \`${prefix}lupinai animate camera zoom in\`
│
├  ◦  *Cek Status Task* :
│  └ \`${prefix}lupinai --status <task_id> --token <token_jwt>\`
│
└  ◦  *Daftar Model Tersedia* :
   └ \`${prefix}lupinai --models\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      if (text.includes("--models") || text === "models") {
        const {
          data
        } = await axios.post(API_BASE, {
          action: "models"
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: 3e4
        });
        if (!data || !data.models || !data.models.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengambil daftar model.");
        }
        let modelList = `–  *L U P I N  A I  M O D E L S*\n\n`;
        data.models.forEach(m => {
          modelList += `┌  ◦  *Model* : ${m.title}\n`;
          modelList += `│  ◦  *Tag* : \`--model ${m.aiName}\`\n`;
          modelList += `│  ◦  *Durasi/Tipe* : ${m.seconds || "Auto"} (Koin: ${m.coins})\n`;
          modelList += `└  ◦  *Deskripsi* : ${m.description || "-"}\n\n`;
        });
        await sock.sendMessage(ctx.id, {
          text: modelList.trim()
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      const statusMatch = text.match(/--status\s+([^\s]+)/i);
      if (statusMatch) {
        const taskId = statusMatch[1];
        const tokenMatch = text.match(/--token\s+([^\s]+)/i);
        const token = tokenMatch ? tokenMatch[1] : "";
        if (!token) {
          await ctx.react("❌");
          return ctx.reply(`❌ Masukkan token autentikasi!\nContoh: \`${prefix}lupinai --status ${taskId} --token <token_jwt>\``);
        }
        const {
          data: statusRes
        } = await axios.post(API_BASE, {
          action: "status",
          task_id: taskId,
          token: token
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        if (!statusRes || statusRes.status !== "completed") {
          const checkAgainCommand = `${prefix}lupinai --status ${taskId} --token ${token}`;
          const pendingText = `–  *L U P I N  A I*

Tugas rendering masih diproses di server antrean.

┌  ◦  *Task ID* : \`${taskId}\`
└  ◦  *Status* : \`${statusRes?.status || "Processing"}\` ⏳`;
          const buttons = [{
            name: "cta_copy",
            display_text: "🔄 Salin Cek Ulang",
            copy_code: checkAgainCommand
          }];
          if (typeof ctx.sendCta === "function") {
            await ctx.sendCta(pendingText, botFooter, buttons, {
              title: "– LUPIN AI –",
              subtitle: `Status: ${statusRes?.status || "Processing"}`,
              quoted: quotedMsg
            });
          } else {
            await sock.sendMessage(ctx.id, {
              text: pendingText
            }, {
              quoted: quotedMsg
            });
          }
          await ctx.react("⏳");
          return;
        }
        const mediaUrl = statusRes.video || statusRes.photo;
        const isPhoto = statusRes.isPhoto || mediaUrl?.match(/\.(png|jpg|jpeg|webp)$/i);
        const caption = `–  *L U P I N  A I*

Proses rendering telah selesai.

┌  ◦  *Model* : \`${statusRes.type || "-"}\`
└  ◦  *Task ID* : \`${statusRes.task_id || taskId}\`

–  *P R O M P T*

“${statusRes.prompt || "-"}”`;
        if (isPhoto) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: mediaUrl
            },
            caption: caption.trim()
          }, {
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            video: {
              url: mediaUrl
            },
            caption: caption.trim()
          }, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✅");
        return;
      }
      let model = CONFIG.DEFAULT_MODEL;
      let customToken = "";
      const modelMatch = text.match(/--model\s+([^\s]+)/i);
      if (modelMatch) {
        model = modelMatch[1];
        text = text.replace(modelMatch[0], "").trim();
      }
      const tokenMatch = text.match(/--token\s+([^\s]+)/i);
      if (tokenMatch) {
        customToken = tokenMatch[1];
        text = text.replace(tokenMatch[0], "").trim();
      }
      let prompt = text || "a cute car in the sky moon";
      let imageUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer);
          if (uploadRes?.status && uploadRes?.url) {
            imageUrl = uploadRes.url;
          }
        }
      }
      const body = {
        action: "generate",
        prompt: prompt,
        model: model
      };
      if (imageUrl) body.image = imageUrl;
      if (customToken) body.token = customToken;
      const {
        data: genRes
      } = await axios.post(API_BASE, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!genRes || genRes.code === "ERROR" || !genRes.task_id) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memulai render Lupin AI: ${genRes?.message || "Server error"}`);
      }
      const taskId = genRes.task_id;
      const returnedToken = genRes.token || customToken || "";
      const bodyText = `–  *L U P I N  A I*

Proses rendering telah ditambahkan ke antrean antarmuka server.

┌  ◦  *Model* : \`${model}\`
│  ◦  *Status* : \`${genRes.status || "generating"}\`
└  ◦  *Task ID* : \`${taskId}\`

–  *P R O M P T*

“${prompt}”`;
      const checkStatusCommand = `${prefix}lupinai --status ${taskId} --token ${returnedToken}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin Cek Status",
        copy_code: checkStatusCommand
      }];
      if (returnedToken) {
        buttons.push({
          name: "cta_copy",
          display_text: "🔑 Salin Token Saja",
          copy_code: returnedToken
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          title: "– LUPIN AI –",
          subtitle: `Model: ${model}`,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          text: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Lupin AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada Lupin AI: ${errMsg}`);
    }
  }
};