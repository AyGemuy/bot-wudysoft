import {
  areJidsSameUser
} from "@whiskeysockets/baileys";
import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
const CONFIG = {
  V4_URL: `${global.bot?.api?.wudysoft}/api/tools/nsfw-check/v4`,
  V1_URL: `${global.bot?.api?.wudysoft}/api/tools/nsfw-check/v1`,
  TIMEOUT: 45e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
async function checkNsfw(imageUrl) {
  try {
    if (!imageUrl) return null;
    try {
      const resV4 = await axios.post(CONFIG.V4_URL, {
        image: imageUrl
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const dataV4 = resV4?.data;
      if (dataV4 && (dataV4.success || dataV4.status) && dataV4.result) {
        return {
          isNsfw: Boolean(dataV4.result.isNsfw),
          labelName: dataV4.result.labelName || "NSFW",
          confidence: dataV4.result.percentage || `${Math.round((dataV4.result.confidence || 0) * 100)}%`,
          version: "v4"
        };
      }
    } catch (errV4) {
      console.warn(`[ANTI NSFW] API v4 gagal (${errV4?.message}), beralih ke fallback v1...`);
    }
    const resV1 = await axios.post(CONFIG.V1_URL, {
      image: imageUrl
    }, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": CONFIG.USER_AGENT
      },
      timeout: CONFIG.TIMEOUT
    });
    const dataV1 = resV1?.data;
    if (dataV1 && (dataV1.success || dataV1.status) && dataV1.result) {
      return {
        isNsfw: Boolean(dataV1.result.isNsfw),
        labelName: dataV1.result.labelName || "NSFW",
        confidence: dataV1.result.percentage || `${Math.round((dataV1.result.confidence || 0) * 100)}%`,
        version: "v1"
      };
    }
    return null;
  } catch (err) {
    console.error("[ANTI NSFW Check Error]:", err?.message || err);
    return null;
  }
}
export default {
  name: "antinsfw",
  description: "Mendeteksi dan menghapus stiker, gambar, dan video NSFW yang dikirim di dalam grup",
  category: "Handler",
  execute: async () => {},
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isGroup = ctx.isGroup;
      if (!isGroup) return;
      const groupData = global.db?.group?.[ctx.chat] || {};
      const isAntiNsfw = groupData?.antinsfw === true || global.bot?.antinsfw === true;
      if (!isAntiNsfw) return;
      const senderJid = msg?.key?.participant || msg?.key?.remoteJid || ctx.sender;
      const myId = sock.user?.id || sock.user?.jid || "";
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe || senderJid && myId && areJidsSameUser(senderJid, myId));
      if (isFromMe) return;
      const rawMsgObj = msg?.message || ctx.rawMessage || {};
      const innerMessage = rawMsgObj?.ephemeralMessage?.message || rawMsgObj?.viewOnceMessage?.message || rawMsgObj?.viewOnceMessageV2?.message || rawMsgObj?.documentWithCaptionMessage?.message || rawMsgObj;
      const isImage = Boolean(innerMessage?.imageMessage || rawMsgObj?.imageMessage || ctx.mtype === "imageMessage" || ctx.isImage);
      const isSticker = Boolean(innerMessage?.stickerMessage || rawMsgObj?.stickerMessage || ctx.mtype === "stickerMessage" || ctx.isSticker);
      const isVideo = Boolean(innerMessage?.videoMessage || innerMessage?.ptvMessage || rawMsgObj?.videoMessage || rawMsgObj?.ptvMessage || ctx.mtype === "videoMessage" || ctx.mtype === "ptvMessage" || ctx.isVideo);
      if (!isImage && !isSticker && !isVideo) return;
      let mediaBuffer = null;
      if (isVideo && innerMessage?.videoMessage?.jpegThumbnail) {
        mediaBuffer = Buffer.from(innerMessage.videoMessage.jpegThumbnail);
      }
      if (!mediaBuffer && typeof ctx.download === "function") {
        mediaBuffer = await ctx.download().catch(() => null);
      }
      if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer)) return;
      const uploadRes = await upload(mediaBuffer).catch(() => null);
      const targetUrl = uploadRes?.url || uploadRes?.status && uploadRes?.data?.url;
      if (!targetUrl) return;
      const mediaType = isVideo ? "video" : isSticker ? "stiker" : "gambar";
      console.log(`[ ANTI NSFW ] Memeriksa ${mediaType} dari ${senderJid} di grup ${ctx.chat}...`);
      const scanResult = await checkNsfw(targetUrl);
      if (!scanResult || !scanResult.isNsfw) return;
      console.log(`[ ANTI NSFW DETECTED ] Terdeteksi konten NSFW (${scanResult.labelName} - ${scanResult.confidence}) via ${scanResult.version} dari ${senderJid}`);
      if (ctx.isBotAdmin) {
        await ctx.delete().catch(() => {});
      }
      const prefix = ctx.prefix || ".";
      const senderNum = senderJid ? senderJid.split("@")[0] : "User";
      const botName = global.bot?.name || "Security";
      const botFooter = `${botName} • Anti-NSFW Guardian`;
      const warningText = `–  *A N T I - N S F W*

⚠️ Peringatan untuk @${senderNum}!
Dilarang mengirim ${mediaType} yang mengandung unsur NSFW/18+ di grup ini.

┌  ◦  *Jenis Media* : ${mediaType.toUpperCase()}
│  ◦  *Kategori*    : ${scanResult.labelName}
│  ◦  *Akurasi*     : ${scanResult.confidence}
└  ◦  *Tindakan*    : Pesan telah dihapus oleh bot.

_Admin dapat menentukan tindakan selanjutnya melalui tombol di bawah:_`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🚨 Kick Pelanggar",
          id: `${prefix}kick @${senderNum}`
        })
      }];
      const ctaOptions = {
        contextInfo: {
          mentionedJid: [senderJid]
        }
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(warningText, botFooter, buttons, ctaOptions);
      } else {
        await ctx.reply(warningText, {
          mentions: [senderJid]
        });
      }
      return true;
    } catch (e) {
      console.error("[ ANTI NSFW ERROR ]", e?.message || e);
    }
  }
};