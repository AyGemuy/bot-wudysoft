import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "html2img",
  aliases: ["htmltoimg", "renderhtml", "htmlrender"],
  description: "Render kode HTML atau dokumen .html menjadi gambar (Default v5, Custom --v, Auto-Fallback v1 - v26)",
  category: "Tools",
  limit: true,
  example: "html2img <h1>Halo Dunia</h1> [--v 5] [--width 800] [--height 600]",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    try {
      let htmlCode = "";
      let flagText = ctx.args?.join(" ") || "";
      const targetMsg = ctx.quoted?.isMedia ? ctx.quoted : ctx.isMedia ? ctx : null;
      const mime = targetMsg?.mimetype || targetMsg?.msg?.documentMessage?.mimetype || "";
      const fileName = targetMsg?.fileName || targetMsg?.msg?.documentMessage?.fileName || "";
      const isHtmlDoc = mime.includes("text/html") || mime.includes("text/plain") || fileName.endsWith(".html") || fileName.endsWith(".htm");
      if (targetMsg && isHtmlDoc) {
        await ctx.react("⏳");
        let buffer;
        if (typeof targetMsg.download === "function") {
          buffer = await targetMsg.download();
        } else if (typeof ctx.download === "function") {
          buffer = await ctx.download();
        }
        if (buffer) {
          htmlCode = buffer.toString("utf-8");
        }
      }
      if (!htmlCode) {
        let text = ctx.quoted?.text || ctx.args?.join(" ") || "";
        if (!text && ctx.text) {
          const raw = ctx.text.trim();
          const firstWord = raw.split(/\s+/)[0].toLowerCase();
          if (firstWord.endsWith("html2img") || firstWord.endsWith("htmltoimg") || firstWord.endsWith("renderhtml") || firstWord.endsWith("htmlrender")) {
            text = raw.slice(firstWord.length).trim();
          }
        }
        flagText = text;
        htmlCode = text;
      }
      if (!htmlCode && !flagText) {
        const helpText = `– *H T M L  2  I M G*\n\n` + `┌ ◦ *Usage* : ${prefix}html2img <html_code>\n` + `│ ◦ *Quoted* : Balas teks HTML atau dokumen .html\n` + `└ ◦ *Function* : Merender kode HTML menjadi gambar\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Basic* : ${prefix}html2img <h1>Halo Dunia</h1>\n` + `│ ◦ *Custom Engine* : ${prefix}html2img <h1>Test</h1> --v 10\n` + `└ ◦ *Custom Size* : ${prefix}html2img <h1>Test</h1> --width 800 --height 600\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      let requestedVersion = 5;
      const versionMatch = flagText.match(/--v(?:ersion)?\s+(\d+)/i);
      if (versionMatch) {
        const parsedVersion = parseInt(versionMatch[1]);
        if (parsedVersion >= 1 && parsedVersion <= 26) {
          requestedVersion = parsedVersion;
        }
        flagText = flagText.replace(versionMatch[0], "").trim();
      }
      const restPayload = {};
      const flagRegex = /--([a-zA-Z0-9_]+)\s+([^\s<]+)/g;
      let match;
      while ((match = flagRegex.exec(flagText)) !== null) {
        const key = match[1];
        const value = match[2];
        if (key.toLowerCase() !== "v" && key.toLowerCase() !== "version") {
          restPayload[key] = isNaN(value) ? value : Number(value);
        }
      }
      if (!isHtmlDoc || !targetMsg) {
        htmlCode = flagText.replace(/--[a-zA-Z0-9_]+\s+[^\s<]+/g, "").trim();
      }
      if (!htmlCode) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Kode HTML kosong\n` + `└ ◦ *Info* : Masukkan kode HTML yang ingin di-render.\n\n` + `${footer}`);
      }
      const hasHtmlTag = /<[a-z][\s\S]*>/i.test(htmlCode);
      if (!hasHtmlTag) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Format HTML tidak valid\n` + `└ ◦ *Info* : Kode harus memiliki tag HTML valid (misal: <h1>...</h1>).\n\n` + `${footer}`);
      }
      const body = {
        html: htmlCode,
        ...restPayload
      };
      const allVersions = Array.from({
        length: 26
      }, (_, i) => i + 1);
      const versionQueue = [requestedVersion, ...allVersions.filter(v => v !== requestedVersion)];
      const rawApi = global.bot?.api?.wudysoft || "";
      const apiBase = rawApi.replace(/\/+$/, "");
      let finalImageUrl = null;
      let usedVersion = null;
      let lastErrorMessage = "";
      for (const ver of versionQueue) {
        try {
          const endpoint = `${apiBase}/api/tools/html2img/v${ver}`;
          const res = await axios.post(endpoint, body, {
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            },
            timeout: 15e3
          });
          const resData = res.data;
          const img = resData?.url || resData?.result?.url || (typeof resData?.result === "string" ? resData.result : null) || resData?.image || (typeof resData === "string" && /^https?:\/\//i.test(resData) ? resData : null);
          if (img && typeof img === "string") {
            finalImageUrl = img;
            usedVersion = ver;
            break;
          }
        } catch (err) {
          lastErrorMessage = err.response?.data?.message || err.response?.data?.error || (typeof err.response?.data === "string" ? err.response.data : null) || err.message;
          continue;
        }
      }
      if (!finalImageUrl) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal merender HTML\n` + `└ ◦ *Detail* : ${lastErrorMessage || "Gagal mencoba versi v1 - v26."}\n\n` + `${footer}`);
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const isFallback = usedVersion !== requestedVersion;
      const overrideKeys = Object.keys(restPayload);
      let overrideInfo = "";
      if (overrideKeys.length > 0) {
        overrideInfo = overrideKeys.map(k => `│ ◦ *${k.charAt(0).toUpperCase() + k.slice(1)}* : ${restPayload[k]}`).join("\n") + "\n";
      }
      const caption = `– *H T M L  2  I M G*\n\n` + `┌ ◦ *Engine* : v${usedVersion}${isFallback ? ` (Fallback dari v${requestedVersion})` : ""}\n` + `${overrideInfo}` + `└ ◦ *Length* : ${htmlCode.length} Karakter\n\n` + `${footer}`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: finalImageUrl
        },
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "html2img"}\n\n` + `${footer}`);
    }
  }
};