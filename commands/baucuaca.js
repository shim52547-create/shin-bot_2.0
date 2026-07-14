const { Currencies } = require("../utils/currency");

module.exports = {
  config: {
    name: "baucuaca",
    aliases: [],
    version: "1.0",
    role: 0,
    description: "Game may rủi nhỏ dùng xu ảo trong bot (không phải tiền thật)",
    usage: "baucuaca <số xu đặt>",
    category: "Giải trí"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const slotItems = ["🦀", "🐟", "🍐"];
    const coin = args[0];

    if (!coin) return api.sendMessage(`❌ Bạn chưa nhập số xu đặt cược! Ví dụ: baucuaca 100`, threadID, messageID);
    if (isNaN(coin) || coin.indexOf("-") !== -1) {
      return api.sendMessage(`❌ Số xu đặt cược phải là một số dương.`, threadID, messageID);
    }

    const betAmount = parseInt(coin);
    if (betAmount < 50) return api.sendMessage(`❌ Số xu đặt cược tối thiểu là 50.`, threadID, messageID);

    const userData = Currencies.getData(senderID);
    if (betAmount > userData.money) return api.sendMessage(`❌ Bạn không đủ xu (hiện có: ${userData.money}).`, threadID, messageID);

    const rolls = [];
    for (let i = 0; i < 3; i++) rolls.push(Math.floor(Math.random() * slotItems.length));

    let win = false;
    let payout = betAmount;
    if (rolls[0] === rolls[1] && rolls[1] === rolls[2]) {
      payout = betAmount * 9;
      win = true;
    } else if (rolls[0] === rolls[1] || rolls[0] === rolls[2] || rolls[1] === rolls[2]) {
      payout = betAmount * 2;
      win = true;
    }

    const resultLine = `${slotItems[rolls[0]]} | ${slotItems[rolls[1]]} | ${slotItems[rolls[2]]}`;
    if (win) {
      Currencies.increaseMoney(senderID, payout);
      return api.sendMessage(`${resultLine}\n🎉 Bạn đã thắng ${payout} xu!\nSố dư hiện tại: ${Currencies.getData(senderID).money} xu.`, threadID, messageID);
    } else {
      Currencies.decreaseMoney(senderID, betAmount);
      return api.sendMessage(`${resultLine}\n😢 Bạn đã thua ${betAmount} xu.\nSố dư hiện tại: ${Currencies.getData(senderID).money} xu.`, threadID, messageID);
    }
  }
};
