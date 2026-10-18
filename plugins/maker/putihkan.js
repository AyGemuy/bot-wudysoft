import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const PRESET_PROMPT = "ubah warna objek dan karakter menjadi putih bersih cerah, glowing, natural, realistis, detail tinggi 4k, soft lighting";
export default {
  name: "putihkan",
  aliases: ["makewhite", "whitepreset", "whitetheme"],
  description: "Mengubah warna objek/karakter pada gambar menjadi putih bersih via AI",
  category: "Maker",
  limit: true,
  execute: async (sock, ctx, msg) => {
    try {
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!isMedia) {
        return ctx.reply(`–  *P U T I H K A N  A I*

Silakan kirim atau balas gambar yang ingin diubah warnanya menjadi putih bersih.

┌  ◦  *Cara Pakai* : Reply/kirim foto
└  ◦  *Command* : \`${prefix}putihkan\``);
      }
      ctx.react?.("⏳");
      const buffer = await ctx.download?.().catch(() => null);
      if (!buffer || !Buffer.isBuffer(buffer)) {
        ctx.react?.("❌");
        return ctx.reply("❌ Gagal mengunduh gambar dari pesan.");
      }
      const uploadRes = await upload(buffer);
      if (!uploadRes?.status || !uploadRes?.url) {
        ctx.react?.("❌");
        return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
      }
      const imageUrlInput = uploadRes.url;
      const payload = {
        prompt: PRESET_PROMPT,
        image: imageUrlInput,
        image_input: imageUrlInput
      };
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/imagetoimageai`, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal memproses gambar dari server AI.");
      }
      const resObj = data.result;
      const resultImageUrl = resObj.imageUrl || resObj.images?.[0] || resObj.taskResult?.resultJson?.resultUrls?.[0] || (typeof resObj === "string" ? resObj : null);
      if (!resultImageUrl) {
        throw new Error("Gambar hasil tidak ditemukan pada respon API.");
      }
      const costTime = resObj.taskResult?.costTime ? `${resObj.taskResult.costTime}s` : "-";
      const captionText = `–  *P U T I H K A N  A I*

┌  ◦  *Status* : Sukses
│  ◦  *Render Time* : ${costTime}
└  ◦  *Preset* : Putih Bersih Realistis`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: resultImageUrl
        },
        caption: captionText
      }, {
        quoted: quotedMsg
      });
      ctx.react?.("✅");
    } catch (error) {
      ctx.react?.("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Putihkan Error: ${errMsg}`);
    }
  }
};