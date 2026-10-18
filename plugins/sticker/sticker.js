import axios from "axios";
import {
  writeExifImg,
  writeExifVid,
  writeExif
} from "../../lib/exif.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function parseStickerInput(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["fps", "frame"].includes(key)) key = "fps";
    if (["crop", "c"].includes(key)) key = "crop";
    if (["quality", "q"].includes(key)) key = "quality";
    if (["speed", "spd"].includes(key)) key = "speed";
    if (["duration", "t", "time"].includes(key)) key = "duration";
    if (["ss", "start"].includes(key)) key = "start";
    if (["circle", "round", "bulat"].includes(key)) key = "circle";
    if (["rotate", "rot"].includes(key)) key = "rotate";
    if (["flip"].includes(key)) key = "flip";
    if (["reverse", "rev"].includes(key)) key = "reverse";
    if (["gray", "grey", "grayscale"].includes(key)) key = "gray";
    if (["invert", "negate"].includes(key)) key = "invert";
    if (["sepia"].includes(key)) key = "sepia";
    if (["blur"].includes(key)) key = "blur";
    if (["pixel", "pixelate"].includes(key)) key = "pixel";
    if (["vignette"].includes(key)) key = "vignette";
    if (["bright", "brightness"].includes(key)) key = "bright";
    if (["contrast"].includes(key)) key = "contrast";
    if (["sat", "saturation"].includes(key)) key = "sat";
    if (["colorkey", "chroma"].includes(key)) key = "colorkey";
    if (["nobg", "removebg", "transparent"].includes(key)) key = "nobg";
    if (["stretch", "fit"].includes(key)) key = "stretch";
    if (["scale", "res", "size"].includes(key)) key = "scale";
    if (["pack", "packname", "p"].includes(key)) key = "pack";
    if (["author", "wm", "a"].includes(key)) key = "author";
    if (["emojis", "emoji", "e"].includes(key)) key = "emojis";
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
  const cleanText = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanText: cleanText
  };
}

function sniffMediaType(buffer, fallbackMime = "") {
  if (!buffer || !Buffer.isBuffer(buffer)) return "unknown";
  if (buffer.length > 12 && buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WEBP") {
    return "sticker";
  }
  if (buffer.length > 3 && buffer.slice(0, 3).toString() === "GIF") {
    return "video";
  }
  if (buffer.length > 8 && buffer.slice(4, 8).toString() === "ftyp") {
    return "video";
  }
  if (buffer.length > 2 && buffer[0] === 255 && buffer[1] === 216) {
    return "image";
  }
  if (buffer.length > 4 && buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71) {
    return "image";
  }
  const mime = String(fallbackMime || "").toLowerCase();
  if (/webp/i.test(mime)) return "sticker";
  if (/video|gif|ptv/i.test(mime)) return "video";
  if (/image/i.test(mime)) return "image";
  return "image";
}
export default {
  name: "sticker",
  aliases: ["s", "stikermaker", "stiker", "sgif", "swm", "wm"],
  description: "Ubah media/link jadi stiker WhatsApp (Mendukung link URL, reply media, Pack | Author, & Flags)",
  category: "Tools",
  example: ".s https://example.com/foto.jpg --nobg atau reply media dengan .s Packname | Author",
  execute: async (sock, ctx, msg) => {
    try {
      const rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      const prefix = ctx.prefix || ".";
      const {
        flags,
        cleanText: textAfterFlags
      } = parseStickerInput(rawQuery);
      const urlRegex = /https?:\/\/[^\s]+(?:\.jpe?g|\.png|\.webp|\.gif|\.mp4|\.mov|\.bmp|\.bin|[^\s]*)/i;
      const matchUrl = textAfterFlags.match(urlRegex) || (ctx.quoted?.text || "").match(urlRegex);
      const mediaUrl = matchUrl ? matchUrl[0] : null;
      const cleanText = mediaUrl ? textAfterFlags.replace(mediaUrl, "").trim() : textAfterFlags;
      const mime = (ctx.mimetype || ctx.quoted?.mimetype || "").toLowerCase();
      const mediaType = (ctx.mediaType || ctx.quoted?.mediaType || "").toLowerCase();
      const fileName = (ctx.fileName || ctx.quoted?.fileName || "").toLowerCase();
      const hasMedia = Boolean(mediaUrl) || ctx.isMedia || ctx.quoted?.isMedia || Boolean(ctx.quoted) || /image|video|webp|gif|pdf|document/i.test(mime) || ["image", "video", "sticker", "document", "ptv"].includes(mediaType) || /\.(jpe?g|png|webp|mp4|gif|mov|bmp)$/i.test(fileName);
      if (!hasMedia) {
        return ctx.reply(`–  *S T I C K E R*

Kirim atau balas (reply) media gambar/video dengan format berikut.

┌  ◦  *Convert* : ${prefix}s (reply gambar/video/gif)
│  ◦  *Watermark* : ${prefix}s <pack> | <author>
│  ◦  *Custom WM* : ${prefix}swm <pack> | <author>
└  ◦  *From URL* : ${prefix}s <link_media>

–  *F L A G S*

┌  ◦  *--nobg* : Hapus latar belakang
│  ◦  *--circle* : Stiker bentuk bulat
│  ◦  *--crop* : square / 1:1
│  ◦  *--blur* : Efek buram (1-10)
│  ◦  *--pixel* : Efek pixelate (1-10)
│  ◦  *--sepia* : Efek vintage
│  ◦  *--speed* : Kecepatan video (0.5 - 2)
└  ◦  *--fps* : Frame rate video (15 - 60)`);
      }
      await ctx.react("⏳");
      let buffer = null;
      let finalMime = mime;
      if (mediaUrl && (!ctx.isMedia && !ctx.quoted?.isMedia)) {
        try {
          const res = await axios.get(mediaUrl, {
            responseType: "arraybuffer",
            timeout: 25e3,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "*/*"
            }
          });
          buffer = Buffer.from(res.data);
          finalMime = res.headers?.["content-type"] || "";
        } catch (fetchErr) {
          throw new Error(`Gagal mengunduh media dari link: ${fetchErr.message}`);
        }
      } else if (typeof ctx.download === "function") {
        buffer = await ctx.download();
      } else if (typeof ctx.quoted?.download === "function") {
        buffer = await ctx.quoted.download();
      } else if (mediaUrl) {
        const res = await axios.get(mediaUrl, {
          responseType: "arraybuffer",
          timeout: 25e3
        });
        buffer = Buffer.from(res.data);
        finalMime = res.headers?.["content-type"] || "";
      }
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh media dari link atau pesan tersebut.");
      }
      const detectedType = sniffMediaType(buffer, finalMime);
      const cmd = (ctx.cmd || ctx.command || "").toLowerCase();
      const isSwm = ["swm", "wm"].includes(cmd);
      let customPack = "";
      let customAuthor = "";
      if (cleanText.includes("|")) {
        const parts = cleanText.split("|");
        customPack = parts[0]?.trim() || "";
        customAuthor = parts.slice(1).join("|")?.trim() || "";
      } else if (cleanText) {
        customPack = cleanText.trim();
      }
      const rawPack = flags.pack !== undefined && typeof flags.pack !== "boolean" ? String(flags.pack).trim() : customPack;
      const rawAuthor = flags.author !== undefined && typeof flags.author !== "boolean" ? String(flags.author).trim() : customAuthor;
      let finalPack = "";
      let finalAuthor = "";
      if (isSwm) {
        finalPack = rawPack;
        finalAuthor = rawAuthor;
      } else {
        finalPack = rawPack || global.bot?.name || "Wudysoft Bot";
        finalAuthor = rawAuthor || global.bot?.author?.name || "Wudysoft";
      }
      const exif = {
        packname: finalPack || "",
        author: finalAuthor || "",
        categories: flags.emojis ? String(flags.emojis).split(",") : ["🤖"]
      };
      let stickerBuffer = null;
      if (detectedType === "sticker") {
        const hasFilters = Boolean(flags.circle || flags.crop || flags.rotate || flags.flip || flags.sepia || flags.blur || flags.gray || flags.pixel || flags.nobg);
        if (hasFilters) {
          stickerBuffer = await writeExifImg(buffer, exif, flags);
        } else {
          stickerBuffer = await writeExif({
            data: buffer,
            mimetype: "image/webp"
          }, exif, flags);
        }
      } else if (detectedType === "video" || ctx.isAnimated || ctx.quoted?.isAnimated) {
        stickerBuffer = await writeExifVid(buffer, exif, flags);
      } else {
        stickerBuffer = await writeExifImg(buffer, exif, flags);
      }
      if (!stickerBuffer) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memproses konversi stiker.");
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      await sock.sendMessage(ctx.id, {
        sticker: stickerBuffer
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[Sticker Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal membuat stiker: ${error?.message || error}`);
    }
  }
};