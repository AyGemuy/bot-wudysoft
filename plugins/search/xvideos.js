import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/nsfw/xvideos`;

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["url", "link", "id", "get", "play"].includes(lowerKey)) key = "url";
    if (["search", "q", "find", "s", "query"].includes(lowerKey)) key = "search";
    if (["quality", "res", "qual"].includes(lowerKey)) key = "quality";
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
  name: "xvideos",
  aliases: ["xv", "xvideodl", "xvideosearch"],
  description: "Cari dan unduh video XVideos (CTA Media List & Bottom Sheet)",
  category: "NSFW",
  limit: true,
  example: "xvideos japanese atau xvideos --url https://www.xvideos.com/video...",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["xvideos", "xv", "xvideodl", "xvideosearch"].some(alias => firstWord.endsWith(alias))) {
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
        const qualityPref = (flags.quality || "").toLowerCase();
        let videoUrl = detail.high || detail.low || detail.hls;
        if (qualityPref === "low" && detail.low) videoUrl = detail.low;
        if (qualityPref === "high" && detail.high) videoUrl = detail.high;
        if (!videoUrl) {
          await ctx.react("❌");
          return ctx.reply("❌ File video MP4 tidak ditemukan atau telah dihapus.");
        }
        const title = detail.title || "Xvideos Video";
        const duration = detail.duration || "N/A";
        const uploader = detail.uploader?.name || "Unknown";
        const tags = Array.isArray(detail.tags) && detail.tags.length ? detail.tags.slice(0, 5).map(t => `#${t}`).join(" ") : "-";
        const image = detail.thumb || null;
        const caption = `🔞 *XVIDEOS DOWNLOADER*\n\n` + `• *Judul:* ${title}\n` + `• *Uploader:* ${uploader}\n` + `• *Durasi:* ${duration}\n` + `• *Tags:* ${tags}\n\n` + `🔗 *Tautan:* ${flags.url || cleanPrompt}\n\n` + `_Mengirim video..._`;
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
        } catch (mediaErr) {
          const fallbackText = caption + `\n⚠️ _Peringatan: Ruang penyimpanan disk server bot sedang penuh (ENOSPC). Video dapat diputar/diunduh langsung melalui tombol di bawah._`;
          const buttons = [{
            name: "cta_url",
            display_text: "▶️ Tonton / Download Video",
            url: videoUrl
          }];
          if (detail.high && detail.low) {
            buttons.push({
              name: "cta_url",
              display_text: "📥 Kualitas Rendah (Low SD)",
              url: detail.low
            });
          }
          if (typeof ctx.sendCta === "function") {
            await ctx.sendCta(fallbackText, `${botName} • XVideos Player`, buttons, {
              image: image || undefined,
              params: {
                bottom_sheet: {
                  in_thread_buttons_limit: 1,
                  divider_indices: [1],
                  list_title: `${botName} • XVideos Downloader`,
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
          await ctx.react("⚠️");
          return;
        }
      };
      const targetUrl = flags.url || (cleanPrompt.startsWith("http") ? cleanPrompt : null);
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
        if (!res || res.error || !res.high && !res.low && !res.hls) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat data video XVideos. Pastikan tautan video valid.");
        }
        return await sendVideoResult(res);
      }
      const searchQuery = flags.search || cleanPrompt;
      if (!searchQuery) {
        return ctx.reply(`🔞 *XVIDEOS SEARCH & DOWNLOADER*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Cari video: \`${prefix}xvideos cosplay\`\n` + `  👉 Unduh via URL: \`${prefix}xvideos --url https://www.xvideos.com/video...\`\n\n` + `• *Opsi Flags:*\n` + `  • \`--quality <high/low>\` (Pilihan resolusi unduh)`);
      }
      await ctx.react("⏳");
      const {
        data: searchResults
      } = await axios.post(API_URL, {
        action: "search",
        query: searchQuery
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 4e4
      });
      const videoList = searchResults?.data || (Array.isArray(searchResults) ? searchResults : []);
      if (!videoList.length || videoList[0]?.error) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan video XVideos untuk: *"${searchQuery}"*`);
      }
      const firstThumbnail = videoList[0]?.thumb;
      const videoRows = videoList.slice(0, 15).map(v => {
        const title = v.title || "XVideos Clip";
        return {
          title: title.slice(0, 24),
          description: `Durasi: ${v.duration} (Unduh Video)`,
          id: `${prefix}xvideos --url ${v.url}`
        };
      });
      const sections = [{
        title: `🔞 HASIL PENCARIAN XVIDEOS`,
        rows: videoRows
      }];
      const bodyText = `🔞 *XVIDEOS SEARCH EXPLORER*\n\n` + `• *Kata Kunci:* "${searchQuery}"\n` + `• *Ditemukan:* ${videoList.length} Video\n\n` + `_Pilih video di bawah untuk langsung memutar atau mengunduh video!_`;
      const footerText = `${botName} • XVideos Downloader`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🔞 Pilih Video (${videoRows.length})`,
          sections: sections
        })
      }];
      const options = {
        image: firstThumbnail || undefined,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • XVideos Search`,
            button_title: "Lihat Video"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        let fallback = `🔞 *DAFTAR VIDEO XVIDEOS*\n\n`;
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
      ctx.reply(`❌ XVideos Error: ${errMsg}`);
    }
  }
};