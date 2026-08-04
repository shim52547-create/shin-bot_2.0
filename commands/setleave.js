module.exports = {
  config: {
    name: "setleave",
    aliases: ["leavenoti", "outnoti"],
    version: "1.0",
    role: 1, // quản trị viên nhóm (hoặc admin bot)
    description: "Bật/tắt thông báo khi có thành viên rời/bị kick khỏi nhóm",
    usage: "setleave on/off",
    category: "Quản trị nhóm"
  },
  run: async ({ api, event, args, Threads }) => {
    const { threadID, messageID } = event;
    const action = (args[0] || "").toLowerCase();

    const threadData = Threads.get(threadID);
    const current = threadData.leaveNotify !== false; // mặc định là bật
    const turnOn = action === "on" ? true : action === "off" ? false : !current;

    Threads.set(threadID, { leaveNotify: turnOn });

    return api.sendMessage(
      `✅ Đã ${turnOn ? "bật" : "tắt"} thông báo thành viên rời nhóm cho nhóm này!`,
      threadID, messageID
    );
  }
};