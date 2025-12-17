import app from './src/app.js';
import { config } from './src/config/config.js';
import logger from './logger.js';

const PORT = config.port;

app.listen(PORT, () => {
  logger.info('服务器启动成功', { port: PORT });
  
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║    HuggingFace Chat API Server (Modular Architecture)        ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`\n📝 Available endpoints:`);
  console.log(`   POST   http://localhost:${PORT}/chat`);
  console.log(`   POST   http://localhost:${PORT}/session/chat`);
  console.log(`   GET    http://localhost:${PORT}/session/:sessionId`);
  console.log(`   DELETE http://localhost:${PORT}/session/:sessionId`);
  console.log(`   DELETE http://localhost:${PORT}/session/:sessionId/destroy`);
  console.log(`   GET    http://localhost:${PORT}/sessions`);
  console.log(`   POST   http://localhost:${PORT}/chat/stream`);
  console.log(`   GET    http://localhost:${PORT}/models`);
  console.log(`   GET    http://localhost:${PORT}/health`);
  console.log(`\n🔑 API Key: ${config.huggingface.apiKey ? '已配置 ✓' : '未配置 ✗'}`);
  console.log(`\n💾 会话配置:`);
  console.log(`   - 每会话最多消息数: ${config.session.maxMessagesPerSession}`);
  console.log(`   - 会话超时时间: ${config.session.sessionTimeout / (60 * 60 * 1000)} 小时`);
  console.log(`   - 清理间隔: ${config.session.cleanupInterval / (60 * 1000)} 分钟`);
  console.log(`\n📋 日志文件位置:`);
  console.log(`   - logs/combined.log (所有日志)`);
  console.log(`   - logs/error.log (错误日志)`);
  console.log(`   - logs/http.log (HTTP 请求日志)`);
  console.log(`\n按 Ctrl+C 停止服务器\n`);
});