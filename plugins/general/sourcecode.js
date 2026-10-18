import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  AIRich
} from "../../core/serialize.js";

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
  description: "Menampilkan informasi dan link source code resmi bot via AIRich",
  category: "Info",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const botName = global.bot?.name || "WudysoftBot";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const targetChat = ctx.chat || ctx.id;
      const repoTarget = "AyGemuy/bot-wudysoft";
      const githubApiUrl = `https://api.github.com/repos/${repoTarget}`;
      const {
        data
      } = await axios.get(githubApiUrl, {
        headers: {
          "User-Agent": "WhatsApp-Bot-Client"
        },
        timeout: 1e4
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
      const rich = typeof sock?.airich === "function" ? sock.airich() : typeof ctx.aiRich === "function" ? ctx.aiRich() : new AIRich(sock);
      rich.setTitle(`✦ ${botName} • GitHub Repository ✦`);
      rich.addPost({
        title: `${repoFullName} 🚀`,
        username: ownerName,
        subtitle: `GitHub • ${language}`,
        thumbnail_url: avatarUrl,
        post_url: repoUrl,
        post_caption: `${repoDesc}\n\n⭐ ${stars} Stars • 🍴 ${forks} Forks • 📦 ${repoSize}\nTerakhir diperbarui: ${updatedAt}`,
        source_app: "instagram",
        likes_count: data.stargazers_count || 2048,
        comments_count: data.open_issues_count || 128,
        shares_count: data.forks_count || 64,
        is_verified: true
      });
      rich.addTable([
        ["Info Repositori", "Keterangan"],
        ["Bahasa", language],
        ["Lisensi", license],
        ["Branch", defaultBranch],
        ["Stars", `${stars} ⭐`],
        ["Forks", `${forks} 🍴`],
        ["Watchers", `${watchers} 👁️`],
        ["Issues", `${openIssues} ⚠️`],
        ["Ukuran", repoSize]
      ], "📊 Detail Statistik Repo");
      rich.addCode("bash", `git clone ${repoUrl}.git`);
      rich.addCopyAction(`git clone ${repoUrl}.git`, "📋 Salin Perintah Clone");
      rich.addFooterAction({
        text: "🌐 Buka di GitHub",
        url: repoUrl
      });
      await rich.send(targetChat, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (e) {
      console.error("[SCRIPT AIRICH ERROR]:", e);
      await ctx.react("❌");
      const repoTarget = "AyGemuy/bot-wudysoft";
      const fallbackUrl = `https://github.com/${repoTarget}`;
      await ctx.reply(`–  *S O U R C E  C O D E*\n\n` + `Source code bot ini dapat diakses secara publik melalui tautan GitHub:\n\n` + `┌  ◦  *Repo* : ${repoTarget}\n` + `└  ◦  *Link* : ${fallbackUrl}\n\n` + `_Ketik: \`git clone ${fallbackUrl}.git\` untuk mendownload project._`, {
        quoted: msg
      });
    }
  }
};