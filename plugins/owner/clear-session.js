import fs from "fs";
import path from "path";
import {
  getMessagePayload
} from "../../core/serialize.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
const sleep = ms => new Promise(r => setTimeout(r, ms));

function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function getAvailableSessionDirs() {
  const dirs = [];
  const mainCandidates = [{
    id: "main",
    name: "Main Session",
    path: path.join(process.cwd(), "session")
  }, {
    id: "main",
    name: "Main Session",
    path: path.join(process.cwd(), "Session")
  }];
  for (const c of mainCandidates) {
    if (fs.existsSync(c.path)) {
      dirs.push(c);
      break;
    }
  }
  const jadibotDir = path.join(process.cwd(), "jadibots");
  if (fs.existsSync(jadibotDir)) {
    try {
      const subDirs = fs.readdirSync(jadibotDir);
      for (const sub of subDirs) {
        const fullPath = path.join(jadibotDir, sub);
        if (fs.statSync(fullPath).isDirectory()) {
          dirs.push({
            id: `jadibot_${sub}`,
            name: `Jadibot (${sub.slice(0, 10)})`,
            path: fullPath
          });
        }
      }
    } catch (_) {}
  }
  return dirs;
}

function cleanDirectorySession(targetDir, isAggressive = false) {
  if (!fs.existsSync(targetDir)) return {
    deleted: 0,
    corrupted: 0,
    freed: 0,
    total: 0
  };
  const keepFiles = ["creds.json", "app-state-sync-version-", "pre-key-", "session-", "sender-key-", "app-state-sync-key-", "lid-mapping-"];
  let deleted = 0;
  let corrupted = 0;
  let freed = 0;
  const files = fs.readdirSync(targetDir);
  for (const file of files) {
    const filePath = path.join(targetDir, file);
    try {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        fs.unlinkSync(filePath);
        deleted++;
        corrupted++;
        continue;
      }
      const shouldKeep = keepFiles.some(pattern => pattern.endsWith("-") ? file.startsWith(pattern) : file === pattern);
      if (!shouldKeep) {
        const hoursOld = (Date.now() - stats.mtimeMs) / (1e3 * 60 * 60);
        if (hoursOld > (isAggressive ? 1 : 24)) {
          freed += stats.size;
          fs.unlinkSync(filePath);
          deleted++;
        }
      }
    } catch (_) {}
  }
  return {
    deleted: deleted,
    corrupted: corrupted,
    freed: freed,
    total: files.length
  };
}
export default {
  name: "cleansession",
  aliases: ["clearsession", "cleansesi", "clearsesi", "cs"],
  description: "Membersihkan sampah folder session tanpa logout (Toxic-MD Specs)",
  category: "Owner",
  owner: true,
  example: ".cleansession all | .cleansession main | .cleansession",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isOwner) return ctx.reply("❌ Fitur ini khusus hanya dapat digunakan oleh *Owner Bot*.");
      const args = ctx.args || [];
      const subCommand = (args[0] || "").toLowerCase();
      const fullInput = ctx.query || args.join(" ") || ctx.text || ctx.body || "";
      const matchTarget = fullInput.match(/--target=([a-zA-Z0-9_\-]+)/i);
      const matchCancel = fullInput.match(/--cancel=([a-zA-Z0-9_\-]+)/i);
      const targetId = matchTarget ? matchTarget[1] : null;
      const cancelId = matchCancel ? matchCancel[1] : null;
      const rawSender = ctx.sender || ctx.from || ctx.id || "";
      const senderJid = rawSender.includes("@") ? rawSender.split(":")[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : rawSender;
      const userNumber = senderJid.split("@")[0].replace(/\D/g, "");
      const prefix = typeof ctx.prefix === "string" ? ctx.prefix : ".";
      const botName = global.bot?.name || "Wudysoft";
      const botFooter = global.bot?.footer || `${botName} • Session Maintenance Dispatcher`;
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (cancelId) {
        ctx.react?.("🗑️");
        return ctx.reply(`✅ Proses maintenance pembersihan session dengan ID \`${cancelId}\` telah dibatalkan.`);
      }
      if (subCommand === "all" || subCommand === "semua") {
        const sessionDirs = getAvailableSessionDirs();
        if (!sessionDirs.length) return ctx.reply("❌ Tidak ada direktori session aktif yang terdeteksi.");
        ctx.react?.("⏳");
        await ctx.reply(`🔄 *Memproses pembersihan menyeluruh (${sessionDirs.length} Sesi)...*`);
        let totalDeleted = 0;
        let totalCorrupted = 0;
        let totalFreed = 0;
        let totalScanned = 0;
        for (const s of sessionDirs) {
          const res = cleanDirectorySession(s.path, true);
          totalScanned += res.total;
          totalDeleted += res.deleted;
          totalCorrupted += res.corrupted;
          totalFreed += res.freed;
          await sleep(300);
        }
        ctx.react?.("✅");
        return ctx.reply(`–  *C L E A N  A L L  S E S S I O N S*\n\n` + `┌  ◦  *Total Direktori* : ${sessionDirs.length} Sesi\n` + `│  ◦  *Total File Scan* : ${totalScanned} File\n` + `│  ◦  *File Dihapus* : ${totalDeleted} File\n` + `│  ◦  *Corrupt (0-byte)* : ${totalCorrupted} File\n` + `│  ◦  *Memori Dibebaskan* : ${formatSize(totalFreed)}\n` + `└  ◦  *Status* : Sukses & Bebas Desync ✅\n\n` + `_Semua folder session berhasil dibersihkan dari file sampah._`);
      }
      if (["main", "utama", "self"].includes(subCommand)) {
        const sessionDirs = getAvailableSessionDirs();
        const main = sessionDirs.find(d => d.id === "main");
        if (!main) return ctx.reply("❌ Folder sesi utama tidak ditemukan.");
        ctx.react?.("⏳");
        const res = cleanDirectorySession(main.path, false);
        ctx.react?.("✅");
        return ctx.reply(`–  *C L E A N  M A I N  S E S S I O N*\n\n` + `┌  ◦  *Direktori* : \`${main.name}\`\n` + `│  ◦  *Total File* : ${res.total} File\n` + `│  ◦  *Sampah Dihapus* : ${res.deleted} File\n` + `│  ◦  *Corrupt (0-byte)* : ${res.corrupted} File\n` + `└  ◦  *Memori Bebas* : ${formatSize(res.freed)}\n\n` + `_File login (creds.json & keys) tetap aman & terlindungi._`);
      }
      if (targetId) {
        ctx.react?.("⏳");
        const sessionDirs = getAvailableSessionDirs();
        const target = sessionDirs.find(d => d.id === targetId);
        if (!target) {
          ctx.react?.("❌");
          return ctx.reply("❌ Direktori target sesi tidak ditemukan atau sudah tidak aktif.");
        }
        const res = cleanDirectorySession(target.path, true);
        ctx.react?.("✅");
        const successText = `–  *C L E A N  S E S S I O N*\n\n` + `┌  ◦  *Target Sesi* : ${target.name}\n` + `│  ◦  *File Dipindai* : ${res.total} File\n` + `│  ◦  *Sampah Dibersihkan* : ${res.deleted} File\n` + `│  ◦  *Corrupt (0-byte)* : ${res.corrupted} File\n` + `│  ◦  *Ruang Dihemat* : ${formatSize(res.freed)}\n` + `└  ◦  *Status* : Optimal & Bersih ✅\n\n` + `Pemeliharaan folder session selesai tanpa memutuskan koneksi bot.`;
        return await sock.sendMessage(ctx.id, {
          text: successText
        }, {
          quoted: msg
        });
      }
      ctx.react?.("⏳");
      const sessionDirs = getAvailableSessionDirs();
      if (!sessionDirs.length) {
        ctx.react?.("❌");
        return ctx.reply("❌ Tidak ada folder sesi yang dapat dikelola.");
      }
      const generatedId = "cs_" + Math.random().toString(36).substring(2, 7);
      const hours = new Date().getHours();
      const greeting = hours < 4 ? "Selamat Malam" : hours < 11 ? "Selamat Pagi" : hours < 15 ? "Selamat Siang" : hours < 18 ? "Selamat Sore" : "Selamat Malam";
      let mediaOutput = global.bot?.media?.banner1 || global.bot?.media?.thumb || global.bot?.media?.banner2 || null;
      const baseContextInfo = {
        mentionedJid: [senderJid],
        ...global.bot?.utils?.contextInfo || {
          forwardingScore: 999,
          isForwarded: true
        }
      };
      const rows = [];
      for (const s of sessionDirs) {
        let fileCount = 0;
        try {
          fileCount = fs.readdirSync(s.path).length;
        } catch (_) {}
        rows.push({
          title: `📁 ${s.name.slice(0, 24)}`,
          description: `Total: ${fileCount} File | ID: ${s.id}`,
          id: `${prefix}cleansession --target=${s.id}`
        });
      }
      const limitedRows = rows.slice(0, 25);
      const bodyText = `“Hi @${userNumber}, ${greeting}!\n` + `Sistem pemeliharaan session *Toxic-MD* siap dijalankan.”\n\n` + `–  *S E S S I O N  I N F O*\n\n` + `┌  ◦  *ID Dispatch* : \`${generatedId}\`\n` + `│  ◦  *Operator* : @${userNumber}\n` + `│  ◦  *Metode* : Safe Whitelist (Anti-Logout)\n` + `│  ◦  *Direktori Terdeteksi* : ${sessionDirs.length} Sesi\n` + `└  ◦  *Masa Aktif* : 5 Menit (Auto-Purge)\n\n` + `–  *P E N T I N G*\n\n` + `┌  ◦  File \`creds.json\` & \`pre-keys\` penting tidak akan dihapus.\n` + `└  ◦  Pilih target sesi melalui tombol menu di bawah ini.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🎯 PILIH SESI TARGET (${limitedRows.length})`,
          sections: [{
            title: `${botName} • DAFTAR SESI AKTIF`,
            rows: limitedRows
          }]
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⚡ Bersihkan Semua Sesi",
          id: `${prefix}cleansession all`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "❌ Batalkan",
          id: `${prefix}cleansession --cancel=${generatedId}`
        })
      }];
      const options = {
        image: mediaOutput,
        title: `✦ ${botName} • Session Maintenance Dispatcher ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1],
            list_title: `${botName} • Maintenance Menu`,
            button_title: "Pilih Target Sesi"
          }
        },
        contextInfo: baseContextInfo,
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, options);
      } else {
        await ctx.reply(bodyText, {
          mentions: [senderJid],
          quoted: quotedMsg
        });
      }
      ctx.react?.("✅");
    } catch (error) {
      console.error("[CleanSession Error]:", error);
      ctx.react?.("❌");
      ctx.reply(`❌ Gagal memproses pembersihan session: ${error?.message || error}`);
    }
  }
};