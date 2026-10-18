import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/anime/mangatoon`;
const CONFIG = {
  TIMEOUT: 45e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  MAX_READ_CHARS: 3500
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
      search: ["s", "q", "query", "word"],
      id: ["novelid", "i", "code"],
      episode: ["ep", "e", "chapter", "bab", "c"],
      doc: ["d", "document", "file"],
      page: ["p", "pg"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      val = rawVal;
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
  name: "mangatoon",
  aliases: ["mtoon", "noveltoon", "toon"],
  description: "Cari dan baca novel/komik MangaToon langsung di WhatsApp",
  category: "Anime",
  limit: true,
  example: "• Cari: .mangatoon Demon Slayer\n• Pilih Bab: .mangatoon --id 6307265\n• Baca Bab: .mangatoon --id 6307265 -e 1\n• Kirim Dokumen: .mangatoon --id 6307265 -e 1 --doc",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • MangaToon Reader`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const targetChat = ctx.chat || ctx.id;
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["mangatoon", "mtoon", "noveltoon", "toon"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const query = flags.search || cleanPrompt;
      if (flags.id) {
        const novelId = String(flags.id).trim();
        await ctx.react?.("⏳");
        const {
          data
        } = await axios.get(API_URL, {
          params: {
            action: "dl_all",
            id: novelId
          },
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        const chapters = data?.result || [];
        if (!data?.status || !chapters.length) {
          await ctx.react?.("❌");
          return ctx.reply(`❌ Novel dengan ID *#${novelId}* tidak ditemukan atau belum memiliki bab.`);
        }
        const topEp = chapters[0]?.data || {};
        const novelTitle = topEp.content_title || "MangaToon Novel";
        const coverUrl = topEp.content_image_url || "https://files.catbox.moe/g2e6i5.jpg";
        if (flags.episode !== undefined) {
          const targetWeight = Number(flags.episode) || 1;
          const chapterItem = chapters.find(c => Number(c.ep?.weight) === targetWeight) || chapters[targetWeight - 1] || chapters[0];
          if (!chapterItem?.data) {
            await ctx.react?.("❌");
            return ctx.reply(`❌ Bab ${targetWeight} tidak ditemukan. Total bab yang tersedia: ${chapters.length}.`);
          }
          const epData = chapterItem.data;
          const storyText = (epData.data || epData.markdown_data_url || "").trim();
          const epTitle = epData.episode_title || chapterItem.ep?.title || `Bab ${targetWeight}`;
          const currentWeight = chapterItem.ep?.weight || targetWeight;
          const buttons = [];
          if (epData.next?.id || currentWeight < chapters.length) {
            buttons.push({
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: `⏭️ Lanjut ke Bab ${currentWeight + 1}`,
                id: `${prefix}mangatoon --id ${novelId} -e ${currentWeight + 1}`
              })
            });
          }
          if (currentWeight > 1) {
            buttons.push({
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: `⏮️ Kembali ke Bab ${currentWeight - 1}`,
                id: `${prefix}mangatoon --id ${novelId} -e ${currentWeight - 1}`
              })
            });
          }
          buttons.push({
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Salin Teks Bab Ini",
              copy_code: storyText
            })
          });
          if (storyText.length > CONFIG.MAX_READ_CHARS || flags.doc) {
            const docBuffer = Buffer.from(storyText, "utf-8");
            const docFileName = `${novelTitle} - ${epTitle}.txt`.replace(/[\\/:*?"<>|]/g, "");
            await ctx.react?.("📖");
            return await sock.sendMessage(targetChat, {
              document: docBuffer,
              fileName: docFileName,
              mimetype: "text/plain",
              caption: `–  *M A N G A T O O N  R E A D E R*

┌  ◦  *Novel* : ${novelTitle}
│  ◦  *Bab* : ${epTitle}
│  ◦  *Panjang Teks* : ${storyText.length.toLocaleString("id-ID")} Karakter
└  ◦  *Status* : Selesai diunduh ✅

_Isi bab dikirim sebagai file dokumen agar teks tidak terpotong dan nyaman dibaca._`
            }, {
              quoted: quotedMsg
            });
          }
          const readContent = `–  *M A N G A T O O N  R E A D E R*

┌  ◦  *Novel* : ${novelTitle}
└  ◦  *Bab* : ${epTitle}

─────────────────────────────

${storyText}`;
          const options = {
            contextInfo: {
              mentionedJid: [ctx.sender],
              forwardingScore: 999,
              isForwarded: true
            },
            quoted: quotedMsg
          };
          await ctx.react?.("📖");
          if (typeof ctx.sendCta === "function") {
            return await ctx.sendCta(readContent, botFooter, buttons, options);
          } else {
            return await ctx.reply(readContent, {
              quoted: quotedMsg
            });
          }
        }
        const chapterRows = chapters.slice(0, 25).map(c => ({
          title: `📖 ${c.ep?.title || `Bab ${c.ep?.weight}`}`.slice(0, 24),
          id: `${prefix}mangatoon --id ${novelId} -e ${c.ep?.weight}`,
          description: `Disukai: ${c.ep?.like_count || 0} • Komentar: ${c.ep?.comment_count || 0}`
        }));
        const bodyText = `–  *M A N G A T O O N  N O V E L*

┌  ◦  *Judul* : ${novelTitle}
│  ◦  *Total Bab* : ${chapters.length} Bab
└  ◦  *Status Rilis* : ${topEp.is_end ? "Tamat" : "Sedang Berjalan"}

Pilih bab pada menu di bawah untuk langsung mulai membaca:`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📖 PILIH BAB NOVEL",
            sections: [{
              title: `Daftar Bab (${chapters.length} Total)`,
              rows: chapterRows
            }]
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "▶️ Mulai Baca Bab 1",
            id: `${prefix}mangatoon --id ${novelId} -e 1`
          })
        }];
        const options = {
          image: coverUrl,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • MangaToon`,
              button_title: "Daftar Bab"
            }
          },
          contextInfo: {
            mentionedJid: [ctx.sender],
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
            image: {
              url: coverUrl
            },
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        }
      }
      if (!query) {
        return ctx.reply(`–  *M A N G A T O O N  R E A D E R*

Layanan pencarian dan pembaca novel online resmi dari MangaToon.

┌  ◦  *Pencarian* : \`${prefix}mangatoon <judul>\`
│  ◦  *Pilih Bab* : \`${prefix}mangatoon --id <novel_id>\`
│  ◦  *Baca Bab* : \`${prefix}mangatoon --id <novel_id> -e <nomor_bab>\`
│  ◦  *Kirim File* : \`${prefix}mangatoon --id <novel_id> -e 1 --doc\`
└  ◦  *Example* : \`${prefix}mangatoon Demon Slayer\`

–  *D A F T A R  F L A G S*

┌  ◦  *-s, --search* : Kata kunci pencarian novel
│  ◦  *--id* : ID novel di MangaToon
│  ◦  *-e, --ep* : Nomor bab / chapter yang ingin dibaca
└  ◦  *-d, --doc* : Paksa kirim bab sebagai berkas .txt`);
      }
      await ctx.react?.("⏳");
      const {
        data
      } = await axios.get(API_URL, {
        params: {
          action: "search",
          word: query
        },
        headers: {
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const results = data?.result || [];
      if (!data?.status || !results.length) {
        await ctx.react?.("❌");
        return ctx.reply(`❌ Tidak ditemukan novel MangaToon untuk kata kunci: *"${query}"*`);
      }
      const topNovel = results[0];
      const searchRows = results.slice(0, 15).map((item, idx) => ({
        title: `[#${idx + 1}] ${item.title}`.slice(0, 24),
        id: `${prefix}mangatoon --id ${item.id}`,
        description: `Penulis: ${item.author?.name || "-"} • Bab: ${item.open_episodes_count || 0}`
      }));
      const bodyText = `–  *M A N G A T O O N  S E A R C H*

Ditemukan ${results.length} judul cerita untuk kata kunci: *"${query}"*.

┌  ◦  *Judul Teratas* : ${topNovel.title}
│  ◦  *Penulis* : ${topNovel.author?.name || "-"}
│  ◦  *Total Bab* : ${topNovel.open_episodes_count || 0} Bab
│  ◦  *Status* : ${topNovel.is_end ? "Tamat" : "Ongoing"}
│  ◦  *Suka* : ${Number(topNovel.like_count || 0).toLocaleString("id-ID")}
└  ◦  *Pembaca* : ${Number(topNovel.watch_count || 0).toLocaleString("id-ID")}x

Pilih cerita di bawah untuk membuka daftar bab dan mulai membaca:`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `📚 DAFTAR NOVEL (${results.length})`,
          sections: [{
            title: "Pilih Judul Cerita",
            rows: searchRows
          }]
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "📖 Baca Cerita Teratas",
          id: `${prefix}mangatoon --id ${topNovel.id} -e 1`
        })
      }];
      const coverUrl = topNovel.image_url || topNovel.big_image_url || "https://files.catbox.moe/g2e6i5.jpg";
      const options = {
        image: coverUrl,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • MangaToon`,
            button_title: "Lihat Hasil"
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender],
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
          image: {
            url: coverUrl
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
    } catch (error) {
      console.error("[MangaToon Error]:", error);
      await ctx.react?.("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`❌ Terjadi kendala pada MangaToon Engine: ${errMsg}`);
    }
  }
};