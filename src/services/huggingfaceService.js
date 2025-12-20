import fetch from "node-fetch";
import { config } from '../config/config.js';
import logger from '../../logger.js';

class HuggingFaceService {
    /**
     * 获取系统预设 Prompt
     */
    getSystemPrompt() {
        return {
            role: "system",
            content: `You are an expert customer support agent. Always answer clearly and politely.
            Examples:
            Q: How to reset password?
            A: Please click "Forgot Password" on the login page...`
        };
    }

    /**
     * 普通对话接口 (非流式)
     * @param {Array} messages - 消息数组 [{role: "user", content: "..."}]
     * @param {string} modelKey - 模型映射键名
     */
    async chat(messages, modelKey = config.huggingface.defaultModel) {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const model = config.huggingface.models[modelKey] || config.huggingface.models[config.huggingface.defaultModel];

        // 插入系统角色
        const apiMessages = [this.getSystemPrompt(), ...messages];

        try {
            logger.info('开始调用 HuggingFace API', { requestId, model, messageCount: apiMessages.length });

            const response = await fetch(config.huggingface.apiUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${config.huggingface.apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: model,
                    messages: apiMessages,
                    max_tokens: config.huggingface.maxTokens,
                    temperature: config.huggingface.temperature,
                    stream: false
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`API Error ${response.status}: ${errorData}`);
            }

            const data = await response.json();

            if (data.error) throw new Error(JSON.stringify(data.error));

            logger.info('API 调用成功', { requestId, usage: data.usage });

            return {
                content: data.choices[0].message.content,
                model: model,
                usage: data.usage
            };

        } catch (error) {
            logger.error('HuggingFace API 调用失败', { requestId, error: error.message });
            throw error;
        }
    }

    /**
     * 流式对话接口 (Streaming)
     * @param {Array} messages - 消息数组
     * @param {string} modelKey - 模型映射键名
     * @param {Function} onToken - 接收到每个 token 时的回调函数
     */
    async chatStream(messages, modelKey = config.huggingface.defaultModel, onToken) {
        const requestId = `stream_${Date.now()}`;
        const model = config.huggingface.models[modelKey] || config.huggingface.models[config.huggingface.defaultModel];
        
        const apiMessages = [this.getSystemPrompt(), ...messages];

        try {
            logger.info('开始流式调用 HuggingFace API', { requestId, model });

            const response = await fetch(config.huggingface.apiUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${config.huggingface.apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: model,
                    messages: apiMessages,
                    max_tokens: config.huggingface.maxTokens,
                    temperature: config.huggingface.temperature,
                    stream: true 
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Stream API Error: ${response.status} - ${errorText}`);
            }

            // 使用 Promise 封装流处理过程，确保外部 await 能正确等待流结束
            return new Promise((resolve, reject) => {
                // 监听数据块
                response.body.on('data', (chunk) => {
                    const chunkStr = chunk.toString();
                    const lines = chunkStr.split('\n');

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

                        if (trimmedLine.startsWith('data: ')) {
                            try {
                                const jsonStr = trimmedLine.slice(6);
                                const data = JSON.parse(jsonStr);
                                const token = data.choices[0]?.delta?.content;
                                if (token) {
                                    onToken(token);
                                }
                            } catch (e) {
                                // 忽略解析失败的块（有时 chunk 会被截断导致不完整 JSON）
                                logger.debug('流块解析跳过', { error: e.message });
                            }
                        }
                    }
                });

                // 监听流结束
                response.body.on('end', () => {
                    logger.info('流传输成功结束', { requestId });
                    resolve();
                });

                // 监听流错误
                response.body.on('error', (err) => {
                    logger.error('流传输中断', { requestId, error: err.message });
                    reject(err);
                });
            });

        } catch (error) {
            logger.error('chatStream 调用异常', { requestId, error: error.message });
            throw error;
        }
    }

    /**
     * 获取可用模型配置
     */
    getAvailableModels() {
        return {
            available_models: Object.keys(config.huggingface.models),
            default_model: config.huggingface.defaultModel,
            models: config.huggingface.models,
            note: "Supports both standard and streaming responses."
        };
    }
}

export default new HuggingFaceService();