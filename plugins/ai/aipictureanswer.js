import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/aipictureanswer`;
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function parseImageUrl(input = "") {
  try {
    const urlMatch = input.match(/https?:\/\/[^\s]+/i);
    return urlMatch ? urlMatch[0] : null;
  } catch (err) {
    console.error("[AiPictureAnswer parseImageUrl Error]:", err?.message || err);
    return null;
  }
}

function parseLatexExpressions(text = "") {
  try {
    const list = [];
    const regex = /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const rawExpr = (match[1] || match[2] || match[3] || "").trim();
      if (rawExpr && !list.some(item => item.expression === rawExpr)) {
        list.push({
          expression: rawExpr,
          imageUrl: `https://latex.codecogs.com/png.latex?\\dpi{200}${encodeURIComponent(rawExpr)}`,
          width: 300,
          height: 60
        });
      }
    }
    return list;
  } catch (err) {
    console.error("[AiPictureAnswer parseLatexExpressions Error]:", err?.message || err);
    return [];
  }
}
async function solvePictureProblem(imageUrl) {
  try {
    const {
      data
    } = await axios.post(API_URL, {
      image: imageUrl
    }, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": CONFIG.USER_AGENT
      },
      timeout: CONFIG.TIMEOUT
    });
    return data;
  } catch (err) {
    console.error("[AiPictureAnswer solvePictureProblem Error]:", err?.message || err);
    throw err;
  }
}
export default {
  name: "aipictureanswer",
  aliases: ["jawabsoal", "solvegambar", "aipic", "aianswer", "tanyasoal", "homework"],
  description: "AI Pemecah Soal & Tugas Matematika/Sains (Render LaTeX via AIRich Builder)",
  category: "AI",
  limit: true,
  example: "Kirim atau balas foto soal dengan .jawabsoal",
  execute: async (sock, ctx, msg, extra = {}) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["aipictureanswer", "jawabsoal", "solvegambar", "aipic", "aianswer", "tanyasoal", "homework"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botName = global.bot?.name || "Bot";
      const botFooter = global.bot?.footer || `${botName} • AI Homework Solver`;
      const targetChat = ctx.id || ctx.chat;
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const directUrl = parseImageUrl(rawText) || parseImageUrl(ctx.quoted?.text || "");
      if (!isMedia && !directUrl) {
        return ctx.reply(`–  *A I  P I C T U R E  A N S W E R*

Fitur AI untuk menjawab soal matematika, sains, fisika, atau kimia dari foto soal (Auto Render Rumus Matematika via AIRich Builder).

┌  ◦  *Kirim Foto*  : Kirim gambar soal dengan caption \`${prefix}jawabsoal\`
├  ◦  *Balas Foto*  : Reply foto soal yang ada dengan \`${prefix}jawabsoal\`
└  ◦  *Pakai Link*  : \`${prefix}jawabsoal https://example.com/soal.jpg\``, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      let targetImageUrl = directUrl;
      if (isMedia && !targetImageUrl) {
        try {
          const buffer = await ctx.download();
          if (buffer && Buffer.isBuffer(buffer)) {
            const uploadRes = await upload(buffer).catch(() => null);
            if (uploadRes?.status && uploadRes?.url) {
              targetImageUrl = uploadRes.url;
            }
          }
        } catch (uploadErr) {
          console.error("[AiPictureAnswer Upload Error]:", uploadErr?.message || uploadErr);
        }
      }
      if (!targetImageUrl) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Gagal memproses gambar. Pastikan format gambar valid (JPG/PNG).");
      }
      const data = await solvePictureProblem(targetImageUrl);
      if (!data || !data.status) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        const errMsg = data?.error || "Gagal mendapatkan solusi jawaban dari gambar.";
        return ctx.reply(`❌ ${errMsg}`);
      }
      const solution = (data.solution || "Tidak ada jawaban yang dapat dihasilkan dari gambar ini.").trim();
      const shareUrl = data.shareUrl || null;
      const latexExpressions = parseLatexExpressions(solution);
      if (latexExpressions.length > 0) {
        try {
          const builder = typeof sock.airich === "function" ? sock.airich() : typeof extra?.aiRich === "function" ? extra.aiRich() : null;
          if (builder) {
            builder.addText(solution);
            for (const item of latexExpressions) {
              builder.addLatex({
                expression: item.expression,
                imageUrl: item.imageUrl,
                width: item.width || 300,
                height: item.height || 60
              });
            }
            if (typeof builder.setQuoted === "function" && quotedMsg) {
              builder.setQuoted(quotedMsg);
            }
            await builder.send(targetChat, {
              quoted: quotedMsg
            });
            if (typeof ctx.react === "function") await ctx.react("✨");
            return;
          }
        } catch (builderError) {
          console.warn("[AiPictureAnswer Builder Warning]: Gagal mengirim via airich builder, beralih ke fallback:", builderError?.message || builderError);
        }
      }
      const bodyText = solution;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Jawaban",
        copy_code: solution
      }];
      if (shareUrl) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "🌐 Lihat Solusi Lengkap Web",
            url: shareUrl,
            merchant_url: shareUrl
          })
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          image: targetImageUrl,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(targetChat, {
          image: {
            url: targetImageUrl
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✨");
    } catch (error) {
      console.error("[AiPictureAnswer Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      ctx.reply(`❌ Terjadi kendala saat memecahkan soal: ${errMsg}`);
    }
  }
};