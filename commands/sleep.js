const moment = require("moment-timezone");

module.exports = {
  config: {
    name: "sleep",
    aliases: ["ngungon"],
    version: "1.0.1",
    role: 0,
    description: "Tính thời gian đi ngủ hoàn hảo cho bạn",
    usage: "sleep [HH:mm]",
    category: "Sức khỏe"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const content = args.join(" ");
    const wakeTime = [];

    if (!content) {
      for (let i = 1; i < 7; i++) {
        wakeTime.push(moment().tz("Asia/Ho_Chi_Minh").add(90 * i + 15, "m").format("HH:mm"));
      }
      return api.sendMessage(
        `Nếu bạn đi ngủ bây giờ, những thời gian hoàn hảo nhất để thức dậy là:\n${wakeTime.join(", ")}`,
        threadID, messageID
      );
    }

    const [h, m] = content.split(":");
    if (!m || isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59 || h.length !== 2 || m.length !== 2) {
      return api.sendMessage("⚠️ Sai định dạng giờ. Cách dùng: sleep HH:mm (vd: sleep 23:30)", threadID, messageID);
    }

    const sleepTime = moment().tz("Asia/Ho_Chi_Minh").set({ hour: +h, minute: +m, second: 0 });
    for (let i = 1; i < 7; i++) {
      wakeTime.push(sleepTime.clone().add(90 * i + 15, "m").format("HH:mm"));
    }
    return api.sendMessage(
      `Nếu bạn đi ngủ vào lúc ${content}, những thời gian hoàn hảo nhất để thức dậy là:\n${wakeTime.join(", ")}`,
      threadID, messageID
    );
  }
};
