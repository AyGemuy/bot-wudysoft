import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const DEFAULT_BANNER = "https://data.bmkg.go.id/DataMKG/TEWS/20240101000000.mmi.jpg";
const FALLBACK_BANNER = "https://files.catbox.moe/k3h2vd.jpg";
export default {
  name: "gempa",
  aliases: ["infogempa", "bmkg", "gempabmkg"],
  description: "Menampilkan informasi gempa bumi terkini dari BMKG (Auto, Terkini, & Dirasakan).",
  category: "Info",
  example: "• Realtime: gempa\n• Gempa M >= 5.0: gempa --terkini\n• Gempa Dirasakan: gempa --dirasakan",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const rawQuery = (ctx.query || ctx.text || "").toLowerCase().trim();
      let type = "auto";
      if (rawQuery.includes("--terkini") || rawQuery.includes("terkini") || rawQuery.includes("-t")) {
        type = "terkini";
      } else if (rawQuery.includes("--dirasakan") || rawQuery.includes("dirasakan") || rawQuery.includes("-d")) {
        type = "dirasakan";
      }
      const endpoint = `${global.bot?.api?.wudysoft}/api/info/gempa?type=${type}`;
      const response = await axios.get(endpoint, {
        timeout: 15e3
      });
      if (!response.data || response.data.status !== "success" || !response.data.data) {
        throw new Error("Gagal mendapatkan data gempa dari server BMKG.");
      }
      const resData = response.data.data;
      let bodyText = "";
      let mediaUrl = FALLBACK_BANNER;
      let titleHeader = "– INFORMASI GEMPA BMKG –";
      let subtitleHeader = "Badan Meteorologi, Klimatologi, dan Geofisika";
      let listSections = [];
      let mapsUrl = "https://www.google.com/maps";
      if (type === "auto") {
        const item = resData;
        mediaUrl = item.shakemap || FALLBACK_BANNER;
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.coordinates || `${item.lintang},${item.bujur}`)}`;
        titleHeader = "– GEMPA BUMI REALTIME TERBARU –";
        subtitleHeader = `${item.wilayah || "Indonesia"}`;
        bodyText = `–  *G E M P A  B U M I  B M K G*

Informasi parameter gempa bumi realtime terbaru di wilayah Indonesia.

┌  ◦  *Waktu* : ${item.tanggal} (${item.jam})
│  ◦  *Magnitudo* : *${item.magnitude} SR*
│  ◦  *Kedalaman* : ${item.kedalaman}
│  ◦  *Koordinat* : ${item.lintang} - ${item.bujur}
│  ◦  *Wilayah Pusat* : ${item.wilayah}
│  ◦  *Potensi* : ${item.potensi || "-"}
└  ◦  *Skala Dirasakan* : ${item.dirasakan || "Tidak ada data"}

Peta guncangan (shakemap) ditampilkan pada media lampiran di atas.`;
        listSections = [{
          title: "🌐 KATEGORI GEMPA LAINNYA",
          rows: [{
            title: "📊 15 Gempa Terkini (M >= 5.0)",
            id: `${prefix}gempa --terkini`,
            description: "Daftar 15 gempa terbaru berkekuatan di atas 5.0 SR"
          }, {
            title: "🌊 15 Gempa Dirasakan",
            id: `${prefix}gempa --dirasakan`,
            description: "Daftar 15 gempa terbaru yang dirasakan masyarakat"
          }]
        }];
      } else if (type === "terkini") {
        const list = Array.isArray(resData) ? resData : [resData];
        const top = list[0] || {};
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(top.coordinates || `${top.lintang},${top.bujur}`)}`;
        titleHeader = "– 15 GEMPA TERKINI (M >= 5.0) –";
        subtitleHeader = `Gempa Teratas: ${top.magnitude} SR - ${top.wilayah}`;
        bodyText = `–  *G E M P A  T E R K I N I  ( M >= 5.0 )*

Rangkuman gempa bumi berkekuatan signifikan di atas 5.0 SR.

┌  ◦  *Waktu* : ${top.tanggal} (${top.jam})
│  ◦  *Magnitudo* : *${top.magnitude} SR*
│  ◦  *Kedalaman* : ${top.kedalaman}
│  ◦  *Koordinat* : ${top.lintang} - ${top.bujur}
│  ◦  *Pusat Gempa* : ${top.wilayah}
└  ◦  *Potensi* : ${top.potensi || "Tidak berpotensi tsunami"}

Silakan pilih opsi dropdown di bawah untuk melihat daftar gempa lainnya:`;
        const otherRows = list.slice(1, 15).map((g, i) => ({
          title: `${i + 2}. M ${g.magnitude} SR - ${g.tanggal}`,
          id: `${prefix}gempa`,
          description: `${g.jam} | ${g.kedalaman} | ${g.wilayah}`.slice(0, 60)
        }));
        listSections = [{
          title: "📋 14 GEMPA TERKINI LAINNYA",
          rows: otherRows
        }, {
          title: "🔄 GANTI KATEGORI GEMPA",
          rows: [{
            title: "🚨 Gempa Realtime (Auto)",
            id: `${prefix}gempa`,
            description: "Lihat gempa terbaru + Shakemap"
          }, {
            title: "🌊 Gempa Dirasakan",
            id: `${prefix}gempa --dirasakan`,
            description: "Daftar gempa dirasakan masyarakat"
          }]
        }];
      } else if (type === "dirasakan") {
        const list = Array.isArray(resData) ? resData : [resData];
        const top = list[0] || {};
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(top.coordinates || `${top.lintang},${top.bujur}`)}`;
        titleHeader = "– 15 GEMPA DIRASAKAN –";
        subtitleHeader = `Skala: ${top.dirasakan || "-"}`;
        bodyText = `–  *G E M P A  D I R A S A K A N*

Rangkuman peristiwa gempa bumi yang dilaporkan dirasakan oleh warga.

┌  ◦  *Waktu* : ${top.tanggal} (${top.jam})
│  ◦  *Magnitudo* : *${top.magnitude} SR*
│  ◦  *Kedalaman* : ${top.kedalaman}
│  ◦  *Koordinat* : ${top.lintang} - ${top.bujur}
│  ◦  *Pusat Gempa* : ${top.wilayah}
└  ◦  *Skala MMI* : ${top.dirasakan || "-"}

Silakan pilih opsi dropdown di bawah untuk melihat riwayat gempa dirasakan lainnya:`;
        const otherRows = list.slice(1, 15).map((g, i) => ({
          title: `${i + 2}. M ${g.magnitude} SR - ${g.tanggal}`,
          id: `${prefix}gempa`,
          description: `${g.wilayah} | ${g.dirasakan || "-"}`.slice(0, 60)
        }));
        listSections = [{
          title: "📋 14 GEMPA DIRASAKAN LAINNYA",
          rows: otherRows
        }, {
          title: "🔄 GANTI KATEGORI GEMPA",
          rows: [{
            title: "🚨 Gempa Realtime (Auto)",
            id: `${prefix}gempa`,
            description: "Lihat gempa terbaru + Shakemap"
          }, {
            title: "📊 Gempa Terkini (M >= 5.0)",
            id: `${prefix}gempa --terkini`,
            description: "Daftar gempa berkekuatan besar"
          }]
        }];
      }
      const footerText = `${global.bot?.name || "WudysoftBot"} • BMKG Indonesia`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📑 PILIH KATEGORI / DAFTAR GEMPA",
          sections: listSections
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔄 Refresh Data",
          id: `${prefix}gempa ${type !== "auto" ? `--${type}` : ""}`.trim()
        })
      }, {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "📍 Lokasi di Google Maps",
          url: mapsUrl
        })
      }, {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Salin Info Gempa",
          copy_code: `Gempa BMKG: ${bodyText.replace(/\*/g, "").slice(0, 200)}...`
        })
      }];
      await ctx.sendCta(bodyText, footerText, buttons, {
        title: titleHeader,
        subtitle: subtitleHeader,
        media: mediaUrl,
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[Gempa Error]", error);
      await ctx.react("❌");
      ctx.reply(`❌ *Gagal mengambil info gempa:* ${error?.message || error}`);
    }
  }
};