const { Users } = require("../utils/database");
const { Currencies } = require("../utils/currency");

module.exports = {
  config: {
    name: "steal",
    version: "1.0.1",
    role: 0,
    description: "Ăn cắp xu ngẫu nhiên từ một thành viên trong nhóm",
    usage: "steal",
    category: "Kinh tế"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, senderID } = event;
    const botID = api.getCurrentUserID();

    const threadInfo = await api.getThreadInfo(threadID).catch(() => null);
    const candidates = (threadInfo?.participantIDs || []).filter(
      id => id !== senderID && id !== botID
    );
    if (candidates.length === 0) {
      return api.sendMessage("⚠️ Không tìm thấy ai trong nhóm để ăn cắp cả.", threadID, messageID);
    }

    const victim = candidates[Math.floor(Math.random() * candidates.length)];
    const nameVictim = Users.get(victim).name;
    const route = Math.floor(Math.random() * 2); // 0 = ăn cắp thành công, 1 = bị bắt

    if (route === 0) {
      const victimMoney = Currencies.getData(victim).money;
      const tryAmount = Math.floor(Math.random() * 1000) + 1;

      if (!victimMoney || victimMoney <= 0) {
        return api.sendMessage(
          `Bạn vừa định ăn cắp ${nameVictim} nhưng người này quá nghèo. Bạn chẳng lấy được gì cả!`,
          threadID, messageID
        );
      }

      const stolen = Math.min(victimMoney, tryAmount);
      Currencies.decreaseMoney(victim, stolen);
      Currencies.increaseMoney(senderID, stolen);

      const msg = stolen < tryAmount
        ? `💰 Bạn vừa lấy trộm ${stolen} xu từ ${nameVictim} trong nhóm này!`
        : `💰 Bạn vừa ăn cắp sạch ${stolen} xu - toàn bộ số dư của ${nameVictim}!`;
      return api.sendMessage(msg, threadID, messageID);
    }

    // route === 1: bị bắt quả tang, mất hết tiền cho nạn nhân
    const name = Users.get(senderID).name;
    const moneyUser = Currencies.getData(senderID).money;

    if (!moneyUser || moneyUser <= 0) {
      return api.sendMessage("Bạn không có tiền, hãy làm việc để có vốn đã!", threadID, messageID);
    }

    const reward = Math.floor(moneyUser / 2);
    Currencies.decreaseMoney(senderID, moneyUser);
    Currencies.increaseMoney(victim, reward);

    return api.sendMessage(
      { body: `🚨 Bạn đã bị bắt và mất ${moneyUser} xu. Xin chúc mừng ${nameVictim} đã bắt được ${name} và nhận ${reward} xu tiền thưởng!`,
        mentions: [{ tag: nameVictim, id: victim }, { tag: name, id: senderID }] },
      threadID, messageID
    );
  }
};
