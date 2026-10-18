import axios from "axios";
const CONFIG = {
  TIMEOUT: 3e4,
  API_TIMEOUT: 6e4,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 25,
  DEFAULT_IMAGE_SERVER: "https://i1.nhentai.net",
  DEFAULT_THUMB_SERVER: "https://t1.nhentai.net",
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
const nhCache = new Map();
let cdnCache = null;

function apiBase() {
  const base = String(global.bot?.api?.wudysoft || "").replace(/\/+$/, "");
  return `${base}/api/nsfw/nhentai`;
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      query: ["q", "search"],
      id: ["i", "id", "g"],
      tag: ["t", "tag", "tag_id"],
      page: ["p", "page", "pg"],
      sort: ["sort", "order"],
      limit: ["l"],
      random: ["r", "rand", "random"],
      popular: ["pop", "popular"],
      galleries: ["galls", "galleries", "latest"],
      related: ["rel", "related"],
      comments: ["c", "comment", "comments"],
      tags: ["tags", "taglist"],
      config: ["cfg", "config"],
      cdn: ["cdn"],
      zones: ["zones"],
      help: ["h", "help"],
      yes: ["y", "yes", "confirm"]
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
  if (!flags.id) {
    const idMatch = cleanPrompt.match(/nhentai\.net\/g\/(\d+)/i) || cleanPrompt.match(/\/g\/(\d+)/i) || cleanPrompt.match(/^(\d{4,})$/);
    if (idMatch) flags.id = idMatch[1];
  }
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
async function apiGet(action, params = {}) {
  const url = apiBase();
  if (!url || url === "/api/nsfw/nhentai") {
    throw new Error("API URL belum dikonfigurasi. Pastikan global.bot.api.wudysoft tersedia.");
  }
  const res = await axios.get(url, {
    params: {
      action: action,
      ...params
    },
    timeout: CONFIG.API_TIMEOUT,
    headers: {
      "User-Agent": CONFIG.USER_AGENT,
      Accept: "application/json"
    }
  });
  const data = res.data;
  if (data?.status === false) {
    throw new Error(data.error || data.message || "API mengembalikan status false.");
  }
  return data;
}

function truncate(text = "", max = 100) {
  const str = String(text || "").replace(/\s+/g, " ").trim();
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function formatDate(unix) {
  if (!unix) return "-";
  try {
    return new Date(unix * 1e3).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return "-";
  }
}

function normalizePath(path = "") {
  return String(path).replace(/^\/+/, "").replace(/\.webp\.webp$/i, ".webp");
}
async function getCdn() {
  if (cdnCache) return cdnCache;
  try {
    const data = await apiGet("cdn");
    cdnCache = data;
    return data;
  } catch {
    return null;
  }
}
async function imageUrl(path, thumb = false) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const cdn = await getCdn();
  const servers = thumb ? cdn?.thumb_servers : cdn?.image_servers;
  const fallback = thumb ? CONFIG.DEFAULT_THUMB_SERVER : CONFIG.DEFAULT_IMAGE_SERVER;
  const base = Array.isArray(servers) && servers.length ? servers[0] : fallback;
  return `${String(base).replace(/\/+$/, "")}/${normalizePath(path)}`;
}

function galleryTitle(g = {}) {
  return g.english_title || g.japanese_title || g.title?.english || g.title?.pretty || g.title?.japanese || `Gallery #${g.id || "-"}`;
}

function galleryCommand(prefix, id) {
  return `${prefix}nhentai -i ${id}`;
}
export default {
  name: "nhentai",
  aliases: ["nh", "nhen", "nhentai"],
  description: "Cari, lihat detail, random, dan jelajahi gallery NHentai (18+)",
  category: "NSFW",
  nsfw: true,
  limit: true,
  example: 'nhentai -q "big breasts" -p 1 | nhentai -i 608785 | nhentai --random | nhentai --popular | nhentai -t 683',
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["nhentai", "nh", "nhen"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • NHentai`;
      const userName = ctx.pushname || ctx.sender?.split("@")[0] || "User";
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const quotedMsg = typeof ctx.quoted === "function" ? ctx.quoted() : ctx.quoted || msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const helpText = `–  *N H E N T A I*  (18+)

Halo ${userName}, berikut cara penggunaan:

┌  ◦  *Cari* : ${prefix}nhentai -q "query"
│  ◦  *Detail* : ${prefix}nhentai -i <id>
│  ◦  *Random* : ${prefix}nhentai --random
│  ◦  *Popular* : ${prefix}nhentai --popular
│  ◦  *Tag* : ${prefix}nhentai -t <tag_id>
│  ◦  *Latest* : ${prefix}nhentai --galleries
└  ◦  *Page* : ${prefix}nhentai -q "query" -p 2

–  *F L A G S*

┌  ◦  *-q, --query* : Kata kunci pencarian
│  ◦  *-i, --id* : ID gallery / link nhentai
│  ◦  *-t, --tag* : Tag ID
│  ◦  *-p, --page* : Halaman hasil
│  ◦  *--sort* : date / popular
│  ◦  *--related* : Gallery terkait
│  ◦  *--comments* : Komentar gallery
│  ◦  *--tags* : Cari tag
└  ◦  *--config / --cdn / --zones* : Info API

⚠️ Konten dewasa. Gunakan dengan bijak.`;
      if (flags.help) {
        return ctx.reply(helpText);
      }
      const hasAny = flags.query || flags.id || flags.tag || flags.random || flags.popular || flags.galleries || flags.tags || flags.config || flags.cdn || flags.zones || flags.related || flags.comments || cleanPrompt;
      if (!hasAny) {
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const showList = async ({
        action,
        params = {},
        title = "Hasil",
        subtitle = ""
      }) => {
        const data = await apiGet(action, params);
        const results = data?.result || [];
        if (!results.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Tidak ada gallery yang ditemukan.");
        }
        const page = Number(params.page || 1);
        const perPage = data.per_page || results.length || 25;
        const total = data.total;
        const totalPages = data.num_pages || (total ? Math.ceil(total / perPage) : page + (results.length >= 25 ? 1 : 0)) || 1;
        const rows = results.slice(0, 10).map((g, i) => ({
          title: `${i + 1}. ${truncate(galleryTitle(g), 65)}`,
          id: galleryCommand(prefix, g.id),
          description: `${g.num_pages || "?"} halaman • ${g.num_favorites || 0} favorit`
        }));
        const sections = [{
          title: "📚 PILIH GALLERY",
          rows: rows
        }];
        const buildPageCmd = nextPage => {
          const parts = [`${prefix}nhentai`];
          if (action === "search") parts.push(`-q "${params.query}"`);
          if (action === "tagged") parts.push(`-t ${params.tag_id}`);
          if (action === "popular") parts.push("--popular");
          if (action === "galleries") parts.push("--galleries");
          if (action === "related") parts.push(`--related -i ${params.id}`);
          if (params.sort) parts.push(`--sort ${params.sort}`);
          parts.push(`-p ${nextPage}`);
          return parts.join(" ");
        };
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📂 DAFTAR GALLERY",
            sections: sections
          })
        }];
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: buildPageCmd(page - 1)
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: buildPageCmd(page + 1)
            })
          });
        }
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎲 Random",
            id: `${prefix}nhentai --random`
          })
        });
        const first = results[0];
        const nhentaiUrl = first?.id ? `https://nhentai.net/g/${first.id}/` : "https://nhentai.net/";
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "🌐 Buka NHentai",
            url: nhentaiUrl,
            merchant_url: nhentaiUrl
          })
        });
        const bodyText = `–  *N H E N T A I*

${subtitle ? `${subtitle}\n\n` : ""}┌  ◦  *Hasil* : ${title}
│  ◦  *Total* : ${total || "?"}
│  ◦  *Page* : ${page} / ${totalPages}
└  ◦  *Ditampilkan* : ${rows.length} dari ${results.length}

Pilih gallery lewat menu di bawah.

⚠️ Konten 18+`;
        const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
        const options = {
          image: bannerImage,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • NHentai`,
              button_title: "Lihat Opsi"
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, options);
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
      };
      const showDetail = async id => {
        const data = await apiGet("detail", {
          id: id
        });
        const gid = data?.id || id;
        const title = galleryTitle(data);
        const tags = (data.tags || []).filter(t => ["tag", "parody", "artist", "group", "category"].includes(t.type)).slice(0, 14).map(t => t.name).join(", ");
        const coverPath = data.cover?.path || data.thumbnail?.path;
        const cover = coverPath ? await imageUrl(coverPath, false) : null;
        const bodyText = `–  *N H E N T A I*

📖 *${truncate(title, 130)}*

┌  ◦  *ID* : ${gid}
│  ◦  *Pages* : ${data.num_pages || "?"}
│  ◦  *Favorites* : ${data.num_favorites || 0}
│  ◦  *Upload* : ${formatDate(data.upload_date)}
└  ◦  *Tags* : ${truncate(tags || "-", 180)}

⚠️ Konten 18+`;
        const nhentaiUrl = `https://nhentai.net/g/${gid}/`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎲 Random",
            id: `${prefix}nhentai --random`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🔁 Related",
            id: `${prefix}nhentai --related -i ${gid}`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💬 Komentar",
            id: `${prefix}nhentai --comments -i ${gid}`
          })
        }, {
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "🌐 Buka NHentai",
            url: nhentaiUrl,
            merchant_url: nhentaiUrl
          })
        }];
        const options = {
          image: cover || undefined,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • NHentai Detail`,
              button_title: "Lihat Opsi"
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, options);
        } else if (cover) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: cover
            },
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(bodyText);
        }
        await ctx.react("✅");
      };
      if (flags.config || flags.cdn || flags.zones) {
        const action = flags.config ? "config" : flags.cdn ? "cdn" : "zones";
        const data = await apiGet(action);
        await ctx.reply(`– *NHENTAI ${action.toUpperCase()}*\n\n\`\`\`${JSON.stringify(data, null, 2).slice(0, 3500)}\`\`\``);
        return ctx.react("✅");
      }
      if (flags.random) {
        const data = await apiGet("random");
        if (!data?.id) throw new Error("Gagal mendapatkan gallery random.");
        return showDetail(data.id);
      }
      if (flags.related && flags.id) {
        return showList({
          action: "related",
          params: {
            id: flags.id
          },
          title: `Related dari #${flags.id}`,
          subtitle: `Gallery terkait ID ${flags.id}`
        });
      }
      if (flags.comments && flags.id) {
        const data = await apiGet("comments", {
          id: flags.id,
          page: Number(flags.page) || 1,
          per_page: 25
        });
        const comments = data?.result || [];
        if (!comments.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Tidak ada komentar pada gallery ini.");
        }
        let body = `–  *N H E N T A I  C O M M E N T S*\n\n`;
        body += `Gallery ID: ${flags.id}\n`;
        body += `Total: ${data.total || comments.length}\n\n`;
        comments.slice(0, 10).forEach((c, i) => {
          body += `${i + 1}. *${truncate(c.poster?.username || "anon", 30)}*\n`;
          body += `${truncate(c.body || "-", 220)}\n\n`;
        });
        await ctx.reply(body);
        return ctx.react("✅");
      }
      if (flags.tags) {
        const query = flags.query || cleanPrompt || "";
        const data = await apiGet("tags", {
          query: query
        });
        const tags = data?.result || [];
        if (!tags.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Tag tidak ditemukan.");
        }
        let body = `–  *N H E N T A I  T A G S*\n\n`;
        body += `Query: ${query || "(default)"}\n\n`;
        tags.slice(0, 20).forEach(t => {
          body += `• *${t.name}* — ${t.type} — ID: ${t.id}\n`;
        });
        await ctx.reply(body);
        return ctx.react("✅");
      }
      if (flags.id) {
        return showDetail(flags.id);
      }
      if (flags.popular) {
        return showList({
          action: "popular",
          params: {
            page: Number(flags.page) || 1
          },
          title: "Popular",
          subtitle: "Gallery populer NHentai"
        });
      }
      if (flags.galleries) {
        return showList({
          action: "galleries",
          params: {
            page: Number(flags.page) || 1
          },
          title: "Latest",
          subtitle: "Gallery terbaru NHentai"
        });
      }
      if (flags.tag) {
        return showList({
          action: "tagged",
          params: {
            tag_id: flags.tag,
            sort: flags.sort || "date",
            page: Number(flags.page) || 1
          },
          title: `Tag ID ${flags.tag}`,
          subtitle: `Gallery dengan tag ${flags.tag}`
        });
      }
      const query = flags.query || cleanPrompt;
      if (query) {
        return showList({
          action: "search",
          params: {
            query: query,
            page: Number(flags.page) || 1,
            sort: flags.sort || "date"
          },
          title: `"${truncate(query, 60)}"`,
          subtitle: "Hasil pencarian NHentai"
        });
      }
      return ctx.reply(helpText);
    } catch (error) {
      console.error("[NHentai Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error?.message || "Unknown error";
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      return ctx.reply(`❌ Terjadi kesalahan: ${errorMessage}`);
    }
  }
};