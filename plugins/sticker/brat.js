import axios from "axios";
import {
  writeExifImg,
  writeExifVid
} from "../../lib/exif.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const BASE_URL_STATIC = `${global.bot?.api?.wudysoft}/api/maker/brat/v1`;
const BASE_URL_VIDEO = `${global.bot?.api?.wudysoft}/api/maker/brat/video`;

function parseBratFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["video", "vid", "anim", "animated", "gif", "v"].includes(key)) key = "video";
    if (["host", "server", "h"].includes(key)) key = "host";
    if (["pack", "packname", "p"].includes(key)) key = "pack";
    if (["author", "wm", "a"].includes(key)) key = "author";
    if (["emojis", "emoji", "e"].includes(key)) key = "emojis";
    if (["fps", "frame"].includes(key)) key = "fps";
    if (["help"].includes(key)) key = "help";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (!isNaN(rawVal) && rawVal.trim() !== "" && ["host", "fps"].includes(key)) {
        val = Number(rawVal);
      } else {
        val = rawVal;
      }
    }
    flags[key] = val;
  }
  const cleanText = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanText: cleanText
  };
}
export default {
  name: "brat",
  aliases: ["sbrat", "bratvideo", "bratvid", "bratanim", "bratgif"],
  description: "Buat stiker gaya Brat (Statis & Animasi Video bergerak)",
  category: "Maker",
  limit: true,
  example: "brat text kamu atau brat text kamu --video atau brat text --host 2",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const cmd = (ctx.command || ctx.cmd || "").toLowerCase();
      let rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      if (!rawQuery && ctx.quoted?.text) {
        rawQuery = ctx.quoted.text.trim();
      }
      const {
        flags,
        cleanText
      } = parseBratFlags(rawQuery);
      const isVideoAlias = ["bratvideo", "bratvid", "bratanim", "bratgif"].includes(cmd);
      const isVideoMode = Boolean(flags.video || isVideoAlias);
      if (!cleanText || flags.help) {
        return ctx.reply(`–  *B R A T*

Silakan tentukan teks yang ingin dibuat stiker gaya Brat.

┌  ◦  *Static* : ${prefix}brat <teks>
│  ◦  *Animated* : ${prefix}bratvid <teks>
│  ◦  *Watermark* : ${prefix}brat <teks> | <pack> | <author>
└  ◦  *Example* : ${prefix}brat teks disini

–  *F L A G S*

┌  ◦  *--video* : Mode animasi video bergerak
│  ◦  *--host* : Pilihan server host (1-7)
└  ◦  *--fps* : Frame rate animasi video (10-30)`);
      }
      await ctx.react("⏳");
      let [mainText, customPack, customAuthor] = cleanText.split("|").map(s => s.trim());
      if (!mainText) mainText = cleanText;
      const exif = {
        packname: flags.pack || customPack || global.bot?.name || "Wudysoft Bot",
        author: flags.author || customAuthor || global.bot?.author?.name || "Brat Maker",
        categories: flags.emojis ? String(flags.emojis).split(",") : ["🟩"]
      };
      let mediaBuffer = null;
      if (isVideoMode) {
        const hostNum = Number(flags.host) || 1;
        const res = await axios.post(BASE_URL_VIDEO, {
          text: mainText,
          host: hostNum
        }, {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 6e4
        });
        mediaBuffer = Buffer.from(res.data);
        if (!mediaBuffer || mediaBuffer.length === 0) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal membuat animasi Brat dari server.");
        }
        const stickerBuffer = await writeExifVid(mediaBuffer, exif, {
          fps: flags.fps || 16,
          ...flags
        });
        await sock.sendMessage(ctx.id, {
          sticker: stickerBuffer
        }, {
          quoted: quotedMsg
        });
      } else {
        const hostNum = Number(flags.host) || 1;
        const res = await axios.post(BASE_URL_STATIC, {
          text: mainText,
          host: hostNum
        }, {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 3e4
        });
        mediaBuffer = Buffer.from(res.data);
        if (!mediaBuffer || mediaBuffer.length === 0) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal membuat gambar Brat dari server.");
        }
        const stickerBuffer = await writeExifImg(mediaBuffer, exif, flags);
        await sock.sendMessage(ctx.id, {
          sticker: stickerBuffer
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Brat Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Brat Error: ${errorMessage}`);
    }
  }
};