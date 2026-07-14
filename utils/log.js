const chalk = require("chalk");
const moment = require("moment-timezone");

function timestamp() {
  return moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
}

const logger = {
  info: (msg, tag = "INFO") => {
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.cyanBright(`[${tag}]`)} ${msg}`);
  },
  success: (msg, tag = "OK") => {
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.greenBright(`[${tag}]`)} ${msg}`);
  },
  warn: (msg, tag = "WARN") => {
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.yellowBright(`[${tag}]`)} ${msg}`);
  },
  error: (msg, tag = "ERROR") => {
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.redBright(`[${tag}]`)} ${msg}`);
  },
  loader: (msg, tag = "LOADER") => {
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.magentaBright(`[${tag}]`)} ${msg}`);
  }
};

module.exports = logger;
