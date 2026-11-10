import { prepareWAMessageMedia } from "@whiskeysockets/baileys";
import axios from "axios";
import {
  writeExifImg,
  writeExifVid,
  writeExif
} from "../../lib/exif.js";
import {
  downloadMediaNode,
  decodeJid
} from "../../core/serialize.js";

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
      if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
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
    flags,
    cleanText
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
  name: "react",
  aliases: ["r", "reaksi"],
  description: "Memberikan reaksi emoji atau reaksi stiker ke pesan tertentu",
  category: "Tools",
  example: ".react 😂 (emoji biasa) atau reply pesan dengan kirim media & caption .react",
  execute: async (sock, ctx, msg) => {
    try {
      const rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      const prefix = ctx.prefix || ".";

      // Cek apakah pesan saat ini melampirkan media langsung (gambar, video, stiker, gif)
      const directMime = (ctx.msg?.mimetype || ctx.rawMessage?.imageMessage?.mimetype || ctx.rawMessage?.videoMessage?.mimetype || ctx.rawMessage?.stickerMessage?.mimetype || "").toLowerCase();
      const isDirectMedia = Boolean(
        directMime ||
        ["imageMessage", "videoMessage", "stickerMessage"].includes(ctx.mtype) ||
        ctx.rawMessage?.imageMessage ||
        ctx.rawMessage?.videoMessage ||
        ctx.rawMessage?.stickerMessage
      );

      // Cek URL media pada argumen
      const urlRegex = /https?:\/\/[^\s]+(?:\.jpe?g|\.png|\.webp|\.gif|\.mp4|\.mov|\.bmp|\.bin|[^\s]*)/i;
      const matchUrl = rawQuery.match(urlRegex);
      const mediaUrl = matchUrl ? matchUrl[0] : null;

      const hasMediaForSticker = isDirectMedia || Boolean(mediaUrl);

      // ==========================================
      // 1. REAKSI STIKER (Sticker Reaction)
      // ==========================================
      if (hasMediaForSticker) {
        // Harus reply pesan target
        if (!ctx.quoted) {
          return ctx.reply("❌ Untuk memberikan reaksi stiker, Anda *harus me-reply pesan target* sambil mengirim media (gambar/video/stiker) beserta caption!");
        }

        const { flags, cleanText: textAfterFlags } = parseStickerInput(rawQuery);
        const cleanText = mediaUrl ? textAfterFlags.replace(mediaUrl, "").trim() : textAfterFlags;

        await ctx.react("⏳");

        let buffer = null;
        let finalMime = directMime;

        if (mediaUrl && !isDirectMedia) {
          try {
            const res = await axios.get(mediaUrl, {
              responseType: "arraybuffer",
              timeout: 25e3,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                Accept: "*/*"
              }
            });
            buffer = Buffer.from(res.data);
            finalMime = res.headers?.["content-type"] || "";
          } catch (fetchErr) {
            throw new Error(`Gagal mengunduh media dari tautan: ${fetchErr.message}`);
          }
        } else {
          // Download media langsung dari pesan pengirim (bukan quoted)
          buffer = await downloadMediaNode(ctx.rawMessage || ctx.message || ctx.msg);
        }

        if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh media yang dilampirkan.");
        }

        const detectedType = sniffMediaType(buffer, finalMime);

        let customPack = "";
        let customAuthor = "";
        if (cleanText.includes("|")) {
          const parts = cleanText.split("|");
          customPack = parts[0]?.trim() || "";
          customAuthor = parts.slice(1).join("|")?.trim() || "";
        } else if (cleanText) {
          customPack = cleanText.trim();
        }

        const finalPack = (flags.pack !== undefined && typeof flags.pack !== "boolean" ? String(flags.pack).trim() : customPack) || global.bot?.name || "Sticker Reaction";
        const finalAuthor = (flags.author !== undefined && typeof flags.author !== "boolean" ? String(flags.author).trim() : customAuthor) || global.bot?.author?.name || "Bot";

        const exif = {
          packname: finalPack,
          author: finalAuthor,
          categories: flags.emojis ? String(flags.emojis).split(",") : ["🤖"]
        };

        // Konversi ke WebP Sticker tanpa sharp (menggunakan helper exif / ffmpeg / jimp)
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
        } else if (detectedType === "video" || ctx.isAnimated) {
          stickerBuffer = await writeExifVid(buffer, exif, flags);
        } else {
          stickerBuffer = await writeExifImg(buffer, exif, flags);
        }

        if (!stickerBuffer) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memproses konversi stiker.");
        }

        // Upload media ke server WhatsApp
        const uploadFn = sock.waUploadToServer || sock.waUp;
        const media = await prepareWAMessageMedia(
          { sticker: stickerBuffer },
          { upload: uploadFn }
        );

        // Susun parent key pesan yang di-react
        const parentJid = ctx.quoted.chat || ctx.chat;
        const parentKey = {
          remoteJid: parentJid,
          fromMe: Boolean(ctx.quoted.fromMe),
          id: ctx.quoted.id
        };

        if (ctx.isGroup && ctx.quoted.sender && !ctx.quoted.fromMe) {
          parentKey.participant = decodeJid(ctx.quoted.sender);
        }

        // Kirim stiker reaksi menggunakan messageAssociation type 11
        await sock.relayMessage(ctx.chat, {
          stickerMessage: media.stickerMessage,
          messageContextInfo: {
            messageAssociation: {
              associationType: 11,
              parentMessageKey: parentKey
            }
          }
        }, {});

        await ctx.react("✅");
        return;
      }

      // ==========================================
      // 2. REAKSI BIASA (Emoji Reaction)
      // ==========================================
      const cleanInput = rawQuery.trim();
      const isReset = ["del", "delete", "hapus", "reset", "clear", "0"].includes(cleanInput.toLowerCase());

      // Target key pesan yang akan direaksikan
      const targetKey = ctx.quoted ? ctx.quoted.key : ctx.key;

      if (isReset) {
        await sock.sendMessage(ctx.chat, {
          react: {
            text: "",
            key: targetKey
          }
        });
        return;
      }

      // Deteksi emoji dari query
      const matchEmoji = cleanInput.match(/(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\u200d)/u);

      if (matchEmoji) {
        // Ambil emoji dari argumen pertama
        const emoji = cleanInput.split(/\s+/)[0];
        await sock.sendMessage(ctx.chat, {
          react: {
            text: emoji,
            key: targetKey
          }
        });
        return;
      }

      // ==========================================
      // 3. PANDUAN PENGGUNAAN
      // ==========================================
      return ctx.reply(`–  *R E A C T I O N*

*1. Reaksi Emoji Biasa:*
┌  ◦  Ketik: *${prefix}react <emoji>*
│  ◦  Atau reply pesan lalu ketik: *${prefix}react <emoji>*
└  ◦  Hapus reaksi: *${prefix}react del*

*2. Reaksi Stiker:*
┌  ◦  Reply pesan yang ingin direaksikan.
│  ◦  Kirim media (gambar/video/stiker) dengan caption:
│     *${prefix}react [Pack | Author] [Flags]*
│  ◦  Atau sertakan link media:
└     *${prefix}react <link_media>*

–  *Flags Stiker (Opsional):*
\`--nobg\` (transparan), \`--circle\` (bulat), \`--crop\`, \`--blur\`, dll.`);

    } catch (error) {
      console.error("[React Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal memberikan reaksi: ${error?.message || error}`);
    }
  }
};