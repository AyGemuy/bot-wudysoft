import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  SEARCH_V1_URL: `${global.bot?.api?.wudysoft}/api/search/twibbon/v1`,
  SEARCH_V2_URL: `${global.bot?.api?.wudysoft}/api/search/twibbon/v2`,
  MAKER_URL: `${global.bot?.api?.wudysoft}/api/maker/twibbon/v1`,
  TIMEOUT: 45e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
};
const twibbonCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      set: ["s", "select", "pilih"],
      page: ["p", "pg", "halaman"],
      version: ["v", "ver", "versi"],
      v1: ["twibbonize"],
      v2: ["twibify", "alt"],
      limit: ["l", "numitems", "perpage"],
      sort: ["st", "urutan"],
      detail: ["d", "rinci"],
      category: ["cat", "kategori"]
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
async function resolveAvatarBuffer(sock, ctx, msg) {
  const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const mime = quotedMsg?.imageMessage?.mimetype || msg.message?.imageMessage?.mimetype;
  if (mime) {
    try {
      const downloadMsg = quotedMsg?.imageMessage ? {
        message: quotedMsg
      } : msg;
      const buffer = await sock.downloadMediaMessage(downloadMsg);
      if (buffer) return buffer;
    } catch (e) {
      console.error("[Twibbon] Gagal mengunduh gambar dari chat:", e);
    }
  }
  const mentionedJid = ctx.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;
  const targetJid = mentionedJid || ctx.sender || ctx.author;
  if (targetJid) {
    try {
      const ppUrl = await sock.profilePictureUrl(targetJid, "image");
      if (ppUrl) {
        const res = await axios.get(ppUrl, {
          responseType: "arraybuffer",
          timeout: 15e3
        });
        return Buffer.from(res.data);
      }
    } catch (_) {}
  }
  return null;
}
export default {
  name: "twibbon",
  aliases: ["twib", "frametwibbon", "twibify"],
  description: "Cari, pilih frame, dan buat Twibbon dengan foto kamu",
  category: "Maker",
  limit: true,
  example: "twibbon hut tni --v1 -p 1 atau twibbon --set 1",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["twibbon", "twib", "frametwibbon", "twibify"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Twibbon Generator`;
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const userCached = twibbonCache.get(senderId);
      if (flags.set !== undefined && userCached?.searchResults) {
        const selectIdx = Number(flags.set) - 1;
        const selected = userCached.searchResults[selectIdx];
        if (!selected) {
          await ctx.react("❌");
          return ctx.reply(`❌ Pilihan #${flags.set} tidak ditemukan. Pilih angka antara 1 - ${userCached.searchResults.length}`);
        }
        let frameUrl = selected.frameUrl;
        if (!frameUrl && selected.modules) {
          const frmModule = selected.modules.find(m => m.moduleCode === "FRM" || m.data?.frames);
          frameUrl = frmModule?.data?.frames?.[0];
        }
        if (!frameUrl) {
          frameUrl = selected.image || selected.thumbnail;
        }
        const captionText = selected.caption || selected.modules?.[0]?.data?.caption || selected.description || selected.title || "Support campaign ini!";
        userCached.activeFrame = {
          title: selected.name || selected.title || "Twibbon Campaign",
          frameUrl: frameUrl,
          caption: captionText,
          creator: selected.campaignCreator?.name || selected.creator?.name || "Anonymous"
        };
        twibbonCache.set(senderId, userCached);
        await ctx.react("✅");
        return ctx.reply(`–  *F R A M E  T W I B B O N  S E T*

┌  ◦  *Judul* : ${userCached.activeFrame.title}
├  ◦  *Creator* : ${userCached.activeFrame.creator}
└  ◦  *Caption Info* :
\`\`\`${captionText}\`\`\`

💡 *Langkah Selanjutnya*:
Balas/reply pesan ini dengan *foto/gambar*, atau ketik \`${prefix}twibbon\` sambil *mention @user* untuk membuat twibbon.`);
      }
      const hasImageInChat = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || msg.message?.imageMessage;
      const isMentioning = ctx.mentionedJid?.length > 0;
      if (userCached?.activeFrame && (hasImageInChat || isMentioning || !cleanPrompt && !flags.url)) {
        await ctx.react("⏳");
        const avatarBuffer = await resolveAvatarBuffer(sock, ctx, msg);
        if (!avatarBuffer) {
          await ctx.react("❌");
          return ctx.reply(`❌ Foto tidak ditemukan. Kirim/reply gambar atau mention pengguna untuk menggabungkan foto ke frame *"${userCached.activeFrame.title}"*.`);
        }
        const payload = {
          avatar: avatarBuffer.toString("base64"),
          frame: userCached.activeFrame.frameUrl
        };
        const response = await axios.post(CONFIG.MAKER_URL, payload, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": CONFIG.USER_AGENT
          },
          responseType: "arraybuffer",
          timeout: CONFIG.TIMEOUT
        });
        const resultBuffer = response?.data;
        if (!resultBuffer || resultBuffer.length === 0) {
          throw new Error("Gagal menerima gambar hasil twibbon.");
        }
        const resCaption = `–  *T W I B B O N  G E N E R A T E D*

┌  ◦  *Campaign* : ${userCached.activeFrame.title}
└  ◦  *Creator* : ${userCached.activeFrame.creator}

💬 *Caption Campaign*:
${userCached.activeFrame.caption}`;
        await sock.sendMessage(ctx.id, {
          image: Buffer.from(resultBuffer),
          caption: resCaption
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      const query = cleanPrompt || userCached?.query;
      if (!query && !flags.url) {
        let activeInfo = userCached?.activeFrame ? `\n\n📌 *Frame Terpilih Sesi Ini*:\n└  *Title*: ${userCached.activeFrame.title}` : "";
        return ctx.reply(`–  *T W I B B O N  S E A R C H  &  M A K E R*

Gunakan fitur ini untuk mencari campaign Twibbon & memasang foto kamu.

┌  ◦  *Format Cari* : \`${prefix}twibbon <kata_kunci> [flags]\`
├  ◦  *Pilih Frame* : \`${prefix}twibbon --set <nomor>\`
└  ◦  *Generate* : Reply gambar / Mention user${activeInfo}

–  *F L A G S  &  P A Y L O A D*
┌  ◦  \`--v1\` : Gunakan API Twibbonize (Default)
├  ◦  \`--v2\` : Gunakan API Twibify
├  ◦  \`--page <n>\` : Navigasi halaman (Default: 1)
├  ◦  \`--limit <n>\` : Jumlah item per halaman (Default: 5/12)
├  ◦  \`--sort <newest/support>\` : Pengurutan hasil
└  ◦  \`--category <FRM,BKG>\` : Kategori frame (khusus v1)`);
      }
      await ctx.react("⏳");
      const selectedVersion = flags.v2 ? "v2" : flags.v1 ? "v1" : flags.version === 2 || flags.version === "v2" ? "v2" : "v1";
      const isV2 = selectedVersion === "v2";
      const searchEndpoint = isV2 ? CONFIG.SEARCH_V2_URL : CONFIG.SEARCH_V1_URL;
      const page = Number(flags.page) || 1;
      const limit = Number(flags.limit) || (isV2 ? 12 : 5);
      const payload = isV2 ? {
        query: query,
        page: page,
        perPage: limit,
        sort: flags.sort || "newest"
      } : {
        query: query,
        page: page,
        limit: limit,
        numItems: limit,
        sort: flags.sort || "support",
        category: flags.category || "FRM,BKG",
        detail: flags.detail !== undefined ? flags.detail : true,
        reactive: 1,
        ...flags
      };
      const {
        data
      } = await axios.post(searchEndpoint, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      }).catch(async () => {
        return await axios.get(searchEndpoint, {
          params: payload,
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
      });
      const rawCampaigns = data?.campaigns || data?.results || (Array.isArray(data) ? data : []);
      const totalItems = data?.total || data?.total_count || rawCampaigns.length;
      if (!rawCampaigns || rawCampaigns.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`❌ Campaign Twibbon [${selectedVersion.toUpperCase()}] dengan kata kunci *"${query}"* tidak ditemukan.`);
      }
      const totalPages = Math.ceil(totalItems / limit) || 1;
      twibbonCache.set(senderId, {
        query: query,
        version: selectedVersion,
        currentPage: page,
        totalPages: totalPages,
        searchResults: rawCampaigns,
        activeFrame: userCached?.activeFrame || null
      });
      const listRows = rawCampaigns.map((item, idx) => {
        const itemNum = idx + 1;
        const titleName = item.name || item.title || "Twibbon Campaign";
        const creatorName = item.campaignCreator?.name || item.creator?.name || "Anon";
        return {
          title: `🖼️ #${itemNum} ${titleName.slice(0, 32)}`,
          id: `${prefix}twibbon --set ${itemNum}`,
          description: `By ${creatorName}`
        };
      });
      const listSections = [{
        title: `🎯 HASIL TWIBBON [${selectedVersion.toUpperCase()}] (Hal ${page}/${totalPages})`,
        rows: listRows
      }];
      const bodyText = `Hi ${userName}!
Ditemukan *${totalItems}* campaign Twibbon untuk *"${query}"*.

–  *T W I B B O N  S E A R C H*

┌  ◦  *Engine* : ${selectedVersion.toUpperCase()} (${isV2 ? "Twibify" : "Twibbonize"})
├  ◦  *Total* : ${totalItems} Campaign
└  ◦  *Halaman* : ${page} / ${totalPages}

Pilih salah satu nomor twibbon di bawah untuk menetapkan frame yang akan dipakai.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 PILIH FRAME TWIBBON",
          sections: listSections
        })
      }];
      const versionFlag = isV2 ? "--v2" : "--v1";
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}twibbon "${query}" ${versionFlag} -p ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}twibbon "${query}" ${versionFlag} -p ${page + 1}`
          })
        });
      }
      buttons.push({
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: isV2 ? "🔄 Switch ke v1 (Twibbonize)" : "🔄 Switch ke v2 (Twibify)",
          id: `${prefix}twibbon "${query}" ${isV2 ? "--v1" : "--v2"} -p 1`
        })
      });
      const bannerImage = rawCampaigns[0]?.thumbnail || rawCampaigns[0]?.image || "https://files.catbox.moe/g2e6i5.jpg";
      const options = {
        image: bannerImage,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Twibbon Finder`,
            button_title: "Lihat Daftar Twibbon"
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
    } catch (error) {
      console.error("[Twibbon Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan twibbon: ${errorMessage}`);
    }
  }
};