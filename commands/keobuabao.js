const { Currencies } = require("../utils/currency");

const CHOICES = {
  "keo": { label: "kéo", icon: "✌️" },
  "bua": { label: "búa", icon: "👊" },
  "bao": { label: "bao", icon: "✋" }
};
const KEYS = Object.keys(CHOICES); // ["keo", "bua", "bao"]
const MIN_BET = 50;

// "kéo" thắng "bao", "búa" thắng "kéo", "bao" thắng "búa"
const BEATS = { keo: "bao", bua: "keo", bao: "bua" };

function stripAccents(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

module.exports = {
  config: {
    name: "kbb",
    aliases: ["keobuabao", "oantutixi"],
    version: "2.0",
    role: 0,
    description: "Kéo búa bao (oẳn tù tì) cược xu ảo với bot",
    usage: "kbb <kéo|búa|bao> <số xu cược>",
    category: "Giải trí"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;

    const userChoiceKey = stripAccents(args[0]);
    const bet = parseInt(args[1], 10);

    if (!KEYS.includes(userChoiceKey)) {
      return api.sendMessage(
        `⚠️ Cách dùng: kbb <kéo|búa|bao> <số xu cược>\nVí dụ: kbb keo 100`,
        threadID, messageID
      );
    }
    if (!args[1] || isNaN(bet) || bet < MIN_BET) {
      return api.sendMessage(`⚡️ Mức cược không hợp lệ, tối thiểu ${MIN_BET} xu!`, threadID, messageID);
    }

    const data = Currencies.getData(senderID);
    if (data.money < bet) {
      return api.sendMessage(`⚡️ Bạn không đủ ${bet} xu để chơi (hiện có ${data.money} xu).`, threadID, messageID);
    }

    const botChoiceKey = KEYS[Math.floor(Math.random() * KEYS.length)];
    const userIcon = CHOICES[userChoiceKey].icon;
    const botIcon = CHOICES[botChoiceKey].icon;

    let resultLine, money;
    if (userChoiceKey === botChoiceKey) {
      resultLine = "❯ Kết quả: Hòa";
      money = data.money;
    } else if (BEATS[userChoiceKey] === botChoiceKey) {
      money = await Currencies.increaseMoney(senderID, bet);
      resultLine = `❯ Kết quả: Thắng\n❯ Cộng ${bet} xu`;
    } else {
      money = await Currencies.decreaseMoney(senderID, bet);
      resultLine = `❯ Kết quả: Thua\n❯ Trừ ${bet} xu`;
    }

    return api.sendMessage(
      `❯ Bạn: ${userIcon}  ||  Bot: ${botIcon}\n${resultLine}\n💰 Số dư hiện tại: ${money} xu`,
      threadID, messageID
    );
  }
};
