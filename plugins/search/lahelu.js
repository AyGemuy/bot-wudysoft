import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  writeExifImg,
  writeExifVid
} from "../../lib/exif.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/search/lahelu`,
  TIMEOUT: 3e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
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
      user: ["u", "creator", "pengguna", "profile"],
      fyp: ["f", "rec", "recommendation", "trending", "trend"],
      sticker: ["s", "stiker", "wm"],
      id: ["postid", "pid", "post"],
      page: ["p", "pg"],
      help: ["h", "bantuan", "guide", "?"]
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
async function callLaheluApi(action, params = {}) {
  const res = await axios.get(CONFIG.API_URL, {
    params: {
      action: action,
      ...params
    },
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return res?.data;
}
async function sendLaheluHelpMenu(sock, ctx, chatId, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const footer = global.footer || global.bot?.footer || `_${botName}_`;
  const bannerImage = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const guideText = `– *L A H E L U*\n\n` + `┌ ◦ *Usage* : ${prefix}lahelu <query>\n` + `│ ◦ *Trending* : ${prefix}lahelu --fyp\n` + `│ ◦ *Post ID* : ${prefix}lahelu --id <post_id>\n` + `│ ◦ *Sticker* : ${prefix}lahelu <query> --sticker\n` + `└ ◦ *Creator* : ${prefix}lahelu --user <username>\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Search* : ${prefix}lahelu gaming\n` + `└ ◦ *Direct ID* : ${prefix}lahelu --id P3hLe7Tq4\n\n` + `_Pilih kategori cepat pada menu tombol di bawah:_\n\n` + `${footer}`;
  const quickRows = [{
    title: "FYP / Rekomendasi",
    id: `${prefix}lahelu --fyp`,
    description: "Ambil meme terpopuler & teratas saat ini"
  }, {
    title: "Meme Absurd & Random",
    id: `${prefix}lahelu absurd`,
    description: "Kumpulan meme absurd dan random"
  }, {
    title: "Meme Gaming",
    id: `${prefix}lahelu gaming`,
    description: "Meme seputar game, Minecraft, & Roblox"
  }, {
    title: "Meme Sarkas",
    id: `${prefix}lahelu sarcasm`,
    description: "Meme sindiran halus dan sarkasme lokal"
  }, {
    title: "Meme Wibu & Anime",
    id: `${prefix}lahelu anime`,
    description: "Meme anime relate dan kehidupan wibu"
  }, {
    title: "Meme Hewan / Kucing",
    id: `${prefix}lahelu kucing`,
    description: "Tingkah lucu kucing dan hewan peliharaan"
  }];
  const buttons = [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: "PILIH KATEGORI MEME",
      sections: [{
        title: `${botName} • Aksi Cepat Lahelu`,
        rows: quickRows
      }]
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "Ambil FYP",
      id: `${prefix}lahelu --fyp`
    })
  }];
  const options = {
    image: bannerImage,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Menu Lahelu`,
        button_title: "Menu Kategori"
      }
    },
    quoted: quotedMsg || undefined
  };
  if (typeof ctx?.sendCta === "function" && chatId === ctx.id) {
    return await ctx.sendCta(guideText, `${botName} • Meme Center`, buttons, options);
  }
  return await sock.sendMessage(chatId, {
    image: {
      url: bannerImage
    },
    caption: guideText
  }, {
    quoted: quotedMsg
  });
}
export default {
  name: "lahelu",
  aliases: ["memeindo", "lahelumeme", "lhl", "memelahelu"],
  description: "Jelajahi & cari meme kocak, gambar, video, atau kreator dari platform Lahelu",
  category: "Fun",
  limit: true,
  example: "lahelu\n" + "lahelu wkwk\n" + "lahelu --id P3hLe7Tq4\n" + "lahelu minecraft --sticker\n" + "lahelu --user wolvies",
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
        if (["lahelu", "memeindo", "lahelumeme", "lhl", "memelahelu"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const quotedText = (ctx.quoted?.text || ctx.quoted?.caption || ctx.quoted?.body || ctx.quoted?.message?.conversation || ctx.quoted?.message?.extendedTextMessage?.text || ctx.quotedText || "").trim();
      const {
        flags,
        cleanPrompt: initialPrompt
      } = parseFlags(rawText);
      const query = initialPrompt || quotedText;
      if (flags.help || query.toLowerCase() === "help" || query.toLowerCase() === "bantuan") {
        return await sendLaheluHelpMenu(sock, ctx, ctx.id, quotedMsg, prefix);
      }
      await ctx.react("⏳");
      if (flags.user) {
        const searchUser = String(flags.user === true ? query : flags.user).replace(/^@/, "").trim();
        if (!searchUser) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Username kosong\n` + `└ ◦ *Example* : ${prefix}lahelu --user wolvies\n\n` + `${footer}`);
        }
        const data = await callLaheluApi("search", {
          mode: "user",
          query: searchUser
        });
        const userList = data?.userInfos || [];
        if (!userList.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Pengguna tidak ditemukan\n` + `└ ◦ *Username* : "${searchUser}"\n\n` + `${footer}`);
        }
        let userMsg = `– *L A H E L U  -  U S E R*\n\n` + `┌ ◦ *Query* : "${searchUser}"\n` + `└ ◦ *Total* : ${userList.length} Pengguna\n\n`;
        userMsg += userList.slice(0, 8).map((u, i) => {
          return `┌ ◦ *#${i + 1} User* : @${u.username}\n` + `│ ◦ *ID* : ${u.userId}\n` + `│ ◦ *Posts* : ${u.totalPosts || 0} Meme\n` + `│ ◦ *Upvotes* : 👍 ${u.totalUpvotes || 0} / 👎 ${u.totalDownvotes || 0}\n` + `└ ◦ *Bio* : ${u.description || "-"}`;
        }).join("\n\n");
        userMsg += `\n\n${footer}`;
        const avatar = userList[0]?.visual?.[0]?.value || userList[0]?.avatar || "https://lahelu.com/icon.png";
        await sock.sendMessage(ctx.id, {
          image: {
            url: avatar
          },
          caption: userMsg.trim()
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      let postList = [];
      const isPostIdPattern = query && /^P[a-zA-Z0-9_-]{7,10}$/i.test(query.trim());
      const targetPostId = flags.id ? String(flags.id).trim() : isPostIdPattern ? query.trim() : null;
      if (targetPostId) {
        const data = await callLaheluApi("search", {
          query: targetPostId,
          mode: "post"
        });
        postList = data?.postInfos || [];
      } else if (query && !flags.fyp) {
        const data = await callLaheluApi("search", {
          query: query,
          mode: "post"
        });
        postList = data?.postInfos || [];
      } else {
        const data = await callLaheluApi("recommendation");
        postList = data?.postInfos || [];
      }
      if (!postList.length) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Meme tidak ditemukan\n` + `└ ◦ *Query* : "${targetPostId || query || "Rekomendasi"}"\n\n` + `${footer}`);
      }
      let meme = postList[0];
      if (targetPostId) {
        const foundExact = postList.find(p => (p.postId || p.postID) === targetPostId);
        if (foundExact) meme = foundExact;
      }
      const mediaUrl = meme.media || meme.content?.find(c => c.value?.startsWith("http"))?.value || meme.mediaThumbnail;
      if (!mediaUrl) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Media gagal dimuat\n` + `└ ◦ *Info* : Berkas konten tidak tersedia.\n\n` + `${footer}`);
      }
      const tags = meme.hashtags?.length ? meme.hashtags.map(t => `#${t}`).join(" ") : "-";
      const isVideo = meme.mediaType === 4 || meme.type === 1 || mediaUrl.endsWith(".mp4");
      const currentPostId = meme.postId || meme.postID || targetPostId || "-";
      const captionText = `– *L A H E L U*\n\n` + `┌ ◦ *Title* : ${meme.title || "Tanpa Judul"}\n` + `│ ◦ *Creator* : @${meme.userUsername || meme.userInfo?.username || "Anonim"}\n` + `│ ◦ *Topic* : ${meme.topicTitle ? `[${meme.topicTitle}] ` : ""}${tags}\n` + `│ ◦ *Stats* : 👍 ${meme.totalUpvotes || 0} / 👎 ${meme.totalDownvotes || 0} (💬 ${meme.totalComments || 0})\n` + `│ ◦ *Sensitive* : ${meme.isSensitive ? "Yes" : "No"}\n` + `└ ◦ *Post ID* : ${currentPostId}\n\n` + `${footer}`;
      if (flags.sticker) {
        const mediaRes = await axios.get(mediaUrl, {
          responseType: "arraybuffer"
        });
        const mediaBuffer = Buffer.from(mediaRes.data);
        const exif = {
          packname: `Lahelu: ${(meme.title || "Meme").slice(0, 25)}`,
          author: `@${meme.userUsername || "Lahelu"}`
        };
        const stickerBuf = isVideo ? await writeExifVid(mediaBuffer, exif) : await writeExifImg(mediaBuffer, exif);
        await sock.sendMessage(ctx.id, {
          sticker: stickerBuf
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      if (isVideo) {
        await sock.sendMessage(ctx.id, {
          video: {
            url: mediaUrl
          },
          caption: captionText,
          mimetype: "video/mp4"
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: mediaUrl
          },
          caption: captionText
        }, {
          quoted: quotedMsg
        });
      }
      if (postList.length > 1 && typeof ctx.sendCta === "function") {
        const otherRows = postList.filter(p => (p.postId || p.postID) !== currentPostId).slice(0, 8).map((p, i) => {
          const pid = p.postId || p.postID;
          return {
            title: `Meme #${i + 2}: ${(p.title || "Tanpa Judul").slice(0, 24)}`,
            id: `${prefix}lahelu --id ${pid}`,
            description: `👍 ${p.totalUpvotes || 0} • @${p.userUsername || "Anonim"}`
          };
        });
        if (otherRows.length > 0) {
          const buttons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "PILIH MEME LAINNYA",
              sections: [{
                title: "REKOMENDASI TERKAIT",
                rows: otherRows
              }]
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "Menu Bantuan",
              id: `${prefix}lahelu --help`
            })
          }];
          const listCaption = `– *L A H E L U  -  R E C O M M E N D*\n\n` + `┌ ◦ *Total* : ${postList.length} Meme Terkait\n` + `└ ◦ *Action* : Pilih meme lainnya pada tombol di bawah\n\n` + `${footer}`;
          await ctx.sendCta(listCaption, `${botName} • Lahelu Meme`, buttons, {
            quoted: quotedMsg
          });
        }
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Lahelu Plugin Error]:", error);
      await ctx.react("❌");
      let errorMessage = error?.message || "Terjadi kesalahan";
      if (error?.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {}
      }
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errorMessage}\n` + `└ ◦ *Command* : ${ctx.command || "lahelu"}\n\n` + `${footer}`);
    }
  }
};