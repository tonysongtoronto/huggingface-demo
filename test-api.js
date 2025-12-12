import fetch from "node-fetch";

const API_URL = "http://localhost:3000";

// 颜色输出
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m"
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

/**
 * 测试 1: 健康检查
 */
async function testHealth() {
  log(colors.bright, "\n【测试 1】健康检查");
  log(colors.blue, "─".repeat(70));
  
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    
    log(colors.green, "✅ 健康检查通过");
    console.log(JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    log(colors.red, "❌ 健康检查失败:", error.message);
    return false;
  }
}

/**
 * 测试 2: 获取可用模型
 */
async function testModels() {
  log(colors.bright, "\n【测试 2】获取可用模型");
  log(colors.blue, "─".repeat(70));
  
  try {
    const response = await fetch(`${API_URL}/models`);
    const data = await response.json();
    
    log(colors.green, "✅ 成功获取模型列表");
    console.log(JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    log(colors.red, "❌ 获取模型失败:", error.message);
    return false;
  }
}

/**
 * 测试 3: 单轮对话
 */
async function testChat() {
  log(colors.bright, "\n【测试 3】单轮对话测试");
  log(colors.blue, "─".repeat(70));
  
  const testMessage = "Hello! Tell me a short joke.";
  
  try {
    log(colors.yellow, "发送消息:", testMessage);
    
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: testMessage
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      log(colors.red, "❌ API 返回错误:", data.error);
      return false;
    }
    
    log(colors.green, "✅ 收到回复:");
    console.log("\n" + data.reply + "\n");
    
    if (data.usage) {
      console.log("使用情况:");
      console.log(`  - Prompt tokens: ${data.usage.prompt_tokens}`);
      console.log(`  - Completion tokens: ${data.usage.completion_tokens}`);
      console.log(`  - Total tokens: ${data.usage.total_tokens}`);
    }
    
    return true;
  } catch (error) {
    log(colors.red, "❌ 对话测试失败:", error.message);
    return false;
  }
}

/**
 * 测试 4: 多轮对话
 */
async function testMultiTurnChat() {
  log(colors.bright, "\n【测试 4】多轮对话测试");
  log(colors.blue, "─".repeat(70));
  
  const conversation = [
    { role: "user", content: "My name is Alice." },
    { role: "assistant", content: "Nice to meet you, Alice!" },
    { role: "user", content: "What's my name?" }
  ];
  
  try {
    log(colors.yellow, "发送对话历史 (3条消息)");
    
    const response = await fetch(`${API_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: conversation
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      log(colors.red, "❌ API 返回错误:", data.error);
      return false;
    }
    
    log(colors.green, "✅ 收到回复:");
    console.log("\n" + data.reply + "\n");
    
    return true;
  } catch (error) {
    log(colors.red, "❌ 多轮对话测试失败:", error.message);
    return false;
  }
}

/**
 * 测试 5: 使用不同模型
 */
async function testDifferentModels() {
  log(colors.bright, "\n【测试 5】测试不同模型");
  log(colors.blue, "─".repeat(70));
  
  const models = ["smollm", "qwen"];
  const testMessage = "Say 'Hello' in one word.";
  
  for (const model of models) {
    try {
      log(colors.yellow, `\n测试模型: ${model}`);
      
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: testMessage,
          model: model
        })
      });
      
      const data = await response.json();
      
      if (data.error) {
        log(colors.red, `❌ ${model} 返回错误:`, data.error);
        continue;
      }
      
      log(colors.green, `✅ ${model} 回复:`, data.reply);
      
    } catch (error) {
      log(colors.red, `❌ ${model} 测试失败:`, error.message);
    }
    
    // 等待 1 秒再测试下一个模型
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return true;
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log("\n");
  log(colors.bright, "╔═══════════════════════════════════════════════════════════════╗");
  log(colors.bright, "║           HuggingFace API 测试套件                           ║");
  log(colors.bright, "╚═══════════════════════════════════════════════════════════════╝");
  
  const results = [];
  
  results.push(await testHealth());
  results.push(await testModels());
  results.push(await testChat());
  results.push(await testMultiTurnChat());
  results.push(await testDifferentModels());
  
  // 总结
  log(colors.bright, "\n" + "═".repeat(70));
  log(colors.bright, "测试总结");
  log(colors.bright, "═".repeat(70));
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  if (passed === total) {
    log(colors.green, `✅ 所有测试通过! (${passed}/${total})`);
  } else {
    log(colors.yellow, `⚠️  部分测试通过 (${passed}/${total})`);
  }
  
  console.log("\n");
}

// 运行测试
runAllTests().catch(error => {
  log(colors.red, "测试运行失败:", error);
  process.exit(1);
});