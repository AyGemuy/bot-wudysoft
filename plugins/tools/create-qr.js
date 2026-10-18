import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/maker/qr/v2`;
const themes = {
  1: {
    bodyColor: "#000000",
    bgColor: "#FFFFFF"
  },
  2: {
    bodyColor: "#FF5733",
    bgColor: "#C70039"
  },
  3: {
    bodyColor: "#28B463",
    bgColor: "#DAF7A6"
  },
  4: {
    bodyColor: "#900C3F",
    bgColor: "#FFC300"
  },
  5: {
    bodyColor: "#581845",
    bgColor: "#F1C40F"
  },
  6: {
    bodyColor: "#154360",
    bgColor: "#AED6F1"
  },
  7: {
    bodyColor: "#6C3483",
    bgColor: "#E8DAEF"
  },
  8: {
    bodyColor: "#1C2833",
    bgColor: "#D5DBDB"
  },
  9: {
    bodyColor: "#117A65",
    bgColor: "#76D7C4"
  },
  10: {
    bodyColor: "#2E4053",
    bgColor: "#ABB2B9"
  }
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
      data: ["d", "text", "q", "query"],
      theme: ["t"],
      body: ["b", "shape"],
      eye: ["e", "frame"],
      eyeball: ["eb", "ball"],
      bodycolor: ["color", "c", "fg"],
      bgcolor: ["bg"],
      eyecolor: ["eye1color", "ec"],
      eyeballcolor: ["ebc"],
      gradient1: ["grad1", "g1"],
      gradient2: ["grad2", "g2"],
      size: ["s"],
      logo: ["icon", "img"]
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
export default {
  name: "qrcode",
  aliases: ["qr", "createqr", "makeqr", "qrcustom"],
  description: "Buat custom QR Code dengan pilihan tema, warna, dan pola (Flags Supported)",
  category: "Tools",
  limit: true,
  example: "• Standar: .qr https://google.com\n• Custom: .qr Halo Dunia --theme 3 --eye frame13 --size 1000",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["qrcode", "qr", "createqr", "makeqr", "qrcustom"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • QR Engine`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const quotedText = ctx.quoted?.text || ctx.quoted?.body || "";
      const targetData = flags.data || cleanPrompt || quotedText;
      if (!targetData) {
        return ctx.reply(`–  *Q R  C O D E  G E N E R A T O R*

Hasilkan custom QR Code interaktif dengan desain dan warna khusus.

┌  ◦  *Format* : \`${prefix}qr <teks/link> [flags]\`
│  ◦  *Reply Teks* : Balas pesan dengan \`${prefix}qr [flags]\`
└  ◦  *Example* : \`${prefix}qr https://github.com --theme 2\`

–  *D A F T A R  F L A G S*

┌  ◦  *--theme <1-10/random>* : Pilihan tema preset warna
│  ◦  *--body <shape>* : Bentuk titik QR (\`japnese\`, \`circle\`, \`rounded\`)
│  ◦  *--eye <frame>* : Bingkai sudut (\`frame1\`, \`frame2\`, \`frame13\`)
│  ◦  *--eyeball <ball>* : Titik sudut (\`ball1\`, \`ball2\`, \`ball14\`)
│  ◦  *--color <hex>* : Warna utama (\`#FF5733\`)
│  ◦  *--bg <hex>* : Warna background (\`#FFFFFF\`)
│  ◦  *--logo <url>* : Sisipkan logo di tengah QR
└  ◦  *--size <number>* : Ukuran resolusi (default: 1000)`);
      }
      await ctx.react?.("⏳");
      let selectedTheme = flags.theme;
      if (selectedTheme === "random") {
        selectedTheme = Math.floor(Math.random() * 10) + 1;
      }
      const themeConfig = themes[selectedTheme] || themes[1];
      const customPayload = {
        data: targetData,
        theme: selectedTheme || 1,
        config: {
          body: flags.body || "japnese",
          eye: flags.eye || "frame2",
          eyeBall: flags.eyeball || "ball2",
          bodyColor: flags.bodycolor || themeConfig.bodyColor,
          bgColor: flags.bgcolor || themeConfig.bgColor,
          eye1Color: flags.eyecolor || "#0277bd",
          eye2Color: flags.eyecolor || "#0277bd",
          eye3Color: flags.eyecolor || "#0277bd",
          eyeBall1Color: flags.eyeballcolor || "#000000",
          eyeBall2Color: flags.eyeballcolor || "#000000",
          eyeBall3Color: flags.eyeballcolor || "#000000",
          gradientColor1: flags.gradient1 || "#000000",
          gradientColor2: flags.gradient2 || "#0277bd",
          gradientType: "linear",
          logo: flags.logo || ""
        },
        size: Number(flags.size) || 1e3,
        file: "png"
      };
      let imageBuffer = null;
      try {
        const res = await axios.post(API_URL, customPayload, {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          timeout: 45e3
        });
        const rawBuf = Buffer.from(res.data);
        if (rawBuf.length > 8 && rawBuf[0] === 137 && rawBuf[1] === 80) {
          imageBuffer = rawBuf;
        } else {
          try {
            const parsed = JSON.parse(rawBuf.toString("utf-8"));
            if (parsed.imageUrl) {
              const fetchImg = await axios.get(parsed.imageUrl.startsWith("http") ? parsed.imageUrl : `https:${parsed.imageUrl}`, {
                responseType: "arraybuffer",
                timeout: 2e4
              });
              imageBuffer = Buffer.from(fetchImg.data);
            } else if (parsed.base64) {
              imageBuffer = Buffer.from(parsed.base64.replace(/^data:image\/\w+;base64,/, ""), "base64");
            }
          } catch (_) {
            imageBuffer = rawBuf;
          }
        }
      } catch (err) {
        const fallbackRes = await axios.get(API_URL, {
          params: {
            data: targetData,
            theme: selectedTheme || 1
          },
          responseType: "arraybuffer",
          timeout: 3e4
        });
        imageBuffer = Buffer.from(fallbackRes.data);
      }
      if (!imageBuffer || imageBuffer.length === 0) {
        await ctx.react?.("❌");
        return ctx.reply("❌ Gagal menghasilkan QR Code dari server.");
      }
      const displayContent = targetData.length > 60 ? `${targetData.slice(0, 60)}...` : targetData;
      const captionText = `–  *Q R  C O D E  G E N E R A T O R*

Pembuatan barcode QR berhasil diproses.

┌  ◦  *Data* : ${displayContent}
│  ◦  *Theme* : Theme ${selectedTheme || "1 (Default)"}
│  ◦  *Body Shape* : \`${customPayload.config.body}\`
│  ◦  *Frame Style* : \`${customPayload.config.eye}\`
└  ◦  *Resolution* : ${customPayload.size}x${customPayload.size} px`;
      const buttons = [{
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Salin Teks QR",
          copy_code: targetData
        })
      }];
      if (/^https?:\/\//i.test(targetData)) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "🌐 Buka Tautan",
            url: targetData,
            merchant_url: targetData
          })
        });
      }
      const options = {
        image: imageBuffer,
        contextInfo: {
          mentionedJid: [ctx.sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(captionText, botFooter, buttons, options);
      } else {
        await sock.sendMessage(ctx.id, {
          image: imageBuffer,
          caption: captionText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react?.("✅");
    } catch (error) {
      console.error("[QR Code Error]:", error?.message || error);
      await ctx.react?.("❌");
      ctx.reply(`❌ Gagal membuat QR Code: ${error?.message || error}`);
    }
  }
};