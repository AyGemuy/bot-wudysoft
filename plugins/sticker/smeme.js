import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  writeExifImg
} from "../../lib/exif.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  webpToPNG
} from "../../lib/media.js";
const BASE_API = global.bot?.api?.wudysoft || "";
const PRIMARY_API = `${BASE_API}/api/maker/memegen/v1`;

function encodeMemegen(text = "") {
  if (!text || !text.trim() || text.trim() === "_") return "_";
  const map = {
    " ": "_",
    _: "__",
    "-": "--",
    "\n": "~n",
    "?": "~q",
    "&": "~a",
    "%": "~p",
    "#": "~h",
    "/": "~s",
    "\\": "~b",
    "<": "~l",
    ">": "~g",
    '"': "''"
  };
  return text.trim().split("").map(c => map[c] || c).join("");
}

function parseFlags(rawStr) {
  const rest = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g;
  let match;
  while ((match = flagRegex.exec(rawStr)) !== null) {
    const key = match[1].toLowerCase();
    let val = match[2] ? match[2].trim() : true;
    if (typeof val === "string" && (val.startsWith('"') || val.startsWith("'"))) {
      val = val.slice(1, -1);
    }
    rest[key] = val;
  }
  const cleanText = rawStr.replace(/--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g, "").trim();
  return {
    rest: rest,
    cleanText: cleanText
  };
}

function isWebpBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  return buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WEBP";
}
export default {
  name: "smeme",
  aliases: ["stickermeme", "stikermeme", "memesticker", "smaker"],
  description: "Membuat stiker meme dengan teks atas dan bawah (Direct Buffer API & Auto Fallback)",
  category: "Maker",
  limit: true,
  example: "smeme atas|bawah atau reply stiker/gambar dengan caption .smeme teks atas|teks bawah",
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim();
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        rest,
        cleanText
      } = parseFlags(rawText);
      let topText = "";
      let bottomText = "";
      if (cleanText.includes("|")) {
        const parts = cleanText.split("|");
        topText = parts[0]?.trim() || "";
        bottomText = parts.slice(1).join("|")?.trim() || "";
      } else {
        topText = cleanText.trim();
      }
      if (rest.top) topText = String(rest.top).trim();
      if (rest.bottom) bottomText = String(rest.bottom).trim();
      const customPack = rest.pack || rest.packname || (rest.wm ? String(rest.wm).split("|")[0] : "") || global.bot?.name || "Wudysoft Bot";
      const customAuthor = rest.author || (rest.wm ? String(rest.wm).split("|")[1] : "") || global.bot?.author?.name || "Wudysoft";
      let imageUrl = rest.link || rest.url || rest.image || "";
      if (!imageUrl && !isMedia && !topText && !bottomText) {
        return ctx.reply(`–  *S M E M E*

Balas (reply) stiker atau gambar dengan menyertakan teks meme atas dan bawah.

┌  ◦  *Format* : ${prefix}smeme <teks_atas>|<teks_bawah>
│  ◦  *Top Only* : ${prefix}smeme <teks_atas>
│  ◦  *Bottom Only* : ${prefix}smeme |<teks_bawah>
└  ◦  *Example* : ${prefix}smeme teks atas|teks bawah

Keterangan: Gunakan flag *--pack* dan *--author* untuk mengubah metadata watermark.`);
      }
      await ctx.react("⏳");
      if (!imageUrl && isMedia) {
        let buffer = null;
        if (typeof ctx.download === "function") {
          buffer = await ctx.download();
        } else if (typeof ctx.quoted?.download === "function") {
          buffer = await ctx.quoted.download();
        }
        if (!buffer || !Buffer.isBuffer(buffer)) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh media dari pesan yang dibalas.");
        }
        const mime = (ctx.mimetype || ctx.quoted?.mimetype || "").toLowerCase();
        const mediaType = (ctx.mediaType || ctx.quoted?.mediaType || "").toLowerCase();
        const isSticker = mediaType === "sticker" || /webp/i.test(mime) || isWebpBuffer(buffer);
        if (isSticker) {
          try {
            buffer = await webpToPNG(buffer);
          } catch (convErr) {
            console.error("[SMEME WebP to PNG Error]:", convErr?.message || convErr);
            await ctx.react("❌");
            return ctx.reply("❌ Gagal mengonversi stiker ke format gambar.");
          }
        }
        const uploadRes = await upload(buffer);
        const uploadedUrl = uploadRes?.url || uploadRes?.result || uploadRes?.data?.url || (typeof uploadRes === "string" ? uploadRes : null);
        if (!uploadedUrl) {
          await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengunggah media: ${uploadRes?.message || "Upload error"}`);
        }
        imageUrl = uploadedUrl;
      }
      if (!imageUrl) {
        await ctx.react("❌");
        return ctx.reply("❌ Gambar tidak ditemukan. Silakan balas (reply) stiker atau gambar.");
      }
      let imageBuffer = null;
      const safeTop = topText ? topText : " ";
      const safeBottom = bottomText ? bottomText : " ";
      try {
        const res = await axios.post(PRIMARY_API, {
          action: "generate",
          link: imageUrl,
          top: safeTop,
          bottom: safeBottom
        }, {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0"
          },
          timeout: 3e4
        });
        imageBuffer = Buffer.from(res.data);
      } catch (apiErr) {
        console.warn("[SMEME Primary API Gagal, beralih ke Fallback memegen.link]");
        const directMemeUrl = `https://api.memegen.link/images/custom/${encodeMemegen(topText)}/${encodeMemegen(bottomText)}.png?background=${encodeURIComponent(imageUrl)}`;
        const fallbackRes = await axios.get(directMemeUrl, {
          responseType: "arraybuffer",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 3e4
        });
        imageBuffer = Buffer.from(fallbackRes.data);
      }
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error("Gagal membuat buffer gambar meme.");
      }
      const exif = {
        packname: customPack,
        author: customAuthor,
        categories: ["🤣"]
      };
      const stickerBuffer = await writeExifImg(imageBuffer, exif, false);
      await sock.sendMessage(ctx.id, {
        sticker: stickerBuffer
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[SMEME ERROR]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`❌ Smeme Error: ${errMsg}`);
    }
  }
};