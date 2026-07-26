module.exports = {
  config: {
    name: "keuloto",
    aliases: ["loto"],
    version: "1.0.0",
    role: 0,
    description: "Random một con số bất kì trong một khoảng",
    usage: "keuloto | keuloto <số bắt đầu> <số kết thúc>",
    category: "Game"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;

    if (args.length === 0) {
      const num = Math.floor(Math.random() * 99);
      return api.sendMessage(`🎲 ${num} có lẽ là một con số may mắn 🤔`, threadID, messageID);
    }

    if (args.length !== 2) {
      return api.sendMessage("⚠️ Khoảng giới hạn số quay không hợp lệ.\nCách dùng: keuloto <số bắt đầu> <số kết thúc>", threadID, messageID);
    }

    const min = Number(args[0]);
    const max = Number(args[1]);

    if (isNaN(min) || isNaN(max) || max <= min || min < 0 || max < 0) {
      return api.sendMessage("⚠️ Khoảng bắt đầu hoặc khoảng kết thúc không phải là một số hợp lệ!", threadID, messageID);
    }

    const num = Math.floor(Math.random() * (max - min + 1) + min);
    return api.sendMessage(`🎲 ${num} có lẽ là một con số may mắn trong khoảng từ ${min} đến ${max} 🤔`, threadID, messageID);
  }
};
