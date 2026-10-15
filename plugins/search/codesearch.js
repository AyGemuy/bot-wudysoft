import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "codesearch",
  aliases: ["searchcode", "ghcode", "gitcode", "caricode"],
  description: "Cari potongan kode dan repositori di GitHub dengan tampilan List interaktif",
  category: "Search",
  limit: true,
  example: "codesearch <keyword>",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      const query = (ctx.query || ctx.text || "").trim();
      if (!query) {
        const helpText = `– *C O D E  S E A R C H*\n\n` + `┌ ◦ *Usage* : ${prefix}codesearch <keyword>\n` + `└ ◦ *Example* : ${prefix}codesearch AyGemuy\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/search/code/v2`, {
        query: query
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      if (!data || data.status !== "success" && !data.status || !data.results || data.results.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Kode tidak ditemukan\n` + `└ ◦ *Query* : "${query}"\n\n` + `${footer}`);
      }
      const total = data.total || data.results.length;
      const topResult = data.results[0];
      let previewCode = (topResult.preview_code || "").trim();
      if (previewCode.length > 300) {
        previewCode = previewCode.substring(0, 300) + "\n// ... (dipotong)";
      }
      const rows = data.results.slice(0, 10).map((item, index) => {
        const fileName = item.file?.name || item.path?.split("/").pop() || `File #${index + 1}`;
        const repoName = item.repository?.full_name || item.repo || "Unknown Repo";
        const author = item.author?.username || item.repository?.owner || "Unknown";
        return {
          title: `${index + 1}. ${fileName}`.slice(0, 24),
          id: `${prefix}codesearch ${query} ${fileName}`,
          description: `Repo: ${repoName} • By: ${author}`.slice(0, 60)
        };
      });
      const listSections = [{
        title: `HASIL PENCARIAN (${data.results.length} File)`,
        rows: rows
      }];
      const bodyText = `– *C O D E  S E A R C H*\n\n` + `┌ ◦ *Query* : ${query}\n` + `│ ◦ *Total* : ${total} File\n` + `│ ◦ *File* : ${topResult.file?.name || "Code File"}\n` + `│ ◦ *Repo* : ${topResult.repository?.full_name || "Unknown"}\n` + `└ ◦ *Author* : @${topResult.author?.username || "Unknown"}\n\n` + `*Code Preview:*\n` + `\`\`\`${topResult.file?.extension || ""}\n` + `${previewCode || "// Preview code tidak tersedia"}\n` + `\`\`\`\n\n` + `${footer}`;
      if (typeof ctx.sendList === "function") {
        await ctx.sendList("CODE SEARCH", bodyText, footer, "Pilih Hasil File", listSections, {
          quoted: quotedMsg
        });
      } else if (typeof ctx.sendCta === "function") {
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "PILIH FILE HASIL",
            sections: listSections
          })
        }];
        await ctx.sendCta(bodyText, footer, buttons, {
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Code Search Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "codesearch"}\n\n` + `${footer}`);
    }
  }
};