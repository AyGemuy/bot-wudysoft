import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "img2img",
  aliases: ["editgambar", "aiimage", "image2image"],
  description: "Edit / transformasi gambar dengan AI menggunakan prompt bebas",
  category: "Maker",
  limit: true,
  execute: async (sock, ctx, msg) => {
    try {
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prompt = (ctx.args?.join(" ") || ctx.query || "").trim();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!isMedia || !prompt) {
        return ctx.reply(`–  *I M G 2 I M G  A I*

Silakan kirim atau balas gambar dengan menyertakan prompt deskripsi perubahan.

┌  ◦  *Format* : \`${prefix}img2img <prompt>\`
│  ◦  *Contoh 1* : \`${prefix}img2img ubah warna menjadi merah metalik, cyberpunk style\`
└  ◦  *Contoh 2* : \`${prefix}img2img jadikan versi anime 3D render 4k\``);
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
        prompt: prompt,
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
      const captionText = `–  *I M G 2 I M G  A I*

┌  ◦  *Status* : Sukses
│  ◦  *Prompt* : ${prompt}
└  ◦  *Render Time* : ${costTime}`;
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
      ctx.reply(`❌ Img2Img Error: ${errMsg}`);
    }
  }
};