import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/search/pinterest/v1`;
async function sendSmartAlbum(sock, jid, items = [], options = {}) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const {
    caption = "",
      quoted,
      albumDelay = 1500
  } = options;
  const formattedList = items.map((item, idx) => {
    const itemCaption = idx === 0 ? caption : item.caption || "";
    const mediaTarget = typeof item.url === "string" ? {
      url: item.url
    } : item.url || item.data;
    if (item.type === "video") {
      return {
        video: mediaTarget,
        caption: itemCaption
      };
    }
    return {
      image: mediaTarget,
      caption: itemCaption
    };
  });
  if (typeof sock?.album === "function") {
    try {
      const builder = sock.album();
      for (const item of formattedList) {
        const mediaUrl = item.image?.url || item.video?.url || item.image || item.video;
        const cap = item.caption || "";
        if (item.video && typeof builder.video === "function") {
          builder.video(mediaUrl, cap);
        } else if (typeof builder.image === "function") {
          builder.image(mediaUrl, cap);
        }
      }
      if (typeof builder.setQuoted === "function" && quoted) {
        builder.setQuoted(quoted);
      }
      if (typeof builder.send === "function") {
        return await builder.send(jid, {
          quoted: quoted,
          ...options
        });
      }
    } catch (_) {}
  }
  if (typeof sock?.sendAlbumMessage === "function") {
    try {
      return await sock.sendAlbumMessage(jid, formattedList, quoted);
    } catch (_) {}
  }
  try {
    return await sock.sendMessage(jid, {
      albumMessage: formattedList
    }, {
      albumDelay: albumDelay,
      quoted: quoted
    });
  } catch (_) {}
  for (let i = 0; i < formattedList.length; i++) {
    const msgPayload = formattedList[i];
    await sock.sendMessage(jid, msgPayload, {
      quoted: i === 0 ? quoted : undefined
    });
    if (i < formattedList.length - 1) {
      await new Promise(r => setTimeout(r, 600));
    }
  }
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:^|\s)(?:--([a-zA-Z0-9_-]+)|-([a-zA-Z]))(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = (match[1] || match[2]).toLowerCase();
    let rawVal = match[3];
    let val = true;
    if (["url", "download", "dl", "d", "u", "link"].includes(key)) key = "url";
    if (["search", "q", "find", "s"].includes(key)) key = "search";
    if (["profile", "user", "p", "profil"].includes(key)) key = "profile";
    if (["limit", "l"].includes(key)) key = "limit";
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
  const cleanPrompt = input.replace(flagRegex, "").replace(/\s+/g, " ").trim();
  let urlFromPrompt = null;
  const urlMatch = cleanPrompt.match(/https?:\/\/(?:[a-zA-Z0-9_-]+\.)?pinterest\.[a-z]{2,4}\/pin\/[^\s]+|https?:\/\/pin\.it\/[^\s]+/i);
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
  name: "pinterest",
  aliases: ["pin", "pinsearch", "pinterestsearch"],
  description: "Cari gambar aesthetic, download pin, dan lihat profil Pinterest via Flags & Album",
  category: "Search",
  limit: true,
  example: "pinterest anime aesthetic atau pinterest --url https://pin.it/xxx",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const rawText = (ctx.query || ctx.args?.join(" ") || "").trim();
      const {
        flags,
        cleanPrompt,
        urlFromPrompt
      } = parseFlags(rawText);
      const pinUrl = flags.url || urlFromPrompt || (cleanPrompt.startsWith("dl ") ? cleanPrompt.slice(3).trim() : null);
      const profileUser = flags.profile || (cleanPrompt.startsWith("profil ") || cleanPrompt.startsWith("profile ") ? cleanPrompt.split(/\s+/)[1]?.replace("@", "") : null);
      const searchKeyword = flags.search || (!pinUrl && !profileUser && cleanPrompt ? cleanPrompt : null);
      const limit = Number(flags.limit) || 8;
      if (pinUrl) {
        await ctx.react("⏳");
        const {
          data
        } = await axios.post(API_URL, {
          action: "download",
          url: pinUrl
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 3e4
        });
        if (!data || !data.status || !data.result) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh media dari link Pinterest tersebut.");
        }
        const res = data.result;
        const mediaUrl = res.media_urls?.[0]?.url || res.media_urls?.[1]?.url;
        const isVideo = res.type === "video" || /mp4|video/i.test(mediaUrl || "");
        const captionText = `–  *P I N T E R E S T*

┌  ◦  *Title* : ${res.title || "-"}
│  ◦  *Author* : ${res.uploader?.full_name || res.uploader?.username || "Unknown"}
│  ◦  *Board* : ${res.board?.name || "-"}
│  ◦  *Saves* : ${res.statistics?.saves || 0}
└  ◦  *Comments* : ${res.statistics?.comments || 0}`;
        await ctx.react("✅");
        if (mediaUrl) {
          if (isVideo) {
            return await sock.sendMessage(ctx.chat, {
              video: {
                url: mediaUrl
              },
              caption: captionText,
              mimetype: "video/mp4"
            }, {
              quoted: quotedMsg
            });
          } else {
            return await sock.sendMessage(ctx.chat, {
              image: {
                url: mediaUrl
              },
              caption: captionText
            }, {
              quoted: quotedMsg
            });
          }
        } else {
          return ctx.reply(captionText);
        }
      }
      if (profileUser) {
        await ctx.react("⏳");
        const {
          data
        } = await axios.post(API_URL, {
          action: "profile",
          username: profileUser
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 3e4
        });
        if (!data || !data.status || !data.result) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat data profil Pinterest.");
        }
        const p = data.result;
        const profileText = `–  *P R O F I L E*

┌  ◦  *Name* : ${p.full_name || "-"} (@${p.username})
│  ◦  *Bio* : ${p.bio || "-"}
│  ◦  *Location* : ${p.location || "-"}
│  ◦  *Followers* : ${p.stats?.followers || 0}
│  ◦  *Following* : ${p.stats?.following || 0}
│  ◦  *Pins* : ${p.stats?.pins || 0}
└  ◦  *Boards* : ${p.stats?.boards || 0}`;
        await ctx.react("✅");
        const avatarUrl = p.image?.original || p.image?.large || p.image?.medium;
        if (avatarUrl) {
          return await sock.sendMessage(ctx.chat, {
            image: {
              url: avatarUrl
            },
            caption: profileText
          }, {
            quoted: quotedMsg
          });
        } else {
          return ctx.reply(profileText);
        }
      }
      if (!rawText && !searchKeyword && !pinUrl && !profileUser) {
        return ctx.reply(`–  *P I N T E R E S T*

Silakan tentukan kata kunci pencarian, link pin, atau username profil.

┌  ◦  *Search* : ${prefix}pin <query>
│  ◦  *Download* : ${prefix}pin --url <link>
│  ◦  *Profile* : ${prefix}pin --profile <username>
└  ◦  *Example* : ${prefix}pin anime aesthetic

–  *F L A G S*

┌  ◦  *--url* : Unduh media dari tautan pin
│  ◦  *--profile* : Lihat detail profil pengguna
└  ◦  *--limit* : Batas gambar album (default: 8)`);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        action: "search",
        query: searchKeyword
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      if (!data || !data.status || !data.result?.pins || data.result.pins.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan gambar untuk kata kunci: *"${searchKeyword}"*`);
      }
      const pins = data.result.pins;
      const medias = [];
      for (const pin of pins) {
        const images = pin.media?.images;
        const imageUrl = images?.orig?.url || images?.large?.url || images?.medium?.url || images?.small?.url;
        if (imageUrl) {
          medias.push({
            type: "image",
            url: imageUrl
          });
        }
        if (medias.length >= limit) break;
      }
      if (medias.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat gambar dari hasil pencarian Pinterest.");
      }
      if (medias.length === 1) {
        const singleCaption = `–  *P I N T E R E S T*

┌  ◦  *Query* : ${searchKeyword}
└  ◦  *Found* : ${pins.length} Pins`;
        await sock.sendMessage(ctx.chat, {
          image: {
            url: medias[0].url
          },
          caption: singleCaption
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      const albumCaption = `–  *P I N T E R E S T*

┌  ◦  *Query* : ${searchKeyword}
│  ◦  *Found* : ${pins.length} Pins
└  ◦  *Showing* : ${medias.length} Images`;
      await sendSmartAlbum(sock, ctx.chat, medias, {
        caption: albumCaption,
        quoted: quotedMsg,
        albumDelay: 1500
      });
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
      ctx.reply(`❌ Pinterest Error: ${errorMessage}`);
    }
  }
};