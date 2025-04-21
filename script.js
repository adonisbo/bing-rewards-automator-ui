// 使用严格模式，有助于捕捉常见错误
"use strict";

// 定义主对象，用于组织代码
const BING_AUTOMATOR = {
    // 存储对 HTML 元素的引用
    elements: {
        button: {
            start: document.getElementById("btn-start"),
            stop: document.getElementById("btn-stop")
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
            bing: document.getElementById("div-bing") // 用于单标签模式的 iframe 容器
        },
        modal: {
             // 获取模态框本身的引用，用于后续通过 JS 控制显示
             help: new bootstrap.Modal(document.getElementById('modal-help'), {})
        }
    },

    // Cookie 操作相关函数
    cookies: {
        // 设置 Cookie
        set: (name, value, expiresDays = 365) => {
            try {
                let d = new Date();
                d.setTime(d.getTime() + (expiresDays * 24 * 60 * 60 * 1000));
                let expires = "expires=" + d.toUTCString();
                // 确保路径为根路径，以便在整个网站中可用
                document.cookie = name + "=" + value + ";" + expires + ";path=/";
            } catch (e) {
                console.error("Error setting cookie:", e);
            }
        },
        // 获取 Cookie
        get: (name) => {
            let cookieValue = null;
            try {
                let nameEQ = name + "=";
                let ca = document.cookie.split(';');
                for(let i = 0; i < ca.length; i++) {
                    let c = ca[i];
                    while (c.charAt(0) === ' ') {
                        c = c.substring(1, c.length);
                    }
                    if (c.indexOf(nameEQ) === 0) {
                        cookieValue = c.substring(nameEQ.length, c.length);
                        break;
                    }
                }
            } catch (e) {
                console.error("Error getting cookie:", e);
            }
            // 返回与原网站类似的结构，方便后续代码兼容
            return {
                name: name,
                value: cookieValue
            };
        },
        // 加载设置 (从 Cookie 或使用默认值)
        loadSettings: () => {
            let showHelpModal = false; // 标记是否需要显示帮助弹窗

            // 加载并应用“限制次数”设置
            const limitCookie = BING_AUTOMATOR.cookies.get("_search_limit");
            if (limitCookie.value) {
                BING_AUTOMATOR.elements.select.limit.value = limitCookie.value;
                BING_AUTOMATOR.search.limit = parseInt(limitCookie.value, 10);
            } else {
                // Cookie 不存在，使用下拉框默认值并保存 Cookie
                BING_AUTOMATOR.search.limit = parseInt(BING_AUTOMATOR.elements.select.limit.value, 10);
                BING_AUTOMATOR.cookies.set("_search_limit", BING_AUTOMATOR.search.limit.toString());
                showHelpModal = true; // 第一次加载设置，显示帮助
            }

            // 加载并应用“时间间隔”设置
            const intervalCookie = BING_AUTOMATOR.cookies.get("_search_interval");
            if (intervalCookie.value) {
                BING_AUTOMATOR.elements.select.interval.value = intervalCookie.value;
                BING_AUTOMATOR.search.interval = parseInt(intervalCookie.value, 10);
            } else {
                BING_AUTOMATOR.search.interval = parseInt(BING_AUTOMATOR.elements.select.interval.value, 10);
                BING_AUTOMATOR.cookies.set("_search_interval", BING_AUTOMATOR.search.interval.toString());
                showHelpModal = true;
            }

            // 加载并应用“多标签模式”设置
            const multitabCookie = BING_AUTOMATOR.cookies.get("_multitab_mode");
            if (multitabCookie.value) {
                BING_AUTOMATOR.elements.select.multitab.value = multitabCookie.value;
                BING_AUTOMATOR.search.multitab = (multitabCookie.value === "true");
            } else {
                // 尝试检测移动设备来设置默认值 (逻辑可简化，直接用下拉框默认)
                // const isMobile = /Mobi|Android/i.test(navigator.userAgent);
                // BING_AUTOMATOR.elements.select.multitab.value = isMobile ? "true" : "false";
                BING_AUTOMATOR.search.multitab = (BING_AUTOMATOR.elements.select.multitab.value === "true");
                BING_AUTOMATOR.cookies.set("_multitab_mode", BING_AUTOMATOR.search.multitab.toString());
                showHelpModal = true;
            }

            // 检查是否需要显示帮助弹窗 (第一次加载设置时)
            const needHelpCookie = BING_AUTOMATOR.cookies.get("_need_help");
            if (!needHelpCookie.value || showHelpModal) {
                 try {
                    BING_AUTOMATOR.elements.modal.help.show(); // 使用 Bootstrap JS 对象显示模态框
                 } catch(e) {
                    console.error("Error showing help modal:", e);
                 }
                // 设置 Cookie 标记已显示过帮助
                BING_AUTOMATOR.cookies.set("_need_help", "true");
            }

            // 更新设置显示区域的文本
            BING_AUTOMATOR.updateSettingsDisplay();
        }
    },

    // 搜索相关状态和逻辑
    search: {
        limit: 35, // 默认限制次数
        interval: 10000, // 默认间隔时间 (毫秒)
        multitab: false, // 默认多标签模式
        isRunning: false, // 标记搜索是否正在进行
        currentTimeoutId: null, // 存储当前的 setTimeout ID，用于停止
        searchWindow: null, // 存储多标签模式打开的窗口引用
        searchTermsList: [ // 内置搜索词列表 (与原网站类似，但可自定义)
            // 此处省略了原网站超长的列表，使用一些简单的示例代替
            // 您可以根据需要从原网站代码中复制完整的列表，或使用自己的列表
            "天气", "新闻", "翻译", "地图", "图片", "视频",
            "购物", "音乐", "游戏", "旅游", "美食", "健康",
            "科技", "财经", "体育", "娱乐", "汽车", "房产",
            "教育", "招聘", "百科", "问答", "菜谱", "笑话"
            // ... 更多词语 ...
        ],
        formParams: ["QBLH", "QBRE", "HDRSC1", "LGWQS1", "R5FD", "QSRE1"], // FORM 参数列表 (简化版)

        // 生成随机搜索词
        getRandomSearchTerm: () => {
            const list = BING_AUTOMATOR.search.searchTermsList;
            return list[Math.floor(Math.random() * list.length)];
        },

        // 生成随机 FORM 参数
        getRandomFormParam: () => {
            const params = BING_AUTOMATOR.search.formParams;
            return params[Math.floor(Math.random() * params.length)];
        },

        // ... 搜索执行、停止、计时器等函数将在下一部分添加 ...
    },

    // 更新设置显示区域的函数
    updateSettingsDisplay: () => {
        try {
            const limitText = BING_AUTOMATOR.elements.select.limit.options[BING_AUTOMATOR.elements.select.limit.selectedIndex].text;
            const intervalText = BING_AUTOMATOR.elements.select.interval.options[BING_AUTOMATOR.elements.select.interval.selectedIndex].text;
            const multitabText = BING_AUTOMATOR.elements.select.multitab.options[BING_AUTOMATOR.elements.select.multitab.selectedIndex].text;
            BING_AUTOMATOR.elements.div.settings.innerHTML = `当前设置: ${limitText}, ${intervalText} 间隔, 多标签模式 ${multitabText}`;
        } catch (e) {
            console.error("Error updating settings display:", e);
            BING_AUTOMATOR.elements.div.settings.innerHTML = `加载设置出错，请清理浏览器 Cookie 后重试`;
        }
    },

    // 初始化函数
    init: () => {
        console.log("Bing Automator Initializing...");
        BING_AUTOMATOR.cookies.loadSettings(); // 加载设置

        // 为下拉框添加事件监听器，更改设置时保存 Cookie 并重新加载页面
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

        // ... 开始和停止按钮的事件监听器将在下一部分添加 ...

        console.log("Bing Automator Ready.");
    }
};

// 当 DOM 加载完成后执行初始化
document.addEventListener("DOMContentLoaded", BING_AUTOMATOR.init);

// --- JavaScript 代码第二部分 ---

// 扩展 BING_AUTOMATOR 对象，添加搜索执行相关函数
Object.assign(BING_AUTOMATOR.search, {
    // 内部引擎对象，用于组织更具体的搜索操作
    engine: {
        // 更新进度显示
        progress: {
            update: (currentIndex) => {
                const limit = BING_AUTOMATOR.search.limit;
                const progressText = `(${currentIndex < 10 ? "0" + currentIndex : currentIndex}/${limit < 10 ? "0" + limit : limit})`;
                document.title = `${progressText} - Bing 自动化助手运行中`;
                BING_AUTOMATOR.elements.span.progress.innerText = progressText;
            }
        },
        // 计时器相关
        timer: {
            estimatedNextTime: null, // 预计下一次搜索的时间戳
            estimatedCompleteTime: null, // 预计完成所有搜索的时间戳
            intervalId: null, // 存储 setInterval 的 ID，用于停止计时器显示

            // 将毫秒转换为时钟格式 (MM:SS 或 HH:MM:SS)
            toClockFormat: (milliseconds, showHours = false) => {
                if (milliseconds < 0) milliseconds = 0;
                let totalSeconds = Math.floor(milliseconds / 1000);
                let sec = totalSeconds % 60;
                let totalMinutes = Math.floor(totalSeconds / 60);
                let min = totalMinutes % 60;
                let hrs = Math.floor(totalMinutes / 60);

                return `${showHours ? String(hrs).padStart(2, '0') + ":" : ""}${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
            },
            // 更新预计时间
            updateEstimatedTime: (currentIndex) => {
                const now = new Date().getTime();
                const interval = BING_AUTOMATOR.search.interval;
                const remainingSearches = BING_AUTOMATOR.search.limit - currentIndex;

                // 如果是随机间隔，无法精确预测，给个大概提示
                if (interval === 9999) {
                    BING_AUTOMATOR.search.engine.timer.estimatedNextTime = now + (10 + Math.random() * 50) * 1000; // 估算下次在 10-60 秒后
                    BING_AUTOMATOR.search.engine.timer.estimatedCompleteTime = null; // 无法估算完成时间
                } else {
                    BING_AUTOMATOR.search.engine.timer.estimatedNextTime = now + interval;
                    BING_AUTOMATOR.search.engine.timer.estimatedCompleteTime = now + (interval * remainingSearches);
                }

                // 如果是最后一次搜索，下次时间就是现在
                if (currentIndex === BING_AUTOMATOR.search.limit) {
                    BING_AUTOMATOR.search.engine.timer.estimatedNextTime = now;
                }
            },
            // 运行计时器显示更新
            runDisplayUpdater: () => {
                // 先清除可能存在的旧计时器
                if (BING_AUTOMATOR.search.engine.timer.intervalId) {
                    clearInterval(BING_AUTOMATOR.search.engine.timer.intervalId);
                }

                // 每秒更新一次显示
                BING_AUTOMATOR.search.engine.timer.intervalId = setInterval(() => {
                    if (!BING_AUTOMATOR.search.isRunning) {
                        clearInterval(BING_AUTOMATOR.search.engine.timer.intervalId);
                        BING_AUTOMATOR.elements.div.timer.innerHTML = `自动搜索已停止`;
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
                         // 当预估完成时间已过，可以停止计时器更新
                         clearInterval(BING_AUTOMATOR.search.engine.timer.intervalId);
                         BING_AUTOMATOR.search.engine.timer.intervalId = null;
                    } else {
                         timerText += `随机间隔模式，无法预估完成时间`;
                    }
                    BING_AUTOMATOR.elements.div.timer.innerHTML = timerText;

                }, 1000);
            },
             // 停止计时器显示更新
            stopDisplayUpdater: () => {
                 if (BING_AUTOMATOR.search.engine.timer.intervalId) {
                    clearInterval(BING_AUTOMATOR.search.engine.timer.intervalId);
                    BING_AUTOMATOR.search.engine.timer.intervalId = null;
                 }
                 BING_AUTOMATOR.elements.div.timer.innerHTML = `自动搜索已停止`;
            }
        },
        // 窗口或 iframe 操作
        output: {
            // 多标签模式打开窗口
            openWindow: (url, interval) => {
                try {
                    // 关闭可能存在的上一个窗口 (如果用户快速连续点击)
                    if (BING_AUTOMATOR.search.searchWindow && !BING_AUTOMATOR.search.searchWindow.closed) {
                        BING_AUTOMATOR.search.searchWindow.close();
                    }
                    const searchWindow = window.open(url, '_blank');
                    BING_AUTOMATOR.search.searchWindow = searchWindow; // 保存窗口引用

                    if (searchWindow) {
                        // 设置定时器尝试关闭窗口
                        // 使用 Math.max 确保延迟至少为 500ms
                        const closeDelay = Math.max(500, (interval <= 10000 && interval !== 9999 ? interval : 10000) - 500);
                        setTimeout(() => {
                            if (searchWindow && !searchWindow.closed) {
                                searchWindow.close();
                            }
                        }, closeDelay);
                    } else {
                         console.warn("Popup blocked? Could not open search window.");
                         alert("浏览器阻止了弹出窗口，请允许本站点的弹出窗口以使用多标签模式。将切换回单标签模式。");
                         // 可以在这里强制切换回单标签模式并保存cookie，然后提示用户刷新
                         BING_AUTOMATOR.elements.select.multitab.value = "false";
                         BING_AUTOMATOR.cookies.set("_multitab_mode", "false");
                         BING_AUTOMATOR.search.stop(); // 停止当前搜索并刷新
                    }
                } catch (e) {
                    console.error("Error opening search window:", e);
                }
            },
            // 单标签模式添加 iframe
            addIframe: (url, term, index) => {
                try {
                    const iframe = document.createElement("iframe");
                    iframe.setAttribute("src", url);
                    iframe.setAttribute("title", `Search: ${term}`); // 添加 title 增加可访问性
                    iframe.setAttribute("style", "display: none;"); // 确保 iframe 隐藏

                    // 先移除旧的 iframe (如果存在)
                    if (BING_AUTOMATOR.elements.div.bing.firstChild) {
                        BING_AUTOMATOR.elements.div.bing.removeChild(BING_AUTOMATOR.elements.div.bing.firstChild);
                    }
                    // 添加新的 iframe
                    BING_AUTOMATOR.elements.div.bing.appendChild(iframe);
                } catch (e) {
                     console.error("Error adding iframe:", e);
                }
            }
        }
    },

    // 核心搜索执行函数
    executeSearch: (index = 1) => {
        if (!BING_AUTOMATOR.search.isRunning || index > BING_AUTOMATOR.search.limit) {
            if (BING_AUTOMATOR.search.isRunning) { // 正常完成
                console.log("All searches completed.");
                BING_AUTOMATOR.search.stop(true); // 传入 true 表示是正常完成
            } else { // 被中途停止
                 console.log("Search stopped by user.");
                 BING_AUTOMATOR.search.engine.timer.stopDisplayUpdater();
            }
            return;
        }

        const term = BING_AUTOMATOR.search.getRandomSearchTerm();
        const formParam = BING_AUTOMATOR.search.getRandomFormParam();
        const url = `https://www.bing.com/search?q=${encodeURIComponent(term.toLowerCase())}&FORM=${formParam}`;
        const interval = BING_AUTOMATOR.search.interval;
        let nextDelay = interval;

        // 处理随机间隔
        if (interval === 9999) {
            nextDelay = (10 + Math.floor(Math.random() * 51)) * 1000; // 10-60 秒随机延迟
        }

        console.log(`Executing search ${index}/${BING_AUTOMATOR.search.limit}: ${term} (Delay: ${nextDelay/1000}s)`);

        // 更新进度显示和预计时间
        BING_AUTOMATOR.search.engine.progress.update(index);
        BING_AUTOMATOR.search.engine.timer.updateEstimatedTime(index);
        if(index === 1) { // 第一次搜索时启动计时器显示
             BING_AUTOMATOR.search.engine.timer.runDisplayUpdater();
        }


        // 根据模式执行搜索 (打开窗口或添加 iframe)
        if (BING_AUTOMATOR.search.multitab) {
            BING_AUTOMATOR.search.engine.output.openWindow(url, interval);
        } else {
            BING_AUTOMATOR.search.engine.output.addIframe(url, term, index);
        }

        // 设置下一次搜索的定时器
        BING_AUTOMATOR.search.currentTimeoutId = setTimeout(() => {
            BING_AUTOMATOR.executeSearch(index + 1); // 递归调用执行下一次搜索
        }, nextDelay);
    },

    // 开始搜索
    start: () => {
        if (BING_AUTOMATOR.search.isRunning) {
            console.log("Search is already running.");
            return;
        }
        console.log("Starting auto search...");
        BING_AUTOMATOR.search.isRunning = true;

        // 更新按钮状态
        BING_AUTOMATOR.elements.button.start.style.display = "none";
        BING_AUTOMATOR.elements.button.stop.style.display = "inline-block"; // 使用 inline-block 保持布局

        // 清除可能残留的旧计时器
        if (BING_AUTOMATOR.search.currentTimeoutId) {
            clearTimeout(BING_AUTOMATOR.search.currentTimeoutId);
        }
         BING_AUTOMATOR.search.engine.timer.stopDisplayUpdater(); // 先停止旧的显示更新

        // 立即开始第一次搜索
        BING_AUTOMATOR.executeSearch(1);
    },

    // 停止搜索
    stop: (completed = false) => {
        console.log("Stopping auto search...");
        BING_AUTOMATOR.search.isRunning = false;

        // 清除计划中的下一次搜索定时器
        if (BING_AUTOMATOR.search.currentTimeoutId) {
            clearTimeout(BING_AUTOMATOR.search.currentTimeoutId);
            BING_AUTOMATOR.search.currentTimeoutId = null;
        }
         // 关闭可能打开的搜索窗口
        if (BING_AUTOMATOR.search.searchWindow && !BING_AUTOMATOR.search.searchWindow.closed) {
            BING_AUTOMATOR.search.searchWindow.close();
            BING_AUTOMATOR.search.searchWindow = null;
        }

        // 停止计时器显示更新
        BING_AUTOMATOR.search.engine.timer.stopDisplayUpdater();


        // 更新按钮状态
        BING_AUTOMATOR.elements.button.start.style.display = "inline-block";
        BING_AUTOMATOR.elements.button.stop.style.display = "none";

        // 只有在正常完成时才打开积分页面并刷新
        if (completed) {
            console.log("Redirecting to points breakdown and reloading...");
            // 稍微延迟一下再跳转和刷新，给用户一点反应时间
            setTimeout(() => {
                try {
                    // 尝试在新标签页打开积分页面
                    window.open("https://rewards.bing.com/pointsbreakdown", "_blank");
                } catch(e) {
                    console.error("Could not open points breakdown page:", e);
                }
                location.reload(); // 重新加载页面
            }, 1500); // 延迟 1.5 秒
        } else {
             // 如果是手动停止，直接刷新
             location.reload();
        }
    }
});

// 在 init 函数中添加按钮事件监听器
BING_AUTOMATOR.init = () => {
    console.log("Bing Automator Initializing...");
    BING_AUTOMATOR.cookies.loadSettings(); // 加载设置

    // 下拉框事件监听器
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

    // 开始按钮事件监听器
    BING_AUTOMATOR.elements.button.start.addEventListener("click", BING_AUTOMATOR.start);

    // 停止按钮事件监听器
    BING_AUTOMATOR.elements.button.stop.addEventListener("click", () => BING_AUTOMATOR.stop(false)); // 手动停止传入 false

    console.log("Bing Automator Ready.");
};

// 重新设置 DOMContentLoaded 监听器，确保覆盖之前的定义
document.removeEventListener("DOMContentLoaded", BING_AUTOMATOR.init); // 先移除旧的（如果存在）
document.addEventListener("DOMContentLoaded", BING_AUTOMATOR.init);