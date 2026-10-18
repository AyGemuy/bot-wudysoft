import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/sound/soundinstants`;
const formatNumber = num => typeof num === "number" ? num.toLocaleString("id-ID") : num || "0";
const formatSize = bytes => {
  if (!bytes || bytes === 0) return "-";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

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
    if (["search", "q", "find", "s"].includes(lowerKey)) key = "search";
    if (["trending", "t"].includes(lowerKey)) key = "trending";
    if (["popular"].includes(lowerKey)) key = "popular";
    if (["editor", "e"].includes(lowerKey)) key = "editor";
    if (["new", "added", "n"].includes(lowerKey)) key = "new";
    if (["page", "pg"].includes(lowerKey)) key = "page";
    if (["limit", "l"].includes(lowerKey)) key = "limit";
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
  name: "soundinstants",
  aliases: ["soundboard", "sound", "sb", "instants", "memesound", "soundeffect", "sfx"],
  description: "Cari dan putar efek suara/meme instan SoundInstants (CLI Flags & Pagination)",
  category: "Fun",
  limit: true,
  example: "soundinstants bruh atau soundinstants --trending atau soundinstants --id <sound_id>",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["soundinstants", "soundboard", "sound", "sb", "instants", "memesound", "soundeffect", "sfx"].some(alias => firstWord.endsWith(alias))) {
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
      let actionType = "trending";
      if (flags.popular) actionType = "popular";
      else if (flags.editor) actionType = "editor_choice";
      else if (flags.new) actionType = "just_added";
      else if (flags.search || cleanPrompt) actionType = "search";
      const soundId = flags.id || null;
      const searchQuery = flags.search || (actionType === "search" ? cleanPrompt : "");
      const page = Number(flags.page) || 1;
      const limit = Number(flags.limit) || 20;
      if (soundId) {
        await ctx.react("⏳");
        const {
          data: res
        } = await axios.post(API_URL, {
          action: "detail",
          id: soundId
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 3e4
        });
        const sound = res?.data?.sound || res?.data || res?.result?.sound || res?.result;
        if (!sound || !sound.sound_url) {
          await ctx.react("❌");
          return ctx.reply("❌ Detail suara tidak ditemukan atau file audio tidak tersedia.");
        }
        const title = sound.title || sound.id || "Sound Effect";
        const category = sound.category?.name || "Sound Effects";
        const duration = sound.info?.length ? `${(sound.info.length / 1e3).toFixed(1)} detik` : "-";
        const size = formatSize(sound.info?.size);
        const views = formatNumber(sound.views_count);
        const likes = formatNumber(sound.likes_count);
        const tags = Array.isArray(sound.tags) && sound.tags.length ? sound.tags.slice(0, 5).join(", ") : "-";
        const desc = sound.description || sound.article?.description || "Tidak ada deskripsi.";
        const protip = sound.article?.protip ? `\n\n💡 *Pro Tip:*\n_${sound.article.protip}_` : "";
        const detailCaption = `🔊 *SOUNDINSTANTS DETAIL*\n\n` + `• *Judul:* ${title}\n` + `• *Kategori:* ${category}\n` + `• *Durasi:* ${duration}\n` + `• *Ukuran:* ${size}\n` + `• *Dilihat:* ${views} kali\n` + `• *Disukai:* ${likes} orang\n` + `• *Tags:* ${tags}\n\n` + `📝 *Deskripsi:*\n_${desc}_${protip}`;
        await sock.sendMessage(ctx.id, {
          text: detailCaption
        }, {
          quoted: quotedMsg
        });
        await sock.sendMessage(ctx.id, {
          audio: {
            url: sound.sound_url
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
      if (!rawText && !soundId && !flags.trending && !flags.popular && !flags.editor && !flags.new) {
        return ctx.reply(`🔊 *SOUNDINSTANTS MEME & EFEK SUARA*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Cari efek suara: \`${prefix}soundinstants bruh\`\n` + `  👉 Putar suara spesifik: \`${prefix}soundinstants --id <sound_id>\`\n\n` + `• *Kategori & Trending (CTA UI):*\n` + `  👉 \`${prefix}soundinstants --trending\`\n` + `  👉 \`${prefix}soundinstants --popular\`\n` + `  👉 \`${prefix}soundinstants --editor\`\n` + `  👉 \`${prefix}soundinstants --new\`\n\n` + `• *Opsi Flag Kustomisasi:*\n` + `  • \`--search <query>\` (Cari berdasarkan kata kunci)\n` + `  • \`--id <sound_id>\` (Detail & putar audio langsung)\n` + `  • \`--page <nomor>\` (Navigasi halaman, default: \`1\`)\n` + `  • \`--limit <jumlah>\` (Batas jumlah hasil, default: \`20\`)`);
      }
      await ctx.react("⏳");
      const postPayload = {
        action: actionType,
        page: 1,
        limit: limit,
        ...actionType === "search" && {
          query: searchQuery
        }
      };
      const {
        data
      } = await axios.post(API_URL, postPayload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      const soundList = data?.data || data?.results || data?.result || [];
      if (!soundList.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan efek suara untuk: *"${searchQuery || actionType}"*`);
      }
      const itemsPerPage = 10;
      const totalItems = soundList.length;
      const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
      let activePage = page;
      if (activePage < 1) activePage = 1;
      if (activePage > totalPages) activePage = totalPages;
      const startIndex = (activePage - 1) * itemsPerPage;
      const currentPageItems = soundList.slice(startIndex, startIndex + itemsPerPage);
      const soundRows = currentPageItems.map(s => {
        const title = s.title || s.name || s.id || "Sound Effect";
        const id = s.id || s.slug;
        return {
          title: title.slice(0, 24),
          description: `Kategori: ${s.category?.name || "Meme"} • Putar Sound`,
          id: `${prefix}soundinstants --id ${id}`
        };
      });
      const categoryRows = [{
        title: "🔥 Trending Sounds",
        description: "Sound effect yang sedang populer",
        id: `${prefix}soundinstants --trending`
      }, {
        title: "⭐ Populer Sepanjang Masa",
        description: "Paling banyak diputar user",
        id: `${prefix}soundinstants --popular`
      }, {
        title: "✨ Pilihan Editor",
        description: "Efek suara rekomendasi editor",
        id: `${prefix}soundinstants --editor`
      }, {
        title: "🆕 Baru Ditambahkan",
        description: "Sound effect rilis terbaru",
        id: `${prefix}soundinstants --new`
      }];
      const sections = [{
        title: `🔊 DAFTAR SUARA (Hal ${activePage}/${totalPages})`,
        rows: soundRows
      }, {
        title: "📂 KATEGORI LAINNYA",
        rows: categoryRows
      }];
      const headerTitle = actionType === "search" ? `Search: "${searchQuery}"` : `Kategori: ${actionType.toUpperCase()}`;
      const previewThumb = global.bot?.media?.banner1 || global.bot?.media?.icon1 || "https://files.catbox.moe/xlwh4j.jpg";
      const bodyText = `🔊 *SOUNDINSTANTS*\n\n` + `• *Filter:* ${headerTitle}\n` + `• *Total Ditemukan:* ${totalItems} Suara (Halaman ${activePage}/${totalPages})\n\n` + `_Pilih suara pada menu di bawah untuk memutar audio!_`;
      const footerText = `${botName} • SoundInstants Memes`;
      const buttons = [{
        name: "single_select",
        title: `🔊 Pilih & Putar Suara (${currentPageItems.length})`,
        sections: sections
      }];
      const baseCmd = actionType === "search" ? `${prefix}soundinstants --search "${searchQuery}"` : `${prefix}soundinstants --${actionType.replace("_choice", "").replace("just_added", "new")}`;
      if (activePage > 1) {
        buttons.push({
          name: "quick_reply",
          display_text: `⬅️ Hal ${activePage - 1}`,
          id: `${baseCmd} --page ${activePage - 1}`
        });
      }
      if (activePage < totalPages) {
        buttons.push({
          name: "quick_reply",
          display_text: `➡️ Hal ${activePage + 1}`,
          id: `${baseCmd} --page ${activePage + 1}`
        });
      }
      const options = {
        image: previewThumb,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • SoundInstants`,
            button_title: "Lihat Suara"
          },
          limited_time_offer: {
            text: `✦ ${botName} - SoundInstants ✦`,
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
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        let fallbackMsg = `🔊 *DAFTAR EFEK SUARA (${headerTitle})*\n\n`;
        fallbackMsg += currentPageItems.map(s => `• *${s.title}*\n  ID: \`${s.id || s.slug}\``).join("\n\n");
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
      ctx.reply(`❌ SoundInstants Error: ${errorMessage}`);
    }
  }
};