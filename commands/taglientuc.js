const pending = new Map(); // `${threadID}_${senderID}` -> timestamp lần bấm đầu
const CONFIRM_WINDOW = 30 * 1000; // 30s để xác nhận lại

const VARIANTS = [
  ["Triệu hồi", "Úm ba la", "Phép thuật winx", "Echatic", "Kimochi ư ư",
   "Gái nhật đó mề ta rà xa rà hế", "ề ế ề ế ê", "Yamete", "Đụ em đi ớ ớ...", "Đi đẻ đây goodbye!"],
  ["Con ở đâu về đi con ơi", "Về đi vợ con đang trông chờ", "Về đi con giời",
   "Alo con nhợn nghe rõ trả lời", "Kimochi", "Dm về đi con mặt l", "Alo về đi",
   "Đĩ mẹ về ko", "Yamate", "Về đi mẹ con đang chờ"],
  ["Kìa con bướm vàng", "Kìa con bướm vàng", "Xòe đôi cánh", "Xòe đôi cánh",
   "Bươm bướm bay", "Đôi ba vòng", "Bươm bướm bay", "Đôi ba vòng", "Em ngồi xem", "Em ngồi xem"],
  ["Anh tuổi trâu Thích cỏ non và chơi đồ cổ", "Anh là bão em là Cây gặp anh là Đổ",
   "Anh thích chơi đồ Rê Mi Pha Son La Si Đô", "Em là Gông anh tình nguyện kẹp Đùi em vào Cổ",
   "Anh là Milo lúc nào mệt là em lại Mút", "Em là con lợn lúc có tiền là anh lại Đút",
   "Hơi gầy một tí Mà chúng nó bảo là anh xì ke", "Em như là cân", "Cứ trèo lên em là anh lại sút",
   "Như Mặt Trời em là Nắng làm da anh đen hêyyy"],
  ["Bạn là nhất, nhất bạn rồi.", "Rồi rồi bạn thắng, mình thua.", "Bạn thì hay rồi.",
   "Bạn mà sai thì không ai đúng hết á.", "Xin lỗi, được chưa?.", "Bạn là trùm rồi, không ai làm lại bạn hết á.",
   "Vâng, bạn nói gì cũng đúng.", "Cứ cho là bạn đúng đi =))", "Bạn là số một", "Mình còn sợ bạn cơ mà 👏"],
  ["Uống coconut hong?", "Uống cocacola hong?", "Lên là lên là lên", "Hêy hêy 🙌",
   "Lên nóc nhà là bắt con gà", "Turn down for what", "Hêy hêy êy êy", "Bủh bủh lmao lmao",
   "Lì vcut vậy người anh em", "Kêu muốn ỉa trong quần!Bye"]
];

module.exports = {
  config: {
    name: "taglientuc",
    version: "2.0.0",
    role: 2,
    description: "Tag liên tục 10 lần (cần xác nhận trước khi dùng)",
    usage: "taglientuc @tag",
    category: "Nhóm"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, senderID, mentions } = event;
    const mentionID = Object.keys(mentions || {})[0];

    if (!mentionID) {
      return api.sendMessage("⚠️ Bạn cần tag người muốn spam. Cách dùng: taglientuc @tag", threadID, messageID);
    }

    const key = `${threadID}_${senderID}`;
    const now = Date.now();
    const firstAt = pending.get(key);

    // Chưa xác nhận, hoặc xác nhận cũ đã hết hạn -> hiện cảnh báo, chờ lần gõ lệnh kế tiếp
    if (!firstAt || now - firstAt > CONFIRM_WINDOW) {
      pending.set(key, now);
      return api.sendMessage(
        `⚠️ Lệnh này sẽ spam tag liên tục người bạn chọn trong ~40 giây.\n` +
        `Bạn có chắc chắn cần dùng không? Nếu chắc, hãy gõ lại lệnh "taglientuc @tag" lần nữa trong vòng 30s để xác nhận.`,
        threadID, messageID
      );
    }

    // Đã xác nhận -> chạy spam
    pending.delete(key);
    const name = mentions[mentionID].replace("@", "");
    const send = (body, delay) => setTimeout(() => api.sendMessage(
      { body: `${body} ${name}`, mentions: [{ tag: name, id: mentionID }] }, threadID
    ), delay);

    setTimeout(() => api.sendMessage(
      { body: `Mày đã sẵn sàng chưa vậy? Bắt đầu nhé ${name}`, mentions: [{ tag: name, id: mentionID }] },
      threadID, messageID
    ), 1000);
    setTimeout(() => api.sendMessage("Đợi tao lấy hơi :3", threadID), 2000);
    setTimeout(() => api.sendMessage("Hít hà...hự ...ự...phù 🌬", threadID), 3000);

    const lines = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
    lines.forEach((line, i) => send(line, 5000 + i * 4000));
  }
};
