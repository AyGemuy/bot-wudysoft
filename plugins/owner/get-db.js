import {
  performance
} from "perf_hooks";
import {
  createClient
} from "@libsql/client";
import db from "../../data/db.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
async function getTursoStats() {
  const config = global.bot?.turso;
  if (!config?.url || !config?.token) {
    return {
      connected: false,
      message: "Konfigurasi Turso tidak ditemukan di config"
    };
  }
  try {
    const client = createClient({
      url: config.url,
      authToken: config.token
    });
    const start = performance.now();
    const res = await client.execute("SELECT length(value) as len FROM bot_db WHERE key = 'data' LIMIT 1;");
    const ping = (performance.now() - start).toFixed(1);
    if (res.rows.length > 0) {
      const byteSize = Number(res.rows[0].len || 0);
      return {
        connected: true,
        size: formatBytes(byteSize),
        bytes: byteSize,
        ping: `${ping} ms`,
        url: config.url.replace(/^libsql:\/\//, "")
      };
    }
    return {
      connected: true,
      size: "0 B",
      ping: `${ping} ms`,
      empty: true,
      url: config.url.replace(/^libsql:\/\//, "")
    };
  } catch (err) {
    return {
      connected: false,
      message: err.message
    };
  }
}
export default {
  name: "database",
  aliases: ["db", "turso"],
  description: "Kelola, pantau, dan manipulasi database bot (Turso Cloud SQLite)",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    const prefix = typeof ctx.prefix === "string" ? ctx.prefix : ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      const sub = (ctx.args?.[0] || "").toLowerCase();
      const targetParam = ctx.args?.[1];
      if (sub === "backup") {
        if (typeof ctx.react === "function") await ctx.react("⏳");
        if (global.db) await db.write(global.db);
        const jsonString = JSON.stringify(global.db || {}, null, 2);
        const buffer = Buffer.from(jsonString, "utf-8");
        const docCaption = `– *D A T A B A S E  -  B A C K U P*\n\n` + `┌ ◦ *Size* : ${formatBytes(buffer.length)}\n` + `│ ◦ *Total Users* : ${Object.keys(global.db?.user || {}).length} Pengguna\n` + `│ ◦ *Total Groups* : ${Object.keys(global.db?.group || {}).length} Grup\n` + `│ ◦ *Engine* : In-Memory Buffer (Zero Disk)\n` + `└ ◦ *Time* : ${new Date().toLocaleString("id-ID", {
timeZone: "Asia/Jakarta"
})} WIB\n\n` + `_Berkas cadangan basis data berhasil diekspor._\n\n` + `${footer}`;
        await sock.sendMessage(ctx.id, {
          document: buffer,
          mimetype: "application/json",
          fileName: `database_backup_${Date.now()}.json`,
          caption: docCaption
        }, {
          quoted: quotedMsg
        });
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      if (sub === "sync") {
        if (typeof ctx.react === "function") await ctx.react("⏳");
        await db.write(global.db);
        if (typeof ctx.react === "function") await ctx.react("✅");
        const syncText = `– *D A T A B A S E  -  S Y N C*\n\n` + `┌ ◦ *Status* : Sukses\n` + `└ ◦ *Engine* : Turso Cloud SQLite\n\n` + `_Seluruh data memori runtime telah disinkronkan ke cloud._\n\n` + `${footer}`;
        return ctx.reply(syncText, {
          quoted: quotedMsg
        });
      }
      if (sub === "resetlimit") {
        if (typeof ctx.react === "function") await ctx.react("⏳");
        const defaultLimit = global.bot?.defaultLimit || 20;
        const totalReset = typeof db.resetAllLimits === "function" ? db.resetAllLimits(defaultLimit) : 0;
        if (typeof ctx.react === "function") await ctx.react("✅");
        const resetLimitText = `– *R E S E T  L I M I T*\n\n` + `┌ ◦ *Status* : Sukses\n` + `│ ◦ *Users* : ${totalReset} Pengguna\n` + `└ ◦ *Default Limit* : ${defaultLimit} Limit\n\n` + `_Limit harian seluruh pengguna berhasil dikembalikan ke default._\n\n` + `${footer}`;
        return ctx.reply(resetLimitText, {
          quoted: quotedMsg
        });
      }
      if (sub === "deluser" || sub === "resetuser") {
        let targetJid = null;
        if (ctx.mentionedJid?.[0]) {
          targetJid = ctx.mentionedJid[0];
        } else if (targetParam) {
          const cleanNum = targetParam.replace(/\D/g, "");
          if (cleanNum.length >= 6) targetJid = `${cleanNum}@s.whatsapp.net`;
        } else if (ctx.quoted?.sender) {
          targetJid = ctx.quoted.sender;
        }
        if (!targetJid) {
          const noUserText = `– *D E L E T E  U S E R*\n\n` + `┌ ◦ *Usage* : ${prefix}db deluser <nomor/@user>\n` + `└ ◦ *Example* : ${prefix}db deluser 6281234567890\n\n` + `${footer}`;
          return ctx.reply(noUserText);
        }
        if (!global.db.user?.[targetJid]) {
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Pengguna tidak ditemukan\n` + `└ ◦ *Target* : @${targetJid.split("@")[0]}\n\n` + `${footer}`, {
            mentions: [targetJid],
            quoted: quotedMsg
          });
        }
        delete global.db.user[targetJid];
        await db.write(global.db);
        if (typeof ctx.react === "function") await ctx.react("🗑️");
        const delUserSuccess = `– *D E L E T E  U S E R*\n\n` + `┌ ◦ *Status* : Sukses Terhapus\n` + `└ ◦ *Target* : @${targetJid.split("@")[0]}\n\n` + `_Data pengguna berhasil dibersihkan dari basis data._\n\n` + `${footer}`;
        return ctx.reply(delUserSuccess, {
          mentions: [targetJid],
          quoted: quotedMsg
        });
      }
      if (sub === "delgroup" || sub === "resetgroup") {
        let targetGroup = targetParam || ctx.id;
        if (!targetGroup.endsWith("@g.us")) {
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : ID grup tidak valid\n` + `└ ◦ *Example* : ${prefix}db delgroup 120363xxx@g.us\n\n` + `${footer}`);
        }
        if (!global.db.group?.[targetGroup]) {
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Data grup tidak ditemukan\n` + `└ ◦ *Target* : ${targetGroup}\n\n` + `${footer}`);
        }
        delete global.db.group[targetGroup];
        await db.write(global.db);
        if (typeof ctx.react === "function") await ctx.react("🗑️");
        const delGroupSuccess = `– *D E L E T E  G R O U P*\n\n` + `┌ ◦ *Status* : Sukses Terhapus\n` + `└ ◦ *Target* : ${targetGroup}\n\n` + `_Seluruh konfigurasi grup berhasil di-reset ke awal._\n\n` + `${footer}`;
        return ctx.reply(delGroupSuccess, {
          quoted: quotedMsg
        });
      }
      if (sub === "resetstats") {
        global.db.cmd = {};
        global.db.stats = {};
        global.db.totalHits = 0;
        await db.write(global.db);
        if (typeof ctx.react === "function") await ctx.react("✅");
        const resetStatsText = `– *R E S E T  S T A T S*\n\n` + `┌ ◦ *Status* : Sukses\n` + `└ ◦ *Total Hits* : 0 Commands\n\n` + `_Seluruh riwayat statistik hit dan aktivitas perintah telah dikosongkan._\n\n` + `${footer}`;
        return ctx.reply(resetStatsText, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const tursoStats = await getTursoStats();
      const totalUsers = Object.keys(global.db?.user || {}).length;
      const totalGroups = Object.keys(global.db?.group || {}).length;
      const registeredUsers = Object.values(global.db?.user || {}).filter(u => u.registered).length;
      const premiumUsers = Object.values(global.db?.user || {}).filter(u => u.premium?.status || u.ownerAcces).length;
      const totalHits = global.db?.totalHits || 0;
      const bodyText = `– *D A T A B A S E*\n\n` + `┌ ◦ *Status* : ${tursoStats.connected ? "Connected (Cloud)" : "Disconnected"}\n` + `│ ◦ *Data Size* : ${tursoStats.size || "0 B"}\n` + `│ ◦ *Latency* : ${tursoStats.ping || "Timeout"}\n` + `│ ◦ *Endpoint* : ${tursoStats.url || "-"}\n` + `└ ◦ *Storage* : In-Memory / Zero Disk\n\n` + `– *S T A T I S T I C*\n\n` + `┌ ◦ *Total Users* : ${totalUsers} Pengguna\n` + `│ ◦ *Registered* : ${registeredUsers} Pengguna\n` + `│ ◦ *Premium* : ${premiumUsers} Pengguna\n` + `│ ◦ *Total Groups* : ${totalGroups} Grup\n` + `└ ◦ *Total Hits* : ${totalHits} Perintah\n\n` + `_Pilih opsi administrasi basis data pada tombol di bawah:_\n\n` + `${footer}`;
      const sections = [{
        title: "SINKRONISASI & CADANGAN",
        rows: [{
          title: "Sinkronisasi Database",
          id: `${prefix}db sync`,
          description: "Tuliskan seluruh data memori ke Turso Cloud"
        }, {
          title: "Download Backup File",
          id: `${prefix}db backup`,
          description: "Ekspor dan kirim berkas database JSON ke chat"
        }]
      }, {
        title: "OPERASI CLEANUP & RESET",
        rows: [{
          title: "Reset Limit Semua User",
          id: `${prefix}db resetlimit`,
          description: `Kembalikan limit non-prem ke default (${global.bot?.defaultLimit || 20})`
        }, {
          title: "Reset Hit & Statistik",
          id: `${prefix}db resetstats`,
          description: "Kosongkan hitungan riwayat penggunaan perintah"
        }, {
          title: "Reset Data Grup Ini",
          id: `${prefix}db delgroup`,
          description: "Hapus konfigurasi grup saat ini"
        }]
      }];
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "PILIH OPSI DATABASE",
          sections: sections
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Sync Database",
          id: `${prefix}db sync`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Ambil Backup",
          id: `${prefix}db backup`
        })
      }];
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.thumb || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Database Control`,
            button_title: "Buka Menu Database"
          }
        },
        contextInfo: global.bot?.utils?.contextInfo || {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • Database`, buttons, options);
      } else {
        await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (e) {
      console.error("[DATABASE CMD ERROR]:", e);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${e.message}\n` + `└ ◦ *Command* : ${ctx.command || "database"}\n\n` + `${footer}`);
    }
  }
};