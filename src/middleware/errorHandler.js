import logger from '../../logger.js';
import { config } from '../config/config.js';

// 404 处理
export function notFoundHandler(req, res) {
  logger.warn('404 - 路由未找到', { 
    method: req.method, 
    path: req.path 
  });
  res.status(404).json({ 
    error: "Not Found",
    path: req.path 
  });
}

// 全局错误处理
export function errorHandler(err, req, res, next) {
  logger.error('未捕获的错误', { 
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(500).json({ 
    error: "Internal Server Error",
    message: config.nodeEnv === 'development' ? err.message : undefined
  });
}