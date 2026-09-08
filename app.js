/* ============================================================
 * 工时记 - 主逻辑
 * 数据格式: { "2026-09-08": 7.5, "2026-09-09": 11.5 }
 * ============================================================ */

const STORAGE_KEY = 'workHours';

// 状态
let currentViewYear;
let currentViewMonth; // 0-11

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  currentViewYear = now.getFullYear();
  currentViewMonth = now.getMonth();

  initEventListeners();
  renderAll();

  // 预填今天的日期到输入框（如果已有记录则显示）
  const todayKey = formatDateKey(now);
  const data = loadData();
  if (data[todayKey] !== undefined) {
    document.getElementById('hoursInput').value = data[todayKey];
  }

  // 聚焦输入框
  setTimeout(() => document.getElementById('hoursInput').focus(), 300);
});

/* ========== 数据层 ========== */

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('读取数据失败:', e);
    return {};
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function roundTo(n, digits = 1) {
  return Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits);
}

/* ========== 事件绑定 ========== */

function initEventListeners() {
  // 保存按钮
  document.getElementById('btnSave').addEventListener('click', saveToday);

  // 输入框回车保存
  document.getElementById('hoursInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveToday();
  });

  // 快捷按钮
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('hoursInput').value = btn.dataset.hours;
      saveToday();
    });
  });

  // 月份切换
  document.getElementById('prevMonth').addEventListener('click', () => {
    changeMonth(-1);
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    changeMonth(1);
  });
  document.getElementById('goToday').addEventListener('click', () => {
    const now = new Date();
    currentViewYear = now.getFullYear();
    currentViewMonth = now.getMonth();
    renderAll();
  });

  // 清空本月
  document.getElementById('btnClear').addEventListener('click', () => {
    const count = countDaysInMonth(currentViewYear, currentViewMonth);
    if (count === 0) {
      showToast('本月没有记录');
      return;
    }
    showConfirm(`确定要清空 ${currentViewYear}年${currentViewMonth + 1}月 的全部 ${count} 条记录吗？`, () => {
      clearMonthData(currentViewYear, currentViewMonth);
      renderAll();
      showToast('已清空');
    });
  });

  // 导出
  document.getElementById('btnExport').addEventListener('click', exportData);
}

function changeMonth(delta) {
  currentViewMonth += delta;
  if (currentViewMonth > 11) { currentViewMonth = 0; currentViewYear++; }
  if (currentViewMonth < 0) { currentViewMonth = 11; currentViewYear--; }
  renderAll();
}

/* ========== 业务函数 ========== */

function saveToday() {
  const input = document.getElementById('hoursInput');
  const val = parseFloat(input.value);

  if (isNaN(val)) {
    showToast('请输入有效数字');
    return;
  }
  if (val < 0) {
    showToast('不能为负数');
    return;
  }
  if (val > 24) {
    showToast('一天最多24小时');
    return;
  }

  const now = new Date();
  const key = formatDateKey(now);
  const data = loadData();
  const oldVal = data[key];
  data[key] = roundTo(val);
  saveData(data);

  // 如果当前月视图不是本月，切换到本月
  if (currentViewYear !== now.getFullYear() || currentViewMonth !== now.getMonth()) {
    currentViewYear = now.getFullYear();
    currentViewMonth = now.getMonth();
  }

  renderAll();
  showToast(oldVal !== undefined ? `已更新：${roundTo(val)}h` : `已记录：${roundTo(val)}h ✅`);
  input.value = roundTo(val);
}

function saveForDate(dateKey, hours) {
  const data = loadData();
  if (hours === null || hours === undefined || hours <= 0) {
    delete data[dateKey];
  } else {
    data[dateKey] = roundTo(hours);
  }
  saveData(data);
  renderAll();
}

function deleteDate(dateKey) {
  const data = loadData();
  if (data[dateKey] !== undefined) {
    delete data[dateKey];
    saveData(data);
    renderAll();
    showToast('已删除');
  }
}

function countDaysInMonth(year, month) {
  const data = loadData();
  let count = 0;
  Object.keys(data).forEach(key => {
    const d = parseDateKey(key);
    if (d.getFullYear() === year && d.getMonth() === month) count++;
  });
  return count;
}

function clearMonthData(year, month) {
  const data = loadData();
  const newData = {};
  Object.keys(data).forEach(key => {
    const d = parseDateKey(key);
    if (!(d.getFullYear() === year && d.getMonth() === month)) {
      newData[key] = data[key];
    }
  });
  saveData(newData);
}

/* ========== 渲染 ========== */

function renderAll() {
  renderTodayDate();
  renderCalendar();
  renderStats();
  renderDetailList();
}

function renderTodayDate() {
  const now = new Date();
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  document.getElementById('todayDate').textContent =
    `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;
}

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const title = document.getElementById('calendarTitle');
  const data = loadData();

  title.textContent = `${currentViewYear}年${currentViewMonth + 1}月`;

  const firstDay = new Date(currentViewYear, currentViewMonth, 1);
  const lastDay = new Date(currentViewYear, currentViewMonth + 1, 0);
  const startWeekday = firstDay.getDay(); // 0-6, 周日开始
  const daysInMonth = lastDay.getDate();

  const today = new Date();
  const isCurrentMonth = (
    today.getFullYear() === currentViewYear &&
    today.getMonth() === currentViewMonth
  );

  grid.innerHTML = '';

  // 前置空格
  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }

  // 每一天
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day';

    const dateObj = new Date(currentViewYear, currentViewMonth, day);
    const dateKey = formatDateKey(dateObj);
    const hours = data[dateKey];
    const weekday = dateObj.getDay();

    // 标记
    if (hours !== undefined) cell.classList.add('has-hours');
    if (isCurrentMonth && day === today.getDate()) cell.classList.add('today');
    if (weekday === 0 || weekday === 6) cell.classList.add('weekend');

    // 内容
    const numSpan = document.createElement('span');
    numSpan.className = 'day-num';
    numSpan.textContent = day;
    cell.appendChild(numSpan);

    if (hours !== undefined) {
      const hSpan = document.createElement('span');
      hSpan.className = 'day-hours';
      hSpan.textContent = `${hours}h`;
      cell.appendChild(hSpan);
    }

    // 点击：如果有记录则弹出删除确认；否则聚焦到今日输入框
    cell.addEventListener('click', () => {
      if (hours !== undefined) {
        showConfirm(
          `${currentViewMonth + 1}月${day}日 记录了 ${hours} 小时，删除吗？`,
          () => deleteDate(dateKey)
        );
      } else {
        // 切换到该月份并提示
        showToast(`${currentViewMonth + 1}月${day}日：暂无记录`);
      }
    });

    grid.appendChild(cell);
  }

  // 后置空格，让最后一周完整
  const totalCells = startWeekday + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < trailing; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }
}

function renderStats() {
  const data = loadData();
  let total = 0;
  let days = 0;

  Object.entries(data).forEach(([key, hours]) => {
    const d = parseDateKey(key);
    if (d.getFullYear() === currentViewYear && d.getMonth() === currentViewMonth) {
      total += hours;
      days++;
    }
  });

  const avg = days > 0 ? total / days : 0;

  document.getElementById('statMonthTotal').textContent = roundTo(total, 1).toFixed(1);
  document.getElementById('statDays').textContent = days;
  document.getElementById('statAvg').textContent = roundTo(avg, 1).toFixed(1);
}

function renderDetailList() {
  const list = document.getElementById('detailList');
  const data = loadData();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  // 筛选当前月并排序
  const entries = Object.entries(data)
    .filter(([key]) => {
      const d = parseDateKey(key);
      return d.getFullYear() === currentViewYear && d.getMonth() === currentViewMonth;
    })
    .sort((a, b) => b[0].localeCompare(a[0])); // 日期倒序

  if (entries.length === 0) {
    list.innerHTML = `
      <div class="empty-tip">
        <span class="empty-icon">📭</span>
        本月还没有记录<br>在上方输入今天的工作时长吧
      </div>`;
    return;
  }

  list.innerHTML = entries.map(([key, hours]) => {
    const d = parseDateKey(key);
    return `
      <div class="detail-item">
        <span class="detail-date">
          ${d.getMonth() + 1}月${d.getDate()}日
          <span class="weekday">周${weekdays[d.getDay()]}</span>
        </span>
        <span class="detail-hours">${hours}h</span>
        <button class="detail-delete" data-key="${key}" title="删除">🗑</button>
      </div>`;
  }).join('');

  // 绑定删除
  list.querySelectorAll('.detail-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.key;
      const d = parseDateKey(key);
      const data = loadData();
      const hours = data[key];
      showConfirm(
        `${d.getMonth() + 1}月${d.getDate()}日 的 ${hours} 小时，删除吗？`,
        () => deleteDate(key)
      );
    });
  });
}

/* ========== 导出 ========== */

function exportData() {
  const data = loadData();
  const count = Object.keys(data).length;
  if (count === 0) {
    showToast('暂无数据可导出');
    return;
  }

  // 计算总时长
  let total = 0;
  Object.values(data).forEach(h => total += h);

  const blob = new Blob(
    [JSON.stringify({ exportedAt: new Date().toISOString(), totalHours: roundTo(total), totalDays: count, records: data }, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `工时记录_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('已导出 JSON 文件');
}

/* ========== 通用 UI ========== */

let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

function showConfirm(message, onConfirm) {
  // 移除已有
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">确认操作</div>
      <div class="modal-body">${message}</div>
      <div class="modal-actions">
        <button class="modal-btn modal-btn-cancel">取消</button>
        <button class="modal-btn modal-btn-confirm">确定</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // 动画
  requestAnimationFrame(() => overlay.classList.add('show'));

  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector('.modal-btn-cancel').addEventListener('click', close);
  overlay.querySelector('.modal-btn-confirm').addEventListener('click', () => {
    onConfirm();
    close();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}
