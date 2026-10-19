import axios from "axios";
import { simpleQuoted } from "../../lib/quoted.js";

const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/maker/sologo`,
  TIMEOUT: 45e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
};

// Cache internal untuk menyimpan hasil pencarian berdasarkan ID pengguna
const sologoCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;

  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;

    // Mapping alias flag & helper keys lengkap
    const aliasMap = {
      title: ["t", "text", "judul", "name", "query"],
      slogan: ["slog", "tagline"],
      industry_index: ["ind", "industry", "kategori", "cat"],
      industry_index_id: ["indid", "industryid"],
      idea: ["konsep", "concept"],
      width: ["w", "lebar"],
      height: ["h", "tinggi"],
      whiteedge: ["edge"],
      pagesize: ["ps", "limit", "count"],
      all: ["a", "semua"],
      index: ["i", "idx"],
      style: ["s", "styleindex", "st"]
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
  return {
    flags,
    cleanPrompt
  };
}

export default {
  name: "sologo",
  aliases: ["logomaker", "createsologo", "sologogen"],
  description: "Membuat logo otomatis dengan AI via Wudysoft Sologo API",
  category: "Maker",
  limit: true,
  example: "sologo chatbot --slogan 'AI Helper' --industry tech --idea 'modern bot' --all",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["sologo", "logomaker", "createsologo", "sologogen"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }

      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • AI Logo Generator`;
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;

      const { flags, cleanPrompt } = parseFlags(rawText);
      const title = flags.title || cleanPrompt;

      if (!title && flags.index === undefined && !flags.all) {
        return ctx.reply(`–  *S O L O G O  A I  M A K E R*

Gunakan fitur ini untuk membuat desain logo profesional bertenaga AI.

┌  ◦  *Format* : \`${prefix}sologo <nama/judul> [flags]\`
├  ◦  *Kirim Semua* : \`${prefix}sologo <judul> --all\`
├  ◦  *Spesifik Logo* : \`${prefix}sologo <judul> -i 1\`
└  ◦  *Spesifik Style* : \`${prefix}sologo <judul> -i 1 -s 2\`

–  *H E L P E R  F L A G S*
┌  ◦  \`--slogan <teks>\` : Slogan / tagline logo
│  ◦  \`--industry <tech/gaming/dll>\` : Industri / kategori
│  ◦  \`--idea <konsep>\` : Konsep / ide desain
│  ◦  \`--width <px>\` | \`--height <px>\` : Dimensi gambar
│  ◦  \`--pagesize <1-10>\` : Jumlah opsi logo yang dibuat
│  ◦  \`--all, -a\` : Kirim seluruh variasi logo & style
│  ◦  \`--index, -i\` : Pilih nomor indeks logo
└  ◦  \`--style, -s\` : Pilih nomor indeks style/background

└  ◦  *Contoh* :
   \`${prefix}sologo chatbot --slogan "AI Bot" --industry tech --idea "robotics"\``);
      }

      await ctx.react("⏳");

      let logoData = null;
      const userCached = sologoCache.get(senderId);

      // Cek apakah mengambil dari Cache atau membuat Request Baru
      if (userCached && (userCached.query === title.toLowerCase() || !title) && !flags.all) {
        logoData = userCached.data;
      } else {
        // Full Helper Payload yang dikirimkan via POST JSON
        const payload = {
          title: title,
          slogan: flags.slogan || "",
          industry_index: flags.industry_index || "tech",
          industry_index_id: flags.industry_index_id || "",
          idea: flags.idea || flags.industry_index || "tech",
          width: flags.width || 400,
          height: flags.height || 300,
          whiteEdge: flags.whiteedge || 80,
          pagesize: flags.pagesize || 4,
          limit: flags.pagesize || 4,
          ai_icon: flags.ai_icon || [],
          ...flags
        };

        const { data } = await axios.post(
          CONFIG.API_URL,
          payload,
          {
            headers: {
              "Content-Type": "application/json",
              "User-Agent": CONFIG.USER_AGENT
            },
            timeout: CONFIG.TIMEOUT
          }
        );

        const logos = data?.logos || data?.result?.logos || (Array.isArray(data) ? data : null);

        if (!logos || !logos.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal membuat logo. Tidak ada hasil logo yang ditemukan dari API.");
        }

        logoData = logos;
        if (sologoCache.size > 50) sologoCache.clear();
        sologoCache.set(senderId, {
          query: title.toLowerCase(),
          data: logos
        });
      }

      // Mode 1: Jika flag `--all` diaktifkan (Kirim semua logo beserta style/variannya)
      if (flags.all) {
        await ctx.reply(`–  *S O L O G O  A I*

Sedang mengunduh & mengirimkan seluruh variasi logo untuk *${title || userCached?.query || "Sologo"}*...`);

        for (let i = 0; i < logoData.length; i++) {
          const item = logoData[i];
          const mainThumb = item.thumb;

          // Send Main Thumb
          if (mainThumb) {
            await sock.sendMessage(
              ctx.id,
              {
                image: { url: mainThumb },
                caption: `🎨 *Logo #${i + 1}* (Main Preview)`
              },
              { quoted: i === 0 ? quotedMsg : undefined }
            );
          }

          // Send styles inside logo item
          if (Array.isArray(item.style)) {
            for (let j = 0; j < item.style.length; j++) {
              const st = item.style[j];
              if (st.thumb) {
                await sock.sendMessage(
                  ctx.id,
                  {
                    image: { url: st.thumb },
                    caption: `🖼️ *Logo #${i + 1} - Style #${j + 1}*\n*Type*: ${st.title}\n*Desc*: ${st.desc}`
                  },
                  { quoted: undefined }
                );
                await new Promise((r) => setTimeout(r, 600));
              }
            }
          }
        }

        await ctx.react("✅");
        return;
      }

      // Mode 2: Jika user memilih nomor logo atau style spesifik via parameter/flags
      if (flags.index !== undefined) {
        const logoIdx = Number(flags.index) - 1;
        const selectedLogo = logoData[logoIdx];

        if (!selectedLogo) {
          await ctx.react("❌");
          return ctx.reply(`❌ Pilihan Logo #${flags.index} tidak ditemukan. Pilihan yang tersedia: 1 - ${logoData.length}`);
        }

        // Jika style juga ditentukan
        if (flags.style !== undefined) {
          const styleIdx = Number(flags.style) - 1;
          const selectedStyle = selectedLogo.style?.[styleIdx];

          if (!selectedStyle) {
            await ctx.react("❌");
            return ctx.reply(`❌ Style #${flags.style} pada Logo #${flags.index} tidak ditemukan.`);
          }

          await sock.sendMessage(
            ctx.id,
            {
              image: { url: selectedStyle.thumb },
              caption: `–  *S O L O G O  R E S U L T*

┌  ◦  *Judul* : ${title || userCached?.query || "Sologo"}
├  ◦  *Logo ID* : #${flags.index}
├  ◦  *Style ID* : #${flags.style}
├  ◦  *Style Name* : ${selectedStyle.title}
└  ◦  *Description* : ${selectedStyle.desc}`
            },
            { quoted: quotedMsg }
          );

          await ctx.react("✅");
          return;
        }

        // Jika hanya logoIndex yang ditentukan (Kirim Thumbnail Logo)
        await sock.sendMessage(
          ctx.id,
          {
            image: { url: selectedLogo.thumb },
            caption: `–  *S O L O G O  L O G O  #${flags.index}*

┌  ◦  *Judul* : ${title || userCached?.query || "Sologo"}
└  ◦  *Jumlah Style* : ${selectedLogo.style?.length || 0} varian`
          },
          { quoted: quotedMsg }
        );

        await ctx.react("✅");
        return;
      }

      // Mode Default: Menampilkan menu interaktif CTA (Button/List)
      const listSections = [];

      // Section 1: Quick Action
      listSections.push({
        title: "⚡ OPSI CEPAT",
        rows: [
          {
            title: `📦 Kirim Semua Hasil (${logoData.length} Desain)`,
            id: `${prefix}sologo "${title}" --all`,
            description: "Unduh seluruh variasi logo beserta latar belakangnya"
          }
        ]
      });

      // Section 2: Logo Results & Styles
      logoData.forEach((logo, idx) => {
        const logoNum = idx + 1;
        const styleRows = (logo.style || []).map((st, sIdx) => ({
          title: `🎨 Logo #${logoNum} - Style #${sIdx + 1} (${st.title})`,
          id: `${prefix}sologo "${title}" -i ${logoNum} -s ${sIdx + 1}`,
          description: `${st.desc}`
        }));

        listSections.push({
          title: `🖼️ DESAIN LOGO #${logoNum}`,
          rows: styleRows
        });
      });

      const sloganInfo = flags.slogan ? `\n├  ◦  *Slogan* : ${flags.slogan}` : "";
      const industryInfo = flags.industry_index ? `\n├  ◦  *Industri* : ${flags.industry_index}` : "";

      const bodyText = `Hi ${userName}!
Hasil pembuatan logo AI untuk *"${title}"* telah siap.

–  *S O L O G O  A I*

┌  ◦  *Judul Logo* : ${title}${sloganInfo}${industryInfo}
├  ◦  *Total Desain* : ${logoData.length} pilihan
└  ◦  *Total Style* : ${logoData.reduce((acc, curr) => acc + (curr.style?.length || 0), 0)} opsi varian

Pilih salah satu varian dari menu di bawah atau kirim seluruh hasil gambar sekaligus.`;

      const buttons = [
        {
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📂 PILIH DESAIN LOGO",
            sections: listSections
          })
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📦 Kirim Semua Logo",
            id: `${prefix}sologo "${title}" --all`
          })
        }
      ];

      const bannerImage = logoData[0]?.thumb || "https://files.catbox.moe/g2e6i5.jpg";

      const options = {
        image: bannerImage,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Sologo Generator`,
            button_title: "Lihat Pilihan Logo"
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
        await sock.sendMessage(
          ctx.id,
          {
            image: { url: bannerImage },
            caption: bodyText
          },
          { quoted: quotedMsg }
        );
      }

      await ctx.react("✅");
    } catch (error) {
      console.error("[Sologo Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;

      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }

      ctx.reply(`❌ Terjadi kesalahan saat memproses logo: ${errorMessage}`);
    }
  }
};
