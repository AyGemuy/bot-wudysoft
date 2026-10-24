import {
  normalizeMessageContent,
  decryptPollVote,
  jidNormalizedUser,
  areJidsSameUser,
  proto
} from "@whiskeysockets/baileys";
import {
  decodeJid,
  resolveLidToJid,
  SerializeMessage
} from "../../core/serialize.js";
import {
  UpsertMsgHandle
} from "../../core/handler.js";
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
    ctx,
    cmd
  }) => {
    try {
      const content = normalizeMessageContent(m.message || ctx.message);
      if (!content || !content.pollUpdateMessage) return;
      const creationMsgKey = content.pollUpdateMessage.pollCreationMessageKey;
      if (!creationMsgKey?.id) return;
      const chatId = decodeJid(ctx.chat || ctx.id || m.key?.remoteJid);
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
      const optionsList = pollCreation.pollCreationMessage?.options || pollCreation.pollCreationMessageV2?.options || pollCreation.pollCreationMessageV3?.options || [];
      global._pollVoterHistory = global._pollVoterHistory || new Map();
      const voterKey = [...voterSet].find(j => j.endsWith("@s.whatsapp.net")) || [...voterSet][0] || ctx.sender;
      const historyKey = `${creationMsgKey.id}_${voterKey}`;
      const prevVotes = global._pollVoterHistory.get(historyKey) || [];
      const currentVotes = selectedOptions.map(b => Buffer.from(b).toString("hex"));
      global._pollVoterHistory.set(historyKey, currentVotes);
      if (currentVotes.length <= prevVotes.length && !currentVotes.some(h => !prevVotes.includes(h))) {
        return true;
      }
      const newlyAddedHash = currentVotes.find(h => !prevVotes.includes(h));
      if (!newlyAddedHash) return true;
      const matchedOpt = optionsList.find(opt => {
        const hashHex = sha256(Buffer.from(opt.optionName || "")).toString("hex");
        return hashHex === newlyAddedHash;
      });
      let responseText = matchedOpt?.optionName || "";
      if (global.pollMappings?.[creationMsgKey.id]) {
        const mapped = global.pollMappings[creationMsgKey.id].options?.find(o => o.name === responseText);
        if (mapped?.id || mapped?.cmd) {
          responseText = mapped.id || mapped.cmd;
        }
      }
      if (!responseText) return true;
      let activeVoter = voterKey;
      if (activeVoter && activeVoter.endsWith("@lid")) {
        const resolved = await resolveLidToJid(activeVoter, sock, null, ctx.participants || []).catch(() => null);
        if (resolved && !resolved.endsWith("@lid")) activeVoter = resolved;
      }
      global.botEventLocks = global.botEventLocks || new Set();
      const lockKey = `poll_action:${creationMsgKey.id}_${activeVoter}_${newlyAddedHash}`;
      if (global.botEventLocks.has(lockKey)) return true;
      global.botEventLocks.add(lockKey);
      setTimeout(() => global.botEventLocks.delete(lockKey), 3e3);
      const voterNum = (activeVoter || "").split("@")[0] || ctx.senderNumber || "User";
      console.log(chalk.gray(`[ POLL ] `) + chalk.cyan(`@${voterNum}`) + chalk.gray(` memilih: `) + chalk.greenBright.bold(`"${responseText}"`));
      const isFromMe = areJidsSameUser(activeVoter, sock.user?.id);
      const fakeMsg = {
        key: {
          remoteJid: chatId,
          fromMe: isFromMe,
          id: `${creationMsgKey.id}_POLL_${Date.now().toString(36)}`,
          participant: chatId.endsWith("@g.us") ? activeVoter : undefined
        },
        message: {
          conversation: responseText
        },
        pushName: ctx.pushName || m.pushName || "User",
        messageTimestamp: Math.floor(Date.now() / 1e3)
      };
      const fakeCtx = await SerializeMessage(sock, fakeMsg);
      if (fakeCtx) {
        fakeCtx.loader = cmd || global.loader;
        fakeCtx.isPollVote = true;
        fakeCtx.text = responseText;
        fakeCtx.body = responseText;
        UpsertMsgHandle(sock, fakeMsg, fakeCtx, {
          cmd: cmd || global.loader
        }).catch(err => {
          console.error(chalk.red("[POLL EXEC ERROR]"), err.message);
        });
      }
      return true;
    } catch (e) {
      console.error(chalk.red("[POLL HANDLER ERROR]"), e);
    }
  }
};