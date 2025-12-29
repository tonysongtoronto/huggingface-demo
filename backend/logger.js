import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';


// 获取当前文件的目录路径（ES modules）main updates
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// 控制台输出格式（更易读）dev_update
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// 创建 Winston logger 实例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // 默认日志级别
  format: logFormat,
  defaultMeta: { service: 'huggingface-chat-api' },
  transports: [
    // 错误日志文件 - 只记录 error 级别
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // 所有日志文件 - 记录所有级别
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
  ],
});

// 如果不是生产环境，也输出到控制台
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// 创建专门用于 HTTP 请求的日志记录器
export const httpLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'http-requests' },
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'http.log'),
      maxsize: 5242880,
      maxFiles: 10,
    }),
  ],
});

export default logger;