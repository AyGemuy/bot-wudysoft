import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/search/group-wa/v9`;

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["limit", "size", "count", "l"].includes(lowerKey)) key = "limit";
    if (["query", "q", "search"].includes(lowerKey)) key = "query";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
      else val = rawVal;
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
  name: "gcsearch",
  aliases: ["carigrup", "searchgc", "groupsearch", "grupwa", "carigc"],
  description: "Cari tautan/link grup WhatsApp berdasarkan kata kunci",
  category: "Search",
  limit: true,
  example: "gcsearch jb atau gcsearch anime --limit 10",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["gcsearch", "carigrup", "searchgc", "groupsearch", "grupwa", "carigc"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const searchQuery = flags.query || cleanPrompt;
      const limit = Number(flags.limit) || 5;
      if (!searchQuery) {
        const helpText = `– *G R O U P  S E A R C H*\n\n` + `┌ ◦ *Usage* : ${prefix}gcsearch <query>\n` + `│ ◦ *Limit* : ${prefix}gcsearch <query> --limit <angka>\n` + `└ ◦ *Function* : Mencari tautan grup WhatsApp berdasarkan kata kunci\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Search* : ${prefix}gcsearch jb\n` + `└ ◦ *With Limit* : ${prefix}gcsearch anime --limit 10\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        query: searchQuery,
        limit: limit
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      const groupList = data?.list || data?.data || data?.results || [];
      if (!groupList.length) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Grup tidak ditemukan\n` + `└ ◦ *Query* : "${searchQuery}"\n\n` + `${footer}`);
      }
      const groupRows = groupList.map((g, i) => {
        const title = (g.title || `Grup ${i + 1}`).trim();
        const link = g.join_link || g.invite_link || "";
        const category = g.details?.category ? g.details.category.replace(/_/g, " ") : "Umum";
        return {
          title: `${i + 1}. ${title}`.slice(0, 24),
          description: `Kategori: ${category} • Cek detail`,
          id: `${prefix}cekgc ${link}`
        };
      });
      const topGroup = groupList[0];
      const previewThumb = topGroup?.image || global.bot?.media?.banner1 || "https://files.catbox.moe/nurea0.jpg";
      const categoryTop = topGroup?.details?.category ? topGroup.details.category.replace(/_/g, " ") : "-";
      const descTop = (topGroup?.description || "Tidak ada deskripsi.").slice(0, 80);
      const bodyText = `– *G R O U P  S E A R C H*\n\n` + `┌ ◦ *Query* : "${searchQuery}"\n` + `│ ◦ *Total* : ${data.total || groupList.length} Grup\n` + `│ ◦ *Top Group* : ${topGroup.title}\n` + `│ ◦ *Category* : ${categoryTop}\n` + `└ ◦ *Description* : ${descTop}...\n\n` + `_Pilih grup pada menu di bawah untuk memeriksa atau bergabung:_\n\n` + `${footer}`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `PILIH GRUP WA (${groupList.length})`,
          sections: [{
            title: `Hasil: ${searchQuery}`,
            rows: groupRows
          }]
        })
      }];
      const options = {
        image: previewThumb,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Group Search`,
            button_title: "Lihat Grup"
          },
          limited_time_offer: {
            text: `✦ ${botName} - Group WA ✦`,
            url: "",
            copy_code: "",
            expiration_time: Date.now() + 3600 * 1e3
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
        await ctx.sendCta(bodyText, `${botName} • Group Finder`, buttons, options);
      } else {
        let fallbackMsg = `– *G R O U P  S E A R C H*\n\n` + `┌ ◦ *Query* : "${searchQuery}"\n` + `└ ◦ *Total* : ${groupList.length} Grup\n\n`;
        fallbackMsg += groupList.map((g, i) => `${i + 1}. *${g.title}*\n   Link: ${g.join_link || g.invite_link || "-"}`).join("\n\n");
        fallbackMsg += `\n\n${footer}`;
        await ctx.reply(fallbackMsg);
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errorMessage}\n` + `└ ◦ *Command* : ${ctx.command || "gcsearch"}\n\n` + `${footer}`);
    }
  }
};