import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
export default {
  name: "script",
  aliases: ["sc", "sourcecode", "source", "repo", "github"],
  description: "Menampilkan informasi dan link source code resmi bot dari GitHub",
  category: "Info",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Multi-Device`;
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const repoTarget = "AyGemuy/bot-wudysoft";
      const githubApiUrl = `https://api.github.com/repos/${repoTarget}`;
      const {
        data
      } = await axios.get(githubApiUrl, {
        headers: {
          "User-Agent": "WhatsApp-Bot-Client"
        },
        timeout: 15e3
      });
      const repoFullName = data.full_name || repoTarget;
      const repoDesc = data.description || "WhatsApp Automation Bot Engine";
      const repoUrl = data.html_url || `https://github.com/${repoTarget}`;
      const stars = (data.stargazers_count || 0).toLocaleString("id-ID");
      const forks = (data.forks_count || 0).toLocaleString("id-ID");
      const watchers = (data.watchers_count || 0).toLocaleString("id-ID");
      const openIssues = (data.open_issues_count || 0).toLocaleString("id-ID");
      const language = data.language || "JavaScript";
      const defaultBranch = data.default_branch || "main";
      const repoSize = formatBytes((data.size || 0) * 1024);
      const license = data.license?.name || "MIT License";
      const ownerName = data.owner?.login || "AyGemuy";
      const avatarUrl = data.owner?.avatar_url || global.bot?.media?.avatar || "https://files.catbox.moe/8ugr9a.jpg";
      const updatedAt = data.updated_at ? new Date(data.updated_at).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }) : "Baru saja";
      const createdAt = data.created_at ? new Date(data.created_at).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }) : "-";
      const bodyText = `Hi ${userName}!
Source code bot ini bersifat open-source dan dapat diakses publik melalui GitHub.

–  *R E P O S I T O R Y*

┌  ◦  *Name* : ${repoFullName}
│  ◦  *Author* : ${ownerName}
│  ◦  *Language* : ${language}
│  ◦  *License* : ${license}
│  ◦  *Branch* : ${defaultBranch}
└  ◦  *Size* : ${repoSize}

–  *S T A T I S T I C*

┌  ◦  *Stars* : ${stars}
│  ◦  *Forks* : ${forks}
│  ◦  *Watchers* : ${watchers}
│  ◦  *Issues* : ${openIssues}
│  ◦  *Created* : ${createdAt}
└  ◦  *Updated* : ${updatedAt}

${repoDesc}

Gunakan tombol di bawah untuk membuka repository atau menyalin perintah git clone.`;
      const footerText = `${botFooter}`;
      const buttons = [{
        name: "cta_url",
        display_text: "🌐 Buka GitHub",
        url: repoUrl
      }, {
        name: "cta_copy",
        display_text: "📋 Salin Git Clone",
        copy_code: `git clone ${repoUrl}.git`
      }, {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "⚡ NAVIGASI BOT",
          sections: [{
            title: `${botName} • QUICK SHORTCUTS`,
            rows: [{
              title: "🏠 Menu Utama",
              description: "Buka menu utama dan daftar fitur bot",
              id: `${prefix}menu`
            }, {
              title: "👑 Kontak Developer",
              description: "Hubungi pembuat dan pengembang bot",
              id: `${prefix}owner`
            }, {
              title: "⚡ Ping & Server Speed",
              description: "Cek latensi dan status kecepatan server",
              id: `${prefix}ping`
            }]
          }]
        })
      }];
      const options = {
        image: avatarUrl,
        title: `✦ ${botName} • Source Code ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [2],
            list_title: `${botName} • Source Code`,
            button_title: "Buka Source Code"
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        await ctx.reply(`${bodyText}\n\n🔗 *Link:* ${repoUrl}`, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[SCRIPT CMD ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal mengambil data repository: ${e.message}`);
    }
  }
};