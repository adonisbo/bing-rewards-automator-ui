// 使用严格模式
"use strict";

// 定义主对象
const BING_AUTOMATOR = {
    apiKey: null,
    apiKeyStored: false,
    temporaryWordList: [],
    isGeneratingWords: false,
    availableWordsThisSession: [], // 新增：本次会话可用的词库副本

    elements: {
        button: {
            start: document.getElementById("btn-start"),
            stop: document.getElementById("btn-stop"),
            setApiKey: document.getElementById("btn-set-api-key"),
            clearApiKey: document.getElementById("btn-clear-api-key")
        },
        select: {
            limit: document.getElementById("slc-limit"),
            interval: document.getElementById("slc-interval"),
            multitab: document.getElementById("slc-multitab"),
        },
        span: {
            progress: document.getElementById("span-progress"),
            apiKeyStatus: document.getElementById("api-key-status") // 新增 API 状态提示元素
        },
        div: {
            settings: document.getElementById("div-settings"),
            timer: document.getElementById("div-timer"),
            bing: document.getElementById("div-bing")
        },
        modal: {
             help: null // 在 init 中初始化
        },
        input: {
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
                for(let i = 0; i < ca.length; i++) {
                    let c = ca[i];
                    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                    if (c.indexOf(nameEQ) === 0) {
                        cookieValue = c.substring(nameEQ.length, c.length);
                        break;
                    }
                }
            } catch (e) { console.error("Error getting cookie:", e); }
            return { name: name, value: cookieValue };
        },
        loadSettings: () => {
             let showHelpModal = false;
             const limitCookie = BING_AUTOMATOR.cookies.get("_search_limit");
             if (limitCookie.value && BING_AUTOMATOR.elements.select.limit) {
                 BING_AUTOMATOR.elements.select.limit.value = limitCookie.value;
                 BING_AUTOMATOR.search.limit = parseInt(limitCookie.value, 10);
             } else if (BING_AUTOMATOR.elements.select.limit) {
                 BING_AUTOMATOR.search.limit = parseInt(BING_AUTOMATOR.elements.select.limit.value, 10);
                 BING_AUTOMATOR.cookies.set("_search_limit", BING_AUTOMATOR.search.limit.toString());
                 showHelpModal = true;
             }

             const intervalCookie = BING_AUTOMATOR.cookies.get("_search_interval");
             if (intervalCookie.value && BING_AUTOMATOR.elements.select.interval) {
                 BING_AUTOMATOR.elements.select.interval.value = intervalCookie.value;
                 BING_AUTOMATOR.search.interval = parseInt(intervalCookie.value, 10);
             } else if (BING_AUTOMATOR.elements.select.interval) {
                 BING_AUTOMATOR.search.interval = parseInt(BING_AUTOMATOR.elements.select.interval.value, 10);
                 BING_AUTOMATOR.cookies.set("_search_interval", BING_AUTOMATOR.search.interval.toString());
                 showHelpModal = true;
             }

             const multitabCookie = BING_AUTOMATOR.cookies.get("_multitab_mode");
             if (multitabCookie.value && BING_AUTOMATOR.elements.select.multitab) {
                 BING_AUTOMATOR.elements.select.multitab.value = multitabCookie.value;
                 BING_AUTOMATOR.search.multitab = (multitabCookie.value === "true");
             } else if (BING_AUTOMATOR.elements.select.multitab) {
                 BING_AUTOMATOR.search.multitab = (BING_AUTOMATOR.elements.select.multitab.value === "true");
                 BING_AUTOMATOR.cookies.set("_multitab_mode", BING_AUTOMATOR.search.multitab.toString());
                 showHelpModal = true;
             }

             const needHelpCookie = BING_AUTOMATOR.cookies.get("_need_help");
             if (BING_AUTOMATOR.elements.modal.help && (!needHelpCookie.value || showHelpModal)) {
                  try { BING_AUTOMATOR.elements.modal.help.show(); } catch(e) { console.error("Error showing help modal:", e); }
                 BING_AUTOMATOR.cookies.set("_need_help", "true");
             }
             BING_AUTOMATOR.updateSettingsDisplay();
        }
    },

    // API Key 处理
    apiKeyUtils: {
        loadFromStorage: async () => { // 改为 async
            try {
                const storedKey = localStorage.getItem("googleApiKey");
                if (storedKey && BING_AUTOMATOR.elements.input.apiKey) {
                    BING_AUTOMATOR.apiKey = storedKey;
                    BING_AUTOMATOR.apiKeyStored = true;
                    BING_AUTOMATOR.elements.input.apiKey.placeholder = "**** 已记住 Key ****";
                    BING_AUTOMATOR.elements.input.apiKey.value = "";
                    if (BING_AUTOMATOR.elements.input.rememberApiKey) BING_AUTOMATOR.elements.input.rememberApiKey.checked = true;
                    console.log("API Key loaded from LocalStorage.");
                    BING_AUTOMATOR.apiKeyUtils.updateStatus("✓ Key 已加载", "success");
                    // 自动生成词库
                    await BING_AUTOMATOR.generateTemporaryWordList(); // 使用 await
                } else {
                    BING_AUTOMATOR.apiKeyStored = false;
                    if (BING_AUTOMATOR.elements.input.apiKey) BING_AUTOMATOR.elements.input.apiKey.placeholder = "输入您的 API Key";
                    if (BING_AUTOMATOR.elements.button.start) BING_AUTOMATOR.elements.button.start.disabled = true; // 无 Key 则禁用开始按钮
                    BING_AUTOMATOR.apiKeyUtils.updateStatus("未设置 API Key", "warning");
                    console.log("No API Key found in LocalStorage.");
                }
            } catch (e) {
                console.error("Error loading API Key from LocalStorage:", e);
                BING_AUTOMATOR.apiKeyUtils.updateStatus("加载 Key 失败", "error");
            }
        },
        handleInput: async () => { // 改为 async
            if (!BING_AUTOMATOR.elements.input.apiKey || !BING_AUTOMATOR.elements.input.rememberApiKey) return;
            const inputKey = BING_AUTOMATOR.elements.input.apiKey.value.trim();
            const remember = BING_AUTOMATOR.elements.input.rememberApiKey.checked;

            if (!inputKey) {
                alert("请输入有效的 Google AI API Key。");
                BING_AUTOMATOR.apiKeyUtils.updateStatus("请输入 Key", "warning");
                return;
            }

            BING_AUTOMATOR.apiKey = inputKey;
            BING_AUTOMATOR.apiKeyStored = remember;
            BING_AUTOMATOR.apiKeyUtils.updateStatus("正在验证 Key...", "info"); // 提示正在处理

            if (remember) {
                try {
                    localStorage.setItem("googleApiKey", inputKey);
                    console.log("API Key saved to LocalStorage.");
                    BING_AUTOMATOR.elements.input.apiKey.placeholder = "**** 已记住 Key ****";
                    BING_AUTOMATOR.elements.input.apiKey.value = "";
                } catch (e) {
                    console.error("Error saving API Key to LocalStorage:", e);
                    alert("无法记住 API Key，LocalStorage 可能已满或被禁用。");
                    BING_AUTOMATOR.apiKeyStored = false;
                    BING_AUTOMATOR.elements.input.rememberApiKey.checked = false;
                    BING_AUTOMATOR.apiKeyUtils.updateStatus("记住 Key 失败", "error");
                    return; // 保存失败则不继续
                }
            } else {
                try {
                    localStorage.removeItem("googleApiKey");
                    console.log("API Key removed from LocalStorage (if existed).");
                    BING_AUTOMATOR.elements.input.apiKey.placeholder = "输入您的 API Key";
                } catch (e) { console.error("Error removing API Key from LocalStorage:", e); }
                console.log("API Key set for current session only.");
            }

            // 立即尝试生成词库
            const generated = await BING_AUTOMATOR.generateTemporaryWordList(); // 使用 await
            if (generated) {
                 alert("API Key 已设置并成功生成词库！");
                 // 状态已在 generate 函数中更新
            } else {
                 alert("API Key 已设置，但生成词库失败，请检查 Key 或网络。");
                 // 状态已在 generate 函数中更新
            }
        },
        clearStoredKey: () => {
             try {
                 localStorage.removeItem("googleApiKey");
                 BING_AUTOMATOR.apiKey = null;
                 BING_AUTOMATOR.apiKeyStored = false;
                 if (BING_AUTOMATOR.elements.input.apiKey) {
                     BING_AUTOMATOR.elements.input.apiKey.value = "";
                     BING_AUTOMATOR.elements.input.apiKey.placeholder = "输入您的 API Key";
                 }
                 if (BING_AUTOMATOR.elements.input.rememberApiKey) {
                     BING_AUTOMATOR.elements.input.rememberApiKey.checked = false;
                 }
                 if (BING_AUTOMATOR.elements.button.start) BING_AUTOMATOR.elements.button.start.disabled = true; // 清除 Key 后禁用开始按钮
                 BING_AUTOMATOR.temporaryWordList = []; // 清空词库
                 BING_AUTOMATOR.apiKeyUtils.updateStatus("Key 已清除", "info");
                 alert("已清除记住的 API Key。");
                 console.log("Stored API Key cleared.");
             } catch (e) {
                 console.error("Error clearing stored API Key:", e);
                 alert("清除 API Key 时出错。");
                 BING_AUTOMATOR.apiKeyUtils.updateStatus("清除 Key 失败", "error");
             }
        },
        // 新增：更新右上角状态提示
        updateStatus: (message, type = "info") => {
            if (!BING_AUTOMATOR.elements.span.apiKeyStatus) return;
            const span = BING_AUTOMATOR.elements.span.apiKeyStatus;
            span.textContent = message;
            span.className = "api-key-label ms-2"; // Reset classes
            switch (type) {
                case "success":
                    span.classList.add("text-success");
                    break;
                case "warning":
                    span.classList.add("text-warning");
                    break;
                case "error":
                    span.classList.add("text-danger");
                    break;
                case "info":
                default:
                    span.classList.add("text-info");
                    break;
            }
        }
    },

    // 搜索相关
    search: {
        limit: 35,
        interval: 10000,
        multitab: false,
        isRunning: false,
        currentTimeoutId: null,
        searchWindow: null,
        formParams: ["QBLH", "QBRE", "HDRSC1", "LGWQS1", "R5FD", "QSRE1"],

        // 修改：实现从可用词列表中去重抽取
        getRandomSearchTerm: () => {
            if (!BING_AUTOMATOR.availableWordsThisSession || BING_AUTOMATOR.availableWordsThisSession.length === 0) {
                console.warn("Word list for this session is empty.");
                return null; // 返回 null 表示没有可用词语
            }
            const randomIndex = Math.floor(Math.random() * BING_AUTOMATOR.availableWordsThisSession.length);
            const word = BING_AUTOMATOR.availableWordsThisSession[randomIndex];
            // 从可用列表中移除已选中的词
            BING_AUTOMATOR.availableWordsThisSession.splice(randomIndex, 1);
            return word;
        },

        getRandomFormParam: () => {
            const params = BING_AUTOMATOR.search.formParams;
            return params[Math.floor(Math.random() * params.length)];
        },
        engine: {
            progress: { /* ... (不变) ... */ },
            timer: { /* ... (不变) ... */ },
            output: { /* ... (不变) ... */ }
        }
    },

    // Google AI 词库生成
    generateTemporaryWordList: async () => {
        if (BING_AUTOMATOR.isGeneratingWords) {
            console.log("Already generating word list...");
            BING_AUTOMATOR.apiKeyUtils.updateStatus("正在生成...", "info");
            return false;
        }
        if (!BING_AUTOMATOR.apiKey) {
            console.error("API Key is not set for word generation.");
            BING_AUTOMATOR.apiKeyUtils.updateStatus("请先设置 Key", "warning");
            if (BING_AUTOMATOR.elements.button.start) BING_AUTOMATOR.elements.button.start.disabled = true;
            return false;
        }

        BING_AUTOMATOR.isGeneratingWords = true;
        BING_AUTOMATOR.apiKeyUtils.updateStatus("生成词库中...", "info");
        console.log("Generating temporary word list using Google AI...");
        if(BING_AUTOMATOR.elements.button.start) BING_AUTOMATOR.elements.button.start.disabled = true;

        const model = 'gemini-1.5-flash';
        const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${BING_AUTOMATOR.apiKey}`;
        const prompt = `请生成一个包含大约 100 个中文或英文词语/短语的列表，主题围绕“运动明星”、“知名品牌”、“户外装备及用具”、“全球旅游景点”。要求：1. 列表包含中文和英文词语/短语。2. 每个词语或短语单独一行。3. 不要包含任何引号、括号、书名号或其他特殊标点符号。4. 确保内容积极、健康、安全，不包含任何与色情、暴力、犯罪、仇恨言论、危险活动或政治敏感相关的内容。5. 词语或短语可以是名称、术语、地点、物品等。6. 尽量多样化，避免重复。7. 只输出列表，不要包含任何其他说明文字或编号。`;
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            ],
             generationConfig: { maxOutputTokens: 8192 }
        };

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Google AI API Error:', errorData);
                BING_AUTOMATOR.apiKeyUtils.updateStatus(`生成失败: ${errorData.error?.message || response.statusText}`, "error");
                BING_AUTOMATOR.temporaryWordList = [];
                return false;
            }

            const data = await response.json();

            if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
                 const feedback = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || 'Unknown safety block';
                 console.warn('Content blocked or empty response:', feedback);
                 BING_AUTOMATOR.apiKeyUtils.updateStatus(`生成失败: ${feedback}`, "warning");
                 // 即使被阻止，也可能返回了部分内容
                 if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                     // 继续处理部分内容
                 } else {
                      BING_AUTOMATOR.temporaryWordList = [];
                      return false;
                 }
            }

            const textResult = data.candidates[0].content.parts[0].text;
            const words = textResult.split('\n')
                                    .map(word => word.trim())
                                    .filter(word => word.length > 1 && word.length < 100); // 增加长度限制

            if (words.length > 0) {
                BING_AUTOMATOR.temporaryWordList = words;
                BING_AUTOMATOR.apiKeyUtils.updateStatus(`✓ 已生成 ${words.length} 词`, "success");
                console.log(`Successfully generated ${words.length} words.`);
                if (BING_AUTOMATOR.elements.button.start) BING_AUTOMATOR.elements.button.start.disabled = false; // 成功后启用开始按钮
                return true;
            } else {
                console.warn("Generated word list is empty after processing.");
                BING_AUTOMATOR.apiKeyUtils.updateStatus("生成词库为空", "warning");
                BING_AUTOMATOR.temporaryWordList = [];
                return false;
            }

        } catch (error) {
            console.error('Error calling Google AI API:', error);
            BING_AUTOMATOR.apiKeyUtils.updateStatus(`生成出错: ${error.message}`, "error");
            BING_AUTOMATOR.temporaryWordList = [];
            return false;
        } finally {
            BING_AUTOMATOR.isGeneratingWords = false;
            // 无论成功失败，如果搜索未运行，确保开始按钮最终状态正确
             if (!BING_AUTOMATOR.search.isRunning && BING_AUTOMATOR.elements.button.start) {
                 BING_AUTOMATOR.elements.button.start.disabled = (BING_AUTOMATOR.temporaryWordList.length === 0);
             }
        }
    },

    // 搜索执行
    executeSearch: (index = 1) => {
        if (!BING_AUTOMATOR.search.isRunning || index > BING_AUTOMATOR.search.limit) {
            if (BING_AUTOMATOR.search.isRunning) {
                console.log("All searches completed.");
                BING_AUTOMATOR.search.stop(true);
            } else {
                 console.log("Search stopped.");
                 BING_AUTOMATOR.search.engine.timer.stopDisplayUpdater();
            }
            return;
        }

        // 修改：从可用词库中获取词语
        const term = BING_AUTOMATOR.search.getRandomSearchTerm();

        // 如果没有可用词语了（可能次数设置大于词库大小）
        if (term === null) {
             console.warn(`No more unique words available at search ${index}. Stopping.`);
             alert(`临时词库已用完（共 ${BING_AUTOMATOR.temporaryWordList.length} 个），搜索提前结束。`);
             BING_AUTOMATOR.search.stop(true); // 认为正常结束
             return;
        }

        const formParam = BING_AUTOMATOR.search.getRandomFormParam();
        const url = `https://www.bing.com/search?q=${encodeURIComponent(term.toLowerCase())}&FORM=${formParam}`;
        const interval = BING_AUTOMATOR.search.interval;
        let nextDelay = interval;

        if (interval === 9999) {
            nextDelay = (10 + Math.floor(Math.random() * 51)) * 1000;
        }

        console.log(`Executing search ${index}/${BING_AUTOMATOR.search.limit}: ${term} (Delay: ${nextDelay/1000}s)`);

        BING_AUTOMATOR.search.engine.progress.update(index);
        BING_AUTOMATOR.search.engine.timer.updateEstimatedTime(index);
        if(index === 1) {
             BING_AUTOMATOR.search.engine.timer.runDisplayUpdater();
        }

        if (BING_AUTOMATOR.search.multitab) {
            BING_AUTOMATOR.search.engine.output.openWindow(url, interval);
        } else {
            BING_AUTOMATOR.search.engine.output.addIframe(url, term, index);
        }

        BING_AUTOMATOR.search.currentTimeoutId = setTimeout(() => {
            BING_AUTOMATOR.executeSearch(index + 1);
        }, nextDelay);
    },

    // 开始搜索
    start: () => {
        console.log("Start button clicked, executing BING_AUTOMATOR.start...");
        if (BING_AUTOMATOR.search.isRunning) { console.log("Search is already running."); return; }
        if (!BING_AUTOMATOR.elements.button.start || !BING_AUTOMATOR.elements.button.stop) { console.error("Start or Stop button not found."); return; }

        // 检查词库是否已生成且非空
        if (!BING_AUTOMATOR.temporaryWordList || BING_AUTOMATOR.temporaryWordList.length === 0) {
             alert("请先设置有效的 Google AI API Key 并等待临时词库生成成功后再开始搜索。");
             console.error("Cannot start search: Temporary word list is empty.");
             return;
        }

        console.log("Starting auto search...");
        BING_AUTOMATOR.search.isRunning = true;

        // 新增：为本次会话创建可用词列表副本
        BING_AUTOMATOR.availableWordsThisSession = [...BING_AUTOMATOR.temporaryWordList];
        console.log(`Using a pool of ${BING_AUTOMATOR.availableWordsThisSession.length} words for this session.`);


        BING_AUTOMATOR.elements.button.start.style.display = "none";
        BING_AUTOMATOR.elements.button.stop.style.display = "inline-block";

        if (BING_AUTOMATOR.search.currentTimeoutId) { clearTimeout(BING_AUTOMATOR.search.currentTimeoutId); }
        BING_AUTOMATOR.search.engine.timer.stopDisplayUpdater();

        BING_AUTOMATOR.executeSearch(1);
    },

    // 停止搜索
    stop: (completed = false) => {
        console.log("Stopping auto search...");
        BING_AUTOMATOR.search.isRunning = false;

        if (BING_AUTOMATOR.search.currentTimeoutId) {
            clearTimeout(BING_AUTOMATOR.search.currentTimeoutId);
            BING_AUTOMATOR.search.currentTimeoutId = null;
        }
        if (BING_AUTOMATOR.search.searchWindow && !BING_AUTOMATOR.search.searchWindow.closed) {
            BING_AUTOMATOR.search.searchWindow.close();
            BING_AUTOMATOR.search.searchWindow = null;
        }

        BING_AUTOMATOR.search.engine.timer.stopDisplayUpdater();

        // 只有在完成或手动停止时才刷新页面，避免API调用失败时也刷新
        const shouldReload = completed || !BING_AUTOMATOR.isGeneratingWords; // 确保不在生成词时停止导致刷新

        if (BING_AUTOMATOR.elements.button.start && BING_AUTOMATOR.elements.button.stop) {
            BING_AUTOMATOR.elements.button.start.style.display = "inline-block";
            BING_AUTOMATOR.elements.button.stop.style.display = "none";
            // 停止后，根据是否有有效词库决定开始按钮状态
            BING_AUTOMATOR.elements.button.start.disabled = (!BING_AUTOMATOR.temporaryWordList || BING_AUTOMATOR.temporaryWordList.length === 0);
        }


        if (shouldReload) {
            console.log("Reloading page after stopping search...");
             // 延迟刷新
            setTimeout(() => {
                if (completed) { // 仅在正常完成时尝试打开积分页
                     try { window.open("https://rewards.bing.com/pointsbreakdown", "_blank"); } catch(e) { console.error("Could not open points breakdown page:", e); }
                }
                location.reload();
            }, completed ? 1500 : 500); // 正常完成延迟长一点，手动停止快一点
        }
    },

    // 更新设置显示
    updateSettingsDisplay: () => {
        try {
            if (!BING_AUTOMATOR.elements.select.limit || !BING_AUTOMATOR.elements.select.interval || !BING_AUTOMATOR.elements.select.multitab || !BING_AUTOMATOR.elements.div.settings) return;
            const limitText = BING_AUTOMATOR.elements.select.limit.options[BING_AUTOMATOR.elements.select.limit.selectedIndex]?.text || 'N/A';
            const intervalText = BING_AUTOMATOR.elements.select.interval.options[BING_AUTOMATOR.elements.select.interval.selectedIndex]?.text || 'N/A';
            const multitabText = BING_AUTOMATOR.elements.select.multitab.options[BING_AUTOMATOR.elements.select.multitab.selectedIndex]?.text || 'N/A';
            BING_AUTOMATOR.elements.div.settings.innerHTML = `当前设置: ${limitText}, ${intervalText} 间隔, 多标签模式 ${multitabText}`;
        } catch (e) {
            console.error("Error updating settings display:", e);
            if (BING_AUTOMATOR.elements.div.settings) BING_AUTOMATOR.elements.div.settings.innerHTML = `加载设置出错`;
        }
    },

    // 初始化
    init: async () => { // 改为 async
        console.log("Bing Automator Initializing...");

        // 初始化 Modal 实例
        try {
            if (document.getElementById('modal-help')) {
                 BING_AUTOMATOR.elements.modal.help = new bootstrap.Modal(document.getElementById('modal-help'), {});
            } else {
                 console.warn("Help modal element not found.");
            }
        } catch(e) { console.error("Error initializing Bootstrap modal:", e); }

        // 确保所有 elements 都已获取
        if (!BING_AUTOMATOR.elements.button.start || !BING_AUTOMATOR.elements.button.stop ||
            !BING_AUTOMATOR.elements.select.limit || !BING_AUTOMATOR.elements.select.interval ||
            !BING_AUTOMATOR.elements.select.multitab || !BING_AUTOMATOR.elements.span.apiKeyStatus ||
            !BING_AUTOMATOR.elements.input.apiKey || !BING_AUTOMATOR.elements.input.rememberApiKey ||
            !BING_AUTOMATOR.elements.button.setApiKey || !BING_AUTOMATOR.elements.button.clearApiKey) {
            console.error("One or more essential elements not found on the page. Aborting initialization.");
            alert("页面元素加载不完整，请刷新重试。");
            return;
        }


        // 加载 API Key (现在是 async)
        await BING_AUTOMATOR.apiKeyUtils.loadFromStorage();

        // 加载搜索设置
        BING_AUTOMATOR.cookies.loadSettings();

        // 事件监听器
        BING_AUTOMATOR.elements.select.limit.addEventListener("change", () => {
            BING_AUTOMATOR.cookies.set("_search_limit", BING_AUTOMATOR.elements.select.limit.value);
            location.reload();
        });
        BING_AUTOMATOR.elements.select.interval.addEventListener("change", () => {
            BING_AUTOMATOR.cookies.set("_search_interval", BING_AUTOMATOR.elements.select.interval.value);
            location.reload();
        });
        BING_AUTOMATOR.elements.select.multitab.addEventListener("change", () => {
            BING_AUTOMATOR.cookies.set("_multitab_mode", BING_AUTOMATOR.elements.select.multitab.value);
            location.reload();
        });
        BING_AUTOMATOR.elements.button.start.addEventListener("click", BING_AUTOMATOR.start);
        BING_AUTOMATOR.elements.button.stop.addEventListener("click", () => BING_AUTOMATOR.stop(false));
        BING_AUTOMATOR.elements.button.setApiKey.addEventListener("click", BING_AUTOMATOR.apiKeyUtils.handleInput);
        BING_AUTOMATOR.elements.button.clearApiKey.addEventListener("click", BING_AUTOMATOR.apiKeyUtils.clearStoredKey);

        console.log("Bing Automator Ready.");
    }
};

// DOM 加载完成后执行初始化 (使用更健壮的方式)
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", BING_AUTOMATOR.init);
} else {
    // DOMContentLoaded 已经发生
    BING_AUTOMATOR.init();
}