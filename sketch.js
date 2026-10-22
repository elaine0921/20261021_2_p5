const STORAGE_KEY = 'school-clock-app-settings'; // 設定此網頁使用的本機儲存識別名稱。
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']; // 定義日期顯示使用的星期名稱。
const DEFAULT_FOCUS_MINUTES = 25; // 設定預設專注時間為二十五分鐘。
const DEFAULT_BREAK_MINUTES = 5; // 設定預設休息時間為五分鐘。
const TAB_NAMES = ['考試大鐘', '上下課鐘', '讀書番茄鐘']; // 定義上方分頁的顯示名稱。
let examSettings = { subject: '', start: '', end: '', teacher: '', expected: '', attended: '' }; // 儲存考試資訊欄位。
let schedule = []; // 儲存每一節課的上課與下課時間。
let autoBellEnabled = false; // 記錄自動打鐘是否啟用。
let pomodoroSettings = { focusMinutes: DEFAULT_FOCUS_MINUTES, breakMinutes: DEFAULT_BREAK_MINUTES }; // 儲存番茄鐘時間設定。
let pomodoroPhase = 'focus'; // 記錄番茄鐘目前是專注或休息階段。
let pomodoroRound = 1; // 記錄目前的番茄鐘輪次。
let pomodoroRemainingMs = DEFAULT_FOCUS_MINUTES * 60000; // 記錄目前階段剩餘的毫秒數。
let pomodoroRunning = false; // 記錄番茄鐘是否正在倒數。
let previousTickTime = 0; // 記錄上一個番茄鐘更新時間。
let audioContext = null; // 儲存由瀏覽器 Web Audio API 建立的音效環境。
let firedScheduleEvents = new Set(); // 避免同一分鐘內重複播放自動鈴聲。
let tabButtons = []; // 保留分頁按鈕供切換目前頁面使用。
let examPanel; // 保留考試大鐘頁面容器。
let bellPanel; // 保留上下課鐘頁面容器。
let pomodoroPanel; // 保留讀書番茄鐘頁面容器。
let examInputs = {}; // 保留考試資訊輸入欄位。
let pomodoroElements = {}; // 保留番茄鐘介面元件。
let scheduleList; // 保留課表顯示清單。
let autoBellInput; // 保留自動打鐘開關。
let bellStatus; // 保留上下課鐘狀態提示。

function setup() { // 初始化頁面、p5.js 畫布及各項功能介面。
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2)); // 限制畫布像素密度以兼顧投影清晰度與效能。
  document.documentElement.lang = 'zh-Hant'; // 指定頁面語系為繁體中文。
  document.title = '校園時鐘｜考試大鐘・上下課鐘・讀書番茄鐘'; // 設定瀏覽器分頁標題。
  loadSettings(); // 載入先前儲存的所有功能設定。
  createNavigation(); // 建立頁面上方的三個功能分頁。
  const app = makeDomElement('main', 'app-main', document.body); // 建立主要內容區域。
  createExamPanel(app); // 建立考試大鐘頁面。
  createBellPanel(app); // 建立上下課鐘頁面。
  createPomodoroPanel(app); // 建立讀書番茄鐘頁面。
  const canvas = createCanvas(windowWidth, getDisplayHeight()); // 建立 p5.js 考試大鐘畫布。
  canvas.parent(examPanel.querySelector('.exam-display')); // 將時鐘畫布放入考試大鐘顯示區。
  canvas.addClass('exam-canvas'); // 標示畫布樣式供外部 CSS 控制。
  textFont('Arial, "Noto Sans TC", sans-serif'); // 設定 p5.js 字型以支援中文文字。
  activateTab(0); // 預設顯示考試大鐘分頁。
  setInterval(updatePomodoro, 200); // 定期更新番茄鐘倒數與課表自動打鐘。
  document.addEventListener('fullscreenchange', updateFullscreenState); // 依全螢幕狀態更新介面。
} // 結束頁面初始化函式。

function draw() { // 使用 p5.js 每幀繪製即時日期、時間及考試資訊。
  background('#080d18'); // 設定畫布的深色背景。
  const now = new Date(); // 取得目前的本機日期與時間。
  const w = width; // 讀取畫布寬度。
  const h = height; // 讀取畫布高度。
  const compact = h < 430; // 判斷小畫面是否需要縮小版面。
  const dateSize = constrain(h * 0.045, 16, 26); // 根據畫布大小計算日期字體。
  const clockSize = Math.min(w * 0.19, h * (compact ? 0.24 : 0.27), 220); // 計算大時鐘字體大小。
  const infoSize = constrain(w * 0.027, 17, 27); // 計算考試科目字體大小。
  const smallSize = constrain(w * 0.019, 14, 20); // 計算考試細節字體大小。
  const dateText = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日　${WEEKDAYS[now.getDay()]}`; // 組合本日日期與星期文字。
  const countdown = getCountdown(now); // 計算距離考試結束的剩餘分鐘數。
  drawCanvasText(dateText, w / 2, h * 0.105, dateSize, '#aab8ce'); // 在畫面上方置中顯示日期與星期。
  drawCanvasText(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`, w / 2, h * 0.29, clockSize, '#f5f8ff', 'Consolas, "Courier New", monospace'); // 顯示大型等寬即時時鐘。
  stroke('#28354b'); // 設定資訊分隔線顏色。
  strokeWeight(1); // 設定資訊分隔線粗細。
  line(w * 0.12, h * 0.405, w * 0.88, h * 0.405); // 繪製考試時鐘下方分隔線。
  const timeText = examSettings.start && examSettings.end ? `考試時間　${examSettings.start} ～ ${examSettings.end}` : '考試時間　--:-- ～ --:--'; // 組合考試時間顯示文字。
  drawCanvasText(examSettings.subject.trim() || '尚未設定考試科目', w / 2, h * 0.485, infoSize, '#eef3fc'); // 顯示考試科目。
  drawCanvasText(timeText, w / 2, h * 0.545, smallSize, '#b7c4d9'); // 顯示考試開始與結束時間。
  drawCanvasText(`監考老師　${examSettings.teacher.trim() || '未設定'}`, w / 2, h * 0.595, smallSize, '#b7c4d9'); // 顯示監考老師姓名。
  const urgent = countdown.minutes !== null && countdown.minutes <= 10 && countdown.minutes > 0; // 判斷是否進入最後十分鐘。
  const countdownColor = urgent ? '#ff5364' : '#78c6ff'; // 設定倒數文字顏色。
  drawCanvasText('距離考試結束還有', w / 2, h * 0.70, constrain(h * 0.04, 15, 22), countdownColor); // 顯示考試結束倒數提示文字。
  if (countdown.minutes === null) { // 判斷是否尚未輸入有效的考試結束時間。
    drawCanvasText('--', w / 2, h * 0.79, constrain(Math.min(w * 0.105, h * 0.14), 42, 96), '#d4deed', 'Consolas, "Courier New", monospace'); // 尚未設定時顯示佔位符。
  } else if (countdown.minutes <= 0) { // 判斷考試是否已經結束。
    drawCanvasText('考試已結束', w / 2, h * 0.79, constrain(Math.min(w * 0.105, h * 0.14), 42, 96), '#ff5364'); // 顯示考試結束訊息。
  } else { // 處理尚未結束的考試倒數。
    drawCanvasText(`${countdown.minutes} 分鐘`, w / 2, h * 0.79, constrain(Math.min(w * 0.105, h * 0.14), 42, 96), countdownColor, 'Consolas, "Courier New", monospace'); // 顯示剩餘考試分鐘數。
  } // 結束考試倒數顯示判斷。
  const expected = parseCount(examSettings.expected); // 將應到人數轉為有效整數。
  const attended = parseCount(examSettings.attended); // 將實到人數轉為有效整數。
  const absent = expected === null || attended === null ? '--' : String(Math.max(0, expected - attended)); // 計算缺考人數並避免顯示負數。
  const statsY = h * 0.92; // 設定考生人數資訊的垂直位置。
  drawCanvasText(`應到　${expected === null ? '--' : expected} 人　　　實到　${attended === null ? '--' : attended} 人　　　缺考　${absent} 人`, w / 2, statsY, smallSize, '#c5d0e1'); // 顯示應到、實到與缺考人數。
} // 結束 p5.js 畫布繪製函式。

function drawCanvasText(value, x, y, size, color, font = 'Arial, "Noto Sans TC", sans-serif') { // 使用 Canvas 2D 繪製可調整尺寸的文字。
  const context = drawingContext; // 取得 p5.js 畫布的 2D 繪圖環境。
  context.save(); // 暫存現有畫布狀態避免影響其他繪圖。
  context.font = `${size}px ${font}`; // 指定字體大小與字型。
  context.fillStyle = color; // 指定文字顏色。
  context.textAlign = 'center'; // 將文字設為水平置中。
  context.textBaseline = 'middle'; // 將文字設為垂直置中。
  context.fillText(value, x, y); // 將文字繪製到指定座標。
  context.restore(); // 還原原本的畫布狀態。
} // 結束畫布文字繪製函式。

function createNavigation() { // 建立頁面上方的分頁導覽列。
  const navigation = makeDomElement('nav', 'tabs', document.body); // 建立分頁導覽列容器。
  navigation.setAttribute('aria-label', '功能分頁'); // 提供螢幕閱讀器可辨識的導覽名稱。
  TAB_NAMES.forEach((name, index) => { // 逐一建立三個功能分頁按鈕。
    const button = makeDomElement('button', 'tab-button', navigation, name); // 建立一個分頁按鈕。
    button.type = 'button'; // 避免按鈕意外提交表單。
    button.setAttribute('aria-selected', 'false'); // 初始標示為尚未選取的分頁。
    button.addEventListener('click', () => activateTab(index)); // 點擊後切換至對應功能頁面。
    tabButtons.push(button); // 保存按鈕供切換狀態使用。
  }); // 結束分頁按鈕建立迴圈。
} // 結束建立分頁函式。

function createExamPanel(parent) { // 建立既有考試大鐘及考試資料設定介面。
  examPanel = makeDomElement('section', 'tab-panel exam-panel', parent); // 建立考試大鐘分頁容器。
  examPanel.setAttribute('aria-label', '考試大鐘'); // 指定分頁區域的無障礙名稱。
  const display = makeDomElement('div', 'exam-display', examPanel); // 建立 p5.js 畫布的顯示容器。
  const controls = makeDomElement('section', 'panel-controls', examPanel); // 建立考試資料輸入控制區。
  makeDomElement('h1', 'section-title', controls, '考試資訊設定'); // 顯示考試資料區標題。
  const grid = makeDomElement('div', 'settings-grid', controls); // 建立考試資料輸入格線。
  addExamInput(grid, 'subject', '考試科目', '例如：數學', 'text'); // 建立考試科目輸入欄位。
  addExamInput(grid, 'start', '開始時間', '', 'time'); // 建立考試開始時間輸入欄位。
  addExamInput(grid, 'end', '結束時間', '', 'time'); // 建立考試結束時間輸入欄位。
  addExamInput(grid, 'teacher', '監考老師', '例如：王老師', 'text'); // 建立監考老師輸入欄位。
  addExamInput(grid, 'expected', '應到人數', '請輸入人數', 'number'); // 建立應到人數輸入欄位。
  addExamInput(grid, 'attended', '實到人數', '請輸入人數', 'number'); // 建立實到人數輸入欄位。
  const actions = makeDomElement('div', 'actions', controls); // 建立考試大鐘操作按鈕區。
  const fullscreenButton = makeDomElement('button', 'primary-button', actions, '全螢幕'); // 建立全螢幕按鈕。
  fullscreenButton.type = 'button'; // 指定按鈕用途而非表單提交。
  fullscreenButton.addEventListener('click', toggleFullscreen); // 點擊後切換全螢幕狀態。
} // 結束考試大鐘頁面建立函式。

function addExamInput(parent, key, labelText, placeholder, type) { // 建立帶有標籤與儲存行為的考試資料欄位。
  const wrapper = makeDomElement('div', 'field', parent); // 建立欄位容器。
  const label = makeDomElement('label', '', wrapper, labelText); // 建立欄位標籤文字。
  const input = makeDomElement('input', '', wrapper); // 建立欄位輸入元件。
  input.id = `exam-${key}`; // 設定輸入欄位識別名稱。
  input.type = type; // 指定輸入欄位型別。
  input.value = examSettings[key]; // 填入已儲存的考試資料。
  input.setAttribute('aria-label', labelText); // 設定輸入欄位的無障礙名稱。
  label.htmlFor = input.id; // 將欄位標籤連結至輸入元件。
  if (placeholder) input.placeholder = placeholder; // 有提示文字時顯示欄位提示。
  if (type === 'number') { // 設定人數欄位的輸入限制。
    input.min = '0'; // 限制人數不得小於零。
    input.step = '1'; // 限制人數只能使用整數。
  } // 結束人數欄位限制設定。
  input.addEventListener('input', () => { examSettings[key] = input.value; saveSettings(); }); // 欄位變更時更新並儲存考試資料。
  examInputs[key] = input; // 保存欄位元件以供後續使用。
} // 結束考試欄位建立函式。

function createBellPanel(parent) { // 建立上下課鐘與課表管理介面。
  bellPanel = makeDomElement('section', 'tab-panel feature-panel bell-panel', parent); // 建立上下課鐘分頁容器。
  bellPanel.setAttribute('aria-label', '上下課鐘'); // 指定分頁區域的無障礙名稱。
  makeDomElement('h1', 'feature-title', bellPanel, '上下課鐘'); // 顯示上下課鐘頁面標題。
  makeDomElement('p', 'feature-description', bellPanel, '手動播放校園風格鈴聲，或依照課表在指定時間自動打鐘。'); // 說明手動鈴聲與課表自動打鐘用途。
  const bellButtons = makeDomElement('div', 'bell-buttons', bellPanel); // 建立上課與下課的大型鈴聲按鈕區。
  const startButton = makeDomElement('button', 'bell-button start-bell', bellButtons, '上課鈴'); // 建立手動上課鈴按鈕。
  startButton.type = 'button'; // 指定按鈕用途而非表單提交。
  startButton.addEventListener('click', () => playBell('start')); // 點擊後播放上課鈴聲。
  const endButton = makeDomElement('button', 'bell-button end-bell', bellButtons, '下課鈴'); // 建立手動下課鈴按鈕。
  endButton.type = 'button'; // 指定按鈕用途而非表單提交。
  endButton.addEventListener('click', () => playBell('end')); // 點擊後播放下課鈴聲。
  bellStatus = makeDomElement('p', 'status-message', bellPanel, '首次使用請按下任一鈴聲，啟用瀏覽器音效。'); // 顯示瀏覽器音效的首次使用提示。
  const scheduleSection = makeDomElement('section', 'schedule-section', bellPanel); // 建立課表管理區域。
  makeDomElement('h2', 'section-title', scheduleSection, '課表'); // 顯示課表區標題。
  const form = makeDomElement('form', 'schedule-form', scheduleSection); // 建立新增課表表單。
  const startField = makeDomElement('div', 'field', form); // 建立上課時間欄位容器。
  const startLabel = makeDomElement('label', '', startField, '上課時間'); // 建立上課時間欄位標籤。
  const startInput = makeDomElement('input', '', startField); // 建立上課時間輸入元件。
  startInput.type = 'time'; // 指定上課時間使用二十四小時時間欄位。
  startInput.required = true; // 要求新增課表時必須填寫上課時間。
  startInput.setAttribute('aria-label', '新增課表的上課時間'); // 設定上課時間輸入元件名稱。
  startLabel.htmlFor = 'schedule-start'; // 將欄位標籤指向上課時間輸入元件。
  startInput.id = 'schedule-start'; // 設定上課時間欄位識別名稱。
  const endField = makeDomElement('div', 'field', form); // 建立下課時間欄位容器。
  const endLabel = makeDomElement('label', '', endField, '下課時間'); // 建立下課時間欄位標籤。
  const endInput = makeDomElement('input', '', endField); // 建立下課時間輸入元件。
  endInput.type = 'time'; // 指定下課時間使用二十四小時時間欄位。
  endInput.required = true; // 要求新增課表時必須填寫下課時間。
  endInput.setAttribute('aria-label', '新增課表的下課時間'); // 設定下課時間輸入元件名稱。
  endLabel.htmlFor = 'schedule-end'; // 將欄位標籤指向下課時間輸入元件。
  endInput.id = 'schedule-end'; // 設定下課時間欄位識別名稱。
  const addButton = makeDomElement('button', 'primary-button add-schedule-button', form, '新增課表'); // 建立新增課表按鈕。
  addButton.type = 'submit'; // 指定按鈕提交新增課表表單。
  form.addEventListener('submit', event => { event.preventDefault(); addSchedule(startInput.value, endInput.value); startInput.value = ''; endInput.value = ''; }); // 驗證並新增課表時間後清空欄位。
  const scheduleActions = makeDomElement('div', 'schedule-actions', scheduleSection); // 建立自動打鐘開關控制區。
  const autoLabel = makeDomElement('label', 'switch-label', scheduleActions, '啟用自動打鐘'); // 建立自動打鐘開關文字。
  autoBellInput = makeDomElement('input', 'switch-input', autoLabel); // 建立自動打鐘勾選開關。
  autoBellInput.type = 'checkbox'; // 指定開關使用勾選方塊型態。
  autoBellInput.checked = autoBellEnabled; // 套用已儲存的自動打鐘狀態。
  autoBellInput.setAttribute('aria-label', '啟用自動打鐘'); // 設定自動打鐘開關的無障礙名稱。
  autoBellInput.addEventListener('change', () => { autoBellEnabled = autoBellInput.checked; saveSettings(); if (autoBellEnabled) unlockAudio(); }); // 開關變更時儲存設定並在啟用時解鎖音效。
  scheduleList = makeDomElement('div', 'schedule-list', scheduleSection); // 建立課表內容清單。
  renderSchedule(); // 顯示已儲存的課表。
} // 結束上下課鐘頁面建立函式。

function createPomodoroPanel(parent) { // 建立可設定專注與休息時間的番茄鐘介面。
  pomodoroPanel = makeDomElement('section', 'tab-panel feature-panel pomodoro-panel', parent); // 建立番茄鐘分頁容器。
  pomodoroPanel.setAttribute('aria-label', '讀書番茄鐘'); // 指定分頁區域的無障礙名稱。
  makeDomElement('h1', 'feature-title', pomodoroPanel, '讀書番茄鐘'); // 顯示番茄鐘頁面標題。
  makeDomElement('p', 'feature-description', pomodoroPanel, '專注與休息時間可自行調整，階段結束時會播放提示音並自動切換。'); // 說明番茄鐘的基本使用方式。
  const settings = makeDomElement('div', 'pomodoro-settings', pomodoroPanel); // 建立專注與休息時間設定區。
  pomodoroElements.focusInput = addMinuteInput(settings, 'focus-minutes', '專注時間（分鐘）', pomodoroSettings.focusMinutes); // 建立專注時間輸入欄位。
  pomodoroElements.breakInput = addMinuteInput(settings, 'break-minutes', '休息時間（分鐘）', pomodoroSettings.breakMinutes); // 建立休息時間輸入欄位。
  pomodoroElements.focusInput.addEventListener('change', () => changePomodoroDuration('focusMinutes', pomodoroElements.focusInput)); // 專注時間變更時更新計時設定。
  pomodoroElements.breakInput.addEventListener('change', () => changePomodoroDuration('breakMinutes', pomodoroElements.breakInput)); // 休息時間變更時更新計時設定。
  pomodoroElements.phase = makeDomElement('p', 'pomodoro-phase', pomodoroPanel, '專注時間'); // 建立目前階段提示文字。
  pomodoroElements.round = makeDomElement('p', 'pomodoro-round', pomodoroPanel, '第 1 輪'); // 建立目前番茄鐘輪次文字。
  pomodoroElements.countdown = makeDomElement('div', 'pomodoro-countdown', pomodoroPanel, '25:00'); // 建立大型番茄鐘倒數時間。
  const actions = makeDomElement('div', 'pomodoro-actions', pomodoroPanel); // 建立番茄鐘操作按鈕區。
  pomodoroElements.start = makeDomElement('button', 'primary-button', actions, '開始'); // 建立番茄鐘開始按鈕。
  pomodoroElements.start.type = 'button'; // 指定按鈕用途而非表單提交。
  pomodoroElements.start.addEventListener('click', startPomodoro); // 點擊後開始番茄鐘倒數。
  pomodoroElements.pause = makeDomElement('button', 'secondary-button', actions, '暫停'); // 建立番茄鐘暫停按鈕。
  pomodoroElements.pause.type = 'button'; // 指定按鈕用途而非表單提交。
  pomodoroElements.pause.addEventListener('click', pausePomodoro); // 點擊後暫停番茄鐘倒數。
  pomodoroElements.reset = makeDomElement('button', 'secondary-button', actions, '重設'); // 建立番茄鐘重設按鈕。
  pomodoroElements.reset.type = 'button'; // 指定按鈕用途而非表單提交。
  pomodoroElements.reset.addEventListener('click', resetPomodoro); // 點擊後將番茄鐘恢復至第一輪專注。
  pomodoroElements.skip = makeDomElement('button', 'secondary-button', actions, '跳過'); // 建立番茄鐘跳過階段按鈕。
  pomodoroElements.skip.type = 'button'; // 指定按鈕用途而非表單提交。
  pomodoroElements.skip.addEventListener('click', () => advancePomodoro(true)); // 點擊後播放提示音並切換至下一階段。
  updatePomodoroDisplay(); // 初次顯示番茄鐘目前狀態與時間。
} // 結束番茄鐘頁面建立函式。

function addMinuteInput(parent, id, labelText, value) { // 建立番茄鐘分鐘數輸入欄位。
  const wrapper = makeDomElement('div', 'field', parent); // 建立分鐘數輸入欄位容器。
  const label = makeDomElement('label', '', wrapper, labelText); // 建立分鐘數輸入欄位標籤。
  const input = makeDomElement('input', '', wrapper); // 建立分鐘數輸入元件。
  input.id = id; // 設定輸入元件識別名稱。
  input.type = 'number'; // 指定輸入欄位為數字型態。
  input.min = '1'; // 限制最少一分鐘。
  input.max = '180'; // 限制最多一百八十分鐘。
  input.step = '1'; // 限制只能輸入整數分鐘。
  input.value = String(value); // 填入已儲存的分鐘數。
  input.setAttribute('aria-label', labelText); // 設定欄位的無障礙名稱。
  label.htmlFor = id; // 將欄位標籤連結至輸入元件。
  return input; // 回傳輸入元件供事件處理使用。
} // 結束分鐘數欄位建立函式。

function makeDomElement(tagName, className, parent, text) { // 建立並設定頁面 DOM 元素的共用輔助函式。
  const element = document.createElement(tagName); // 依照標籤名稱建立頁面元素。
  if (className) element.className = className; // 有提供樣式名稱時指定元素 class。
  if (text !== undefined) element.textContent = text; // 有提供顯示文字時安全地設定文字內容。
  if (parent) parent.appendChild(element); // 有提供父元素時將新元素加入頁面。
  return element; // 回傳建立後的 DOM 元素。
} // 結束 DOM 元素輔助函式。

function activateTab(index) { // 切換目前顯示的功能分頁。
  const panels = [examPanel, bellPanel, pomodoroPanel]; // 組合所有分頁內容容器。
  panels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== index; }); // 僅顯示所選取的分頁內容。
  tabButtons.forEach((button, buttonIndex) => { button.classList.toggle('active', buttonIndex === index); button.setAttribute('aria-selected', String(buttonIndex === index)); }); // 更新分頁按鈕的選取樣式與無障礙狀態。
  if (index === 0) resizeCanvas(examPanel.querySelector('.exam-display').clientWidth || windowWidth, getDisplayHeight()); // 回到考試大鐘時依版面寬度更新畫布。
} // 結束分頁切換函式。

function addSchedule(startTime, endTime) { // 驗證並新增一筆課表時間。
  if (!isValidTime(startTime) || !isValidTime(endTime)) { bellStatus.textContent = '請輸入有效的上課與下課時間。'; return; } // 無效時間不新增並顯示錯誤訊息。
  schedule.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, start: startTime, end: endTime }); // 加入具唯一識別碼的課表資料。
  schedule.sort((first, second) => first.start.localeCompare(second.start)); // 依上課時間先後排列課表。
  saveSettings(); // 儲存新增後的課表資料。
  renderSchedule(); // 更新頁面顯示的課表清單。
  bellStatus.textContent = '課表已新增。'; // 回報新增成功狀態。
} // 結束新增課表函式。

function renderSchedule() { // 依目前的課表資料重繪時間清單。
  if (!scheduleList) return; // 課表清單尚未建立時不執行繪製。
  scheduleList.replaceChildren(); // 清除畫面上原有的課表列。
  if (schedule.length === 0) { makeDomElement('p', 'empty-message', scheduleList, '尚未新增課表。'); return; } // 沒有課表時顯示空清單提示。
  schedule.forEach((lesson, index) => { // 逐筆建立課表列與刪除按鈕。
    const row = makeDomElement('div', 'schedule-row', scheduleList); // 建立單節課表列容器。
    makeDomElement('span', 'lesson-number', row, `第 ${index + 1} 節`); // 顯示課表節次。
    makeDomElement('span', 'lesson-times', row, `${lesson.start} 上課　—　${lesson.end} 下課`); // 顯示上課與下課時間。
    const removeButton = makeDomElement('button', 'delete-button', row, '刪除'); // 建立刪除目前課表列的按鈕。
    removeButton.type = 'button'; // 指定按鈕用途而非表單提交。
    removeButton.setAttribute('aria-label', `刪除第 ${index + 1} 節課表`); // 設定刪除按鈕的無障礙名稱。
    removeButton.addEventListener('click', () => removeSchedule(lesson.id)); // 點擊後刪除此筆課表。
  }); // 結束課表列建立迴圈。
} // 結束課表清單繪製函式。

function removeSchedule(id) { // 依照課表識別碼刪除指定節次。
  schedule = schedule.filter(lesson => lesson.id !== id); // 保留識別碼不同的其他課表。
  saveSettings(); // 儲存刪除後的課表資料。
  renderSchedule(); // 更新頁面上的課表清單。
  bellStatus.textContent = '課表已刪除。'; // 回報刪除完成狀態。
} // 結束刪除課表函式。

function updatePomodoro() { // 定期更新番茄鐘並檢查是否需要自動播放上下課鈴。
  const currentTime = performance.now(); // 取得高精準度的目前時間。
  if (pomodoroRunning) { // 番茄鐘正在運作時才減少剩餘時間。
    const elapsed = currentTime - previousTickTime; // 計算距離上次更新經過的時間。
    pomodoroRemainingMs = Math.max(0, pomodoroRemainingMs - elapsed); // 扣除經過時間並避免負數。
    if (pomodoroRemainingMs === 0) advancePomodoro(true); // 階段結束時播放提示音並切換至下一階段。
  } // 結束番茄鐘倒數更新判斷。
  previousTickTime = currentTime; // 記錄目前更新時間供下一輪計算使用。
  updatePomodoroDisplay(); // 更新畫面上的番茄鐘階段、輪次與倒數。
  checkScheduleBell(); // 檢查是否到達課表中需要響鈴的時間。
} // 結束定期更新函式。

function checkScheduleBell() { // 根據本機時間檢查是否應播放自動課表鈴聲。
  if (!autoBellEnabled || schedule.length === 0) return; // 自動打鐘未啟用或沒有課表時不檢查。
  const now = new Date(); // 取得目前本機時間。
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`; // 將目前時間轉為二十四小時格式。
  const dateKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; // 建立日期識別文字避免跨日重複。
  schedule.forEach(lesson => { // 逐一檢查每節課的上課及下課時間。
    const events = [{ time: lesson.start, type: 'start' }, { time: lesson.end, type: 'end' }]; // 建立本節課需要比對的兩種事件。
    events.forEach(event => { // 逐一比對上課鈴與下課鈴時間。
      const eventKey = `${dateKey}-${lesson.id}-${event.type}`; // 建立本日此節課事件的唯一識別碼。
      if (event.time === currentTime && !firedScheduleEvents.has(eventKey)) { firedScheduleEvents.add(eventKey); playBell(event.type, true); } // 到達設定時間時每個事件僅播放一次。
    }); // 結束事件比對迴圈。
  }); // 結束課表比對迴圈。
  if (firedScheduleEvents.size > 500) firedScheduleEvents.clear(); // 避免長時間運作後累積過多已播放事件識別碼。
} // 結束課表自動打鐘檢查函式。

function startPomodoro() { // 開始或繼續目前番茄鐘階段。
  unlockAudio(); // 透過使用者操作解鎖瀏覽器音效。
  if (pomodoroRunning) return; // 已在倒數時不重複啟動。
  pomodoroRunning = true; // 設定番茄鐘開始運作。
  previousTickTime = performance.now(); // 初始化倒數計時基準時間。
  updatePomodoroDisplay(); // 更新按鈕與倒數畫面。
} // 結束番茄鐘開始函式。

function pausePomodoro() { // 暫停番茄鐘並保留目前剩餘時間。
  pomodoroRunning = false; // 停止番茄鐘倒數。
  updatePomodoroDisplay(); // 更新番茄鐘按鈕狀態。
} // 結束番茄鐘暫停函式。

function resetPomodoro() { // 將番茄鐘重設為第一輪專注階段。
  pomodoroRunning = false; // 停止目前番茄鐘倒數。
  pomodoroPhase = 'focus'; // 將目前階段切回專注。
  pomodoroRound = 1; // 將輪次重設為第一輪。
  pomodoroRemainingMs = pomodoroSettings.focusMinutes * 60000; // 重設剩餘時間為目前專注設定。
  updatePomodoroDisplay(); // 更新番茄鐘階段、輪次與倒數。
} // 結束番茄鐘重設函式。

function advancePomodoro(playSound) { // 切換番茄鐘專注與休息階段並更新輪次。
  if (playSound) playPomodoroTone(); // 需要提示音時播放番茄鐘階段提示。
  if (pomodoroPhase === 'focus') { pomodoroPhase = 'break'; pomodoroRemainingMs = pomodoroSettings.breakMinutes * 60000; } // 專注結束後切換到休息階段。
  else { pomodoroPhase = 'focus'; pomodoroRound += 1; pomodoroRemainingMs = pomodoroSettings.focusMinutes * 60000; } // 休息結束後開始下一輪專注。
  if (pomodoroRunning) previousTickTime = performance.now(); // 計時持續運作時重新設定時間基準。
  updatePomodoroDisplay(); // 立即更新番茄鐘畫面。
} // 結束番茄鐘階段切換函式。

function changePomodoroDuration(settingName, input) { // 驗證並套用新的番茄鐘專注或休息分鐘數。
  const parsedValue = Number.parseInt(input.value, 10); // 將輸入文字轉換為整數分鐘。
  if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 180) { input.value = String(pomodoroSettings[settingName]); return; } // 輸入無效時恢復目前設定值。
  pomodoroSettings[settingName] = parsedValue; // 儲存有效的番茄鐘時間設定。
  if ((settingName === 'focusMinutes' && pomodoroPhase === 'focus') || (settingName === 'breakMinutes' && pomodoroPhase === 'break')) pomodoroRemainingMs = parsedValue * 60000; // 修改目前階段時間時立即重新計時。
  saveSettings(); // 將新的分鐘數儲存至本機。
  updatePomodoroDisplay(); // 更新番茄鐘倒數顯示。
} // 結束番茄鐘分鐘數變更函式。

function updatePomodoroDisplay() { // 將番茄鐘目前階段、輪次與時間更新至頁面。
  if (!pomodoroElements.countdown) return; // 番茄鐘元件尚未建立時不執行更新。
  const seconds = Math.ceil(pomodoroRemainingMs / 1000); // 將剩餘毫秒數無條件進位為秒數。
  const minutesText = pad(Math.floor(seconds / 60)); // 格式化剩餘分鐘數。
  const secondsText = pad(seconds % 60); // 格式化剩餘秒數。
  pomodoroElements.countdown.textContent = `${minutesText}:${secondsText}`; // 顯示大型分鐘與秒數倒數。
  pomodoroElements.phase.textContent = pomodoroPhase === 'focus' ? '專注時間' : '休息時間'; // 顯示目前番茄鐘階段。
  pomodoroElements.round.textContent = `第 ${pomodoroRound} 輪`; // 顯示目前番茄鐘輪次。
  pomodoroElements.countdown.classList.toggle('break-phase', pomodoroPhase === 'break'); // 休息階段套用不同的時間顏色。
  pomodoroElements.start.disabled = pomodoroRunning; // 倒數時停用開始按鈕。
  pomodoroElements.pause.disabled = !pomodoroRunning; // 暫停狀態時停用暫停按鈕。
  pomodoroElements.start.textContent = pomodoroRemainingMs < (pomodoroPhase === 'focus' ? pomodoroSettings.focusMinutes : pomodoroSettings.breakMinutes) * 60000 ? '繼續' : '開始'; // 依目前是否已開始顯示開始或繼續。
} // 結束番茄鐘畫面更新函式。

function unlockAudio() { // 建立或恢復瀏覽器 Web Audio API 音效環境。
  if (!window.AudioContext && !window.webkitAudioContext) { bellStatus.textContent = '此瀏覽器不支援 Web Audio API，無法播放鈴聲。'; return null; } // 瀏覽器不支援音訊時顯示明確錯誤。
  const AudioContextClass = window.AudioContext || window.webkitAudioContext; // 相容標準與 WebKit 音訊環境建構子。
  if (!audioContext) audioContext = new AudioContextClass(); // 首次使用時建立音訊環境。
  if (audioContext.state === 'suspended') audioContext.resume().catch(error => console.error('無法啟用瀏覽器音效：', error)); // 依使用者操作嘗試恢復暫停的音訊環境。
  return audioContext; // 回傳可供鈴聲播放使用的音訊環境。
} // 結束音效解鎖函式。

function playBell(type, automatic = false) { // 使用合成音色播放上下課鈴聲。
  const context = unlockAudio(); // 建立或恢復音訊環境。
  if (!context) return; // 不支援音效時結束播放。
  const isStartBell = type === 'start'; // 判斷目前是否為上課鈴。
  const pattern = isStartBell ? [0, 0.48, 0.96] : [0, 0.82]; // 設定上課與下課鈴不同的敲響節奏。
  const fundamental = isStartBell ? 784 : 659; // 設定兩種鈴聲不同的基礎音高。
  pattern.forEach((offset, strikeIndex) => { // 依節奏產生每一次鐘聲敲擊。
    const strikeTime = context.currentTime + offset; // 計算這次敲擊的排程時間。
    [1, 2.01, 2.74].forEach((partial, partialIndex) => { // 疊加鐘聲基音與泛音模擬金屬鈴聲。
      const oscillator = context.createOscillator(); // 建立產生音波的振盪器。
      const gain = context.createGain(); // 建立控制鐘聲漸強漸弱的音量節點。
      oscillator.type = partialIndex === 2 ? 'triangle' : 'sine'; // 混合正弦波與三角波增添鈴聲質感。
      oscillator.frequency.setValueAtTime(fundamental * partial, strikeTime); // 設定目前泛音頻率。
      oscillator.detune.setValueAtTime((strikeIndex % 2 ? -4 : 4) * partialIndex, strikeTime); // 加入極微小的泛音偏移。
      gain.gain.setValueAtTime(0.0001, strikeTime); // 設定鐘聲開始時的極低音量。
      gain.gain.exponentialRampToValueAtTime(partialIndex === 0 ? 0.13 : 0.055, strikeTime + 0.015); // 快速增加鐘聲音量。
      gain.gain.exponentialRampToValueAtTime(0.0001, strikeTime + 1.55); // 讓鐘聲自然衰減。
      oscillator.connect(gain); // 將振盪器連接至音量控制節點。
      gain.connect(context.destination); // 將音量節點連接至瀏覽器音訊輸出。
      oscillator.start(strikeTime); // 在指定排程時間開始發聲。
      oscillator.stop(strikeTime + 1.6); // 鐘聲衰減後停止振盪器。
    }); // 結束本次鐘聲的泛音建立迴圈。
  }); // 結束鐘聲節奏建立迴圈。
  if (!automatic && bellStatus) bellStatus.textContent = isStartBell ? '正在播放上課鈴聲。' : '正在播放下課鈴聲。'; // 手動播放時顯示鈴聲種類。
} // 結束上下課鈴聲播放函式。

function playPomodoroTone() { // 播放番茄鐘階段切換的雙音提示聲。
  const context = unlockAudio(); // 建立或恢復音訊環境。
  if (!context) return; // 不支援音效時結束播放。
  const frequencies = pomodoroPhase === 'focus' ? [659, 880] : [880, 659]; // 依結束的階段選擇提示音音高順序。
  frequencies.forEach((frequency, index) => { // 逐一排程兩個提示音。
    const startTime = context.currentTime + index * 0.24; // 設定兩個提示音的播放間隔。
    const oscillator = context.createOscillator(); // 建立提示音振盪器。
    const gain = context.createGain(); // 建立提示音音量控制節點。
    oscillator.type = 'sine'; // 使用柔和的正弦波提示音。
    oscillator.frequency.setValueAtTime(frequency, startTime); // 設定提示音頻率。
    gain.gain.setValueAtTime(0.0001, startTime); // 設定提示音初始音量。
    gain.gain.exponentialRampToValueAtTime(0.16, startTime + 0.02); // 快速將提示音提高至適當音量。
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.2); // 在提示音結束時自然降低音量。
    oscillator.connect(gain); // 將提示音振盪器連接至音量節點。
    gain.connect(context.destination); // 將音量節點連接至瀏覽器音訊輸出。
    oscillator.start(startTime); // 在排程時間播放提示音。
    oscillator.stop(startTime + 0.22); // 播放結束後停止提示音振盪器。
  }); // 結束提示音排程迴圈。
} // 結束番茄鐘提示音函式。

function loadSettings() { // 從瀏覽器 localStorage 載入所有已儲存設定。
  try { // 開始處理瀏覽器本機儲存資料。
    const saved = localStorage.getItem(STORAGE_KEY); // 讀取本應用程式儲存的 JSON 資料。
    if (!saved) return; // 尚未儲存過設定時保留預設值。
    const parsed = JSON.parse(saved); // 將本機儲存的 JSON 文字解析為物件。
    if (parsed.exam && typeof parsed.exam === 'object') Object.keys(examSettings).forEach(key => { if (typeof parsed.exam[key] === 'string') examSettings[key] = parsed.exam[key]; }); // 載入格式正確的考試資訊欄位。
    if (Array.isArray(parsed.schedule)) schedule = parsed.schedule.filter(item => item && typeof item.id === 'string' && isValidTime(item.start) && isValidTime(item.end)); // 載入有效的課表時間資料。
    if (typeof parsed.autoBellEnabled === 'boolean') autoBellEnabled = parsed.autoBellEnabled; // 載入自動打鐘開關狀態。
    if (parsed.pomodoro && Number.isInteger(parsed.pomodoro.focusMinutes) && parsed.pomodoro.focusMinutes >= 1 && parsed.pomodoro.focusMinutes <= 180) pomodoroSettings.focusMinutes = parsed.pomodoro.focusMinutes; // 載入有效的專注時間設定。
    if (parsed.pomodoro && Number.isInteger(parsed.pomodoro.breakMinutes) && parsed.pomodoro.breakMinutes >= 1 && parsed.pomodoro.breakMinutes <= 180) pomodoroSettings.breakMinutes = parsed.pomodoro.breakMinutes; // 載入有效的休息時間設定。
    pomodoroRemainingMs = pomodoroSettings.focusMinutes * 60000; // 以已載入的專注設定初始化番茄鐘時間。
  } catch (error) { // 處理本機資料格式錯誤或瀏覽器儲存失敗。
    console.error('無法讀取校園時鐘設定：', error); // 將讀取錯誤明確記錄到瀏覽器主控台。
  } // 結束本機資料載入錯誤處理。
} // 結束設定載入函式。

function saveSettings() { // 將目前所有功能設定存入瀏覽器 localStorage。
  try { // 開始處理瀏覽器本機儲存資料。
    const settings = { exam: examSettings, schedule, autoBellEnabled, pomodoro: pomodoroSettings }; // 整理考試、課表與番茄鐘設定。
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); // 將設定序列化並寫入本機儲存。
  } catch (error) { // 處理瀏覽器儲存空間不可用或容量不足。
    console.error('無法儲存校園時鐘設定：', error); // 將儲存錯誤明確記錄到瀏覽器主控台。
  } // 結束本機資料儲存錯誤處理。
} // 結束設定儲存函式。

function getCountdown(now) { // 計算考試結束的剩餘分鐘數。
  if (!isValidTime(examSettings.end)) return { minutes: null }; // 結束時間未設定或格式無效時回傳空倒數。
  const [endHour, endMinute] = examSettings.end.split(':').map(Number); // 將結束時間拆分為小時與分鐘。
  const end = new Date(now); // 建立以今天為基準的結束時間。
  end.setHours(endHour, endMinute, 0, 0); // 設定考試結束時間的小時與分鐘。
  const startMatch = /^(\d{2}):(\d{2})$/.exec(examSettings.start); // 嘗試解析考試開始時間。
  if (startMatch) { // 開始時間有效時檢查是否跨越午夜。
    const startMinutes = Number(startMatch[1]) * 60 + Number(startMatch[2]); // 換算考試開始時間為當日分鐘數。
    const endMinutes = endHour * 60 + endMinute; // 換算考試結束時間為當日分鐘數。
    if (startMinutes > endMinutes && now.getHours() * 60 + now.getMinutes() >= startMinutes) end.setDate(end.getDate() + 1); // 午夜後開始的跨日考試將結束日推至隔天。
  } // 結束跨日考試判斷。
  return { minutes: Math.ceil((end.getTime() - now.getTime()) / 60000) }; // 回傳無條件進位的剩餘考試分鐘數。
} // 結束考試倒數計算函式。

function parseCount(value) { // 驗證並解析人數欄位的非負整數值。
  if (value === '' || !/^\d+$/.test(value)) return null; // 空值或非整數文字視為尚未輸入有效人數。
  const count = Number(value); // 將人數文字轉換為數字。
  return Number.isSafeInteger(count) ? count : null; // 僅回傳安全整數範圍內的人數。
} // 結束人數解析函式。

function isValidTime(value) { // 驗證時間是否為有效的二十四小時制時分字串。
  if (!/^\d{2}:\d{2}$/.test(value)) return false; // 格式不符合時分格式時回傳無效。
  const [hour, minute] = value.split(':').map(Number); // 將時間字串拆分為小時與分鐘。
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59; // 確認小時與分鐘範圍合法。
} // 結束時間格式驗證函式。

function toggleFullscreen() { // 切換考試大鐘投影使用的全螢幕模式。
  if (document.fullscreenElement) { document.exitFullscreen().catch(error => console.error('無法離開全螢幕模式：', error)); return; } // 已全螢幕時離開全螢幕模式。
  document.documentElement.requestFullscreen().catch(error => console.error('無法進入全螢幕模式：', error)); // 未全螢幕時要求瀏覽器進入全螢幕模式。
} // 結束全螢幕切換函式。

function updateFullscreenState() { // 依照瀏覽器全螢幕事件調整頁面狀態與畫布尺寸。
  document.body.classList.toggle('is-fullscreen', Boolean(document.fullscreenElement)); // 更新全螢幕 CSS 狀態樣式。
  if (examPanel && !examPanel.hidden) resizeCanvas(examPanel.querySelector('.exam-display').clientWidth || windowWidth, getDisplayHeight()); // 考試大鐘顯示時配合全螢幕尺寸調整畫布。
} // 結束全螢幕狀態更新函式。

function getDisplayHeight() { // 計算考試大鐘畫布的顯示高度。
  if (document.fullscreenElement) return window.innerHeight; // 全螢幕時使用整個視窗高度。
  const heightRatio = window.innerWidth <= 440 ? 0.64 : 0.67; // 依照行動裝置寬度調整畫布高度比例。
  return Math.max(420, Math.min(Math.floor(window.innerHeight * heightRatio), 680)); // 限制非全螢幕畫布的最小與最大高度。
} // 結束畫布高度計算函式。

function windowResized() { // 視窗尺寸改變時重新調整考試大鐘畫布。
  if (examPanel && !examPanel.hidden) resizeCanvas(examPanel.querySelector('.exam-display').clientWidth || windowWidth, getDisplayHeight()); // 只在考試頁面顯示時調整畫布尺寸。
} // 結束視窗尺寸變更函式。

function pad(value) { // 將小於十的時間數值補上前導零。
  return String(value).padStart(2, '0'); // 回傳至少兩位數的時間文字。
} // 結束時間補零函式。
