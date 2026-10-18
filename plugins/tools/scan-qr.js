import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/tools/scanqr/v2`;

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["url", "link", "u"].includes(key)) key = "url";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "scanqr",
  aliases: ["qrscan", "readqr", "barcodescan", "scanbarcode"],
  description: "Membaca dan memindai isi kode QR atau Barcode dari gambar",
  category: "Tools",
  limit: true,
  example: "• Reply gambar QR dengan .scanqr\n• Atau kirim link: .scanqr https://example.com/qr.png",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Barcode & QR Reader`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const rawText = (ctx.query || ctx.text || "").trim();
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      let imageUrlInput = flags.url || "";
      if (!imageUrlInput) {
        if (/^https?:\/\/.+/i.test(cleanPrompt)) {
          imageUrlInput = cleanPrompt.split(/\s+/)[0];
        } else if (isMedia) {
          await ctx.react?.("⏳");
          const buffer = await ctx.download?.();
          if (!buffer || !Buffer.isBuffer(buffer)) {
            await ctx.react?.("❌");
            return ctx.reply(`–  *E R R O R*

┌  ◦  *Status* : Gagal mengunduh gambar
└  ◦  *Info* : File media tidak dapat diproses dari pesan WhatsApp.`);
          }
          const uploadRes = await upload(buffer);
          if (!uploadRes?.status || !uploadRes?.url) {
            await ctx.react?.("❌");
            return ctx.reply(`–  *E R R O R*

┌  ◦  *Status* : Gagal mengunggah media
└  ◦  *Info* : ${uploadRes?.message || "Server CDN upload error"}`);
          }
          imageUrlInput = uploadRes.url;
        }
      }
      if (!imageUrlInput) {
        const helpText = `–  *S C A N  Q R  /  B A R C O D E*

Pindai dan ekstrak data dari gambar QR Code atau Barcode.

┌  ◦  *Reply Gambar* : Balas gambar QR/Barcode dengan \`${prefix}scanqr\`
│  ◦  *Via Tautan* : \`${prefix}scanqr <url_gambar>\`
└  ◦  *Example* : \`${prefix}scanqr https://example.com/qr.png\`

_Mendukung berbagai format barcode seperti QR Code, Data Matrix, Aztec, UPC, EAN, dan Code128._`;
        return ctx.reply(helpText, {
          quoted: quotedMsg
        });
      }
      await ctx.react?.("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        url: imageUrlInput
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 3e4
      });
      const scanResult = data?.result;
      if (!scanResult || !scanResult.raw && !scanResult.parsed) {
        await ctx.react?.("❌");
        return ctx.reply(`–  *E R R O R*

┌  ◦  *Status* : Kode tidak terdeteksi
└  ◦  *Detail* : Pastikan gambar kode QR atau Barcode memiliki pencahayaan cukup dan tidak buram.`);
      }
      const parsedText = String(scanResult.parsed || scanResult.raw || "").trim();
      const format = scanResult.format || "QR_CODE";
      const type = scanResult.result || "TEXT";
      const isUrl = /^https?:\/\//i.test(parsedText);
      const bodyText = `–  *S C A N  Q R  R E S U L T*

Pemindaian barcode/QR code berhasil diselesaikan.

┌  ◦  *Format* : ${format}
│  ◦  *Tipe Data* : ${type}
└  ◦  *Panjang* : ${parsedText.length} Karakter

–  *C O N T E N T*

\`\`\`${parsedText}\`\`\``;
      const buttons = [{
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Salin Isi Kode",
          copy_code: parsedText
        })
      }];
      if (isUrl) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "🌐 Kunjungi Tautan",
            url: parsedText,
            merchant_url: parsedText
          })
        });
      }
      const options = {
        contextInfo: {
          mentionedJid: [ctx.sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, options);
      } else {
        await sock.sendMessage(ctx.id, {
          text: `${bodyText}\n\n_${botFooter}_`
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react?.("✅");
    } catch (error) {
      console.error("[ScanQR Error]:", error);
      await ctx.react?.("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`–  *E R R O R*\n\n┌  ◦  *Detail* : ${errMsg}\n└  ◦  *Command* : ${ctx.command || "scanqr"}`);
    }
  }
};