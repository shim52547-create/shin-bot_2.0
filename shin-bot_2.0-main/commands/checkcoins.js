const { Currencies } = require("../utils/currency");

module.exports = {
  config: {
    name: "checkcoins",
    aliases: ["xu", "balance"],
    version: "1.0",
    role: 0,
    description: "Xem số xu ảo hiện có (dùng chung cho baicao, baucuaca, daily)",
    usage: "checkcoins",
    category: "Giải trí"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, senderID } = event;
    const data = Currencies.getData(senderID);
    return api.sendMessage(`💰 Số dư hiện tại của bạn: ${data.money} xu.`, threadID, messageID);
  }
};
