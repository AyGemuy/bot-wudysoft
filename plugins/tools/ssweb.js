import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  decodeJid
} from "../../core/serialize.js";
const CONFIG = {
  BASE_URL: `${global.bot?.api?.wudysoft}/api/tools/ssweb`,
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
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
      url: ["u", "link"],
      provider: ["v", "ver", "version", "engine"],
      fullpage: ["f", "full", "full_page", "fullsize", "long"],
      device: ["d", "dev", "tipe"],
      width: ["w", "lebar"],
      height: ["h", "tinggi"],
      format: ["fmt", "type"],
      quality: ["q", "kualitas"],
      delay: ["wait", "jeda"],
      dark: ["darkmode", "dark_mode"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true" || rawVal === "1" || rawVal === "on") val = true;
      else if (rawVal === "false" || rawVal === "0" || rawVal === "off") val = false;
      else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
      else val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  if (!flags.url) {
    const urlMatch = cleanPrompt.match(/https?:\/\/[^\s]+/i) || cleanPrompt.match(/([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?/i);
    if (urlMatch) {
      flags.url = urlMatch[0].startsWith("http") ? urlMatch[0] : `https://${urlMatch[0]}`;
    }
  }
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}

function buildPayload(version, cleanUrl, flags) {
  const isFull = Boolean(flags.fullpage);
  const selectedFormat = (flags.format || "png").toLowerCase();
  const width = Number(flags.width) || null;
  const height = Number(flags.height) || null;
  const delay = Number(flags.delay) || 0;
  const quality = Number(flags.quality) || 90;
  const device = String(flags.device || "desktop").toLowerCase();
  switch (version) {
    case "v26":
      return {
        url: cleanUrl,
          device: device === "mobile" ? "mobile" : "desktop",
          type: selectedFormat,
          fullPage: isFull
      };
    case "v25":
      return {
        url: cleanUrl,
          viewport: flags.viewport || (device === "mobile" ? "375x812" : "1024x768"),
          format: selectedFormat.toUpperCase(),
          width: width ? String(width) : device === "mobile" ? "375" : "1024",
          scale: flags.scale || "Z100"
      };
    case "v24":
      return {
        url: cleanUrl,
          viewport_has_touch: device === "mobile",
          viewport_landscape: false,
          viewport_mobile: device === "mobile",
          format: selectedFormat,
          block_ads: flags.block_ads !== false,
          block_cookie_banners: flags.block_cookie_banners !== false,
          block_banners_by_heuristics: false,
          block_trackers: true,
          delay: delay,
          timeout: 60,
          response_type: "by_format",
          full_page: isFull,
          full_page_scroll: isFull,
          image_quality: quality
      };
    case "v23":
      return {
        url: cleanUrl,
          width: width || (device === "mobile" ? 375 : 1280),
          height: height || (device === "mobile" ? 667 : 800),
          fullPage: isFull,
          format: selectedFormat
      };
    case "v22":
      return {
        url: cleanUrl,
          format: selectedFormat,
          width: width || (device === "mobile" ? 375 : 1280),
          height: height || (device === "mobile" ? 812 : 800),
          fullPage: isFull,
          quality: quality,
          deviceScaleFactor: flags.scale ? Number(flags.scale) : 1
      };
    case "v20":
      return {
        url: cleanUrl,
          width: width || (device === "mobile" ? 375 : 1280),
          full_size: isFull,
          format: selectedFormat
      };
    case "v19":
      return {
        url: cleanUrl,
          fullPage: isFull,
          width: width || (device === "mobile" ? 375 : 1280),
          height: height || (device === "mobile" ? 812 : 800),
          delay: delay || 1
      };
    case "v15":
      return {
        url: cleanUrl,
          width: width || (device === "mobile" ? 414 : 1440),
          height: height || (device === "mobile" ? 896 : 1024),
          full_page: isFull,
          selector: flags.selector || "",
          dark_mode: Boolean(flags.dark),
          hide_cookie_banners: true,
          format: selectedFormat
      };
    case "v14":
      return {
        url: cleanUrl,
          screenshot: true,
          embed: "screenshot.url"
      };
    case "v13":
      return {
        url: cleanUrl,
          fullCapture: isFull,
          mobileCapture: device === "mobile",
          width: width || 1280,
          height: height || 1080
      };
    case "v12":
      return {
        url: cleanUrl,
          output: "buffer",
          commands: []
      };
    case "v10":
      return {
        url: cleanUrl,
          width: width || 1280,
          height: height || 800,
          response_type: "image",
          delay: delay || 2,
          format: selectedFormat,
          quality: quality || 100,
          fresh: "true"
      };
    case "v2":
    default:
      return {
        url: cleanUrl,
          device: device,
          full: isFull ? "on" : "off",
          cacheLimit: flags.cacheLimit || 0
      };
  }
}
export default {
  name: "ssweb",
  aliases: ["screenshot", "ss", "sstable", "webss", "capture"],
  description: "Mengambil screenshot website dengan pilihan provider versi interaktif",
  category: "Tools",
  limit: true,
  example: "ssweb github.com atau ssweb https://google.com -v v26 --full",
  execute: async (sock, ctx, msg) => {
    const rawText = (ctx.args?.join(" ") || ctx.text || "").trim();
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg?.key ? msg : undefined;
    let targetJid = ctx.chat || ctx.id;
    if (!ctx.isGroup && targetJid?.endsWith("@lid")) {
      targetJid = ctx.sender?.endsWith("@s.whatsapp.net") ? ctx.sender : targetJid;
    }
    targetJid = decodeJid(targetJid);
    try {
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      let targetUrl = flags.url;
      if (!targetUrl && cleanPrompt) {
        const match = cleanPrompt.match(/https?:\/\/[^\s]+/i) || cleanPrompt.match(/([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?/i);
        if (match) targetUrl = match[0];
      }
      if (!targetUrl && ctx.quoted) {
        const quotedText = ctx.quoted?.text || ctx.quoted?.body || ctx.quoted?.caption || ctx.quoted?.message?.conversation || ctx.quoted?.message?.extendedTextMessage?.text || ctx.quoted?.message?.imageMessage?.caption || ctx.quoted?.message?.videoMessage?.caption || "";
        const quotedMatch = quotedText.match(/https?:\/\/[^\s]+/i) || quotedText.match(/([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?/i);
        if (quotedMatch) targetUrl = quotedMatch[0];
      }
      if (!targetUrl) {
        const guide = `– *S S W E B*\n\n` + `┌ ◦ *Usage* : ${prefix}ssweb <url>\n` + `│ ◦ *Quoted* : Balas pesan berisi tautan website\n` + `└ ◦ *Function* : Mengambil tangkapan layar (screenshot) website\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Quick* : ${prefix}ssweb github.com\n` + `└ ◦ *Custom* : ${prefix}ssweb github.com -v v26 --full\n\n` + `${footer}`;
        return ctx.reply(guide);
      }
      targetUrl = targetUrl.replace(/[.,!?:;)]+$/, "");
      const cleanUrl = targetUrl.startsWith("http://") || targetUrl.startsWith("https://") ? targetUrl : `https://${targetUrl}`;
      const listSections = [{
        title: "REKOMENDASI CEPAT",
        rows: [{
          title: "v26: Geekflare CDN",
          id: `${prefix}ssweb ${cleanUrl} -v v26 --full`,
          description: "Rekomendasi terbaik untuk GitHub & situs modern"
        }, {
          title: "v20: ScreenshotInk",
          id: `${prefix}ssweb ${cleanUrl} -v v20 --full`,
          description: "Resolusi tajam untuk halaman website panjang"
        }, {
          title: "v24: Anti-Ads & Full",
          id: `${prefix}ssweb ${cleanUrl} -v v24 --full`,
          description: "Blokir iklan pop-up & banner cookie"
        }, {
          title: "v15: Dark Mode",
          id: `${prefix}ssweb ${cleanUrl} -v v15 --dark --full`,
          description: "Tampilan mode malam (Dark Theme)"
        }]
      }, {
        title: "TAMPILAN SMARTPHONE",
        rows: [{
          title: "v26: Mobile View",
          id: `${prefix}ssweb ${cleanUrl} -v v26 -d mobile`,
          description: "Tampilan layar HP via engine Geekflare"
        }, {
          title: "v24: Mobile Full",
          id: `${prefix}ssweb ${cleanUrl} -v v24 -d mobile --full`,
          description: "Layar penuh HP tanpa gangguan iklan"
        }, {
          title: "v23: Mobile Rasio",
          id: `${prefix}ssweb ${cleanUrl} -v v23 -d mobile`,
          description: "Ukuran standar layar ponsel 375x667"
        }, {
          title: "v22: Mobile Skala 2x",
          id: `${prefix}ssweb ${cleanUrl} -v v22 -d mobile --scale 2`,
          description: "Resolusi pixel 2x lebih jernih di ponsel"
        }]
      }, {
        title: "DESKTOP & RESOLUSI TINGGI",
        rows: [{
          title: "v25: Desktop 1440px",
          id: `${prefix}ssweb ${cleanUrl} -v v25 -w 1440 --scale Z100`,
          description: "Resolusi layar lebar 1440px desktop"
        }, {
          title: "v13: Desktop Full",
          id: `${prefix}ssweb ${cleanUrl} -v v13 --full`,
          description: "Tangkapan layar penuh format 1280x1080"
        }, {
          title: "v10: Fresh HD 100%",
          id: `${prefix}ssweb ${cleanUrl} -v v10 -q 100`,
          description: "Kualitas gambar asli 100% tanpa kompresi"
        }, {
          title: "v2: Fast Cache",
          id: `${prefix}ssweb ${cleanUrl} -v v2 -d desktop`,
          description: "Engine super cepat untuk website statis"
        }]
      }];
      if (!flags.provider) {
        const chooseText = `– *S S W E B  -  P R O V I D E R*\n\n` + `┌ ◦ *URL* : ${cleanUrl}\n` + `│ ◦ *Status* : Siap Diproses\n` + `└ ◦ *Action* : Pilih engine provider pada tombol di bawah\n\n` + `${footer}`;
        const menuButtons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "PILIH ENGINE PROVIDER",
            sections: listSections
          })
        }, {
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "Kunjungi Website",
            url: cleanUrl,
            merchant_url: cleanUrl,
            has_multiple_buttons: true
          })
        }];
        const menuOptions = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              list_title: `${botName} • Pilihan Engine`,
              button_title: "Pilih Engine"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(chooseText, `${botName} • Web Capture`, menuButtons, menuOptions);
        }
        return await ctx.reply(chooseText);
      }
      let providerVer = String(flags.provider).toLowerCase();
      if (!providerVer.startsWith("v")) providerVer = `v${providerVer}`;
      const allowedVersions = ["v2", "v10", "v12", "v13", "v14", "v15", "v19", "v20", "v22", "v23", "v24", "v25", "v26"];
      if (!allowedVersions.includes(providerVer)) providerVer = "v26";
      if (typeof ctx.react === "function") await ctx.react("⏳").catch(() => {});
      const payload = buildPayload(providerVer, cleanUrl, flags);
      const apiUrl = `${CONFIG.BASE_URL}/${providerVer}?url=${encodeURIComponent(cleanUrl)}`;
      const startTime = Date.now();
      const response = await axios.post(apiUrl, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        responseType: "arraybuffer",
        timeout: CONFIG.TIMEOUT
      });
      const responseTime = ((Date.now() - startTime) / 1e3).toFixed(2);
      let imageBuffer = null;
      try {
        const textData = Buffer.from(response.data).toString("utf-8");
        if (textData.trim().startsWith("{")) {
          const parsed = JSON.parse(textData);
          if (parsed.message || parsed.error) {
            if (typeof ctx.react === "function") await ctx.react("❌").catch(() => {});
            return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal merender website\n` + `└ ◦ *Info* : ${parsed.message || parsed.error}\n\n` + `${footer}`);
          }
          const directImgUrl = parsed.image_url || parsed.result?.image_url;
          if (directImgUrl) {
            const imgRes = await axios.get(directImgUrl, {
              responseType: "arraybuffer",
              timeout: CONFIG.TIMEOUT
            });
            imageBuffer = Buffer.from(imgRes.data);
          }
        }
      } catch (_) {}
      if (!imageBuffer) {
        imageBuffer = Buffer.from(response.data);
      }
      const isPng = imageBuffer.slice(0, 8).toString("hex") === "89504e470d0a1a0a";
      const isJpg = imageBuffer.slice(0, 3).toString("hex") === "ffd8ff";
      const isWebp = imageBuffer.slice(8, 12).toString("utf-8") === "WEBP";
      if (!isPng && !isJpg && !isWebp) {
        if (typeof ctx.react === "function") await ctx.react("❌").catch(() => {});
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Format gambar tidak valid\n` + `└ ◦ *Info* : Coba gunakan provider versi lain (e.g. -v v26).\n\n` + `${footer}`);
      }
      const caption = `– *S S W E B*\n\n` + `┌ ◦ *URL* : ${cleanUrl}\n` + `│ ◦ *Engine* : ${providerVer.toUpperCase()}\n` + `│ ◦ *Type* : ${flags.fullpage ? "Full Page" : "Standard Viewport"}\n` + `│ ◦ *Device* : ${flags.device || "desktop"}\n` + `└ ◦ *Render Time* : ${responseTime}s\n\n` + `${footer}`;
      const resultButtons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "PILIH PROVIDER LAIN",
          sections: listSections
        })
      }, {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "Kunjungi Website",
          url: cleanUrl,
          merchant_url: cleanUrl,
          has_multiple_buttons: true
        })
      }];
      const resultOptions = {
        image: imageBuffer,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: `${botName} • Pilihan Engine`,
            button_title: "Ganti Provider"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(caption, `${botName} • Web Capture`, resultButtons, resultOptions).catch(async () => {
          await sock.sendMessage(targetJid, {
            image: imageBuffer,
            caption: caption
          }, {
            quoted: quotedMsg
          });
        });
      } else {
        await sock.sendMessage(targetJid, {
          image: imageBuffer,
          caption: caption
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅").catch(() => {});
    } catch (err) {
      console.error("[SSWEB ERROR]:", err?.message || err);
      if (typeof ctx.react === "function") await ctx.react("❌").catch(() => {});
      return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${err?.response?.data?.message || err.message}\n` + `└ ◦ *Command* : ${ctx.command || "ssweb"}\n\n` + `${footer}`);
    }
  }
};