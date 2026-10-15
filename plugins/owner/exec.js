import {
  exec
} from "child_process";
import {
  promisify,
  format
} from "util";
import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const execAsync = promisify(exec);

function getSafeQuoted(target, fallbackMsg) {
  if (!target || typeof target !== "object") return undefined;
  const q = target.fakeObj || target.vM || target;
  if (q.key && typeof q.key === "object" && q.message && typeof q.message === "object" && Object.keys(q.message).length > 0) {
    return q;
  }
  if (q.key && typeof q.key === "object") {
    return {
      key: q.key,
      message: {
        conversation: q.text || q.body || q.caption || " "
      },
      messageTimestamp: q.messageTimestamp || Math.floor(Date.now() / 1e3)
    };
  }
  if (fallbackMsg?.key && fallbackMsg?.message) {
    return fallbackMsg;
  }
  return undefined;
}
export default {
  name: "exec",
  aliases: ["$", "sh", "terminal"],
  description: "Menjalankan perintah terminal (Teks, Reply Dokumen/Script, & URL)",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    let rawCommand = "";
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
      const isQuotedDoc = Boolean(ctx.quoted && (ctx.quoted.isMedia || ctx.quoted.mediaType === "document" || ctx.quoted.msgType === "documentMessage" || /shell|bash|text|octet-stream|x-sh/i.test(ctx.quoted.mimetype || "") || /\.(sh|bash|bat|cmd|ps1|txt)$/i.test(ctx.quoted.fileName || ctx.quoted.msg?.fileName || "")));
      const isDirectDoc = Boolean(!ctx.quoted && (ctx.isMedia || ctx.mediaType === "document" || ctx.msgType === "documentMessage" || /shell|bash|text|octet-stream|x-sh/i.test(ctx.mimetype || "") || /\.(sh|bash|bat|cmd|ps1|txt)$/i.test(ctx.fileName || ctx.msg?.fileName || "")));
      if (textQuery) {
        rawCommand = textQuery;
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
          rawCommand = buffer.toString("utf-8").trim();
        }
      } else if (ctx.quoted?.text || ctx.quoted?.caption || ctx.quoted?.body) {
        rawCommand = (ctx.quoted.text || ctx.quoted.caption || ctx.quoted.body || "").trim();
      }
      if (/^https?:\/\/[^\s]+$/i.test(rawCommand)) {
        await ctx.react?.("⏳");
        const res = await axios.get(rawCommand, {
          responseType: "text",
          headers: {
            "User-Agent": "Mozilla/5.0"
          },
          timeout: 2e4
        });
        rawCommand = typeof res.data === "string" ? res.data.trim() : JSON.stringify(res.data);
      }
      if (!rawCommand) {
        return ctx.reply("❌ Masukkan perintah terminal, reply file shell/script, atau kirim link.");
      }
      await ctx.react?.("⏳");
      let stdout = "";
      let stderr = "";
      try {
        const res = await execAsync(rawCommand, {
          timeout: 6e4,
          maxBuffer: 1024 * 1024 * 10,
          shell: process.platform === "win32" ? "powershell.exe" : "/bin/bash"
        });
        stdout = res.stdout;
        stderr = res.stderr;
        await ctx.react?.("✅");
      } catch (execErr) {
        await ctx.react?.("❌");
        stdout = execErr.stdout || "";
        stderr = execErr.stderr || execErr.message || "";
      }
      let output = (stdout || stderr || "").trim();
      if (!output) {
        output = "*(perintah selesai tanpa output)*";
      }
      if (output.length > 3e4) {
        const fileBuffer = Buffer.from(output, "utf-8");
        await sock.sendMessage(chatId, {
          document: fileBuffer,
          mimetype: "text/plain",
          fileName: "exec_output.txt",
          caption: "⚠️ *Output terlalu panjang, dikirim sebagai dokumen txt.*"
        }, {
          quoted: safeQuoted
        });
      } else {
        await safeSendMessage("```\n" + output + "\n```");
      }
    } catch (errGlobal) {
      await ctx.react?.("❌");
      await safeSendMessage(`❌ *Terminal Error:*\n\`\`\`\n${format(errGlobal)}\n\`\`\``, undefined);
    }
  }
};