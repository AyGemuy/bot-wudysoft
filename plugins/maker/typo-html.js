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
const TEMPLATE_DIR = path.resolve(__dirname, "../../lib/typo-html");
const DEFAULT_TPL = "summer-dream";
const ITEMS_PER_PAGE = 7;
const DEFAULTS = {
  IMAGE: `<img src="https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1000&auto=format&fit=crop" alt="Artwork"/>`,
  TOP: "Sum",
  VERTICAL: "MER",
  KANJI_TOP: "夏",
  KANJI_MID: "夢",
  ACCENT: "cailin",
  BOTTOM: "dreams",
  SIDE_TEXT: "夏は一年で一番暑い季節です。",
  FOOTER: "夏は一年で一番暑い季節です。太陽が明るく輝き、空は青く澄んでいます。セミの声が木々に響きわたります。"
};

function initDB(jid, name) {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.typo) global.db.typo = {};
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

function listTemplates() {
  try {
    if (!fs.existsSync(TEMPLATE_DIR)) fs.mkdirSync(TEMPLATE_DIR, {
      recursive: true
    });
    return fs.readdirSync(TEMPLATE_DIR).filter(f => f.endsWith(".html")).map(f => f.replace(/\.html$/i, ""));
  } catch {
    return [];
  }
}

function loadTemplate(name = DEFAULT_TPL) {
  const safe = String(name || "").replace(/[^a-z0-9_-]/gi, "");
  let file = path.join(TEMPLATE_DIR, `${safe}.html`);
  if (!fs.existsSync(file)) file = path.join(TEMPLATE_DIR, `${DEFAULT_TPL}.html`);
  if (!fs.existsSync(file)) throw new Error(`Template "${safe}" tidak ditemukan di lib/typo-html/`);
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
    if (["p", "page", "halaman", "hal"].includes(key)) key = "page";
    if (["q", "query", "cari", "search"].includes(key)) key = "search";
    if (["h", "help", "bantuan"].includes(key)) key = "help";
    if (["top", "atas", "script"].includes(key)) key = "top";
    if (["bottom", "bawah", "title", "judul"].includes(key)) key = "bottom";
    if (["footer", "desc", "deskripsi", "sub"].includes(key)) key = "footer";
    if (["v", "vertical", "vertikal"].includes(key)) key = "vertical";
    if (["accent", "tag", "nama"].includes(key)) key = "accent";
    if (["side", "samping"].includes(key)) key = "side";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      val = rawVal;
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
async function extractMediaBuffers(ctx) {
  const buffers = [];
  try {
    let downloaded = null;
    if (ctx.quoted && typeof ctx.quoted.download === "function") {
      downloaded = await ctx.quoted.download();
    } else if (typeof ctx.download === "function") {
      downloaded = await ctx.download();
    }
    if (downloaded) {
      if (Array.isArray(downloaded)) {
        for (const b of downloaded) {
          if (Buffer.isBuffer(b) && b.length > 0) buffers.push(b);
        }
      } else if (Buffer.isBuffer(downloaded) && downloaded.length > 0) {
        buffers.push(downloaded);
      }
    }
  } catch (err) {
    console.error("[extractMediaBuffers Error]:", err.message || err);
  }
  return buffers;
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
export default {
  name: "typography",
  aliases: ["typo", "typohtml", "canvas"],
  description: "Generate tipografi artistik dari lib/typo-html dengan fitur Set Tema, List Tema, dan Auto Generate Multi-Image.",
  category: "Tools",
  example: ".typo --settheme summer-dream\n.typo --list\n.typo --top Tokyo --bottom Vibe (Reply Gambar)",
  execute: async (sock, ctx, msg) => {
    const tmpDir = os.tmpdir();
    const stamp = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const imgFile = path.join(tmpDir, `typo_${stamp}.png`);
    try {
      const chatId = ctx.id;
      const senderId = ctx.sender || ctx.author || msg?.key?.participant || msg?.key?.remoteJid || ctx.id;
      initDB(senderId, ctx.pushName);
      let rawText = (ctx.query || ctx.args?.join(" ") || "").trim();
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["typography", "typo", "typohtml", "canvas"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      if (["--reset", "--clear", "reset", "clear"].includes(rawText)) {
        if (global.db.typo[chatId]) {
          delete global.db.typo[chatId];
          saveDB();
          return ctx.reply(`🧹 *Tema Tipografi direset ke bawaan (${DEFAULT_TPL})!*`);
        }
        return ctx.reply("ℹ️ Belum ada tema kustom yang tersimpan di chat ini.");
      }
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.settheme) {
        const chosen = String(flags.settheme).toLowerCase().trim();
        const available = listTemplates();
        if (!available.includes(chosen)) {
          return ctx.reply(`❌ Tema *"${chosen}"* tidak ditemukan di \`lib/typo-html/\`!\n\n_Ketik \`${prefix}typo --list\` untuk melihat daftar tema._`);
        }
        if (!global.db.typo[chatId]) global.db.typo[chatId] = {};
        global.db.typo[chatId].theme = chosen;
        global.db.typo[chatId].updatedAt = Date.now();
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *T Y P O G R A P H Y*\n\n┌ ◦ *Tema Aktif* : ${chosen.toUpperCase()}\n└ ◦ *File* : \`${chosen}.html\`\n\n_Tema berhasil disimpan! Ketik \`${prefix}typo\` untuk mulai render._`);
      }
      if (flags.list || flags.page) {
        await ctx.react("⏳");
        const all = listTemplates();
        if (!all.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Tidak ada file template .html di dalam folder `lib/typo-html/`.");
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
          return ctx.reply(`❌ Tema dengan kata kunci "${searchQuery}" tidak ditemukan.`);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matched.length / ITEMS_PER_PAGE) || 1;
        const pageItems = matched.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
        const rows = pageItems.map((tpl, idx) => {
          const gi = (page - 1) * ITEMS_PER_PAGE + idx + 1;
          return {
            title: `${gi}. ${tpl.toUpperCase()}`,
            id: `${prefix}typo --settheme "${tpl}"`,
            description: `Gunakan tema: ${tpl}`
          };
        });
        let baseCmd = `${prefix}typo`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH TEMA TYPOGRAPHY (${pageItems.length})`,
            sections: [{
              title: `TEMA TERSEDIA (Hal ${page}/${totalPages})`,
              rows: rows
            }]
          })
        }];
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${baseCmd} --page ${page - 1}`
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${baseCmd} --page ${page + 1}`
            })
          });
        }
        const activeTheme = global.db.typo[chatId]?.theme || DEFAULT_TPL;
        const bodyText = `– *T Y P O G R A P H Y  -  T E M A*\n\n┌ ◦ *Tema Saat Ini* : ${activeTheme.toUpperCase()}\n├ ◦ *Total Koleksi* : ${matched.length}\n└ ◦ *Halaman* : ${page} / ${totalPages}\n\n_Pilih template dari opsi di bawah:_`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `Typography • Themes`,
              button_title: `Daftar Tema (Hal ${page})`
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, "", buttons, options);
        } else {
          let fallback = `${bodyText}\n\n` + rows.map(r => `• *${r.title}*\n  Set: \`${r.id}\``).join("\n\n");
          if (totalPages > 1) fallback += `\n\n_Halaman lain: \`${baseCmd} --page ${page < totalPages ? page + 1 : page - 1}\`_`;
          await ctx.reply(fallback);
        }
        await ctx.react("✅");
        return;
      }
      await ctx.react("⏳");
      const sessionTheme = global.db.typo[chatId]?.theme;
      const tplName = (typeof flags.template === "string" ? flags.template : sessionTheme || DEFAULT_TPL).toLowerCase().trim();
      const mediaList = await extractMediaBuffers(ctx);
      let imageHtml = "";
      if (mediaList.length > 0) {
        imageHtml = mediaList.map(buf => `<img src="data:image/jpeg;base64,${buf.toString("base64")}" alt="Artwork"/>`).join("\n");
      } else if (flags.image && typeof flags.image === "string") {
        imageHtml = `<img src="${flags.image}" alt="Artwork"/>`;
      } else {
        imageHtml = DEFAULTS.IMAGE;
      }
      const bottomTitle = flags.bottom || cleanText || DEFAULTS.BOTTOM;
      const verticalText = flags.vertical || DEFAULTS.VERTICAL;
      const verticalHtml = String(verticalText).split("").map(c => `<span>${escapeHtml(c)}</span>`).join("");
      const placeholders = {
        IMAGE: imageHtml,
        TOP: escapeHtml(flags.top || DEFAULTS.TOP),
        BOTTOM: escapeHtml(bottomTitle),
        FOOTER: escapeHtml(flags.footer || DEFAULTS.FOOTER),
        VERTICAL: verticalHtml,
        ACCENT: escapeHtml(flags.accent || DEFAULTS.ACCENT),
        KANJI_TOP: escapeHtml(flags.kanjitop || DEFAULTS.KANJI_TOP),
        KANJI_MID: escapeHtml(flags.kanjimid || DEFAULTS.KANJI_MID),
        SIDE_TEXT: escapeHtml(flags.side || DEFAULTS.SIDE_TEXT)
      };
      let template = loadTemplate(tplName);
      template = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const upper = key.toUpperCase();
        return upper in placeholders ? placeholders[upper] : match;
      });
      const {
        url: imgUrl,
        buffer: imgBuffer
      } = await renderHtmlToImage(template);
      let finalBuffer = imgBuffer;
      if (!finalBuffer && imgUrl) {
        const r = await axios.get(imgUrl, {
          responseType: "arraybuffer",
          timeout: 2e4
        });
        if (r.data) finalBuffer = Buffer.from(r.data);
      }
      if (!finalBuffer || finalBuffer.length < 500) {
        throw new Error("Gagal merender gambar atau API html2img bermasalah.");
      }
      fs.writeFileSync(imgFile, finalBuffer);
      await sock.sendMessage(ctx.id, {
        image: finalBuffer,
        mimetype: "image/png",
        caption: `🖼️ *${tplName.toUpperCase()}*\n• Title: *${bottomTitle}*`
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✨");
    } catch (err) {
      console.error("[typography Error]:", err);
      await ctx.react("❌");
      ctx.reply(`❌ *Error*: ${err.message || err}`);
    } finally {
      try {
        if (fs.existsSync(imgFile)) fs.unlinkSync(imgFile);
      } catch {}
    }
  }
};