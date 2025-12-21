import express from "express";
import chatRoutes from './routes/chatRoutes.js';

import systemRoutes from './routes/systemRoutes.js';
import requestLogger from './middleware/requestLogger.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import connectDB from './db/connect.js'; 


const app = express();
// === 1. 连接数据库 ===
connectDB();

// 中间件
app.use(express.static('public'));
app.use(express.json());
app.use(requestLogger);

// 路由
app.use('/chat', chatRoutes);

app.use('/', systemRoutes);

// 错误处理
app.use(notFoundHandler);
app.use(errorHandler);

export default app;