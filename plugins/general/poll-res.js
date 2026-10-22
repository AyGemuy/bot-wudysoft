import {
  normalizeMessageContent,
  decryptPollVote,
  jidNormalizedUser,
  generateWAMessage,
  areJidsSameUser,
  proto
} from "@whiskeysockets/baileys";
import {
  createHash
} from "crypto";
import chalk from "chalk";
const sha256 = buf => createHash("sha256").update(buf).digest();
export default {
  name: "pollresponse",
  aliases: ["pollresp", "onpoll"],
  description: "Merespons dan mengeksekusi pilihan vote polling WhatsApp secara otomatis",
  category: "Handler",
  execute: async () => {},
  before: async (m, {
    sock,
    ctx
  }) => {
    try {
      const content = normalizeMessageContent(m.message || ctx.message);
      if (!content || !content.pollUpdateMessage) return;
      const creationMsgKey = content.pollUpdateMessage.pollCreationMessageKey;
      if (!creationMsgKey?.id) return;
      const chatId = ctx.chat || ctx.id || m.key?.remoteJid;
      if (!chatId) return;
      let pollMsg = null;
      const cached = global.msgStore?.get(creationMsgKey.id);
      if (cached) {
        pollMsg = {
          key: cached.key || creationMsgKey,
          message: cached.rawMessage || cached.message || cached.msg?.message
        };
      }
      if (!pollMsg?.message) {
        const storeMessages = global.store?.messages?.[chatId]?.array || Object.values(global.store?.messages?.[chatId] || {});
        pollMsg = storeMessages.find(item => creationMsgKey.id === item?.key?.id);
      }
      if (!pollMsg?.message) return;
      const pollCreation = pollMsg.message;
      const myPn = jidNormalizedUser(sock.authState?.creds?.me?.id || sock.user?.id || "");
      const myLid = sock.authState?.creds?.me?.lid ? jidNormalizedUser(sock.authState.creds.me.lid) : sock.user?.lid ? jidNormalizedUser(sock.user.lid) : null;
      const creatorSet = new Set();
      if (pollMsg.key?.participant && !pollMsg.key.participant.endsWith("@g.us")) creatorSet.add(jidNormalizedUser(pollMsg.key.participant));
      if (pollMsg.participant && !pollMsg.participant.endsWith("@g.us")) creatorSet.add(jidNormalizedUser(pollMsg.participant));
      if (creationMsgKey.participant && !creationMsgKey.participant.endsWith("@g.us")) creatorSet.add(jidNormalizedUser(creationMsgKey.participant));
      if (myPn) creatorSet.add(myPn);
      if (myLid) creatorSet.add(myLid);
      if (!chatId.endsWith("@g.us")) creatorSet.add(jidNormalizedUser(chatId));
      const voterSet = new Set();
      const rawVoter = m.key?.participant || m.key?.remoteJid || ctx.sender;
      if (rawVoter && !rawVoter.endsWith("@g.us")) voterSet.add(jidNormalizedUser(rawVoter));
      if (m.key?.fromMe) {
        if (myPn) voterSet.add(myPn);
        if (myLid) voterSet.add(myLid);
      }
      if (typeof sock.signalRepository?.lidMapping?.getPNForLID === "function") {
        for (const jid of [...creatorSet]) {
          if (jid.endsWith("@lid")) {
            const pn = await sock.signalRepository.lidMapping.getPNForLID(jid).catch(() => null);
            if (pn) creatorSet.add(jidNormalizedUser(pn));
          } else if (jid.endsWith("@s.whatsapp.net") && typeof sock.signalRepository?.lidMapping?.getLIDForPN === "function") {
            const lid = await sock.signalRepository.lidMapping.getLIDForPN(jid).catch(() => null);
            if (lid) creatorSet.add(jidNormalizedUser(lid));
          }
        }
        for (const jid of [...voterSet]) {
          if (jid.endsWith("@lid")) {
            const pn = await sock.signalRepository.lidMapping.getPNForLID(jid).catch(() => null);
            if (pn) voterSet.add(jidNormalizedUser(pn));
          } else if (jid.endsWith("@s.whatsapp.net") && typeof sock.signalRepository?.lidMapping?.getLIDForPN === "function") {
            const lid = await sock.signalRepository.lidMapping.getLIDForPN(jid).catch(() => null);
            if (lid) voterSet.add(jidNormalizedUser(lid));
          }
        }
      }
      const pollEncKey = pollCreation.messageContextInfo?.messageSecret || pollCreation.pollCreationMessage?.messageContextInfo?.messageSecret || pollCreation.pollCreationMessageV2?.messageContextInfo?.messageSecret || pollCreation.pollCreationMessageV3?.messageContextInfo?.messageSecret;
      if (!pollEncKey) return;
      const voteMsg = decryptPollVote(content.pollUpdateMessage.vote, {
        pollCreatorJids: [...creatorSet],
        pollMsgId: creationMsgKey.id,
        pollEncKey: pollEncKey,
        voterJids: [...voterSet]
      });
      if (!voteMsg) return;
      const selectedOptions = voteMsg.selectedOptions || [];
      if (!selectedOptions.length) return;
      const optionsList = pollCreation.pollCreationMessage?.options || pollCreation.pollCreationMessageV2?.options || pollCreation.pollCreationMessageV3?.options || [];
      if (cached) cached.voterHistory = cached.voterHistory || new Map();
      const voterKey = [...voterSet][0] || ctx.sender;
      const prevVotes = cached?.voterHistory?.get(voterKey) || [];
      const currentVotes = selectedOptions.map(b => Buffer.from(b).toString("hex"));
      if (cached) cached.voterHistory.set(voterKey, currentVotes);
      const targetHash = currentVotes.find(h => !prevVotes.includes(h)) || currentVotes[currentVotes.length - 1];
      const matchedOpt = optionsList.find(opt => {
        const hashHex = sha256(Buffer.from(opt.optionName || "")).toString("hex");
        return hashHex === targetHash;
      });
      let responseText = matchedOpt?.optionName || "";
      if (global.pollMappings?.[creationMsgKey.id]) {
        const mapped = global.pollMappings[creationMsgKey.id].options?.find(o => o.name === responseText);
        if (mapped?.id || mapped?.cmd) {
          responseText = mapped.id || mapped.cmd;
        }
      }
      if (!responseText) return;
      const voterNum = [...voterSet].find(j => j.endsWith("@s.whatsapp.net"))?.split("@")[0] || ctx.senderNumber || "User";
      console.log(chalk.gray(`[ POLL ] `) + chalk.cyan(`@${voterNum}`) + chalk.gray(` memilih: `) + chalk.greenBright.bold(`"${responseText}"`));
      const activeVoter = [...voterSet][0] || ctx.sender;
      const isFromMe = areJidsSameUser(activeVoter, sock.user?.id);
      const fakeMsg = await generateWAMessage(chatId, {
        text: responseText,
        mentions: [activeVoter]
      }, {
        userJid: sock.user.id,
        quoted: m
      });
      fakeMsg.key.fromMe = isFromMe;
      fakeMsg.key.id = `${creationMsgKey.id}_${Date.now()}`;
      fakeMsg.pushName = ctx.pushName || m.pushName || "User";
      if (ctx.isGroup) {
        fakeMsg.key.participant = fakeMsg.participant = activeVoter;
      }
      if (sock.ev?.emit) {
        sock.ev.emit("messages.upsert", {
          messages: [proto.WebMessageInfo.create(fakeMsg)],
          type: "notify"
        });
      }
      return true;
    } catch (_) {}
  }
};