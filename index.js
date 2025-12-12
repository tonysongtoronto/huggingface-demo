import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const HF_API_KEY = process.env.HF_API_KEY;

async function testChatCompletion(model) {
  console.log(`\n测试模型: ${model}`);
  console.log("─".repeat(70));
  
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
      return false;
    }
    
    // 检查错误
    if (data.error) {
      console.log(`❌ 错误: ${data.error}`);
      if (data.error.includes("loading")) {
        console.log(`⏱️  模型正在加载中...`);
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
    return false;
  }
}

async function main() {
  // 检查 API Key
  if (!HF_API_KEY) {
    console.error("❌ 错误: 未找到 HF_API_KEY，请检查 .env 文件");
    return;
  }

  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║           HuggingFace Inference API 测试工具                      ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝");
  console.log("\nAPI Key 前缀:", HF_API_KEY.substring(0, 10) + "...");
  console.log("使用新的 OpenAI 兼容端点\n");
  
  // 使用带提供商后缀的模型列表
  // 格式: model-name:provider
  const models = [
    "HuggingFaceTB/SmolLM3-3B:hf-inference",
    "meta-llama/Llama-3.2-1B-Instruct:together",
    "Qwen/Qwen2.5-0.5B-Instruct:hf-inference",
    "microsoft/Phi-3-mini-4k-instruct:together",
    "google/gemma-2-2b-it:together"
  ];
  
  console.log("可用的免费模型列表:");
  models.forEach((model, index) => {
    console.log(`${index + 1}. ${model}`);
  });
  
  console.log("\n开始测试模型...\n");
  
  for (const model of models) {
    const success = await testChatCompletion(model);
    if (success) {
      console.log(`\n✅ 找到可用模型: ${model}`);
      console.log("\n💡 你可以在代码中使用这个模型进行后续开发！");
      break;
    }
    // 在测试之间等待 2 秒
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log("\n测试完成！");
  console.log("\n提示: 如果所有模型都失败，可能是:");
  console.log("1. API Key 无效或过期");
  console.log("2. 需要在 HuggingFace 设置付费方式");
  console.log("3. 模型正在加载中，请稍后重试");
  console.log("\n访问 https://huggingface.co/settings/tokens 检查你的 token");
}

main();