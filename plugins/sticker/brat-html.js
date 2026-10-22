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
  console.log(`[brathtml] source ${width}x${height}`);
  let vf;
  if (width >= OUT_SIZE && height >= OUT_SIZE) {
    vf = `crop=${OUT_SIZE}:${OUT_SIZE}`;
  } else {
    vf = `scale=${OUT_SIZE}:${OUT_SIZE}:force_original_aspect_ratio=increase,crop=${OUT_SIZE}:${OUT_SIZE}`;
  }
  console.log(`[brathtml] filter: ${vf}`);
  await run("ffmpeg", ["-y", "-i", input, "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", output]);
  const out = await probeSize(output);
  if (out.width !== OUT_SIZE || out.height !== OUT_SIZE) {
    throw new Error(`Output bukan ${OUT_SIZE}x${OUT_SIZE}: ${out.width}x${out.height}`);
  }
  console.log(`[brathtml] cropped → ${out.width}x${out.height}`);
}

function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
    throw new Error(`Template "${safe}" tidak ditemukan di ${TEMPLATE_DIR}`);
  }
  return fs.readFileSync(file, "utf-8");
}

function parseFlags(input = "") {
  const flags = {};
  const regex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("[^"]*"|'[^']*'|\S+))?/g;
  let m;
  while ((m = regex.exec(input)) !== null) {
    let key = m[1].toLowerCase();
    let raw = m[2];
    let val = true;
    if (["t", "template", "tmp", "tpl", "theme", "tema"].includes(key)) key = "template";
    if (["d", "duration", "dur", "length"].includes(key)) key = "duration";
    if (["v", "video", "vid", "gif"].includes(key)) key = "video";
    if (["ls", "list", "listtpl", "daftartema"].includes(key)) key = "list";
    if (raw !== undefined) {
      if (raw.startsWith('"') && raw.endsWith('"') || raw.startsWith("'") && raw.endsWith("'")) {
        raw = raw.slice(1, -1);
      }
      if (raw === "true") val = true;
      else if (raw === "false") val = false;
      else if (!isNaN(raw) && String(raw).trim() !== "") val = Number(raw);
      else val = raw;
    }
    flags[key] = val;
  }
  const clean = input.replace(regex, "").trim();
  return {
    flags: flags,
    cleanText: clean
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
  const q = ctx.quoted || {};
  const candidates = [q.text, q.body, q.caption, q.conversation, q.message?.conversation, q.message?.extendedTextMessage?.text, ctx.text];
  for (const c of candidates) {
    if (c && String(c).trim()) return String(c).trim();
  }
  return "";
}

function unlinkSafe(p) {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}
async function sendThemeSelector(sock, ctx, quotedMsg, prefix, currentText = "") {
  const tpls = listTemplates();
  if (!tpls.length) {
    return ctx.reply(`❌ Tidak ada template .html di:\n${TEMPLATE_DIR}`);
  }
  const botName = global.bot?.name || "Wudysoft Bot";
  const botFooter = global.bot?.footer || `${botName} • Brat HTML`;
  const bannerImage = global.bot?.media?.banner1;
  const rows = tpls.map(tpl => ({
    title: `🎨 ${tpl.toUpperCase()}`,
    id: `${prefix}brathtml --t ${tpl} ${currentText}`.trim(),
    description: `Gunakan tema "${tpl}"${currentText ? ` untuk: "${currentText.slice(0, 25)}..."` : ""}`
  }));
  const listSections = [{
    title: "PILIHAN TEMA ANIMASI",
    rows: rows
  }];
  const buttons = [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: "🎨 PILIH TEMA BRAT",
      sections: listSections
    })
  }];
  const bodyText = `–  *B R A T   H T M L*

Pilih salah satu tema animasi di bawah untuk mengubah tampilan teks Brat Anda.

┌  ◦  *Default Tema* : ${DEFAULT_TPL}
│  ◦  *Total Tema* : ${tpls.length}
└  ◦  *Teks* : ${currentText ? `"${currentText}"` : "_(belum ada teks)_"}

Ketuk tombol di bawah untuk memilih tema.`;
  const options = {
    ...bannerImage ? {
      image: bannerImage
    } : {},
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Brat Theme`,
        button_title: "Lihat Tema"
      }
    },
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true
    },
    quoted: quotedMsg
  };
  if (typeof ctx.sendCta === "function") {
    return await ctx.sendCta(bodyText, botFooter, buttons, options);
  }
  return ctx.reply(`–  *T E M P L A T E S*\n\n` + tpls.map((t, i) => `  ${String(i + 1).padStart(2, "0")}. ${t}`).join("\n") + `\n\nContoh: ${prefix}brathtml --t fire ${currentText || "Hello World"}`);
}
export default {
  name: "brathtml",
  aliases: ["bhtml", "bratweb", "htmlstiker", "htmstiker"],
  description: "Render template HTML animasi jadi sticker/video (crop 512x512 via ffmpeg)",
  category: "Tools",
  example: ".brathtml Hello World\n" + ".brathtml --t fire --video Halo Dunia\n" + ".brathtml --list\n" + "Reply pesan lalu .brathtml",
  execute: async (sock, ctx, msg) => {
    const tmpDir = os.tmpdir();
    const stamp = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const rawFile = path.join(tmpDir, `brat_raw_${stamp}.mp4`);
    const cropFile = path.join(tmpDir, `brat_crop_${stamp}.mp4`);
    try {
      const raw = (ctx.query || ctx.args?.join(" ") || "").trim();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const {
        flags,
        cleanText
      } = parseFlags(raw);
      const text = extractText(cleanText, ctx);
      if (flags.list || flags.template === true || !text) {
        return await sendThemeSelector(sock, ctx, quotedMsg, prefix, text);
      }
      if (text.length > MAX_TEXT_LEN) {
        return ctx.reply(`❌ Teks terlalu panjang (maks ${MAX_TEXT_LEN}, sekarang ${text.length}).`);
      }
      await ctx.react("⏳");
      const tplName = typeof flags.template === "string" ? flags.template : DEFAULT_TPL;
      const template = loadTemplate(tplName);
      if (!template.includes(TEXT_PLACEHOLDER)) {
        throw new Error(`Template "${tplName}" tidak punya placeholder ${TEXT_PLACEHOLDER}`);
      }
      const safeText = escapeHtml(text);
      const html = template.split(TEXT_PLACEHOLDER).join(safeText);
      console.log(`[brathtml] render tpl="${tplName}" text="${text.slice(0, 40)}"`);
      const rawBuf = await renderHtml(html);
      if (!rawBuf || rawBuf.length < 2e3) {
        throw new Error("Hasil render kosong / terlalu kecil");
      }
      fs.writeFileSync(rawFile, rawBuf);
      console.log(`[brathtml] raw ${(rawBuf.length / 1024).toFixed(1)} KB`);
      await cropTo512(rawFile, cropFile);
      const finalBuf = fs.readFileSync(cropFile);
      console.log(`[brathtml] final ${(finalBuf.length / 1024).toFixed(1)} KB`);
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
          packname: global.bot?.name || "Wudysoft Bot",
          author: global.bot?.author?.name || "Wudysoft",
          categories: ["🤖"]
        };
        const stickerBuf = await writeExifVid(finalBuf, exif, {});
        if (!stickerBuf) throw new Error("Gagal konversi video → sticker");
        await sock.sendMessage(ctx.id, {
          sticker: stickerBuf
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[brathtml Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal render: ${error?.message || error}`);
    } finally {
      unlinkSafe(rawFile);
      unlinkSafe(cropFile);
    }
  }
};