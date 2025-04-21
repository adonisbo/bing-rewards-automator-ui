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
             help: null
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
        loadFromStorage: async () => {
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
                    await BING_AUTOMATOR.generateTemporaryWordList();
                } else {
                    BING_AUTOMATOR.apiKeyStored = false;
                    if (BING_AUTOMATOR.elements.input.apiKey) BING_AUTOMATOR.elements.input.apiKey.placeholder = "输入您的 API Key";
                    if (BING_AUTOMATOR.elements.button.start) BING_AUTOMATOR.elements.button.start.disabled = true;
                    BING_AUTOMATOR.apiKeyUtils.updateStatus("未设置 API Key", "warning");
                    console.log("No API Key found in LocalStorage.");
                }
            } catch (e) {
                console.error("Error loading API Key from LocalStorage:", e);
                BING_AUTOMATOR.apiKeyUtils.updateStatus("加载 Key 失败", "error");
            }
        },
        handleInput: async () => {
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
            BING_AUTOMATOR.apiKeyUtils.updateStatus("正在验证 Key...", "info");

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
                    return;
                }
            } else {
                try {
                    localStorage.removeItem("googleApiKey");
                    console.log("API Key removed from LocalStorage (if existed).");
                    BING_AUTOMATOR.elements.input.apiKey.placeholder = "输入您的 API Key";
                } catch (e) { console.error("Error removing API Key from LocalStorage:", e); }
                console.log("API Key set for current session only.");
            }

            const generated = await BING_AUTOMATOR.generateTemporaryWordList();
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
                 if (BING_AUTOMATOR.elements.input.apiKey) {
                     BING_AUTOMATOR.elements.input.apiKey.value = "";
                     BING_AUTOMATOR.elements.input.apiKey.placeholder = "输入您的 API Key";
                 }
                 if (BING_AUTOMATOR.elements.input.rememberApiKey) {
                     BING_AUTOMATOR.elements.input.rememberApiKey.checked = false;
                 }
                 if (BING_AUTOMATOR.elements.button.start) BING_AUTOMATOR.elements.button.start.disabled = true;
                 BING_AUTOMATOR.temporaryWordList = [];
                 BING_AUTOMATOR.availableWordsThisSession = []; // 清空会话词库
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
                        if (!BING_AUTOMATOR.search.isRunning || !BING_AUTOMATOR.elements.div.timer) {
                            clearInterval(BING_AUTOMATOR.search.engine.timer.intervalId);
                            if (BING_AUTOMATOR.elements.div.timer) BING_AUTOMATOR.elements.div.timer.innerHTML = `自动搜索已停止`;
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
                             clearInterval(BING_AUTOMATOR.search.engine.timer.intervalId);
                             BING_AUTOMATOR.search.engine.timer.intervalId = null;
                        } else {
                             timerText += `随机间隔模式，无法预估完成时间`;
                        }
                        BING_AUTOMATOR.elements.div.timer.innerHTML = timerText;
                    }, 1000);
                },
                // 修改: 修复了函数定义位置的 Bug
                stopDisplayUpdater: () => {
                     if (BING_AUTOMATOR.search.engine.timer.intervalId) {
                        clearInterval(BING_AUTOMATOR.search.engine.timer.intervalId);
                        BING_AUTOMATOR.search.engine.timer.intervalId = null;
                     }
                     if (BING_AUTOMATOR.elements.div.timer) { // 检查元素是否存在
                         BING_AUTOMATOR.elements.div.timer.innerHTML = `自动搜索已停止`;
                     }
                }
            }, // timer 对象结束
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
                             BING_AUTOMATOR.search.stop();
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
            } // output 对象结束
        } // engine 对象结束
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
        // 修改: 更新 Prompt 主题和数量要求
        const prompt = `请生成一个包含精确 200 个中文或英文词语/短语的列表，主题围绕“体育明星”、“体育项目”、“户外运动用品”、“最近热搜新闻”、“宠物玩具和用品”。
要求：
1. 列表包含中文和英文词语/短语。
2. 每个词语或短语单独一行。
3. 不要包含任何引号、括号、书名号或其他特殊标点符号。
4. 确保内容积极、健康、安全，不包含任何与色情、暴力、犯罪、仇恨言论、危险活动或政治敏感相关的内容。
5. 词语或短语可以是名称、术语、地点、物品等。
6. 尽量多样化，避免重复。
7. 只输出列表，不要包含任何其他说明文字或编号。
8. 数量必须是 200 个。`;
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            ],
             generationConfig: { maxOutputTokens: 8192 } // 保持足够大的 Token 限制
        };

        try {
            const response = await fetch(API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
            if (!response.ok) { /* ... (错误处理不变) ... */ BING_AUTOMATOR.temporaryWordList = []; return false; }
            const data = await response.json();
            if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) { /* ... (安全阻止处理不变) ... */ BING_AUTOMATOR.temporaryWordList = []; return false; }

            const textResult = data.candidates[0].content.parts[0].text;
            let words = textResult.split('\n').map(word => word.trim()).filter(word => word.length > 1 && word.length < 100);

            // 修改: 严格截取前 200 个词
            if (words.length > 200) {
                words = words.slice(0, 200);
                console.log(`Generated ${words.length} words (originally more), truncated to 200.`);
            } else if (words.length < 200) {
                 console.warn(`Generated only ${words.length} words, less than the requested 200.`);
                 // 可以选择是否提示用户数量不足
            }

            if (words.length > 0) {
                BING_AUTOMATOR.temporaryWordList = words;
                BING_AUTOMATOR.apiKeyUtils.updateStatus(`✓ 已生成 ${words.length} 词`, "success"); // 显示实际数量
                console.log(`Successfully generated ${words.length} words.`);
                if (BING_AUTOMATOR.elements.button.start) BING_AUTOMATOR.elements.button.start.disabled = false;
                return true;
            } else {
                console.warn("Generated word list is empty after processing.");
                BING_AUTOMATOR.apiKeyUtils.updateStatus("生成词库为空", "warning");
                BING_AUTOMATOR.temporaryWordList = [];
                return false;
            }
        } catch (error) { /* ... (网络错误处理不变) ... */ BING_AUTOMATOR.temporaryWordList = []; return false;
        } finally {
            BING_AUTOMATOR.isGeneratingWords = false;
            if (!BING_AUTOMATOR.search.isRunning && BING_AUTOMATOR.elements.button.start) {
                 BING_AUTOMATOR.elements.button.start.disabled = (BING_AUTOMATOR.temporaryWordList.length === 0);
             }
        }
    },

    // 搜索执行
    executeSearch: (index = 1) => {
        if (!BING_AUTOMATOR.search.isRunning || index > BING_AUTOMATOR.search.limit) { /* ... (结束逻辑不变) ... */ return; }
        const term = BING_AUTOMATOR.search.getRandomSearchTerm(); // 使用去重逻辑
        if (term === null) { /* ... (词库耗尽处理不变) ... */ return; }
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
        BING_AUTOMATOR.search.currentTimeoutId = setTimeout(() => { BING_AUTOMATOR.executeSearch(index + 1); }, nextDelay);
    },

    // 开始搜索
    start: () => {
        console.log("Start button clicked, executing BING_AUTOMATOR.start...");
        if (BING_AUTOMATOR.search.isRunning) { console.log("Search is already running."); return; }
        if (!BING_AUTOMATOR.elements.button.start || !BING_AUTOMATOR.elements.button.stop) { console.error("Start or Stop button not found."); return; }
        if (!BING_AUTOMATOR.temporaryWordList || BING_AUTOMATOR.temporaryWordList.length === 0) { alert("请先设置有效的 Google AI API Key 并等待临时词库生成成功后再开始搜索。"); console.error("Cannot start search: Temporary word list is empty."); return; }

        console.log("Starting auto search...");
        BING_AUTOMATOR.search.isRunning = true;
        BING_AUTOMATOR.availableWordsThisSession = [...BING_AUTOMATOR.temporaryWordList]; // 创建本次会话可用词库副本
        console.log(`Using a pool of ${BING_AUTOMATOR.availableWordsThisSession.length} words for this session.`);

        BING_AUTOMATOR.elements.button.start.style.display = "none";
        BING_AUTOMATOR.elements.button.stop.style.display = "inline-block";
        if (BING_AUTOMATOR.search.currentTimeoutId) { clearTimeout(BING_AUTOMATOR.search.currentTimeoutId); }
        BING_AUTOMATOR.search.engine.timer.stopDisplayUpdater(); // 确保旧计时器显示停止
        BING_AUTOMATOR.executeSearch(1);
    },

    // 停止搜索
    stop: (completed = false) => { /* ... (逻辑不变) ... */ },

    // 更新设置显示
    updateSettingsDisplay: () => { /* ... (逻辑不变) ... */ },

    // 初始化
    init: async () => {
        console.log("Bing Automator Initializing...");
        try { if (document.getElementById('modal-help')) { BING_AUTOMATOR.elements.modal.help = new bootstrap.Modal(document.getElementById('modal-help'), {}); } else { console.warn("Help modal element not found."); } } catch(e) { console.error("Error initializing Bootstrap modal:", e); }
        if (!BING_AUTOMATOR.elements.button.start || !BING_AUTOMATOR.elements.button.stop || !BING_AUTOMATOR.elements.select.limit || !BING_AUTOMATOR.elements.select.interval || !BING_AUTOMATOR.elements.select.multitab || !BING_AUTOMATOR.elements.span.apiKeyStatus || !BING_AUTOMATOR.elements.input.apiKey || !BING_AUTOMATOR.elements.input.rememberApiKey || !BING_AUTOMATOR.elements.button.setApiKey || !BING_AUTOMATOR.elements.button.clearApiKey) { console.error("One or more essential elements not found. Aborting."); alert("页面元素加载不完整，请刷新重试。"); return; }

        await BING_AUTOMATOR.apiKeyUtils.loadFromStorage(); // 等待 Key 加载和可能的词库生成
        BING_AUTOMATOR.cookies.loadSettings();

        // 事件监听器
        BING_AUTOMATOR.elements.select.limit.addEventListener("change", () => { BING_AUTOMATOR.cookies.set("_search_limit", BING_AUTOMATOR.elements.select.limit.value); location.reload(); });
        BING_AUTOMATOR.elements.select.interval.addEventListener("change", () => { BING_AUTOMATOR.cookies.set("_search_interval", BING_AUTOMATOR.elements.select.interval.value); location.reload(); });
        BING_AUTOMATOR.elements.select.multitab.addEventListener("change", () => { BING_AUTOMATOR.cookies.set("_multitab_mode", BING_AUTOMATOR.elements.select.multitab.value); location.reload(); });
        BING_AUTOMATOR.elements.button.start.addEventListener("click", BING_AUTOMATOR.start);
        BING_AUTOMATOR.elements.button.stop.addEventListener("click", () => BING_AUTOMATOR.stop(false));
        BING_AUTOMATOR.elements.button.setApiKey.addEventListener("click", BING_AUTOMATOR.apiKeyUtils.handleInput);
        BING_AUTOMATOR.elements.button.clearApiKey.addEventListener("click", BING_AUTOMATOR.apiKeyUtils.clearStoredKey);

        console.log("Bing Automator Ready.");
    }
};

// DOM 加载完成后执行初始化
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", BING_AUTOMATOR.init);
} else {
    BING_AUTOMATOR.init();
}