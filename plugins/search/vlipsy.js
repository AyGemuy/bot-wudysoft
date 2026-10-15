import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/fun/vlipsy`;

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["url", "download", "detail", "d"].includes(lowerKey)) key = "url";
    if (["search", "q", "find", "s"].includes(lowerKey)) key = "search";
    if (["category", "type", "c"].includes(lowerKey)) key = "category";
    if (["page", "p"].includes(lowerKey)) key = "page";
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
  let urlFromPrompt = null;
  const urlMatch = cleanPrompt.match(/https?:\/\/vlipsy\.com\/clips\/[^\s]+/i);
  if (urlMatch) {
    urlFromPrompt = urlMatch[0];
  }
  return {
    flags: flags,
    cleanPrompt: cleanPrompt,
    urlFromPrompt: urlFromPrompt
  };
}
export default {
  name: "vlipsy",
  aliases: ["vlips", "memeclip", "shortmeme", "videomeme"],
  description: "Cari dan unduh video meme/klip pendek Vlipsy (CLI Flags & Pagination)",
  category: "Fun",
  limit: true,
  example: "vlipsy spongebob atau vlipsy --category memes --page 2 atau vlipsy --url <clip_url>",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["vlipsy", "vlips", "memeclip", "shortmeme", "videomeme"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt,
        urlFromPrompt
      } = parseFlags(rawText);
      const clipUrl = flags.url || urlFromPrompt;
      const categoryName = flags.category || null;
      const searchKeyword = flags.search || (!clipUrl && !categoryName && cleanPrompt ? cleanPrompt : null);
      const page = Number(flags.page) || 1;
      const limit = Number(flags.limit) || 20;
      if (clipUrl) {
        await ctx.react("⏳");
        const {
          data
        } = await axios.post(API_URL, {
          action: "detail",
          url: clipUrl
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 3e4
        });
        const clipDetail = data?.result;
        const videoUrl = clipDetail?.content_url || clipDetail?.contentUrl || clipDetail?.video_sources?.[0]?.src;
        if (!videoUrl) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengambil file video dari tautan tersebut.");
        }
        const captionText = `🎬 *VLIPSY MEME CLIP*\n\n` + `• *Judul:* ${clipDetail.headline || clipDetail.title || "Vlipsy Clip"}\n` + `• *Durasi:* ${clipDetail.duration || "-"} detik\n` + `• *Sumber:* ${clipDetail.about?.name || clipDetail.from || "-"}\n` + `• *Transkrip:* _"${clipDetail.transcript || "-"}"_\n\n` + `📝 *Deskripsi:*\n_${clipDetail.description || "Tidak ada deskripsi."}_`;
        await sock.sendMessage(ctx.id, {
          video: {
            url: videoUrl
          },
          caption: captionText,
          mimetype: "video/mp4"
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      if (!rawText && !searchKeyword && !categoryName) {
        return ctx.reply(`🎬 *VLIPSY MEME CLIPS & SHORT VIDEOS*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Cari klip meme: \`${prefix}vlipsy spongebob\`\n` + `  👉 Unduh klip spesifik: \`${prefix}vlipsy --url https://vlipsy.com/clips/...\`\n\n` + `• *Jelajahi Kategori / Trending (CTA UI):*\n` + `  👉 \`${prefix}vlipsy --category memes\` atau \`${prefix}vlipsy\`\n\n` + `• *Opsi Flag Kustomisasi:*\n` + `  • \`--search <query>\` (Cari berdasarkan kata kunci)\n` + `  • \`--category <nama>\` (Cari berdasarkan tipe kategori)\n` + `  • \`--url <link>\` (Unduh langsung video dari URL Vlipsy)\n` + `  • \`--page <nomor>\` (Navigasi halaman, default: \`1\`)\n` + `  • \`--limit <jumlah>\` (Batas jumlah hasil, default: \`20\`)`);
      }
      await ctx.react("⏳");
      const postPayload = {
        limit: limit
      };
      if (categoryName) {
        postPayload.action = "category";
        postPayload.type = categoryName;
      } else if (searchKeyword) {
        postPayload.action = "search";
        postPayload.query = searchKeyword;
      } else {
        postPayload.action = "home";
      }
      const {
        data
      } = await axios.post(API_URL, postPayload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      const clipList = data?.result?.data || [];
      const categoryList = data?.result?.categories || [];
      if (!clipList.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan klip video untuk: *"${searchKeyword || categoryName || "Home"}"*`);
      }
      const itemsPerPage = 10;
      const totalItems = clipList.length;
      const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
      let activePage = page;
      if (activePage < 1) activePage = 1;
      if (activePage > totalPages) activePage = totalPages;
      const startIndex = (activePage - 1) * itemsPerPage;
      const currentPageItems = clipList.slice(startIndex, startIndex + itemsPerPage);
      const topClip = clipList[0];
      const previewThumb = topClip.thumbnail || global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      const clipRows = currentPageItems.map(c => ({
        title: c.title.slice(0, 24),
        description: `Durasi: ${c.duration || 0}s • Klik untuk unduh`,
        id: `${prefix}vlipsy --url ${c.url}`
      }));
      const sections = [{
        title: categoryName ? `🎬 KATEGORI: ${categoryName.toUpperCase()} (Hal ${activePage}/${totalPages})` : searchKeyword ? `🔍 HASIL PENCARIAN (Hal ${activePage}/${totalPages})` : `🔥 TRENDING MEME CLIPS (Hal ${activePage}/${totalPages})`,
        rows: clipRows
      }];
      if (categoryList.length > 0) {
        const catRows = categoryList.slice(0, 5).map(cat => ({
          title: `📁 ${cat.name}`.slice(0, 24),
          description: `Jelajahi kategori ${cat.name}`,
          id: `${prefix}vlipsy --category ${cat.type}`
        }));
        sections.push({
          title: "📂 KATEGORI LAINNYA",
          rows: catRows
        });
      }
      const buttons = [{
        name: "single_select",
        title: `🎬 Pilih Video Meme (${currentPageItems.length})`,
        sections: sections
      }];
      const baseCmd = categoryName ? `${prefix}vlipsy --category "${categoryName}"` : searchKeyword ? `${prefix}vlipsy --search "${searchKeyword}"` : `${prefix}vlipsy`;
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
      const headerTitle = categoryName ? `Kategori: ${categoryName.toUpperCase()}` : searchKeyword ? `Search: ${searchKeyword}` : "Trending Clips";
      const bodyText = `🎬 *VLIPSY MEME CLIPS LIST*\n\n` + `• *Filter:* ${headerTitle}\n` + `• *Total Ditemukan:* ${totalItems} Klip (Halaman ${activePage}/${totalPages})\n\n` + `_Klik tombol di bawah untuk memilih dan mengunduh video meme!_`;
      const footerText = `${botName} • Vlipsy Meme Clips`;
      const options = {
        image: previewThumb,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Vlipsy Clips`,
            button_title: "Lihat Klip"
          },
          limited_time_offer: {
            text: `✦ ${botName} - Vlipsy AI ✦`,
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
        let fallbackMsg = `🎬 *DAFTAR KLIP MEME VLIPSY*\n\n`;
        fallbackMsg += currentPageItems.map(c => `• *${c.title}*\n  URL: ${c.url}`).join("\n\n");
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
      ctx.reply(`❌ Vlipsy Error: ${errorMessage}`);
    }
  }
};