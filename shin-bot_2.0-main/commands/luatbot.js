const RULES_TEXT = "⚡️ LUẬT SỬ DỤNG BOT TRONG NHÓM ⚡️\n\n🚫 Chửi bot / spam lệnh liên tục / kick bot khỏi nhóm mà không báo trước = BAN khỏi nhóm.\n\n⚡️Điều 1⚡️\n⚡️Bot có thể gặp lỗi do thao tác sai của người dùng hoặc do hệ thống Facebook giới hạn tính năng (bot có thể bị mất quyền gửi tin nhắn tạm thời). Vui lòng thông cảm và báo lỗi cho quản trị viên thay vì công kích bot.\n\n⚡️Điều 2⚡️\n⚡️Vui lòng xin phép quản trị viên nhóm trước khi thêm bot vào. Không tự ý thêm bot rồi phá/kick khi chưa tìm hiểu cách dùng.\n\n⚡️Điều 3⚡️\n⚡️Không spam lệnh liên tục trong thời gian ngắn (ví dụ dưới 5 giây/lệnh) vì có thể gây quá tải hệ thống.\n\n⚡️Điều 4⚡️\n⚡️Nếu gặp tình trạng giật/lag khi bot hoạt động, vui lòng kiểm tra lại kết nối mạng hoặc thiết bị trước khi phản ánh.\n\n⚡️Điều 5⚡️\n⚡️Quản trị viên có thể kiểm tra định kỳ; nhóm có ít thành viên hoặc không có ảnh/tên đại diện có thể bị bot tự động rời nhóm.\n\n⚡️Điều 6⚡️\n⚡️Mỗi nhóm chỉ nên sử dụng 1 bot để tránh xung đột lệnh. Nếu phát hiện nhóm có từ 2 bot cùng hoạt động, bot có thể tự động rời nhóm.\n\n⚡️Điều 7⚡️\n⚡️Việc sử dụng bot là tự nguyện, không bắt buộc. Nếu không hài lòng, vui lòng góp ý lịch sự với quản trị viên thay vì công kích bot.\n\n📌 Luật có thể được cập nhật thêm trong thời gian tới.";

module.exports = {
  config: {
    name: "luatbot",
    aliases: [],
    version: "1.0",
    role: 0,
    description: "Xem luật sử dụng bot (gõ trực tiếp \"Luật bot\", không cần prefix)",
    usage: "luatbot (hoặc gõ thẳng \"Luật bot\")",
    category: "Không cần dấu lệnh"
  },
  run: async ({ api, event }) => {
    return api.sendMessage(RULES_TEXT, event.threadID, event.messageID);
  },
  onChat: async ({ api, event }) => {
    const body = event.body || "";
    if (body.indexOf("Luật bot") === 0 || body.indexOf("luật bot") === 0) {
      return api.sendMessage(RULES_TEXT, event.threadID, event.messageID);
    }
  }
};