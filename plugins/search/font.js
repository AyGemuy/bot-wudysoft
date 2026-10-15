import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  BASE_URL: `${global.bot?.api?.wudysoft}/api/search/font`,
  ENDPOINTS: {
    v1: `${global.bot?.api?.wudysoft}/api/search/font`,
    v2: `${global.bot?.api?.wudysoft}/api/search/font/v2`,
    v3: `${global.bot?.api?.wudysoft}/api/search/font/v3`,
    v4: `${global.bot?.api?.wudysoft}/api/search/font/v4`,
    v6: `${global.bot?.api?.wudysoft}/api/search/font/v6`,
    v7: `${global.bot?.api?.wudysoft}/api/search/font/v7`
  },
  TIMEOUT: 3e4,
  API_TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
const fontCache = new Map();

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
      url: ["u", "link"]
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
  if (["1", "dafont"].includes(v)) return "v1";
  if (["2", "v2", "all"].includes(v)) return "v2";
  if (["3", "1001fonts"].includes(v)) return "v3";
  if (["4", "8font", "lapanfont"].includes(v)) return "v4";
  if (["6", "fontdownload"].includes(v)) return "v6";
  if (["7", "1001freefonts", "freefonts"].includes(v)) return "v7";
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
async function callFontApi({
  version = "v2",
  action = "search",
  query = "",
  url = "",
  page = 1
}) {
  const endpoint = CONFIG.ENDPOINTS[version] || CONFIG.ENDPOINTS.v2;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": CONFIG.USER_AGENT
  };
  let payload = {};
  switch (version) {
    case "v1":
      payload = {
        action: action,
        query: url || query
      };
      break;
    case "v3":
      payload = {
        query: query,
        page: page
      };
      break;
    case "v4":
      payload = action === "detail" ? {
        action: "detail",
        url: url
      } : {
        action: "search",
        q: query,
        page: page
      };
      break;
    case "v6":
      payload = {
        query: query,
        page: String(page)
      };
      break;
    case "v7":
      payload = {
        query: query,
        page: page
      };
      break;
    case "v2":
    default:
      payload = {
        action: action,
        query: url || query,
        page: page
      };
      break;
  }
  const res = await axios.post(endpoint, payload, {
    headers: headers,
    timeout: CONFIG.API_TIMEOUT
  });
  const resData = res?.data;
  let normalizedList = [];
  if (Array.isArray(resData)) {
    normalizedList = resData;
  } else if (Array.isArray(resData?.result)) {
    normalizedList = resData.result;
  } else if (Array.isArray(resData?.result?.fonts)) {
    normalizedList = resData.result.fonts;
  } else if (Array.isArray(resData?.fonts)) {
    normalizedList = resData.fonts;
  }
  const items = normalizedList.map(item => ({
    title: item.title || item.name || item.font_name || "No Title",
    author: item.author || item.designer || "-",
    link: item.link || item.detailUrl || item.authorLink || null,
    download_url: item.download || item.downloadUrl || item.downloadLink || item.download_url || null,
    preview_image: item.previewImage || item.preview_image || item.image || item.imageUrl || null,
    categories: Array.isArray(item.categories) ? item.categories.join(", ") : item.categories || item.theme || "-"
  }));
  return {
    raw: resData,
    version: version,
    items: items,
    detail: !Array.isArray(resData) && typeof resData === "object" ? resData?.result || resData : null
  };
}
export default {
  name: "font",
  aliases: ["fontsearch", "dafont", "freefonts", "8font", "downloadfont", "fontdl"],
  description: "Cari & download font gratis (.zip/.ttf) dengan pilihan engine versi interaktif",
  category: "Search",
  limit: true,
  example: "font arial\nfont bebas -v v1\nfont vintage -v v3\nfont -u https://www.dafont.com/bebas-neue.font",
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
        if (["font", "fontsearch", "dafont", "freefonts", "8font", "downloadfont", "fontdl"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const targetQuery = cleanPrompt || flags.url;
      if (!targetQuery && flags.index === undefined) {
        const helpText = `– *F O N T*\n\n` + `┌ ◦ *Usage* : ${prefix}font <query / url>\n` + `│ ◦ *Version* : ${prefix}font <query> -v <v1-v7>\n` + `└ ◦ *Function* : Mencari & mengunduh font gratis (.zip/.ttf)\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Search* : ${prefix}font arial\n` + `│ ◦ *By Engine* : ${prefix}font bebas -v v1\n` + `│ ◦ *By Index* : ${prefix}font arial -v v2 -i 1\n` + `└ ◦ *By URL* : ${prefix}font -u https://www.dafont.com/bebas-neue.font\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      const selectedVer = resolveVersion(flags.version);
      if (!selectedVer && !flags.url && !targetQuery.startsWith("http") && flags.index === undefined) {
        const versionRows = [{
          title: "Dafont Original (v1)",
          id: `${prefix}font "${targetQuery}" -v v1`,
          description: "Engine resmi Dafont.com (Original Engine)"
        }, {
          title: "Dafont Unified (v2) [Rekomendasi]",
          id: `${prefix}font "${targetQuery}" -v v2`,
          description: "Engine Dafont.com v2 terintegrasi & stabil"
        }, {
          title: "1001Fonts Engine (v3)",
          id: `${prefix}font "${targetQuery}" -v v3`,
          description: "Database lengkap dari 1001Fonts.com"
        }, {
          title: "8Font Engine (v4)",
          id: `${prefix}font "${targetQuery}" -v v4`,
          description: "Pencarian font dari 8Font.com"
        }, {
          title: "Font.download Engine (v6)",
          id: `${prefix}font "${targetQuery}" -v v6`,
          description: "Pencarian font modern dari Font.download"
        }, {
          title: "1001FreeFonts Engine (v7)",
          id: `${prefix}font "${targetQuery}" -v v7`,
          description: "Pencarian font gratis dari 1001FreeFonts.com"
        }];
        const listSections = [{
          title: "PILIH ENGINE / VERSI API",
          rows: versionRows
        }];
        const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
        const bodyText = `– *F O N T  -  E N G I N E*\n\n` + `┌ ◦ *Query* : ${targetQuery}\n` + `│ ◦ *Engines* : 6 Provider (v1 - v7)\n` + `└ ◦ *Action* : Pilih engine provider pada tombol di bawah\n\n` + `${footer}`;
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
              list_title: `${botName} • Font Selector`,
              button_title: "Pilih Engine"
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, `${botName} • Font Suite`, buttons, options);
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
      const activeVer = selectedVer || "v2";
      if (flags.url || targetQuery.startsWith("http")) {
        const fontUrl = flags.url || targetQuery;
        const apiRes = await callFontApi({
          version: activeVer,
          action: "detail",
          url: fontUrl
        });
        const fontInfo = apiRes.detail || {};
        const fontTitle = fontInfo.title || fontInfo.font_name || "Font";
        const downloadUrl = fontInfo.download || fontInfo.download_url || fontInfo.link;
        const previewImg = fontInfo.preview_image || fontInfo.image;
        if (!downloadUrl && !fontInfo.title) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memuat data\n` + `└ ◦ *Info* : Tautan font tidak valid atau unduhan tidak tersedia.\n\n` + `${footer}`);
        }
        const caption = `– *F O N T  -  D E T A I L*\n\n` + `┌ ◦ *Title* : ${fontTitle}\n` + `│ ◦ *Author* : ${fontInfo.author || fontInfo.designer || "-"}\n` + `│ ◦ *Theme* : ${fontInfo.theme || fontInfo.categories || "-"}\n` + `│ ◦ *Downloads* : ${fontInfo.total_downloads_formatted || fontInfo.total_downloads || fontInfo.dl_count || "-"}\n` + `│ ◦ *License* : ${fontInfo.license_note || fontInfo.note || "Free"}\n` + `└ ◦ *Engine* : ${activeVer.toUpperCase()}\n\n` + `${footer}`;
        if (previewImg) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: previewImg
            },
            caption: caption
          }, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(caption);
        }
        if (downloadUrl) {
          const zipBuffer = await fetchBuffer(downloadUrl);
          const fileName = `${fontTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}.zip`;
          await sock.sendMessage(ctx.id, {
            document: zipBuffer,
            fileName: fileName,
            mimetype: "application/zip",
            caption: `– *F O N T* : *${fontTitle}* (.zip)`
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.react("✅");
      }
      let searchData = null;
      const userCached = fontCache.get(senderId);
      if (userCached && userCached.query === targetQuery && userCached.version === activeVer && userCached.page === (flags.page || 1) && userCached.items?.length) {
        searchData = userCached;
      } else {
        const apiRes = await callFontApi({
          version: activeVer,
          action: "search",
          query: targetQuery,
          page: flags.page || 1
        });
        if (!apiRes?.items?.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Font tidak ditemukan\n` + `└ ◦ *Query* : "${targetQuery}" [${activeVer.toUpperCase()}]\n\n` + `${footer}`);
        }
        searchData = {
          query: targetQuery,
          version: activeVer,
          page: Number(flags.page) || 1,
          items: apiRes.items
        };
        if (fontCache.size > 50) fontCache.clear();
        fontCache.set(senderId, searchData);
      }
      const fontList = searchData.items || [];
      if (flags.index !== undefined) {
        const targetIdx = Number(flags.index) - 1;
        const selectedFont = fontList[targetIdx];
        if (!selectedFont) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Indeks font salah\n` + `└ ◦ *Index* : #${flags.index}\n\n` + `${footer}`);
        }
        let downloadUrl = selectedFont.download_url;
        let fontTitle = selectedFont.title;
        let previewImg = selectedFont.preview_image;
        if (!downloadUrl && selectedFont.link) {
          const detailRes = await callFontApi({
            version: activeVer,
            action: "detail",
            url: selectedFont.link
          });
          const d = detailRes.detail || {};
          downloadUrl = d.download || d.download_url || d.link;
          fontTitle = d.title || d.font_name || fontTitle;
          previewImg = d.preview_image || d.image || previewImg;
        }
        if (!downloadUrl) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Unduhan tidak tersedia\n` + `└ ◦ *Font* : ${fontTitle}\n\n` + `${footer}`);
        }
        const infoText = `– *F O N T  -  D O W N L O A D*\n\n` + `┌ ◦ *Title* : ${fontTitle}\n` + `│ ◦ *Author* : ${selectedFont.author || "-"}\n` + `└ ◦ *Engine* : ${activeVer.toUpperCase()}\n\n` + `_Sedang mengirim berkas font (.zip)..._\n\n` + `${footer}`;
        if (previewImg) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: previewImg
            },
            caption: infoText
          }, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(infoText);
        }
        const fileBuffer = await fetchBuffer(downloadUrl);
        const cleanName = fontTitle.replace(/[^a-zA-Z0-9_-]/g, "_");
        await sock.sendMessage(ctx.id, {
          document: fileBuffer,
          fileName: `${cleanName}.zip`,
          mimetype: "application/zip",
          caption: `– *F O N T* : *${fontTitle}* (.zip)`
        }, {
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      const totalFonts = fontList.length;
      const currentPage = Number(searchData.page) || 1;
      const fontRows = fontList.map((f, i) => ({
        title: `${i + 1}. ${f.title}`.slice(0, 24),
        id: `${prefix}font "${targetQuery}" -v ${activeVer} -i ${i + 1}`,
        description: `By: ${f.author} • Kat: ${f.categories}`.slice(0, 60)
      }));
      const listSections = [{
        title: `HASIL PENCARIAN (${totalFonts} Font | Engine: ${activeVer.toUpperCase()})`,
        rows: fontRows
      }];
      const bannerImage = fontList[0]?.preview_image || "https://files.catbox.moe/g2e6i5.jpg";
      const bodyText = `– *F O N T  -  S E A R C H*\n\n` + `┌ ◦ *Query* : "${targetQuery}"\n` + `│ ◦ *Engine* : ${activeVer.toUpperCase()}\n` + `│ ◦ *Page* : ${currentPage}\n` + `└ ◦ *Total* : ${totalFonts} Font\n\n` + `_Pilih font pada menu di bawah untuk mengunduh berkas (.zip):_\n\n` + `${footer}`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "PILIH & UNDUH FONT",
          sections: listSections
        })
      }];
      if (currentPage > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `Hal ${currentPage - 1}`,
            id: `${prefix}font "${targetQuery}" -v ${activeVer} -p ${currentPage - 1}`
          })
        });
      }
      buttons.push({
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: `Hal ${currentPage + 1}`,
          id: `${prefix}font "${targetQuery}" -v ${activeVer} -p ${currentPage + 1}`
        })
      });
      const options = {
        image: bannerImage,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Font Finder`,
            button_title: "Daftar Font"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • Font Downloader`, buttons, options);
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
      console.error("[Font Feature Error]:", error);
      await ctx.react("❌");
      let errorMessage = error?.message || "Terjadi kesalahan";
      if (error?.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {}
      }
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errorMessage}\n` + `└ ◦ *Command* : ${ctx.command || "font"}\n\n` + `${footer}`);
    }
  }
};