import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const BASE_API = `${global.bot?.api?.wudysoft}/api/maker/carbon`;
const THEMES = {
  v1: ["seti", "dracula", "monokai", "solarized", "nord", "panda"],
  v3: ["tokyoNight", "dracula", "cyberpunk", "monokai", "synthwave", "rosePine", "githubDark", "nord", "outrun", "catppuccin", "gruvbox", "oneDark", "neon", "ember"],
  v6: ["dracula-pro", "seti", "night-owl", "nord", "synthwave-84", "monokai", "oceanic-next", "panda-syntax", "solarized"],
  v7: ["vercel", "supabase", "tailwind", "openai", "mintlify", "prisma", "clerk", "nuxt", "cloudflare", "gemini", "stripe", "midnight", "noir", "sunset", "forest"]
};

function parseCarbonFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["v", "ver", "version", "engine"].includes(key)) key = "version";
    if (["theme", "t", "style"].includes(key)) key = "theme";
    if (["lang", "language", "l"].includes(key)) key = "lang";
    if (["font", "f"].includes(key)) key = "font";
    if (["title", "name"].includes(key)) key = "title";
    if (["padding", "pad", "p"].includes(key)) key = "padding";
    if (["ln", "linenumbers", "line"].includes(key)) key = "lineNumbers";
    if (["list", "themes", "menu"].includes(key)) key = "list";
    if (["help", "h"].includes(key)) key = "help";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else if (!isNaN(rawVal) && rawVal.trim() !== "" && ["padding"].includes(key)) val = Number(rawVal);
      else val = rawVal;
    }
    flags[key] = val;
  }
  const cleanCode = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanCode: cleanCode
  };
}
export default {
  name: "carbon",
  aliases: ["carboncode", "rayso", "carbonara", "snippet", "code2img", "carbonv1", "carbonv3", "carbonv6", "carbonv7"],
  description: "Ubah kode pemrograman menjadi gambar screenshot estetik (Support v1, v3, v6, & v7 Ray.so)",
  category: "Maker",
  limit: true,
  example: "carbon console.log('Hello World') atau reply teks/file kode dengan .carbon --theme dracula",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const footer = global.footer || `_${botName}_`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const cmd = (ctx.command || ctx.cmd || "").toLowerCase();
      let rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      const {
        flags,
        cleanCode
      } = parseCarbonFlags(rawQuery);
      if (flags.list || ["themes", "list", "theme"].includes(cleanCode.toLowerCase())) {
        await ctx.react("⏳");
        const sections = [{
          title: "V3: SNIPPET STUDIO (GLASSMORPHISM)",
          rows: THEMES.v3.slice(0, 10).map(t => ({
            title: `Theme: ${t}`,
            description: `Engine v3 • Style ${t}`,
            id: `${prefix}carbon --v 3 --theme ${t}`
          }))
        }, {
          title: "V7: RAY.SO (MINIMALIST GRADIENT)",
          rows: THEMES.v7.slice(0, 10).map(t => ({
            title: `Theme: ${t}`,
            description: `Engine v7 • Style ${t}`,
            id: `${prefix}carbon --v 7 --theme ${t}`
          }))
        }, {
          title: "V1 & V6: CLASSIC CARBON",
          rows: [{
            title: "Carbonara (v1) - Seti",
            description: "Engine v1 Default",
            id: `${prefix}carbon --v 1 --theme seti`
          }, {
            title: "Carbon.now (v6) - Dracula",
            description: "Engine v6 Default",
            id: `${prefix}carbon --v 6 --theme dracula-pro`
          }]
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "PILIH TEMA",
            sections: sections
          })
        }];
        const bodyText = `– *C A R B O N  -  T H E M E S*\n\n` + `Pilih variasi engine & tema di bawah untuk mengubah kode sumber menjadi tangkapan layar estetik.\n\n` + `┌ ◦ *Engine v3* : SnippetStudio (Glassmorphism & Window)\n` + `│ ◦ *Engine v7* : Ray.so (Clean Gradient Vibe)\n` + `│ ◦ *Engine v6* : Carbon.now.sh Official Style\n` + `└ ◦ *Engine v1* : Carbonara Classic (Light/Dark)\n\n` + `${footer}`;
        const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
        const options = {
          image: bannerMedia,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Carbon Themes`,
              button_title: "Buka Daftar Tema"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footer, buttons, options);
        } else {
          await ctx.reply(bodyText);
        }
        await ctx.react("✅");
        return;
      }
      let inputCode = cleanCode;
      if (!inputCode && ctx.quoted?.isMedia) {
        const buffer = await ctx.quoted.download().catch(() => null);
        if (buffer && Buffer.isBuffer(buffer)) {
          inputCode = buffer.toString("utf-8");
        }
      }
      if (!inputCode && ctx.quoted?.text) {
        inputCode = ctx.quoted.text.trim();
      }
      if (!inputCode || flags.help) {
        const helpText = `– *C A R B O N*\n\n` + `┌ ◦ *Usage* : ${prefix}carbon <code / query>\n` + `│ ◦ *Quoted* : Reply pesan atau dokumen kode dengan ${prefix}carbon\n` + `└ ◦ *List Theme* : ${prefix}carbon --list\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Default (v3)* : ${prefix}carbon --theme tokyoNight <code...>\n` + `│ ◦ *Ray.so (v7)* : ${prefix}carbon --v 7 --theme supabase <code...>\n` + `│ ◦ *Carbon.now (v6)* : ${prefix}carbon --v 6 --theme nord <code...>\n` + `└ ◦ *Carbonara (v1)* : ${prefix}carbon --v 1 --theme monokai <code...>\n\n` + `– *O P T I O N S*\n\n` + `┌ ◦ *--title* : Judul header window\n` + `│ ◦ *--lang* : Bahasa pemrograman (e.g. javascript, python)\n` + `│ ◦ *--line* : true / false (Nomor baris)\n` + `└ ◦ *--list* : Tampilkan menu opsi tema interaktif\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      let version = "v3";
      if (cmd.includes("v1")) version = "v1";
      else if (cmd.includes("v6")) version = "v6";
      else if (cmd.includes("v7") || cmd.includes("rayso")) version = "v7";
      else if (flags.version) {
        const vStr = String(flags.version).toLowerCase().replace("v", "");
        if (["1", "3", "6", "7"].includes(vStr)) version = `v${vStr}`;
      }
      let payload = {};
      const endpointUrl = `${BASE_API}/${version}`;
      if (version === "v1") {
        payload = {
          code: inputCode,
          lang: flags.lang || "auto",
          theme: flags.theme || "seti",
          lineNumbers: flags.lineNumbers !== undefined ? flags.lineNumbers : true,
          ...flags
        };
      } else if (version === "v6") {
        payload = {
          code: inputCode,
          theme: flags.theme || "dracula-pro",
          font: flags.font || "Fira Code",
          ...flags
        };
      } else if (version === "v7") {
        payload = {
          code: inputCode,
          theme: flags.theme || "nuxt",
          language: flags.lang || "javascript",
          padding: flags.padding || 64,
          ...flags
        };
      } else {
        payload = {
          code: inputCode,
          theme: flags.theme || "tokyoNight",
          title: flags.title || "index.js",
          language: flags.lang || "javascript",
          showLineNumbers: flags.lineNumbers !== undefined ? flags.lineNumbers : true,
          type: "v5",
          ...flags
        };
      }
      const response = await axios.post(endpointUrl, payload, {
        responseType: "arraybuffer",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const imageBuffer = Buffer.from(response.data);
      if (!imageBuffer || imageBuffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memproses\n` + `└ ◦ *Detail* : Server tidak mengembalikan buffer gambar valid.\n\n` + `${footer}`);
      }
      const lineCount = inputCode.split("\n").length;
      const charCount = inputCode.length;
      const caption = `– *C A R B O N*\n\n` + `┌ ◦ *Engine* : Carbon ${version.toUpperCase()}\n` + `│ ◦ *Theme* : ${payload.theme || "Default"}\n` + `│ ◦ *Language* : ${payload.language || payload.lang || "Auto"}\n` + `│ ◦ *Lines* : ${lineCount} Baris\n` + `└ ◦ *Length* : ${charCount} Karakter\n\n` + `${footer}`;
      const buttons = [{
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "Salin Kode",
          id: "copy_carbon_code",
          copy_code: inputCode
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Pilih Tema",
          id: `${prefix}carbon --list`
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(caption, `${botName} • Code Studio`, buttons, {
          image: imageBuffer,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: imageBuffer,
          caption: caption
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Carbon Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errorMessage}\n` + `└ ◦ *Command* : ${ctx.command || "carbon"}\n\n` + `${global.footer || `_${global.bot?.name || "WudysoftBot"}_`}`);
    }
  }
};