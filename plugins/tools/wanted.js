import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/maker/wanted/v2`;
const DEFAULT_AVATAR = "https://files.catbox.moe/8ugr9a.jpg";

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["image", "img", "imageurl", "url", "u"].includes(key)) key = "imageUrl";
    if (["help", "h"].includes(key)) key = "help";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      flags[key] = rawVal;
    } else {
      flags[key] = val;
    }
  }
  const cleanText = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanText: cleanText
  };
}
export default {
  name: "wanted",
  aliases: ["wantedposter", "buronan", "dpo"],
  description: "Buat poster buronan / Wanted One Piece dari foto, mention user, URL, atau diri sendiri",
  category: "Maker",
  limit: true,
  example: "wanted (diri sendiri) atau wanted @user atau reply foto dengan .wanted",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      const rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      const {
        flags,
        cleanText
      } = parseFlags(rawQuery);
      if (flags.help) {
        const helpText = `– *W A N T E D*\n\n` + `┌ ◦ *Usage* : ${prefix}wanted <url / @user>\n` + `│ ◦ *Quoted* : Balas foto dengan ${prefix}wanted\n` + `└ ◦ *Function* : Membuat poster buronan (Wanted Dead or Alive)\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Self* : ${prefix}wanted\n` + `│ ◦ *Mention* : ${prefix}wanted @user\n` + `└ ◦ *Custom URL* : ${prefix}wanted https://link-gambar.jpg\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      let targetImageUrl = flags.imageUrl || null;
      let targetName = ctx.pushname || "Target";
      const urlMatch = cleanText.match(/https?:\/\/[^\s]+/i);
      if (!targetImageUrl && urlMatch) {
        targetImageUrl = urlMatch[0];
        targetName = "Custom URL";
      }
      const hasMedia = ctx.isMedia || ctx.quoted?.isMedia || Boolean(ctx.msg?.imageMessage || ctx.quoted?.msg?.imageMessage);
      if (!targetImageUrl && hasMedia) {
        let buffer = null;
        if (typeof ctx.download === "function") {
          buffer = await ctx.download();
        } else if (typeof ctx.quoted?.download === "function") {
          buffer = await ctx.quoted.download();
        }
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            targetImageUrl = uploadRes.url;
            targetName = ctx.quoted ? "Quoted Photo" : ctx.pushname || "Sender Photo";
          }
        }
      }
      if (!targetImageUrl) {
        let targetJid = null;
        if (ctx.mentionedJid && ctx.mentionedJid.length > 0) {
          targetJid = ctx.mentionedJid[0];
        } else if (ctx.quoted?.sender) {
          targetJid = ctx.quoted.sender;
        } else {
          targetJid = ctx.userPhoneJid || ctx.sender;
        }
        try {
          targetImageUrl = await sock.profilePictureUrl(targetJid, "image");
        } catch {
          targetImageUrl = DEFAULT_AVATAR;
        }
        targetName = typeof ctx.getName === "function" ? ctx.getName(targetJid) : targetJid.split("@")[0];
      }
      if (!targetImageUrl) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memuat gambar\n` + `└ ◦ *Info* : Foto profil atau berkas media target tidak ditemukan.\n\n` + `${footer}`);
      }
      const response = await axios.post(API_URL, {
        imageUrl: targetImageUrl
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const resData = response.data;
      const resultUrl = resData?.result || resData?.url || resData?.data?.url;
      if (!resultUrl) {
        throw new Error(resData?.message || "Server tidak mengembalikan URL poster hasil.");
      }
      const posterRes = await axios.get(resultUrl, {
        responseType: "arraybuffer",
        timeout: 6e4
      });
      const posterBuffer = Buffer.from(posterRes.data);
      if (!posterBuffer || posterBuffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gambar kosong\n` + `└ ◦ *Info* : Server gagal menghasilkan gambar poster.\n\n` + `${footer}`);
      }
      const caption = `– *W A N T E D*\n\n` + `┌ ◦ *Target* : ${targetName}\n` + `│ ◦ *Bounty* : ฿ 1,500,000,000\n` + `└ ◦ *Status* : Dead or Alive\n\n` + `${footer}`;
      const buttons = [{
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "Salin Link Poster",
          id: "copy_wanted_url",
          copy_code: resultUrl
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(caption, `${botName} • Wanted Maker`, buttons, {
          image: posterBuffer,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: posterBuffer,
          caption: caption
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Wanted Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errorMessage}\n` + `└ ◦ *Command* : ${ctx.command || "wanted"}\n\n` + `${footer}`);
    }
  }
};