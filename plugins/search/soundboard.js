import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/sound/soundboard`;
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
    if (["play", "detail", "get", "id", "d", "p"].includes(lowerKey)) key = "id";
    if (["search", "q", "find", "s", "query"].includes(lowerKey)) key = "search";
    if (["trending", "t"].includes(lowerKey)) key = "trending";
    if (["new", "added", "n", "latest"].includes(lowerKey)) key = "new";
    if (["categories", "cats", "listcat"].includes(lowerKey)) key = "categories";
    if (["category", "cat", "c"].includes(lowerKey)) key = "category";
    if (["related", "rel", "r"].includes(lowerKey)) key = "related";
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
  name: "soundboard",
  aliases: ["sb", "sboard", "mysoundboard"],
  description: "Cari dan putar efek suara/meme dari Soundboard Cloud API",
  category: "Fun",
  limit: true,
  example: "soundboard fart atau soundboard --trending atau soundboard --id 8277",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["soundboard", "sb", "sboard", "mysoundboard"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
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
            id: soundId
          },
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            Accept: "application/json"
          },
          timeout: 3e4
        });
        const sound = res?.results?.[0] || res?.result || res?.data || res;
        const soundAudio = sound.sound_file || sound.direct_url;
        if (!sound || !soundAudio) {
          await ctx.react("❌");
          return ctx.reply("❌ Detail suara tidak ditemukan atau file audio tidak tersedia.");
        }
        const title = sound.name || sound.title || `Sound #${sound.id}`;
        const category = sound.category_name || "General";
        const views = formatNumber(sound.views);
        const likes = formatNumber(sound.likes_count);
        const favorites = formatNumber(sound.favorites_count);
        const caption = `🔊 *SOUNDBOARD DETAIL*\n\n` + `• *Judul:* ${title}\n` + `• *Kategori:* ${category}\n` + `• *Dilihat:* ${views} kali\n` + `• *Disukai:* ${likes} orang\n` + `• *Favorit:* ${favorites}\n` + `• *ID:* \`${sound.id}\`\n\n` + `_Memutar audio..._`;
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
        const catList = res?.results || res?.data || [];
        if (!catList.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat daftar kategori.");
        }
        const catRows = catList.map(c => ({
          title: c.name.slice(0, 24),
          description: `Lihat suara kategori ${c.name}`,
          id: `${prefix}soundboard --category ${c.id}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📂 Pilih Kategori",
            sections: [{
              title: "KATEGORI SOUNDBOARD",
              rows: catRows
            }]
          })
        }];
        await ctx.sendCta(`📂 *DAFTAR KATEGORI SOUNDBOARD*\n\nTersedia *${catList.length}* kategori efek suara. Pilih kategori di bawah:`, `${botName} • Soundboard Categories`, buttons, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      if (!rawText && !flags.trending && !flags.new && !flags.category && !flags.related) {
        return ctx.reply(`🔊 *SOUNDBOARD MEME & SFX PLAYER*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Cari suara: \`${prefix}soundboard bruh\`\n` + `  👉 Putar suara: \`${prefix}soundboard --id 8277\`\n\n` + `• *Kategori & Filter Cepat:*\n` + `  👉 \`${prefix}soundboard --trending\`\n` + `  👉 \`${prefix}soundboard --new\`\n` + `  👉 \`${prefix}soundboard --categories\`\n` + `  👉 \`${prefix}soundboard --category 914\` (Kategori Memes)\n` + `  👉 \`${prefix}soundboard --related 11961\` (Suara terkait)\n\n` + `• *Opsi Flags:*\n` + `  • \`--page <nomor>\` (Navigasi halaman)`);
      }
      await ctx.react("⏳");
      let actionType = "trending";
      let queryParam = {};
      const page = Number(flags.page) || 1;
      if (flags.new) {
        actionType = "new_sounds";
      } else if (flags.category) {
        actionType = "category";
        queryParam.id = flags.category;
      } else if (flags.related) {
        actionType = "related";
        queryParam.id = flags.related;
      } else if (flags.search || cleanPrompt) {
        actionType = "sounds";
        queryParam.query = flags.search || cleanPrompt;
      } else if (flags.trending) {
        actionType = "trending";
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
      const soundList = res?.results || res?.data || [];
      if (!soundList.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan suara untuk: *"${queryParam.query || actionType}"*`);
      }
      const totalCount = res?.count || soundList.length;
      const soundRows = soundList.slice(0, 15).map(s => {
        const title = s.name || `Sound #${s.id}`;
        return {
          title: title.slice(0, 24),
          description: `Kategori: ${s.category_name || "Meme"} • 👁️ ${formatNumber(s.views)}`,
          id: `${prefix}soundboard --id ${s.id}`
        };
      });
      const navRows = [{
        title: "🔥 Trending Sounds",
        description: "Daftar sound yang sedang populer",
        id: `${prefix}soundboard --trending`
      }, {
        title: "🆕 Suara Baru",
        description: "Soundboard rilis terbaru",
        id: `${prefix}soundboard --new`
      }, {
        title: "📂 Daftar Kategori",
        description: "Jelajahi seluruh kategori",
        id: `${prefix}soundboard --categories`
      }];
      const sections = [{
        title: `🔊 DAFTAR SOUND (Hal ${page})`,
        rows: soundRows
      }, {
        title: "📂 MENU KATEGORI",
        rows: navRows
      }];
      const filterTitle = queryParam.query ? `Cari: "${queryParam.query}"` : `Kategori: ${actionType.toUpperCase()}`;
      const bodyText = `🔊 *SOUNDBOARD EXPLORER*\n\n` + `• *Filter:* ${filterTitle}\n` + `• *Total Suara:* ${formatNumber(totalCount)}\n` + `• *Halaman:* ${page}\n\n` + `_Pilih suara pada list di bawah untuk memutar audio!_`;
      const footerText = `${botName} • Soundboard Cloud`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🔊 Pilih & Putar (${soundRows.length})`,
          sections: sections
        })
      }];
      let baseCmd = `${prefix}soundboard`;
      if (actionType === "sounds") baseCmd += ` --search "${queryParam.query}"`;
      else if (actionType === "category") baseCmd += ` --category ${queryParam.id}`;
      else if (actionType === "related") baseCmd += ` --related ${queryParam.id}`;
      else if (actionType === "new_sounds") baseCmd += ` --new`;
      else baseCmd += ` --trending`;
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${baseCmd} --page ${page - 1}`
          })
        });
      }
      if (res?.next || soundList.length >= 10) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${baseCmd} --page ${page + 1}`
          })
        });
      }
      const options = {
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        let fallback = `🔊 *DAFTAR SOUNDBOARD*\n\n`;
        fallback += soundRows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
        await ctx.reply(fallback);
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        errMsg = error.response.data?.error || error.response.data?.message || errMsg;
      }
      ctx.reply(`❌ Soundboard Error: ${errMsg}`);
    }
  }
};