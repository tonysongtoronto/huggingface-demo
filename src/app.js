import express from "express";
import chatRoutes from './routes/chatRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import requestLogger from './middleware/requestLogger.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

// 中间件
app.use(express.static('public'));
app.use(express.json());
app.use(requestLogger);

// 路由
app.use('/chat', chatRoutes);
app.use('/session', sessionRoutes);
app.use('/', systemRoutes);

// 错误处理
app.use(notFoundHandler);
app.use(errorHandler);

export default app;