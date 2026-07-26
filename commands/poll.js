module.exports = {
  config: {
    name: "poll",
    aliases: ["binhchon"],
    version: "1.0",
    role: 0,
    description: "Tạo bình chọn (poll) trong nhóm",
    usage: "poll <tiêu đề> -> [lựa chọn 1 | lựa chọn 2 | ...]",
    category: "Group"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const content = args.join(" ");
    const arrowIndex = content.indexOf(" -> ");

    if (arrowIndex === -1) {
      return api.sendMessage(
        "⚠️ Cách dùng: poll <tiêu đề> -> [lựa chọn 1 | lựa chọn 2 | ...]",
        threadID, messageID
      );
    }

    const title = content.substring(0, arrowIndex).trim();
    const optionsRaw = content.substring(arrowIndex + 4).trim();
    let options = optionsRaw.split(" | ").map(o => o.trim()).filter(Boolean);

    if (!title || options.length < 2) {
      return api.sendMessage("⚠️ Cần có tiêu đề và ít nhất 2 lựa chọn (cách nhau bởi ' | ').", threadID, messageID);
    }

    const pollOptions = {};
    for (const opt of options) pollOptions[opt] = false;

    return api.createPoll(title, threadID, pollOptions, (err) => {
      if (err) return api.sendMessage("❌ Tạo bình chọn thất bại.", threadID, messageID);
    });
  }
};
