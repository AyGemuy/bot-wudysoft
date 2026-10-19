import axios from "axios";
import { simpleQuoted } from "../../lib/quoted.js";

const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/search/wattpad`,
  TIMEOUT: 3e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  DEFAULT_LIMIT: 20,
  DEFAULT_LANG: "20"
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
      search: ["s", "q", "query"],
      detail: ["u", "info", "story"],
      read: ["r", "read", "chapter", "eps", "ch"],
      parts: ["p", "parts", "viewparts"],
      id: ["id"],
      limit: ["l", "limit"],
      offset: ["o", "offset"],
      page: ["pg", "page"],
      mature: ["m", "mature", "nsfw"],
      language: ["lang", "language"]
    };

    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }

    if (rawVal !== undefined) {
      if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
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

  // Deteksi URL Wattpad otomatis (story ID atau part ID)
  if (!flags.detail && !flags.read && /^https?:\/\/(?:www\.)?wattpad\.com\/.+/i.test(cleanPrompt)) {
    const storyMatch = cleanPrompt.match(/\/story\/(\d+)/i);
    const partMatch = cleanPrompt.match(/\/(\d+)-/i);
    if (storyMatch) {
      flags.detail = storyMatch[1];
    } else if (partMatch) {
      flags.read = partMatch[1];
    }
  }

  return { flags, cleanPrompt };
}

export default {
  name: "wattpad",
  aliases: ["wattpad", "wp", "wpad"],
  description: "Cari, lihat info rincian cerita, daftar bab, dan baca novel Wattpad lengkap dengan media cover",
  category: "Internet",
  limit: true,
  example: "• Cari: .wattpad -q Nakula -l 10 -lang 20\n• Detail Info: .wattpad -u 404861003\n• View Parts: .wattpad --parts 1593195623\n• Baca Bab: .wattpad -r 1593195623",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["wattpad", "wp", "wpad"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }

      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Wattpad Reader`;
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const targetChat = ctx.chat || ctx.id;

      const { flags, cleanPrompt } = parseFlags(rawText);

      // Parameter Helper Flags
      const targetId = flags.id || flags.detail || flags.read || flags.parts;
      const query = flags.search || cleanPrompt;
      const limit = Number(flags.limit) || CONFIG.DEFAULT_LIMIT;
      const offset = Number(flags.offset) || 0;
      const pageNum = Number(flags.page) || 1;
      const mature = flags.mature !== undefined ? (String(flags.mature) === "true" || flags.mature === true) : true;
      const language = flags.language ? String(flags.language) : CONFIG.DEFAULT_LANG;

      // 1. FITUR BACA TEKS BAB (action=read)
      if (flags.read) {
        const partId = String(flags.read).trim();
        await ctx.react?.("⏳");

        const [partRes, storyTextRes] = await Promise.all([
          axios.get(CONFIG.API_URL, {
            params: { action: "viewParts", id: partId },
            headers: { "User-Agent": CONFIG.USER_AGENT },
            timeout: CONFIG.TIMEOUT
          }).then(res => res.data).catch(() => null),

          axios.get(CONFIG.API_URL, {
            params: { action: "read", id: partId },
            headers: { "User-Agent": CONFIG.USER_AGENT },
            timeout: CONFIG.TIMEOUT
          }).then(res => res.data).catch(() => null)
        ]);

        const fullText = storyTextRes?.text;
        if (!fullText) {
          await ctx.react?.("❌");
          return ctx.reply("❌ Gagal memuat teks bab. Bab mungkin tidak ditemukan atau dikunci (paywalled).");
        }

        const title = partRes?.title || "Bab Wattpad";
        const storyTitle = partRes?.group?.title || "Cerita Wattpad";
        const author = partRes?.group?.user?.name || "-";
        const coverImg = partRes?.group?.cover || global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";

        // Paginated text reading jika teks sangat panjang
        const chunkSize = 3500;
        const totalTextPages = Math.ceil(fullText.length / chunkSize) || 1;
        const currentTextPage = Math.min(Math.max(pageNum, 1), totalTextPages);
        const startIndex = (currentTextPage - 1) * chunkSize;
        const textChunk = fullText.slice(startIndex, startIndex + chunkSize);

        const bodyText = `Hi ${userName}! Selamat membaca.

–  *W A T T P A D  R E A D E R*

┌  ◦  *Judul Story* : ${storyTitle}
│  ◦  *Bab / Part* : ${title}
│  ◦  *Penulis* : ${author}
│  ◦  *Kata* : ${partRes?.wordCount?.toLocaleString() || 0}
└  ◦  *Halaman Teks* : ${currentTextPage} / ${totalTextPages}

───────────────────

${textChunk}${fullText.length > startIndex + chunkSize ? "\n\n...(Teks belum selesai, gunakan tombol/flag untuk halaman berikutnya)..." : ""}`;

        const buttons = [];
        const partsList = partRes?.group?.parts || [];
        const currentIndex = partsList.findIndex(p => String(p.id) === String(partId));

        if (currentTextPage < totalTextPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `📄 Hal Teks ${currentTextPage + 1}`,
              id: `${prefix}wattpad -r ${partId} -p ${currentTextPage + 1}`
            })
          });
        } else if (currentIndex !== -1 && currentIndex < partsList.length - 1) {
          const nextPart = partsList[currentIndex + 1];
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⏭️ Bab Selanjutnya (${nextPart.title})`.slice(0, 24),
              id: `${prefix}wattpad -r ${nextPart.id}`
            })
          });
        }

        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "🔗 Buka di Wattpad",
            url: partRes?.url || `https://www.wattpad.com/${partId}`,
            merchant_url: partRes?.url || `https://www.wattpad.com/${partId}`
          })
        });

        const options = {
          image: coverImg,
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };

        await ctx.react?.("✅");
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, botFooter, buttons, options);
        } else {
          return await sock.sendMessage(targetChat, {
            image: { url: coverImg },
            caption: bodyText
          }, { quoted: quotedMsg });
        }
      }

      // 2. FITUR VIEW PARTS / RINCIAN BAB (action=viewParts)
      if (flags.parts) {
        const partId = String(flags.parts).trim();
        await ctx.react?.("⏳");

        const { data: res } = await axios.get(CONFIG.API_URL, {
          params: { action: "viewParts", id: partId },
          headers: { "User-Agent": CONFIG.USER_AGENT },
          timeout: CONFIG.TIMEOUT
        });

        if (!res || res.error || !res.id) {
          await ctx.react?.("❌");
          return ctx.reply("❌ Rincian bab/part Wattpad tidak ditemukan.");
        }

        const groupParts = res.group?.parts || [];
        const coverImg = res.group?.cover || "https://files.catbox.moe/g2e6i5.jpg";
        const partRows = groupParts.slice(0, 50).map(p => ({
          title: `${p.title || "Part"}`.slice(0, 24),
          id: `${prefix}wattpad -r ${p.id}`,
          description: `Klik untuk membaca bab ini`
        }));

        const bodyText = `–  *W A T T P A D  V I E W  P A R T S*

┌  ◦  *Judul Story* : ${res.group?.title || "-"}
│  ◦  *Penulis* : ${res.group?.user?.name || res.group?.user?.username || "-"}
│  ◦  *Part Terpilih* : ${res.title}
│  ◦  *Kata* : ${res.wordCount?.toLocaleString() || 0} Kata
│  ◦  *Dibaca* : 👀 ${res.readCount?.toLocaleString() || 0}
│  ◦  *Di-Vote* : ⭐ ${res.voteCount?.toLocaleString() || 0}
└  ◦  *Total Parts* : ${groupParts.length} Bab`;

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📖 DAFTAR SEMUA BAB",
            sections: [{ title: "Daftar Parts", rows: partRows }]
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📖 Baca Part Ini",
            id: `${prefix}wattpad -r ${res.id}`
          })
        }, {
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "🌐 Tonton di Web",
            url: res.url || `https://www.wattpad.com/${res.id}`,
            merchant_url: res.url || `https://www.wattpad.com/${res.id}`
          })
        }];

        const options = {
          image: coverImg,
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };

        await ctx.react?.("✅");
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, botFooter, buttons, options);
        } else {
          return await sock.sendMessage(targetChat, {
            image: { url: coverImg },
            caption: bodyText
          }, { quoted: quotedMsg });
        }
      }

      // 3. FITUR DETAIL CERITA & DAFTAR BAB (action=detail)
      if (flags.detail || (flags.id && !query)) {
        const storyId = String(targetId).trim();
        await ctx.react?.("⏳");

        const { data: res } = await axios.get(CONFIG.API_URL, {
          params: { action: "detail", id: storyId },
          headers: { "User-Agent": CONFIG.USER_AGENT },
          timeout: CONFIG.TIMEOUT
        });

        if (!res || res.deleted || res.error) {
          await ctx.react?.("❌");
          return ctx.reply("❌ Cerita Wattpad tidak ditemukan atau telah dihapus.");
        }

        const cleanDesc = (res.description || "Tidak ada deskripsi.").slice(0, 300);
        const parts = res.parts || [];
        const coverImg = res.cover || "https://files.catbox.moe/g2e6i5.jpg";
        const tags = res.tags ? res.tags.slice(0, 8).map(t => `#${t}`).join(" ") : "-";

        const episodeRows = parts.slice(0, 50).map((p, idx) => ({
          title: `[#${idx + 1}] ${p.title || "Bab"}`.slice(0, 24),
          id: `${prefix}wattpad -r ${p.id}`,
          description: `⭐ ${p.voteCount?.toLocaleString() || 0} • 👀 ${p.readCount?.toLocaleString() || 0}`
        }));

        const bodyText = `–  *W A T T P A D  I N F O  L E N G K A P*

┌  ◦  *Judul* : ${res.title}
│  ◦  *ID Story* : \`${res.id}\`
│  ◦  *Penulis* : ${res.user?.name || res.user?.fullname || "-"}
│  ◦  *Total Dibaca* : 👀 ${res.readCount?.toLocaleString() || 0}
│  ◦  *Total Vote* : ⭐ ${res.voteCount?.toLocaleString() || 0}
│  ◦  *Total Komentar* : 💬 ${res.commentCount?.toLocaleString() || 0}
│  ◦  *Status* : ${res.completed ? "Selesai ✅" : "Ongoing 🔄"}
│  ◦  *Total Bab* : ${parts.length} Bab
│  ◦  *Bahasa* : ${res.language?.name || language}
└  ◦  *Tagar* : ${tags}

–  *D E S K R I P S I*

“${cleanDesc}...”

Pilih bab pada menu di bawah untuk mulai membaca.`;

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📖 PILIH BAB / PART",
            sections: [{ title: `DAFTAR BAB (${parts.length} Bab)`, rows: episodeRows }]
          })
        }];

        if (parts[0]?.id) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "▶️ Baca Bab Awal",
              id: `${prefix}wattpad -r ${parts[0].id}`
            })
          });
        }

        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "🌐 Buka Link Wattpad",
            url: res.url || `https://www.wattpad.com/story/${res.id}`,
            merchant_url: res.url || `https://www.wattpad.com/story/${res.id}`
          })
        });

        const options = {
          image: coverImg,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Wattpad Detail`,
              button_title: "Buka Daftar Bab"
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };

        await ctx.react?.("✅");
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, botFooter, buttons, options);
        } else {
          return await sock.sendMessage(targetChat, {
            image: { url: coverImg },
            caption: bodyText
          }, { quoted: quotedMsg });
        }
      }

      // 4. MENU UTAMA/PANDUAN JIKA TANPA PARAMETER
      if (!query) {
        return ctx.reply(`–  *W A T T P A D  F E A T U R E*

Pusat pencarian, rincian cerita lengkap, dan pembaca novel Wattpad.

┌  ◦  *Format* : \`${prefix}wattpad <judul>\` [flags]
│  ◦  *Detail Story* : \`${prefix}wattpad -u <id_cerita>\`
│  ◦  *Rincian Part* : \`${prefix}wattpad --parts <id_part>\`
│  ◦  *Baca Bab* : \`${prefix}wattpad -r <id_bab>\`
└  ◦  *Contoh* : \`${prefix}wattpad -q Nakula -l 10 -m true -lang 20\`

–  *F U L L  H E L P E R  F L A G S*

┌  ◦  *-q, -s, --query* : Kata kunci pencarian
│  ◦  *-u, --detail* : ID Story untuk statistik & daftar bab
│  ◦  *-r, --read* : ID Part/Bab untuk membaca teks
│  ◦  *-p, --parts* : ID Part untuk rincian bab
│  ◦  *-l, --limit* : Batas jumlah hasil (default: 20)
│  ◦  *-o, --offset* : Pergeseran offset pencarian
│  ◦  *-m, --mature* : Konten dewasa (true/false)
└  ◦  *-lang, --language* : Kode Bahasa (default: 20 ID)`);
      }

      // 5. FITUR PENCARIAN CERITA (action=search)
      await ctx.react?.("⏳");
      const { data: searchResult } = await axios.get(CONFIG.API_URL, {
        params: {
          action: "search",
          query: query,
          limit: limit,
          offset: offset,
          mature: mature,
          language: language
        },
        headers: { "User-Agent": CONFIG.USER_AGENT },
        timeout: CONFIG.TIMEOUT
      });

      const stories = searchResult?.stories || [];
      if (!stories.length) {
        await ctx.react?.("❌");
        return ctx.reply(`❌ Tidak ditemukan cerita Wattpad untuk kata kunci: *"${query}"*`);
      }

      const topStory = stories[0];
      const coverImg = topStory.cover || "https://files.catbox.moe/g2e6i5.jpg";

      const searchRows = stories.map((item, idx) => ({
        title: `[#${offset + idx + 1}] ${item.title}`.slice(0, 24),
        id: `${prefix}wattpad -u ${item.id}`,
        description: `Penulis: ${item.user?.name || "-"} • ⭐ ${item.voteCount || 0}`
      }));

      const bodyText = `Hi ${userName}! Ditemukan ${searchResult.total?.toLocaleString() || stories.length} cerita.

–  *W A T T P A D  S E A R C H*

┌  ◦  *Kata Kunci* : "${query}"
│  ◦  *Hasil Teratas* : ${topStory.title}
│  ◦  *Penulis* : ${topStory.user?.name || "-"}
│  ◦  *Total Dibaca* : 👀 ${topStory.readCount?.toLocaleString() || 0}
│  ◦  *Total Vote* : ⭐ ${topStory.voteCount?.toLocaleString() || 0}
│  ◦  *Jumlah Bab* : ${topStory.numParts || "-"} Bab
└  ◦  *Offset / Limit* : ${offset} / ${limit}

Pilih cerita dari menu di bawah untuk melihat rincian detail dan membaca.`;

      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `📚 HASIL PENCARIAN (${stories.length})`,
          sections: [{ title: `Daftar Cerita (Offset ${offset})`, rows: searchRows }]
        })
      }];

      if (searchResult.nextUrl || stories.length >= limit) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Halaman Selanjutnya`,
            id: `${prefix}wattpad -q "${query}" -o ${offset + limit} -l ${limit} -m ${mature} -lang ${language}`
          })
        });
      }

      const options = {
        image: coverImg,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Wattpad Search`,
            button_title: "Lihat Hasil"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };

      await ctx.react?.("✅");
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, options);
      } else {
        await sock.sendMessage(targetChat, {
          image: { url: coverImg },
          caption: bodyText
        }, { quoted: quotedMsg });
      }

    } catch (error) {
      console.error("[Wattpad Error]:", error?.message || error);
      await ctx.react?.("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan pada fitur Wattpad: ${errorMessage}`);
    }
  }
};
