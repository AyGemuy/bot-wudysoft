import {
  simpleQuoted
} from "../../lib/quoted.js";
const formatValue = val => {
  const map = {
    all: "Everyone",
    contacts: "My Contacts",
    contact_blacklist: "My Contacts Except...",
    none: "Nobody",
    match_last_seen: "Same as Last Seen",
    known: "Known Contacts",
    0: "Off",
    86400: "24 Hours",
    604800: "7 Days",
    7776e3: "90 Days"
  };
  return map[val] || val || "Unknown";
};
export default {
  name: "privacy",
  aliases: ["privacysetting", "setprivacy", "privasi"],
  description: "Lihat dan ubah konfigurasi privasi akun WhatsApp secara interaktif",
  category: "Settings",
  example: ".privacy (atau .privacy --type=lastseen --val=all)",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Privacy & Security`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      const typeMatch = rawQuery.match(/--type=([a-zA-Z0-9_-]+)/i);
      const valMatch = rawQuery.match(/--val=([a-zA-Z0-9_-]+)/i);
      const targetType = typeMatch ? typeMatch[1].toLowerCase() : null;
      const targetVal = valMatch ? valMatch[1].toLowerCase() : null;
      if (targetType && targetVal) {
        let successMsg = "";
        switch (targetType) {
          case "lastseen":
            if (typeof sock.updateLastSeenPrivacy === "function") {
              await sock.updateLastSeenPrivacy(targetVal);
              successMsg = `Last Seen ➔ ${formatValue(targetVal)}`;
            }
            break;
          case "online":
            if (typeof sock.updateOnlinePrivacy === "function") {
              await sock.updateOnlinePrivacy(targetVal);
              successMsg = `Online Status ➔ ${formatValue(targetVal)}`;
            }
            break;
          case "profile":
            if (typeof sock.updateProfilePicturePrivacy === "function") {
              await sock.updateProfilePicturePrivacy(targetVal);
              successMsg = `Profile Photo ➔ ${formatValue(targetVal)}`;
            }
            break;
          case "status":
            if (typeof sock.updateStatusPrivacy === "function") {
              await sock.updateStatusPrivacy(targetVal);
              successMsg = `Story / Status ➔ ${formatValue(targetVal)}`;
            }
            break;
          case "readreceipts":
            if (typeof sock.updateReadReceiptsPrivacy === "function") {
              await sock.updateReadReceiptsPrivacy(targetVal);
              successMsg = `Read Receipts ➔ ${formatValue(targetVal)}`;
            }
            break;
          case "groups":
            if (typeof sock.updateGroupsAddPrivacy === "function") {
              await sock.updateGroupsAddPrivacy(targetVal);
              successMsg = `Group Add Permission ➔ ${formatValue(targetVal)}`;
            }
            break;
          case "call":
            if (typeof sock.updateCallPrivacy === "function") {
              await sock.updateCallPrivacy(targetVal);
              successMsg = `Call Privacy ➔ ${formatValue(targetVal)}`;
            }
            break;
          case "disappearing":
            if (typeof sock.updateDefaultDisappearingMode === "function") {
              const seconds = Number(targetVal) || 0;
              await sock.updateDefaultDisappearingMode(seconds);
              successMsg = `Disappearing Timer ➔ ${formatValue(seconds)}`;
            }
            break;
          default:
            throw new Error(`Tipe privasi "${targetType}" tidak valid.`);
        }
        await ctx.react("✅");
        const updateResultText = `–  *P R I V A C Y*

Pengaturan privasi akun berhasil diperbarui.

┌  ◦  *Updated* : ${successMsg}
└  ◦  *Status* : Applied`;
        return ctx.reply(updateResultText);
      }
      let currentPrivacy = {};
      try {
        if (typeof sock.fetchPrivacySettings === "function") {
          currentPrivacy = await sock.fetchPrivacySettings(true) || {};
        }
      } catch (err) {
        console.error("[PRIVACY ERROR] Gagal mengambil pengaturan privasi:", err);
      }
      const lastSeen = formatValue(currentPrivacy.readreceipts ? currentPrivacy.last : "all");
      const online = formatValue(currentPrivacy.online || "all");
      const profilePic = formatValue(currentPrivacy.profile || "all");
      const status = formatValue(currentPrivacy.status || "all");
      const readReceipts = formatValue(currentPrivacy.readreceipts || "all");
      const groupAdd = formatValue(currentPrivacy.groupadd || "all");
      const call = formatValue(currentPrivacy.calladd || "all");
      const bodyText = `–  *P R I V A C Y*

Konfigurasi visibilitas dan privasi akun WhatsApp saat ini.

┌  ◦  *Last Seen* : ${lastSeen}
│  ◦  *Online* : ${online}
│  ◦  *Profile Photo* : ${profilePic}
│  ◦  *Status / Story* : ${status}
│  ◦  *Read Receipts* : ${readReceipts}
│  ◦  *Group Add* : ${groupAdd}
└  ◦  *Call Privacy* : ${call}

Pilih opsi pada menu di bawah untuk mengubah setelan privasi.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "⚙️ UBAH SETELAN PRIVASI",
          sections: [{
            title: "Terakhir Dilihat (Last Seen)",
            rows: [{
              title: "Semua Orang (Everyone)",
              description: "Semua orang bisa melihat last seen",
              id: `${prefix}privacy --type=lastseen --val=all`
            }, {
              title: "Kontak Saya (My Contacts)",
              description: "Hanya kontak yang tersimpan",
              id: `${prefix}privacy --type=lastseen --val=contacts`
            }, {
              title: "Tidak Ada (Nobody)",
              description: "Sembunyikan last seen dari semua orang",
              id: `${prefix}privacy --type=lastseen --val=none`
            }]
          }, {
            title: "Status Online",
            rows: [{
              title: "Semua Orang (Everyone)",
              description: "Semua orang bisa melihat saat online",
              id: `${prefix}privacy --type=online --val=all`
            }, {
              title: "Samakan Last Seen",
              description: "Mengikuti setelan terakhir dilihat",
              id: `${prefix}privacy --type=online --val=match_last_seen`
            }]
          }, {
            title: "Foto Profil (Profile Photo)",
            rows: [{
              title: "Semua Orang (Everyone)",
              description: "Foto profil terlihat oleh publik",
              id: `${prefix}privacy --type=profile --val=all`
            }, {
              title: "Kontak Saya (My Contacts)",
              description: "Foto profil hanya untuk kontak tersimpan",
              id: `${prefix}privacy --type=profile --val=contacts`
            }, {
              title: "Tidak Ada (Nobody)",
              description: "Sembunyikan foto profil dari siapapun",
              id: `${prefix}privacy --type=profile --val=none`
            }]
          }, {
            title: "Laporan Dibaca (Read Receipts)",
            rows: [{
              title: "Aktifkan Centang Biru",
              description: "Tampilkan tanda centang biru saat membaca pesan",
              id: `${prefix}privacy --type=readreceipts --val=all`
            }, {
              title: "Matikan Centang Biru",
              description: "Sembunyikan tanda centang biru saat membaca pesan",
              id: `${prefix}privacy --type=readreceipts --val=none`
            }]
          }, {
            title: "Izin Masuk Grup (Group Add)",
            rows: [{
              title: "Semua Orang (Everyone)",
              description: "Semua orang bisa menambahkan bot ke grup",
              id: `${prefix}privacy --type=groups --val=all`
            }, {
              title: "Hanya Kontak (My Contacts)",
              description: "Hanya kontak tersimpan yang bisa menambahkan",
              id: `${prefix}privacy --type=groups --val=contacts`
            }]
          }, {
            title: "Pesan Sementara Default",
            rows: [{
              title: "Nonaktifkan (Off)",
              description: "Matikan timer pesan sementara",
              id: `${prefix}privacy --type=disappearing --val=0`
            }, {
              title: "24 Jam",
              description: "Pesan terhapus otomatis setelah 24 jam",
              id: `${prefix}privacy --type=disappearing --val=86400`
            }, {
              title: "7 Hari",
              description: "Pesan terhapus otomatis setelah 7 hari",
              id: `${prefix}privacy --type=disappearing --val=604800`
            }, {
              title: "90 Hari",
              description: "Pesan terhapus otomatis setelah 90 hari",
              id: `${prefix}privacy --type=disappearing --val=7776000`
            }]
          }]
        })
      }];
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Pengaturan Privasi`,
            button_title: "Ubah Privasi"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedAiBotMessageInfo: {
            botJid: "0@bot"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, options);
      } else {
        await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[PRIVACY CMD ERROR]:", error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal memproses pengaturan privasi: ${error?.message || error}`);
    }
  }
};