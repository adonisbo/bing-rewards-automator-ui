// 使用严格模式
"use strict";

// 定义主对象
const BING_AUTOMATOR = {
    apiKey: null,
    apiKeyStored: false,
    temporaryWordList: [],
    isGeneratingWords: false,
    availableWordsThisSession: [],

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
            apiKeyStatus: document.getElementById("api-key-status")
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

    // Cookie 操作
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
             console.log("Executing loadSettings..."); // 调试日志
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
             // 确保调用 updateSettingsDisplay
             console.log("Calling updateSettingsDisplay from loadSettings.");
             BING_AUTOMATOR.updateSettingsDisplay();
        }
    },

    // API Key 处理
    apiKeyUtils: {
        loadFromStorage: async () => {
            console.log("Executing loadFromStorage..."); // 调试日志
            try {
                const storedKey = localStorage.getItem("googleApiKey");
                // 增加按钮检查
                if (storedKey && BING_AUTOMATOR.elements.input.apiKey && BING_AUTOMATOR.elements.button.setApiKey) {
                    BING_AUTOMATOR.apiKey = storedKey;
                    BING_AUTOMATOR.apiKeyStored = true;
                    BING_AUTOMATOR.elements.input.apiKey.placeholder = "**** 已记住 Key ****";
                    BING_AUTOMATOR.elements.input.apiKey.value = "";
                    if (BING_AUTOMATOR.elements.input.rememberApiKey) BING_AUTOMATOR.elements.input.rememberApiKey.checked = true;
                    // 不在这里禁用按钮，移到 init 末尾处理
                    console.log("API Key loaded from LocalStorage.");
                    BING_AUTOMATOR.apiKeyUtils.updateStatus("✓ Key 已加载", "success");
                    await BING_AUTOMATOR.generateTemporaryWordList(); // 使用 await
                } else {
                    BING_AUTOMATOR.apiKeyStored = false;
                    if (BING_AUTOMATOR.elements.input.apiKey) BING_AUTOMATOR.elements.input.apiKey.placeholder = "输入您的 API Key";
                    if (BING_AUTOMATOR.elements.button.start) BING_AUTOMATOR.elements.button.start.disabled = true;
                    // 不在这里启用按钮，移到 init 末尾处理
                    BING_AUTOMATOR.apiKeyUtils.updateStatus("未设置 API Key", "warning");
                    console.log("No API Key found in LocalStorage.");
                }
            } catch (e) {
                console.error("Error loading API Key from LocalStorage:", e);
                BING_AUTOMATOR.apiKeyUtils.updateStatus("加载 Key 失败", "error");
            }
             console.log("Finished loadFromStorage."); // 调试日志
        },
        handleInput: async () => {
            if (!BING_AUTOMATOR.elements.input.apiKey || !BING_AUTOMATOR.elements.input.rememberApiKey || !BING_AUTOMATOR.elements.button.setApiKey) return;
            const inputKey = BING_AUTOMATOR.elements.input.apiKey.value.trim();
            const remember = BING_AUTOMATOR.elements.input.rememberApiKey.checked;

            if (!inputKey) { alert("请输入有效的 Google AI API Key。"); BING_AUTOMATOR.apiKeyUtils.updateStatus("请输入 Key", "warning"); return; }

            BING_AUTOMATOR.apiKey = inputKey;
            BING_AUTOMATOR.apiKeyStored = remember;
            BING_AUTOMATOR.apiKeyUtils.updateStatus("正在验证 Key...", "info");
            BING_AUTOMATOR.elements.button.setApiKey.disabled = true; // 开始处理时禁用按钮

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
                    if(BING_AUTOMATOR.elements.input.rememberApiKey) BING_AUTOMATOR.elements.input.rememberApiKey.checked = false;
                    BING_AUTOMATOR.apiKeyUtils.updateStatus("记住 Key 失败", "error");
                    BING_AUTOMATOR.elements.button.setApiKey.disabled = false; // 出错时恢复按钮可用
                    return;
                }
            } else {
                try {
                    localStorage.removeItem("googleApiKey");
                    console.log("API Key removed from LocalStorage (if existed).");
                    if(BING_AUTOMATOR.elements.input.apiKey) BING_AUTOMATOR.elements.input.apiKey.placeholder = "输入您的 API Key";
                } catch (e) { console.error("Error removing API Key from LocalStorage:", e); }
                console.log("API Key set for current session only.");
            }

            const generated = await BING_AUTOMATOR.generateTemporaryWordList();
            // 按钮状态在 finally 中处理
            if (generated) {
                 alert("API Key 已设置并成功生成词库！");
            } else {
                 alert("API Key 已设置，但生成词库失败，请检查 Key 或网络。");
            }
        },
        clearStoredKey: () => {
             try {
                 localStorage.removeItem("googleApiKey");
                 BING_AUTOMATOR.apiKey = null;
                 BING_AUTOMATOR.apiKeyStored = false;
                 if (BING_AUTOMATOR.elements.input.apiKey) { BING_AUTOMATOR.elements.input.apiKey.value = ""; BING_AUTOMATOR.elements.input.apiKey.placeholder = "输入您的 API Key"; }
                 if (BING_AUTOMATOR.elements.input.rememberApiKey) { BING_AUTOMATOR.elements.input.rememberApiKey.checked = false; }
                 if (BING_AUTOMATOR.elements.button.start) BING_AUTOMATOR.elements.button.start.disabled = true;
                 if (BING_AUTOMATOR.elements.button.setApiKey) BING_AUTOMATOR.elements.button.setApiKey.disabled = false; // 清除后启用确定按钮
                 BING_AUTOMATOR.temporaryWordList = [];
                 BING_AUTOMATOR.availableWordsThisSession = [];
                 BING_AUTOMATOR.apiKeyUtils.updateStatus("Key 已清除", "info");
                 alert("已清除记住的 API Key。");
                 console.log("Stored API Key cleared.");
             } catch (e) {
                 console.error("Error clearing stored API Key:", e);
                 alert("清除 API Key 时出错。");
                 BING_AUTOMATOR.apiKeyUtils.updateStatus("清除 Key 失败", "error");
             }
        },
        updateStatus: (message, type = "info") => {
            if (!BING_AUTOMATOR.elements.span.apiKeyStatus) return;
            const span = BING_AUTOMATOR.elements.span.apiKeyStatus;
            span.textContent = message;
            span.className = "api-key-label ms-2";
            switch (type) {
                case "success": span.classList.add("text-success"); break;
                case "warning": span.classList.add("text-warning"); break;
                case "error": span.classList.add("text-danger"); break;
                case "info": default: span.classList.add("text-info"); break;
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

        getRandomSearchTerm: () => {
            if (!BING_AUTOMATOR.availableWordsThisSession || BING_AUTOMATOR.availableWordsThisSession.length === 0) {
                console.warn("Word list for this session is empty.");
                return null;
            }
            const randomIndex = Math.floor(Math.random() * BING_AUTOMATOR.availableWordsThisSession.length);
            const word = BING_AUTOMATOR.availableWordsThisSession[randomIndex];
            BING_AUTOMATOR.availableWordsThisSession.splice(randomIndex, 1);
            return word;
        },

        getRandomFormParam: () => {
            const params = BING_AUTOMATOR.search.formParams;
            return params[Math.floor(Math.random() * params.length)];
        },
        engine: {
            progress: {
                update: (currentIndex) => {
                    if (!BING_AUTOMATOR.elements.span.progress) return;
                    const limit = BING_AUTOMATOR.search.limit;
                    const progressText = `(${currentIndex < 10 ? "0" + currentIndex : currentIndex}/${limit < 10 ? "0" + limit : limit})`;
                    document.title = `${progressText} - Bing 自动化助手运行中`;
                    BING_AUTOMATOR.elements.span.progress.innerText = progressText;
                }
            },
            timer: {
                estimatedNextTime: null,
                estimatedCompleteTime: null,
                intervalId: null,

                toClockFormat: (milliseconds, showHours = false) => {
                    if (milliseconds < 0) milliseconds = 0;
                    let totalSeconds = Math.floor(milliseconds / 1000);
                    let sec = totalSeconds % 60;
                    let totalMinutes = Math.floor(totalSeconds / 60);
                    let min = totalMinutes % 60;
                    let hrs = Math.floor(totalMinutes / 60);
                    return `${showHours ? String(hrs).padStart(2, '0') + ":" : ""}${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
                },
                updateEstimatedTime: (currentIndex) => {
                    const now = new Date().getTime();
                    const interval = BING_AUTOMATOR.search.interval;
                    const remainingSearches = BING_AUTOMATOR.search.limit - currentIndex;
                    if (interval === 9999) {
                        BING_AUTOMATOR.search.engine.timer.estimatedNextTime = now + (10 + Math.random() * 50) * 1000;
                        BING_AUTOMATOR.search.engine.timer.estimatedCompleteTime = null;
                    } else {
                        BING_AUTOMATOR.search.engine.timer.estimatedNextTime = now + interval;
                        BING_AUTOMATOR.search.engine.timer.estimatedCompleteTime = now + (interval * remainingSearches);
                    }
                    if (currentIndex === BING_AUTOMATOR.search.limit) {
                        BING_AUTOMATOR.search.engine.timer.estimatedNextTime = now;
                    }
                },
                runDisplayUpdater: () => {
                    if (BING_AUTOMATOR.search.engine.timer.intervalId) { clearInterval(BING_AUTOMATOR.search.engine.timer.intervalId); }
                    BING_AUTOMATOR.search.engine.timer.intervalId = setInterval(() => {
                        if (!BING_AUTOMATOR.search.isRunning) {
                            clearInterval(BING_AUTOMATOR.search.engine.timer.intervalId);
                            BING_AUTOMATOR.search.engine.timer.intervalId = null;
                            if (BING_AUTOMATOR.elements.div.timer) BING_AUTOMATOR.elements.div.timer.innerHTML = `自动搜索已完成或停止`;
                            console.log("Timer display updater stopped because search is not running.");
                            return;
                        }
                        const now = new Date().getTime();
                        const nextMs = BING_AUTOMATOR.search.engine.timer.estimatedNextTime - now;
                        const completeMs = BING_AUTOMATOR.search.engine.timer.estimatedCompleteTime ? BING_AUTOMATOR.search.engine.timer.estimatedCompleteTime - now : null;
                        let timerText = "<strong>自动搜索运行中:</strong> ";
                        if (BING_AUTOMATOR.search.interval === 9999) {
                            timerText += `随机间隔 (10~60秒)`;
                        } else if (completeMs !== null && completeMs >= 0) {
                            timerText += `${nextMs >= 0 ? `下次搜索倒计时 ${BING_AUTOMATOR.search.engine.timer.toClockFormat(nextMs)}` : "执行最后搜索中..."}`;
                            timerText += `, 预计剩余 ${BING_AUTOMATOR.search.engine.timer.toClockFormat(completeMs, true)}`;
                        } else if (completeMs !== null && completeMs < 0) {
                             timerText += `正在完成最后的搜索...`;
                        } else {
                             timerText += `随机间隔模式，无法预估完成时间`;
                        }
                        BING_AUTOMATOR.elements.div.timer.innerHTML = timerText;
                    }, 1000);
                },
                stopDisplayUpdater: () => {
                     if (BING_AUTOMATOR.search.engine.timer.intervalId) {
                        clearInterval(BING_AUTOMATOR.search.engine.timer.intervalId);
                        BING_AUTOMATOR.search.engine.timer.intervalId = null;
                     }
                     if (BING_AUTOMATOR.elements.div.timer) {
                         BING_AUTOMATOR.elements.div.timer.innerHTML = `自动搜索已停止`;
                     }
                }
            },
            output: {
                openWindow: (url, interval) => {
                    try {
                        if (BING_AUTOMATOR.search.searchWindow && !BING_AUTOMATOR.search.searchWindow.closed) { BING_AUTOMATOR.search.searchWindow.close(); }
                        const searchWindow = window.open(url, '_blank');
                        BING_AUTOMATOR.search.searchWindow = searchWindow;
                        if (searchWindow) {
                            const closeDelay = Math.max(500, (interval <= 10000 && interval !== 9999 ? interval : 10000) - 500);
                            setTimeout(() => { if (searchWindow && !searchWindow.closed) { searchWindow.close(); } }, closeDelay);
                        } else {
                             console.warn("Popup blocked? Could not open search window.");
                             alert("浏览器阻止了弹出窗口，请允许本站点的弹出窗口以使用多标签模式。将切换回单标签模式。");
                             if(BING_AUTOMATOR.elements.select.multitab) BING_AUTOMATOR.elements.select.multitab.value = "false";
                             BING_AUTOMATOR.cookies.set("_multitab_mode", "false");
                             BING_AUTOMATOR.search.stop(); // 调用停止
                        }
                    } catch (e) { console.error("Error opening search window:", e); }
                },
                addIframe: (url, term, index) => {
                    try {
                        if (!BING_AUTOMATOR.elements.div.bing) return;
                        const iframe = document.createElement("iframe");
                        iframe.setAttribute("src", url);
                        iframe.setAttribute("title", `Search: ${term}`);
                        iframe.setAttribute("style", "display: none;");
                        if (BING_AUTOMATOR.elements.div.bing.firstChild) { BING_AUTOMATOR.elements.div.bing.removeChild(BING_AUTOMATOR.elements.div.bing.firstChild); }
                        BING_AUTOMATOR.elements.div.bing.appendChild(iframe);
                    } catch (e) { console.error("Error adding iframe:", e); }
                }
            }
        },
        // --- 修改: 将 start 和 stop 函数移到 search 对象内部 ---
        start: () => {
            console.log("Start button clicked, executing BING_AUTOMATOR.search.start...");
            if (BING_AUTOMATOR.search.isRunning) { console.log("Search is already running."); return; }
            if (!BING_AUTOMATOR.elements.button.start || !BING_AUTOMATOR.elements.button.stop) { console.error("Start or Stop button not found."); return; }
            if (!BING_AUTOMATOR.temporaryWordList || BING_AUTOMATOR.temporaryWordList.length === 0) { alert("请先设置有效的 Google AI API Key 并等待临时词库生成成功后再开始搜索。"); console.error("Cannot start search: Temporary word list is empty."); return; }

            console.log("Starting auto search...");
            BING_AUTOMATOR.search.isRunning = true;
            BING_AUTOMATOR.availableWordsThisSession = [...BING_AUTOMATOR.temporaryWordList];
            console.log(`Using a pool of ${BING_AUTOMATOR.availableWordsThisSession.length} words for this session.`);

            BING_AUTOMATOR.elements.button.start.style.display = "none";
            BING_AUTOMATOR.elements.button.stop.style.display = "inline-block";
            if (BING_AUTOMATOR.search.currentTimeoutId) { clearTimeout(BING_AUTOMATOR.search.currentTimeoutId); }
            BING_AUTOMATOR.search.engine.timer.stopDisplayUpdater();
            BING_AUTOMATOR.executeSearch(1); // 调用顶层的 executeSearch
        },

        stop: (completed = false) => {
            console.log(`Stopping auto search... Completed: ${completed}`);
            BING_AUTOMATOR.search.isRunning = false; // 首先设置状态

            if (BING_AUTOMATOR.search.currentTimeoutId) {
                clearTimeout(BING_AUTOMATOR.search.currentTimeoutId);
                BING_AUTOMATOR.search.currentTimeoutId = null;
                console.log("Cleared scheduled next search timeout.");
            }
            if (BING_AUTOMATOR.search.searchWindow && !BING_AUTOMATOR.search.searchWindow.closed) {
                BING_AUTOMATOR.search.searchWindow.close();
                BING_AUTOMATOR.search.searchWindow = null;
                console.log("Closed open search window (if any).");
            }

            BING_AUTOMATOR.search.engine.timer.stopDisplayUpdater(); // 停止计时器显示更新
            console.log("Stopped timer display updater.");

            // 更新按钮状态
            if (BING_AUTOMATOR.elements.button.start && BING_AUTOMATOR.elements.button.stop) {
                BING_AUTOMATOR.elements.button.start.style.display = "inline-block";
                BING_AUTOMATOR.elements.button.stop.style.display = "none";
                BING_AUTOMATOR.elements.button.start.disabled = (!BING_AUTOMATOR.temporaryWordList || BING_AUTOMATOR.temporaryWordList.length === 0);
                console.log(`Stop function: Start button final state (disabled: ${BING_AUTOMATOR.elements.button.start.disabled})`);
            }

            // --- 修改: 根据 completed 参数决定后续操作 ---
            if (completed) {
                // 正常完成所有搜索次数
                console.log("Search completed normally. Redirecting to points breakdown page...");
                // 直接将当前窗口重定向到积分页面
                window.location.href = "https://rewards.bing.com/status/pointsbreakdown";
            } else {
                // 手动点击停止按钮
                console.log("Search stopped manually. Reloading page...");
                // 手动停止时，刷新当前页面以重置状态
                location.reload();
            }
            // ---------------------------------------------
        }
        // --- 函数移动结束 ---
    }, // search 对象结束

    // Google AI 词库生成
    generateTemporaryWordList: async () => {
        if (BING_AUTOMATOR.isGeneratingWords) { console.log("Already generating word list..."); BING_AUTOMATOR.apiKeyUtils.updateStatus("正在生成...", "info"); return false; }
        if (!BING_AUTOMATOR.apiKey) { console.error("API Key is not set for word generation."); BING_AUTOMATOR.apiKeyUtils.updateStatus("请先设置 Key", "warning"); if (BING_AUTOMATOR.elements.button.start) BING_AUTOMATOR.elements.button.start.disabled = true; return false; }

        BING_AUTOMATOR.isGeneratingWords = true;
        BING_AUTOMATOR.apiKeyUtils.updateStatus("生成词库中...", "info");
        console.log("Generating temporary word list using Google AI...");
        if(BING_AUTOMATOR.elements.button.start) BING_AUTOMATOR.elements.button.start.disabled = true;

        const model = 'gemini-1.5-flash';
        const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${BING_AUTOMATOR.apiKey}`;
        const prompt = `请生成一个包含精确 200 个中文或英文词语/短语的列表，主题围绕“体育明星”、“体育项目”、“户外运动用品”、“最近热搜新闻”、“宠物玩具和用品”。要求：1. 列表包含中文和英文词语/短语。2. 每个词语或短语单独一行。3. 不要包含任何引号、括号、书名号或其他特殊标点符号。4. 确保内容积极、健康、安全，不包含任何与色情、暴力、犯罪、仇恨言论、危险活动或政治敏感相关的内容。5. 词语或短语可以是名称、术语、地点、物品等。6. 尽量多样化，避免重复。7. 只输出列表，不要包含任何其他说明文字或编号。8. 数量必须是 200 个。`;
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" } ],
             generationConfig: { maxOutputTokens: 8192 }
        };

        try {
            const response = await fetch(API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
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
                 if (data.candidates?.[0]?.content?.parts?.[0]?.text) { /* 继续处理部分内容 */ }
                 else { BING_AUTOMATOR.temporaryWordList = []; return false; }
            }

            const textResult = data.candidates[0].content.parts[0].text;
            let words = textResult.split('\n').map(word => word.trim()).filter(word => word.length > 1 && word.length < 100);

            if (words.length > 200) {
                words = words.slice(0, 200);
                console.log(`Generated ${words.length} words (originally more), truncated to 200.`);
            } else if (words.length < 200) {
                 console.warn(`Generated only ${words.length} words, less than the requested 200.`);
            }

            if (words.length > 0) {
                BING_AUTOMATOR.temporaryWordList = words;
                BING_AUTOMATOR.apiKeyUtils.updateStatus(`✓ 已生成 ${words.length} 词`, "success");
                console.log(`Successfully generated ${words.length} words.`);
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
            if (BING_AUTOMATOR.elements.button.start) {
                 BING_AUTOMATOR.elements.button.start.disabled = (BING_AUTOMATOR.temporaryWordList.length === 0);
             }
             if (BING_AUTOMATOR.elements.button.setApiKey) {
                 BING_AUTOMATOR.elements.button.setApiKey.disabled = BING_AUTOMATOR.apiKeyStored;
             }
             console.log("Finished generateTemporaryWordList. Start button disabled:", BING_AUTOMATOR.elements.button.start?.disabled, "Set API Key button disabled:", BING_AUTOMATOR.elements.button.setApiKey?.disabled);
        }
    },

    // 搜索执行 (修改: 调用 search.stop)
    executeSearch: (index = 1) => {
        console.log(`Entering executeSearch with index: ${index}, limit: ${BING_AUTOMATOR.search.limit}, isRunning: ${BING_AUTOMATOR.search.isRunning}`);

        // 修改: 将停止检查放在前面
        if (!BING_AUTOMATOR.search.isRunning) {
             console.log("Search stopped externally (isRunning is false). Stopping timer display.");
             BING_AUTOMATOR.search.engine.timer.stopDisplayUpdater();
             return;
        }
        if (index > BING_AUTOMATOR.search.limit) {
            console.log(`Search limit reached (index ${index} > limit ${BING_AUTOMATOR.search.limit}). Calling search.stop(true).`);
            BING_AUTOMATOR.search.stop(true); // *** 修改: 调用 search 对象下的 stop ***
            return;
        }

        const term = BING_AUTOMATOR.search.getRandomSearchTerm();
        if (term === null) { console.warn(`No more unique words available at search ${index}. Stopping.`); alert(`临时词库已用完（共 ${BING_AUTOMATOR.temporaryWordList.length} 个），搜索提前结束。`); BING_AUTOMATOR.search.stop(true); return; } // *** 修改: 调用 search 对象下的 stop ***
        const formParam = BING_AUTOMATOR.search.getRandomFormParam();
        const url = `https://www.bing.com/search?q=${encodeURIComponent(term.toLowerCase())}&FORM=${formParam}`;
        const interval = BING_AUTOMATOR.search.interval;
        let nextDelay = interval;
        if (interval === 9999) { nextDelay = (10 + Math.floor(Math.random() * 51)) * 1000; }
        console.log(`Executing search ${index}/${BING_AUTOMATOR.search.limit}: ${term} (Delay: ${nextDelay/1000}s)`);
        BING_AUTOMATOR.search.engine.progress.update(index);
        BING_AUTOMATOR.search.engine.timer.updateEstimatedTime(index);
        if(index === 1) { BING_AUTOMATOR.search.engine.timer.runDisplayUpdater(); }
        if (BING_AUTOMATOR.search.multitab) { BING_AUTOMATOR.search.engine.output.openWindow(url, interval); }
        else { BING_AUTOMATOR.search.engine.output.addIframe(url, term, index); }

        // 只有在搜索仍在进行时才设置下一个 Timeout
        if (BING_AUTOMATOR.search.isRunning) {
             console.log(`Setting timeout for next search (index ${index + 1}) with delay ${nextDelay}ms`);
             BING_AUTOMATOR.search.currentTimeoutId = setTimeout(() => {
                 BING_AUTOMATOR.executeSearch(index + 1); // 保持调用顶层的 executeSearch
             }, nextDelay);
        } else {
             console.log("Search stopped before setting next timeout.");
        }
    },

    // 更新设置显示
    updateSettingsDisplay: () => {
        console.log("Attempting to update settings display..."); // 调试日志
        try {
            const { limit, interval, multitab } = BING_AUTOMATOR.elements.select;
            const settingsDiv = BING_AUTOMATOR.elements.div.settings;
            console.log("Checking elements:", { limit, interval, multitab, settingsDiv }); // 调试日志
            if (!limit || !interval || !multitab || !settingsDiv) { console.error("Settings display elements not fully available."); settingsDiv.innerHTML = `错误: 设置元素丢失`; return; }
            console.log("Select elements found. Checking options and selectedIndex..."); // 调试日志
            console.log("Limit:", { selectedIndex: limit.selectedIndex, optionsLength: limit.options.length }); // 调试日志
            console.log("Interval:", { selectedIndex: interval.selectedIndex, optionsLength: interval.options.length }); // 调试日志
            console.log("Multitab:", { selectedIndex: multitab.selectedIndex, optionsLength: multitab.options.length }); // 调试日志
            if (limit.selectedIndex < 0 || interval.selectedIndex < 0 || multitab.selectedIndex < 0) { console.error("One or more select elements have invalid selectedIndex (-1)."); settingsDiv.innerHTML = `错误: 无效设置选项`; return; }
            const limitOption = limit.options[limit.selectedIndex];
            const intervalOption = interval.options[interval.selectedIndex];
            const multitabOption = multitab.options[multitab.selectedIndex];
            console.log("Selected options:", { limitOption, intervalOption, multitabOption }); // 调试日志
            if (!limitOption || !intervalOption || !multitabOption) { console.error("Selected options objects not found."); settingsDiv.innerHTML = `错误: 无法读取设置`; return; }
            const limitText = limitOption.text;
            const intervalText = intervalOption.text;
            const multitabText = multitabOption.text;
            console.log("Selected texts:", { limitText, intervalText, multitabText }); // 调试日志
            settingsDiv.innerHTML = `当前设置: ${limitText}, ${intervalText} 间隔, 多标签模式 ${multitabText}`;
            console.log("Settings display updated successfully."); // 调试日志
        } catch (e) {
            console.error("Error updating settings display:", e);
            if (BING_AUTOMATOR.elements.div.settings) BING_AUTOMATOR.elements.div.settings.innerHTML = `加载设置出错 (异常)`;
        }
    },

    // 初始化
    init: async () => {
        console.log("Bing Automator Initializing...");
        let initSuccess = false;
        try {
            try { if (document.getElementById('modal-help')) { BING_AUTOMATOR.elements.modal.help = new bootstrap.Modal(document.getElementById('modal-help'), {}); } else { console.warn("Help modal element not found."); } } catch(e) { console.error("Error initializing Bootstrap modal:", e); }
            const requiredElements = [ BING_AUTOMATOR.elements.button.start, BING_AUTOMATOR.elements.button.stop, BING_AUTOMATOR.elements.select.limit, BING_AUTOMATOR.elements.select.interval, BING_AUTOMATOR.elements.select.multitab, BING_AUTOMATOR.elements.span.apiKeyStatus, BING_AUTOMATOR.elements.input.apiKey, BING_AUTOMATOR.elements.input.rememberApiKey, BING_AUTOMATOR.elements.button.setApiKey, BING_AUTOMATOR.elements.button.clearApiKey, BING_AUTOMATOR.elements.div.settings ];
            if (requiredElements.some(el => !el)) { throw new Error("One or more essential elements not found on the page."); }

            // 修改: 先绑定事件监听器
            BING_AUTOMATOR.elements.select.limit.addEventListener("change", () => {
                const newLimit = parseInt(BING_AUTOMATOR.elements.select.limit.value, 10);
                BING_AUTOMATOR.search.limit = newLimit;
                BING_AUTOMATOR.cookies.set("_search_limit", newLimit.toString());
                BING_AUTOMATOR.updateSettingsDisplay();
                console.log(`Search limit changed to: ${newLimit}`);
            });
            BING_AUTOMATOR.elements.select.interval.addEventListener("change", () => {
                const newInterval = parseInt(BING_AUTOMATOR.elements.select.interval.value, 10);
                BING_AUTOMATOR.search.interval = newInterval;
                BING_AUTOMATOR.cookies.set("_search_interval", newInterval.toString());
                BING_AUTOMATOR.updateSettingsDisplay();
                console.log(`Search interval changed to: ${newInterval}`);
            });
            BING_AUTOMATOR.elements.select.multitab.addEventListener("change", () => {
                const newMultitab = (BING_AUTOMATOR.elements.select.multitab.value === "true");
                BING_AUTOMATOR.search.multitab = newMultitab;
                BING_AUTOMATOR.cookies.set("_multitab_mode", newMultitab.toString());
                BING_AUTOMATOR.updateSettingsDisplay();
                console.log(`Multitab mode changed to: ${newMultitab}`);
            });
            BING_AUTOMATOR.elements.button.start.addEventListener("click", BING_AUTOMATOR.search.start); // *** 修改: 调用 search.start ***
            BING_AUTOMATOR.elements.button.stop.addEventListener("click", () => BING_AUTOMATOR.search.stop(false)); // *** 修改: 调用 search.stop ***
            BING_AUTOMATOR.elements.button.setApiKey.addEventListener("click", BING_AUTOMATOR.apiKeyUtils.handleInput);
            BING_AUTOMATOR.elements.button.clearApiKey.addEventListener("click", BING_AUTOMATOR.apiKeyUtils.clearStoredKey);
            console.log("Event listeners attached.");

            BING_AUTOMATOR.cookies.loadSettings();
            console.log("Cookie settings loaded.");
            await BING_AUTOMATOR.apiKeyUtils.loadFromStorage();
            console.log("API Key storage loaded.");

            initSuccess = true;

        } catch (error) {
             console.error("Initialization failed:", error);
             alert(`页面初始化失败: ${error.message} 请刷新重试。`);
        } finally {
            if (BING_AUTOMATOR.elements.button.setApiKey) {
                BING_AUTOMATOR.elements.button.setApiKey.disabled = BING_AUTOMATOR.apiKeyStored;
                console.log(`Set API Key button final state (disabled: ${BING_AUTOMATOR.elements.button.setApiKey.disabled})`);
            }
            if (BING_AUTOMATOR.elements.button.start) {
                BING_AUTOMATOR.elements.button.start.disabled = !(initSuccess && BING_AUTOMATOR.temporaryWordList.length > 0);
                 console.log(`Start button final state (disabled: ${BING_AUTOMATOR.elements.button.start.disabled})`);
            }
             console.log("Bing Automator Initialization routine finished.");
        }
    }
};

// DOM 加载完成后执行初始化
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", BING_AUTOMATOR.init);
} else {
    BING_AUTOMATOR.init();
}