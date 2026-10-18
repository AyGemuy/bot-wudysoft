import axios from "axios";
import {
  upload,
  formatBytes
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_BASE = `${global.bot?.api?.wudysoft}/api/tools/web2app/v6`;
export default {
  name: "web2app",
  aliases: ["webtoapk", "makeapk", "html2app"],
  description: "Konversi website menjadi aplikasi Android (APK) dan cek status build",
  category: "Tools",
  limit: true,
  example: "web2app <url> [--name AppName] [--pkg com.app.name] atau web2app status <build_id>",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      let text = (ctx.query || ctx.text || "").trim();
      const targetMedia = ctx.quoted?.isMedia ? ctx.quoted : ctx.isMedia ? ctx : null;
      if (!text && !targetMedia) {
        const helpText = `– *W E B  2  A P P*\n\n` + `┌ ◦ *Usage* : ${prefix}web2app <url>\n` + `│ ◦ *Quoted* : Balas gambar untuk icon aplikasi\n` + `└ ◦ *Function* : Mengubah website menjadi aplikasi Android (APK)\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Create* : ${prefix}web2app https://s.id --name SidApp\n` + `│ ◦ *Package* : ${prefix}web2app https://s.id --pkg com.sid.app\n` + `└ ◦ *Status* : ${prefix}web2app status <build_id>\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      if (text.startsWith("status ")) {
        const buildId = text.replace("status ", "").trim();
        if (!buildId) {
          await ctx.react("❌");
          return ctx.reply(`– *W E B  2  A P P*\n\n` + `┌ ◦ *Usage* : ${prefix}web2app status <build_id>\n` + `└ ◦ *Info* : Masukkan ID build yang ingin diperiksa.\n\n` + `${footer}`);
        }
        const {
          data
        } = await axios.post(API_BASE, {
          action: "status",
          id: buildId
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 3e4
        });
        if (!data || !data.success || !data.status) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengambil status build\n` + `└ ◦ *Info* : ${data?.message || "ID build tidak ditemukan."}\n\n` + `${footer}`);
        }
        const isReady = data.apk_ready;
        const workflowStatus = data.workflow_status || "in_progress";
        const conclusion = data.workflow_conclusion || "-";
        const apkSize = data.apk_size ? formatBytes(data.apk_size) : "-";
        let statusText = `– *S T A T U S  B U I L D*\n\n` + `┌ ◦ *Build ID* : ${data.build_id || buildId}\n` + `│ ◦ *Workflow* : ${workflowStatus} (${conclusion})\n` + `│ ◦ *Status* : ${isReady ? "Selesai (Ready)" : "Sedang Diproses"}\n`;
        if (isReady && data.apk_download_url) {
          statusText += `│ ◦ *Filename* : ${data.apk_file_name || "app-release.apk"}\n` + `│ ◦ *Size* : ${apkSize}\n` + `└ ◦ *Download* : ${data.apk_download_url}\n\n` + `${footer}`;
        } else {
          statusText += `└ ◦ *Workflow URL* : ${data.workflow_url || data.github_url || "-"}\n\n` + `_Proses build membutuhkan waktu 3-5 menit di GitHub Actions._\n\n` + `${footer}`;
        }
        await sock.sendMessage(ctx.id, {
          text: statusText.trim()
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      let targetUrl = "";
      let appName = "WebApp";
      let pkgName = "";
      let iconUrl = "";
      const restParams = {};
      const flagRegex = /--([a-zA-Z0-9_]+)\s+([^\s]+)/g;
      let match;
      while ((match = flagRegex.exec(text)) !== null) {
        const key = match[1].toLowerCase();
        const value = match[2];
        if (key === "name") {
          appName = value;
        } else if (key === "pkg" || key === "pkg_name") {
          pkgName = value;
        } else if (key === "icon") {
          iconUrl = value;
        } else {
          restParams[key] = value;
        }
      }
      targetUrl = text.replace(/--[a-zA-Z0-9_]+\s+[^\s]+/g, "").trim();
      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : URL tidak valid\n` + `└ ◦ *Info* : Tautan website harus diawali http:// atau https://\n\n` + `${footer}`);
      }
      if (targetMedia && typeof targetMedia.download === "function") {
        const buffer = await targetMedia.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer);
          if (uploadRes?.status && uploadRes?.url) {
            iconUrl = uploadRes.url;
          }
        }
      }
      const body = {
        action: "create",
        url: targetUrl,
        name: appName,
        ...pkgName ? {
          pkg_name: pkgName
        } : {},
        ...iconUrl ? {
          icon: iconUrl
        } : {},
        ...restParams
      };
      const {
        data
      } = await axios.post(API_BASE, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 45e3
      });
      if (!data || !data.success || !data.status) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memulai build APK\n` + `└ ◦ *Info* : ${data?.message || "Server error."}\n\n` + `${footer}`);
      }
      const buildId = data.build_id || "-";
      const responseText = `– *W E B  2  A P P*\n\n` + `┌ ◦ *App Name* : ${appName}\n` + `│ ◦ *Website* : ${targetUrl}\n` + (pkgName ? `│ ◦ *Package* : ${pkgName}\n` : "") + (iconUrl ? `│ ◦ *Icon* : Custom Icon\n` : "") + `│ ◦ *Build ID* : ${buildId}\n` + `└ ◦ *Workflow* : ${data.actions_url || data.github_url || "-"}\n\n` + `_Ketik ${prefix}web2app status ${buildId} secara berkala untuk memantau status._\n\n` + `${footer}`;
      await sock.sendMessage(ctx.id, {
        text: responseText.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "web2app"}\n\n` + `${footer}`);
    }
  }
};