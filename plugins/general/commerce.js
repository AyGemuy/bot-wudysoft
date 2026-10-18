import {
  metaQuoted,
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "commerce",
  aliases: ["event", "schedulecall", "reqpay", "ordercard"],
  description: "Membuat Event Kalender WhatsApp, Tagihan Pembayaran, atau Kartu Pesanan Produk",
  category: "Tools",
  example: ".event Rapat Tim | Pembahasan Update | Meet Room\n.reqpay 50000 Tagihan Sewa Bot\n.ordercard ORDER_01 75000 Nama Paket",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const cmd = (ctx.cmd || ctx.command || "").toLowerCase();
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botContext = global.bot?.utils?.contextInfo || {};
      const args = ctx.args || [];
      if (["event", "schedulecall"].includes(cmd)) {
        const raw = ctx.query || args.join(" ") || "";
        const parts = raw.split("|").map(s => s?.trim()).filter(Boolean);
        if (parts.length < 2) {
          return ctx.reply(`–  *C R E A T E  E V E N T*

Format:
\`${prefix}event Judul Acara | Deskripsi | Lokasi / Tautan\`

Contoh:
\`${prefix}event Rapat Mingguan | Evaluasi Kinerja Tim | https://meet.google.com/xyz\``);
        }
        ctx.react?.("⏳");
        const title = parts[0];
        const desc = parts[1];
        const locationOrLink = parts[2] || "Online Meeting";
        const startTime = Math.floor(Date.now() / 1e3) + 3600;
        const endTime = startTime + 7200;
        if (typeof sock.event === "function") {
          await sock.event().setName(title).setDescription(desc).setLocation({
            degreesLatitude: -6.2088,
            degreesLongitude: 106.8456,
            name: locationOrLink
          }).setJoinLink(locationOrLink.startsWith("http") ? locationOrLink : "https://whatsapp.com").setStartTime(startTime).setEndTime(endTime).setReminder(1800).send(ctx.id);
        } else {
          await sock.sendMessage(ctx.id, {
            eventMessage: {
              name: title,
              description: desc,
              location: {
                degreesLatitude: -6.2088,
                degreesLongitude: 106.8456,
                name: locationOrLink
              },
              joinLink: locationOrLink.startsWith("http") ? locationOrLink : "https://whatsapp.com",
              startTime: startTime,
              endTime: endTime,
              hasReminder: true,
              reminderOffsetSec: 1800
            }
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.react?.("✅");
      }
      if (cmd === "reqpay") {
        const amount = parseInt(args[0]);
        const note = args.slice(1).join(" ") || "Pembayaran Layanan Bot";
        if (!amount || isNaN(amount)) {
          return ctx.reply(`Format: \`${prefix}reqpay <JumlahRupiah> <Catatan>\`\nContoh: \`${prefix}reqpay 25000 Sewa Bot 1 Bulan\``);
        }
        ctx.react?.("⏳");
        const amountInThousand = amount * 1e3;
        if (typeof sock.payment === "function") {
          await sock.payment().setCurrency("IDR").setAmount(amountInThousand).setFrom(ctx.sender).setNote(note).send(ctx.id);
        } else {
          await sock.sendMessage(ctx.id, {
            requestPaymentMessage: {
              currency: "IDR",
              amount: amountInThousand,
              from: ctx.sender,
              note: note
            }
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.react?.("✅");
      }
      if (cmd === "ordercard") {
        const orderId = args[0] || `ORD_${Date.now()}`;
        const price = parseInt(args[1]) || 5e4;
        const title = args.slice(2).join(" ") || "Paket Layanan Premium";
        ctx.react?.("⏳");
        const payload = {
          orderId: orderId,
          itemCount: 1,
          totalAmount1000: price * 1e3,
          totalCurrencyCode: "IDR",
          orderTitle: title,
          message: "Terima kasih atas pesanan Anda!",
          sellerJid: sock.user.id,
          thumbnail: {
            url: global.bot?.media?.thumb || "https://server.wallpaperalchemy.com/storage/wallpapers/121/4k-anime-wallpaper-starry-night-adventure.jpg"
          }
        };
        if (typeof sock.order === "function") {
          await sock.order().from(payload).send(ctx.id);
        } else {
          await sock.sendMessage(ctx.id, {
            orderMessage: payload
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.react?.("✅");
      }
    } catch (err) {
      console.error("[COMMERCE Error]:", err);
      ctx.react?.("❌");
      ctx.reply(`❌ Gagal: ${err?.message || err}`);
    }
  }
};