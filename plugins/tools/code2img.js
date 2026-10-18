import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function parseBodyFlags(rawText) {
  const rest = {};
  let version = "6";
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g;
  let match;
  while ((match = flagRegex.exec(rawText)) !== null) {
    const key = match[1];
    let val = match[2] ? match[2].trim() : true;
    if (typeof val === "string" && (val.startsWith('"') || val.startsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val === "true") val = true;
    else if (val === "false") val = false;
    else if (typeof val === "string" && !isNaN(val) && val !== "") val = Number(val);
    const vMatch = key.match(/^v(\d+)$/i);
    if (vMatch) {
      version = vMatch[1];
    } else if (key.toLowerCase() === "version") {
      version = String(val);
    } else {
      rest[key] = val;
    }
  }
  const code = rawText.replace(/--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g, "").trim();
  return {
    version: version,
    rest: rest,
    code: code
  };
}
export default {
  name: "code2img",
  aliases: ["carbon", "carboncode", "c2img", "codeimage"],
  description: "Mengubah potongan kode menjadi gambar estetik dengan full body override (--flag)",
  category: "Maker",
  limit: true,
  example: "code2img --v6 --theme dracula console.log('Hello World')",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      const rawText = (ctx.query || ctx.text || "").trim();
      const quotedText = ctx.quoted?.text || "";
      const {
        version,
        rest,
        code
      } = parseBodyFlags(rawText);
      const codeText = code || quotedText.trim();
      if (!codeText) {
        const helpText = `– *C O D E  2  I M G*\n\n` + `┌ ◦ *Usage* : ${prefix}code2img <flags> <code / query>\n` + `│ ◦ *Quoted* : Balas pesan berisi kode dengan ${prefix}code2img\n` + `└ ◦ *Function* : Mengubah kode pemrograman menjadi gambar estetik\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Default (v6)* : ${prefix}code2img console.log("Hello World")\n` + `│ ◦ *Custom Theme* : ${prefix}code2img --v6 --theme dracula <code...>\n` + `└ ◦ *Custom Ray.so* : ${prefix}code2img --v7 --theme monokai --language javascript <code...>\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const apiUrl = `${global.bot?.api?.wudysoft}/api/maker/carbon/v${version}`;
      const bodyPayload = {
        code: codeText,
        ...rest
      };
      const res = await axios.post(apiUrl, bodyPayload, {
        responseType: "arraybuffer",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const bufferImage = Buffer.from(res.data);
      const overrideKeys = Object.keys(rest);
      let overrideInfo = "";
      if (overrideKeys.length > 0) {
        overrideInfo = overrideKeys.map(k => `│ ◦ *${k.charAt(0).toUpperCase() + k.slice(1)}* : ${rest[k]}`).join("\n") + "\n";
      } else {
        overrideInfo = `│ ◦ *Theme* : Default\n`;
      }
      const captionText = `– *C O D E  2  I M G*\n\n` + `┌ ◦ *Engine* : Carbon v${version}\n` + `${overrideInfo}` + `└ ◦ *Length* : ${codeText.length} Karakter\n\n` + `${footer}`;
      await sock.sendMessage(ctx.id, {
        image: bufferImage,
        caption: captionText
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "code2img"}\n\n` + `${footer}`);
    }
  }
};