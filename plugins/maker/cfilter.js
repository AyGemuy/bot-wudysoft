import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const VALID_TYPES = ["affect", "batslap", "beautiful", "darkness", "delete", "gay", "greyscale", "invert", "kiss"];
export default {
  name: "cfilter",
  aliases: ["canvafyfilter", "filtercanvas"],
  description: "Beri efek / filter canvas pada gambar via Canvafy API",
  category: "Canvas",
  limit: true,
  example: "reply gambar dengan .cfilter --affect atau .cfilter --batslap --image <link>",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const fullText = (ctx.query || "").trim();
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!fullText && !isMedia) {
        const typeList = VALID_TYPES.map(t => `\`${t}\``).join(", ");
        return ctx.reply(`–  *C A N V A F Y  F I L T E R*

Tambahkan efek canvas menarik ke foto atau avatar Anda!

┌  ◦  *Filter* : ${typeList}
│  ◦  *Reply Gambar* : \`${prefix}cfilter --<type>\`
│  ◦  *Dual Image* : \`${prefix}cfilter --<type> --image <link>\`
└  ◦  *Intensitas* : \`${prefix}cfilter --darkness --intensity 50\``);
      }
      let selectedType = null;
      let secondaryImage = null;
      let intensity = null;
      for (const t of VALID_TYPES) {
        const regex = new RegExp(`(^|\\s)--?${t}(\\s|$)`, "i");
        if (regex.test(fullText)) {
          selectedType = t;
          break;
        }
      }
      if (!selectedType && ctx.args?.[0]) {
        const cleanArg = ctx.args[0].replace(/^--?/, "").toLowerCase();
        if (VALID_TYPES.includes(cleanArg)) {
          selectedType = cleanArg;
        }
      }
      if (!selectedType) {
        return ctx.reply(`–  *C A N V A F Y  F I L T E R*

❌ Filter tidak valid atau belum ditentukan!

┌  ◦  *Pilihan* : ${VALID_TYPES.map(t => `\`${t}\``).join(", ")}
└  ◦  *Contoh* : \`${prefix}cfilter --${VALID_TYPES[0]}\``);
      }
      const imgMatch = fullText.match(/--(?:image|image2)\s+([^\s]+)/i);
      if (imgMatch && imgMatch[1]) {
        secondaryImage = imgMatch[1].trim();
      }
      const intensityMatch = fullText.match(/--intensity\s+(\d+)/i);
      if (intensityMatch && intensityMatch[1]) {
        intensity = Number(intensityMatch[1]);
      }
      ctx.react?.("⏳");
      let primaryImage = null;
      if (isMedia) {
        const buffer = await ctx.download().catch(() => null);
        if (!buffer || !Buffer.isBuffer(buffer)) {
          ctx.react?.("❌");
          return ctx.reply("❌ Gagal mengunduh media dari pesan.");
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          ctx.react?.("❌");
          return ctx.reply(`❌ Gagal upload media: ${uploadRes?.message || "Upload error"}`);
        }
        primaryImage = uploadRes.url;
      } else {
        const target = ctx.mentionedJid?.[0] || ctx.quoted?.sender || ctx.sender;
        try {
          if (typeof sock.profilePictureUrl === "function") {
            primaryImage = await sock.profilePictureUrl(target, "image");
          }
        } catch {
          primaryImage = global.bot?.media?.avatar;
        }
      }
      const payload = {
        type: selectedType,
        image: primaryImage
      };
      if (secondaryImage) {
        payload.image2 = secondaryImage;
      }
      if (intensity !== null && !isNaN(intensity)) {
        payload.intensity = intensity;
      }
      const response = await axios.post(`${global.bot?.api?.wudysoft}/api/canvas/canvafy/filter`, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        responseType: "arraybuffer",
        timeout: 6e4
      });
      if (!response.data) {
        ctx.react?.("❌");
        return ctx.reply("❌ Gagal memproses gambar dari server.");
      }
      const resultBuffer = Buffer.from(response.data);
      const caption = `–  *C A N V A F Y  F I L T E R*

┌  ◦  *Filter* : \`${selectedType.toUpperCase()}\`` + (intensity ? `\n│  ◦  *Intensity* : \`${intensity}\`` : "") + (secondaryImage ? `\n│  ◦  *Image 2* : Terpasang` : "") + `\n└  ◦  *Status* : Sukses`;
      await sock.sendMessage(ctx.id, {
        image: resultBuffer,
        caption: caption
      }, {
        quoted: quotedMsg
      });
      ctx.react?.("✅");
    } catch (error) {
      ctx.react?.("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Filter Error: ${errMsg}`);
    }
  }
};