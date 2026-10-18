import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/nsfw/nekopoi/v1`;
const formatNumber = num => typeof num === "number" ? num.toLocaleString("id-ID") : num || "0";

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["id", "detail", "get", "view", "play"].includes(lowerKey)) key = "id";
    if (["search", "q", "find", "s", "query"].includes(lowerKey)) key = "search";
    if (["home", "feed", "latest"].includes(lowerKey)) key = "home";
    if (["category", "cat", "genre", "c"].includes(lowerKey)) key = "category";
    if (["page", "pg"].includes(lowerKey)) key = "page";
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
  name: "nekopoi",
  aliases: ["neko", "poi", "hentaiindo"],
  description: "Cari dan nonton anime hentai NekoPoi (CTA Media List & Bottom Sheet)",
  category: "NSFW",
  limit: true,
  nsfw: true,
  example: "nekopoi overflow atau nekopoi --home atau nekopoi --id <slug_id>",
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
        if (["nekopoi", "neko", "poi", "hentaiindo"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const contentId = flags.id || null;
      if (contentId) {
        await ctx.react("⏳");
        const {
          data: res
        } = await axios.post(API_URL, {
          action: "detail",
          id: contentId
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 4e4
        });
        if (!res || !res.title || res.title === "Error") {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Konten tidak ditemukan\n` + `└ ◦ *Info* : Detail anime tidak tersedia atau tautan kedaluwarsa.\n\n` + `${footer}`);
        }
        const title = res.title || "Untitled";
        const cover = res.coverImage || null;
        const views = formatNumber(res.views);
        const date = res.date || "-";
        const info = res.info || {};
        const producers = info.producers || "-";
        const duration = info.duration || "-";
        const genres = info.genre || (Array.isArray(info.genres) ? info.genres.join(", ") : "-");
        const caption = `– *N E K O P O I  -  D E T A I L*\n\n` + `┌ ◦ *Title* : ${title}\n` + `│ ◦ *Producers* : ${producers}\n` + `│ ◦ *Duration* : ${duration}\n` + `│ ◦ *Genre* : ${genres}\n` + `│ ◦ *Release* : ${date}\n` + `│ ◦ *Views* : ${views}\n` + `└ ◦ *ID* : ${res.id}\n\n` + `${footer}`;
        const buttons = [];
        const firstStream = res.streams?.[0]?.url;
        if (firstStream) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "Tonton Streaming",
              url: firstStream
            })
          });
        }
        const firstDownloadRow = res.downloads?.[0];
        const firstDownloadLink = firstDownloadRow?.links?.[0]?.url;
        if (firstDownloadLink) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: `Download (${firstDownloadRow.quality || "Video"})`,
              url: firstDownloadLink
            })
          });
        }
        const relatedRows = (res.related || res.similarSeries || []).slice(0, 10).map(r => ({
          title: (r.title || "Related").slice(0, 24),
          description: "Lihat episode ini",
          id: `${prefix}nekopoi --id ${r.id}`
        }));
        if (relatedRows.length > 0) {
          buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "PILIH EPISODE TERKAIT",
              sections: [{
                title: "DAFTAR EPISODE TERKAIT",
                rows: relatedRows
              }]
            })
          });
        }
        const options = {
          image: cover || undefined,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • NekoPoi Player`,
              button_title: "Opsi Nonton"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(caption, `${botName} • NekoPoi`, buttons, options);
        } else if (cover) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: cover
            },
            caption: caption
          }, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(caption, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✅");
        return;
      }
      if (!rawText && !flags.home && !flags.category) {
        const helpText = `– *N E K O P O I*\n\n` + `┌ ◦ *Usage* : ${prefix}nekopoi <query>\n` + `│ ◦ *Detail* : ${prefix}nekopoi --id <slug_id>\n` + `│ ◦ *Home* : ${prefix}nekopoi --home\n` + `└ ◦ *Category* : ${prefix}nekopoi --category <kategori>\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Search* : ${prefix}nekopoi overflow\n` + `│ ◦ *Category* : ${prefix}nekopoi --category hentai\n` + `└ ◦ *Play* : ${prefix}nekopoi --id overflow-episode-1\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const searchQuery = flags.search || cleanPrompt || "";
      const page = Number(flags.page) || 1;
      let actionType = "home";
      let postPayload = {
        page: page
      };
      if (searchQuery) {
        actionType = "search";
        postPayload = {
          action: "search",
          query: searchQuery,
          page: page
        };
      } else if (flags.category) {
        actionType = "category";
        postPayload = {
          action: "category",
          slug: flags.category,
          page: page
        };
      } else {
        actionType = "home";
        postPayload = {
          action: "home",
          page: page
        };
      }
      const {
        data: res
      } = await axios.post(API_URL, postPayload, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 4e4
      });
      const sections = [];
      let totalFound = 0;
      let headerCover = null;
      if (actionType === "search" || actionType === "category") {
        const items = res?.items || [];
        totalFound = items.length;
        if (!items.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Anime tidak ditemukan\n` + `└ ◦ *Query* : "${searchQuery || flags.category}"\n\n` + `${footer}`);
        }
        headerCover = items[0]?.coverImage || null;
        const resultRows = items.slice(0, 15).map(item => ({
          title: item.title.slice(0, 24),
          description: `${item.genre ? item.genre.slice(0, 30) : "Tonton Anime"}`,
          id: `${prefix}nekopoi --id ${item.id}`
        }));
        sections.push({
          title: `HASIL PENCARIAN (Hal ${page})`,
          rows: resultRows
        });
      } else {
        const episodes = res?.episodes || [];
        const recommended = res?.recommended || [];
        const hentai = res?.latestHentai || [];
        totalFound = episodes.length + recommended.length + hentai.length;
        if (recommended.length > 0) {
          headerCover = recommended[0]?.coverImage;
          sections.push({
            title: "REKOMENDASI HENTAI",
            rows: recommended.slice(0, 8).map(item => ({
              title: item.title.slice(0, 24),
              description: `Skor: ${item.score || "8.0"} • Buka Detail`,
              id: `${prefix}nekopoi --id ${item.id}`
            }))
          });
        }
        if (episodes.length > 0) {
          if (!headerCover) headerCover = episodes[0]?.coverImage;
          sections.push({
            title: "EPISODE TERBARU",
            rows: episodes.slice(0, 8).map(item => ({
              title: item.title.slice(0, 24),
              description: `${item.date || "Baru Rilis"} • Buka Detail`,
              id: `${prefix}nekopoi --id ${item.id}`
            }))
          });
        }
        if (hentai.length > 0) {
          sections.push({
            title: "SERIES HENTAI",
            rows: hentai.slice(0, 8).map(item => ({
              title: item.title.slice(0, 24),
              description: `Tipe: ${item.type || "Anime"} • Buka Detail`,
              id: `${prefix}nekopoi --id ${item.id}`
            }))
          });
        }
      }
      const filterTitle = searchQuery ? `Cari: "${searchQuery}"` : flags.category ? `Kategori: "${flags.category.toUpperCase()}"` : "BERANDA NEKOPOI";
      const bodyText = `– *N E K O P O I*\n\n` + `┌ ◦ *Filter* : ${filterTitle}\n` + `│ ◦ *Total* : ${totalFound} Konten\n` + `└ ◦ *Page* : ${page}\n\n` + `_Pilih anime pada tombol di bawah untuk melihat detail atau streaming:_\n\n` + `${footer}`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "PILIH ANIME",
          sections: sections
        })
      }];
      let baseCmd = `${prefix}nekopoi`;
      if (searchQuery) baseCmd += ` --search "${searchQuery}"`;
      else if (flags.category) baseCmd += ` --category ${flags.category}`;
      else baseCmd += ` --home`;
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `Hal ${page - 1}`,
            id: `${baseCmd} --page ${page - 1}`
          })
        });
      }
      if (res?.pagination?.hasNext || totalFound >= 8) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `Hal ${page + 1}`,
            id: `${baseCmd} --page ${page + 1}`
          })
        });
      }
      const options = {
        image: headerCover || undefined,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • NekoPoi Explorer`,
            button_title: "Lihat Daftar"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • NekoPoi`, buttons, options);
      } else {
        let fallback = `– *N E K O P O I  -  L I S T*\n\n`;
        sections.forEach(sec => {
          fallback += `*${sec.title}*\n`;
          sec.rows.forEach(r => {
            fallback += `• *${r.title}*\n  Perintah: \`${r.id}\`\n`;
          });
          fallback += `\n`;
        });
        fallback += `${footer}`;
        await ctx.reply(fallback);
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[NekoPoi Error]:", error);
      await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        errMsg = error.response.data?.error || error.response.data?.message || errMsg;
      }
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "nekopoi"}\n\n` + `${footer}`);
    }
  }
};