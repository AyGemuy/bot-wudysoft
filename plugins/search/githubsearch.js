import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "githubsearch",
  aliases: ["ghsearch", "github", "gitsearch"],
  description: "Mencari repository di GitHub dengan tampilan Interactive List CTA",
  category: "Search",
  limit: true,
  example: "githubsearch baileys",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      const query = (ctx.query || ctx.text || "").trim();
      if (!query) {
        const helpText = `– *G I T H U B*\n\n` + `┌ ◦ *Usage* : ${prefix}githubsearch <query>\n` + `└ ◦ *Example* : ${prefix}githubsearch baileys\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const res = await axios.get(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=10`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Node.js)",
          Accept: "application/vnd.github.v3+json"
        },
        timeout: 3e4
      });
      const list = res.data?.items;
      if (!list?.length) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Repositori tidak ditemukan\n` + `└ ◦ *Query* : "${query}"\n\n` + `${footer}`);
      }
      const topRepo = list[0];
      const updatedDate = topRepo.updated_at ? new Date(topRepo.updated_at).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }) : "-";
      const avatarUrl = topRepo.owner?.avatar_url || "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png";
      const actionRows = [{
        title: `Git Clone ${topRepo.name}`.slice(0, 24),
        id: `${prefix}gitclone ${topRepo.clone_url}`,
        description: `Clone: git clone ${topRepo.clone_url}`
      }, {
        title: "Cari Kode di Repo Ini",
        id: `${prefix}codesearch ${topRepo.name}`,
        description: "Cari potongan kode di dalam repositori ini"
      }];
      const otherRepoRows = list.slice(1).map((repo, i) => ({
        title: `${i + 2}. ${repo.full_name}`.slice(0, 24),
        id: `${prefix}githubsearch ${repo.full_name}`,
        description: `⭐ ${repo.stargazers_count.toLocaleString("id-ID")} | 🍴 ${repo.forks_count.toLocaleString("id-ID")} | 💻 ${repo.language || "Multi"}`.slice(0, 60)
      }));
      const listSections = [{
        title: `AKSI: ${topRepo.name.toUpperCase()}`,
        rows: actionRows
      }];
      if (otherRepoRows.length > 0) {
        listSections.push({
          title: `REPOSITORI TERKAIT (${otherRepoRows.length})`,
          rows: otherRepoRows
        });
      }
      const bodyText = `– *G I T H U B*\n\n` + `┌ ◦ *Repository* : ${topRepo.full_name}\n` + `│ ◦ *Owner* : ${topRepo.owner?.login || "Unknown"}\n` + `│ ◦ *Stars* : ${topRepo.stargazers_count.toLocaleString("id-ID")}\n` + `│ ◦ *Forks* : ${topRepo.forks_count.toLocaleString("id-ID")}\n` + `│ ◦ *Language* : ${topRepo.language || "Unknown"}\n` + `│ ◦ *License* : ${topRepo.license?.spdx_id || "None"}\n` + `│ ◦ *Updated* : ${updatedDate}\n` + `└ ◦ *Clone* : git clone ${topRepo.clone_url}\n\n` + `_${topRepo.description || "Tidak ada deskripsi yang tersedia."}_\n\n` + `${footer}`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "PILIH REPOSITORI / AKSI",
          sections: listSections
        })
      }, {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "Salin Git Clone",
          copy_code: `git clone ${topRepo.clone_url}`
        })
      }, {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "Buka di GitHub",
          url: topRepo.html_url
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • GitHub Search`, buttons, {
          media: avatarUrl,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: avatarUrl
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[GitHub Search Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "githubsearch"}\n\n` + `${footer}`);
    }
  }
};