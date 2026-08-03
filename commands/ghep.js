const { generateGhepCard } = require("../utils/ghepCard");
const { Readable } = require("stream");

const QUOTES = [
  "Trời sinh một cặp, có sai cũng mặc 💕",
  "Số phận đã an bài, chạy đâu cho thoát 😏",
  "Ghép đại cho vui, cấm cãi lại nha 😘",
  "Xứng đôi vừa lứa, khỏi cần nghĩ nhiều 💖",
  "Chấm ngay và luôn, chần chừ gì nữa 💘",
  "Tơ hồng đã buộc, hết đường chối cãi 🧵",
  "Nhìn cũng thấy hợp, còn nghĩ ngợi gì nữa 😌",
  "Ông trời xe duyên, có yêu thì nhận đại đi 🌸"
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function avatarURLOf(uid) {
  return `https://graph.facebook.com/${uid}/picture?width=720&height=720&access_token=6628568379|c1e620fa708a1d5696fb991c1bde5662`;
}

module.exports = {
  config: {
    name: "ghep",
    aliases: ["ghepdoi", "ghepcap"],
    version: "1.0.0",
    role: 0,
    credits: "MiraiBot-Clean",
    description: "Ghép đôi ngẫu nhiên 2 người trong nhóm (hoặc người được tag/reply) kèm ảnh minh họa",
    usage: "ghep | ghep @A @B | ghep (reply 1 người để ghép với bạn)",
    category: "Giải trí",
    cooldowns: 5
  },

  run: async function ({ api, event }) {
    const { threadID, messageID, senderID, mentions, messageReply, isGroup } = event;

    try {
      // ----- Xác định 2 người sẽ được ghép -----
      let id1 = null;
      let id2 = null;

      const mentionIDs = mentions ? Object.keys(mentions) : [];

      if (mentionIDs.length >= 2) {
        // Tag 2 người -> ghép 2 người đó
        id1 = mentionIDs[0];
        id2 = mentionIDs[1];
      } else if (mentionIDs.length === 1 && messageReply) {
        // Tag 1 người + reply 1 người -> ghép 2 người đó
        id1 = mentionIDs[0];
        id2 = messageReply.senderID;
      } else if (mentionIDs.length === 1) {
        // Tag 1 người -> ghép người đó với người gọi lệnh
        id1 = senderID;
        id2 = mentionIDs[0];
      } else if (messageReply) {
        // Reply 1 người -> ghép người gọi lệnh với người được reply
        id1 = senderID;
        id2 = messageReply.senderID;
      } else if (isGroup) {
        // Không tag/reply gì -> random 2 người trong nhóm (không tính bot)
        const threadInfo = await api.getThreadInfo(threadID).catch(() => null);
        let botID = null;
        try {
          botID = api.getCurrentUserID();
        } catch (e) {
          botID = null;
        }

        const pool = (threadInfo?.participantIDs || []).filter(
          (uid) => uid !== botID
        );

        if (pool.length < 2) {
          return api.sendMessage(
            "⚠️ Nhóm cần ít nhất 2 thành viên (không tính bot) để ghép đôi random.",
            threadID,
            messageID
          );
        }

        // random 2 người khác nhau
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        id1 = shuffled[0];
        id2 = shuffled[1];
      } else {
        return api.sendMessage(
          "⚠️ Lệnh này cần dùng trong nhóm, hoặc tag/reply 1-2 người để ghép đôi.",
          threadID,
          messageID
        );
      }

      if (!id1 || !id2 || id1 === id2) {
        return api.sendMessage(
          "⚠️ Không tìm được 2 người khác nhau để ghép đôi, thử lại sau nhé.",
          threadID,
          messageID
        );
      }

      // ----- Lấy tên hiển thị -----
      let name1 = "Người 1";
      let name2 = "Người 2";
      try {
        const info = await api.getUserInfo([id1, id2]);
        name1 = info?.[id1]?.name || name1;
        name2 = info?.[id2]?.name || name2;
      } catch (e) {
        /* dùng tên mặc định nếu lỗi */
      }

      const percent = Math.floor(Math.random() * 101);
      const quote = pickRandom(QUOTES);

      const buffer = await generateGhepCard({
        name1,
        avatarURL1: avatarURLOf(id1),
        name2,
        avatarURL2: avatarURLOf(id2),
        percent,
        quote
      });

      const imgStream = new Readable({
        read() {
          this.push(buffer);
          this.push(null);
        }
      });
      imgStream.path = `ghep_${id1}_${id2}.png`;

      const caption =
        percent >= 80
          ? `💞 ${name1} & ${name2} hợp nhau tới ${percent}%! Đúng là một đôi trời sinh!`
          : percent >= 50
          ? `💗 ${name1} & ${name2} hợp nhau ${percent}%, cũng đáng thử đó!`
          : `💔 ${name1} & ${name2} chỉ hợp ${percent}%... nhưng duyên số đâu ai biết được!`;

      return api.sendMessage(
        { body: caption, attachment: imgStream },
        threadID,
        messageID
      );
    } catch (err) {
      console.error("[ghep] error:", err);
      return api.sendMessage(
        "❌ Có lỗi xảy ra khi ghép đôi, thử lại sau nhé.",
        threadID,
        messageID
      );
    }
  }
};
