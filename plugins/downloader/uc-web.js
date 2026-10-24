import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/download/ucweb`,
  API_TIMEOUT: 6e4,
  ITEMS_PER_PAGE: 10
};
const ucCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      url: ["u", "link"],
      index: ["i", "idx"],
      page: ["p", "pg"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
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
  const cleanPrompt = input.replace(flagRegex, "").trim();
  if (!flags.url) {
    const linkMatch = cleanPrompt.match(/https?:\/\/[^\s]*uc-share[^\s]+/i) || cleanPrompt.match(/https?:\/\/[^\s]*ucweb[^\s]+/i) || cleanPrompt.match(/https?:\/\/[^\s]*drive\.uc\.cn[^\s]+/i);
    if (linkMatch) {
      flags.url = linkMatch[0];
    } else if (cleanPrompt.startsWith("http")) {
      flags.url = cleanPrompt.split(/\s+/)[0];
    }
  }
  if (flags.index === undefined) {
    const parts = cleanPrompt.split(/\s+/);
    if (parts.length > 1 && !isNaN(parts[1])) {
      flags.index = Number(parts[1]);
    }
  }
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}

function formatSize(bytes, sizeMB) {
  if (sizeMB) return `${sizeMB} MB`;
  if (!bytes) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(2)} ${units[i]}`;
}

function getFileInfo(item) {
  let name = (item.file_name || "file").trim();
  const formatType = (item.format_type || "").toLowerCase();
  const lastDot = name.lastIndexOf(".");
  let ext = lastDot !== -1 ? name.substring(lastDot).toLowerCase() : "";
  if (!ext && formatType) {
    if (formatType.includes("mp4")) ext = ".mp4";
    else if (formatType.includes("image/jpeg")) ext = ".jpg";
    else if (formatType.includes("image/png")) ext = ".png";
    else if (formatType.includes("pdf")) ext = ".pdf";
    else if (formatType.includes("zip")) ext = ".zip";
    if (ext) name += ext;
  }
  return {
    fullName: name,
    ext: ext
  };
}

function getMimeType(ext = "", formatType = "") {
  if (formatType) return formatType;
  const cleanExt = ext.replace(".", "").toLowerCase();
  const mimeMap = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    mkv: "video/x-matroska",
    webm: "video/webm",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    pdf: "application/pdf"
  };
  return mimeMap[cleanExt] || "application/octet-stream";
}

function getFileIcon(ext = "", formatType = "") {
  const clean = ext.replace(".", "").toLowerCase();
  if (["mp4", "mov", "mkv", "avi", "webm"].includes(clean) || formatType.includes("video")) return "🎬";
  if (["jpg", "jpeg", "png", "webp"].includes(clean) || formatType.includes("image")) return "🖼️";
  if (["mp3", "m4a", "wav"].includes(clean) || formatType.includes("audio")) return "🎵";
  if (["zip", "rar", "7z"].includes(clean)) return "📦";
  return "📄";
}
export default {
  name: "ucwebdl",
  aliases: ["ucweb", "ucshare", "ucdl", "uc"],
  description: "Download file/video dari UCWeb / UC-Share dengan pagination & session cache",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["ucwebdl", "ucweb", "ucshare", "ucdl", "uc"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Paimon-bot";
      const botFooter = global.bot?.footer || `${botName} • UCWeb Downloader`;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const {
        flags
      } = parseFlags(rawText);
      const targetUrl = flags.url || ctx.quoted?.text?.match(/https?:\/\/[^\s]+/i)?.[0];
      if (!targetUrl) {
        return ctx.reply(`–  *U C W E B  D O W N L O A D E R*

Silakan masukkan tautan berkas UCWeb / UC-Share yang valid.

┌  ◦  *Format* : ${prefix}ucweb <link> [flags]
│  ◦  *Single* : ${prefix}ucweb <link> -i 1
└  ◦  *Example* : ${prefix}ucweb https://uc-share.com/s/6d765ea26fe24

–  *F L A G S*

┌  ◦  *-i, --index* : Unduh langsung nomor file tertentu
└  ◦  *-p, --page*  : Navigasi halaman berkas`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      let files = [];
      const userCached = ucCache.get(senderId);
      if (userCached && userCached.url === targetUrl && userCached.files?.length > 0) {
        files = userCached.files;
      } else {
        const {
          data
        } = await axios.post(CONFIG.API_URL, {
          url: targetUrl
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: CONFIG.API_TIMEOUT
        });
        const listFiles = data.files || data.response || [];
        if (data.status !== "success" && !data.status || listFiles.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Gagal: ${data.message || "File tidak ditemukan atau link sudah kedaluwarsa."}`);
        }
        files = listFiles;
        if (ucCache.size > 50) ucCache.clear();
        ucCache.set(senderId, {
          url: targetUrl,
          files: files,
          total: files.length
        });
      }
      const totalFiles = files.length;
      if (flags.index !== undefined) {
        const selectedIdx = Number(flags.index);
        if (isNaN(selectedIdx) || selectedIdx < 1 || selectedIdx > totalFiles) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Nomor index tidak valid. Pilih antara 1 hingga ${totalFiles}.`);
        }
        const targetItem = files[selectedIdx - 1];
        const {
          fullName,
          ext
        } = getFileInfo(targetItem);
        const mime = getMimeType(ext, targetItem.format_type);
        const isImage = ["image/jpeg", "image/png", "image/webp"].includes(mime) || [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
        const downloadUrl = targetItem.download?.url || targetItem.video_info?.url;
        if (!downloadUrl) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Link download untuk berkas ini tidak ditemukan.");
        }
        const caption = `–  *U C W E B  D O W N L O A D*

┌  ◦  *File* : ${fullName}
│  ◦  *Index* : #${selectedIdx} dari ${totalFiles}
└  ◦  *Size* : ${formatSize(targetItem.size, targetItem.sizeMB)}`;
        if (isImage) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: downloadUrl
            },
            caption: caption
          }, {
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            document: {
              url: downloadUrl
            },
            fileName: fullName,
            mimetype: mime,
            caption: caption
          }, {
            quoted: quotedMsg
          });
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      if (totalFiles === 1) {
        const singleItem = files[0];
        const {
          fullName,
          ext
        } = getFileInfo(singleItem);
        const mime = getMimeType(ext, singleItem.format_type);
        const isImage = ["image/jpeg", "image/png", "image/webp"].includes(mime) || [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
        const downloadUrl = singleItem.download?.url || singleItem.video_info?.url;
        const caption = `–  *U C W E B  D O W N L O A D*

┌  ◦  *File* : ${fullName}
└  ◦  *Size* : ${formatSize(singleItem.size, singleItem.sizeMB)}`;
        if (isImage) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: downloadUrl
            },
            caption: caption
          }, {
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            document: {
              url: downloadUrl
            },
            fileName: fullName,
            mimetype: mime,
            caption: caption
          }, {
            quoted: quotedMsg
          });
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      const itemsPerPage = CONFIG.ITEMS_PER_PAGE;
      const totalPages = Math.ceil(totalFiles / itemsPerPage) || 1;
      let page = Number(flags.page) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIndex = (page - 1) * itemsPerPage;
      const currentPageFiles = files.slice(startIndex, startIndex + itemsPerPage);
      const topItemOnPage = currentPageFiles[0] || files[0];
      const fileRows = currentPageFiles.map((f, i) => {
        const realIndex = startIndex + i + 1;
        const {
          fullName,
          ext
        } = getFileInfo(f);
        const icon = getFileIcon(ext, f.format_type || "");
        return {
          title: `${icon} [#${realIndex}] ${fullName.slice(0, 20)}`,
          id: `${prefix}ucweb -u "${targetUrl}" -i ${realIndex}`,
          description: `Size: ${formatSize(f.size, f.sizeMB)} | Resolusi: ${f.video_max_resolution || "-"}`
        };
      });
      const listSections = [{
        title: `📁 DAFTAR FILE (Hal ${page}/${totalPages} • Total: ${totalFiles})`,
        rows: fileRows
      }];
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 PILIH DAFTAR BERKAS",
          sections: listSections
        })
      }];
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}ucweb -u "${targetUrl}" -p ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}ucweb -u "${targetUrl}" -p ${page + 1}`
          })
        });
      }
      const topDownloadLink = topItemOnPage.download?.url;
      if (topDownloadLink) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "📥 Download Link",
            url: topDownloadLink,
            merchant_url: topDownloadLink
          })
        });
      }
      const topStreamLink = topItemOnPage.video_info?.url || topItemOnPage.preview_url;
      if (topStreamLink) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "▶️ Preview Stream",
            url: topStreamLink,
            merchant_url: topStreamLink
          })
        });
      }
      const bodyText = `Hi ${userName}!
Berikut daftar berkas UCWeb / UC-Share yang ditemukan.

–  *U C W E B*

┌  ◦  *Total* : ${totalFiles} Files
│  ◦  *Halaman* : ${page} / ${totalPages}
└  ◦  *Tampil* : #${startIndex + 1} s/d #${Math.min(startIndex + itemsPerPage, totalFiles)}

Silakan klik tombol *PILIH DAFTAR BERKAS* di bawah atau ketik langsung:
\`${prefix}ucweb -u "${targetUrl}" -i <1-${totalFiles}>\``;
      const bannerMedia = topItemOnPage.thumbnail || global.bot?.media?.banner1 || null;
      const ctaOptions = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • UCWeb List`,
            button_title: "Lihat Berkas"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, ctaOptions);
      } else {
        await sock.sendMessage(ctx.id, {
          image: bannerMedia ? {
            url: bannerMedia
          } : undefined,
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[UCWeb Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan: ${errorMessage}`);
    }
  }
};