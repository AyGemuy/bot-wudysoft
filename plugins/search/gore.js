import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  BASE_URL: `${global.bot?.api?.wudysoft}/api/search/gore`,
  ENDPOINTS: {
    v1: `${global.bot?.api?.wudysoft}/api/search/gore/v1`,
    v2: `${global.bot?.api?.wudysoft}/api/search/gore/v2`,
    v3: `${global.bot?.api?.wudysoft}/api/search/gore/v3`,
    v4: `${global.bot?.api?.wudysoft}/api/search/gore/v4`
  },
  TIMEOUT: 3e4,
  API_TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36"
};
const goreCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      version: ["v", "ver", "type", "t", "provider"],
      page: ["p", "pg"],
      index: ["i", "idx"],
      url: ["u", "link"],
      home: ["h", "latest"]
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

function resolveVersion(inputVer = "") {
  const v = String(inputVer).toLowerCase().trim().replace(/^v/i, "");
  if (["1", "seegore", "sg"].includes(v)) return "v1";
  if (["2", "xgore", "xg"].includes(v)) return "v2";
  if (["3", "gorecenter", "gc"].includes(v)) return "v3";
  if (["4", "alivegore", "ag"].includes(v)) return "v4";
  return null;
}
async function fetchBuffer(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return Buffer.from(res.data);
}
async function callGoreApi({
  version = "v1",
  action = "home",
  query = "",
  url = "",
  page = 1
}) {
  const endpoint = CONFIG.ENDPOINTS[version] || CONFIG.ENDPOINTS.v1;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": CONFIG.USER_AGENT
  };
  const payload = {
    action: action,
    page: page,
    ...query && {
      query: query,
      q: query,
      keyword: query
    },
    ...url && {
      url: url,
      slug: url
    }
  };
  const res = await axios.post(endpoint, payload, {
    headers: headers,
    timeout: CONFIG.API_TIMEOUT
  });
  const resData = res?.data;
  let items = [];
  if (Array.isArray(resData?.result)) {
    items = resData.result;
  } else if (Array.isArray(resData?.result?.posts)) {
    items = resData.result.posts;
  } else if (Array.isArray(resData?.posts)) {
    items = resData.posts;
  }
  const normalizedItems = items.map(it => ({
    title: it.title || "No Title",
    slug: it.slug || "",
    url: it.url || it.link || "",
    thumbnail: it.thumbnail || it.poster || it.image || "",
    category: it.category || "-",
    views: it.views || it.views_count || "0",
    date: it.uploaded_date || it.date || "-"
  }));
  return {
    raw: resData,
    version: version,
    items: normalizedItems,
    detail: !Array.isArray(resData?.result) && typeof resData?.result === "object" ? resData.result : resData
  };
}
export default {
  name: "gore",
  aliases: ["seegore", "xgore", "gorecenter", "alivegore"],
  description: "Cari & tonton video dari berbagai versi API Gore Wudysoft (v1, v2, v3, v4)",
  category: "Search",
  limit: true,
  example: "gore accident\ngore car -v v1\ngore landslide -v v4\ngore -u https://seegore.com/video-slug",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["gore", "seegore", "xgore", "gorecenter", "alivegore"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const targetQuery = cleanPrompt || flags.url;
      const selectedVer = resolveVersion(flags.version);
      if (targetQuery && !selectedVer && !flags.url && !targetQuery.startsWith("http") && flags.index === undefined && !flags.home) {
        const versionRows = [{
          title: "SeeGore Engine (v1)",
          id: `${prefix}gore "${targetQuery}" -v v1`,
          description: "Database video & rekaman dari SeeGore.com"
        }, {
          title: "XGore Engine (v2)",
          id: `${prefix}gore "${targetQuery}" -v v2`,
          description: "Kategori BestGore & arsip dari XGore.net"
        }, {
          title: "GoreCenter Engine (v3)",
          id: `${prefix}gore "${targetQuery}" -v v3`,
          description: "Koleksi berita insiden dari GoreCenter.com"
        }, {
          title: "AliveGore Engine (v4)",
          id: `${prefix}gore "${targetQuery}" -v v4`,
          description: "Pusat arsip rekaman video dari AliveGore.com"
        }];
        const listSections = [{
          title: "PILIH ENGINE / VERSI API",
          rows: versionRows
        }];
        const bannerImage = "https://files.catbox.moe/g2e6i5.jpg";
        const bodyText = `– *G O R E  -  E N G I N E*\n\n` + `┌ ◦ *Query* : ${targetQuery}\n` + `│ ◦ *Engines* : 4 Endpoint (v1 - v4)\n` + `└ ◦ *Action* : Pilih versi API pada menu di bawah\n\n` + `${footer}`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "PILIH ENGINE",
            sections: listSections
          })
        }];
        const options = {
          image: bannerImage,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Version Selector`,
              button_title: "Pilih Engine / Versi"
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, `${botName} • Gore Search`, buttons, options);
        } else {
          return await sock.sendMessage(ctx.id, {
            image: {
              url: bannerImage
            },
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        }
      }
      await ctx.react("⏳");
      const activeVer = selectedVer || "v1";
      if (flags.url || targetQuery?.startsWith("http")) {
        const targetUrl = flags.url || targetQuery;
        const apiRes = await callGoreApi({
          version: activeVer,
          action: "detail",
          url: targetUrl
        });
        const info = apiRes.detail || {};
        const title = info.title || "No Title";
        const videoUrl = info.video_url || "";
        const posterUrl = info.poster || info.thumbnail || "";
        const desc = info.description ? info.description.length > 500 ? `${info.description.slice(0, 500)}...` : info.description : "-";
        if (!videoUrl && !info.title && !info.images?.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memuat detail\n` + `└ ◦ *Info* : Tautan konten tidak valid atau sudah kedaluwarsa.\n\n` + `${footer}`);
        }
        const caption = `– *G O R E  -  D E T A I L*\n\n` + `┌ ◦ *Title* : ${title}\n` + `│ ◦ *Date* : ${info.uploaded_date || "-"}\n` + `│ ◦ *Views* : ${info.views_count || info.views || "-"}\n` + `│ ◦ *Votes* : 👍 ${info.upvotes || "0"} (💬 ${info.comments_count || "0"})\n` + `└ ◦ *Engine* : ${activeVer.toUpperCase()}\n\n` + `*Deskripsi:*\n` + `_${desc}_\n\n` + `${footer}`;
        if (videoUrl) {
          try {
            const videoBuffer = await fetchBuffer(videoUrl);
            await sock.sendMessage(ctx.id, {
              video: videoBuffer,
              caption: caption,
              mimetype: "video/mp4"
            }, {
              quoted: quotedMsg
            });
            return ctx.react("✅");
          } catch (e) {
            console.error("[Video Send Error]:", e?.message);
          }
        }
        if (posterUrl) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: posterUrl
            },
            caption: caption
          }, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(caption);
        }
        return ctx.react("✅");
      }
      const isHome = flags.home || !targetQuery;
      const actionType = isHome ? "home" : "search";
      let postData = null;
      const userCached = goreCache.get(senderId);
      if (userCached && userCached.query === targetQuery && userCached.version === activeVer && userCached.action === actionType && userCached.page === (flags.page || 1) && userCached.items?.length) {
        postData = userCached;
      } else {
        const apiRes = await callGoreApi({
          version: activeVer,
          action: actionType,
          query: targetQuery,
          page: flags.page || 1
        });
        if (!apiRes?.items?.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Konten tidak ditemukan\n` + `└ ◦ *Query* : "${targetQuery || "Home"}" [${activeVer.toUpperCase()}]\n\n` + `${footer}`);
        }
        postData = {
          query: targetQuery,
          version: activeVer,
          action: actionType,
          page: Number(flags.page) || 1,
          items: apiRes.items
        };
        if (goreCache.size > 50) goreCache.clear();
        goreCache.set(senderId, postData);
      }
      const postList = postData.items || [];
      if (flags.index !== undefined) {
        const targetIdx = Number(flags.index) - 1;
        const selectedPost = postList[targetIdx];
        if (!selectedPost) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Indeks konten salah\n` + `└ ◦ *Index* : #${flags.index}\n\n` + `${footer}`);
        }
        const detailRes = await callGoreApi({
          version: activeVer,
          action: "detail",
          url: selectedPost.url || selectedPost.slug
        });
        const d = detailRes.detail || {};
        const title = d.title || selectedPost.title;
        const videoUrl = d.video_url || "";
        const posterUrl = d.poster || selectedPost.thumbnail || "";
        const desc = d.description ? d.description.length > 500 ? `${d.description.slice(0, 500)}...` : d.description : "-";
        const caption = `– *G O R E  -  V I D E O*\n\n` + `┌ ◦ *Title* : ${title}\n` + `│ ◦ *Views* : ${d.views_count || selectedPost.views}\n` + `│ ◦ *Date* : ${d.uploaded_date || selectedPost.date}\n` + `└ ◦ *Engine* : ${activeVer.toUpperCase()}\n\n` + `*Deskripsi:*\n` + `_${desc}_\n\n` + `${footer}`;
        if (videoUrl) {
          try {
            const videoBuffer = await fetchBuffer(videoUrl);
            await sock.sendMessage(ctx.id, {
              video: videoBuffer,
              caption: caption,
              mimetype: "video/mp4"
            }, {
              quoted: quotedMsg
            });
            return ctx.react("✅");
          } catch (e) {
            console.error("[Video Download Error]:", e?.message);
          }
        }
        if (posterUrl) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: posterUrl
            },
            caption: caption
          }, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(caption);
        }
        return ctx.react("✅");
      }
      const totalPosts = postList.length;
      const currentPage = Number(postData.page) || 1;
      const postRows = postList.map((p, i) => {
        const viewStr = p.views ? ` • 👁️ ${p.views}` : "";
        return {
          title: `${i + 1}. ${p.title}`.slice(0, 24),
          id: `${prefix}gore "${targetQuery || ""}" -v ${activeVer} -i ${i + 1}`,
          description: `${p.date}${viewStr} • ${p.category}`.slice(0, 60)
        };
      });
      const listSections = [{
        title: `DAFTAR KONTEN (${totalPosts} Video | ${activeVer.toUpperCase()})`,
        rows: postRows
      }];
      const bannerImage = postList[0]?.thumbnail || "https://files.catbox.moe/g2e6i5.jpg";
      const bodyText = `– *G O R E  -  F E E D*\n\n` + `┌ ◦ *Query* : "${targetQuery || "Latest Posts"}"\n` + `│ ◦ *Engine* : ${activeVer.toUpperCase()}\n` + `│ ◦ *Page* : ${currentPage}\n` + `└ ◦ *Total* : ${totalPosts} Konten\n\n` + `_Pilih video pada tombol di bawah untuk memutar:_\n\n` + `${footer}`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "PILIH KONTEN VIDEO",
          sections: listSections
        })
      }];
      if (currentPage > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `Hal ${currentPage - 1}`,
            id: `${prefix}gore "${targetQuery || ""}" -v ${activeVer} -p ${currentPage - 1}`
          })
        });
      }
      buttons.push({
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: `Hal ${currentPage + 1}`,
          id: `${prefix}gore "${targetQuery || ""}" -v ${activeVer} -p ${currentPage + 1}`
        })
      });
      const options = {
        image: bannerImage,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Video Feed`,
            button_title: "Pilih Video"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • Gore Suite`, buttons, options);
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: bannerImage
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Gore Feature Error]:", error);
      await ctx.react("❌");
      let errorMessage = error?.message || "Terjadi kesalahan";
      if (error?.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {}
      }
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errorMessage}\n` + `└ ◦ *Command* : ${ctx.command || "gore"}\n\n` + `${footer}`);
    }
  }
};