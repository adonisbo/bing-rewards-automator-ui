// 使用严格模式，有助于捕捉常见错误
"use strict";

// 定义主对象，用于组织代码
const BING_AUTOMATOR = {
    // --- 新增: API Key 和词库相关状态 ---
    apiKey: null, // 存储当前会话或记住的 API Key
    apiKeyStored: false, // 标记 API Key 是否从 LocalStorage 加载
    temporaryWordList: [], // 存储动态生成的临时词库
    isGeneratingWords: false, // 标记是否正在生成词库
    // ------------------------------------

    elements: {
        button: {
            start: document.getElementById("btn-start"),
            stop: document.getElementById("btn-stop"),
            setApiKey: document.getElementById("btn-set-api-key"), // 新增
            clearApiKey: document.getElementById("btn-clear-api-key") // 新增
        },
        select: {
            limit: document.getElementById("slc-limit"),
            interval: document.getElementById("slc-interval"),
            multitab: document.getElementById("slc-multitab"),
        },
        span: {
            progress: document.getElementById("span-progress"),
        },
        div: {
            settings: document.getElementById("div-settings"),
            timer: document.getElementById("div-timer"),
            bing: document.getElementById("div-bing")
        },
        modal: {
             help: null // 在 init 中初始化
        },
        input: { // 新增
            apiKey: document.getElementById("google-api-key-input"),
            rememberApiKey: document.getElementById("remember-api-key")
        }
    },

    // Cookie 操作 (用于设置)
    cookies: {
        set: (name, value, expiresDays = 365) => {
            try {
                let d = new Date();
                d.setTime(d.getTime() + (expiresDays * 24 * 60 * 60 * 1000));
                let expires = "expires=" + d.toUTCString();
                document.cookie = name + "=" + value + ";" + expires + ";path=/";
            } catch (e) { console.error("Error setting cookie:", e); }
        },
        get: (name) => {
            let cookieValue = null;
            try {
                let nameEQ = name + "=";
                let ca = document.cookie.split(';');
                for(let i = 0; i < ca.length; i++) { /* ... (获取 cookie 逻辑不变) ... */ }
            } catch (e) { console.error("Error getting cookie:", e); }
            return { name: name, value: cookieValue };
        },
        loadSettings: () => {
             let showHelpModal = false;
             // ... (加载 limit, interval, multitab 设置的逻辑不变) ...

             // 检查是否需要显示帮助弹窗 (第一次加载设置时)
             const needHelpCookie = BING_AUTOMATOR.cookies.get("_need_help");
             if (BING_AUTOMATOR.elements.modal.help && (!needHelpCookie.value || showHelpModal)) {
                  try { BING_AUTOMATOR.elements.modal.help.show(); } catch(e) { console.error("Error showing help modal:", e); }
                 BING_AUTOMATOR.cookies.set("_need_help", "true");
             }
             BING_AUTOMATOR.updateSettingsDisplay();
        }
    },

    // --- 新增: API Key 处理函数 ---
    apiKeyUtils: {
        // 从 LocalStorage 加载 API Key
        loadFromStorage: () => {
            try {
                const storedKey = localStorage.getItem("googleApiKey");
                if (storedKey && BING_AUTOMATOR.elements.input.apiKey) {
                    BING_AUTOMATOR.apiKey = storedKey;
                    BING_AUTOMATOR.apiKeyStored = true;
                    // 出于安全考虑，不在输入框直接显示完整 Key，可以显示部分或提示已设置
                    BING_AUTOMATOR.elements.input.apiKey.placeholder = "**** 已记住 Key ****";
                    BING_AUTOMATOR.elements.input.apiKey.value = ""; // 清空输入框
                    BING_AUTOMATOR.elements.input.rememberApiKey.checked = true;
                    console.log("API Key loaded from LocalStorage.");
                    // 可以选择在这里自动触发一次词库生成
                    // BING_AUTOMATOR.generateTemporaryWordList();
                } else {
                    BING_AUTOMATOR.apiKeyStored = false;
                    if (BING_AUTOMATOR.elements.input.apiKey) {
                        BING_AUTOMATOR.elements.input.apiKey.placeholder = "输入您的 API Key";
                    }
                    console.log("No API Key found in LocalStorage.");
                }
            } catch (e) {
                console.error("Error loading API Key from LocalStorage:", e);
            }
        },
        // 处理用户输入的 API Key
        handleInput: () => {
            if (!BING_AUTOMATOR.elements.input.apiKey || !BING_AUTOMATOR.elements.input.rememberApiKey) {
                console.error("API Key input elements not found.");
                return;
            }
            const inputKey = BING_AUTOMATOR.elements.input.apiKey.value.trim();
            const remember = BING_AUTOMATOR.elements.input.rememberApiKey.checked;

            if (!inputKey) {
                alert("请输入有效的 Google AI API Key。");
                return;
            }

            BING_AUTOMATOR.apiKey = inputKey; // 更新当前会话的 Key
            BING_AUTOMATOR.apiKeyStored = remember; // 更新存储状态

            if (remember) {
                try {
                    localStorage.setItem("googleApiKey", inputKey);
                    console.log("API Key saved to LocalStorage.");
                    BING_AUTOMATOR.elements.input.apiKey.placeholder = "**** 已记住 Key ****"; // 更新提示
                    BING_AUTOMATOR.elements.input.apiKey.value = ""; // 清空输入框更安全
                } catch (e) {
                    console.error("Error saving API Key to LocalStorage:", e);
                    alert("无法记住 API Key，LocalStorage 可能已满或被禁用。");
                    BING_AUTOMATOR.apiKeyStored = false;
                    BING_AUTOMATOR.elements.input.rememberApiKey.checked = false;
                }
            } else {
                try {
                    localStorage.removeItem("googleApiKey"); // 如果取消记住，则移除
                    console.log("API Key removed from LocalStorage (if existed).");
                    BING_AUTOMATOR.elements.input.apiKey.placeholder = "输入您的 API Key"; // 恢复提示
                } catch (e) {
                    console.error("Error removing API Key from LocalStorage:", e);
                }
                console.log("API Key set for current session only.");
            }

            alert("API Key 已设置！");
            // 可以在设置 Key 后立即尝试生成词库
            BING_AUTOMATOR.generateTemporaryWordList();
        },
        // 清除记住的 API Key
        clearStoredKey: () => {
             try {
                 localStorage.removeItem("googleApiKey");
                 BING_AUTOMATOR.apiKey = null; // 清除当前会话的 Key
                 BING_AUTOMATOR.apiKeyStored = false;
                 if (BING_AUTOMATOR.elements.input.apiKey) {
                     BING_AUTOMATOR.elements.input.apiKey.value = "";
                     BING_AUTOMATOR.elements.input.apiKey.placeholder = "输入您的 API Key";
                 }
                 if (BING_AUTOMATOR.elements.input.rememberApiKey) {
                     BING_AUTOMATOR.elements.input.rememberApiKey.checked = false;
                 }
                 alert("已清除记住的 API Key。");
                 console.log("Stored API Key cleared.");
             } catch (e) {
                 console.error("Error clearing stored API Key:", e);
                 alert("清除 API Key 时出错。");
             }
        }
    },
    // ------------------------------------

    search: {
        limit: 35,
        interval: 10000,
        multitab: false,
        isRunning: false,
        currentTimeoutId: null,
        searchWindow: null,
        // searchTermsList: [], // 不再使用静态列表
        formParams: ["QBLH", "QBRE", "HDRSC1", "LGWQS1", "R5FD", "QSRE1"],

        // --- 修改: 从临时词库获取搜索词 ---
        getRandomSearchTerm: () => {
            if (BING_AUTOMATOR.temporaryWordList && BING_AUTOMATOR.temporaryWordList.length > 0) {
                return BING_AUTOMATOR.temporaryWordList[Math.floor(Math.random() * BING_AUTOMATOR.temporaryWordList.length)];
            } else {
                // 如果临时词库为空，返回一个非常基础的默认词，或提示错误
                console.warn("Temporary word list is empty. Using default term.");
                return "你好"; // 或者可以返回 null 并在 executeSearch 中处理
            }
        },
        // --------------------------------

        getRandomFormParam: () => { /* ... (不变) ... */ },
        engine: { /* ... (不变) ... */ }
    },

    // --- 新增: 调用 Google AI API 生成临时词库 ---
    generateTemporaryWordList: async () => {
        if (BING_AUTOMATOR.isGeneratingWords) {
            console.log("Already generating word list...");
            return false; // 防止重复调用
        }
        if (!BING_AUTOMATOR.apiKey) {
            alert("请先在页面右上角输入并设置您的 Google AI API Key。");
            console.error("API Key is not set.");
            return false; // 生成失败
        }

        BING_AUTOMATOR.isGeneratingWords = true;
        console.log("Generating temporary word list using Google AI...");
        // 可以添加一个视觉提示，比如按钮旁显示加载状态
        if(BING_AUTOMATOR.elements.button.start) BING_AUTOMATOR.elements.button.start.disabled = true; // 禁用开始按钮

        // Gemini API Endpoint 和模型 (请根据需要选择合适的模型)
        const model = 'gemini-1.5-flash'; // 或者 'gemini-pro'
        const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${BING_AUTOMATOR.apiKey}`;

        // 精心设计的 Prompt
        const prompt = `请生成一个包含大约 100 个中文或英文词语/短语的列表，主题围绕“运动明星”、“知名品牌”、“户外装备及用具”、“全球旅游景点”。
要求：
1. 列表包含中文和英文词语/短语。
2. 每个词语或短语单独一行。
3. 不要包含任何引号、括号、书名号或其他特殊标点符号。
4. 确保内容积极、健康、安全，不包含任何与色情、暴力、犯罪、仇恨言论、危险活动或政治敏感相关的内容。
5. 词语或短语可以是名称、术语、地点、物品等。
6. 尽量多样化，避免重复。
7. 只输出列表，不要包含任何其他说明文字或编号。`;

        // API 请求体
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            // 配置安全设置，阻止不安全内容
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            ],
             generationConfig: {
                 // temperature: 0.7, // 可以调整随机性
                 maxOutputTokens: 8192, // 增加最大输出 token 限制
             }
        };

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                // 处理 API 错误 (例如 Key 无效, 权限问题, 超出配额)
                const errorData = await response.json();
                console.error('Google AI API Error:', errorData);
                alert(`生成词库失败: ${errorData.error?.message || response.statusText}`);
                BING_AUTOMATOR.temporaryWordList = ["错误"]; // 设置错误标记或空列表
                return false; // 生成失败
            }

            const data = await response.json();

            // 检查是否有内容被安全过滤器阻止
            if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
                 const feedback = data.promptFeedback || data.candidates?.[0]?.finishReason || 'Unknown safety block';
                 console.warn('Content blocked by safety filter or empty response:', feedback);
                 alert(`生成词库时部分内容可能被安全过滤器阻止。原因: ${feedback}`);
                 // 即使被阻止，也可能返回了部分内容，尝试处理
                 if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                      // 继续处理返回的部分内容
                 } else {
                      BING_AUTOMATOR.temporaryWordList = ["安全阻止"];
                      return false; // 认为生成失败
                 }
            }


            // 提取文本并分割成列表
            const textResult = data.candidates[0].content.parts[0].text;
            const words = textResult.split('\n')
                                    .map(word => word.trim()) // 去除首尾空格
                                    .filter(word => word.length > 1); // 过滤空行和过短的词

            if (words.length > 0) {
                BING_AUTOMATOR.temporaryWordList = words;
                console.log(`Successfully generated ${words.length} words.`);
                alert(`已成功生成 ${words.length} 个临时搜索词！`);
                return true; // 生成成功
            } else {
                console.warn("Generated word list is empty after processing.");
                alert("未能从 AI 生成有效的词语列表。");
                BING_AUTOMATOR.temporaryWordList = ["生成为空"];
                return false; // 生成失败
            }

        } catch (error) {
            console.error('Error calling Google AI API:', error);
            alert(`调用 Google AI 时出错: ${error.message}`);
            BING_AUTOMATOR.temporaryWordList = ["网络错误"];
            return false; // 生成失败
        } finally {
            BING_AUTOMATOR.isGeneratingWords = false;
            // 重新启用开始按钮
            if(BING_AUTOMATOR.elements.button.start) BING_AUTOMATOR.elements.button.start.disabled = false;
        }
    },
    // -----------------------------------------

    executeSearch: (index = 1) => { /* ... (基本不变, 依赖 getRandomSearchTerm 的新实现) ... */ },

    // --- 修改: start 函数需要异步并调用词库生成 ---
    start: async () => { // 添加 async 关键字
        console.log("Start button clicked, executing BING_AUTOMATOR.start...");

        if (BING_AUTOMATOR.search.isRunning) {
            console.log("Search is already running.");
            return;
        }
        if (!BING_AUTOMATOR.elements.button.start || !BING_AUTOMATOR.elements.button.stop) {
             console.error("Start or Stop button not found.");
             return;
        }

        // --- 新增: 在开始前生成或确认词库 ---
        // 如果没有 API Key 或者临时词库为空，尝试生成
        if (!BING_AUTOMATOR.apiKey || BING_AUTOMATOR.temporaryWordList.length === 0) {
             const generated = await BING_AUTOMATOR.generateTemporaryWordList(); // 使用 await 等待生成完成
             if (!generated) {
                 console.error("Failed to generate word list. Aborting search start.");
                 // 可以在这里给用户更明确的提示
                 return; // 如果生成失败，则不开始搜索
             }
             // 如果是首次生成，可能需要短暂延迟让用户看到提示
             await new Promise(resolve => setTimeout(resolve, 500));
        }
        // -----------------------------------

        console.log("Starting auto search...");
        BING_AUTOMATOR.search.isRunning = true;

        BING_AUTOMATOR.elements.button.start.style.display = "none";
        BING_AUTOMATOR.elements.button.stop.style.display = "inline-block";

        if (BING_AUTOMATOR.search.currentTimeoutId) { clearTimeout(BING_AUTOMATOR.search.currentTimeoutId); }
        BING_AUTOMATOR.search.engine.timer.stopDisplayUpdater();

        BING_AUTOMATOR.executeSearch(1); // 开始执行搜索
    },
    // -----------------------------------------

    stop: (completed = false) => { /* ... (不变) ... */ },
    updateSettingsDisplay: () => { /* ... (不变) ... */ },

    init: () => {
        console.log("Bing Automator Initializing...");

        // 初始化 Modal
        try { /* ... (Modal 初始化逻辑不变) ... */ } catch(e) { console.error("Error initializing Bootstrap modal:", e); }

        // --- 新增: 页面加载时尝试加载 API Key ---
        BING_AUTOMATOR.apiKeyUtils.loadFromStorage();
        // ------------------------------------

        BING_AUTOMATOR.cookies.loadSettings(); // 加载搜索设置

        // 下拉框事件监听器
        if (BING_AUTOMATOR.elements.select.limit) { /* ... (不变) ... */ }
        if (BING_AUTOMATOR.elements.select.interval) { /* ... (不变) ... */ }
        if (BING_AUTOMATOR.elements.select.multitab) { /* ... (不变) ... */ }

        // 开始按钮事件监听器
        if (BING_AUTOMATOR.elements.button.start) {
            BING_AUTOMATOR.elements.button.start.addEventListener("click", BING_AUTOMATOR.start);
        } else { console.error("Start button (#btn-start) not found."); }

        // 停止按钮事件监听器
        if (BING_AUTOMATOR.elements.button.stop) {
            BING_AUTOMATOR.elements.button.stop.addEventListener("click", () => BING_AUTOMATOR.stop(false));
        } else { console.error("Stop button (#btn-stop) not found."); }

        // --- 新增: API Key 相关按钮事件监听器 ---
        if (BING_AUTOMATOR.elements.button.setApiKey) {
            BING_AUTOMATOR.elements.button.setApiKey.addEventListener("click", BING_AUTOMATOR.apiKeyUtils.handleInput);
        } else { console.error("Set API Key button (#btn-set-api-key) not found."); }

        if (BING_AUTOMATOR.elements.button.clearApiKey) {
            BING_AUTOMATOR.elements.button.clearApiKey.addEventListener("click", BING_AUTOMATOR.apiKeyUtils.clearStoredKey);
        } else { console.error("Clear API Key button (#btn-clear-api-key) not found."); }
        // --------------------------------------

        console.log("Bing Automator Ready.");
    }
};

// DOM 加载完成后执行初始化
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", BING_AUTOMATOR.init);
} else {
    BING_AUTOMATOR.init();
}