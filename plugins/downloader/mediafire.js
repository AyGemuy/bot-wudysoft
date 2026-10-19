import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";

const API_V3 = `${global.bot?.api?.wudysoft}/api/download/mediafire/v3`;
const API_V2 = `${global.bot?.api?.wudysoft}/api/download/mediafire/v2`;

const formatNumber = num => typeof num === "number" ? num.toLocaleString("id-ID") : num || "0";
const formatBytes = bytes => {
  if (!bytes || isNaN(bytes)) return "-";
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
  if (i === 0) return `${bytes} ${sizes[i]}`;
  return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`;
};

async function fetchMediafire(targetUrl) {
  try {
    const res = await axios.get(API_V3, {
      params: {
        url: targetUrl
      },
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      timeout: 35e3
    });
    if (res.data?.status && res.data?.result) {
      return res.data.result;
    }
  } catch (e) {
    console.warn("[MediaFire v3 Error, mencoba v2...]", e?.message);
  }
  try {
    const res = await axios.get(API_V2, {
      params: {
        url: targetUrl
      },
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      timeout: 35e3
    });
    if (res.data?.status && res.data?.result) {
      return res.data.result;
    }
  } catch (e) {
    console.error("[MediaFire v2 Error]", e?.message);
  }
  return null;
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["url", "link", "u", "l"].includes(lowerKey)) key = "url";
    if (["page", "pg", "p"].includes(lowerKey)) key = "page";
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
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}

export default {
  name: "mediafire",
  aliases: ["mf", "mfdl", "mediafiredl"],
  description: "Download file atau jelajahi folder MediaFire via CTA List & Bottom Sheet",
  category: "Downloader",
  limit: true,
  example: "mediafire https://www.mediafire.com/file/xxxx/contoh.zip/file",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["mediafire", "mf", "mfdl", "mediafiredl"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • MediaFire Downloader`;
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const targetUrl = flags.url || cleanPrompt.match(/https?:\/\/(www\.)?mediafire\.com\/[^\s]+/i)?.[0] || cleanPrompt;

      if (!targetUrl || !targetUrl.includes("mediafire.com")) {
        return ctx.reply(`–  *M E D I A F I R E*

Silakan masukkan tautan file atau folder MediaFire yang valid.

┌  ◦  *Format* : ${prefix}mf <link>
│  ◦  *Single File* : ${prefix}mf https://www.mediafire.com/file/...
│  ◦  *Folder* : ${prefix}mf https://www.mediafire.com/folder/...
└  ◦  *Flag* : --page <nomor>`);
      }

      await ctx.react("⏳");
      const data = await fetchMediafire(targetUrl);
      if (!data) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat data MediaFire dari server. Pastikan tautan masih aktif dan publik.");
      }

      // === PROSES SINGLE FILE ===
      if (data.type === "file" || data.download || data.filename || !data.files && !data.folders) {
        const fileName = data.name || data.filename || "mediafire_file";
        const fileSize = data.size || (data.raw_size ? formatBytes(data.raw_size) : "Tidak diketahui");
        const downloadUrl = data.download || data.links?.normal_download || targetUrl;
        const mime = data.mimetype || "application/octet-stream";
        const uploaded = data.uploaded || data.created || "-";
        const downloads = formatNumber(data.downloads || data.view || 0);

        const infoCaption = `–  *M E D I A F I R E*

┌  ◦  *Name* : ${fileName}
│  ◦  *Size* : ${fileSize}
│  ◦  *Uploaded* : ${uploaded}
│  ◦  *Downloads* : ${downloads}x
└  ◦  *Mime* : ${mime}

_Sedang mengunduh dan mengirim berkas, mohon tunggu..._`;

        // 1. KIRIM INFORMASI TERLEBIH DAHULU
        await sock.sendMessage(ctx.id, { text: infoCaption }, { quoted: quotedMsg });

        // 2. UNDUH DAN KIRIM DOKUMEN
        try {
          const { data: fileBuffer } = await axios.get(downloadUrl, {
            responseType: "arraybuffer",
            timeout: 12e4
          });

          await sock.sendMessage(ctx.id, {
            document: Buffer.from(fileBuffer),
            fileName: fileName,
            mimetype: mime
          }, {
            quoted: quotedMsg
          });

          await ctx.react("✅");
          return;
        } catch (mediaErr) {
          const fallbackText = `–  *M E D I A F I R E*

Gagal mengirim berkas dokumen langsung ke WhatsApp. Silakan unduh langsung melalui tautan di bawah ini:`;

          if (typeof ctx.sendCta === "function") {
            const fallbackButtons = [{
              name: "cta_url",
              buttonParamsJson: JSON.stringify({
                display_text: "📥 Unduh File Sekarang",
                url: downloadUrl,
                merchant_url: downloadUrl
              })
            }];
            await ctx.sendCta(fallbackText, botFooter, fallbackButtons, {
              title: `✦ MediaFire • Direct Link ✦`,
              subtitle: fileName,
              quoted: quotedMsg
            });
          } else {
            await ctx.reply(`${fallbackText}\n\n🔗 ${downloadUrl}`, {
              quoted: quotedMsg
            });
          }
          await ctx.react("⚠️");
          return;
        }
      }

      // === PROSES FOLDER ===
      if (data.type === "folder" || data.files || data.folders) {
        const folderName = data.name || "MediaFire Folder";
        let directFiles = data.files || [];
        const subFolders = data.folders || [];
        let allFiles = [...directFiles];
        for (const sub of subFolders) {
          if (sub.files && Array.isArray(sub.files)) {
            allFiles.push(...sub.files);
          }
        }
        const totalFiles = allFiles.length;
        const totalFolders = data.folder_count || subFolders.length;
        if (totalFiles === 0 && totalFolders === 0) {
          await ctx.react("⚠️");
          return ctx.reply(`📂 Folder *${folderName}* kosong.`);
        }
        const page = Number(flags.page) || 1;
        const limitPerPage = 10;
        const totalPages = Math.ceil(totalFiles / limitPerPage) || 1;
        const startIndex = (page - 1) * limitPerPage;
        const paginatedFiles = allFiles.slice(startIndex, startIndex + limitPerPage);
        const folderRows = subFolders.map(folder => {
          const name = folder.name || "Subfolder";
          const count = folder.file_count !== undefined ? `${folder.file_count} files` : "";
          const folderUrl = folder.url || (folder.folderkey ? `https://www.mediafire.com/folder/${folder.folderkey}` : "");
          return {
            title: `📁 ${name}`.slice(0, 24),
            description: `Buka folder ini ${count ? `(${count})` : ""}`.slice(0, 50),
            id: `${prefix}mediafire ${folderUrl}`
          };
        });
        const fileRows = paginatedFiles.map((file, idx) => {
          const name = file.name || file.filename || `File #${startIndex + idx + 1}`;
          const size = file.size || (file.raw_size ? formatBytes(file.raw_size) : "");
          const fileUrl = file.url || (file.quickkey ? `https://www.mediafire.com/file/${file.quickkey}` : "");
          return {
            title: `📄 ${name}`.slice(0, 24),
            description: `${size ? `[${size}] ` : ""}${file.path || ""}`.slice(0, 50),
            id: `${prefix}mediafire ${fileUrl}`
          };
        });
        const sections = [];
        if (folderRows.length > 0) {
          sections.push({
            title: `📂 DAFTAR SUB-FOLDER (${folderRows.length})`,
            rows: folderRows
          });
        }
        if (fileRows.length > 0) {
          sections.push({
            title: `📄 DAFTAR FILE (Hal ${page}/${totalPages})`,
            rows: fileRows
          });
        }
        const bodyText = `Hi ${userName}!
Berikut adalah direktori folder MediaFire yang ditemukan.

–  *M E D I A F I R E*

┌  ◦  *Folder* : ${folderName}
│  ◦  *Folders* : ${formatNumber(totalFolders)}
│  ◦  *Files* : ${formatNumber(totalFiles)}
└  ◦  *Page* : ${page} / ${totalPages}

Pilih folder untuk membuka isinya, atau pilih berkas untuk mengunduh.`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📂 PILIH FOLDER / FILE",
            sections: sections
          })
        }];
        const baseCmd = `${prefix}mediafire ${targetUrl}`;
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
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Direktori MediaFire`,
              button_title: "Buka List Folder & File"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, options);
        } else {
          let fallback = `–  *M E D I A F I R E*\n\n` + `┌  ◦  *Folder* : ${folderName}\n` + `└  ◦  *Total Files* : ${totalFiles}\n\n`;
          if (folderRows.length > 0) {
            fallback += `*SUB-FOLDER:*\n` + folderRows.map(f => `• ${f.title} (\`${f.id}\`)`).join("\n") + "\n\n";
          }
          if (fileRows.length > 0) {
            fallback += `*DAFTAR FILE:*\n` + paginatedFiles.map((f, i) => `${startIndex + i + 1}. *${f.name || f.filename}* (${f.size || "-"})\n   ${f.url}`).join("\n\n");
          }
          await ctx.reply(fallback);
        }
        await ctx.react("✅");
      }
    } catch (error) {
      await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        errMsg = error.response.data?.message || error.response.data?.error || errMsg;
      }
      ctx.reply(`❌ MediaFire Error: ${errMsg}`);
    }
  }
};