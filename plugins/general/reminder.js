import axios from "axios";
import db from "../../data/db.js";
const FALLBACK = {
  Subuh: "04:39",
  Dzuhur: "11:54",
  Ashar: "14:56",
  Maghrib: "17:58",
  Isya: "19:06"
};
let reminderTimeout = null;

function initDB(chatId = null) {
  if (!global.db) global.db = {};
  if (!global.db.sholat) {
    global.db.sholat = {
      settings: {
        city: "Makassar",
        enabled: true
      },
      cache: {
        date: "",
        list: FALLBACK
      },
      sentLocks: {},
      activeReminder: {
        status: false,
        name: "",
        endTime: 0
      },
      chats: {}
    };
  }
  if (chatId && !global.db.sholat.chats[chatId]) {
    global.db.sholat.chats[chatId] = {
      enabled: true,
      city: "Makassar"
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function stopActiveReminder() {
  initDB();
  global.db.sholat.activeReminder = {
    status: false,
    name: "",
    endTime: 0
  };
  saveDB();
  if (reminderTimeout) {
    clearTimeout(reminderTimeout);
    reminderTimeout = null;
  }
}

function to24(t = "") {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return t.trim();
  let [_, h, min, mer] = m;
  let hour = parseInt(h, 10);
  if (mer.toUpperCase() === "PM" && hour < 12) hour += 12;
  if (mer.toUpperCase() === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${min}`;
}
async function getSchedule(city = "Makassar") {
  initDB();
  const now = new Date(new Date().toLocaleString("en-US", {
    timeZone: "Asia/Makassar"
  }));
  const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  if (global.db.sholat.cache?.date === today && global.db.sholat.cache?.list) {
    return global.db.sholat.cache.list;
  }
  try {
    const baseApi = (global.bot?.api?.wudysoft || "").replace(/\/+$/, "");
    const res = await axios.get(`${baseApi}/api/info/jadwal-sholat/v3?city=${encodeURIComponent(city)}`, {
      timeout: 8e3
    });
    const pt = res.data?.prayerTimes;
    if (pt) {
      global.db.sholat.cache = {
        date: today,
        list: {
          Subuh: to24(pt.fajr),
          Dzuhur: to24(pt.dhuhr),
          Ashar: to24(pt.asr),
          Maghrib: to24(pt.maghrib),
          Isya: to24(pt.isha)
        }
      };
      saveDB();
      return global.db.sholat.cache.list;
    }
  } catch {
    global.db.sholat.cache = {
      date: today,
      list: FALLBACK
    };
    saveDB();
  }
  return global.db.sholat.cache.list;
}
export default {
  name: "autoshlat",
  aliases: ["sholatime", "jadwalsholat"],
  description: "Pengingat sholat otomatis sesuai jadwal dengan sistem Full DB",
  category: "Handler",
  before: async (msg, {
    sock,
    ctx
  }) => {
    if (!ctx) return;
    const targetChat = ctx.chat || ctx.id;
    const senderJid = ctx.sender || msg?.key?.participant || msg?.key?.remoteJid || "";
    const userNumber = ctx.senderNumber || senderJid.split("@")[0];
    const raw = (ctx.selectedId || ctx.selectedButtonId || ctx.text || "").trim();
    initDB(targetChat);
    if (raw === "matikan_reminder" || raw === "🔕 Matikan Reminder") {
      stopActiveReminder();
      await ctx.react("🔕").catch(() => {});
      return ctx.reply(`Pengingat sholat telah dimatikan oleh @${userNumber}. Menunggu jadwal berikutnya.`, {
        mentions: [senderJid]
      });
    }
    if (raw === "ibadah_siap" || raw === "🤲 Siap Laksanakan") {
      stopActiveReminder();
      await ctx.react("🤲").catch(() => {});
      return ctx.reply(`Masya Allah, terima kasih @${userNumber}!
Semoga Allah SWT menerima amal ibadahmu dan mempermudah segala urusanmu hari ini.

Aamiin ya Rabbal 'Alamin 🤲✨`, {
        mentions: [senderJid]
      });
    }
    const activeReminder = global.db.sholat.activeReminder;
    if (activeReminder?.status && Date.now() < activeReminder.endTime) {
      const sisaDetik = Math.max(1, Math.ceil((activeReminder.endTime - Date.now()) / 1e3));
      const reminderNotice = `–  *P R A Y E R  A L E R T*

Halo @${userNumber}!
Waktu sholat *${activeReminder.name}* sedang berlangsung!
Sisa peringatan: *${sisaDetik} detik lagi*.

Silakan tekan tombol di bawah untuk mematikan atau konfirmasi.`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤲 Siap Laksanakan",
          id: "ibadah_siap"
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔕 Matikan Reminder",
          id: "matikan_reminder"
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(reminderNotice, global.bot?.footer || "Auto Sholat", buttons, {
          quoted: msg,
          mentions: [senderJid]
        });
      } else {
        await ctx.reply(reminderNotice, {
          mentions: [senderJid]
        });
      }
      return;
    }
    try {
      const date = new Date(new Date().toLocaleString("en-US", {
        timeZone: "Asia/Makassar"
      }));
      const timeNow = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      const today = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      if (timeNow === "00:01" && Object.keys(global.db.sholat.sentLocks || {}).length > 0) {
        global.db.sholat.sentLocks = {};
        saveDB();
      }
      const city = global.db.sholat.chats[targetChat]?.city || global.db.sholat.settings?.city || "Makassar";
      const schedule = await getSchedule(city);
      for (const [waktu, jam] of Object.entries(schedule)) {
        if (timeNow === jam) {
          const lockKey = `${today}_${waktu}_${targetChat}`;
          if (global.db.sholat.sentLocks[lockKey]) continue;
          global.db.sholat.sentLocks[lockKey] = true;
          global.db.sholat.activeReminder = {
            status: true,
            name: waktu,
            endTime: Date.now() + 5e3
          };
          saveDB();
          const bodyText = `–  *P R A Y E R  T I M E*

Waktu *Sholat ${waktu}* telah tiba untuk wilayah ${city} dan sekitarnya.
Ambillah air wudhu dan segeralah mendirikan sholat.

┌  ◦  *Waktu* : ${waktu}
│  ◦  *Pukul* : ${jam} WITA
└  ◦  *Wilayah* : ${city}

_(Pemberitahuan aktif selama 5 detik, klik tombol untuk mematikan)_`;
          const buttons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🤲 Siap Laksanakan",
              id: "ibadah_siap"
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🔕 Matikan Reminder",
              id: "matikan_reminder"
            })
          }];
          if (typeof ctx.sendCta === "function") {
            await ctx.sendCta(bodyText, global.bot?.footer || "Auto Sholat", buttons, {
              quoted: msg
            });
          } else {
            await ctx.reply(bodyText, {
              quoted: msg
            });
          }
          if (reminderTimeout) clearTimeout(reminderTimeout);
          reminderTimeout = setTimeout(() => {
            stopActiveReminder();
          }, 5e3);
          break;
        }
      }
    } catch (_) {}
  },
  execute: async (sock, ctx, msg) => {
    initDB(ctx.chat);
    const targetChat = ctx.chat || ctx.id;
    const prefix = ctx.prefix || ".";
    const city = global.db.sholat.chats[targetChat]?.city || "Makassar";
    const schedule = await getSchedule(city);
    let text = `–  *J A D W A L  S H O L A T*\n\n`;
    text += `Wilayah : *${city}*\n\n`;
    for (const [waktu, jam] of Object.entries(schedule)) {
      text += `┌  ◦  *${waktu}* : ${jam} WITA\n`;
    }
    text += `└  ◦  *Status Auto* : ${global.db.sholat.chats[targetChat]?.enabled ? "Aktif" : "Nonaktif"}\n\n`;
    text += `_Pengingat otomatis aktif 5 detik tepat saat adzan tiba._`;
    return ctx.reply(text);
  }
};