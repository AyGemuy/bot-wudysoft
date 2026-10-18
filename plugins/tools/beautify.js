import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/tools/beauty-js`;
const CONFIG = {
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      type: ["t", "filetype", "format"],
      url: ["u", "link"],
      doc: ["d", "document", "file"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
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
  name: "beauty",
  aliases: ["beautify", "beautyjs", "jsbeautify", "unminify"],
  description: "Merapikan dan memformat kode JS, HTML, CSS, atau arsip ZIP",
  category: "Developer",
  limit: true,
  example: "• Teks langsung: .beauty const a=1;function b(){return a+2;}\n• Balas file/dokumen dengan .beauty\n• Balas file zip dengan .beauty",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Code Beautifier`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const targetChat = ctx.chat || ctx.id;
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["beauty", "beautify", "beautyjs", "jsbeautify", "unminify"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const quotedText = ctx.quoted?.text || ctx.quoted?.body || "";
      const inputCode = cleanPrompt || quotedText;
      let fileUrl = flags.url || "";
      let originalFileName = ctx.fileName || ctx.quoted?.fileName || (flags.type ? `code.${flags.type}` : "script.js");
      if (!fileUrl) {
        if (/^https?:\/\/.+/i.test(cleanPrompt)) {
          fileUrl = cleanPrompt.split(/\s+/)[0];
        } else if (isMedia) {
          await ctx.react?.("⏳");
          const buffer = await ctx.download?.();
          if (!buffer || !Buffer.isBuffer(buffer)) {
            await ctx.react?.("❌");
            return ctx.reply("❌ Gagal mengunduh file dokumen dari WhatsApp.");
          }
          const uploadRes = await upload(buffer);
          if (!uploadRes?.status || !uploadRes?.url) {
            await ctx.react?.("❌");
            return ctx.reply("❌ Gagal mengunggah berkas untuk diproses di server.");
          }
          fileUrl = uploadRes.url;
        } else if (inputCode) {
          await ctx.react?.("⏳");
          const codeBuffer = Buffer.from(inputCode, "utf-8");
          const uploadRes = await upload(codeBuffer);
          if (!uploadRes?.status || !uploadRes?.url) {
            await ctx.react?.("❌");
            return ctx.reply("❌ Gagal mengunggah kode mentah ke server.");
          }
          fileUrl = uploadRes.url;
          originalFileName = `code.${flags.type || "js"}`;
        }
      }
      if (!fileUrl) {
        return ctx.reply(`–  *C O D E  B E A U T I F I E R*

Format dan rapikan struktur kode minified (JS, HTML, CSS, ZIP).

┌  ◦  *Teks/Kode* : \`${prefix}beauty <kode>\`
│  ◦  *Reply Teks* : Balas pesan kode dengan \`${prefix}beauty\`
│  ◦  *Dokumen* : Balas file .js / .html / .zip dengan \`${prefix}beauty\`
└  ◦  *Example* : \`${prefix}beauty var a=1;function b(){return a+1;}\`

–  *F L A G S*

┌  ◦  *-t, --type* : Format (\`js\`, \`html\`, \`css\`, \`txt\`)
│  ◦  *-u, --url* : Link berkas langsung
└  ◦  *-d, --doc* : Paksa kirim sebagai dokumen file`);
      }
      await ctx.react?.("⏳");
      const queryParams = {
        url: fileUrl,
        ...flags.type && {
          filetype: flags.type
        }
      };
      const res = await axios.get(API_URL, {
        params: queryParams,
        responseType: "arraybuffer",
        headers: {
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const resultBuffer = Buffer.from(res.data);
      if (!resultBuffer || resultBuffer.length === 0) {
        await ctx.react?.("❌");
        return ctx.reply("❌ Server tidak mengembalikan hasil formatting.");
      }
      const contentType = res.headers["content-type"] || "";
      const isZip = contentType.includes("zip") || originalFileName.endsWith(".zip") || resultBuffer.length > 4 && resultBuffer[0] === 80 && resultBuffer[1] === 75;
      if (isZip) {
        await ctx.react?.("✨");
        return await sock.sendMessage(targetChat, {
          document: resultBuffer,
          fileName: `beautified-${originalFileName.replace(/\.zip$/i, "")}.zip`,
          mimetype: "application/zip",
          caption: `–  *B E A U T Y  Z I P  P A C K*\n\nSeluruh berkas kode di dalam arsip ZIP berhasil dirapikan.`
        }, {
          quoted: quotedMsg
        });
      }
      const outputText = resultBuffer.toString("utf-8");
      const lines = outputText.split("\n").length;
      const chars = outputText.length;
      const determinedExt = flags.type || (originalFileName.includes(".") ? originalFileName.split(".").pop() : "js");
      if (chars <= 2500 && !flags.doc) {
        const headerText = `–  *C O D E  B E A U T I F I E D*

┌  ◦  *Format* : ${determinedExt.toUpperCase()}
│  ◦  *Lines* : ${lines} Baris
└  ◦  *Size* : ${chars} Karakter`;
        const buttons = [{
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "📋 Salin Kode",
            copy_code: outputText
          })
        }];
        const options = {
          quoted: quotedMsg,
          contextInfo: {
            mentionedJid: [ctx.sender],
            forwardingScore: 999,
            isForwarded: true
          }
        };
        const displayMessage = `${headerText}\n\n\`\`\`${determinedExt}\n${outputText}\n\`\`\``;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(displayMessage, botFooter, buttons, options);
        } else {
          await sock.sendMessage(targetChat, {
            text: `${displayMessage}\n\n_${botFooter}_`
          }, {
            quoted: quotedMsg
          });
        }
      } else {
        const mimeMap = {
          js: "application/javascript",
          html: "text/html",
          css: "text/css",
          txt: "text/plain"
        };
        const docMime = mimeMap[determinedExt] || "application/javascript";
        const docFileName = `beautified-${originalFileName.replace(/\.[^/.]+$/, "")}.${determinedExt}`;
        await sock.sendMessage(targetChat, {
          document: resultBuffer,
          fileName: docFileName,
          mimetype: docMime,
          caption: `–  *C O D E  B E A U T I F I E D*\n\n┌  ◦  *File* : \`${docFileName}\`\n│  ◦  *Lines* : ${lines} Baris\n└  ◦  *Size* : ${(chars / 1024).toFixed(2)} KB\n\n_Kode hasil beautify dikirim dalam bentuk dokumen agar tidak terpotong._`
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react?.("✨");
    } catch (error) {
      console.error("[Beauty Code Error]:", error);
      await ctx.react?.("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Beautifier Error: ${errMsg}`);
    }
  }
};