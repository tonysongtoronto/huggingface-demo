import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const HF_API_KEY = process.env.HF_API_KEY;

async function testChatCompletion(model, retries = 2) {
  console.log(`\n测试模型: ${model}`);
  console.log("─".repeat(70));
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const resp = await fetch(
        "https://router.huggingface.co/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: "user",
                content: "Hello! What can you help me with?"
              }
            ],
            max_tokens: 100,
            temperature: 0.7
          })
        }
      );
      
      console.log(`响应状态: ${resp.status} ${resp.statusText}`);
      
      const text = await resp.text();
      
      // 尝试解析 JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.log(`❌ JSON 解析失败: ${text.substring(0, 200)}`);
        if (attempt <= retries) {
          console.log(`⏳ 重试中... (尝试 ${attempt}/${retries + 1})`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
          continue;
        }
        return false;
      }
      
      // 检查错误
      if (data.error) {
        const errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        console.log(`❌ 错误: ${errorMsg}`);
        if (errorMsg.includes("loading") && attempt <= retries) {
          console.log(`⏱️ 模型正在加载中，重试... (尝试 ${attempt}/${retries + 1})`);
          await new Promise(resolve => setTimeout(resolve, 10000)); // 等待10秒
          continue;
        }
        return false;
      }
      
      // 成功输出
      if (data.choices && data.choices[0]) {
        console.log("✅ 成功！\n");
        console.log("问题: Hello! What can you help me with?");
        console.log("\n回答:");
        console.log(data.choices[0].message.content);
        console.log("\n使用信息:");
        if (data.usage) {
          console.log(`- 提示词 tokens: ${data.usage.prompt_tokens}`);
          console.log(`- 生成 tokens: ${data.usage.completion_tokens}`);
          console.log(`- 总计 tokens: ${data.usage.total_tokens}`);
        }
        return true;
      }
      
      console.log("响应格式:", JSON.stringify(data, null, 2));
      return false;
      
    } catch (error) {
      console.log(`❌ 请求失败: ${error.message}`);
      if (attempt <= retries) {
        console.log(`⏳ 重试中... (尝试 ${attempt}/${retries + 1})`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
      return false;
    }
  }
  return false;
}

async function main() {
  // 检查 API Key
  if (!HF_API_KEY) {
    console.error("❌ 错误: 未找到 HF_API_KEY，请检查 .env 文件");
    return;
  }

  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║           HuggingFace Inference API 测试工具 (修改版)              ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝");
  console.log("\nAPI Key 前缀:", HF_API_KEY.substring(0, 10) + "...");
  console.log("使用无后缀模型 + 自动路由 + 重试机制\n");
  
  // 修改：使用无后缀的可靠模型列表（类似于第一个脚本）
  const models = [
    "meta-llama/Llama-3.3-70B-Instruct",  // 大型Llama，稳定
    "google/gemma-2-9b-it",               // Gemma，中大型
    "Qwen/Qwen2.5-72B-Instruct",          // Qwen，大型
    "deepseek-ai/DeepSeek-V3",            // DeepSeek
  "openai/gpt-oss-120b:groq"// Mixtral
  ];


  
  console.log("可用的可靠模型列表:");
  models.forEach((model, index) => {
    console.log(`${index + 1}. ${model}`);
  });
  
  console.log("\n开始测试模型...\n");
  
  let found = false;
  for (const model of models) {
    const success = await testChatCompletion(model, 2); // 最多重试2次
    if (success) {
      console.log(`\n✅ 找到可用模型: ${model}`);
      console.log("\n💡 你可以在代码中使用这个模型进行后续开发！");
      found = true;
    
    }
    // 测试间等待2秒
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  if (!found) {
    console.log("\n❌ 所有模型测试失败！");
  }
  
  console.log("\n测试完成！");
  console.log("\n提示: 如果仍失败，可能是:");
  console.log("1. API Key 无效/过期 - 检查 https://huggingface.co/settings/tokens");
  console.log("2. 需要同意模型许可 (e.g., Llama页面点击Accept)");
  console.log("3. 免费Key限额用尽 - 考虑升级HF PRO");
  console.log("4. 网络问题 - 尝试VPN或稍后重试");
}

main();