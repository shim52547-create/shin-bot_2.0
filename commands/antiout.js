module.exports = {
  config: {
    name: "antiout",
    aliases: [],
    version: "1.0",
    role: 1,
    description: "Bật/tắt nhanh chế độ anti out (chống rời/bị kick khỏi nhóm)",
    usage: "antiout on/off",
    category: "Box chat"
  },
  run: async ({ api, event, args, Threads }) => {
    const { threadID, messageID } = event;
    const action = (args[0] || "").toLowerCase();

    const threadData = Threads.get(threadID);
    const anti = threadData.anti || {};
    const current = anti.out?.enabled || false;
    const turnOn = action === "on" ? true : action === "off" ? false : !current;

    anti.out = { enabled: turnOn };
    Threads.set(threadID, { anti });

    return api.sendMessage(`✅ Đã ${turnOn ? "bật" : "tắt"} thành công antiout!`, threadID, messageID);
  }
};
