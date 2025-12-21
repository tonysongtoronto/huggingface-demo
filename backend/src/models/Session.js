import mongoose from 'mongoose';
import { config } from '../config/config.js';

// === 消息子文档 ===
const messageSchema = new mongoose.Schema({
  role: { type: String, required: true },
  content: { type: String, required: true },
  usage: { type: Object }, // 存储 token 使用量
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: false } // 自动生成 timestamp 字段
});

// === 会话主文档 ===
const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  messages: [messageSchema],
  lastAccessedAt: { type: Date, default: Date.now },
  metadata: {
    messageCount: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 }
  }
}, {
  timestamps: { createdAt: true, updatedAt: true } // 自动生成 createdAt 和 updatedAt
});

// === TTL 索引：自动过期 ===
const timeoutInSeconds = Math.floor((config.session?.sessionTimeout || 3600000) / 1000);
sessionSchema.index({ lastAccessedAt: 1 }, { expireAfterSeconds: timeoutInSeconds });

// === 实例方法：添加消息 ===
sessionSchema.methods.addMessage = async function(role, content, usage = null) {
  this.messages.push({
    role,
    content,
    usage
  });

  this.metadata.messageCount = this.messages.length;
  if (usage && usage.total_tokens) {
    this.metadata.totalTokens += usage.total_tokens;
  }

  // 刷新最后访问时间，触发 TTL
  this.lastAccessedAt = new Date();

  return this.save();
};

// === 获取上下文消息 ===
sessionSchema.methods.getMessages = function() {
  // 更新 lastAccessedAt 内存值，不保存数据库
  this.lastAccessedAt = new Date();
  return this.messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
};

// === 清空历史 ===
sessionSchema.methods.clearHistory = async function() {
  this.messages = [];
  this.metadata.messageCount = 0;
  this.metadata.totalTokens = 0;
  this.lastAccessedAt = new Date();
  return this.save();
};

// === 导出模型 ===
export const ChatSession = mongoose.model('ChatSession', sessionSchema);
