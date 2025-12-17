import morgan from "morgan";
import { httpLogger } from '../../logger.js';

// 自定义 Morgan token - 记录请求体
morgan.token('body', (req) => {
  if (req.body && Object.keys(req.body).length > 0) {
    const sanitized = { ...req.body };
    if (sanitized.message && sanitized.message.length > 100) {
      sanitized.message = sanitized.message.substring(0, 100) + '...';
    }
    return JSON.stringify(sanitized);
  }
  return '-';
});

// 自定义 Morgan token - 记录响应时间（毫秒）
morgan.token('response-time-ms', (req, res) => {
  if (!req._startAt || !res._startAt) return '-';
  const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
    (res._startAt[1] - req._startAt[1]) * 1e-6;
  return ms.toFixed(3);
});

const morganFormat = ':method :url :status :response-time-ms ms - :body';

export default morgan(morganFormat, {
  stream: {
    write: (message) => {
      httpLogger.info(message.trim());
    }
  }
});