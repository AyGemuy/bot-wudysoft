import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/info/primbon`;
const CONFIG = {
  TIMEOUT: 25e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function parseDateInput(str) {
  if (!str) return null;
  const parts = str.trim().split(/[-/\s.]+/);
  if (parts.length < 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return {
    day: String(day),
    month: String(month),
    year: String(year)
  };
}

function normalizeZodiac(name) {
  const zMap = {
    aries: "aries",
    taurus: "taurus",
    gemini: "gemini",
    cancer: "cancer",
    kanker: "cancer",
    leo: "leo",
    virgo: "virgo",
    libra: "libra",
    scorpio: "scorpio",
    skorpio: "scorpio",
    sagittarius: "sagittarius",
    sagitarius: "sagittarius",
    capricorn: "capricorn",
    kaprikorn: "capricorn",
    aquarius: "aquarius",
    akuarius: "aquarius",
    pisces: "pisces"
  };
  return zMap[name.toLowerCase()] || name.toLowerCase();
}
async function sendPrimbonCta(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const options = {
    jid: targetJid,
    to: targetJid,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 3,
        divider_indices: [2],
        list_title: `${botName} • Kitab Primbon Jawa`,
        button_title: "Menu Primbon"
      }
    },
    contextInfo: {
      forwardingScore: 0,
      isForwarded: false
    },
    quoted: quoted || undefined
  };
  if (typeof ctx?.sendCta === "function" && targetJid === ctx.id) {
    try {
      return await ctx.sendCta(bodyText, footerText, buttons, options);
    } catch (e) {
      console.error("[Primbon sendCta Error]:", e.message);
    }
  }
  try {
    const nativeButtons = buttons.map(b => ({
      name: b.name || "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: b.display_text,
        id: b.id || b.copy_code || ""
      })
    }));
    return await sock.sendMessage(targetJid, {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: bodyText
            },
            footer: {
              text: footerText
            },
            nativeFlowMessage: {
              buttons: nativeButtons
            },
            contextInfo: options.contextInfo
          }
        }
      }
    }, {
      quoted: quoted
    });
  } catch (e) {}
  return await sock.sendMessage(targetJid, {
    text: `${bodyText}\n\n_${footerText}_`
  }, {
    quoted: quoted
  });
}
export default {
  name: "primbon",
  aliases: ["ramalan", "weton", "artinama", "tafsirmimpi", "zodiak", "shio", "nomerhoki"],
  description: "Kumpulan ramalan lengkap Primbon Jawa, Arti Nama, Weton, Jodoh, Zodiak, & Tafsir Mimpi.",
  category: "Primbon",
  limit: false,
  example: "• Arti Nama: primbon artinama Budi\n• Weton: primbon weton 17-08-1945\n• Zodiak: primbon zodiak leo",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx?.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botName = global.bot?.name || "WudysoftBot";
      const textFromArgs = (ctx?.query || ctx?.args?.join(" ") || "").trim();
      const textFromQuoted = (ctx?.quoted?.text || ctx?.quoted?.message?.conversation || ctx?.quoted?.message?.extendedTextMessage?.text || "").trim();
      const input = textFromArgs || textFromQuoted;
      const command = (ctx?.command || "").toLowerCase();
      const args = ctx?.args || [];
      let subFeature = "";
      let queryValue = "";
      if (["weton", "wetonjawa"].includes(command)) {
        subFeature = "weton";
        queryValue = input;
      } else if (["artinama", "nama"].includes(command)) {
        subFeature = "artinama";
        queryValue = input;
      } else if (["tafsirmimpi", "mimpi"].includes(command)) {
        subFeature = "mimpi";
        queryValue = input;
      } else if (["zodiak"].includes(command)) {
        subFeature = "zodiak";
        queryValue = input;
      } else if (["shio"].includes(command)) {
        subFeature = "shio";
        queryValue = input;
      } else if (["nomerhoki", "nohoki"].includes(command)) {
        subFeature = "nomerhoki";
        queryValue = input;
      } else {
        subFeature = (args[0] || "").toLowerCase();
        queryValue = args.slice(1).join(" ").trim() || textFromQuoted;
      }
      if (!subFeature || ["menu", "help", "list"].includes(subFeature)) {
        const menuText = `–  *P R I M B O N  J A W A*

Kumpulan petung ramalan warisan leluhur Nusantara, zodiak, dan tafsir mimpi.

┌  ◦  *Arti Nama* : \`${prefix}primbon artinama <nama>\`
├  ◦  *Tafsir Mimpi* : \`${prefix}primbon mimpi <kata>\`
├  ◦  *Weton Jawa* : \`${prefix}primbon weton <Tgl-Bln-Thn>\`
├  ◦  *Nomor Hoki* : \`${prefix}primbon nomerhoki <no_hp>\`
├  ◦  *Ramalan Zodiak* : \`${prefix}primbon zodiak <zodiak>\`
├  ◦  *Ramalan Shio* : \`${prefix}primbon shio <nama_shio>\`
├  ◦  *Hari Baik Mancing* : \`${prefix}primbon mancing <Tgl-Bln-Thn>\`
└  ◦  *Ramalan Jodoh* : \`${prefix}primbon jodoh <Nama1>|<Tgl1>|<Nama2>|<Tgl2>\`

Silakan pilih opsi instan di bawah atau ketik perintah di atas:`;
        const buttons = [{
          name: "quick_reply",
          display_text: "📜 Weton Hari Ini",
          id: `${prefix}primbon weton ${new Date().getDate()}-${new Date().getMonth() + 1}-${new Date().getFullYear()}`
        }, {
          name: "quick_reply",
          display_text: "🌙 Tafsir Mimpi",
          id: `${prefix}primbon mimpi ular`
        }, {
          name: "quick_reply",
          display_text: "⭐ Cek Zodiak Leo",
          id: `${prefix}primbon zodiak leo`
        }];
        return await sendPrimbonCta(sock, ctx, ctx.id, menuText, `${botName} • Kitab Primbon Jawa`, buttons, quotedMsg);
      }
      await ctx.react("🔮");
      let apiParams = {};
      if (["artinama", "nama", "arti_nama"].includes(subFeature)) {
        if (!queryValue) return ctx.reply(`⚠️ Masukkan nama yang ingin dicari artinya!\nContoh: \`${prefix}primbon artinama Budi Santoso\``);
        apiParams = {
          path: "arti_nama",
          a: queryValue,
          nama: queryValue,
          nama1: queryValue
        };
        const {
          data
        } = await axios.get(API_URL, {
          params: apiParams,
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        if (!data || !data.status || !data.message) throw new Error(data?.message || "Arti nama tidak ditemukan.");
        const m = data.message;
        let out = `–  *A R T I  N A M A*

┌  ◦  *Nama* : ${m.nama}
└  ◦  *Hasil Analisis* :

${m.arti || "-"}`;
        if (m.catatan) out += `\n\n💡 _${m.catatan}_`;
        return ctx.reply(out);
      }
      if (["mimpi", "tafsirmimpi", "tafsir_mimpi"].includes(subFeature)) {
        if (!queryValue) return ctx.reply(`⚠️ Masukkan kata kunci mimpi!\nContoh: \`${prefix}primbon mimpi ular\``);
        apiParams = {
          path: "tafsir_mimpi",
          a: queryValue,
          mimpi: queryValue
        };
        const {
          data
        } = await axios.get(API_URL, {
          params: apiParams,
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        if (!data || !data.status || !data.message) throw new Error(data?.message || "Tafsir mimpi tidak ditemukan.");
        const m = data.message;
        let out = `–  *T A F S I R  M I M P I*

┌  ◦  *Mimpi* : “${m.mimpi}”
└  ◦  *Makna* :

${m.arti || "-"}`;
        if (m.solusi) out += `\n\n🧭 *Nasihat / Solusi* :\n${m.solusi}`;
        return ctx.reply(out);
      }
      if (["weton", "wetonjawa", "weton_jawa"].includes(subFeature)) {
        const parsedDate = parseDateInput(queryValue);
        if (!parsedDate) {
          return ctx.reply(`⚠️ Format tanggal salah! Gunakan: \`Tgl-Bulan-Tahun\`\nContoh: \`${prefix}primbon weton 17-08-1945\``);
        }
        apiParams = {
          path: "weton_jawa",
          a: parsedDate.day,
          t: parsedDate.month,
          n: parsedDate.year,
          tgl: parsedDate.day,
          bln: parsedDate.month,
          thn: parsedDate.year
        };
        const {
          data
        } = await axios.get(API_URL, {
          params: apiParams,
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        if (!data || !data.status || !data.message) throw new Error(data?.message || "Perhitungan weton gagal.");
        const m = data.message;
        const out = `–  *W E T O N  J A W A*

Petung kelahiran berdasarkan penanggalan Jawa.

┌  ◦  *Tanggal* : ${m.tanggal?.trim() || queryValue}
│  ◦  *Jumlah Neptu* : ${m.jumlah_neptu?.trim() || "-"}
│  ◦  *Jam Baik* : ${m.jam_baik?.trim() || "-"}
└  ◦  *Naga Hari* : ${m.naga_hari?.trim() || "-"}

–  *W A T A K  H A R I*

${m.watak_hari?.trim() || "-"}

–  *W A T A K  K E L A H I R A N*

${m.watak_kelahiran?.trim() || "-"}`;
        return ctx.reply(out);
      }
      if (["nomerhoki", "nohoki", "nomer_hoki"].includes(subFeature)) {
        const cleanPhone = queryValue.replace(/[^0-9]/g, "");
        if (!cleanPhone || cleanPhone.length < 8) {
          return ctx.reply(`⚠️ Masukkan nomor handphone yang valid!\nContoh: \`${prefix}primbon nomerhoki 081234567890\``);
        }
        apiParams = {
          path: "nomer_hoki",
          a: cleanPhone,
          nomer: cleanPhone
        };
        const {
          data
        } = await axios.get(API_URL, {
          params: apiParams,
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        if (!data || !data.status || !data.message) throw new Error(data?.message || "Perhitungan nomor hoki gagal.");
        const m = data.message;
        let out = `–  *N O M O R  H O K I*

Analisis energi angka menggunakan perhitungan Bagua Shuzi.

┌  ◦  *Nomor HP* : ${m.nomer_hp || cleanPhone}
└  ◦  *Angka Shuzi* : ${m.angka_shuzi || "-"}\n\n`;
        if (m.energi_positif) {
          out += `–  *E N E R G I  P O S I T I F  (${m.energi_positif.persentase || "-"})*

┌  ◦  *Kekayaan* : ${m.energi_positif.kekayaan || "-"}
│  ◦  *Kesehatan* : ${m.energi_positif.kesehatan || "-"}
│  ◦  *Cinta / Relasi* : ${m.energi_positif.cinta || "-"}
└  ◦  *Kestabilan* : ${m.energi_positif.kestabilan || "-"}\n\n`;
        }
        if (m.energi_negatif) {
          out += `–  *E N E R G I  N E G A T I F  (${m.energi_negatif.persentase || "-"})*

┌  ◦  *Perselisihan* : ${m.energi_negatif.perselisihan || "-"}
│  ◦  *Kehilangan* : ${m.energi_negatif.kehilangan || "-"}
│  ◦  *Malapetaka* : ${m.energi_negatif.malapetaka || "-"}
└  ◦  *Kehancuran* : ${m.energi_negatif.kehancuran || "-"}\n\n`;
        }
        if (m.catatan) out += `💡 _${m.catatan.trim()}_`;
        return ctx.reply(out);
      }
      if (["zodiak"].includes(subFeature)) {
        if (!queryValue) return ctx.reply(`⚠️ Masukkan nama zodiak!\nContoh: \`${prefix}primbon zodiak aries\``);
        const zodiac = normalizeZodiac(queryValue);
        apiParams = {
          path: "zodiak",
          a: zodiac,
          zodiak: zodiac
        };
        const {
          data
        } = await axios.get(API_URL, {
          params: apiParams,
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        if (!data || !data.status || !data.message) throw new Error(data?.message || "Ramalan zodiak gagal dimuat.");
        const m = data.message;
        const out = `–  *Z O D I A K  ${(m.zodiak || zodiac).toUpperCase()}*

Karakteristik astrologi dan perbintangan.

┌  ◦  *No. Keberuntungan* : ${m.nomor_keberuntungan || "-"}
│  ◦  *Warna Keberuntungan* : ${m.warna_keberuntungan || "-"}
│  ◦  *Batu Permata* : ${m.batu_keberuntungan || "-"}
│  ◦  *Bunga Hoki* : ${m.bunga_keberuntungan || "-"}
│  ◦  *Elemen Alam* : ${m.elemen_keberuntungan || "-"}
│  ◦  *Planet Pengitari* : ${m.planet_yang_mengitari || "-"}
└  ◦  *Pasangan Serasi* : ${m.pasangan_zodiak || "-"}

–  *R A M A L A N*

${m.catatan || "-"}`;
        return ctx.reply(out);
      }
      if (["shio"].includes(subFeature)) {
        if (!queryValue) return ctx.reply(`⚠️ Masukkan nama shio!\nContoh: \`${prefix}primbon shio naga\` atau \`kelinci\``);
        const shioName = queryValue.toLowerCase();
        apiParams = {
          path: "shio",
          a: shioName,
          shio: shioName
        };
        const {
          data
        } = await axios.get(API_URL, {
          params: apiParams,
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        if (!data || !data.status || !data.message) throw new Error(data?.message || "Ramalan shio tidak ditemukan.");
        const out = `–  *S H I O  ${shioName.toUpperCase()}*

${data.message}`;
        return ctx.reply(out);
      }
      if (["mancing", "primbon_memancing_ikan"].includes(subFeature)) {
        const parsedDate = parseDateInput(queryValue);
        if (!parsedDate) {
          return ctx.reply(`⚠️ Masukkan tanggal mancing! Contoh: \`${prefix}primbon mancing 25-10-2024\``);
        }
        apiParams = {
          path: "primbon_memancing_ikan",
          a: parsedDate.day,
          t: parsedDate.month,
          n: parsedDate.year,
          tgl: parsedDate.day,
          bln: parsedDate.month,
          thn: parsedDate.year
        };
        const {
          data
        } = await axios.get(API_URL, {
          params: apiParams,
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        if (!data || !data.status || !data.message) throw new Error(data?.message || "Gagal menghitung primbon mancing.");
        const m = data.message;
        let out = `–  *P E T U N G  M A N C I N G*

┌  ◦  *Tanggal* : ${m.tgl_mancing || queryValue}
└  ◦  *Hasil Petung* : ${m.result || "-"}`;
        if (m.catatan) out += `\n\n💡 _${m.catatan}_`;
        return ctx.reply(out);
      }
      if (["jodoh", "ramalan_jodoh"].includes(subFeature)) {
        const parts = queryValue.split("|");
        if (parts.length < 4) {
          return ctx.reply(`–  *P E T U N G  J O D O H*\n\n` + `Gunakan pemisah pipa (|):\n` + `\`${prefix}primbon jodoh NamaAnda|TglLahirAnda|NamaPasangan|TglLahirPasangan\`\n\n` + `Contoh:\n\`${prefix}primbon jodoh Budi|12-05-1998|Siti|24-11-2000\``);
        }
        const nama1 = parts[0].trim();
        const d1 = parseDateInput(parts[1]);
        const nama2 = parts[2].trim();
        const d2 = parseDateInput(parts[3]);
        if (!d1 || !d2) {
          return ctx.reply("❌ Format tanggal lahir tidak valid! Gunakan format `DD-MM-YYYY`.");
        }
        apiParams = {
          path: "ramalan_jodoh",
          a: nama1,
          t: d1.day,
          n: d1.month,
          i: d1.year,
          e: nama2,
          s: d2.day,
          r: d2.month,
          l: d2.year
        };
        const {
          data
        } = await axios.get(API_URL, {
          params: apiParams,
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        if (!data || !data.status || !data.message) throw new Error(data?.message || "Perhitungan ramalan jodoh gagal.");
        const m = data.message;
        let out = `–  *K E C O C O K A N  J O D O H*

┌  ◦  *Pihak 1* : ${m.nama_anda?.nama || nama1} (${m.nama_anda?.tgl_lahir || ""})
└  ◦  *Pihak 2* : ${m.nama_pasangan?.nama || nama2} (${m.nama_pasangan?.tgl_lahir || ""})

–  *H A S I L  R A M A L A N*

${m.result || "-"}`;
        if (m.catatan) out += `\n\n💡 _${m.catatan}_`;
        return ctx.reply(out);
      }
      return ctx.reply(`❌ Sub-fitur primbon \`${subFeature}\` tidak dikenali. Ketik \`${prefix}primbon\` untuk melihat daftar lengkap.`);
    } catch (e) {
      console.error("[PRIMBON ERROR]:", e);
      await ctx.react("❌");
      const errMsg = e.response?.data?.error || e.response?.data?.message || (typeof e.response?.data === "string" ? e.response.data : null) || e.message;
      ctx.reply(`❌ Gagal memuat Primbon: ${errMsg}`);
    }
  }
};