import fs from "fs";
import path from "path";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const formatSize = bytes => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

function getAllPlugins(dir, baseDir = dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllPlugins(fullPath, baseDir));
    } else if (/\.(js|mjs|cjs)$/i.test(file)) {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      const parts = relativePath.split("/");
      const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "root";
      results.push({
        name: file.replace(/\.(js|mjs|cjs)$/i, ""),
        filename: file,
        relativePath: relativePath,
        fullPath: fullPath,
        folder: folder.toUpperCase(),
        size: stat.size
      });
    }
  }
  return results;
}

function parseCli(rawInput = "") {
  const tokens = rawInput.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(t => t.replace(/^["']|["']$/g, "")) || [];
  const cli = {
    delete: null,
    search: null,
    freeArgs: []
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const lower = token.toLowerCase();
    if (["--delete", "--del", "-d", "delete", "del"].includes(lower) && tokens[i + 1]) {
      cli.delete = tokens[++i];
    } else if (["--search", "--find", "-s"].includes(lower) && tokens[i + 1]) {
      cli.search = tokens[++i];
    } else {
      cli.freeArgs.push(token);
    }
  }
  return cli;
}
export default {
  name: "delplugin",
  aliases: ["delcommand", "hapusplugin", "dp", "rmplugin"],
  description: "Hapus file plugin dari database bot via CTA Sheet",
  category: "Owner",
  owner: true,
  example: ".delplugin | .delplugin sample | .delplugin --search test | .delplugin -d tools/sample.js",
  execute: async (sock, ctx, msg) => {
    if (!ctx.isOwner) {
      return ctx.reply("❌ Perintah ini hanya dapat diakses oleh Owner bot.");
    }
    const prefix = ctx.prefix || ".";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const botName = global.bot?.name || "WudysoftBot";
    const footerText = `${botName} • Plugin File Manager`;
    const pluginsDir = path.join(process.cwd(), "plugins");
    if (!fs.existsSync(pluginsDir)) {
      return ctx.reply("❌ Folder `plugins` tidak ditemukan di direktori root bot.");
    }
    const allPlugins = getAllPlugins(pluginsDir);
    if (allPlugins.length === 0) {
      return ctx.reply("📂 Tidak ada file plugin (`.js`) yang ditemukan di dalam folder `plugins`.");
    }
    const rawInput = (ctx.query || ctx.text || "").trim();
    const cli = parseCli(rawInput);
    let targetPlugin = null;
    if (cli.delete) {
      const q = cli.delete.toLowerCase().replace(/\\/g, "/");
      targetPlugin = allPlugins.find(p => p.relativePath.toLowerCase() === q || p.relativePath.toLowerCase() === `${q}.js` || p.filename.toLowerCase() === q || p.name.toLowerCase() === q);
    } else if (cli.freeArgs.length > 0 && !cli.search) {
      const firstArg = cli.freeArgs[0].toLowerCase().replace(/\\/g, "/");
      targetPlugin = allPlugins.find(p => p.relativePath.toLowerCase() === firstArg || p.relativePath.toLowerCase() === `${firstArg}.js` || p.filename.toLowerCase() === firstArg || p.name.toLowerCase() === firstArg);
      if (!targetPlugin) {
        cli.search = cli.freeArgs.join(" ").trim();
      }
    }
    if (targetPlugin) {
      try {
        await ctx.react("⏳");
        if (!path.resolve(targetPlugin.fullPath).startsWith(path.resolve(pluginsDir))) {
          throw new Error("Akses direktori di luar folder plugins ditolak.");
        }
        fs.unlinkSync(targetPlugin.fullPath);
        const textSuccess = `🗑️ *PLUGIN BERHASIL DIHAPUS*\n\n` + `╭───『 *DETAIL FILE* 』\n` + `│ 📄 *File:* \`${targetPlugin.filename}\`\n` + `│ 📂 *Path:* \`plugins/${targetPlugin.relativePath}\`\n` + `│ 📊 *Ukuran:* ${formatSize(targetPlugin.size)}\n` + `╰──────────────────\n\n` + `_File telah dihapus secara permanen dari server._`;
        await ctx.reply(textSuccess);
        await ctx.react("✅");
        return;
      } catch (error) {
        console.error("[DelPlugin Error]:", error?.message || error);
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal menghapus file: ${error?.message || error}`);
      }
    }
    let filteredList = allPlugins;
    const isSearch = Boolean(cli.search);
    const searchQuery = cli.search || "";
    if (isSearch) {
      const q = searchQuery.toLowerCase();
      filteredList = allPlugins.filter(p => p.name.toLowerCase().includes(q) || p.relativePath.toLowerCase().includes(q));
    }
    if (filteredList.length === 0) {
      await ctx.react("❌");
      return ctx.reply(`🔍 *PLUGIN TIDAK DITEMUKAN*\n\nTidak ditemukan plugin dengan keyword: *"${searchQuery}"*\n\nKetik \`${prefix}delplugin\` untuk melihat seluruh list.`);
    }
    await ctx.react("⏳");
    const folders = [...new Set(filteredList.map(p => p.folder))].sort();
    const buttons = [];
    for (const folder of folders) {
      const folderPlugins = filteredList.filter(p => p.folder === folder);
      if (folderPlugins.length === 0) continue;
      buttons.push({
        name: "single_select",
        title: `🗑️ ${folder} (${folderPlugins.length})`,
        sections: [{
          title: `${botName} • Hapus di Folder: ${folder}`,
          rows: folderPlugins.map(p => ({
            title: `🗑️ ${p.filename}`.slice(0, 24),
            description: `Hapus plugins/${p.relativePath} (${formatSize(p.size)})`,
            id: `${prefix}delplugin -d ${p.relativePath}`
          }))
        }]
      });
    }
    const bodyText = isSearch ? `🔍 *HAPUS PLUGIN (PENCARIAN)*\n\n` + `╭───『 *HASIL PENCARIAN* 』\n` + `│ 🔑 *Query:* "${searchQuery}"\n` + `│ 📊 *Ditemukan:* ${filteredList.length} file\n` + `╰──────────────────\n\n` + `⚠️ *PERINGATAN:* Memilih plugin dari menu di bawah akan *langsung menghapus* file secara permanen!` : `🗑️ *DELETE PLUGIN MANAGER*\n\n` + `╭───『 *DATABASE PLUGINS* 』\n` + `│ 📊 *Total Plugins:* ${allPlugins.length} file\n` + `│ 📁 *Total Folder:* ${folders.length} folder\n` + `╰──────────────────\n\n` + `⚠️ *PERINGATAN:* Memilih file di dalam folder bawah akan *langsung menghapus* file dari server!`;
    const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
    const options = {
      image: bannerMedia,
      params: {
        bottom_sheet: {
          in_thread_buttons_limit: 1,
          divider_indices: [1],
          list_title: `${botName} • Pilih Plugin Dihapus`,
          button_title: "🗑️ Buka Menu Hapus"
        }
      },
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedAiBotMessageInfo: {
          botJid: "0@bot"
        }
      },
      quoted: quotedMsg
    };
    if (typeof ctx.sendCta === "function") {
      await ctx.sendCta(bodyText, footerText, buttons, options);
    } else {
      let listText = bodyText + "\n\n";
      filteredList.forEach((p, idx) => {
        listText += `${idx + 1}. \`${prefix}delplugin -d ${p.relativePath}\`\n`;
      });
      await ctx.reply(listText);
    }
    await ctx.react("✅");
  }
};