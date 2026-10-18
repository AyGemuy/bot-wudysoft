import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
const GROUP_FEATURES = {
  welcome: {
    name: "Welcome Message",
    desc: "Kirim banner sambutan otomatis saat ada member baru bergabung",
    key: "welcome",
    aliases: ["sambut", "sambutan", "wel"]
  },
  leave: {
    name: "Leave / Goodbye",
    desc: "Kirim notifikasi perpisahan saat ada member keluar atau dikick",
    key: "leave",
    aliases: ["goodbye", "keluar", "out", "bye"]
  },
  detect: {
    name: "Group Detective (Updates)",
    desc: "Notifikasi otomatis saat subjek, deskripsi, open/close, atau admin berubah",
    key: "detect",
    aliases: ["deteksi", "groupupdate", "updates", "notif"]
  },
  promote: {
    name: "Promote Alert",
    desc: "Notifikasi khusus saat seorang member diangkat menjadi Admin",
    key: "promote",
    aliases: ["promotalert", "notifpromote"]
  },
  demote: {
    name: "Demote Alert",
    desc: "Notifikasi khusus saat jabatan Admin seorang member dicopot",
    key: "demote",
    aliases: ["demotalert", "notifdemote"]
  },
  antidelete: {
    name: "Anti Delete",
    desc: "Kirim ulang pesan teks atau media yang ditarik/dihapus peserta",
    key: "antidelete",
    aliases: ["antitarik", "antidel", "deleted"]
  },
  antilink: {
    name: "Anti Link WhatsApp",
    desc: "Hapus otomatis pesan member yang mengirim tautan undangan grup",
    key: "antilink",
    aliases: ["antilinkgc", "linkprotect", "link"]
  },
  antibot: {
    name: "Anti Bot Protection",
    desc: "Keluarkan otomatis bot WhatsApp lain yang masuk ke grup",
    key: "antibot",
    aliases: ["nobot", "botprotect"]
  },
  antitoxic: {
    name: "Anti Toxic / Badword",
    desc: "Hapus pesan yang mengandung kata-kata kasar atau kotor",
    key: "antitoxic",
    aliases: ["toxic", "antibadword", "badword"]
  },
  nsfw: {
    name: "NSFW (+18 Mode)",
    desc: "Izinkan perintah dan konten dewasa (+18) di dalam grup ini",
    key: "nsfw",
    aliases: ["dewasa", "porn", "hentai"]
  },
  mute: {
    name: "Group Mute (Silent)",
    desc: "Bot hanya merespon perintah dari Admin & Owner di grup ini",
    key: "mute",
    aliases: ["botmute", "silent", "mutegc"]
  }
};

function findFeatureKey(query = "") {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  if (GROUP_FEATURES[q]) return q;
  for (const [key, val] of Object.entries(GROUP_FEATURES)) {
    if (val.aliases?.includes(q)) return key;
  }
  return null;
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["key", "k", "fitur", "setting", "feature", "f"].includes(key)) key = "key";
    if (["state", "s", "val", "v", "status", "opt"].includes(key)) key = "state";
    if (["list", "l", "menu", "all", "panel"].includes(key)) key = "list";
    if (["help", "h"].includes(key)) key = "help";
    if (["text", "msg", "pesan", "t", "m"].includes(key)) key = "text";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else val = rawVal;
    }
    flags[key] = val;
  }
  return {
    flags: flags,
    cleanPrompt: input.replace(flagRegex, "").trim()
  };
}
export default {
  name: "setgroup",
  aliases: ["groupsetting", "gcset", "gcsetting", "groupconfig", "welcome", "leave", "detect", "antidelete", "antilink", "antibot", "antitoxic", "nsfw", "mute", "setwelcome", "setleave"],
  description: "Kelola seluruh setelan fitur dan proteksi otomatisasi grup",
  category: "Group",
  admin: true,
  group: true,
  example: "setgroup | welcome on | setwelcome Halo @user | leave off | detect on",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isGroup) {
        return ctx.reply("❌ Perintah ini hanya dapat dijalankan di dalam *Grup WhatsApp*.");
      }
      if (!ctx.isAdmin && !ctx.isOwner) {
        return ctx.reply("❌ Perintah ini hanya dapat diatur oleh *Admin Grup* atau *Owner Bot*.");
      }
      const prefix = ctx.prefix || ".";
      const cmd = (ctx.command || ctx.cmd || "setgroup").toLowerCase();
      const botName = global.bot?.name || "Paimon-bot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const footerText = `${botName} • Group Security & Automation`;
      const chatId = ctx.chat || ctx.id;
      if (typeof db.ensureGroup === "function") {
        db.ensureGroup(chatId);
      } else {
        if (!global.db) global.db = {};
        if (!global.db.group) global.db.group = {};
        if (!global.db.group[chatId]) {
          global.db.group[chatId] = {
            from: chatId,
            config: {},
            bans: false,
            mute: false,
            welcome: false,
            leave: false,
            detect: true,
            promote: true,
            demote: true,
            antilink: false,
            antidelete: false,
            antibot: false,
            antitoxic: false,
            nsfw: false
          };
        }
      }
      const groupData = global.db.group[chatId];
      const groupName = ctx.groupName || chatId.split("@")[0];
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        const allCmds = ["setgroup", "groupsetting", "gcset", "gcsetting", "groupconfig", "welcome", "leave", "detect", "antidelete", "antilink", "antibot", "antitoxic", "nsfw", "mute", "setwelcome", "setleave"];
        if (allCmds.some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const freeTokens = cleanPrompt.split(/\s+/).filter(Boolean);
      if (cmd === "setwelcome" || cmd === "welcome" && flags.text) {
        const customText = flags.text || cleanPrompt;
        if (!customText) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`–  *S E T  W E L C O M E*

Silakan masukkan template pesan sambutan untuk member baru.

┌  ◦  *Format* : ${prefix}setwelcome <teks>
└  ◦  *Example* : ${prefix}setwelcome Halo @user, selamat datang di {group}!

–  *V A R I A B E L*
┌  ◦  \`@user\` : Tag member baru
│  ◦  \`{group}\` : Nama grup
│  ◦  \`{desc}\` : Deskripsi grup
│  ◦  \`{total}\` : Total member grup
└  ◦  \`{date}\` / \`{time}\` : Waktu bergabung`);
        }
        groupData.welcome = customText;
        if (typeof db.write === "function") db.write(global.db);
        if (typeof ctx.react === "function") await ctx.react("✅");
        return ctx.reply(`–  *S E T  W E L C O M E*\n\n┌  ◦  *Status* : Tersimpan\n└  ◦  *Grup* : ${groupName}\n\nTemplate pesan sambutan baru berhasil diperbarui.\n\n–  *P R E V I E W*\n\n${customText}`, {
          quoted: quotedMsg
        });
      }
      if (cmd === "setleave" || cmd === "leave" && flags.text) {
        const customText = flags.text || cleanPrompt;
        if (!customText) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`–  *S E T  L E A V E*

Silakan masukkan template pesan perpisahan member keluar.

┌  ◦  *Format* : ${prefix}setleave <teks>
└  ◦  *Example* : ${prefix}setleave Selamat tinggal @user dari {group}!

–  *V A R I A B E L*
┌  ◦  \`@user\` : Tag member keluar
│  ◦  \`{group}\` : Nama grup
│  ◦  \`{total}\` : Sisa member grup
└  ◦  \`{time}\` : Waktu keluar`);
        }
        groupData.leave = customText;
        if (typeof db.write === "function") db.write(global.db);
        if (typeof ctx.react === "function") await ctx.react("✅");
        return ctx.reply(`–  *S E T  L E A V E*\n\n┌  ◦  *Status* : Tersimpan\n└  ◦  *Grup* : ${groupName}\n\nTemplate pesan perpisahan baru berhasil diperbarui.\n\n–  *P R E V I E W*\n\n${customText}`, {
          quoted: quotedMsg
        });
      }
      if (flags.help) {
        const allKeys = Object.keys(GROUP_FEATURES).map(k => `\`${k}\``).join(", ");
        return ctx.reply(`–  *S E T  G R O U P*

Silakan tentukan pengaturan fitur atau proteksi otomatisasi grup.

┌  ◦  *Control Panel* : ${prefix}setgroup
│  ◦  *Aktifkan* : ${prefix}setgroup <fitur> on
│  ◦  *Matikan* : ${prefix}setgroup <fitur> off
│  ◦  *Set Welcome* : ${prefix}setwelcome <teks>
│  ◦  *Set Leave* : ${prefix}setleave <teks>
└  ◦  *Reset Template* : ${prefix}welcome reset

–  *D A F T A R  F I T U R*
${allKeys}`);
      }
      const directKey = findFeatureKey(cmd);
      const isMenuCall = freeTokens.length === 0 && !flags.key && !directKey || Boolean(flags.list);
      if (isMenuCall) {
        if (typeof ctx.react === "function") await ctx.react("⏳");
        let groupMetadata = {};
        try {
          groupMetadata = await sock.groupMetadata(chatId);
        } catch {}
        let groupPic = "https://picsum.photos/seed/cyber/200/200";
        try {
          groupPic = await sock.profilePictureUrl(chatId, "image");
        } catch {}
        const subject = groupMetadata.subject || groupName || "COMMUNITY";
        const nameParts = subject.trim().split(/\s+/);
        const title_l = (nameParts[0] || "GROUP").slice(0, 10).toUpperCase();
        const title_r = (nameParts.slice(1).join(" ") || ".HQ").slice(0, 12).toUpperCase();
        let estDate = "EST. 2023.01.12";
        if (groupMetadata.creation) {
          const d = new Date(groupMetadata.creation * 1e3);
          estDate = `EST. ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
        }
        const admins = (groupMetadata.participants || []).filter(p => p.admin);
        const adm1 = admins[0] ? `@${admins[0].id.split("@")[0].slice(0, 10)}` : "@Admin_1";
        const adm2 = admins[1] ? `@${admins[1].id.split("@")[0].slice(0, 10)}` : "@Admin_2";
        const adm3 = admins[2] ? `@${admins[2].id.split("@")[0].slice(0, 10)}` : "@Admin_3";
        let mediaOutput = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
        try {
          const groupPayload = {
            sub_title: "PROTOCOL: ENCRYPTED_COMM",
            title_l: title_l,
            title_r: title_r,
            version: "WHATSAPP V2.9",
            est: estDate,
            users: `${(groupMetadata.participants || []).length || 1}`,
            u_title: "Active Entities",
            desc_title: "Core mission",
            desc: (groupMetadata.desc || "Keamanan dan manajemen otomatis grup WhatsApp.").slice(0, 160),
            tag_a: groupData.antilink ? "ANTI_LINK" : "NO_ADS",
            tag_b: groupData.nsfw ? "NSFW_ON" : "PRO_VIBES",
            tag_c: groupData.welcome ? "WELCOME_ON" : "CLEAN_JOIN",
            adm_title: "Security Admins",
            adm_name: adm1,
            adm_stat: "LEAD",
            cr_name: adm2,
            cr_stat: "MOD",
            ds_name: adm3,
            ds_stat: "MOD",
            act_title: "Activity Load",
            avg_title: "AVG_DAILY",
            avg_count: "72",
            msg_title: "Pesan",
            msg_count: "842",
            file_title: "Files",
            file_count: "124",
            avatar: groupPic
          };
          const {
            data
          } = await axios.post(`${global.bot?.api?.wudysoft}/api/maker/grup/v1`, groupPayload, {
            responseType: "arraybuffer",
            headers: {
              "Content-Type": "application/json"
            },
            timeout: 2e4
          });
          if (data) mediaOutput = Buffer.from(data);
        } catch (_) {}
        let featureStatusText = "";
        for (const [, item] of Object.entries(GROUP_FEATURES)) {
          const val = groupData[item.key];
          const isCustom = typeof val === "string";
          const isActive = Boolean(val);
          const badge = isActive ? isCustom ? "🟢 [CUSTOM]" : "🟢 [ON]" : "🔴 [OFF]";
          featureStatusText += `│  ◦  ${item.name} : ${badge}\n`;
        }
        const bodyText = `–  *G R O U P  S E T T I N G S*

Berikut adalah konfigurasi status proteksi & fitur grup saat ini.

┌  ◦  *Grup* : ${subject}
│  ◦  *Peserta* : ${(groupMetadata.participants || []).length || 1} Member
└  ◦  *Role* : Admin & Protection

┌  ◦  *F I T U R*
${featureStatusText.trimEnd()}
└  ◦  *Scope* : Admin Only

Silakan klik tombol di bawah untuk mengubah setelan fitur grup secara instan.`;
        const actionRows = Object.entries(GROUP_FEATURES).map(([k, item]) => {
          const isActive = Boolean(groupData[item.key]);
          const nextAction = isActive ? "off" : "on";
          return {
            title: `${isActive ? "🟢" : "🔴"} ${item.name}`,
            id: `${prefix}setgroup ${k} ${nextAction}`,
            description: `Status: ${isActive ? "Aktif (ON)" : "Nonaktif (OFF)"} • Klik untuk ubah`
          };
        });
        const listSections = [{
          title: "🛡️ PENGATURAN OTOMASI & KEAMANAN",
          rows: actionRows
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "⚙️ BUKA PANEL FITUR GRUP",
            sections: listSections
          })
        }];
        const options = {
          image: mediaOutput,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Security Control`,
              button_title: "Opsi Pengaturan"
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footerText, buttons, options);
        } else {
          await ctx.reply(bodyText, {
            quoted: quotedMsg
          });
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      let targetKey = flags.key ? findFeatureKey(flags.key) : null;
      let targetVal = null;
      if (flags.state !== undefined) {
        if (["on", "enable", "1", "true", true].includes(flags.state)) targetVal = true;
        else if (["off", "disable", "0", "false", false].includes(flags.state)) targetVal = false;
        else if (flags.state === "reset") targetVal = true;
      }
      const inputOption = (directKey ? freeTokens[0] : freeTokens[1] || "").toLowerCase();
      if (inputOption === "reset" || ["on", "enable", "1", "true"].includes(inputOption)) {
        targetVal = true;
      } else if (["off", "disable", "0", "false"].includes(inputOption)) {
        targetVal = false;
      }
      if (directKey) {
        targetKey = directKey;
        if (targetVal === null) targetVal = !Boolean(groupData[targetKey]);
      } else {
        targetKey = targetKey || findFeatureKey(freeTokens[0] || "");
        if (targetKey && targetVal === null) targetVal = !Boolean(groupData[targetKey]);
      }
      if (!targetKey || !GROUP_FEATURES[targetKey]) {
        const listKeys = Object.keys(GROUP_FEATURES).map(k => `\`${k}\``).join(", ");
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`–  *S E T  G R O U P*\n\nFitur pengaturan tidak ditemukan.\n\n┌  ◦  *Pilihan* : ${listKeys}\n└  ◦  *Example* : ${prefix}welcome on atau ${prefix}antilink off`);
      }
      const item = GROUP_FEATURES[targetKey];
      groupData[item.key] = targetVal;
      if (typeof db.write === "function") db.write(global.db);
      if (typeof ctx.react === "function") await ctx.react(targetVal ? "✅" : "🛑");
      const successText = `–  *S E T  G R O U P*

┌  ◦  *Fitur* : ${item.name}
│  ◦  *Status* : ${targetVal ? "Aktif (ON) 🟢" : "Nonaktif (OFF) 🔴"}
│  ◦  *Grup* : ${groupName}
└  ◦  *Fungsi* : ${item.desc}

Pengaturan fitur grup berhasil diperbarui.`;
      return sock.sendMessage(ctx.id, {
        text: successText
      }, {
        quoted: quotedMsg
      });
    } catch (err) {
      console.error("[SetGroup Error]:", err);
      if (typeof ctx.react === "function") await ctx.react("❌");
      return ctx.reply(`❌ SetGroup Error: ${err.message || err}`);
    }
  }
};