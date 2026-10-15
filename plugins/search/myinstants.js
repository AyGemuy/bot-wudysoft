import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/sound/myinstants`;
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
    if (["play", "detail", "get", "id", "d", "p", "slug", "url"].includes(lowerKey)) key = "id";
    if (["search", "q", "find", "s", "query"].includes(lowerKey)) key = "search";
    if (["trending", "t"].includes(lowerKey)) key = "trending";
    if (["recent", "new", "n", "latest"].includes(lowerKey)) key = "recent";
    if (["categories", "cats", "listcat"].includes(lowerKey)) key = "categories";
    if (["category", "cat", "c"].includes(lowerKey)) key = "category";
    if (["country", "code"].includes(lowerKey)) key = "country";
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
  name: "myinstants",
  aliases: ["instants", "myinstant", "mi"],
  description: "Cari dan putar sound meme/efek suara instan dari MyInstants",
  category: "Fun",
  limit: true,
  example: "myinstants bruh atau myinstants --trending atau myinstants --id tuturu_1",
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
        if (["myinstants", "instants", "myinstant", "mi"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const soundId = flags.id || null;
      if (soundId) {
        await ctx.react("⏳");
        const {
          data: res
        } = await axios.get(API_URL, {
          params: {
            action: "detail",
            url: soundId
          },
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            Accept: "application/json"
          },
          timeout: 3e4
        });
        const sound = res?.result || res?.data || res;
        const soundAudio = sound.sound_url;
        if (!sound || !soundAudio) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Audio tidak ditemukan\n` + `└ ◦ *Info* : Berkas suara tidak tersedia di server MyInstants.\n\n` + `${footer}`);
        }
        const title = sound.title || "Sound Effect";
        const category = sound.category || "General";
        const views = formatNumber(sound.views);
        const likes = formatNumber(sound.likes);
        const tags = Array.isArray(sound.tags) && sound.tags.length ? sound.tags.slice(0, 5).join(", ") : "-";
        const uploader = sound.uploader?.name || "Anonymous";
        const desc = sound.description || "Tidak ada deskripsi.";
        const caption = `– *M Y  I N S T A N T S  -  D E T A I L*\n\n` + `┌ ◦ *Title* : ${title}\n` + `│ ◦ *Category* : ${category}\n` + `│ ◦ *Uploader* : ${uploader}\n` + `│ ◦ *Views* : ${views}\n` + `│ ◦ *Likes* : ${likes}\n` + `│ ◦ *Tags* : ${tags}\n` + `└ ◦ *ID* : ${sound.slug || sound.id}\n\n` + `_Deskripsi: ${desc}_\n\n` + `${footer}`;
        await sock.sendMessage(ctx.id, {
          text: caption
        }, {
          quoted: quotedMsg
        });
        await sock.sendMessage(ctx.id, {
          audio: {
            url: soundAudio
          },
          mimetype: "audio/mpeg",
          fileName: `${title}.mp3`,
          ptt: false
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      if (flags.categories) {
        await ctx.react("⏳");
        const {
          data: res
        } = await axios.get(API_URL, {
          params: {
            action: "categories"
          },
          timeout: 3e4
        });
        const catList = res?.categories || res?.result?.categories || [];
        if (!catList.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memuat kategori\n` + `└ ◦ *Info* : Daftar kategori MyInstants tidak tersedia.\n\n` + `${footer}`);
        }
        const catRows = catList.map(c => ({
          title: c.name.slice(0, 24),
          description: `Kategori ${c.name} (${c.slug})`,
          id: `${prefix}myinstants --category ${c.slug}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "PILIH KATEGORI",
            sections: [{
              title: "KATEGORI MYINSTANTS",
              rows: catRows
            }]
          })
        }];
        const catBody = `– *M Y  I N S T A N T S  -  C A T E G O R Y*\n\n` + `┌ ◦ *Total* : ${catList.length} Kategori\n` + `└ ◦ *Action* : Pilih kategori efek suara pada menu di bawah\n\n` + `${footer}`;
        await ctx.sendCta(catBody, `${botName} • Categories`, buttons, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      if (!rawText && !flags.trending && !flags.recent && !flags.category) {
        const helpText = `– *M Y  I N S T A N T S*\n\n` + `┌ ◦ *Usage* : ${prefix}myinstants <query>\n` + `│ ◦ *Play* : ${prefix}myinstants --id <slug>\n` + `│ ◦ *Trending* : ${prefix}myinstants --trending\n` + `│ ◦ *Recent* : ${prefix}myinstants --recent\n` + `└ ◦ *Function* : Mencari dan memutar sound meme MyInstants\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Search* : ${prefix}myinstants bruh\n` + `│ ◦ *Category* : ${prefix}myinstants --category games\n` + `└ ◦ *Direct Play* : ${prefix}myinstants --id tuturu_1\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      let actionType = "trending";
      let queryParam = {};
      const page = Number(flags.page) || 1;
      const country = (flags.country || "id").toLowerCase();
      if (flags.recent) {
        actionType = "recent";
      } else if (flags.category) {
        actionType = "category";
        queryParam.category = flags.category;
      } else if (flags.search || cleanPrompt) {
        actionType = "search";
        queryParam.query = flags.search || cleanPrompt;
      } else {
        actionType = "trending";
        queryParam.country = country;
      }
      const {
        data: res
      } = await axios.get(API_URL, {
        params: {
          action: actionType,
          page: page,
          ...queryParam
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept: "application/json"
        },
        timeout: 3e4
      });
      const soundList = res?.sounds || res?.result?.sounds || [];
      if (!soundList.length) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Suara tidak ditemukan\n` + `└ ◦ *Query* : "${queryParam.query || queryParam.category || actionType}"\n\n` + `${footer}`);
      }
      const totalResults = res?.total_results || res?.result?.total_results || soundList.length;
      const soundRows = soundList.slice(0, 15).map(s => {
        const title = s.title || `Sound #${s.id || s.slug}`;
        return {
          title: title.slice(0, 24),
          description: `Slug: ${s.slug || "-"} • Putar Sound`,
          id: `${prefix}myinstants --id ${s.slug || s.id}`
        };
      });
      const navRows = [{
        title: "Trending ID",
        description: "Sound paling hits di Indonesia",
        id: `${prefix}myinstants --trending --country id`
      }, {
        title: "Baru Ditambahkan",
        description: "Sound effect MyInstants rilis terbaru",
        id: `${prefix}myinstants --recent`
      }, {
        title: "Daftar Kategori",
        description: "Jelajahi seluruh kategori MyInstants",
        id: `${prefix}myinstants --categories`
      }];
      const sections = [{
        title: `DAFTAR SUARA (Hal ${page})`,
        rows: soundRows
      }, {
        title: "MENU KATEGORI",
        rows: navRows
      }];
      const filterTitle = queryParam.query ? `Cari: "${queryParam.query}"` : queryParam.category ? `Kategori: "${queryParam.category}"` : `Trending (${country.toUpperCase()})`;
      const bodyText = `– *M Y  I N S T A N T S*\n\n` + `┌ ◦ *Filter* : ${filterTitle}\n` + `│ ◦ *Page* : ${page}\n` + `└ ◦ *Total* : ${totalResults} Suara\n\n` + `_Pilih suara pada menu di bawah untuk memutar audio:_\n\n` + `${footer}`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `PILIH & PUTAR (${soundRows.length})`,
          sections: sections
        })
      }];
      let baseCmd = `${prefix}myinstants`;
      if (actionType === "search") baseCmd += ` --search "${queryParam.query}"`;
      else if (actionType === "category") baseCmd += ` --category ${queryParam.category}`;
      else if (actionType === "recent") baseCmd += ` --recent`;
      else baseCmd += ` --trending --country ${country}`;
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `Hal ${page - 1}`,
            id: `${baseCmd} --page ${page - 1}`
          })
        });
      }
      if (soundList.length >= 10) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `Hal ${page + 1}`,
            id: `${baseCmd} --page ${page + 1}`
          })
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • MyInstants`, buttons, {
          quoted: quotedMsg
        });
      } else {
        let fallback = `– *M Y  I N S T A N T S*\n\n`;
        fallback += soundRows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
        fallback += `\n\n${footer}`;
        await ctx.reply(fallback);
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[MyInstants Error]:", error);
      await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        errMsg = error.response.data?.error || error.response.data?.message || errMsg;
      }
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "myinstants"}\n\n` + `${footer}`);
    }
  }
};