import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/search/kwai`,
  TIMEOUT: 35e3,
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
      profile: ["p", "user", "u", "creator"],
      home: ["h", "discover", "trending", "feed"],
      detail: ["d", "url", "video"],
      audio: ["a", "mp3", "sound", "musik"]
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
async function callKwaiApi(action, payload = {}) {
  const res = await axios.post(CONFIG.API_URL, {
    action: action,
    ...payload
  }, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return res?.data;
}
export default {
  name: "kwai",
  aliases: ["kwaivideo", "kwaidl", "kwaidownload", "kwaiprofile", "kwaiapp"],
  description: "Download video Kwai HD tanpa watermark, pencarian video, cek profil, & trending feed via POST API",
  category: "Downloader",
  limit: true,
  example: "kwai https://www.kwai.com/@snapdouyin/video/5238680903365743246\n" + "kwai Jedag Jedug\n" + "kwai --user snapdouyin\n" + "kwai --home",
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
        if (["kwai", "kwaivideo", "kwaidl", "kwaidownload", "kwaiprofile", "kwaiapp"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const quotedText = (ctx.quoted?.text || ctx.quoted?.caption || ctx.quoted?.body || ctx.quoted?.message?.conversation || ctx.quoted?.message?.extendedTextMessage?.text || ctx.quotedText || "").trim();
      const {
        flags,
        cleanPrompt: initialPrompt
      } = parseFlags(rawText);
      const query = initialPrompt || quotedText;
      const kwaiUrlRegex = /(https?:\/\/(?:www\.|v\.)?(?:kwai\.com|kwai-video\.com|kwaiapp\.com)[^\s]+|\b\d{15,}\b)/i;
      const matchUrl = query.match(kwaiUrlRegex);
      const videoUrlOrId = matchUrl ? matchUrl[0] : null;
      if (!query && !flags.home && !flags.profile) {
        const helpText = `– *K W A I*\n\n` + `┌ ◦ *Usage* : ${prefix}kwai <url / query>\n` + `│ ◦ *Audio* : ${prefix}kwai <url> --audio\n` + `│ ◦ *Profile* : ${prefix}kwai --user <username>\n` + `└ ◦ *Trending* : ${prefix}kwai --home\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Download* : ${prefix}kwai https://www.kwai.com/@user/video/...\n` + `│ ◦ *Search* : ${prefix}kwai slowmo anime\n` + `└ ◦ *User* : ${prefix}kwai --user snapdouyin\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      if (videoUrlOrId || flags.detail) {
        const targetUrl = videoUrlOrId || String(flags.detail);
        const data = await callKwaiApi("detail", {
          url: targetUrl
        });
        if (!data?.status || !data?.result?.video_url) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Video tidak ditemukan\n` + `└ ◦ *Info* : Pastikan tautan video bersifat publik dan valid.\n\n` + `${footer}`);
        }
        const res = data.result;
        const captionText = `– *K W A I*\n\n` + `┌ ◦ *Creator* : ${res.author?.name || res.author?.username || "Unknown"}\n` + `│ ◦ *Likes* : ${res.stats?.likes || "0"}\n` + `│ ◦ *Comments* : ${res.stats?.comments || "0"}\n` + `│ ◦ *Shares* : ${res.stats?.shares || "0"}\n` + `│ ◦ *AI Generated* : ${res.is_ai_generated ? "Yes" : "No"}\n` + `└ ◦ *Description* : ${res.caption || "-"}\n\n` + `${footer}`;
        if (flags.audio) {
          await sock.sendMessage(ctx.id, {
            audio: {
              url: res.video_url
            },
            mimetype: "audio/mp4",
            fileName: `kwai_${res.video_id || Date.now()}.mp3`
          }, {
            quoted: quotedMsg
          });
          return ctx.react("✅");
        }
        await sock.sendMessage(ctx.id, {
          video: {
            url: res.video_url
          },
          caption: captionText,
          mimetype: "video/mp4"
        }, {
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      if (flags.profile) {
        const username = String(flags.profile === true ? query : flags.profile).replace(/^@/, "").trim();
        if (!username) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Username kosong\n` + `└ ◦ *Example* : ${prefix}kwai --user snapdouyin\n\n` + `${footer}`);
        }
        const data = await callKwaiApi("profile", {
          name: username
        });
        if (!data?.status || !data?.result) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Profil tidak ditemukan\n` + `└ ◦ *Username* : "@${username}"\n\n` + `${footer}`);
        }
        const u = data.result;
        const profileCaption = `– *K W A I  -  P R O F I L E*\n\n` + `┌ ◦ *Name* : ${u.name}\n` + `│ ◦ *Username* : @${u.username}\n` + `│ ◦ *User ID* : ${u.user_id}\n` + `│ ◦ *Followers* : ${u.stats?.followers || "0"}\n` + `│ ◦ *Following* : ${u.stats?.following || "0"}\n` + `│ ◦ *Likes* : ${u.stats?.likes || "0"}\n` + `│ ◦ *Posts* : ${u.stats?.total_posts || "0"}\n` + `└ ◦ *Bio* : ${u.bio || "-"}\n\n` + `${footer}`;
        const avatarUrl = u.avatar || "https://files.catbox.moe/g2e6i5.jpg";
        const postRows = (u.posts || []).slice(0, 8).map((p, i) => ({
          title: `Video #${i + 1} (${p.likes} Likes)`,
          id: `${prefix}kwai ${p.url || p.video_id}`,
          description: `Download video ini (${p.video_id})`
        }));
        if (postRows.length && typeof ctx.sendCta === "function") {
          const listSections = [{
            title: "POSTINGAN TERBARU",
            rows: postRows
          }];
          const buttons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "DAFTAR VIDEO",
              sections: listSections
            })
          }, {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "Buka Profil",
              url: `https://www.kwai.com/@${u.username}`
            })
          }];
          await ctx.sendCta(profileCaption, `${botName} • Kwai Profile`, buttons, {
            image: avatarUrl,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: {
              url: avatarUrl
            },
            caption: profileCaption
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.react("✅");
      }
      if (flags.home) {
        const data = await callKwaiApi("home");
        const items = data?.result?.items || [];
        if (!items.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Feed kosong\n` + `└ ◦ *Info* : Tidak ada video trending saat ini.\n\n` + `${footer}`);
        }
        const feedRows = items.slice(0, 10).map((v, i) => ({
          title: `#${i + 1} ${v.author?.name || "Kwai User"}`.slice(0, 24),
          id: `${prefix}kwai ${v.url || v.video_id}`,
          description: `${(v.caption || "Tonton Video").slice(0, 45)}...`
        }));
        const bodyText = `– *K W A I  -  T R E N D I N G*\n\n` + `┌ ◦ *Feed* : Discover / Trending\n` + `└ ◦ *Total* : ${items.length} Video Populer\n\n` + `_Pilih video pada tombol di bawah untuk mengunduh:_\n\n` + `${footer}`;
        if (typeof ctx.sendCta === "function") {
          const buttons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "PILIH VIDEO TRENDING",
              sections: [{
                title: "POPULER SAAT INI",
                rows: feedRows
              }]
            })
          }];
          await ctx.sendCta(bodyText, `${botName} • Kwai Feed`, buttons, {
            image: items[0]?.thumbnail || "https://files.catbox.moe/g2e6i5.jpg",
            quoted: quotedMsg
          });
        } else {
          let listMsg = `${bodyText}\n\n`;
          feedRows.forEach((r, idx) => {
            listMsg += `*${idx + 1}.* ${r.title}\n   ${r.description}\n   Perintah: \`${r.id}\`\n\n`;
          });
          await ctx.reply(listMsg.trim());
        }
        return ctx.react("✅");
      }
      const data = await callKwaiApi("search", {
        query: query
      });
      const items = data?.result?.items || [];
      if (!items.length) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Video tidak ditemukan\n` + `└ ◦ *Query* : "${query}"\n\n` + `${footer}`);
      }
      const searchRows = items.slice(0, 10).map((v, i) => ({
        title: `#${i + 1} ${v.author?.name || "Kwai Video"}`.slice(0, 24),
        id: `${prefix}kwai ${v.url || v.video_id}`,
        description: `${(v.caption || "Tanpa Judul").slice(0, 45)}...`
      }));
      const bodyText = `– *K W A I  -  S E A R C H*\n\n` + `┌ ◦ *Query* : "${query}"\n` + `└ ◦ *Total* : ${items.length} Video\n\n` + `_Pilih video pada tombol di bawah untuk mengunduh:_\n\n` + `${footer}`;
      if (typeof ctx.sendCta === "function") {
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "PILIH HASIL VIDEO",
            sections: [{
              title: "HASIL PENCARIAN",
              rows: searchRows
            }]
          })
        }];
        await ctx.sendCta(bodyText, `${botName} • Kwai Search`, buttons, {
          image: items[0]?.thumbnail || "https://files.catbox.moe/g2e6i5.jpg",
          quoted: quotedMsg
        });
      } else {
        let listMsg = `${bodyText}\n\n`;
        searchRows.forEach((r, idx) => {
          listMsg += `*${idx + 1}.* ${r.title}\n   ${r.description}\n   Perintah: \`${r.id}\`\n\n`;
        });
        await ctx.reply(listMsg.trim());
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Kwai Plugin Error]:", error);
      await ctx.react("❌");
      let errorMessage = error?.message || "Terjadi kesalahan";
      if (error?.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {}
      }
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errorMessage}\n` + `└ ◦ *Command* : ${ctx.command || "kwai"}\n\n` + `${footer}`);
    }
  }
};