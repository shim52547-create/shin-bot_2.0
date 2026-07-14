const { Currencies } = require("../utils/currency");

const MIN_BET = 50;

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // bỏ dấu
}

module.exports = {
  config: {
    name: "taixiu",
    aliases: ["tx"],
    version: "2.0.0",
    role: 0,
    description: "Chơi tài xỉu bằng xu ảo (3 xúc xắc)",
    usage: "taixiu <tài/xỉu> <số xu>",
    category: "Giải trí"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;

    if (!args[0] || !args[1]) {
      return api.sendMessage(
        `⚠️ Cách dùng: taixiu <tài/xỉu> <số xu> (tối thiểu ${MIN_BET} xu).`,
        threadID, messageID
      );
    }

    const choose = normalize(args[0]) === "tai" ? "tai" : normalize(args[0]) === "xiu" ? "xiu" : null;
    if (!choose) {
      return api.sendMessage("⚠️ Chỉ đặt cược tài hoặc xỉu!", threadID, messageID);
    }

    const bet = parseInt(args[1], 10);
    if (isNaN(bet) || bet < MIN_BET) {
      return api.sendMessage(`⚠️ Mức cược không hợp lệ (tối thiểu ${MIN_BET} xu).`, threadID, messageID);
    }

    const moneyUser = Currencies.getData(senderID).money;
    if (moneyUser < bet) {
      return api.sendMessage(`⚡ Số dư của bạn không đủ ${bet} xu để chơi.`, threadID, messageID);
    }

    // Lắc 3 xúc xắc
    const dice = [1, 2, 3].map(() => Math.floor(Math.random() * 6) + 1);
    const total = dice[0] + dice[1] + dice[2];
    const isTriple = dice[0] === dice[1] && dice[1] === dice[2];
    // Bộ ba (ví dụ 1-1-1, 6-6-6) -> nhà cái luôn thắng, bất kể đặt tài hay xỉu
    const result = isTriple ? "nha_cai" : total >= 11 ? "tai" : "xiu";

    Currencies.decreaseMoney(senderID, bet);
    const diceText = `🎲 Kết quả: ${dice.join(" - ")} (tổng ${total})${isTriple ? " — BỘ BA, nhà cái thắng!" : ""}`;

    if (result === choose) {
      Currencies.increaseMoney(senderID, bet * 2);
      return api.sendMessage(
        `${diceText}\n✅ Bạn đã thắng! Nhận được ${bet * 2} xu (đã gồm hoàn cược).`,
        threadID, messageID
      );
    }

    return api.sendMessage(
      `${diceText}\n❌ Bạn đã thua, mất ${bet} xu.`,
      threadID, messageID
    );
  }
};
