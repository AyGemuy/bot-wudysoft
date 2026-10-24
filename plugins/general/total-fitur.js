import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  PER_PAGE: 10
};

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
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
      search: ["s", "q", "find"],
      error: ["err", "rusak"],
      top: ["popular", "hits"]
    };
    if (key === "p") {
      if (typeof val === "number" || !isNaN(val) && val !== true) {
        key = "page";
        val = Number(val);
      }
    }
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "totalfitur",
  aliases: ["fitur", "statsfitur", "cmdstats", "totalcmd", "hitstats"],
  description: "Melihat total fitur bot serta statistik sukses & error masing-masing command",
  category: "Info",
  example: "totalfitur\ntotalfitur --top\ntotalfitur --error\ntotalfitur -p 2\ntotalfitur --search ai",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Command Analytics`;
    const userName = ctx.pushname || ctx.sender?.split("@")[0] || "User";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const loaderCmd = global.cmd || global.loader;
      const cmdMap = new Map();
      if (loaderCmd?.commands instanceof Map) {
        for (const [name, obj] of loaderCmd.commands.entries()) {
          const mainName = obj.name || name;
          if (!cmdMap.has(mainName)) {
            cmdMap.set(mainName, obj);
          }
        }
      } else if (typeof loaderCmd?.getCommandList === "function") {
        const list = loaderCmd.getCommandList() || [];
        for (const c of list) {
          const n = c.name || c;
          if (!cmdMap.has(n)) cmdMap.set(n, c);
        }
      }
      const dbStats = global.db?.stats || {};
      for (const cmdKey of Object.keys(dbStats)) {
        if (!cmdMap.has(cmdKey)) {
          cmdMap.set(cmdKey, {
            name: cmdKey
          });
        }
      }
      const totalFeatures = cmdMap.size;
      const statsList = [];
      let grandTotalHits = 0;
      let grandSuccessHits = 0;
      let grandErrorHits = 0;
      for (const [cmdName] of cmdMap.entries()) {
        const itemStat = dbStats[cmdName];
        let sCount = 0;
        let eCount = 0;
        let lastHit = 0;
        let lastError = null;
        if (typeof itemStat === "object" && itemStat !== null) {
          sCount = Number(itemStat.success) || 0;
          eCount = Number(itemStat.error) || 0;
          lastHit = itemStat.lastHit || 0;
          lastError = itemStat.lastError || null;
        } else if (typeof itemStat === "number") {
          sCount = itemStat;
        }
        const totalCmdHits = sCount + eCount;
        grandTotalHits += totalCmdHits;
        grandSuccessHits += sCount;
        grandErrorHits += eCount;
        const rate = totalCmdHits > 0 ? (sCount / totalCmdHits * 100).toFixed(1) : "100.0";
        statsList.push({
          name: cmdName,
          success: sCount,
          error: eCount,
          total: totalCmdHits,
          rate: Number(rate),
          lastHit: lastHit,
          lastError: lastError
        });
      }
      let filtered = statsList;
      const searchQuery = flags.search || cleanPrompt || "";
      if (searchQuery) {
        filtered = filtered.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      if (flags.error) {
        filtered = filtered.filter(i => i.error > 0).sort((a, b) => b.error - a.error);
      } else if (flags.top) {
        filtered.sort((a, b) => b.total - a.total);
      } else {
        filtered.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
      }
      const totalRate = grandTotalHits > 0 ? (grandSuccessHits / grandTotalHits * 100).toFixed(1) : "100.0";
      const perPage = CONFIG.PER_PAGE;
      const totalPages = Math.ceil(filtered.length / perPage) || 1;
      let page = Number(flags.page) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIndex = (page - 1) * perPage;
      const pageItems = filtered.slice(startIndex, startIndex + perPage);
      const rows = pageItems.map((item, idx) => {
        const no = startIndex + idx + 1;
        return {
          title: `[#${no}] ${prefix}${item.name}`.slice(0, 24),
          id: `${prefix}${item.name}`,
          description: `Total: ${item.total} | 🟢 ${item.success} | 🔴 ${item.error} | ${item.rate}%`
        };
      });
      const sections = [{
        title: `STATISTIK COMMAND (Hal ${page}/${totalPages})`,
        rows: rows
      }];
      const bodyText = `Hi ${userName}!
Berikut ringkasan performa dan pemakaian fitur bot.

–  *C O M M A N D  S T A T S*

┌  ◦  *Total Fitur* : ${totalFeatures} Command
│  ◦  *Total Hits* : ${grandTotalHits.toLocaleString("id-ID")} Kali
│  ◦  *Sukses* : ${grandSuccessHits.toLocaleString("id-ID")} (🟢)
│  ◦  *Error* : ${grandErrorHits.toLocaleString("id-ID")} (🔴)
│  ◦  *Success Rate* : ${totalRate}%
└  ◦  *Halaman* : ${page} / ${totalPages}
${searchQuery ? `│  ◦  *Filter Search* : "${searchQuery}"\n` : ""}${flags.error ? `│  ◦  *Filter* : Mode Error Priority\n` : ""}${flags.top ? `│  ◦  *Filter* : Mode Top Hits\n` : ""}
_Pilih salah satu command dari tombol di bawah untuk menjalankannya:_`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `📊 Pilih Command (${pageItems.length})`,
          sections: sections
        })
      }];
      let baseCmd = `${prefix}totalfitur`;
      if (flags.error) baseCmd += ` --error`;
      if (flags.top) baseCmd += ` --top`;
      if (searchQuery) baseCmd += ` --search "${searchQuery}"`;
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
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Analytics`,
            button_title: "Lihat Daftar Command"
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
        let fallback = `${bodyText}\n\n`;
        fallback += pageItems.map((r, i) => `*${startIndex + i + 1}. ${prefix}${r.name}*\n` + `   └ Total: ${r.total} | 🟢 Sukses: ${r.success} | 🔴 Error: ${r.error} (${r.rate}%)`).join("\n\n");
        return ctx.reply(fallback);
      }
    } catch (err) {
      console.error("[TotalFitur Error]:", err);
      return ctx.reply(`❌ Terjadi kesalahan: ${err?.message || err}`);
    }
  }
};