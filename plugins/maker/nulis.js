import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/maker/nulis/v1`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function parseBodyFlags(rawStr) {
  const rest = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g;
  let match;
  while ((match = flagRegex.exec(rawStr)) !== null) {
    const key = match[1].toLowerCase();
    let val = match[2] ? match[2].trim() : true;
    if (typeof val === "string" && (val.startsWith('"') || val.startsWith("'"))) {
      val = val.slice(1, -1);
    }
    rest[key] = val;
  }
  const cleanText = rawStr.replace(/--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g, "").trim();
  return {
    rest: rest,
    cleanText: cleanText
  };
}

function splitIntoPages(text, maxLinesPerPage = 25, maxCharsPerLine = 48) {
  const rawLines = text.split("\n");
  const formattedLines = [];
  for (const line of rawLines) {
    if (line.length <= maxCharsPerLine) {
      formattedLines.push(line);
    } else {
      let temp = line;
      while (temp.length > maxCharsPerLine) {
        formattedLines.push(temp.slice(0, maxCharsPerLine));
        temp = temp.slice(maxCharsPerLine);
      }
      if (temp.length > 0) formattedLines.push(temp);
    }
  }
  const pages = [];
  for (let i = 0; i < formattedLines.length; i += maxLinesPerPage) {
    pages.push(formattedLines.slice(i, i + maxLinesPerPage).join("\n"));
  }
  return pages.length > 0 ? pages : [text];
}

function payloadClean(obj) {
  delete obj.folio;
  delete obj.lines;
  delete obj.maxlines;
  delete obj.kanan;
  delete obj.kiri;
}
export default {
  name: "nulis",
  aliases: ["tulis", "magernulis", "nuliskertas", "nulisbuku"],
  description: "Nulis di buku/folio otomatis per lembar dengan auto select kiri/kanan",
  category: "Maker",
  limit: true,
  example: "nulis teks tugas panjang di sini atau reply teks tugas dengan .nulis",
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim();
      const quotedText = ctx.quoted?.text || "";
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        rest,
        cleanText
      } = parseBodyFlags(rawText);
      let fullText = cleanText || (quotedText ? quotedText.trim() : "");
      if (rest.text) fullText = String(rest.text);
      if (!fullText) {
        return ctx.reply(`–  *M A G E R  N U L I S*

Silakan masukkan teks atau reply pesan tugas yang ingin dituliskan.

┌  ◦  *Buku Biasa* : \`${prefix}nulis <teks>\` (Auto Kiri 11 ➔ Kanan 12)
│  ◦  *Kertas Folio* : \`${prefix}nulis --folio <teks>\` (Auto Kiri 14 ➔ Kanan 13)
│  ◦  *Custom Baris* : \`${prefix}nulis --lines 20 <teks>\`
└  ◦  *Reply Teks* : Balas pesan tugas dengan \`${prefix}nulis\``);
      }
      ctx.react?.("⏳");
      const isFolio = Boolean(rest.folio);
      const linesPerPage = parseInt(rest.lines || rest.maxlines, 10) || 25;
      const pages = splitIntoPages(fullText, linesPerPage);
      payloadClean(rest);
      let pageIndex = 0;
      for (const pageText of pages) {
        pageIndex++;
        const isLeftPage = pageIndex % 2 !== 0;
        let selectedType;
        let pageLabel;
        if (rest.type) {
          selectedType = String(rest.type);
          pageLabel = `Kustom (Type ${selectedType})`;
        } else if (isFolio) {
          selectedType = isLeftPage ? "14" : "13";
          pageLabel = isLeftPage ? "Kertas Folio (Kiri)" : "Kertas Folio (Kanan)";
        } else {
          selectedType = isLeftPage ? "11" : "12";
          pageLabel = isLeftPage ? "Buku Tulis (Kiri)" : "Buku Tulis (Kanan)";
        }
        const payload = {
          text: pageText,
          type: selectedType,
          ...rest
        };
        const res = await axios.post(API_URL, payload, {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 6e4
        });
        const imageBuffer = Buffer.from(res.data);
        const captionText = `–  *N U L I S  B U K U*

┌  ◦  *Halaman* : Lembar ${pageIndex} dari ${pages.length}
│  ◦  *Model* : ${pageLabel}
│  ◦  *Tipe* : ${selectedType}
└  ◦  *Karakter* : ${pageText.length} Huruf`;
        await sock.sendMessage(ctx.id, {
          image: imageBuffer,
          caption: captionText
        }, {
          quoted: pageIndex === 1 ? quotedMsg : undefined
        });
        if (pages.length > 1) {
          await sleep(1e3);
        }
      }
      ctx.react?.("✅");
    } catch (error) {
      ctx.react?.("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Gagal memproses tulisan: ${errMsg}`);
    }
  }
};