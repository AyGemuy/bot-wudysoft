import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
let openapiCache = null;
let lastCacheTime = 0;
async function getOpenApiSpec() {
  const CACHE_DURATION = 1e3 * 60 * 30;
  if (openapiCache && Date.now() - lastCacheTime < CACHE_DURATION) {
    return openapiCache;
  }
  try {
    const {
      data
    } = await axios.get(`${global.bot?.api?.wudysoft}/api/openapi`);
    openapiCache = data;
    lastCacheTime = Date.now();
    return openapiCache;
  } catch {
    return null;
  }
}

function parsePayload(str) {
  if (!str) return null;
  str = str.trim();
  if (str.startsWith("{") && str.endsWith("}")) {
    try {
      return JSON.parse(str);
    } catch {
      try {
        return Function(`"use strict"; return (${str})`)();
      } catch {}
    }
  }
  if (str.includes("=")) {
    const params = {};
    const regex = /([a-zA-Z0-9_\-]+)=(?:"([^"]*)"|'([^']*)'|([^\s&]+))/g;
    let match;
    let found = false;
    while ((match = regex.exec(str)) !== null) {
      found = true;
      const key = match[1];
      let val = match[2] ?? match[3] ?? match[4] ?? "";
      val = val.replace(/\+/g, " ");
      try {
        val = decodeURIComponent(val);
      } catch {}
      params[key] = val;
    }
    if (found) return params;
  }
  return str;
}
export default {
  name: "api",
  aliases: ["runapi", "wudysoft", "wudyapi"],
  description: "Menjalankan API Wudysoft dengan Auto Select Format Sesuai Respon Asli",
  category: "Developer",
  execute: async (sock, ctx, msg) => {
    try {
      const input = (ctx.args?.join(" ") || ctx.text || "").trim();
      if (!input) {
        return ctx.reply(`*Penggunaan:* .api <endpoint> <body/param> <head>\n\n` + `*Contoh Variasi Format:*\n` + `• .api ai/music/soniva action=generate prompt=sad+lofi+song mood=sad\n` + `• .api api/ai/chat prompt=hy&model=gpt\n` + `• .api ai/chat/v1 { prompt: 'halo' }\n` + `• .api download/tiktok url=https://...\n` + `• .api random/waifu`);
      }
      await ctx.react("⏳");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const firstSpaceIdx = input.search(/\s/);
      let endpoint = "";
      let rest = "";
      if (firstSpaceIdx === -1) {
        endpoint = input;
      } else {
        endpoint = input.slice(0, firstSpaceIdx).trim();
        rest = input.slice(firstSpaceIdx).trim();
      }
      endpoint = endpoint.replace(/^\/+|\/+$/g, "");
      if (endpoint.toLowerCase().startsWith("api/")) {
        endpoint = endpoint.slice(4);
      }
      let rawPayload = rest;
      let rawHeaders = "";
      const headerMatch = rest.match(/({[\s\S]*?})\s*$/);
      if (headerMatch && rest !== headerMatch[1]) {
        rawHeaders = headerMatch[1];
        rawPayload = rest.slice(0, rest.lastIndexOf(rawHeaders)).trim();
      }
      const openapi = await getOpenApiSpec();
      let method = "GET";
      if (openapi && openapi.paths) {
        const paths = Object.keys(openapi.paths);
        const matchedPath = paths.find(p => {
          const cleanPath = p.replace(/^\/+/, "").replace(/^api\//, "").toLowerCase();
          return cleanPath === endpoint.toLowerCase();
        });
        if (!matchedPath) {
          await ctx.react("❌");
          const suggestions = paths.filter(p => p.toLowerCase().includes(endpoint.toLowerCase())).slice(0, 5).map(p => `• \`${p.replace(/^\/+/, "").replace(/^api\//, "")}\``).join("\n");
          return ctx.reply(`❌ Endpoint \`${endpoint}\` tidak ditemukan di OpenAPI!\n\n` + (suggestions ? `*Saran endpoint terkait:*\n${suggestions}` : `Cek dokumentasi: ${global.bot?.api?.wudysoft}/api/openapi`));
        }
        const methods = Object.keys(openapi.paths[matchedPath]);
        method = methods.includes("post") && rawPayload ? "POST" : methods[0].toUpperCase();
      }
      const payload = parsePayload(rawPayload);
      const headers = parsePayload(rawHeaders) || {};
      const reqConfig = {
        method: method,
        url: `${global.bot?.api?.wudysoft}/api/${endpoint}`,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          ...typeof headers === "object" ? headers : {}
        },
        responseType: "arraybuffer",
        validateStatus: () => true
      };
      if (method === "GET") {
        if (payload && typeof payload === "object") {
          reqConfig.params = payload;
        }
      } else {
        reqConfig.data = payload;
      }
      const res = await axios(reqConfig);
      const contentType = res.headers["content-type"] || "";
      const bufferData = Buffer.from(res.data);
      if (contentType.includes("image")) {
        await sock.sendMessage(ctx.id, {
          image: bufferData
        }, {
          quoted: quotedMsg
        });
        return await ctx.react("✅");
      }
      if (contentType.includes("video")) {
        await sock.sendMessage(ctx.id, {
          video: bufferData,
          mimetype: contentType
        }, {
          quoted: quotedMsg
        });
        return await ctx.react("✅");
      }
      if (contentType.includes("audio")) {
        await sock.sendMessage(ctx.id, {
          audio: bufferData,
          mimetype: contentType,
          ptt: false
        }, {
          quoted: quotedMsg
        });
        return await ctx.react("✅");
      }
      if (contentType.includes("application/pdf") || contentType.includes("zip") || contentType.includes("octet-stream")) {
        await sock.sendMessage(ctx.id, {
          document: bufferData,
          mimetype: contentType,
          fileName: `${endpoint.replace(/[\/\\?%*:|"<>]/g, "_")}.bin`
        }, {
          quoted: quotedMsg
        });
        return await ctx.react("✅");
      }
      const textResponse = bufferData.toString("utf-8");
      if (textResponse.length > 3e4) {
        await sock.sendMessage(ctx.id, {
          document: bufferData,
          mimetype: contentType.includes("json") ? "application/json" : "text/plain",
          fileName: `${endpoint.replace(/[\/\\?%*:|"<>]/g, "_")}.${contentType.includes("json") ? "json" : "txt"}`
        }, {
          quoted: quotedMsg
        });
        return await ctx.react("✅");
      }
      try {
        const jsonResponse = JSON.parse(textResponse);
        const beautifiedJson = JSON.stringify(jsonResponse, null, 2);
        await sock.sendMessage(ctx.id, {
          text: `\`\`\`${beautifiedJson}\`\`\``
        }, {
          quoted: quotedMsg
        });
      } catch {
        await sock.sendMessage(ctx.id, {
          text: textResponse
        }, {
          quoted: quotedMsg
        });
      }
      return await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      ctx.reply(`❌ Gagal mengeksekusi API: ${error.message}`);
    }
  }
};