import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
import {
  decodeJid,
  extractNum
} from "../../core/serialize.js";
const SIMULATE_EVENTS = {
  welcome: {
    name: "Simulasi Welcome (Member Masuk)",
    desc: "Uji kartu sambutan banner & pesan member baru bergabung",
    type: "participant",
    action: "add",
    dbKey: "welcome",
    aliases: ["wel", "masuk", "add", "join"]
  },
  leave: {
    name: "Simulasi Leave (Member Keluar)",
    desc: "Uji kartu perpisahan & notifikasi member keluar grup",
    type: "participant",
    action: "remove",
    dbKey: "leave",
    aliases: ["out", "keluar", "bye", "goodbye", "kick"]
  },
  promote: {
    name: "Simulasi Promote (Admin Baru)",
    desc: "Uji notifikasi pengangkatan wewenang Admin grup",
    type: "participant",
    action: "promote",
    dbKey: "promote",
    aliases: ["promot", "upadmin"]
  },
  demote: {
    name: "Simulasi Demote (Admin Dicopot)",
    desc: "Uji notifikasi pencabutan wewenang Admin grup",
    type: "participant",
    action: "demote",
    dbKey: "demote",
    aliases: ["demot", "unadmin"]
  },
  open: {
    name: "Simulasi Buka Grup (Announce False)",
    desc: "Uji notifikasi grup dibuka untuk seluruh anggota",
    type: "group",
    payload: {
      announce: false
    },
    dbKey: "detect",
    aliases: ["buka", "unlock"]
  },
  close: {
    name: "Simulasi Tutup Grup (Announce True)",
    desc: "Uji notifikasi grup ditutup (hanya admin)",
    type: "group",
    payload: {
      announce: true
    },
    dbKey: "detect",
    aliases: ["tutup", "lock"]
  },
  subject: {
    name: "Simulasi Ganti Nama Grup",
    desc: "Uji notifikasi perubahan nama grup WhatsApp",
    type: "group",
    payload: {
      subject: "Nama Grup Baru (Simulasi)"
    },
    dbKey: "detect",
    aliases: ["name", "judul", "subjek"]
  },
  desc: {
    name: "Simulasi Ganti Deskripsi",
    desc: "Uji notifikasi perubahan deskripsi grup WhatsApp",
    type: "group",
    payload: {
      desc: "Halo! Ini adalah deskripsi pengujian simulasi otomatisasi grup."
    },
    dbKey: "detect",
    aliases: ["deskripsi", "description"]
  },
  joinrequest: {
    name: "Simulasi Permintaan Masuk (Approval)",
    desc: "Uji notifikasi permintaan izin gabung grup (ACC)",
    type: "join-request",
    action: "created",
    dbKey: "detect",
    aliases: ["joinreq", "request", "req"]
  },
  antidelete: {
    name: "Simulasi Anti Delete",
    desc: "Uji penarikan kembali pesan yang dihapus pengirim",
    type: "delete",
    dbKey: "antidelete",
    aliases: ["antidel", "deleted", "revoke"]
  }
};

function findEventKey(query = "") {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  if (SIMULATE_EVENTS[q]) return q;
  for (const [key, val] of Object.entries(SIMULATE_EVENTS)) {
    if (val.aliases?.includes(q)) return key;
  }
  return null;
}
export default {
  name: "simulate",
  aliases: ["simulasi", "testevent", "fakeevent", "sim"],
  description: "Uji coba dan simulasikan berbagai event otomatisasi grup secara langsung",
  category: "Group",
  admin: true,
  group: true,
  example: "simulate | simulate welcome @user | simulate leave | simulate close",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isGroup) {
        return ctx.reply("❌ Perintah simulasi hanya dapat dijalankan di dalam *Grup WhatsApp*.");
      }
      if (!ctx.isAdmin && !ctx.isOwner) {
        return ctx.reply("❌ Simulasi hanya dapat dipicu oleh *Admin Grup* atau *Owner Bot*.");
      }
      const prefix = ctx.prefix || ".";
      const chatId = ctx.chat || ctx.id;
      const botName = global.bot?.name || "Paimon-bot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const footerText = `${botName} • Event Simulation Engine`;
      const groupName = ctx.groupName || chatId.split("@")[0];
      if (typeof db.ensureGroup === "function") {
        db.ensureGroup(chatId);
      }
      const groupData = global.db?.group?.[chatId] || {};
      const args = ctx.args || [];
      const subCmd = (args[0] || "").toLowerCase().trim();
      if (!subCmd || subCmd === "help" || subCmd === "list" || subCmd === "menu") {
        if (typeof ctx.react === "function") await ctx.react("⏳");
        let eventListText = "";
        for (const [k, item] of Object.entries(SIMULATE_EVENTS)) {
          const isFeatureActive = Boolean(groupData[item.dbKey]);
          const statusBadge = isFeatureActive ? "🟢 [Aktif]" : "🔴 [Nonaktif]";
          eventListText += `│  ◦  ${item.name} : ${statusBadge}\n`;
        }
        const bodyText = `–  *E V E N T  S I M U L A T O R*

Fitur pengujian respons bot terhadap berbagai event grup tanpa harus mengundang atau mengeluarkan member sungguhan.

┌  ◦  *Grup* : ${groupName}
│  ◦  *Total Event* : ${Object.keys(SIMULATE_EVENTS).length} Opsi
└  ◦  *Scope* : Admin Only

┌  ◦  *D A F T A R  E V E N T*
${eventListText.trimEnd()}
└  ◦  *Command* : \`${prefix}simulate <event> [@user]\`

Silakan klik tombol di bawah untuk memilih simulasi yang ingin dijalankan.`;
        const actionRows = Object.entries(SIMULATE_EVENTS).map(([k, item]) => ({
          title: `🧪 ${item.name.slice(0, 24)}`,
          id: `${prefix}simulate ${k}`,
          description: item.desc.slice(0, 60)
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "⚡ PILIH SIMULASI EVENT",
            sections: [{
              title: "DAFTAR SIMULASI EVENT GRUP",
              rows: actionRows
            }]
          })
        }];
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Event Tester`,
              button_title: "Opsi Simulasi"
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
      const eventKey = findEventKey(subCmd);
      if (!eventKey) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`–  *S I M U L A T E*

Jenis simulasi event \`${subCmd}\` tidak dikenali.

┌  ◦  *Format* : ${prefix}simulate <event> [@user]
└  ◦  *Bantuan* : Ketik \`${prefix}simulate\` untuk membuka daftar menu.`);
      }
      const targetEvent = SIMULATE_EVENTS[eventKey];
      let targetUser = ctx.sender;
      if (ctx.mentionedJid && ctx.mentionedJid.length > 0) {
        targetUser = ctx.mentionedJid[0];
      } else if (ctx.quoted?.sender) {
        targetUser = ctx.quoted.sender;
      }
      targetUser = decodeJid(targetUser);
      let warningNote = "";
      if (!groupData[targetEvent.dbKey]) {
        warningNote = `\n\n⚠️ *Perhatian:* Fitur \`${targetEvent.dbKey}\` saat ini berstatus *Nonaktif* di grup ini (\`${prefix}${targetEvent.dbKey} on\`).`;
      }
      if (typeof ctx.react === "function") await ctx.react("🚀");
      if (targetEvent.type === "participant") {
        const lockKey = `ptcp_${chatId}_${targetEvent.action}_${[ targetUser ].sort().join("_")}`;
        if (global.botEventLocks) global.botEventLocks.delete(lockKey);
        sock.ev.emit("group-participants.update", {
          id: chatId,
          author: ctx.sender,
          participants: [targetUser],
          action: targetEvent.action
        });
        const successText = `–  *S I M U L A T E*

┌  ◦  *Event* : ${targetEvent.name}
│  ◦  *Action* : \`${targetEvent.action}\`
└  ◦  *Target* : @${extractNum(targetUser)}${warningNote}

Event simulasi berhasil ditembakkan ke sistem bot.`;
        return sock.sendMessage(ctx.id, {
          text: successText,
          mentions: [targetUser]
        }, {
          quoted: quotedMsg
        });
      }
      if (targetEvent.type === "group") {
        const customText = args.slice(1).join(" ").trim();
        const updatePayload = {
          id: chatId,
          ...targetEvent.payload
        };
        if (eventKey === "subject" && customText) {
          updatePayload.subject = customText;
        } else if (eventKey === "desc" && customText) {
          updatePayload.desc = customText;
        }
        const lockKey = `grp_${chatId}_${Object.keys(updatePayload).sort().join("_")}`;
        if (global.botEventLocks) global.botEventLocks.delete(lockKey);
        sock.ev.emit("groups.update", [updatePayload]);
        const successText = `–  *S I M U L A T E*

┌  ◦  *Event* : ${targetEvent.name}
│  ◦  *Grup* : ${groupName}
└  ◦  *Status* : Dispatched Payload${warningNote}

Event simulasi perubahan grup berhasil ditembakkan ke sistem bot.`;
        return sock.sendMessage(ctx.id, {
          text: successText
        }, {
          quoted: quotedMsg
        });
      }
      if (targetEvent.type === "join-request") {
        const lockKey = `joinreq_${chatId}_${targetUser}_created`;
        if (global.botEventLocks) global.botEventLocks.delete(lockKey);
        sock.ev.emit("group.join-request", {
          id: chatId,
          author: ctx.sender,
          participant: targetUser,
          action: "created"
        });
        const successText = `–  *S I M U L A T E*

┌  ◦  *Event* : ${targetEvent.name}
└  ◦  *Pemohon* : @${extractNum(targetUser)}${warningNote}

Event simulasi permintaan gabung berhasil ditembakkan ke sistem bot.`;
        return sock.sendMessage(ctx.id, {
          text: successText,
          mentions: [targetUser]
        }, {
          quoted: quotedMsg
        });
      }
      if (targetEvent.type === "delete") {
        const dummyMsgText = args.slice(1).join(" ").trim() || "Ini adalah pesan simulasi teks yang ditarik oleh pengirim.";
        const fakeMsgId = `SIM_DEL_${Date.now()}`;
        if (!global.msgStore) global.msgStore = new Map();
        global.msgStore.set(fakeMsgId, {
          rawMessage: {
            conversation: dummyMsgText
          },
          message: {
            conversation: dummyMsgText
          },
          sender: targetUser,
          timestamp: Date.now()
        });
        const delLockKey = `antidel_${fakeMsgId}`;
        if (global.botEventLocks) global.botEventLocks.delete(delLockKey);
        sock.ev.emit("messages.update", [{
          key: {
            remoteJid: chatId,
            id: fakeMsgId,
            participant: targetUser,
            fromMe: false
          },
          update: {
            message: {
              protocolMessage: {
                type: 0
              }
            }
          }
        }]);
        const successText = `–  *S I M U L A T E*

┌  ◦  *Event* : ${targetEvent.name}
│  ◦  *Pengirim* : @${extractNum(targetUser)}
└  ◦  *Pesan Tiruan* : "${dummyMsgText}"${warningNote}

Event simulasi penarikan pesan berhasil ditembakkan ke sistem bot.`;
        return sock.sendMessage(ctx.id, {
          text: successText,
          mentions: [targetUser]
        }, {
          quoted: quotedMsg
        });
      }
    } catch (err) {
      console.error("[Simulate Error]:", err);
      if (typeof ctx.react === "function") await ctx.react("❌");
      return ctx.reply(`❌ Simulate Error: ${err.message || err}`);
    }
  }
};