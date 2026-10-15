import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/search/douyin`,
  TIMEOUT: 4e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
};

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      audio: ["a", "mp3", "sound", "music", "musik"],
      index: ["i", "idx", "num"],
      list: ["l", "daftar"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
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
async function callDouyinApi(query) {
  const res = await axios.get(CONFIG.API_URL, {
    params: {
      query: query
    },
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return res?.data;
}
export default {
  name: "douyin",
  aliases: ["douyindl", "douyintiktok", "tiktokchina", "dy"],
  description: "Cari dan download video Douyin (TikTok China) HD no watermark & musik",
  category: "Downloader",
  limit: true,
  example: "douyin cosplay\n" + "douyin jedag jedug --audio\n" + "douyin anime dance -i 2\n" + "Reply chat dengan .douyin",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["douyin", "douyindl", "douyintiktok", "tiktokchina", "dy"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const quotedText = (ctx.quoted?.text || ctx.quoted?.caption || ctx.quoted?.body || ctx.quoted?.message?.conversation || ctx.quoted?.message?.extendedTextMessage?.text || ctx.quotedText || "").trim();
      const {
        flags,
        cleanPrompt: initialPrompt
      } = parseFlags(rawText);
      const query = initialPrompt || quotedText;
      if (!query) {
        const helpText = `– *D O U Y I N*\n\n` + `┌ ◦ *Usage* : ${prefix}douyin <query>\n` + `│ ◦ *Audio* : ${prefix}douyin <query> --audio\n` + `└ ◦ *Function* : Mengunduh video & musik Douyin (TikTok China)\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Video* : ${prefix}douyin cosplay\n` + `│ ◦ *Music* : ${prefix}douyin jedag jedug --audio\n` + `└ ◦ *Index* : ${prefix}douyin anime dance -i 2\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const data = await callDouyinApi(query);
      const items = Array.isArray(data) ? data : data?.result || [];
      const validVideos = items.map(item => item.data?.aweme_info || item.aweme_info || item).filter(v => v && (v.video?.play_addr?.url_list?.length || v.video?.bit_rate?.length));
      if (!validVideos.length) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Video tidak ditemukan\n` + `└ ◦ *Query* : "${query}"\n\n` + `${footer}`);
      }
      let selectedIdx = 0;
      if (flags.index !== undefined) {
        const parsedIdx = Number(flags.index) - 1;
        if (parsedIdx >= 0 && parsedIdx < validVideos.length) {
          selectedIdx = parsedIdx;
        }
      }
      const aweme = validVideos[selectedIdx];
      const videoUrlList = aweme.video?.play_addr?.url_list || aweme.video?.bit_rate?.[0]?.play_addr?.url_list || [];
      const videoUrl = videoUrlList.find(u => u.startsWith("http")) || videoUrlList[0];
      if (!videoUrl) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : URL streaming tidak ditemukan\n` + `└ ◦ *Info* : Gagal memperoleh tautan pemutar video.\n\n` + `${footer}`);
      }
      const authorName = aweme.author?.nickname || aweme.author?.unique_id || "Kreator Douyin";
      const desc = aweme.desc || aweme.caption || "Tanpa Deskripsi";
      const likes = aweme.statistics?.digg_count || 0;
      const comments = aweme.statistics?.comment_count || 0;
      const musicTitle = aweme.music?.title || aweme.music?.author || "Original Sound";
      const musicUrl = aweme.music?.extra?.original_song_url || aweme.music?.play_url?.url_list?.[0] || null;
      if (flags.audio) {
        const audioDownloadUrl = musicUrl || videoUrl;
        await sock.sendMessage(ctx.id, {
          audio: {
            url: audioDownloadUrl
          },
          mimetype: "audio/mp4",
          fileName: `douyin_${aweme.aweme_id || Date.now()}.mp3`
        }, {
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      const captionText = `– *D O U Y I N*\n\n` + `┌ ◦ *Creator* : ${authorName}\n` + `│ ◦ *Music* : ${musicTitle}\n` + `│ ◦ *Likes* : ${Number(likes).toLocaleString("id-ID")}\n` + `│ ◦ *Comments* : ${Number(comments).toLocaleString("id-ID")}\n` + `│ ◦ *ID* : ${aweme.aweme_id || "-"}\n` + `└ ◦ *Description* : ${desc}\n\n` + `${footer}`;
      await sock.sendMessage(ctx.id, {
        video: {
          url: videoUrl
        },
        caption: captionText,
        mimetype: "video/mp4"
      }, {
        quoted: quotedMsg
      });
      if (validVideos.length > 1 && typeof ctx.sendCta === "function") {
        const otherRows = validVideos.slice(0, 10).map((v, i) => ({
          title: `Video #${i + 1} (${v.author?.nickname || "User"})`.slice(0, 24),
          id: `${prefix}douyin ${query} -i ${i + 1}`,
          description: `${(v.desc || "Tonton Video").slice(0, 45)}...`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "PILIH VIDEO LAIN",
            sections: [{
              title: `HASIL PENCARIAN (${validVideos.length} Video)`,
              rows: otherRows
            }]
          })
        }];
        const chooseText = `– *D O U Y I N  -  S E A R C H*\n\n` + `┌ ◦ *Query* : "${query}"\n` + `└ ◦ *Total* : ${validVideos.length} Video\n\n` + `_Pilih video lainnya pada menu di bawah:_\n\n` + `${footer}`;
        await ctx.sendCta(chooseText, `${botName} • Douyin Search`, buttons, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Douyin Plugin Error]:", error);
      await ctx.react("❌");
      let errorMessage = error?.message || "Terjadi kesalahan";
      if (error?.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {}
      }
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errorMessage}\n` + `└ ◦ *Command* : ${ctx.command || "douyin"}\n\n` + `${footer}`);
    }
  }
};