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
      list: ["l", "all"]
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
export default {
  name: "deleteplugin",
  aliases: ["delplugin", "dfp", "dp", "rmplugin", "removeplugin"],
  description: "Hapus plugin via Multi-List Folder & File",
  category: "Owner",
  owner: true,
  example: "dfp\ndfp tts/tts-rich",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Plugin Manager`;
    const userName = ctx.pushname || ctx.sender?.split("@")[0] || "Owner";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const pluginsDir = path.join(process.cwd(), "plugins");
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["deleteplugin", "delplugin", "dfp", "dp", "rmplugin", "removeplugin"].some(a => firstWord.endsWith(a))) {
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
              title: `🗑️ ${fileName}`.slice(0, 24),
              id: `${prefix}deleteplugin ${filePath}`,
              description: `Hapus: plugins/${filePath}`.slice(0, 60)
            };
          });
          return {
            title: `${sectionTitle} (${files.length} File)`.slice(0, 24),
            rows: fileRows
          };
        });
        const bodyText = `Hi ${userName}!
Silakan pilih file plugin yang ingin Anda hapus (Hal ${page}/${totalPages}).

–  *D E L E T E  P L U G I N*

┌  ◦  *Total File* : ${allFiles.length} Plugin
│  ◦  *Total Folder* : ${folderKeys.length} Kategori
└  ◦  *Halaman* : ${page} / ${totalPages}

_Peringatan: Klik salah satu file di bawah untuk langsung menghapusnya secara permanen._`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📂 Buka Daftar File",
            sections: multiSections
          })
        }];
        let baseCmd = `${prefix}deleteplugin`;
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
              list_title: `${botName} • Folder Explorer`,
              button_title: "Hapus File Target"
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
        const fileContent = fs.readFileSync(fullTargetPath, "utf8");
        const fileSize = (Buffer.byteLength(fileContent, "utf8") / 1024).toFixed(2);
        fs.unlinkSync(fullTargetPath);
        const parentDir = path.dirname(fullTargetPath);
        try {
          if (parentDir !== pluginsDir && fs.readdirSync(parentDir).length === 0) {
            fs.rmdirSync(parentDir);
          }
        } catch {}
        await ctx.react("🗑️");
        return ctx.reply(`–  *D E L E T E  P L U G I N*\n\n` + `┌  ◦  *Status* : Berhasil Dihapus Permanen 🗑️\n` + `│  ◦  *File* : \`${path.basename(exactMatch)}\`\n` + `│  ◦  *Folder* : \`plugins/${path.dirname(exactMatch)}\`\n` + `│  ◦  *Path* : \`plugins/${exactMatch}\`\n` + `└  ◦  *Ukuran Sebelumnya* : ${fileSize} KB\n\n` + `${botFooter}`);
      }
      await ctx.react("❌");
      return ctx.reply(`❌ Plugin *"${targetPathInput}"* tidak ditemukan.`);
    } catch (err) {
      console.error("[DeletePlugin Error]:", err);
      await ctx.react("❌");
      return ctx.reply(`❌ Terjadi kesalahan: ${err?.message || err}`);
    }
  }
};