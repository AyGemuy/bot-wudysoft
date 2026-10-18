import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/nsfw/xhopen`;

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["url", "link", "id", "slug", "get", "play"].includes(lowerKey)) key = "url";
    if (["search", "q", "find", "s", "query", "keyword"].includes(lowerKey)) key = "search";
    if (["home", "feed", "latest"].includes(lowerKey)) key = "home";
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
  name: "xhopen",
  aliases: ["xh", "xhamster", "xhopendl"],
  description: "Cari dan unduh video XHOpen (CTA Media List & Bottom Sheet)",
  category: "NSFW",
  limit: true,
  example: "xhopen coco atau xhopen --home atau xhopen --url <video_url/slug>",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["xhopen", "xh", "xhamster", "xhopendl"].some(alias => firstWord.endsWith(alias))) {
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
      const sendVideoResult = async detail => {
        const videoUrl = detail.video_src || detail.hls_stream || detail.url;
        const isDirectMp4 = detail.video_src && detail.video_src.startsWith("http") && !detail.video_src.includes(".m3u8");
        const title = detail.title || "XHOpen Video";
        const duration = detail.duration || "N/A";
        const views = detail.views || "-";
        const uploader = detail.uploader?.name || "Community";
        const resolution = detail.max_resolution || "HD";
        const stars = Array.isArray(detail.pornstars) && detail.pornstars.length ? detail.pornstars.map(p => p.name).join(", ") : "-";
        const tags = Array.isArray(detail.tags) && detail.tags.length ? detail.tags.slice(0, 6).map(t => `#${t.name}`).join(" ") : "-";
        const image = detail.poster || null;
        const caption = `🔞 *XHOPEN VIDEO DETAIL*\n\n` + `• *Judul:* ${title}\n` + `• *Artis:* ${stars}\n` + `• *Uploader:* ${uploader}\n` + `• *Durasi:* ${duration} (${resolution})\n` + `• *Dilihat:* ${views} kali\n` + `• *Tags:* ${tags}\n\n` + `🔗 *Tautan:* ${detail.url}\n\n` + `_Mengirim video..._`;
        if (isDirectMp4) {
          try {
            const {
              data: videoBuffer
            } = await axios.get(videoUrl, {
              responseType: "arraybuffer",
              timeout: 6e4,
              maxContentLength: 80 * 1024 * 1024
            });
            await sock.sendMessage(ctx.id, {
              video: Buffer.from(videoBuffer),
              caption: caption,
              mimetype: "video/mp4"
            }, {
              quoted: quotedMsg
            });
            await ctx.react("✅");
            return;
          } catch (mediaErr) {}
        }
        const fallbackText = caption + (isDirectMp4 ? `\n⚠️ _Peringatan: Server kehabisan memori/disk (ENOSPC). Video dapat langsung diputar/diunduh via tombol di bawah._` : `\n💡 _Video berformat HLS Stream. Silakan tonton online langsung via tombol di bawah._`);
        const buttons = [{
          name: "cta_url",
          display_text: "▶️ Tonton Streaming Online",
          url: detail.url
        }];
        if (detail.video_src && detail.video_src.startsWith("http")) {
          buttons.push({
            name: "cta_url",
            display_text: "📥 Direct Video Link",
            url: detail.video_src
          });
        }
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(fallbackText, `${botName} • XHOpen Player`, buttons, {
            image: image || undefined,
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 1,
                divider_indices: [1],
                list_title: `${botName} • XHOpen Video`,
                button_title: "Putar Video"
              }
            },
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(fallbackText, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✅");
      };
      const targetUrl = flags.url || (cleanPrompt.startsWith("http") || cleanPrompt.startsWith("videos/") ? cleanPrompt : null);
      if (targetUrl) {
        await ctx.react("⏳");
        const {
          data: res
        } = await axios.post(API_URL, {
          action: "detail",
          url: targetUrl
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 4e4
        });
        if (!res || res.status === false || !res.title) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat data video XHOpen. Pastikan URL atau slug video valid.");
        }
        return await sendVideoResult(res);
      }
      const searchQuery = flags.search || cleanPrompt;
      if (!searchQuery && !flags.home) {
        return ctx.reply(`🔞 *XHOPEN SEARCH & STREAM*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Cari video: \`${prefix}xhopen coco\`\n` + `  👉 Beranda terbaru: \`${prefix}xhopen --home\`\n` + `  👉 Buka via URL/Slug: \`${prefix}xhopen --url <url_atau_slug>\`\n\n` + `• *Opsi Flags:*\n` + `  • \`--page <nomor>\` (Navigasi halaman, default: \`1\`)`);
      }
      await ctx.react("⏳");
      const page = Number(flags.page) || 1;
      let actionType = "home";
      let postPayload = {
        page: page
      };
      if (searchQuery) {
        actionType = "search";
        postPayload = {
          action: "search",
          keyword: searchQuery,
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
      const videoList = res?.items || [];
      if (!videoList.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan video XHOpen untuk: *"${searchQuery || "Home"}"*`);
      }
      const firstPoster = videoList[0]?.poster;
      const videoRows = videoList.slice(0, 15).map(v => {
        const title = v.title || "XHOpen Video";
        return {
          title: title.slice(0, 24),
          description: `Durasi: ${v.duration} • 👁️ ${v.views} (${v.quality || "HD"})`,
          id: `${prefix}xhopen --url ${v.slug || v.url}`
        };
      });
      const sections = [{
        title: `🔞 HASIL XHOPEN (Hal ${page})`,
        rows: videoRows
      }];
      const filterTitle = searchQuery ? `Cari: "${searchQuery}"` : "BERANDA XHOPEN";
      const totalResults = res?.total_results || videoList.length;
      const bodyText = `🔞 *XHOPEN EXPLORER*\n\n` + `• *Filter:* ${filterTitle}\n` + `• *Ditemukan:* ${totalResults} Video\n` + `• *Halaman:* ${page}\n\n` + `_Pilih video di bawah untuk membuka detail, streaming, atau mengunduh video!_`;
      const footerText = `${botName} • XHOpen Stream`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🔞 Pilih Video (${videoRows.length})`,
          sections: sections
        })
      }];
      let baseCmd = `${prefix}xhopen`;
      if (searchQuery) baseCmd += ` --search "${searchQuery}"`;
      else baseCmd += ` --home`;
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${baseCmd} --page ${page - 1}`
          })
        });
      }
      if (videoList.length >= 10) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${baseCmd} --page ${page + 1}`
          })
        });
      }
      const options = {
        image: firstPoster || undefined,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • XHOpen Search`,
            button_title: "Lihat Video"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        let fallback = `🔞 *DAFTAR VIDEO XHOPEN (${filterTitle})*\n\n`;
        fallback += videoRows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
        await ctx.reply(fallback);
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        errMsg = error.response.data?.error || error.response.data?.message || errMsg;
      }
      ctx.reply(`❌ XHOpen Error: ${errMsg}`);
    }
  }
};