import mongoose from 'mongoose';
import logger from '../../logger.js';
import { config } from '../config/config.js';

const connectDB = async () => {
  try {
    const uri = config.mongoUri;
    const dbName = config.mongoDbName;

    await mongoose.connect(uri, {
      dbName,               // 指定数据库
      retryWrites: true,    // 自动重试写操作
      w: 'majority',        // 写入多数副本确认
      appName: 'chat-app'   // Atlas 后台显示应用名，可自定义
    });

    logger.info(`MongoDB 连接成功，数据库: ${dbName}`);
  } catch (error) {
    logger.error('MongoDB 连接失败', error);
    process.exit(1);
  }
};

export default connectDB;