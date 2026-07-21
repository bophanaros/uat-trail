const STORAGE_KEY = 'uat-trail-results-v1';
const TESTER_KEY = 'uat-trail-tester-v1';

const state = {
  catalog: null,
  selectedEpicId: null,
  selectedMissionId: null,
  results: loadResults(),
};

const els = {
  epicList: document.getElementById('epicList'),
  epicDetail: document.getElementById('epicDetail'),
  testerName: document.getElementById('testerName'),
  exportBtn: document.getElementById('exportBtn'),
  clearBtn: document.getElementById('clearBtn'),
  toast: document.getElementById('toast'),
};

els.testerName.value = localStorage.getItem(TESTER_KEY) || '';
els.testerName.addEventListener('change', () => {
  localStorage.setItem(TESTER_KEY, els.testerName.value.trim());
});

els.exportBtn.addEventListener('click', exportResults);
els.clearBtn.addEventListener('click', clearMyResults);

init();

async function init() {
  const res = await fetch('./data/epics.json');
  state.catalog = await res.json();
  if (!state.selectedEpicId && state.catalog.epics.length) {
    state.selectedEpicId = state.catalog.epics[0].id;
  }
  render();
}

function loadResults() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveResults() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.results));
}

function resultKey(epicId, missionId) {
  const tester = (els.testerName.value || 'anonymous').trim().toLowerCase();
  return `${tester}::${epicId}::${missionId}`;
}

function getResult(epicId, missionId) {
  return state.results[resultKey(epicId, missionId)] || null;
}

function selectedEpic() {
  return state.catalog?.epics.find((e) => e.id === state.selectedEpicId);
}

function selectedMission() {
  return selectedEpic()?.missions.find((m) => m.id === state.selectedMissionId);
}

function epicProgress(epic) {
  let passed = 0;
  let failed = 0;
  let pending = 0;
  for (const mission of epic.missions) {
    const outcome = getResult(epic.id, mission.id)?.outcome;
    if (outcome === 'Pass') passed += 1;
    else if (outcome === 'Fail') failed += 1;
    else pending += 1;
  }
  return { passed, failed, pending, total: epic.missions.length };
}

function render() {
  renderEpics();
  renderDetail();
}

function renderEpics() {
  const epics = state.catalog?.epics || [];
  els.epicList.innerHTML = epics
    .map((epic) => {
      const p = epicProgress(epic);
      const selected = epic.id === state.selectedEpicId ? 'selected' : '';
      return `
        <button class="epic-card ${selected}" data-epic="${epic.id}" type="button">
          <strong>${escapeHtml(epic.jiraKey)} · ${escapeHtml(epic.name)}</strong>
          <div class="meta">${p.passed}/${p.total} passed · ${escapeHtml(epic.targetOrg)}</div>
        </button>
      `;
    })
    .join('');

  els.epicList.querySelectorAll('[data-epic]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedEpicId = btn.dataset.epic;
      state.selectedMissionId = null;
      render();
    });
  });
}

function renderTesterPlan(epic) {
  const plan = epic.testerPlan;
  if (!plan) return '';
  const count = plan.howMany ? `${plan.howMany} testers · same missions` : 'Shared missions';
  return `
    <div class="tester-plan">
      <p class="section-label">${escapeHtml(count)}</p>
      <p class="meta">${escapeHtml(plan.note)}</p>
    </div>
  `;
}

function renderDetail() {
  const epic = selectedEpic();
  if (!epic) {
    els.epicDetail.innerHTML = `<div class="empty">Select an epic to start.</div>`;
    return;
  }

  const progress = epicProgress(epic);
  const mission = selectedMission();

  els.epicDetail.innerHTML = `
    <div class="detail-header">
      <div>
        <h1>${escapeHtml(epic.name)}</h1>
        <p class="meta">
          <a href="${escapeAttr(epic.jiraUrl)}" target="_blank" rel="noreferrer">${escapeHtml(epic.jiraKey)}</a>
          · hands-on in ${escapeHtml(epic.targetOrg)}
        </p>
      </div>
      <div class="progress">${progress.passed} passed · ${progress.failed} failed · ${progress.pending} pending</div>
    </div>
    <p class="goal">${escapeHtml(epic.summary)}</p>
    ${renderTesterPlan(epic)}

    <div style="margin-top:1.1rem">
      <p class="section-label">Missions</p>
      <div class="mission-list">
        ${epic.missions
          .map((m) => {
            const outcome = getResult(epic.id, m.id)?.outcome || 'Pending';
            const badge =
              outcome === 'Pass'
                ? 'badge-pass'
                : outcome === 'Fail'
                  ? 'badge-fail'
                  : 'badge-pending';
            const selected = m.id === state.selectedMissionId ? 'selected' : '';
            return `
              <button class="mission-card ${selected}" data-mission="${m.id}" type="button">
                <div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:flex-start">
                  <strong>${escapeHtml(m.name)}</strong>
                  <span class="badge ${badge}">${escapeHtml(outcome)}</span>
                </div>
                <div class="meta">${escapeHtml(m.role)} · ~${m.estimatedMinutes} min</div>
              </button>
            `;
          })
          .join('')}
      </div>
    </div>

    ${mission ? renderMission(epic, mission) : `<div class="empty" style="margin-top:1rem">Pick a mission.</div>`}
  `;

  els.epicDetail.querySelectorAll('[data-mission]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedMissionId = btn.dataset.mission;
      render();
    });
  });

  const form = els.epicDetail.querySelector('#resultForm');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitResult(epic.id, mission.id, new FormData(form));
    });
  }
}

function renderMission(epic, mission) {
  const existing = getResult(epic.id, mission.id) || {};
  const links = (mission.recordLinks || [])
    .map(
      (link) =>
        `<a class="link-chip" href="${escapeAttr(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`
    )
    .join('');

  return `
    <section class="mission-detail" style="margin-top:1.25rem">
      <div>
        <p class="section-label">Goal</p>
        <p class="goal">${escapeHtml(mission.goal)}</p>
      </div>
      <div>
        <p class="section-label">Done when</p>
        <p class="meta">${escapeHtml(mission.doneWhen)}</p>
      </div>
      <div>
        <p class="section-label">Steps</p>
        <ol class="steps">
          ${mission.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
        </ol>
      </div>
      ${links ? `<div><p class="section-label">Open in Staging</p><div class="links">${links}</div></div>` : ''}

      <form class="form" id="resultForm">
        <div class="row two">
          <label>
            Outcome
            <select name="outcome" required>
              <option value="Pass" ${existing.outcome === 'Pass' ? 'selected' : ''}>Pass</option>
              <option value="Fail" ${existing.outcome === 'Fail' ? 'selected' : ''}>Fail</option>
            </select>
          </label>
          <label>
            Feedback type
            <select name="feedbackType">
              <option value="None" ${!existing.feedbackType || existing.feedbackType === 'None' ? 'selected' : ''}>None</option>
              <option value="Broken" ${existing.feedbackType === 'Broken' ? 'selected' : ''}>Broken (bug)</option>
              <option value="Improve" ${existing.feedbackType === 'Improve' ? 'selected' : ''}>Improve (UX/process)</option>
            </select>
          </label>
        </div>
        <label>
          Notes
          <textarea name="notes" placeholder="What you saw, evidence, blockers…">${escapeHtml(existing.notes || '')}</textarea>
        </label>
        <label>
          Evidence URL
          <input name="evidenceUrl" type="url" placeholder="https://…" value="${escapeAttr(existing.evidenceUrl || '')}" />
        </label>
        <div class="form-actions">
          <button class="btn btn-lime" type="submit">Save result</button>
          <span class="meta">Saved in this browser · export to share</span>
        </div>
      </form>
    </section>
  `;
}

function submitResult(epicId, missionId, formData) {
  const tester = els.testerName.value.trim() || 'anonymous';
  localStorage.setItem(TESTER_KEY, tester);

  state.results[resultKey(epicId, missionId)] = {
    epicId,
    missionId,
    tester,
    outcome: formData.get('outcome'),
    feedbackType: formData.get('feedbackType') || 'None',
    notes: String(formData.get('notes') || '').trim(),
    evidenceUrl: String(formData.get('evidenceUrl') || '').trim(),
    submittedAt: new Date().toISOString(),
  };
  saveResults();
  showToast('Result saved');
  render();
}

function exportResults() {
  const payload = {
    exportedAt: new Date().toISOString(),
    tester: els.testerName.value.trim() || 'anonymous',
    results: Object.values(state.results),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `uat-trail-results-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported JSON');
}

function clearMyResults() {
  const tester = (els.testerName.value || 'anonymous').trim().toLowerCase();
  const prefix = `${tester}::`;
  let removed = 0;
  for (const key of Object.keys(state.results)) {
    if (key.startsWith(prefix)) {
      delete state.results[key];
      removed += 1;
    }
  }
  saveResults();
  showToast(removed ? `Cleared ${removed} result(s)` : 'Nothing to clear');
  render();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", '&#39;');
}
