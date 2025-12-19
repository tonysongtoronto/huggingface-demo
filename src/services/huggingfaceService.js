import fetch from "node-fetch";
import { config } from '../config/config.js';
import logger from '../../logger.js';

class HuggingFaceService {
  async chat(messages, modelKey = config.huggingface.defaultModel) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const model = config.huggingface.models[modelKey] || config.huggingface.models[config.huggingface.defaultModel];

     // 1. 定义你的角色 Prompt (后端逻辑，不影响前端显示)
       const systemPrompt = {
      role: "system", 
      content: `You are an expert customer support agent. Always answer clearly and politely.
        Examples:
        Q: How to reset password?
        A: Please click "Forgot Password" on the login page...`
    };

        // 2. 核心操作：将系统消息插入到第一位，后面紧跟前端传来的所有对话记录
    const apiMessages = [systemPrompt, ...messages];
    
    try {
      logger.info('开始调用 HuggingFace API', { 
        requestId, 
        model, 
        messageCount: apiMessages.length 
      });
      
      const response = await fetch(config.huggingface.apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.huggingface.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: apiMessages, // 只有这里用到了 system 消息
          max_tokens: config.huggingface.maxTokens,
          temperature: config.huggingface.temperature
        })
      });

      logger.info('收到 HuggingFace API 响应', { 
        requestId,
        status: response.status, 
        statusText: response.statusText 
      });

      const textResponse = await response.text();
      
      let data;
      try {
        data = JSON.parse(textResponse);
      } catch (parseError) {
        logger.error('JSON 解析失败', { 
          requestId,
          error: parseError.message,
          responsePreview: textResponse.substring(0, 200) 
        });
        throw new Error(`API 返回了无效的 JSON: ${textResponse.substring(0, 200)}`);
      }

      if (data.error) {
        const errorMsg = typeof data.error === 'string' 
          ? data.error 
          : JSON.stringify(data.error);
        
        logger.error('HuggingFace API 返回错误', { 
          requestId,
          model,
          error: errorMsg 
        });
        throw new Error(errorMsg);
      }

      if (!data.choices || !data.choices[0]) {
        logger.error('API 响应格式无效', { 
          requestId,
          response: JSON.stringify(data) 
        });
        throw new Error("API 响应格式不正确");
      }

      logger.info('API 调用成功', { 
        requestId,
        model,
        tokensUsed: data.usage 
      });

      return {
        content: data.choices[0].message.content,
        model: model,
        usage: data.usage
      };

    } catch (error) {
      logger.error('HuggingFace API 调用失败', { 
        requestId,
        model,
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  getAvailableModels() {
    return {
      available_models: Object.keys(config.huggingface.models),
      default_model: config.huggingface.defaultModel,
      models: config.huggingface.models,
      verified: ["llama", "gemma"],
      note: "所有模型都需要有效的 HuggingFace API Key"
    };
  }
}

export default new HuggingFaceService();