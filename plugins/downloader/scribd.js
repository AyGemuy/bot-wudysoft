import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const BASE_API = `${global.bot?.api?.wudysoft}/api/download/scribd`;

function formatSize(bytes) {
  if (!bytes || isNaN(bytes)) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function extractDocId(input = "") {
  if (!input) return null;
  if (/^\d{6,15}$/.test(input.trim())) return input.trim();
  const urlMatch = input.match(/scribd\.com\/(?:document|doc|presentation)\/(\d+)/i);
  if (urlMatch) return urlMatch[1];
  return null;
}
export default {
  name: "scribd",
  aliases: ["scribddl", "scribdsearch", "scrd"],
  description: "Cari dan unduh dokumen / PDF dari Scribd secara gratis",
  category: "Downloader",
  limit: false,
  example: "scribd mtk atau scribd 904240987 atau scribd https://www.scribd.com/document/904240987/pts-mtk",
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = ctx.args?.join(" ")?.trim() || ctx.text?.trim() || "";
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Scribd Downloader`;
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      if (!rawText) {
        return ctx.reply(`–  *S C R I B D*

Silakan tentukan kata kunci pencarian atau masukkan link/ID dokumen Scribd.

┌  ◦  *Search* : ${prefix}scribd <kata_kunci>
│  ◦  *Download* : ${prefix}scribd <id/link>
└  ◦  *Example* : ${prefix}scribd rumus matematika`);
      }
      const docId = extractDocId(rawText);
      if (docId) {
        await ctx.react("⏳");
        let docTitle = `Scribd_Document_${docId}`;
        let docPages = "-";
        let docPublisher = "-";
        try {
          const detailRes = await axios.get(`${BASE_API}?action=detail&doc_id=${docId}`, {
            timeout: 1e4
          });
          const docData = detailRes.data?.result?.[0]?.doc;
          if (docData) {
            docTitle = docData.title || docTitle;
            docPages = docData.page_count || "-";
            docPublisher = docData.publisher?.name || docData.publisher?.username || "-";
          }
        } catch {}
        const downloadUrl = `${BASE_API}?action=download&doc_id=${docId}`;
        const fileResponse = await axios.get(downloadUrl, {
          responseType: "arraybuffer",
          timeout: 6e4,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          }
        });
        const buffer = Buffer.from(fileResponse.data);
        if (!buffer || buffer.length === 0) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh dokumen. Berkas mungkin telah dihapus atau tidak tersedia.");
        }
        const safeFileName = `${docTitle.replace(/[\\/:*?"<>|]/g, "_")}.pdf`;
        const caption = `–  *S C R I B D*

┌  ◦  *Title* : ${docTitle}
│  ◦  *ID* : ${docId}
│  ◦  *Author* : ${docPublisher}
│  ◦  *Pages* : ${docPages} Halaman
└  ◦  *Size* : ${formatSize(buffer.length)}

Dokumen PDF sedang dikirimkan ke chat.`;
        await sock.sendMessage(ctx.from, {
          document: buffer,
          mimetype: "application/pdf",
          fileName: safeFileName,
          caption: caption
        }, {
          quoted: quotedMsg
        });
        return await ctx.react("✅");
      }
      await ctx.react("🔍");
      const searchUrl = `${BASE_API}?action=search&query=${encodeURIComponent(rawText)}`;
      const {
        data: searchRes
      } = await axios.get(searchUrl, {
        timeout: 15e3
      });
      const items = searchRes?.result?.modules?.[0]?.items || [];
      if (!items.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan dokumen dengan kata kunci: *"${rawText}"*`);
      }
      const results = items.slice(0, 10).map((item, index) => {
        const doc = item.document || {};
        return {
          index: index + 1,
          id: doc.id,
          title: doc.title || "Untitled",
          pages: doc.page_count || 0,
          reads: doc.reads_count || 0,
          publisher: doc.publisher?.name || doc.publisher?.username || "Unknown"
        };
      });
      const rows = results.map(r => ({
        title: `[${r.pages} Hlm] ${r.title}`.slice(0, 24),
        description: `Oleh: ${r.publisher} • Dibaca: ${r.reads}x`,
        id: `${prefix}scribd ${r.id}`
      }));
      const resultListText = results.map((r, i) => {
        const isLast = i === results.length - 1;
        const branch = isLast ? "└" : "│";
        return `${branch}  ◦  *${r.index}.* ${r.title}\n   (ID: ${r.id} • ${r.pages} Hlm • ${r.publisher})`;
      }).join("\n");
      const bodyText = `Hi ${userName}!
Berikut adalah dokumen Scribd yang berhasil ditemukan.

–  *S C R I B D*

┌  ◦  *Query* : ${rawText}
└  ◦  *Found* : ${results.length} Dokumen

–  *R E S U L T S*

${resultListText}

Pilih dokumen dari menu di bawah atau ketik *${prefix}scribd <id>* untuk mengunduh.`;
      if (typeof ctx.sendCta === "function") {
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📥 PILIH DOKUMEN UNTUK UNDUH",
            sections: [{
              title: `${botName} • HASIL PENCARIAN`,
              rows: rows
            }]
          })
        }];
        await ctx.sendCta(bodyText, botFooter, buttons, {
          title: `✦ Scribd Search • ${rawText} ✦`,
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      return ctx.reply(`❌ Terjadi kesalahan pada fitur Scribd: ${error?.message || error}`);
    }
  }
};