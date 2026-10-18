import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/nsfw/ok-xxx`;

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
    if (["popular", "pop", "p"].includes(lowerKey)) key = "popular";
    if (["trending", "t"].includes(lowerKey)) key = "trending";
    if (["home", "feed", "latest"].includes(lowerKey)) key = "home";
    if (["model", "models"].includes(lowerKey)) key = "models";
    if (["channel", "channels"].includes(lowerKey)) key = "channels";
    if (["tag", "tags"].includes(lowerKey)) key = "tags";
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
  name: "okxxx",
  aliases: ["okx", "okvideodl", "okxxxdl"],
  description: "Cari dan tonton video OK.XXX (CTA Media List & Bottom Sheet)",
  category: "NSFW",
  limit: true,
  example: "okxxx japanese atau okxxx --popular atau okxxx --url 776554",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["okxxx", "okx", "okvideodl", "okxxxdl"].some(alias => firstWord.endsWith(alias))) {
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
        const sources = detail.media?.sources || [];
        const primarySource = sources.find(s => s.url && s.url.includes(".mp4")) || sources[0];
        const videoUrl = primarySource?.url || detail.media?.hls;
        const isDirectMp4 = videoUrl && videoUrl.startsWith("http") && !videoUrl.includes(".m3u8");
        const title = detail.title || "OK.XXX Video";
        const duration = detail.duration || "N/A";
        const views = detail.views || "-";
        const uploadDate = detail.upload_date || "-";
        const models = Array.isArray(detail.models) && detail.models.length ? detail.models.map(m => m.name).join(", ") : "-";
        const channels = Array.isArray(detail.channels) && detail.channels.length ? detail.channels.map(c => c.name).join(", ") : "-";
        const tags = Array.isArray(detail.tags) && detail.tags.length ? detail.tags.slice(0, 6).map(t => `#${t.name}`).join(" ") : "-";
        const image = detail.poster || null;
        const caption = `🔞 *OK.XXX VIDEO DETAIL*\n\n` + `• *Judul:* ${title}\n` + `• *Model:* ${models}\n` + `• *Channel:* ${channels}\n` + `• *Durasi:* ${duration}\n` + `• *Dilihat:* ${views}\n` + `• *Upload:* ${uploadDate}\n` + `• *Tags:* ${tags}\n\n` + `🔗 *Tautan:* https://ok.xxx/video/${detail.slug || detail.id}/\n\n` + `_Mengirim video..._`;
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
        const fallbackText = caption + (isDirectMp4 ? `\n⚠️ _Peringatan: Server kehabisan ruang disk (ENOSPC). Video dapat diputar/diunduh langsung via tombol di bawah._` : `\n💡 _Video berformat HLS Stream. Silakan tonton online langsung via tombol di bawah._`);
        const buttons = [{
          name: "cta_url",
          display_text: "▶️ Tonton Streaming Online",
          url: `https://ok.xxx/video/${detail.slug || detail.id}/`
        }];
        if (videoUrl && videoUrl.startsWith("http")) {
          buttons.push({
            name: "cta_url",
            display_text: "📥 Direct Video Link",
            url: videoUrl
          });
        }
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(fallbackText, `${botName} • OK.XXX Player`, buttons, {
            image: image || undefined,
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 1,
                divider_indices: [1],
                list_title: `${botName} • OK.XXX Video`,
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
      const targetUrl = flags.url || (/^\d+$/.test(cleanPrompt) || cleanPrompt.startsWith("http") ? cleanPrompt : null);
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
          return ctx.reply("❌ Gagal memuat data video OK.XXX. Pastikan URL atau ID video valid.");
        }
        return await sendVideoResult(res);
      }
      const searchQuery = flags.search || cleanPrompt;
      if (!searchQuery && !flags.popular && !flags.trending && !flags.home) {
        return ctx.reply(`🔞 *OK.XXX SEARCH & STREAM*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Cari video: \`${prefix}okxxx japanese\`\n` + `  👉 Video populer: \`${prefix}okxxx --popular\`\n` + `  👉 Video trending: \`${prefix}okxxx --trending\`\n` + `  👉 Buka via URL/ID: \`${prefix}okxxx --url 776554\`\n\n` + `• *Opsi Flags:*\n` + `  • \`--page <nomor>\` (Navigasi halaman, default: \`1\`)`);
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
      } else if (flags.popular) {
        actionType = "popular";
        postPayload = {
          action: "popular",
          page: page
        };
      } else if (flags.trending) {
        actionType = "trending";
        postPayload = {
          action: "trending",
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
        return ctx.reply(`❌ Tidak ditemukan video OK.XXX untuk: *"${searchQuery || actionType}"*`);
      }
      const firstPoster = videoList[0]?.poster;
      const videoRows = videoList.slice(0, 15).map(v => {
        const title = v.title || "OK.XXX Video";
        return {
          title: title.slice(0, 24),
          description: `Durasi: ${v.duration} • 👁️ ${v.views}`,
          id: `${prefix}okxxx --url ${v.id || v.slug}`
        };
      });
      const navRows = [{
        title: "🔥 Video Terpopuler",
        description: "Koleksi video paling banyak dilihat",
        id: `${prefix}okxxx --popular`
      }, {
        title: "📈 Video Trending",
        description: "Video yang sedang hits minggu ini",
        id: `${prefix}okxxx --trending`
      }, {
        title: "🆕 Video Terbaru",
        description: "Video rilis paling baru di OK.XXX",
        id: `${prefix}okxxx --home`
      }];
      const sections = [{
        title: `🔞 DAFTAR VIDEO (Hal ${page})`,
        rows: videoRows
      }, {
        title: "📂 KATEGORI CEPAT",
        rows: navRows
      }];
      const filterTitle = searchQuery ? `Cari: "${searchQuery}"` : actionType.toUpperCase();
      const bodyText = `🔞 *OK.XXX VIDEO EXPLORER*\n\n` + `• *Filter:* ${filterTitle}\n` + `• *Ditemukan:* ${videoList.length} Video\n` + `• *Halaman:* ${page}\n\n` + `_Pilih video di bawah untuk membuka detail, streaming, atau mengunduh video!_`;
      const footerText = `${botName} • OK.XXX Clips`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🔞 Pilih Video (${videoRows.length})`,
          sections: sections
        })
      }];
      let baseCmd = `${prefix}okxxx`;
      if (searchQuery) baseCmd += ` --search "${searchQuery}"`;
      else if (flags.popular) baseCmd += ` --popular`;
      else if (flags.trending) baseCmd += ` --trending`;
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
      if (videoList.length >= 10 || res?.pagination?.next) {
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
            list_title: `${botName} • OK.XXX Search`,
            button_title: "Lihat Video"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        let fallback = `🔞 *DAFTAR VIDEO OK.XXX (${filterTitle})*\n\n`;
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
      ctx.reply(`❌ OK.XXX Error: ${errMsg}`);
    }
  }
};