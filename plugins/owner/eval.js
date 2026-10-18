import syntaxerror from "syntax-error";
import {
  format
} from "util";
import axios from "axios";
import {
  fileURLToPath
} from "url";
import {
  dirname
} from "path";
import {
  createRequire
} from "module";
import * as Baileys from "@whiskeysockets/baileys";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
class CustomArray extends Array {
  constructor(...args) {
    if (typeof args[0] === "number") return super(Math.min(args[0], 1e4));
    else return super(...args);
  }
}

function getSafeQuoted(target, fallbackMsg) {
  if (!target || typeof target !== "object") return undefined;
  const q = target.fakeObj || target.vM || target;
  if (q.key && typeof q.key === "object") {
    let msgObj = q.message;
    if (!msgObj || typeof msgObj !== "object" || Object.keys(msgObj).length === 0) {
      msgObj = {
        conversation: q.text || q.body || q.caption || " "
      };
    }
    return {
      key: q.key,
      message: msgObj,
      messageTimestamp: q.messageTimestamp || Math.floor(Date.now() / 1e3)
    };
  }
  if (fallbackMsg?.key && fallbackMsg?.message) {
    return fallbackMsg;
  }
  return undefined;
}
export default {
  name: "eval",
  aliases: [">", "=>", "ev", "e"],
  description: "Menjalankan kode JavaScript (Teks, Auto-Return, Reply File Dokumen .js, & URL)",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    let rawCode = "";
    const chatId = ctx.chat || ctx.id || msg?.key?.remoteJid;
    const rawQuoted = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const safeQuoted = getSafeQuoted(rawQuoted, msg);
    const safeSendMessage = async (text, customQuoted = safeQuoted) => {
      try {
        return await sock.sendMessage(chatId, {
          text: text
        }, {
          quoted: customQuoted
        });
      } catch (err) {
        return await sock.sendMessage(chatId, {
          text: text
        });
      }
    };
    try {
      const textQuery = (ctx.query || (ctx.args && ctx.args.length > 0 ? ctx.args.join(" ") : "")).trim();
      const isQuotedDoc = Boolean(ctx.quoted && (ctx.quoted.isMedia || ctx.quoted.mediaType === "document" || ctx.quoted.msgType === "documentMessage" || /javascript|text|json|octet-stream/i.test(ctx.quoted.mimetype || "") || /\.(js|json|txt|cjs|mjs)$/i.test(ctx.quoted.fileName || ctx.quoted.msg?.fileName || "")));
      const isDirectDoc = Boolean(!ctx.quoted && (ctx.isMedia || ctx.mediaType === "document" || ctx.msgType === "documentMessage" || /javascript|text|json|octet-stream/i.test(ctx.mimetype || "") || /\.(js|json|txt|cjs|mjs)$/i.test(ctx.fileName || ctx.msg?.fileName || "")));
      if (textQuery) {
        rawCode = textQuery;
      } else if (isQuotedDoc || isDirectDoc) {
        await ctx.react?.("⏳");
        const target = isQuotedDoc ? ctx.quoted : ctx;
        let buffer = null;
        if (typeof target.download === "function") {
          buffer = await target.download();
        } else if (typeof ctx.download === "function") {
          buffer = await ctx.download(target);
        }
        if (buffer && Buffer.isBuffer(buffer)) {
          rawCode = buffer.toString("utf-8").trim();
        }
      } else if (ctx.quoted?.text || ctx.quoted?.caption || ctx.quoted?.body) {
        rawCode = (ctx.quoted.text || ctx.quoted.caption || ctx.quoted.body || "").trim();
      }
      if (/^https?:\/\/[^\s]+$/i.test(rawCode)) {
        await ctx.react?.("⏳");
        const res = await axios.get(rawCode, {
          responseType: "text",
          headers: {
            "User-Agent": "Mozilla/5.0"
          },
          timeout: 2e4
        });
        rawCode = typeof res.data === "string" ? res.data.trim() : JSON.stringify(res.data);
      }
      if (!rawCode) {
        return ctx.reply("❌ Masukkan kode JavaScript, reply file .js/dokumen, atau kirim link.");
      }
      await ctx.react?.("⏳");
      let _return;
      let _syntax = "";
      let _text = rawCode;
      let exec;
      const evalArgs = ["print", "sock", "conn", "ctx", "m", "msg", "require", "Baileys", "baileys", "proto", "generateWAMessageFromContent", "prepareWAMessageMedia", "Array", "process", "module", "exports", "argument"];
      try {
        exec = new(async () => {}).constructor(...evalArgs, "return " + rawCode);
        _text = "return " + rawCode;
      } catch {
        exec = new(async () => {}).constructor(...evalArgs, rawCode);
        _text = rawCode;
      }
      try {
        let i = 15;
        let f = {
          exports: {}
        };
        _return = await exec.call(sock, async (...args) => {
          if (--i < 1) return;
          console.log(...args);
          return await safeSendMessage(format(...args));
        }, sock, sock, ctx, ctx, msg, require, Baileys, Baileys, Baileys.proto, Baileys.generateWAMessageFromContent, Baileys.prepareWAMessageMedia, CustomArray, process, f, f.exports, [sock, ctx, msg]);
        await ctx.react?.("✅");
      } catch (e) {
        await ctx.react?.("❌");
        const err = syntaxerror(_text, "Execution Function", {
          allowReturnOutsideFunction: true,
          allowAwaitOutsideFunction: true,
          sourceType: "module"
        });
        if (err) _syntax = "```\n" + err + "\n```\n\n";
        _return = e;
      }
      let output = _syntax + format(_return);
      if (output.length > 3e4) {
        const fileBuffer = Buffer.from(output, "utf-8");
        await sock.sendMessage(chatId, {
          document: fileBuffer,
          mimetype: "text/plain",
          fileName: "eval_output.txt",
          caption: "⚠️ *Output terlalu panjang, dikirim sebagai dokumen txt.*"
        }, {
          quoted: safeQuoted
        });
      } else {
        await safeSendMessage(output);
      }
    } catch (errGlobal) {
      await ctx.react?.("❌");
      await safeSendMessage(`❌ *Eval Error:*\n\`\`\`\n${format(errGlobal)}\n\`\`\``, undefined);
    }
  }
};