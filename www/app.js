/* ============================================================
 * 工时记 - 主逻辑
 * 数据格式: { "2026-09-08": 7.5, "2026-09-09": 11.5 }
 * ============================================================ */

const STORAGE_KEY = 'workHours';

// 状态
let currentViewYear;
let currentViewMonth; // 0-11
let selectedDateKey;  // 当前录入/编辑的日期 (默认今天)

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  currentViewYear = now.getFullYear();
  currentViewMonth = now.getMonth();
  selectedDateKey = formatDateKey(now);

  initEventListeners();
  renderAll();

  // 预填选中日期（默认今天）的工时到输入框
  syncInputToSelectedDate();

  // 聚焦输入框
  setTimeout(() => document.getElementById('hoursInput').focus(), 300);
});

/* ========== 数据层 ========== */

// 判断某天是否标记为休息
function isRest(value) {
  return value === 'rest';
}

// 判断某天是否有记录（工作日或休息天都算）
function hasRecord(value) {
  return value !== undefined && value !== null && value !== '';
}

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

function isToday(key) {
  return key === formatDateKey(new Date());
}

function formatDisplayDate(key) {
  const d = parseDateKey(key);
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
}

function formatShortDate(key) {
  const d = parseDateKey(key);
  const today = new Date();
  const todayKey = formatDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  if (key === todayKey) return '今天';
  if (key === yesterdayKey) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/* ========== 事件绑定 ========== */

function initEventListeners() {
  // 保存按钮 → 保存当前选中日期
  document.getElementById('btnSave').addEventListener('click', saveSelectedDate);

  // 输入框回车保存
  document.getElementById('hoursInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveSelectedDate();
  });

  // 快捷按钮
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('hoursInput').value = btn.dataset.hours;
      saveSelectedDate();
    });
  });

  // 日期选择器
  document.getElementById('datePicker').addEventListener('change', (e) => {
    selectedDateKey = e.target.value;
    syncInputToSelectedDate();
    renderAll();
  });

  // 回到今天按钮
  document.getElementById('pickToday').addEventListener('click', () => {
    selectedDateKey = formatDateKey(new Date());
    syncInputToSelectedDate();
    renderAll();
    document.getElementById('datePicker').value = selectedDateKey;
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

  // 切换休息天按钮
  const restBtn = document.getElementById('btnRest');
  if (restBtn) {
    restBtn.addEventListener('click', toggleRestForSelectedDate);
  }
}

function changeMonth(delta) {
  currentViewMonth += delta;
  if (currentViewMonth > 11) { currentViewMonth = 0; currentViewYear++; }
  if (currentViewMonth < 0) { currentViewMonth = 11; currentViewYear--; }
  renderAll();
}

function syncInputToSelectedDate() {
  const data = loadData();
  const val = data[selectedDateKey];
  const input = document.getElementById('hoursInput');

  if (isRest(val)) {
    input.value = '';
    input.placeholder = '休息';
    input.disabled = true;
  } else {
    input.value = hasRecord(val) ? val : '';
    input.placeholder = '0.0';
    input.disabled = false;
  }

  // 切换休息按钮状态
  const restBtn = document.getElementById('btnRest');
  if (restBtn) {
    restBtn.classList.toggle('active', isRest(val));
  }

  document.getElementById('inputDateLabel').textContent =
    isToday(selectedDateKey) ? '记录今天' : `记录 ${formatShortDate(selectedDateKey)}`;
  document.getElementById('datePicker').value = selectedDateKey;
}

/* ========== 业务函数 ========== */

function saveSelectedDate() {
  const data = loadData();
  const currentVal = data[selectedDateKey];

  // 如果当前是休息天，不允许保存工时（需先取消休息）
  if (isRest(currentVal)) {
    showToast('请先取消休息再输入工时');
    return;
  }

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

  const oldVal = currentVal;
  data[selectedDateKey] = roundTo(val);
  saveData(data);

  // 如果选中的日期不在当前月视图，跳过去
  const d = parseDateKey(selectedDateKey);
  if (d.getFullYear() !== currentViewYear || d.getMonth() !== currentViewMonth) {
    currentViewYear = d.getFullYear();
    currentViewMonth = d.getMonth();
  }

  renderAll();
  syncInputToSelectedDate();

  const label = isToday(selectedDateKey) ? '今天' : formatShortDate(selectedDateKey);
  showToast(oldVal !== undefined && !isRest(oldVal)
    ? `已更新 ${label}：${roundTo(val)}h`
    : `已记录 ${label}：${roundTo(val)}h ✅`);
}

// 切换休息天状态
function toggleRestForSelectedDate() {
  const data = loadData();
  const currentVal = data[selectedDateKey];
  const label = isToday(selectedDateKey) ? '今天' : formatShortDate(selectedDateKey);

  if (isRest(currentVal)) {
    // 取消休息 → 删除记录
    delete data[selectedDateKey];
    saveData(data);
    renderAll();
    syncInputToSelectedDate();
    showToast(`已取消 ${label} 的休息标记`);
  } else {
    // 设为休息
    data[selectedDateKey] = 'rest';
    saveData(data);
    renderAll();
    syncInputToSelectedDate();
    showToast(`${label} 标记为休息 💤`);
  }
}

function saveForDate(dateKey, hours) {
  const data = loadData();
  if (hours === null || hours === undefined || isNaN(hours) || hours <= 0) {
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
    // 如果删的是选中日期，清空输入框
    if (dateKey === selectedDateKey) {
      syncInputToSelectedDate();
    }
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
  renderSelectedDateInfo();
  renderCalendar();
  renderStats();
  renderDetailList();
}

function renderSelectedDateInfo() {
  document.getElementById('todayDate').textContent = formatDisplayDate(selectedDateKey);
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
    const value = data[dateKey];
    const weekday = dateObj.getDay();
    const isRestDay = isRest(value);
    const hasWorkHours = typeof value === 'number';

    // 标记
    if (hasWorkHours) cell.classList.add('has-hours');
    if (isRestDay) cell.classList.add('rest-day');
    if (isCurrentMonth && day === today.getDate()) cell.classList.add('today');
    if (weekday === 0 || weekday === 6) cell.classList.add('weekend');
    if (dateKey === selectedDateKey) cell.classList.add('selected');

    // 内容
    const numSpan = document.createElement('span');
    numSpan.className = 'day-num';
    numSpan.textContent = day;
    cell.appendChild(numSpan);

    if (isRestDay) {
      // 休息天 → 显示"休"
      const restSpan = document.createElement('span');
      restSpan.className = 'day-rest';
      restSpan.textContent = '休';
      cell.appendChild(restSpan);
    } else if (hasWorkHours) {
      const hSpan = document.createElement('span');
      hSpan.className = 'day-hours';
      hSpan.textContent = `${value}h`;
      cell.appendChild(hSpan);
    } else {
      // 没记录也显示一个 + 提示可补录
      const plusSpan = document.createElement('span');
      plusSpan.className = 'day-plus';
      plusSpan.textContent = '+';
      cell.appendChild(plusSpan);
    }

    // 点击 → 弹出编辑框（可补录/修改/删除）
    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      openDateEditor(dateKey);
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
  let workDays = 0;
  let restDays = 0;

  Object.entries(data).forEach(([key, value]) => {
    const d = parseDateKey(key);
    if (d.getFullYear() === currentViewYear && d.getMonth() === currentViewMonth) {
      if (isRest(value)) {
        restDays++;
      } else if (typeof value === 'number') {
        total += value;
        workDays++;
      }
    }
  });

  const avg = workDays > 0 ? total / workDays : 0;

  document.getElementById('statMonthTotal').textContent = roundTo(total, 1).toFixed(1);
  document.getElementById('statDays').textContent = workDays;
  document.getElementById('statAvg').textContent = roundTo(avg, 1).toFixed(1);
  const restEl = document.getElementById('statRestDays');
  if (restEl) restEl.textContent = restDays;
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
        本月还没有记录<br>点日历上任意日期开始补录吧
      </div>`;
    return;
  }

  list.innerHTML = entries.map(([key, value]) => {
    const d = parseDateKey(key);
    const isRestEntry = isRest(value);
    const hoursDisplay = isRestEntry
      ? '<span class="detail-rest">休息 💤</span>'
      : `<span class="detail-hours">${value}h</span>`;
    return `
      <div class="detail-item" data-key="${key}">
        <span class="detail-date">
          ${d.getMonth() + 1}月${d.getDate()}日
          <span class="weekday">周${weekdays[d.getDay()]}</span>
        </span>
        ${hoursDisplay}
        <button class="detail-edit" data-key="${key}" title="修改">✏️</button>
        <button class="detail-delete" data-key="${key}" title="删除">🗑</button>
      </div>`;
  }).join('');

  // 绑定点击编辑
  list.querySelectorAll('.detail-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('detail-delete') || e.target.classList.contains('detail-edit')) return;
      openDateEditor(item.dataset.key);
    });
  });

  // 绑定删除
  list.querySelectorAll('.detail-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.key;
      const d = parseDateKey(key);
      const data = loadData();
      const value = data[key];
      const desc = isRest(value) ? '休息标记' : `${value} 小时`;
      showConfirm(
        `${d.getMonth() + 1}月${d.getDate()}日 的 ${desc}，删除吗？`,
        () => deleteDate(key)
      );
    });
  });

  // 绑定编辑
  list.querySelectorAll('.detail-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDateEditor(btn.dataset.key);
    });
  });
}

/* ========== 日期编辑模态框 ========== */

function openDateEditor(dateKey) {
  const data = loadData();
  const existing = data[dateKey];
  const d = parseDateKey(dateKey);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const shortLabel = formatShortDate(dateKey);
  const isRestEntry = isRest(existing);
  const isEdit = hasRecord(existing);

  // 移除已有
  const existingModal = document.querySelector('.modal-overlay');
  if (existingModal) existingModal.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay date-editor';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">
        ${isEdit ? (isRestEntry ? '修改状态' : '修改工时') : '补录工时'}
      </div>
      <div class="modal-subtitle">
        ${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${weekdays[d.getDay()]}
        ${isToday(dateKey) ? '<span class="badge-today">今天</span>' : ''}
        ${dateKey > formatDateKey(new Date()) ? '<span class="badge-future">未来</span>' : ''}
      </div>
      <div class="modal-body">
        <div class="editor-rest-row">
          <button class="editor-rest-btn ${isRestEntry ? 'active' : ''}" id="editorRestToggle">
            ${isRestEntry ? '✓ 休息日 (已标记)' : '💤 标记为休息日'}
          </button>
        </div>
        <div class="editor-input-row" id="editorHoursRow" style="${isRestEntry ? 'opacity: 0.4; pointer-events: none;' : ''}">
          <input
            type="number"
            class="editor-input"
            id="editorHours"
            placeholder="0.0"
            step="0.5"
            min="0"
            max="24"
            inputmode="decimal"
            value="${typeof existing === 'number' ? existing : ''}"
          />
          <span class="unit">小时</span>
        </div>
        <div class="editor-quick-row" id="editorQuickRow" style="${isRestEntry ? 'opacity: 0.4; pointer-events: none;' : ''}">
          <button class="editor-quick" data-hours="4">4h</button>
          <button class="editor-quick" data-hours="6">6h</button>
          <button class="editor-quick" data-hours="7.5">7.5h</button>
          <button class="editor-quick" data-hours="8">8h</button>
          <button class="editor-quick" data-hours="11.5">11.5h</button>
        </div>
      </div>
      <div class="modal-actions">
        ${isEdit ? '<button class="modal-btn modal-btn-danger" id="editorDelete">删除</button>' : ''}
        <button class="modal-btn modal-btn-cancel">取消</button>
        <button class="modal-btn modal-btn-confirm" id="editorSave">
          ${isEdit && !isRestEntry ? '保存修改' : '保存'}
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  // 聚焦输入框（如果不是休息状态）
  setTimeout(() => {
    if (!isRestEntry) {
      const input = document.getElementById('editorHours');
      input.focus();
      input.select();
    }
  }, 100);

  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 200);
  };

  // 休息切换按钮
  let restState = isRestEntry;
  const restToggle = document.getElementById('editorRestToggle');
  const hoursRow = document.getElementById('editorHoursRow');
  const quickRow = document.getElementById('editorQuickRow');
  restToggle.addEventListener('click', () => {
    restState = !restState;
    restToggle.classList.toggle('active', restState);
    restToggle.textContent = restState ? '✓ 休息日 (已标记)' : '💤 标记为休息日';
    if (restState) {
      hoursRow.style.opacity = 0.4;
      hoursRow.style.pointerEvents = 'none';
      quickRow.style.opacity = 0.4;
      quickRow.style.pointerEvents = 'none';
    } else {
      hoursRow.style.opacity = 1;
      hoursRow.style.pointerEvents = '';
      quickRow.style.opacity = 1;
      quickRow.style.pointerEvents = '';
      document.getElementById('editorHours').focus();
    }
  });

  // 快捷按钮
  overlay.querySelectorAll('.editor-quick').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('editorHours').value = btn.dataset.hours;
    });
  });

  // 回车保存
  document.getElementById('editorHours').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSave();
    if (e.key === 'Escape') close();
  });

  // 保存
  function doSave() {
    const data = loadData();

    if (restState) {
      // 保存为休息
      const oldVal = data[dateKey];
      data[dateKey] = 'rest';
      saveData(data);
      if (dateKey === selectedDateKey) syncInputToSelectedDate();
      showToast(isRest(oldVal)
        ? `${shortLabel} 已是休息`
        : `${shortLabel} 标记为休息 💤`);
      close();
      renderAll();
      return;
    }

    // 保存工时
    const input = document.getElementById('editorHours');
    const val = parseFloat(input.value);
    if (isNaN(val) || val < 0 || val > 24) {
      showToast('请输入 0-24 之间的有效数字');
      return;
    }
    const oldVal = data[dateKey];
    saveForDate(dateKey, val);
    // 如果编辑的是当前选中日期，同步顶部输入框
    if (dateKey === selectedDateKey) syncInputToSelectedDate();
    const wasRest = isRest(oldVal);
    showToast(wasRest
      ? `已改为 ${shortLabel}：${roundTo(val)}h`
      : (hasRecord(oldVal) ? `已更新 ${shortLabel}：${roundTo(val)}h` : `已记录 ${shortLabel}：${roundTo(val)}h ✅`));
    close();
  }

  document.getElementById('editorSave').addEventListener('click', doSave);

  // 删除
  const delBtn = document.getElementById('editorDelete');
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      close();
      const desc = isRest(existing) ? '休息标记' : `${existing} 小时`;
      showConfirm(
        `${d.getMonth() + 1}月${d.getDate()}日 的 ${desc}，删除吗？`,
        () => {
          deleteDate(dateKey);
          if (dateKey === selectedDateKey) syncInputToSelectedDate();
        }
      );
    });
  }

  // 取消/点击遮罩关闭
  overlay.querySelector('.modal-btn-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
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
  const existing = document.querySelector('.modal-overlay:not(.date-editor)');
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
