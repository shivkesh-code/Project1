/* ============================================================
   AI Task Manager — app.js
   Uses Anthropic claude-sonnet-4-20250514 directly from the browser
   ============================================================ */

let tasks = [];

/* ── Render ─────────────────────────────────────────────── */

function renderTasks() {
  const list  = document.getElementById('taskList');
  const count = document.getElementById('taskCount');
  count.textContent = tasks.length;

  if (tasks.length === 0) {
    list.innerHTML = '<div class="empty">no tasks yet — add one above or let AI help</div>';
    return;
  }

  list.innerHTML = '';

  tasks.forEach((task, i) => {
    const item = document.createElement('div');
    item.className = 'task-item';

    const check = document.createElement('div');
    check.className = 'task-check' + (task.done ? ' done' : '');
    check.onclick = () => toggleDone(i);

    const text = document.createElement('div');
    text.className = 'task-text' + (task.done ? ' done' : '');
    text.textContent = task.text;

    const del = document.createElement('button');
    del.className = 'btn-del';
    del.textContent = '×';
    del.onclick = () => deleteTask(i);

    item.appendChild(check);
    item.appendChild(text);
    item.appendChild(del);
    list.appendChild(item);
  });
}

/* ── Task CRUD ───────────────────────────────────────────── */

function addTask(text) {
  const input = document.getElementById('taskInput');
  const val = (text || input.value).trim();
  if (!val) return;
  tasks.push({ text: val, done: false });
  input.value = '';
  renderTasks();
}

function deleteTask(i) {
  tasks.splice(i, 1);
  renderTasks();
}

function toggleDone(i) {
  tasks[i].done = !tasks[i].done;
  renderTasks();
}

/* ── UI Helpers ──────────────────────────────────────────── */

function showToast(msg, accent = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (accent ? ' accent' : '') + ' show';
  setTimeout(() => { t.className = 'toast' + (accent ? ' accent' : ''); }, 3000);
}

function setLoading(btnId, on) {
  const btn = document.getElementById(btnId);
  if (on) {
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

/* ── Anthropic API ───────────────────────────────────────── */

async function callClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');
}

/* ── AI Features ─────────────────────────────────────────── */

async function aiSuggest() {
  const input = document.getElementById('taskInput');
  if (!input.value.trim()) { showToast('Enter a task first'); return; }

  setLoading('btnSuggest', true);
  try {
    const result = await callClaude(
      `Rewrite this task to be clearer, more actionable, and specific. ` +
      `Return ONLY the improved task text — no explanation, no quotes, no extra punctuation.\n\n` +
      `Task: ${input.value}`
    );
    input.value = result.trim();
    showToast('Task improved ✨', true);
  } catch (e) {
    console.error('aiSuggest error:', e);
    showToast('Error: ' + e.message);
  } finally {
    setLoading('btnSuggest', false);
  }
}

async function aiSummarize() {
  const input = document.getElementById('taskInput');
  if (!input.value.trim()) { showToast('Enter a task first'); return; }

  setLoading('btnSummarize', true);
  try {
    const result = await callClaude(
      `Condense this task into a short, punchy 3–7 word version. ` +
      `Return ONLY the shortened task — no explanation, no quotes.\n\n` +
      `Task: ${input.value}`
    );
    input.value = result.trim();
    showToast('Task summarized 🧠', true);
  } catch (e) {
    console.error('aiSummarize error:', e);
    showToast('Error: ' + e.message);
  } finally {
    setLoading('btnSummarize', false);
  }
}

async function aiBreakdown() {
  const input = document.getElementById('taskInput');
  if (!input.value.trim()) { showToast('Enter a task first'); return; }

  setLoading('btnBreakdown', true);
  try {
    const result = await callClaude(
      `Break this task into 3–5 concrete, actionable sub-tasks. ` +
      `Return ONLY a JSON array of strings — no markdown fences, no explanation.\n` +
      `Example output: ["Sub-task one","Sub-task two","Sub-task three"]\n\n` +
      `Task: ${input.value}`
    );

    const clean = result.replace(/```json|```/g, '').trim();
    const subtasks = JSON.parse(clean);

    subtasks.forEach(t => tasks.push({ text: t, done: false }));
    input.value = '';
    renderTasks();
    showToast(`Added ${subtasks.length} sub-tasks 🔀`, true);
  } catch (e) {
    console.error('aiBreakdown error:', e);
    showToast('Error: ' + e.message);
  } finally {
    setLoading('btnBreakdown', false);
  }
}

async function aiPriority() {
  if (tasks.length < 2) { showToast('Add at least 2 tasks first'); return; }

  setLoading('btnPriority', true);
  try {
    const taskList = tasks.map((t, i) => `${i}: ${t.text}`).join('\n');
    const result = await callClaude(
      `Reorder these tasks by priority (most important first). ` +
      `Return ONLY a JSON array of the original task indices in the new order — no markdown, no explanation.\n` +
      `Example output: [2,0,1]\n\n` +
      `Tasks:\n${taskList}`
    );

    const clean = result.replace(/```json|```/g, '').trim();
    const order = JSON.parse(clean);
    const reordered = order.map(i => tasks[i]).filter(Boolean);

    if (reordered.length === tasks.length) {
      tasks = reordered;
      renderTasks();
      showToast('List prioritized ⚡', true);
    } else {
      showToast('Could not reorder — try again');
    }
  } catch (e) {
    console.error('aiPriority error:', e);
    showToast('Error: ' + e.message);
  } finally {
    setLoading('btnPriority', false);
  }
}

/* ── Init ────────────────────────────────────────────────── */

document.getElementById('taskInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

renderTasks();