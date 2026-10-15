import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/download/terabox/v21`,
  API_TIMEOUT: 6e4,
  ITEMS_PER_PAGE: 10
};
const teraCache = new Map();

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
    const linkMatch = cleanPrompt.match(/https?:\/\/[^\s]+terabox[^\s]+/i) || cleanPrompt.match(/https?:\/\/1024terabox[^\s]+/i);
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

function getFullFileName(item) {
  const ext = (item.extension || "").trim();
  const name = (item.file_name || "file").trim();
  if (ext && name.toLowerCase().endsWith(ext.toLowerCase())) return name;
  return `${name}${ext}`;
}

function getMimeType(ext = "") {
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

function getFileIcon(ext = "") {
  const cleanExt = ext.replace(".", "").toLowerCase();
  if (["mp4", "mov", "mkv", "avi", "webm"].includes(cleanExt)) return "🎬";
  if (["jpg", "jpeg", "png", "webp"].includes(cleanExt)) return "🖼️";
  if (["mp3", "m4a", "wav"].includes(cleanExt)) return "🎵";
  if (["zip", "rar", "7z"].includes(cleanExt)) return "📦";
  return "📄";
}
export default {
  name: "teraboxdl",
  aliases: ["terabox", "tb", "tbdl"],
  description: "Download file/video dari TeraBox dengan pagination & session cache",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["teraboxdl", "terabox", "tb", "tbdl"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Paimon-bot";
      const botFooter = global.bot?.footer || `${botName} • TeraBox Downloader`;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const {
        flags
      } = parseFlags(rawText);
      const targetUrl = flags.url || ctx.quoted?.text?.match(/https?:\/\/[^\s]+/i)?.[0];
      if (!targetUrl) {
        return ctx.reply(`–  *T E R A B O X*

Silakan masukkan tautan berkas TeraBox yang valid.

┌  ◦  *Format* : ${prefix}terabox <link> [flags]
│  ◦  *Single* : ${prefix}terabox <link> -i 1
└  ◦  *Example* : ${prefix}terabox https://1024terabox.com/s/1WiWYIHbW0SLionSCGXrp2g

–  *F L A G S*

┌  ◦  *-i, --index* : Unduh langsung nomor file tertentu
└  ◦  *-p, --page*  : Navigasi halaman berkas`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      let files = [];
      const userCached = teraCache.get(senderId);
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
        if (!data.status || !data.response || data.response.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Gagal: ${data.message || "File tidak ditemukan atau tautan kedaluwarsa."}`);
        }
        files = data.response;
        if (teraCache.size > 50) teraCache.clear();
        teraCache.set(senderId, {
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
        const fullFileName = getFullFileName(targetItem);
        const extType = (targetItem.extension || "").toLowerCase();
        const isImage = [".jpg", ".jpeg", ".png", ".webp"].includes(extType);
        const mime = getMimeType(targetItem.extension);
        if (!targetItem.download_url) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Link unduhan untuk berkas ini tidak tersedia.");
        }
        const caption = `–  *T E R A B O X*

┌  ◦  *File* : ${fullFileName}
│  ◦  *Index* : #${selectedIdx} dari ${totalFiles}
└  ◦  *Size* : ${targetItem.file_size || "-"}`;
        if (isImage) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: targetItem.download_url
            },
            caption: caption
          }, {
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            document: {
              url: targetItem.download_url
            },
            fileName: fullFileName,
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
        const fullFileName = getFullFileName(singleItem);
        const mime = getMimeType(singleItem.extension);
        const isImage = [".jpg", ".jpeg", ".png", ".webp"].includes((singleItem.extension || "").toLowerCase());
        const caption = `–  *T E R A B O X*

┌  ◦  *File* : ${fullFileName}
└  ◦  *Size* : ${singleItem.file_size || "-"}`;
        if (isImage) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: singleItem.download_url
            },
            caption: caption
          }, {
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            document: {
              url: singleItem.download_url
            },
            fileName: fullFileName,
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
        const icon = getFileIcon(f.extension);
        const fullName = getFullFileName(f);
        return {
          title: `${icon} [#${realIndex}] ${fullName.slice(0, 20)}`,
          id: `${prefix}terabox -u "${targetUrl}" -i ${realIndex}`,
          description: `Size: ${f.file_size || "-"} | Tipe: ${f.extension || "File"}`
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
            id: `${prefix}terabox -u "${targetUrl}" -p ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}terabox -u "${targetUrl}" -p ${page + 1}`
          })
        });
      }
      if (topItemOnPage.download_url) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "📥 Direct Download Link",
            url: topItemOnPage.download_url,
            merchant_url: topItemOnPage.download_url
          })
        });
      }
      if (topItemOnPage.fast_stream_url) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "▶️ Fast Stream (M3U8)",
            url: topItemOnPage.fast_stream_url,
            merchant_url: topItemOnPage.fast_stream_url
          })
        });
      }
      const bodyText = `Hi ${userName}!
Berikut daftar berkas TeraBox yang ditemukan.

–  *T E R A B O X*

┌  ◦  *Total* : ${totalFiles} Files
│  ◦  *Halaman* : ${page} / ${totalPages}
└  ◦  *Tampil* : #${startIndex + 1} s/d #${Math.min(startIndex + itemsPerPage, totalFiles)}

Silakan klik tombol *PILIH DAFTAR BERKAS* di bawah atau ketik langsung:
\`${prefix}terabox -u "${targetUrl}" -i <1-${totalFiles}>\``;
      const bannerMedia = topItemOnPage.thumbnail || global.bot?.media?.banner1 || null;
      const ctaOptions = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • TeraBox List`,
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
      console.error("[TeraBox Error]:", error?.message || error);
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