import fs from "fs";
import path from "path";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  FOLDERS_PER_PAGE: 3,
  MAX_FILES_PER_FOLDER: 8
};

function initDB(senderId) {
  if (!global.db) global.db = {};
  if (!global.db.sfpPending) global.db.sfpPending = {};
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

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
      code: ["c"],
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
async function extractCodeAndFilename(sock, ctx, msg) {
  let code = "";
  let detectedFilename = "";
  const quoted = ctx.quoted;
  if (quoted) {
    const isDoc = quoted.type === "documentMessage" || quoted.mimetype?.includes("javascript") || quoted.mimetype?.includes("text") || quoted.fileName?.endsWith(".js") || quoted.filename?.endsWith(".js");
    if (isDoc || typeof quoted.download === "function") {
      try {
        const buffer = typeof quoted.download === "function" ? await quoted.download() : typeof ctx.download === "function" ? await ctx.download(quoted) : typeof sock.downloadMediaMessage === "function" ? await sock.downloadMediaMessage(msg) : null;
        if (buffer && Buffer.isBuffer(buffer)) {
          code = buffer.toString("utf8");
          detectedFilename = quoted.fileName || quoted.filename || "";
        }
      } catch (err) {
        console.warn("[SFP Media Download Error]:", err.message);
      }
    }
  }
  if (!code && (ctx.type === "documentMessage" || ctx.mimetype?.includes("javascript") || ctx.mimetype?.includes("text"))) {
    try {
      const buffer = typeof ctx.download === "function" ? await ctx.download() : null;
      if (buffer && Buffer.isBuffer(buffer)) {
        code = buffer.toString("utf8");
        detectedFilename = ctx.fileName || ctx.filename || "";
      }
    } catch {}
  }
  if (!code && quoted?.text) {
    code = quoted.text;
  }
  return {
    code: code,
    detectedFilename: detectedFilename
  };
}
export default {
  name: "saveplugin",
  aliases: ["sfp", "savecommand", "sp", "updateplugin", "saveplug"],
  description: "Simpan plugin via Reply/Media/Input dengan Multi-List Folder & File",
  category: "Owner",
  owner: true,
  example: "sfp\nsfp tts/tts-rich (Reply kode)",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Plugin Manager`;
    const userName = ctx.pushname || ctx.sender?.split("@")[0] || "Owner";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
    const pluginsDir = path.join(process.cwd(), "plugins");
    initDB(senderId);
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["saveplugin", "sfp", "savecommand", "sp", "updateplugin", "saveplug"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      let {
        code,
        detectedFilename
      } = await extractCodeAndFilename(sock, ctx, msg);
      if (!code && global.db.sfpPending[senderId]) {
        const cached = global.db.sfpPending[senderId];
        if (Date.now() - cached.timestamp < 5 * 60 * 1e3) {
          code = cached.code;
        } else {
          delete global.db.sfpPending[senderId];
          saveDB();
        }
      }
      if (code) {
        global.db.sfpPending[senderId] = {
          code: code,
          timestamp: Date.now()
        };
        saveDB();
      }
      const allFiles = getAllPluginFiles(pluginsDir);
      let targetPathInput = flags.path || cleanPrompt || detectedFilename || "";
      if (!targetPathInput || flags.list) {
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
              id: `${prefix}saveplugin ${filePath}`,
              description: `Path: plugins/${filePath}`.slice(0, 60)
            };
          });
          return {
            title: `${sectionTitle} (${files.length} File)`.slice(0, 24),
            rows: fileRows
          };
        });
        const bodyText = `Hi ${userName}!
Berikut daftar folder dan file plugin yang tersedia (Hal ${page}/${totalPages}).

–  *S A V E  P L U G I N*

┌  ◦  *Total File* : ${allFiles.length} Plugin
│  ◦  *Total Folder* : ${folderKeys.length} Kategori
│  ◦  *Halaman* : ${page} / ${totalPages}
└  ◦  *Draft Kode* : ${code ? "🟢 Ada (Siap Disimpan)" : "⚪ Mode Jelajah"}

${code ? "Klik salah satu file di bawah untuk langsung menimpa kode target:" : "Pilih file di bawah untuk melihat path:"}`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📂 Buka Daftar File",
            sections: multiSections
          })
        }];
        let baseCmd = `${prefix}saveplugin`;
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
      const normalizedInput = normalizeInputPath(targetPathInput);
      const exactMatch = allFiles.find(f => f.toLowerCase() === normalizedInput.toLowerCase());
      if (exactMatch && code) {
        const fullTargetPath = path.join(pluginsDir, exactMatch);
        fs.writeFileSync(fullTargetPath, code, "utf8");
        delete global.db.sfpPending[senderId];
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`–  *S A V E  P L U G I N*\n\n` + `┌  ◦  *Status* : Berhasil Diperbarui (Exact Match) 🟢\n` + `│  ◦  *File* : \`${path.basename(exactMatch)}\`\n` + `│  ◦  *Folder* : \`plugins/${path.dirname(exactMatch)}\`\n` + `│  ◦  *Path* : \`plugins/${exactMatch}\`\n` + `└  ◦  *Ukuran* : ${(Buffer.byteLength(code, "utf8") / 1024).toFixed(2)} KB\n\n` + `${botFooter}`);
      }
      if (code) {
        const newFilePath = path.join(pluginsDir, normalizedInput);
        const newFolderDir = path.dirname(newFilePath);
        if (!fs.existsSync(newFolderDir)) {
          fs.mkdirSync(newFolderDir, {
            recursive: true
          });
        }
        fs.writeFileSync(newFilePath, code, "utf8");
        delete global.db.sfpPending[senderId];
        saveDB();
        await ctx.react("✨");
        return ctx.reply(`–  *S A V E  P L U G I N*\n\n` + `┌  ◦  *Status* : Plugin Baru Berhasil Dibuat (Auto-Add) ✨\n` + `│  ◦  *File* : \`${path.basename(normalizedInput)}\`\n` + `│  ◦  *Folder* : \`plugins/${path.dirname(normalizedInput)}\`\n` + `│  ◦  *Path* : \`plugins/${normalizedInput}\`\n` + `└  ◦  *Ukuran* : ${(Buffer.byteLength(code, "utf8") / 1024).toFixed(2)} KB\n\n` + `${botFooter}`);
      }
      await ctx.react("❌");
      return ctx.reply(`❌ Balas *(reply)* kode teks atau dokumen \`.js\` terlebih dahulu.`);
    } catch (err) {
      console.error("[SavePlugin Error]:", err);
      await ctx.react("❌");
      return ctx.reply(`❌ Terjadi kesalahan: ${err?.message || err}`);
    }
  }
};