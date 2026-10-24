import fs from "fs";
import path from "path";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  FOLDERS_PER_PAGE: 3,
  MAX_FILES_PER_FOLDER: 8
};

function getAllPluginFiles(dir, baseDir = dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllPluginFiles(fullPath, baseDir));
    } else if (file.endsWith(".js")) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      results.push(relPath);
    }
  }
  return results.sort((a, b) => a.localeCompare(b, "id", {
    sensitivity: "base"
  }));
}

function groupFilesByFolder(fileList = []) {
  const folders = {};
  for (const file of fileList) {
    const dir = path.dirname(file);
    const folderKey = dir === "." ? "root" : dir;
    if (!folders[folderKey]) folders[folderKey] = [];
    folders[folderKey].push(file);
  }
  return folders;
}

function normalizeInputPath(rawInput = "") {
  let clean = rawInput.trim().replace(/\\/g, "/");
  if (clean.startsWith("plugins/")) {
    clean = clean.slice("plugins/".length);
  }
  if (!clean.endsWith(".js")) {
    clean += ".js";
  }
  return clean;
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:^|\s)(?:--|-)([a-zA-Z0-9_]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?(?=\s|$)/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
      else val = rawVal;
    }
    const aliasMap = {
      page: ["p", "pg"],
      path: ["file", "f", "target"],
      list: ["l", "all"],
      textonly: ["t", "text"]
    };
    if (key === "p") {
      if (typeof val === "number" || !isNaN(val) && val !== true) {
        key = "page";
        val = Number(val);
      } else {
        key = "path";
      }
    }
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, " ").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
async function sendPluginFile(sock, targetJid, fullPath, relPath, quotedMsg, botFooter, textOnly = false) {
  const fileContent = fs.readFileSync(fullPath, "utf8");
  const fileName = path.basename(fullPath);
  const fileSize = (Buffer.byteLength(fileContent, "utf8") / 1024).toFixed(2);
  const captionText = `–  *G E T  P L U G I N*\n\n` + `┌  ◦  *File* : \`${fileName}\`\n` + `│  ◦  *Folder* : \`plugins/${path.dirname(relPath)}\`\n` + `│  ◦  *Path* : \`plugins/${relPath}\`\n` + `└  ◦  *Ukuran* : ${fileSize} KB\n\n` + `_${botFooter}_`;
  if (textOnly) {
    return await sock.sendMessage(targetJid, {
      text: `${captionText}\n\n\`\`\`javascript\n${fileContent}\n\`\`\``
    }, {
      quoted: quotedMsg
    });
  }
  return await sock.sendMessage(targetJid, {
    document: fs.readFileSync(fullPath),
    mimetype: "application/javascript",
    fileName: fileName,
    caption: captionText
  }, {
    quoted: quotedMsg
  });
}
export default {
  name: "getplugin",
  aliases: ["gfp", "gp", "catplugin", "viewplugin", "readplugin"],
  description: "Ambil berkas atau lihat isi plugin via Multi-List Folder & File",
  category: "Owner",
  owner: true,
  example: "gfp\ngfp tts/tts-rich\ngfp -p 2",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Plugin Manager`;
    const userName = ctx.pushname || ctx.sender?.split("@")[0] || "Owner";
    const targetJid = ctx.chat || ctx.id;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const pluginsDir = path.join(process.cwd(), "plugins");
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["getplugin", "gfp", "gp", "catplugin", "viewplugin", "readplugin"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const allFiles = getAllPluginFiles(pluginsDir);
      let targetPathInput = flags.path || cleanPrompt || "";
      if (!targetPathInput || flags.list) {
        if (!allFiles.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Tidak ada file plugin yang ditemukan.");
        }
        await ctx.react("📁");
        const folderGroups = groupFilesByFolder(allFiles);
        const folderKeys = Object.keys(folderGroups).sort();
        const perPage = CONFIG.FOLDERS_PER_PAGE;
        const totalPages = Math.ceil(folderKeys.length / perPage) || 1;
        let page = Number(flags.page) || 1;
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        const startIdx = (page - 1) * perPage;
        const currentFolders = folderKeys.slice(startIdx, startIdx + perPage);
        const multiSections = currentFolders.map(fld => {
          const files = folderGroups[fld] || [];
          const sectionTitle = fld === "root" ? "📁 ROOT DIRECTORY (/)" : `📁 ${fld.toUpperCase()}`;
          const fileRows = files.slice(0, CONFIG.MAX_FILES_PER_FOLDER).map(filePath => {
            const fileName = path.basename(filePath);
            return {
              title: fileName.slice(0, 24),
              id: `${prefix}getplugin ${filePath}`,
              description: `Path: plugins/${filePath}`.slice(0, 60)
            };
          });
          return {
            title: `${sectionTitle} (${files.length} File)`.slice(0, 24),
            rows: fileRows
          };
        });
        const bodyText = `Hi ${userName}!
Silakan pilih file plugin yang ingin diunduh (Hal ${page}/${totalPages}).

–  *G E T  P L U G I N*

┌  ◦  *Total File* : ${allFiles.length} Plugin
│  ◦  *Total Folder* : ${folderKeys.length} Kategori
└  ◦  *Halaman* : ${page} / ${totalPages}

Klik tombol *Pilih File* di bawah untuk melihat file per folder:`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📂 Buka Daftar File",
            sections: multiSections
          })
        }];
        let baseCmd = `${prefix}getplugin`;
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${baseCmd} -p ${page - 1}`
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${baseCmd} -p ${page + 1}`
            })
          });
        }
        const options = {
          params: {
            bottom_sheet: {
              list_title: `${botName} • Plugin Explorer`,
              button_title: "Pilih File"
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
        } else {
          return ctx.reply(bodyText);
        }
      }
      const normalizedInput = normalizeInputPath(targetPathInput);
      const exactMatch = allFiles.find(f => f.toLowerCase() === normalizedInput.toLowerCase());
      if (exactMatch) {
        const fullTargetPath = path.join(pluginsDir, exactMatch);
        await ctx.react("📥");
        return await sendPluginFile(sock, targetJid, fullTargetPath, exactMatch, quotedMsg, botFooter, Boolean(flags.textonly));
      }
      const isSpecificPath = normalizedInput.includes("/");
      let matchedFiles = [];
      if (!isSpecificPath) {
        const inputFilename = path.basename(normalizedInput).toLowerCase();
        matchedFiles = allFiles.filter(f => {
          const base = path.basename(f).toLowerCase();
          return base === inputFilename || f.toLowerCase().includes(inputFilename.replace(".js", ""));
        });
      }
      if (matchedFiles.length > 1) {
        await ctx.react("🔍");
        const matchedGroups = groupFilesByFolder(matchedFiles);
        const searchSections = Object.keys(matchedGroups).map(fld => ({
          title: `📁 ${fld.toUpperCase()}`.slice(0, 24),
          rows: matchedGroups[fld].map(filePath => ({
            title: path.basename(filePath).slice(0, 24),
            id: `${prefix}getplugin ${filePath}`,
            description: `Path: plugins/${filePath}`.slice(0, 60)
          }))
        }));
        const bodyText = `Hi ${userName}!
Ditemukan *${matchedFiles.length}* file yang cocok dengan kata kunci *"${targetPathInput}"*.

Pilih file yang ingin Anda unduh di bawah ini:`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📥 PILIH FILE TARGET",
            sections: searchSections
          })
        }];
        const options = {
          params: {
            bottom_sheet: {
              list_title: `${botName} • Multiple Matches`,
              button_title: "Pilih File Target"
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
        } else {
          return ctx.reply(bodyText);
        }
      }
      if (matchedFiles.length === 1) {
        const targetFile = matchedFiles[0];
        const fullTargetPath = path.join(pluginsDir, targetFile);
        await ctx.react("📥");
        return await sendPluginFile(sock, targetJid, fullTargetPath, targetFile, quotedMsg, botFooter, Boolean(flags.textonly));
      }
      await ctx.react("❌");
      return ctx.reply(`❌ Plugin *"${targetPathInput}"* tidak ditemukan.`);
    } catch (err) {
      console.error("[GetPlugin Error]:", err);
      await ctx.react("❌");
      return ctx.reply(`❌ Terjadi kesalahan: ${err?.message || err}`);
    }
  }
};