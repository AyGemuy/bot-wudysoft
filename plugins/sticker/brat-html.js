import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import {
  spawn
} from "child_process";
import {
  fileURLToPath
} from "url";
import db from "../../data/db.js";
import {
  writeExifVid
} from "../../lib/exif.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(__dirname, "../../lib/brat-html");
const API_URL = "https://wudysoft.nekohost.id/api/tools/html2vid";
const DEFAULT_TPL = "fire";
const OUT_SIZE = 512;
const TEXT_PLACEHOLDER = "{{TEXT}}";
const MAX_TEXT_LEN = 80;
const ITEMS_PER_PAGE = 7;
const EMOJI_CDN = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/";

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.bratHtml) global.db.bratHtml = {};
  if (jid && !global.db.user[jid]) {
    global.db.user[jid] = {
      name: name || "",
      money: 1e4,
      exp: 0
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...opts
    });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", d => stdout += d);
    p.stderr.on("data", d => stderr += d);
    p.on("error", err => reject(new Error(`Gagal menjalankan ${cmd}: ${err.message}`)));
    p.on("close", code => {
      if (code === 0) resolve({
        stdout: stdout,
        stderr: stderr
      });
      else reject(new Error(`${cmd} exit ${code}\n${stderr.slice(-800)}`));
    });
  });
}
async function probeSize(file) {
  const {
    stdout
  } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", file]);
  const s = JSON.parse(stdout).streams?.[0];
  if (!s) throw new Error("Tidak ada video stream di file hasil render");
  return {
    width: s.width,
    height: s.height
  };
}
async function cropTo512(input, output) {
  const {
    width,
    height
  } = await probeSize(input);
  let vf;
  if (width >= OUT_SIZE && height >= OUT_SIZE) {
    vf = `crop=${OUT_SIZE}:${OUT_SIZE}`;
  } else {
    vf = `scale=${OUT_SIZE}:${OUT_SIZE}:force_original_aspect_ratio=increase,crop=${OUT_SIZE}:${OUT_SIZE}`;
  }
  await run("ffmpeg", ["-y", "-i", input, "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", output]);
  const out = await probeSize(output);
  if (out.width !== OUT_SIZE || out.height !== OUT_SIZE) {
    throw new Error(`Output bukan ${OUT_SIZE}x${OUT_SIZE}: ${out.width}x${out.height}`);
  }
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
    return `<img class="emoji inline" alt="${emoji}" style="height: 1.1em; width: 1.1em; vertical-align: -0.2em; display: inline-block; object-fit: contain;" src="${EMOJI_CDN}${cp}.png">`;
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
  if (!fs.existsSync(file)) {
    throw new Error(`Template "${safe}" tidak ditemukan.`);
  }
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
    if (["d", "duration", "dur", "length"].includes(key)) key = "duration";
    if (["v", "video", "vid", "gif"].includes(key)) key = "video";
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
async function renderHtml(html) {
  const res = await axios.post(API_URL, {
    html: html
  }, {
    headers: {
      "Content-Type": "application/json"
    },
    responseType: "arraybuffer",
    timeout: 18e4,
    maxContentLength: 100 * 1024 * 1024,
    maxBodyLength: 100 * 1024 * 1024
  });
  return Buffer.from(res.data);
}

function extractText(cleanText, ctx) {
  if (cleanText) return cleanText;
  const q = ctx.quoted;
  if (!q) return "";
  const candidates = [q.text, q.body, q.caption, q.conversation, q.message?.conversation, q.message?.extendedTextMessage?.text, q.message?.imageMessage?.caption, q.message?.videoMessage?.caption];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return c.trim();
    }
  }
  return "";
}

function unlinkSafe(p) {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}
export default {
  name: "brathtml",
  aliases: ["bhtml", "bratweb", "htmlstiker", "htmstiker"],
  description: "Render template HTML animasi brat menjadi stiker/video dengan tema tersimpan di DB.",
  category: "Tools",
  example: ".brathtml Hello World 🍎\n.brathtml --settheme fire\n.brathtml --list\n.brathtml --t neon Halo Dunia 🔥",
  execute: async (sock, ctx, msg) => {
    const tmpDir = os.tmpdir();
    const stamp = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const rawFile = path.join(tmpDir, `brat_raw_${stamp}.mp4`);
    const cropFile = path.join(tmpDir, `brat_crop_${stamp}.mp4`);
    try {
      const chatId = ctx.id;
      const senderId = ctx.sender || ctx.author || msg?.key?.participant || msg?.key?.remoteJid || ctx.id;
      initDB(senderId, ctx.pushName);
      let rawText = (ctx.query || ctx.args?.join(" ") || "").trim();
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["brathtml", "bhtml", "bratweb", "htmlstiker", "htmstiker"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.bratHtml[chatId]) {
          delete global.db.bratHtml[chatId];
          saveDB();
          return ctx.reply("🧹 *Tema Brat HTML berhasil direset ke bawaan (fire)!*");
        }
        return ctx.reply("ℹ️ Belum ada pengaturan tema kustom pada obrolan ini.");
      }
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.settheme) {
        const chosenTheme = String(flags.settheme).toLowerCase().trim();
        const availableTemplates = listTemplates();
        if (!availableTemplates.includes(chosenTheme)) {
          return ctx.reply(`❌ Tema *"${chosenTheme}"* tidak ditemukan!\n\n_Ketik \`${prefix}brathtml --list\` untuk melihat daftar tema._`);
        }
        if (!global.db.bratHtml[chatId]) global.db.bratHtml[chatId] = {};
        global.db.bratHtml[chatId].theme = chosenTheme;
        global.db.bratHtml[chatId].updatedAt = Date.now();
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`–  *B R A T   H T M L*\n\n` + `┌  ◦  *Tema Aktif* : ${chosenTheme.toUpperCase()}\n` + `└  ◦  *File Template* : \`${chosenTheme}.html\`\n\n` + `_Tema berhasil disimpan! Ketik \`${prefix}brathtml <teks>\` untuk langsung membuat brat dengan tema ini._`);
      }
      if (flags.list || flags.daftartema || rawText.startsWith("--list") || flags.page) {
        await ctx.react("⏳");
        const allTemplates = listTemplates();
        if (!allTemplates.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ada template .html di folder template.`);
        }
        let searchQuery = flags.search || "";
        if (!searchQuery && !flags.page && cleanText && !/^(?:hal|page|\d+)$/i.test(cleanText)) {
          searchQuery = cleanText;
        }
        let matchedTemplates = allTemplates;
        if (searchQuery && searchQuery !== "true") {
          const kw = searchQuery.toLowerCase();
          matchedTemplates = allTemplates.filter(t => t.toLowerCase().includes(kw));
        }
        if (!matchedTemplates.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tema tidak ditemukan dengan kata kunci "${searchQuery}".`);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matchedTemplates.length / ITEMS_PER_PAGE) || 1;
        const pageItems = matchedTemplates.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
        const rows = pageItems.map((tpl, idx) => {
          const globalIdx = (page - 1) * ITEMS_PER_PAGE + idx + 1;
          return {
            title: `${globalIdx}. ${tpl.toUpperCase()}`,
            id: `${prefix}brathtml --settheme "${tpl}"`,
            description: `Jadikan tema default: ${tpl}`
          };
        });
        let baseCmd = `${prefix}brathtml`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH TEMA BRAT (${pageItems.length})`,
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
        const activeTheme = global.db.bratHtml[chatId]?.theme || DEFAULT_TPL;
        const bodyText = `–  *B R A T   H T M L  -  T E M A*\n\n` + `┌  ◦  *Tema Aktif Saat Ini* : ${activeTheme.toUpperCase()}\n` + `├  ◦  *Total Tema* : ${matchedTemplates.length}\n` + `└  ◦  *Halaman* : ${page} / ${totalPages}\n\n` + `_Pilih tema dari menu tombol di bawah untuk menyetel tema brat default:_`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `Brat HTML • Themes`,
              button_title: `Buka Hal ${page}`
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, "", buttons, options);
        } else {
          let fallback = `${bodyText}\n\n` + rows.map(r => `• *${r.title}*\n  Set: \`${r.id}\``).join("\n\n");
          if (totalPages > 1) {
            fallback += `\n\n_Pindah Halaman: \`${baseCmd} --page ${page < totalPages ? page + 1 : page - 1}\`_`;
          }
          await ctx.reply(fallback);
        }
        await ctx.react("✅");
        return;
      }
      const text = extractText(cleanText, ctx);
      const sessionTheme = global.db.bratHtml[chatId]?.theme;
      const activeTheme = sessionTheme || DEFAULT_TPL;
      if (!text || flags.help) {
        const activeDisplay = sessionTheme ? `${sessionTheme.toUpperCase()} (Kustom)` : `${DEFAULT_TPL.toUpperCase()} (Default)`;
        const guideText = `–  *B R A T   H T M L*

Generator stiker teks Brat animasi berbasis HTML5 & FFmpeg.

┌  ◦  *Tema Aktif* : ${activeDisplay}
│
├  ◦  *Pembuatan Standar (Stiker)* :
│  ├ Ketik teks: \`${prefix}brathtml Halo Dunia 🍎\`
│  └ Balas/reply pesan teks: \`${prefix}brathtml\`
│
├  ◦  *Kirim Format Video (GIF Playback)* :
│  └ \`${prefix}brathtml --video Halo Dunia\`
│
├  ◦  *Pilih Tema (CTA Menu)* :
│  ├ \`${prefix}brathtml --list\` (Daftar semua tema)
│  └ \`${prefix}brathtml --search fire\` (Cari tema tertentu)
│
├  ◦  *Set Tema Bawaan Permanen* :
│  └ \`${prefix}brathtml --settheme <nama_tema>\`
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--t <nama_tema>\` (Gunakan tema sekali pakai)
   ├ \`--search <nama>\` (Cari tema)
   ├ \`--video\` (Kirim stiker animasi sebagai format video)
   └ \`--reset\` (Kembalikan tema obrolan ke default)`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      if (text.length > MAX_TEXT_LEN) {
        return ctx.reply(`❌ Teks terlalu panjang (maksimum ${MAX_TEXT_LEN} karakter, saat ini ${text.length}).`);
      }
      await ctx.react("⏳");
      const tplName = (typeof flags.template === "string" ? flags.template : activeTheme).toLowerCase().trim();
      const template = loadTemplate(tplName);
      if (!template.includes(TEXT_PLACEHOLDER)) {
        throw new Error(`Template "${tplName}" tidak memiliki placeholder ${TEXT_PLACEHOLDER}`);
      }
      const safeText = emojiToImgHtml(escapeHtml(text));
      const html = template.split(TEXT_PLACEHOLDER).join(safeText);
      const rawBuf = await renderHtml(html);
      if (!rawBuf || rawBuf.length < 2e3) {
        throw new Error("Hasil render kosong atau data rusak.");
      }
      fs.writeFileSync(rawFile, rawBuf);
      await cropTo512(rawFile, cropFile);
      const finalBuf = fs.readFileSync(cropFile);
      if (flags.video) {
        await sock.sendMessage(ctx.id, {
          video: finalBuf,
          mimetype: "video/mp4",
          gifPlayback: true
        }, {
          quoted: quotedMsg
        });
      } else {
        const exif = {
          packname: global.bot?.name || "Brat HTML",
          author: `${tplName.toUpperCase()} • ${global.bot?.author?.name || "Wudysoft"}`,
          categories: ["🤖"]
        };
        const stickerBuf = await writeExifVid(finalBuf, exif, {});
        if (!stickerBuf) throw new Error("Gagal konversi video ke stiker.");
        await sock.sendMessage(ctx.id, {
          sticker: stickerBuf
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✨");
    } catch (error) {
      console.error("[brathtml Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal render brat: ${error?.message || error}`);
    } finally {
      unlinkSafe(rawFile);
      unlinkSafe(cropFile);
    }
  }
};