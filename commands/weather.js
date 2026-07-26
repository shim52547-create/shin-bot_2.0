const axios = require("axios");

module.exports = {
  config: {
    name: "weather",
    aliases: ["thoitiet"],
    version: "1.0",
    role: 0,
    description: "Xem thời tiết hiện tại của 1 thành phố (cần OPENWEATHER_KEY trong config.json)",
    usage: "weather <tên thành phố>",
    category: "Tiện ích"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const city = args.join(" ");

    if (!city) {
      return api.sendMessage("⚠️ Cách dùng: weather <tên thành phố>\nVí dụ: weather Hanoi", threadID, messageID);
    }
    // Ưu tiên biến môi trường OPENWEATHER_KEY (dùng khi deploy Render), fallback config.json cho local
    const weatherKey = process.env.OPENWEATHER_KEY || global.config.OPENWEATHER_KEY;
    if (!weatherKey) {
      return api.sendMessage("⚠️ Bot chưa cấu hình OPENWEATHER_KEY (biến môi trường hoặc config.json). Lấy key miễn phí tại https://openweathermap.org/api", threadID, messageID);
    }

    try {
      const res = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
        params: { q: city, appid: weatherKey, units: "metric", lang: "vi" }
      });
      const d = res.data;
      const msg =
        `🌤️ Thời tiết tại ${d.name}\n` +
        `Nhiệt độ: ${d.main.temp}°C (cảm giác như ${d.main.feels_like}°C)\n` +
        `Tình trạng: ${d.weather[0].description}\n` +
        `Độ ẩm: ${d.main.humidity}%\n` +
        `Gió: ${d.wind.speed} m/s`;
      return api.sendMessage(msg, threadID, messageID);
    } catch (err) {
      return api.sendMessage("❌ Không tìm thấy thành phố này hoặc API lỗi.", threadID, messageID);
    }
  }
};
