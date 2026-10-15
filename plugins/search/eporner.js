import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/nsfw/eporner`;

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
  name: "eporner",
  aliases: ["ep", "epornerdl", "epornersearch"],
  description: "Cari dan download video Eporner HD (CTA Media List & Bottom Sheet)",
  category: "NSFW",
  limit: true,
  nsfw: true,
  example: "eporner cosplay atau eporner --url https://www.eporner.com/video-...",
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
        if (["eporner", "ep", "epornerdl", "epornersearch"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const sendVideoResult = async detail => {
        const downloads = Array.isArray(detail.download) ? detail.download : [];
        if (!downloads.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Tautan unduhan tidak ditemukan\n` + `└ ◦ *Info* : Berkas video tidak tersedia di server.\n\n` + `${footer}`);
        }
        const qualityPref = (flags.quality || "").toLowerCase();
        let targetDownload = null;
        if (qualityPref) {
          targetDownload = downloads.find(d => d.quality?.toLowerCase().includes(qualityPref));
        }
        if (!targetDownload) {
          targetDownload = downloads.find(d => d.quality?.includes("720p")) || downloads.find(d => d.quality?.includes("480p")) || downloads.find(d => d.quality?.includes("1080p")) || downloads[0];
        }
        const videoUrl = targetDownload?.url;
        const title = detail.title || "Eporner Video";
        const desc = detail.description && detail.description !== "Meta Description Not Found" ? detail.description : "-";
        const image = detail.thumbnail || null;
        const caption = `– *E P O R N E R*\n\n` + `┌ ◦ *Title* : ${title}\n` + `│ ◦ *Quality* : ${targetDownload?.quality || "HD"}\n` + `│ ◦ *Size* : ${targetDownload?.size || "N/A"}\n` + `│ ◦ *Description* : ${desc}\n` + `└ ◦ *Link* : ${flags.url || cleanPrompt}\n\n` + `${footer}`;
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
          const fallbackText = `– *E P O R N E R*\n\n` + `┌ ◦ *Title* : ${title}\n` + `│ ◦ *Quality* : ${targetDownload?.quality || "HD"}\n` + `│ ◦ *Status* : Pengiriman langsung gagal (Ukuran terlalu besar)\n` + `└ ◦ *Action* : Silakan unduh melalui tombol di bawah\n\n` + `${footer}`;
          const buttons = downloads.slice(0, 3).map(d => ({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: `Download (${d.quality} - ${d.size})`,
              url: d.url
            })
          }));
          if (typeof ctx.sendCta === "function") {
            await ctx.sendCta(fallbackText, `${botName} • Eporner Downloader`, buttons, {
              image: image || undefined,
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
        if (!res || res.status === false || res.error || !res.download?.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memuat data\n` + `└ ◦ *Info* : Pastikan tautan video Eporner valid.\n\n` + `${footer}`);
        }
        return await sendVideoResult(res);
      }
      const searchQuery = flags.search || cleanPrompt;
      if (!searchQuery) {
        const helpText = `– *E P O R N E R*\n\n` + `┌ ◦ *Usage* : ${prefix}eporner <query / url>\n` + `│ ◦ *Quality* : ${prefix}eporner <url> --quality 720p\n` + `└ ◦ *Function* : Pencarian & pengunduh video Eporner HD\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Search* : ${prefix}eporner cosplay\n` + `└ ◦ *URL* : ${prefix}eporner --url https://www.eporner.com/video-...\n\n` + `${footer}`;
        return ctx.reply(helpText);
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
      if (!videoList.length || videoList.status === false || videoList.error) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Video tidak ditemukan\n` + `└ ◦ *Query* : "${searchQuery}"\n\n` + `${footer}`);
      }
      const firstThumbnail = videoList[0]?.thumbnail;
      const videoRows = videoList.slice(0, 15).map(v => {
        const title = v.title || "Eporner Video";
        return {
          title: title.slice(0, 24),
          description: `${v.quality || "HD"} • Durasi: ${v.duration || "-"}`,
          id: `${prefix}eporner --url ${v.url}`
        };
      });
      const sections = [{
        title: "HASIL PENCARIAN EPORNER",
        rows: videoRows
      }];
      const bodyText = `– *E P O R N E R  -  S E A R C H*\n\n` + `┌ ◦ *Query* : "${searchQuery}"\n` + `└ ◦ *Total* : ${videoList.length} Video\n\n` + `_Pilih video pada tombol di bawah untuk mengunduh:_\n\n` + `${footer}`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "PILIH VIDEO",
          sections: sections
        })
      }];
      const options = {
        image: firstThumbnail || undefined,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Eporner Search`,
            button_title: "Lihat Video"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • Eporner`, buttons, options);
      } else {
        let fallback = `${bodyText}\n\n`;
        fallback += videoRows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
        await ctx.reply(fallback);
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Eporner Error]:", error);
      await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        errMsg = error.response.data?.error || error.response.data?.message || errMsg;
      }
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "eporner"}\n\n` + `${footer}`);
    }
  }
};