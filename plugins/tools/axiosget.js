import axios from "axios";
import path from "path";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const http = axios.create({
  maxRedirects: 10,
  validateStatus: () => true
});

function parseCli(rawText) {
  const tokens = rawText.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(t => t.replace(/^["']|["']$/g, "")) || [];
  let method = "GET";
  let url = null;
  const headers = {};
  const params = {};
  let data = undefined;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const lower = token.toLowerCase();
    if (/^--(get|post|put|delete|patch|head|options)$/i.test(token)) {
      method = token.replace(/^--/i, "").toUpperCase();
    } else if (["-x", "--method"].includes(lower) && tokens[i + 1]) {
      method = tokens[++i].toUpperCase();
    } else if (["-h", "--header", "--headers"].includes(lower) && tokens[i + 1]) {
      const val = tokens[++i];
      try {
        Object.assign(headers, JSON.parse(val));
      } catch {
        const [k, ...v] = val.split(":");
        if (k) headers[k.trim()] = v.join(":").trim();
      }
    } else if (["-p", "--params", "--query"].includes(lower) && tokens[i + 1]) {
      const val = tokens[++i];
      try {
        Object.assign(params, JSON.parse(val));
      } catch {
        new URLSearchParams(val).forEach((v, k) => params[k] = v);
      }
    } else if (["-d", "--data", "--body", "-b"].includes(lower) && tokens[i + 1]) {
      const val = tokens[++i];
      try {
        data = JSON.parse(val);
      } catch {
        data = val;
      }
    } else if (/^https?:\/\//i.test(token)) {
      url = token;
    }
  }
  return {
    method: method,
    url: url,
    headers: headers,
    params: params,
    data: data
  };
}
export default {
  name: "axiosget",
  aliases: ["get", "fetch", "curl", "fetchget"],
  description: "HTTP Client gaya CLI (Mendukung GET, POST, Header, Params, Body & Media)",
  category: "Tools",
  example: ".get --POST https://api.com -H 'Auth: 123' -d '{\"key\":\"val\"}'",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const rawInput = (ctx.query || "").trim();
    const cli = parseCli(rawInput);
    const url = cli.url || ctx.quoted?.text?.match(/https?:\/\/[^\s]+/i)?.[0];
    if (!url) {
      const helpText = `– *H T T P  C L I E N T*\n\n` + `┌ ◦ *Usage* : ${prefix}get <url> [options]\n` + `│ ◦ *Quoted* : Balas pesan yang memiliki tautan URL\n` + `└ ◦ *Function* : Melakukan request HTTP (GET, POST, PUT, DELETE, dsb)\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Basic* : ${prefix}get https://api.github.com\n` + `│ ◦ *Post Body* : ${prefix}get --POST <url> -d '{"key":"val"}'\n` + `│ ◦ *Header* : ${prefix}get <url> -H "Authorization: Bearer token"\n` + `└ ◦ *Query* : ${prefix}get <url> -p "page=1"\n\n` + `${footer}`;
      return ctx.reply(helpText);
    }
    try {
      await ctx.react("⏳");
      const res = await http({
        method: cli.method,
        url: url,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "*/*",
          ...cli.headers
        },
        params: cli.params,
        data: cli.data,
        responseType: "arraybuffer"
      });
      const buffer = Buffer.from(res.data);
      const contentType = String(res.headers["content-type"] || "application/octet-stream").toLowerCase();
      const [mainType, subType = ""] = contentType.split(";")[0].trim().split("/");
      let textContent = null;
      try {
        const rawStr = buffer.toString("utf-8");
        if (contentType.includes("json") || /^[\{\[]/.test(rawStr.trim())) {
          textContent = JSON.stringify(JSON.parse(rawStr), null, 2);
        } else if (mainType === "text" || /html|xml|javascript|csv/.test(subType)) {
          textContent = rawStr;
        }
      } catch {}
      let messagePayload;
      const mediaCaption = `– *H T T P  R E S U L T*\n\n` + `┌ ◦ *Method* : ${cli.method}\n` + `│ ◦ *Status* : ${res.status} ${res.statusText}\n` + `└ ◦ *Type* : ${contentType}\n\n` + `${footer}`;
      if (textContent) {
        if (textContent.length > 8e3) {
          messagePayload = {
            document: Buffer.from(textContent, "utf-8"),
            mimetype: contentType.includes("json") ? "application/json" : "text/plain",
            fileName: `response.${contentType.includes("json") ? "json" : "txt"}`,
            caption: `– *H T T P  R E S U L T*\n\n` + `┌ ◦ *Method* : ${cli.method}\n` + `│ ◦ *Status* : ${res.status} ${res.statusText}\n` + `│ ◦ *Size* : ${(textContent.length / 1024).toFixed(2)} KB\n` + `└ ◦ *Format* : File Document\n\n` + `${footer}`
          };
        } else {
          messagePayload = {
            text: `– *H T T P  R E S U L T*\n\n` + `┌ ◦ *Method* : ${cli.method}\n` + `│ ◦ *Status* : ${res.status} ${res.statusText}\n` + `└ ◦ *Type* : ${contentType}\n\n` + `\`\`\`\n${textContent}\n\`\`\`\n\n` + `${footer}`
          };
        }
      } else {
        const defaultFileName = res.headers["content-disposition"]?.match(/filename=["']?([^"';]+)["']?/i)?.[1] || path.basename(new URL(url).pathname) || "downloaded_file";
        const mediaMap = {
          "image/webp": {
            sticker: buffer
          },
          image: {
            image: buffer,
            caption: mediaCaption
          },
          video: {
            video: buffer,
            caption: mediaCaption
          },
          audio: {
            audio: buffer,
            mimetype: contentType
          }
        };
        messagePayload = mediaMap[`${mainType}/${subType}`] || mediaMap[mainType] || {
          document: buffer,
          mimetype: contentType,
          fileName: defaultFileName,
          caption: `– *H T T P  R E S U L T*\n\n` + `┌ ◦ *Method* : ${cli.method}\n` + `│ ◦ *Status* : ${res.status} ${res.statusText}\n` + `│ ◦ *Filename* : ${defaultFileName}\n` + `└ ◦ *Type* : ${contentType}\n\n` + `${footer}`
        };
      }
      await sock.sendMessage(ctx.id, messagePayload, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[CLI Axios Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${error?.message || error}\n` + `└ ◦ *Command* : ${ctx.command || "get"}\n\n` + `${footer}`);
    }
  }
};