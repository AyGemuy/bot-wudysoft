import {
  simpleQuoted
} from "../../lib/quoted.js";
const formatValue = val => {
  const map = {
    all: "Everyone (Semua Orang)",
    contacts: "My Contacts (Kontak Saya)",
    contact_blacklist: "My Contacts Except... (Kecualikan...)",
    none: "Nobody (Tidak Ada)",
    match_last_seen: "Same as Last Seen (Samakan Last Seen)",
    known: "Known Contacts",
    0: "Off (Nonaktif)",
    86400: "24 Hours (24 Jam)",
    604800: "7 Days (7 Hari)",
    7776e3: "90 Days (90 Hari)"
  };
  return map[val] || val || "Unknown";
};
export default {
  name: "privacy",
  aliases: ["privacysetting", "setprivacy", "privasi"],
  description: "Lihat dan ubah konfigurasi privasi serta keamanan akun WhatsApp secara interaktif (Docs v0.9 Ready)",
  category: "Settings",
  example: ".privacy (atau .privacy --type=lastseen --val=contacts)",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Privacy & Security Engine`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      const typeMatch = rawQuery.match(/--type=([a-zA-Z0-9_-]+)/i);
      const valMatch = rawQuery.match(/--val=([^]+)/i);
      const targetType = typeMatch ? typeMatch[1].toLowerCase() : null;
      let targetVal = valMatch ? valMatch[1].trim() : null;
      if (targetType && targetVal) {
        let successMsg = "";
        switch (targetType) {
          case "lastseen":
            if (typeof sock.updateLastSeenPrivacy === "function") {
              await sock.updateLastSeenPrivacy(targetVal);
              successMsg = `Last Seen ➔ ${formatValue(targetVal)}`;
            } else {
              throw new Error("Metode updateLastSeenPrivacy tidak didukung di socket ini.");
            }
            break;
          case "online":
            if (typeof sock.updateOnlinePrivacy === "function") {
              await sock.updateOnlinePrivacy(targetVal);
              successMsg = `Online Status ➔ ${formatValue(targetVal)}`;
            } else {
              throw new Error("Metode updateOnlinePrivacy tidak didukung.");
            }
            break;
          case "profile":
            if (typeof sock.updateProfilePicturePrivacy === "function") {
              await sock.updateProfilePicturePrivacy(targetVal);
              successMsg = `Profile Photo ➔ ${formatValue(targetVal)}`;
            } else {
              throw new Error("Metode updateProfilePicturePrivacy tidak didukung.");
            }
            break;
          case "status":
            if (typeof sock.updateStatusPrivacy === "function") {
              await sock.updateStatusPrivacy(targetVal);
              successMsg = `Story / Status ➔ ${formatValue(targetVal)}`;
            } else {
              throw new Error("Metode updateStatusPrivacy tidak didukung.");
            }
            break;
          case "readreceipts":
            if (typeof sock.updateReadReceiptsPrivacy === "function") {
              await sock.updateReadReceiptsPrivacy(targetVal);
              successMsg = `Read Receipts (Centang Biru) ➔ ${formatValue(targetVal)}`;
            } else {
              throw new Error("Metode updateReadReceiptsPrivacy tidak didukung.");
            }
            break;
          case "groups":
            if (typeof sock.updateGroupsAddPrivacy === "function") {
              await sock.updateGroupsAddPrivacy(targetVal);
              successMsg = `Group Add Permission ➔ ${formatValue(targetVal)}`;
            } else {
              throw new Error("Metode updateGroupsAddPrivacy tidak didukung.");
            }
            break;
          case "disappearing":
            if (typeof sock.updateDefaultDisappearingMode === "function") {
              const seconds = Number(targetVal) || 0;
              await sock.updateDefaultDisappearingMode(seconds);
              successMsg = `Disappearing Timer ➔ ${formatValue(seconds)}`;
            } else {
              throw new Error("Metode updateDefaultDisappearingMode tidak didukung.");
            }
            break;
          case "bio":
          case "about":
            if (typeof sock.updateTextStatus === "function") {
              await sock.updateTextStatus(targetVal, "⚡");
              successMsg = `About / Bio ➔ "${targetVal}"`;
            } else {
              throw new Error("Metode updateTextStatus tidak didukung.");
            }
            break;
          case "reportcontact":
            if (typeof sock.reportContact === "function") {
              await sock.reportContact(targetVal);
              successMsg = `Report & Block ➔ ${targetVal}`;
            } else if (typeof sock.reportSpam === "function") {
              await sock.reportSpam(targetVal);
              successMsg = `Report Spam ➔ ${targetVal}`;
            }
            break;
          default:
            throw new Error(`Tipe privasi "${targetType}" tidak dikenali.`);
        }
        await ctx.react("✅");
        const updateResultText = `–  *P R I V A C Y  U P D A T E*

Konfigurasi privasi berhasil diterapkan ke server WhatsApp.

┌  ◦  *Pembaruan* : ${successMsg}
└  ◦  *Status* : Applied Successfully`;
        return ctx.reply(updateResultText);
      }
      let currentPrivacy = {};
      try {
        if (typeof sock.fetchPrivacySettings === "function") {
          currentPrivacy = await sock.fetchPrivacySettings(true) || {};
        }
      } catch (err) {
        console.error("[PRIVACY ERROR] Gagal fetchPrivacySettings:", err?.message);
      }
      const lastSeen = formatValue(currentPrivacy.readreceipts ? currentPrivacy.last : "all");
      const online = formatValue(currentPrivacy.online || "all");
      const profilePic = formatValue(currentPrivacy.profile || "all");
      const statusStory = formatValue(currentPrivacy.status || "all");
      const readReceipts = formatValue(currentPrivacy.readreceipts || "all");
      const groupAdd = formatValue(currentPrivacy.groupadd || "all");
      const callPrivacy = formatValue(currentPrivacy.calladd || "all");
      const bodyText = `–  *P R I V A C Y  S E T T I N G S*

Konfigurasi visibilitas dan proteksi akun WhatsApp Anda saat ini:

┌  ◦  *Last Seen* : ${lastSeen}
│  ◦  *Online Status* : ${online}
│  ◦  *Profile Photo* : ${profilePic}
│  ◦  *Status / Story* : ${statusStory}
│  ◦  *Read Receipts* : ${readReceipts}
│  ◦  *Group Add* : ${groupAdd}
└  ◦  *Call Privacy* : ${callPrivacy}

Pilih opsi dari menu interaktif di bawah untuk mengubah setelan:`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "⚙️ KELOLA PRIVASI AKUN",
          sections: [{
            title: "1. Terakhir Dilihat (Last Seen)",
            rows: [{
              title: "Semua Orang (Everyone)",
              description: "Bisa dilihat semua pengguna",
              id: `${prefix}privacy --type=lastseen --val=all`
            }, {
              title: "Kontak Saya (My Contacts)",
              description: "Hanya nomor yang tersimpan di kontak",
              id: `${prefix}privacy --type=lastseen --val=contacts`
            }, {
              title: "Kontak Kecuali... (Blacklist)",
              description: "Kecualikan kontak blacklist",
              id: `${prefix}privacy --type=lastseen --val=contact_blacklist`
            }, {
              title: "Tidak Ada (Nobody)",
              description: "Sembunyikan dari siapa saja",
              id: `${prefix}privacy --type=lastseen --val=none`
            }]
          }, {
            title: "2. Status Online",
            rows: [{
              title: "Semua Orang (Everyone)",
              description: "Semua orang bisa melihat saat bot online",
              id: `${prefix}privacy --type=online --val=all`
            }, {
              title: "Samakan dengan Last Seen",
              description: "Mengikuti setelan Terakhir Dilihat",
              id: `${prefix}privacy --type=online --val=match_last_seen`
            }]
          }, {
            title: "3. Foto Profil (Profile Picture)",
            rows: [{
              title: "Semua Orang (Everyone)",
              description: "Foto profil terbuka untuk publik",
              id: `${prefix}privacy --type=profile --val=all`
            }, {
              title: "Kontak Saya (My Contacts)",
              description: "Hanya untuk kontak tersimpan",
              id: `${prefix}privacy --type=profile --val=contacts`
            }, {
              title: "Kontak Kecuali... (Blacklist)",
              description: "Sembunyikan dari daftar blacklist",
              id: `${prefix}privacy --type=profile --val=contact_blacklist`
            }, {
              title: "Tidak Ada (Nobody)",
              description: "Sembunyikan foto profil dari semua orang",
              id: `${prefix}privacy --type=profile --val=none`
            }]
          }, {
            title: "4. Status / Story Privacy",
            rows: [{
              title: "Semua Orang (Everyone)",
              description: "Story dapat dilihat semua orang",
              id: `${prefix}privacy --type=status --val=all`
            }, {
              title: "Kontak Saya (My Contacts)",
              description: "Story hanya untuk kontak tersimpan",
              id: `${prefix}privacy --type=status --val=contacts`
            }, {
              title: "Kontak Kecuali... (Blacklist)",
              description: "Kecualikan kontak blacklist dari story",
              id: `${prefix}privacy --type=status --val=contact_blacklist`
            }, {
              title: "Sembunyikan (Nobody)",
              description: "Tidak ada yang dapat melihat story",
              id: `${prefix}privacy --type=status --val=none`
            }]
          }, {
            title: "5. Laporan Dibaca (Read Receipts)",
            rows: [{
              title: "Aktifkan Centang Biru (All)",
              description: "Tampilkan centang biru saat pesan dibaca",
              id: `${prefix}privacy --type=readreceipts --val=all`
            }, {
              title: "Matikan Centang Biru (None)",
              description: "Sembunyikan laporan dibaca",
              id: `${prefix}privacy --type=readreceipts --val=none`
            }]
          }, {
            title: "6. Izin Masuk Grup (Group Add)",
            rows: [{
              title: "Semua Orang (Everyone)",
              description: "Semua pengguna bisa menambahkan bot ke grup",
              id: `${prefix}privacy --type=groups --val=all`
            }, {
              title: "Kontak Saya (My Contacts)",
              description: "Hanya kontak tersimpan yang berhak invite",
              id: `${prefix}privacy --type=groups --val=contacts`
            }, {
              title: "Kontak Kecuali... (Blacklist)",
              description: "Kecualikan blacklist dari izin invite grup",
              id: `${prefix}privacy --type=groups --val=contact_blacklist`
            }]
          }, {
            title: "7. Pesan Sementara Default",
            rows: [{
              title: "Nonaktifkan (Off)",
              description: "Pesan tidak terhapus otomatis",
              id: `${prefix}privacy --type=disappearing --val=0`
            }, {
              title: "24 Jam",
              description: "Pesan terhapus setelah 24 jam",
              id: `${prefix}privacy --type=disappearing --val=86400`
            }, {
              title: "7 Hari",
              description: "Pesan terhapus setelah 7 hari",
              id: `${prefix}privacy --type=disappearing --val=604800`
            }, {
              title: "90 Hari",
              description: "Pesan terhapus setelah 90 hari",
              id: `${prefix}privacy --type=disappearing --val=7776000`
            }]
          }]
        })
      }];
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Pengaturan Privasi`,
            button_title: "Buka Menu Privasi"
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