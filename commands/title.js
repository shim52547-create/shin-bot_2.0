const { Users } = require("../utils/database");

module.exports = {
  config: {
    name: "tile",
    aliases: ["tylehop"],
    version: "1.0.2",
    role: 0,
    description: "Xem tỉ lệ hợp đôi giữa 2 người",
    usage: "tile @tag",
    category: "Nhóm"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, senderID, mentions } = event;
    const mentionID = Object.keys(mentions || {})[0];

    if (!mentionID) {
      return api.sendMessage("⚠️ Cần phải tag 1 người bạn muốn xem tỉ lệ hợp nhau.", threadID, messageID);
    }

    const name = Users.get(mentionID).name;
    const nameSelf = Users.get(senderID).name;
    const tyle = Math.floor(Math.random() * 101);

    const avatarUrl = id => `https://graph.facebook.com/${id}/picture?width=720&height=720&access_token=6628568379|c1e620fa708a1d5696fb991c1bde5662`;

    try {
      const [avt1, avt2] = await Promise.all([
        global.utils.getStreamFromURL(avatarUrl(senderID)),
        global.utils.getStreamFromURL(avatarUrl(mentionID))
      ]);

      return api.sendMessage(
        {
          body: `⚡️ Tỉ lệ hợp đôi giữa ${nameSelf} và ${name} là ${tyle}% 🥰`,
          mentions: [{ id: mentionID, tag: name }, { id: senderID, tag: nameSelf }],
          attachment: [avt1, avt2]
        },
        threadID, messageID
      );
    } catch (err) {
      return api.sendMessage(
        `⚡️ Tỉ lệ hợp đôi giữa ${nameSelf} và ${name} là ${tyle}% 🥰`,
        threadID, messageID
      );
    }
  }
};
