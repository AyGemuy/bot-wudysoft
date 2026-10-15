import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/nsfw/xnxx`;

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
  name: "xnxx",
  aliases: ["xnxxdl", "xnxxsearch", "xn"],
  description: "Cari dan download video XNXX (CTA Media List & Bottom Sheet)",
  category: "NSFW",
  limit: true,
  example: "xnxx jepang atau xnxx --url https://www.xnxx.com/video-...",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["xnxx", "xnxxdl", "xnxxsearch", "xn"].some(alias => firstWord.endsWith(alias))) {
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
        const files = detail.files || {};
        const qualityPref = (flags.quality || "").toLowerCase();
        let videoUrl = files.high || files.low || files.hls;
        if (qualityPref === "low" && files.low) videoUrl = files.low;
        if (qualityPref === "high" && files.high) videoUrl = files.high;
        if (!videoUrl) {
          await ctx.react("❌");
          return ctx.reply("❌ File video MP4 tidak ditemukan atau telah dihapus.");
        }
        const title = detail.title || "XNXX Video";
        const duration = detail.duration || "N/A";
        const image = detail.image || files.thumb || files.thumb_69;
        const info = detail.info || "-";
        const caption = `🔞 *XNXX VIDEO DOWNLOADER*\n\n` + `• *Judul:* ${title}\n` + `• *Durasi:* ${duration}\n` + `• *Info:* ${info}\n\n` + `🔗 *Tautan Halaman:*\n${detail.url}\n\n` + `_Mengirim video..._`;
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
          if (files.high && files.low) {
            buttons.push({
              name: "cta_url",
              display_text: "📥 Kualitas Rendah (Low SD)",
              url: files.low
            });
          }
          if (typeof ctx.sendCta === "function") {
            await ctx.sendCta(fallbackText, `${botName} • XNXX Player`, buttons, {
              image: image || undefined,
              params: {
                bottom_sheet: {
                  in_thread_buttons_limit: 1,
                  divider_indices: [1],
                  list_title: `${botName} • XNXX Downloader`,
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
        if (!res || !res.files) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat data video XNXX. Pastikan URL video valid.");
        }
        return await sendVideoResult(res);
      }
      const searchQuery = flags.search || cleanPrompt;
      if (!searchQuery) {
        return ctx.reply(`🔞 *XNXX SEARCH & DOWNLOADER*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Cari video: \`${prefix}xnxx jepang\`\n` + `  👉 Unduh via URL: \`${prefix}xnxx --url https://www.xnxx.com/video-...\`\n\n` + `• *Opsi Flags:*\n` + `  • \`--quality <high/low>\` (Pilihan kualitas video)`);
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
      const videoList = Array.isArray(searchResults) ? searchResults : searchResults?.result || [];
      if (!videoList.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan video XNXX untuk: *"${searchQuery}"*`);
      }
      const firstThumbnail = videoList[0]?.thumbnail;
      const videoRows = videoList.slice(0, 15).map(v => {
        const title = v.title || "XNXX Video";
        return {
          title: title.slice(0, 24),
          description: `Durasi: ${v.duration} • 👁️ ${v.views} (Unduh Video)`,
          id: `${prefix}xnxx --url ${v.link}`
        };
      });
      const sections = [{
        title: `🔞 HASIL PENCARIAN XNXX`,
        rows: videoRows
      }];
      const bodyText = `🔞 *XNXX SEARCH EXPLORER*\n\n` + `• *Kata Kunci:* "${searchQuery}"\n` + `• *Ditemukan:* ${videoList.length} Video\n\n` + `_Pilih video di bawah untuk langsung mengunduh atau menonton video!_`;
      const footerText = `${botName} • XNXX Downloader`;
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
            list_title: `${botName} • XNXX Search`,
            button_title: "Lihat Video"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        let fallback = `🔞 *DAFTAR VIDEO XNXX*\n\n`;
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
      ctx.reply(`❌ XNXX Error: ${errMsg}`);
    }
  }
};