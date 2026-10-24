import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import {
  fileURLToPath
} from "url";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(__dirname, "../../lib/qhtml-html");
const DEFAULT_TPL = "context-menu";
const EMOJI_CDN = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/";
const MAX_TEXT_LEN = 250;
const ITEMS_PER_PAGE = 7;

function initDB(jid, name) {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.qhtml) global.db.qhtml = {};
  if (jid && !global.db.user[jid]) {
    global.db.user[jid] = {
      name: name || "",
      money: 1e4,
      exp: 0
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) db.write(global.db);
}

function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function emojiToImgHtml(escapedText) {
  let regex;
  try {
    regex = new RegExp(String.raw`(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\p{Emoji_Modifier}|\uFE0F|\u20E3)?(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\p{Emoji_Modifier}|\uFE0F|\u20E3)?)*`, "gu");
  } catch {
    try {
      regex = /[\u{1F000}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/gu;
    } catch {
      regex = new RegExp("[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]", "g");
    }
  }
  return escapedText.replace(regex, emoji => {
    const cp = [...emoji].map(c => {
      const n = c.codePointAt(0);
      const h = n.toString(16);
      return n <= 65535 ? h.padStart(4, "0") : h;
    }).join("-");
    return `<img class="emoji inline" alt="${emoji}" src="${EMOJI_CDN}${cp}.png">`;
  });
}

function listTemplates() {
  try {
    return fs.readdirSync(TEMPLATE_DIR).filter(f => f.endsWith(".html")).map(f => f.replace(/\.html$/i, ""));
  } catch {
    return [];
  }
}

function loadTemplate(name) {
  const safe = String(name || "").replace(/[^a-z0-9_-]/gi, "");
  if (!safe) throw new Error("Nama template tidak valid");
  const file = path.join(TEMPLATE_DIR, `${safe}.html`);
  if (!fs.existsSync(file)) throw new Error(`Template "${safe}" tidak ditemukan.`);
  return fs.readFileSync(file, "utf-8");
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|(?!(--))[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["t", "template", "tmp", "tpl", "theme", "tema"].includes(key)) key = "template";
    if (["settheme", "settema", "st"].includes(key)) key = "settheme";
    if (["ls", "list", "listtpl", "daftartema"].includes(key)) key = "list";
    if (["q", "query", "cari", "search"].includes(key)) key = "search";
    if (["p", "page", "halaman", "hal"].includes(key)) key = "page";
    if (["h", "help", "bantuan"].includes(key)) key = "help";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
      else val = rawVal;
    }
    flags[key] = val;
  }
  let cleanPrompt = input.replace(flagRegex, "").trim();
  const pageMatch = cleanPrompt.match(/^(?:➡️|⬅️)?\s*(?:hal(?:aman)?|page)\s*(\d+)$/i);
  if (pageMatch) {
    flags.list = true;
    flags.page = Number(pageMatch[1]);
    cleanPrompt = "";
  }
  return {
    flags: flags,
    cleanText: cleanPrompt
  };
}

function extractText(cleanText, ctx) {
  if (cleanText) return cleanText;
  const q = ctx.quoted;
  if (!q) return "";
  const candidates = [q.text, q.body, q.caption, q.conversation, q.message?.conversation, q.message?.extendedTextMessage?.text, q.message?.imageMessage?.caption, q.message?.videoMessage?.caption];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}
async function renderHtmlToImage(htmlContent) {
  const rawApi = global.bot?.api?.wudysoft || "";
  const cleanApi = rawApi.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const baseUrl = `https://${cleanApi}/api/tools/html2img/`;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  };
  const payload = {
    html: htmlContent,
    fullPage: true,
    quality: 100
  };
  const versions = ["v5", "v1", "v2", "v3", "v4", "v6", "v7", "v8", "v9", "v10"];
  for (const ver of versions) {
    try {
      const res = await axios.post(`${baseUrl}${ver}`, payload, {
        headers: headers,
        timeout: 15e3
      });
      const imgUrl = res.data?.url || res.data?.result || (typeof res.data === "string" ? res.data : null);
      if (imgUrl && /^https?:\/\//i.test(imgUrl)) {
        let buffer = null;
        try {
          const imgRes = await axios.get(imgUrl, {
            responseType: "arraybuffer",
            timeout: 12e3
          });
          if (imgRes.data) buffer = Buffer.from(imgRes.data);
        } catch {}
        return {
          url: imgUrl,
          buffer: buffer
        };
      }
    } catch {
      continue;
    }
  }
  return {
    url: null,
    buffer: null
  };
}

function buildAutoValues(flags, cleanText, ctx) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const clock = `${hh}:${mm}`;
  const text = extractText(cleanText, ctx);
  const defaults = {
    carrier: "Telkomsel... LTE",
    clock: clock,
    time: clock,
    battery: "100%",
    date: now.toLocaleDateString("id-ID"),
    message: text,
    messageTime: clock,
    reaction1Aria: "Suka",
    reaction1Alt: "👍",
    reaction1Codepoint: "1f44d",
    reaction2Aria: "Cinta",
    reaction2Alt: "❤️",
    reaction2Codepoint: "2764-fe0f",
    reaction3Aria: "Tertawa",
    reaction3Alt: "😂",
    reaction3Codepoint: "1f602",
    reaction4Aria: "Kaget",
    reaction4Alt: "😮",
    reaction4Codepoint: "1f62e",
    reaction5Aria: "Sedih",
    reaction5Alt: "😢",
    reaction5Codepoint: "1f622",
    reaction6Aria: "Doa",
    reaction6Alt: "🙏",
    reaction6Codepoint: "1f64f",
    menuStar: "Beri Bintang",
    menuReply: "Balas",
    menuForward: "Teruskan",
    menuCopy: "Salin",
    menuSpeak: "Ucapkan",
    menuReport: "Laporkan",
    menuDelete: "Hapus"
  };
  const controlKeys = new Set(["template", "settheme", "list", "search", "page", "help"]);
  const lookup = {};
  for (const k of Object.keys(defaults)) lookup[k.toLowerCase()] = k;
  const merged = {
    ...defaults
  };
  for (const [k, v] of Object.entries(flags)) {
    if (controlKeys.has(k)) continue;
    if (typeof v !== "string" && typeof v !== "number") continue;
    const actual = lookup[k.toLowerCase()] || k;
    merged[actual] = v;
  }
  const result = {};
  for (const [k, v] of Object.entries(merged)) {
    if (typeof v === "string") {
      const escaped = escapeHtml(v);
      result[k] = k === "message" || k === "caption" ? emojiToImgHtml(escaped) : escaped;
    } else {
      result[k] = v;
    }
  }
  return result;
}

function applyPlaceholders(template, values) {
  const lookup = {};
  for (const [k, v] of Object.entries(values)) lookup[k.toLowerCase()] = v;
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => k.toLowerCase() in lookup ? lookup[k.toLowerCase()] : m);
}
export default {
  name: "qhtml",
  aliases: ["qweb", "htmlimg", "qimg", "qimage"],
  description: "Render template HTML dengan placeholder {{...}} menjadi gambar via html2img.",
  category: "Tools",
  example: ".qhtml Halo Dunia\n.qhtml --settheme neon\n.qhtml --list\n.qhtml --t fire --clock 20:15 Halo",
  execute: async (sock, ctx, msg) => {
    const tmpDir = os.tmpdir();
    const stamp = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const imgFile = path.join(tmpDir, `qhtml_${stamp}.png`);
    try {
      const chatId = ctx.id;
      const senderId = ctx.sender || ctx.author || msg?.key?.participant || msg?.key?.remoteJid || ctx.id;
      initDB(senderId, ctx.pushName);
      let rawText = (ctx.query || ctx.args?.join(" ") || "").trim();
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["qhtml", "qweb", "htmlimg", "qimg", "qimage"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      if (["--reset", "--clear", "reset", "clear"].includes(rawText)) {
        if (global.db.qhtml[chatId]) {
          delete global.db.qhtml[chatId];
          saveDB();
          return ctx.reply(`🧹 *Tema QHTML direset ke default (${DEFAULT_TPL})!*`);
        }
        return ctx.reply("ℹ️ Belum ada pengaturan tema kustom di obrolan ini.");
      }
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.settheme) {
        const chosen = String(flags.settheme).toLowerCase().trim();
        const available = listTemplates();
        if (!available.includes(chosen)) {
          return ctx.reply(`❌ Tema *"${chosen}"* tidak ditemukan!\n\n_Ketik \`${prefix}qhtml --list\` untuk daftar tema._`);
        }
        if (!global.db.qhtml[chatId]) global.db.qhtml[chatId] = {};
        global.db.qhtml[chatId].theme = chosen;
        global.db.qhtml[chatId].updatedAt = Date.now();
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *Q H T M L*\n\n` + `┌ ◦ *Tema Aktif* : ${chosen.toUpperCase()}\n` + `└ ◦ *File* : \`${chosen}.html\`\n\n` + `_Tema tersimpan! Ketik \`${prefix}qhtml <teks>\` untuk render._`);
      }
      if (flags.list || flags.page) {
        await ctx.react("⏳");
        const all = listTemplates();
        if (!all.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Tidak ada template .html di folder template.");
        }
        let searchQuery = flags.search || "";
        if (!searchQuery && !flags.page && cleanText && !/^(?:hal|page|\d+)$/i.test(cleanText)) {
          searchQuery = cleanText;
        }
        let matched = all;
        if (searchQuery && searchQuery !== "true") {
          const kw = searchQuery.toLowerCase();
          matched = all.filter(t => t.toLowerCase().includes(kw));
        }
        if (!matched.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tema tidak ditemukan: "${searchQuery}"`);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matched.length / ITEMS_PER_PAGE) || 1;
        const pageItems = matched.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
        const rows = pageItems.map((tpl, idx) => {
          const gi = (page - 1) * ITEMS_PER_PAGE + idx + 1;
          return {
            title: `${gi}. ${tpl.toUpperCase()}`,
            id: `${prefix}qhtml --settheme "${tpl}"`,
            description: `Jadikan tema default: ${tpl}`
          };
        });
        let baseCmd = `${prefix}qhtml`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH TEMA QHTML (${pageItems.length})`,
            sections: [{
              title: `TEMA TERSEDIA (Hal ${page}/${totalPages})`,
              rows: rows
            }]
          })
        }];
        if (page > 1) buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${baseCmd} --page ${page - 1}`
          })
        });
        if (page < totalPages) buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${baseCmd} --page ${page + 1}`
          })
        });
        const activeTheme = global.db.qhtml[chatId]?.theme || DEFAULT_TPL;
        const bodyText = `– *Q H T M L  -  T E M A*\n\n` + `┌ ◦ *Tema Aktif* : ${activeTheme.toUpperCase()}\n` + `├ ◦ *Total* : ${matched.length}\n` + `└ ◦ *Halaman* : ${page} / ${totalPages}\n\n` + `_Pilih tema dari tombol di bawah:_`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `QHTML • Themes`,
              button_title: `Buka Hal ${page}`
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, "", buttons, options);
        } else {
          let fallback = `${bodyText}\n\n` + rows.map(r => `• *${r.title}*\n  Set: \`${r.id}\``).join("\n\n");
          if (totalPages > 1) fallback += `\n\n_Pindah: \`${baseCmd} --page ${page < totalPages ? page + 1 : page - 1}\`_`;
          await ctx.reply(fallback);
        }
        await ctx.react("✅");
        return;
      }
      const text = extractText(cleanText, ctx);
      if (!text && !flags.help || flags.help) {
        const sessionTheme = global.db.qhtml[chatId]?.theme;
        const activeDisplay = sessionTheme ? `${sessionTheme.toUpperCase()} (Kustom)` : `${DEFAULT_TPL.toUpperCase()} (Default)`;
        const guideText = `– *Q H T M L*\n\n` + `Render template HTML dengan placeholder \`{{...}}\` menjadi gambar.\n\n` + `┌ ◦ *Tema Aktif* : ${activeDisplay}\n` + `├ ◦ *Render teks* : \`${prefix}qhtml Halo Dunia\`\n` + `├ ◦ *Dari reply* : \`${prefix}qhtml\`\n` + `├ ◦ *Pilih tema* : \`${prefix}qhtml --list\`\n` + `├ ◦ *Set default* : \`${prefix}qhtml --settheme <tema>\`\n` + `├ ◦ *Sekali pakai* : \`${prefix}qhtml --t <tema> teks\`\n` + `└ ◦ *Custom placeholder* : \`${prefix}qhtml --clock 20:15 --battery 72% teks\`\n\n` + `*Placeholder otomatis:*\n` + `\`{{message}}\` \`{{clock}}\` \`{{time}}\` \`{{date}}\` \`{{battery}}\` \`{{carrier}}\` \`{{messageTime}}\`\n` + `\`{{reaction1Codepoint}}\` .. \`{{reaction6Codepoint}}\` (+Aria/Alt)\n` + `\`{{menuStar}}\` \`{{menuReply}}\` \`{{menuForward}}\` \`{{menuCopy}}\` \`{{menuSpeak}}\` \`{{menuReport}}\` \`{{menuDelete}}\`\n\n` + `*Custom:* \`--<namatag> value\` → otomatis isi \`{{namatag}}\` di template.\n\n` + `_Output: gambar (bukan stiker)._`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      if (text.length > MAX_TEXT_LEN) {
        return ctx.reply(`❌ Teks terlalu panjang (max ${MAX_TEXT_LEN} karakter, saat ini ${text.length}).`);
      }
      await ctx.react("⏳");
      const sessionTheme = global.db.qhtml[chatId]?.theme;
      const tplName = (typeof flags.template === "string" ? flags.template : sessionTheme || DEFAULT_TPL).toLowerCase().trim();
      const template = loadTemplate(tplName);
      const values = buildAutoValues(flags, cleanText, ctx);
      const html = applyPlaceholders(template, values);
      const {
        url: imgUrl,
        buffer: imgBuffer
      } = await renderHtmlToImage(html);
      if (!imgBuffer && !imgUrl) {
        throw new Error("Semua endpoint html2img gagal merender. Coba lagi nanti.");
      }
      let finalBuffer = imgBuffer;
      if (!finalBuffer && imgUrl) {
        try {
          const r = await axios.get(imgUrl, {
            responseType: "arraybuffer",
            timeout: 2e4
          });
          if (r.data) finalBuffer = Buffer.from(r.data);
        } catch {}
      }
      if (!finalBuffer || finalBuffer.length < 500) {
        throw new Error("Hasil render kosong atau data rusak.");
      }
      fs.writeFileSync(imgFile, finalBuffer);
      await sock.sendMessage(ctx.id, {
        image: finalBuffer,
        mimetype: "image/png",
        caption: `🖼️ *${tplName.toUpperCase()}*`
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✨");
    } catch (error) {
      console.error("[qhtml Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal render: ${error?.message || error}`);
    } finally {
      try {
        if (fs.existsSync(imgFile)) fs.unlinkSync(imgFile);
      } catch {}
    }
  }
};