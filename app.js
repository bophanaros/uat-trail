const STORAGE_KEY = 'uat-trail-results-v1';
const TESTER_KEY = 'uat-trail-tester-v1';
const CHECKLIST_KEY = 'uat-trail-checklist-v1';
const STEP_RESULTS_KEY = 'uat-trail-step-results-v1';

const CATCH_LINES = [
  'You found the glitch in the matrix',
  'Boss fight unlocked — note what broke',
  'Detective mode: on',
  'Bug spotted. Evidence time.',
  'Nice eyes — write it down before it escapes',
  'Quest continues: capture expected vs actual',
];

const state = {
  catalog: null,
  selectedEpicId: null,
  selectedMissionId: null,
  results: loadResults(),
  checklists: loadChecklists(),
  stepResults: loadStepResults(),
  pendingStepNotesFocus: null,
};

const RESULTS_INBOX = 'bophana.ros@bolt.eu';
const FORMSUBMIT_ENDPOINT = `https://formsubmit.co/ajax/${RESULTS_INBOX}`;

const els = {
  epicList: document.getElementById('epicList'),
  epicDetail: document.getElementById('epicDetail'),
  testerName: document.getElementById('testerName'),
  submitBtn: document.getElementById('submitBtn'),
  clearBtn: document.getElementById('clearBtn'),
  toast: document.getElementById('toast'),
  fireworks: document.getElementById('fireworks'),
  bugCatchScene: document.getElementById('bugCatchScene'),
  catchChip: document.getElementById('catchChip'),
  catchLine: document.getElementById('catchLine'),
  certificateModal: document.getElementById('certificateModal'),
  certTesterName: document.getElementById('certTesterName'),
  certFeatureName: document.getElementById('certFeatureName'),
  certFootDate: document.getElementById('certFootDate'),
  certPrintBtn: document.getElementById('certPrintBtn'),
  certCloseBtn: document.getElementById('certCloseBtn'),
};

els.testerName.value = localStorage.getItem(TESTER_KEY) || '';
els.testerName.addEventListener('input', () => {
  updateSubmitAvailability();
});
els.testerName.addEventListener('change', () => {
  localStorage.setItem(TESTER_KEY, els.testerName.value.trim());
  render();
});

els.submitBtn?.addEventListener('click', () => submitResults());
els.clearBtn.addEventListener('click', clearMyResults);
els.certPrintBtn?.addEventListener('click', () => window.print());
els.certCloseBtn?.addEventListener('click', closeCertificate);
els.certificateModal?.addEventListener('click', (event) => {
  if (event.target === els.certificateModal) closeCertificate();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && els.certificateModal && !els.certificateModal.hidden) {
    closeCertificate();
  }
});

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

function loadChecklists() {
  try {
    return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}');
  } catch {
    return {};
  }
}

function loadStepResults() {
  try {
    return JSON.parse(localStorage.getItem(STEP_RESULTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveResults() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.results));
}

function saveChecklists() {
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state.checklists));
}

function saveStepResults() {
  localStorage.setItem(STEP_RESULTS_KEY, JSON.stringify(state.stepResults));
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

function missionStatus(epicId, missionId) {
  const mission = state.catalog?.epics
    .find((epic) => epic.id === epicId)
    ?.missions.find((item) => item.id === missionId);
  if (!mission?.steps?.length) return 'Pending';

  const results = state.stepResults[resultKey(epicId, missionId)] || {};
  const outcomes = mission.steps.map((_, index) => results[String(index)]?.outcome);
  if (outcomes.includes('Fail')) return 'Fail';
  if (outcomes.every((outcome) => outcome === 'Pass')) return 'Pass';
  if (outcomes.some(Boolean)) return 'In Progress';
  return 'Pending';
}

function missionStepProgress(epicId, mission) {
  const results = state.stepResults[resultKey(epicId, mission.id)] || {};
  let passed = 0;
  let failed = 0;
  for (let index = 0; index < mission.steps.length; index += 1) {
    const outcome = results[String(index)]?.outcome;
    if (outcome === 'Pass') passed += 1;
    if (outcome === 'Fail') failed += 1;
  }
  return { passed, failed, answered: passed + failed, total: mission.steps.length };
}

function epicProgress(epic) {
  let passed = 0;
  let failed = 0;
  let inProgress = 0;
  let pending = 0;
  for (const mission of epic.missions) {
    const outcome = missionStatus(epic.id, mission.id);
    if (outcome === 'Pass') passed += 1;
    else if (outcome === 'Fail') failed += 1;
    else if (outcome === 'In Progress') inProgress += 1;
    else pending += 1;
  }
  return { passed, failed, inProgress, pending, total: epic.missions.length };
}

function statusBadge(outcome) {
  if (outcome === 'Pass') return { label: 'Pass', className: 'badge-pass' };
  if (outcome === 'Fail') return { label: 'Fail', className: 'badge-fail' };
  if (outcome === 'In Progress') return { label: 'In progress', className: 'badge-progress' };
  return { label: 'Pending', className: 'badge-pending' };
}

function renderSegBar(progress) {
  const { passed, failed, inProgress, pending, total } = progress;
  if (!total) return '';
  const pct = (n) => `${(n / total) * 100}%`;
  return `
    <div class="seg-bar" aria-hidden="true">
      ${passed ? `<span class="seg-pass" style="width:${pct(passed)}"></span>` : ''}
      ${failed ? `<span class="seg-fail" style="width:${pct(failed)}"></span>` : ''}
      ${inProgress ? `<span class="seg-progress" style="width:${pct(inProgress)}"></span>` : ''}
      ${pending ? `<span class="seg-pending" style="width:${pct(pending)}"></span>` : ''}
    </div>
    <div class="seg-legend">
      <span><i style="background:var(--pass)"></i>${passed} pass</span>
      <span><i style="background:var(--fail)"></i>${failed} fail</span>
      <span><i style="background:var(--warn-soft)"></i>${inProgress} active</span>
      <span><i style="background:rgba(107,101,88,0.35)"></i>${pending} pending</span>
    </div>
  `;
}

function doneWhenItems(doneWhen) {
  const text = String(doneWhen || '').trim();
  if (!text) return [];
  const parts = text
    .split(/\s*(?:;|\n|·)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 1) return parts;
  return [text];
}

function render() {
  renderEpics();
  renderDetail();
  updateSubmitAvailability();
  if (state.pendingStepNotesFocus !== null) {
    const stepIndex = state.pendingStepNotesFocus;
    state.pendingStepNotesFocus = null;
    focusStepNotes(stepIndex);
  }
}

function hasAssessedTask() {
  const tester = (els.testerName.value || 'anonymous').trim().toLowerCase();
  const prefix = `${tester}::`;
  return Object.entries(state.stepResults).some(
    ([key, steps]) =>
      key.startsWith(prefix) &&
      Object.values(steps || {}).some((step) => step?.outcome === 'Pass' || step?.outcome === 'Fail')
  );
}

function updateSubmitAvailability() {
  const disabled = !hasAssessedTask();
  if (els.submitBtn) {
    els.submitBtn.disabled = disabled;
    els.submitBtn.title = disabled
      ? 'Complete at least one mission step before submitting'
      : 'Submit your UAT results';
  }
  const finishBtn = document.getElementById('finishSubmitBtn');
  if (finishBtn) finishBtn.disabled = disabled;
}

function renderEpics() {
  if (!els.epicList) return;
  const epics = state.catalog?.epics || [];
  els.epicList.innerHTML = epics
    .map((epic) => {
      const p = epicProgress(epic);
      const selected = epic.id === state.selectedEpicId ? 'selected' : '';
      return `
        <button class="epic-card ${selected}" data-epic="${epic.id}" type="button">
          <strong>${escapeHtml(epic.jiraKey)} · ${escapeHtml(epic.name)}</strong>
          ${renderSegBar(p)}
          <div class="meta" style="margin-top:0.35rem">${escapeHtml(epic.targetOrg)}</div>
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
      <div class="progress-block">${renderSegBar(progress)}</div>
    </div>
    <p class="goal">${escapeHtml(epic.summary)}</p>
    ${renderFinishBanner(epic, progress)}

    <div style="margin-top:1.1rem">
      <p class="section-label">Missions</p>
      <div class="mission-list">
        ${epic.missions
          .map((m) => {
            const outcome = missionStatus(epic.id, m.id);
            const badge = statusBadge(outcome);
            const selected = m.id === state.selectedMissionId;
            const expanded = selected ? 'expanded' : '';
            const outcomeClass =
              outcome === 'Pass' ? 'mission-passed' : outcome === 'Fail' ? 'mission-failed' : '';
            return `
              <div class="mission-card ${selected ? 'selected' : ''} ${expanded} ${outcomeClass}" id="mission-${escapeAttr(m.id)}">
                <button class="mission-card-main" data-mission="${m.id}" type="button" aria-expanded="${selected}">
                  <div class="mission-card-top">
                    <strong>${escapeHtml(m.name)}</strong>
                    <span class="badge ${badge.className}">${escapeHtml(badge.label)}</span>
                  </div>
                  <div class="meta">${selected ? 'Click to collapse' : 'Click to expand'}</div>
                </button>
                ${selected ? renderMission(epic, m) : ''}
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;

  els.epicDetail.querySelectorAll('[data-mission]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const missionId = btn.dataset.mission;
      // toggle: click again collapses
      if (state.selectedMissionId === missionId) {
        state.selectedMissionId = null;
        render();
        return;
      }
      state.selectedMissionId = missionId;
      render();
      document.getElementById(`mission-${missionId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  });

  els.epicDetail.querySelector('#certificateBtn')?.addEventListener('click', () => {
    openCertificate(epic);
  });
  els.epicDetail.querySelector('#finishSubmitBtn')?.addEventListener('click', () => {
    submitResults();
  });
  wireMissionForm(epic, mission);
}

function renderFinishBanner(epic, progress) {
  const done = progress.pending === 0 && progress.inProgress === 0 && progress.total > 0;
  if (!done) return '';
  const tester = els.testerName.value.trim() || 'Tester';
  return `
    <div class="finish-banner">
      <div>
        <p class="section-label">Trail complete</p>
        <strong>${escapeHtml(tester)}, you finished ${progress.total} missions</strong>
        <p class="meta">Submit results to the coordinator, then print your certificate.</p>
      </div>
      <div class="finish-actions">
        <button class="btn btn-lime" type="button" id="finishSubmitBtn">Submit results</button>
        <button class="btn btn-secondary" type="button" id="certificateBtn">Print certificate</button>
      </div>
    </div>
  `;
}

function wireMissionForm(epic, mission) {
  if (!mission) return;

  const form = els.epicDetail.querySelector('#resultForm');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      fd.set('outcome', missionStatus(epic.id, mission.id));
      submitResult(epic.id, mission.id, fd);
    });
  }

  els.epicDetail.querySelectorAll('[data-step-outcome]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setStepOutcome(epic, mission, Number(btn.dataset.stepIndex), btn.dataset.stepOutcome);
    });
  });

  els.epicDetail.querySelectorAll('[data-step-note]').forEach((textarea) => {
    textarea.addEventListener('input', () => {
      setStepNote(epic, mission, Number(textarea.dataset.stepNote), textarea.value);
    });
  });

  els.epicDetail.querySelectorAll('[data-done-check]').forEach((input) => {
    input.addEventListener('change', () => {
      const key = resultKey(epic.id, mission.id);
      const list = state.checklists[key] || {};
      list[input.dataset.doneCheck] = input.checked;
      state.checklists[key] = list;
      saveChecklists();
    });
  });
}

function renderMission(epic, mission) {
  const existing = getResult(epic.id, mission.id) || {};
  const outcome = missionStatus(epic.id, mission.id);
  const outcomeBadge = statusBadge(outcome);
  const stepProgress = missionStepProgress(epic.id, mission);
  const checklistKey = resultKey(epic.id, mission.id);
  const checks = state.checklists[checklistKey] || {};
  const stepResults = state.stepResults[checklistKey] || {};
  const doneItems = doneWhenItems(mission.doneWhen);

  const links = (mission.recordLinks || [])
    .map(
      (link) =>
        `<a class="link-chip" href="${escapeAttr(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`
    )
    .join('');

  return `
    <section class="mission-detail">
      <div class="mission-split">
        <div class="mission-main">
          <details class="collapse" open>
            <summary>Goal</summary>
            <p class="goal">${escapeHtml(mission.goal)}</p>
          </details>

          <div class="done-box" style="margin-top:0.75rem">
            <p class="section-label">Done when</p>
            <ul class="done-list">
              ${doneItems
                .map(
                  (item, index) => `
                <li>
                  <input type="checkbox" data-done-check="${index}" ${checks[String(index)] ? 'checked' : ''} />
                  <span>${escapeHtml(item)}</span>
                </li>`
                )
                .join('')}
            </ul>
          </div>

          <details class="collapse steps-block" open>
            <summary>Steps</summary>
            <ol class="steps">
              ${mission.steps
                .map((step, index) => {
                  const stepResult = stepResults[String(index)] || {};
                  const stepOutcome = stepResult.outcome || '';
                  const stepLinks = (mission.stepLinks?.[String(index)] || [])
                    .map(
                      (link) =>
                        `<a class="link-chip step-link" href="${escapeAttr(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`
                    )
                    .join('');
                  return `
                    <li class="step-item ${stepOutcome === 'Fail' ? 'has-failed' : ''}">
                      <div class="step-copy">${escapeHtml(step)}</div>
                      ${stepLinks ? `<div class="step-links">${stepLinks}</div>` : ''}
                      <div class="step-actions" role="group" aria-label="Result for step ${index + 1}">
                        <button type="button" class="step-outcome step-pass" data-step-index="${index}" data-step-outcome="Pass" aria-pressed="${stepOutcome === 'Pass'}">Pass</button>
                        <button type="button" class="step-outcome step-fail" data-step-index="${index}" data-step-outcome="Fail" aria-pressed="${stepOutcome === 'Fail'}">Fail</button>
                      </div>
                      ${
                        stepOutcome === 'Fail'
                          ? `<label class="step-note-label">What happened?
                              <textarea class="step-note" data-step-note="${index}" placeholder="Expected result, actual result, and anything that may help reproduce it…">${escapeHtml(stepResult.notes || '')}</textarea>
                            </label>`
                          : ''
                      }
                    </li>
                  `;
                })
                .join('')}
            </ol>
          </details>

          ${links ? `<div class="links">${links}</div>` : ''}
        </div>

        <aside class="result-panel">
          <h3>Mission summary</h3>
          <div class="mission-status-summary">
            <span class="badge ${outcomeBadge.className}">${escapeHtml(outcomeBadge.label)}</span>
            <strong>${stepProgress.answered} of ${stepProgress.total} steps assessed</strong>
            <span>${stepProgress.passed} passed · ${stepProgress.failed} failed</span>
          </div>
          <form class="form" id="resultForm">
            <label>
              Feedback type
              <select name="feedbackType">
                <option value="None" ${!existing.feedbackType || existing.feedbackType === 'None' ? 'selected' : ''}>None</option>
                <option value="Broken" ${existing.feedbackType === 'Broken' ? 'selected' : ''}>Broken (bug)</option>
                <option value="Improve" ${existing.feedbackType === 'Improve' ? 'selected' : ''}>Improve (UX/process)</option>
              </select>
            </label>
            <label>
              Overall mission notes
              <textarea class="mission-notes" name="notes" placeholder="${
                outcome === 'Fail'
                  ? 'What did you see? Steps + expected vs actual…'
                  : 'What you saw, evidence, blockers…'
              }">${escapeHtml(existing.notes || '')}</textarea>
            </label>
            <div class="form-actions">
              <button class="btn btn-lime" type="submit">Save mission notes</button>
            </div>
            <p class="meta">Saved in this browser · Submit results when done</p>
          </form>
        </aside>
      </div>
    </section>
  `;
}

function setStepOutcome(epic, mission, stepIndex, outcome) {
  const key = resultKey(epic.id, mission.id);
  const results = state.stepResults[key] || {};
  const previous = results[String(stepIndex)] || {};
  const previousStepOutcome = previous.outcome;
  results[String(stepIndex)] = { outcome, notes: previous.notes || '' };
  state.stepResults[key] = results;
  saveStepResults();
  syncMissionResult(epic, mission);

  if (outcome === 'Fail') state.pendingStepNotesFocus = stepIndex;
  render();

  if (outcome === 'Fail') {
    celebrateFail();
    showToast('Bug caught — add a note to this step');
  } else {
    showToast('Step passed — nice work!');
    if (previousStepOutcome !== 'Pass') launchFireworks();
  }
}

function setStepNote(epic, mission, stepIndex, notes) {
  const key = resultKey(epic.id, mission.id);
  const results = state.stepResults[key] || {};
  const previous = results[String(stepIndex)] || { outcome: 'Fail' };
  results[String(stepIndex)] = { ...previous, notes };
  state.stepResults[key] = results;
  saveStepResults();
  syncMissionResult(epic, mission);
}

function syncMissionResult(epic, mission) {
  const tester = els.testerName.value.trim() || 'anonymous';
  localStorage.setItem(TESTER_KEY, tester);
  const key = resultKey(epic.id, mission.id);
  const previous = getResult(epic.id, mission.id) || {};
  const outcome = missionStatus(epic.id, mission.id);
  const storedSteps = state.stepResults[key] || {};
  let feedbackType = previous.feedbackType || 'None';
  let autoFeedbackType = Boolean(previous.autoFeedbackType);
  if (outcome === 'Fail' && feedbackType === 'None') {
    feedbackType = 'Broken';
    autoFeedbackType = true;
  } else if (outcome !== 'Fail' && autoFeedbackType) {
    feedbackType = 'None';
    autoFeedbackType = false;
  }
  const stepResults = mission.steps.map((step, index) => ({
    step: index + 1,
    instruction: step,
    outcome: storedSteps[String(index)]?.outcome || 'Pending',
    notes: storedSteps[String(index)]?.notes || '',
  }));

  const result = { ...previous };
  delete result.evidenceUrl;
  state.results[key] = {
    ...result,
    epicId: epic.id,
    missionId: mission.id,
    tester,
    outcome,
    feedbackType,
    autoFeedbackType,
    notes: previous.notes || '',
    stepResults,
    submittedAt: new Date().toISOString(),
  };
  saveResults();
}

function submitResult(epicId, missionId, formData) {
  const tester = els.testerName.value.trim() || 'anonymous';
  localStorage.setItem(TESTER_KEY, tester);
  const outcome = formData.get('outcome');
  let feedbackType = formData.get('feedbackType') || 'None';
  if (outcome === 'Fail' && feedbackType === 'None') feedbackType = 'Broken';
  const previous = getResult(epicId, missionId) || {};

  const result = { ...previous };
  delete result.evidenceUrl;
  state.results[resultKey(epicId, missionId)] = {
    ...result,
    epicId,
    missionId,
    tester,
    outcome,
    feedbackType,
    autoFeedbackType: false,
    notes: String(formData.get('notes') || '').trim(),
    submittedAt: new Date().toISOString(),
  };
  saveResults();
  showToast('Mission notes saved');
  render();
}

function myResults() {
  const tester = (els.testerName.value || 'anonymous').trim().toLowerCase();
  const prefix = `${tester}::`;
  return Object.values(state.results).filter((r) => {
    const key = resultKey(r.epicId, r.missionId);
    return key.startsWith(prefix);
  });
}

function buildResultsSummary() {
  const tester = els.testerName.value.trim() || 'anonymous';
  const epic = selectedEpic();
  const mine = myResults().filter((r) => !epic || r.epicId === epic.id);
  const lines = [
    `UAT Trail results — ${tester}`,
    epic ? `Epic: ${epic.jiraKey} ${epic.name}` : 'Epic: (all)',
    `Exported: ${new Date().toISOString()}`,
    '',
  ];
  if (!mine.length) {
    lines.push('No results yet for this tester.');
    return lines.join('\n');
  }
  for (const r of mine) {
    const missionName =
      epic?.missions.find((m) => m.id === r.missionId)?.name || r.missionId;
    lines.push(
      `• ${missionName}: ${r.outcome}` +
        (r.feedbackType && r.feedbackType !== 'None' ? ` [${r.feedbackType}]` : '') +
        (r.notes ? ` — ${r.notes}` : '')
    );
    for (const step of r.stepResults || []) {
      lines.push(
        `  Step ${step.step}: ${step.outcome}` +
          (step.notes ? ` — ${step.notes}` : '')
      );
    }
  }
  return lines.join('\n');
}

function exportResults() {
  return submitResults();
}

async function submitResults() {
  const tester = els.testerName.value.trim();
  if (!tester) {
    showToast('Enter your Tester name first');
    els.testerName.focus();
    return;
  }

  const epic = selectedEpic();
  const results = myResults();
  if (!results.length) {
    showToast('No results to submit yet');
    return;
  }

  const summary = buildResultsSummary();
  const subject = `UAT Trail results — ${tester}${epic ? ` — ${epic.jiraKey}` : ''}`;
  const payload = {
    submittedAt: new Date().toISOString(),
    tester,
    epic: epic
      ? { id: epic.id, jiraKey: epic.jiraKey, name: epic.name, jiraUrl: epic.jiraUrl }
      : null,
    results,
  };

  const btn = els.submitBtn;
  const finishBtn = document.getElementById('finishSubmitBtn');
  const prevLabel = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Submitting…';
  }
  if (finishBtn) {
    finishBtn.disabled = true;
    finishBtn.textContent = 'Submitting…';
  }
  showToast('Submitting to inbox…');

  try {
    const res = await fetch(FORMSUBMIT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        _subject: subject,
        name: tester,
        email: RESULTS_INBOX,
        epic: epic ? `${epic.jiraKey} — ${epic.name}` : 'n/a',
        summary,
        results_json: JSON.stringify(payload, null, 2),
        _template: 'table',
        _captcha: 'false',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === 'false' || data.success === false) {
      throw new Error(data.message || 'Submit failed');
    }
    showToast(`Submitted to ${RESULTS_INBOX}`);
  } catch (err) {
    console.warn('Submit via FormSubmit failed, falling back to mailto', err);
    const mailto = `mailto:${RESULTS_INBOX}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      `${summary}\n\n(Full JSON could not be included automatically.)`
    )}`;
    window.location.href = mailto;
    showToast('Opened email draft — click Send');
  } finally {
    if (btn) btn.textContent = prevLabel || 'Submit results';
    if (finishBtn) {
      finishBtn.textContent = 'Submit results';
    }
    updateSubmitAvailability();
  }
}

function openCertificate(epic) {
  const tester = els.testerName.value.trim();
  if (!tester) {
    showToast('Enter your Tester name first');
    els.testerName.focus();
    return;
  }
  if (!els.certificateModal) {
    showToast('Certificate view unavailable');
    return;
  }

  const date = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const featureName = epic.name;

  els.certTesterName.textContent = tester;
  els.certFeatureName.textContent = featureName;
  els.certFootDate.textContent = date;

  els.certificateModal.hidden = false;
  document.body.classList.add('cert-open');
  els.certPrintBtn?.focus();
}

function closeCertificate() {
  if (!els.certificateModal) return;
  els.certificateModal.hidden = true;
  document.body.classList.remove('cert-open');
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
  for (const key of Object.keys(state.checklists)) {
    if (key.startsWith(prefix)) delete state.checklists[key];
  }
  for (const key of Object.keys(state.stepResults)) {
    if (key.startsWith(prefix)) delete state.stepResults[key];
  }
  saveResults();
  saveChecklists();
  saveStepResults();
  showToast(removed ? `Cleared ${removed} result(s)` : 'Nothing to clear');
  render();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function focusStepNotes(stepIndex) {
  const notes = els.epicDetail.querySelector(`[data-step-note="${stepIndex}"]`);
  if (!notes) return;
  notes.classList.add('notes-hunt');
  notes.focus();
  notes.scrollIntoView({ behavior: 'smooth', block: 'center' });
  clearTimeout(focusStepNotes._t);
  focusStepNotes._t = setTimeout(() => notes.classList.remove('notes-hunt'), 2600);
}

function celebrateFail() {
  shakeScreen();
  showBugCatchScene();
  launchBugBurst();
  showCatchChip();
}

function showBugCatchScene() {
  const scene = els.bugCatchScene;
  if (!scene) return;

  scene.hidden = false;
  scene.classList.remove('play');
  void scene.offsetWidth;
  scene.classList.add('play');

  clearTimeout(showBugCatchScene._t);
  showBugCatchScene._t = setTimeout(() => {
    scene.classList.remove('play');
    scene.hidden = true;
  }, 2400);
}

function shakeScreen() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.body.classList.remove('shake');
  void document.body.offsetWidth;
  document.body.classList.add('shake');
  clearTimeout(shakeScreen._t);
  shakeScreen._t = setTimeout(() => document.body.classList.remove('shake'), 500);
}

function showCatchChip() {
  if (!els.catchChip || !els.catchLine) return;
  const line = CATCH_LINES[Math.floor(Math.random() * CATCH_LINES.length)];
  els.catchLine.textContent = line;
  els.catchChip.hidden = false;
  els.catchChip.classList.remove('show');
  // replay bug wiggle
  const bug = els.catchChip.querySelector('.catch-bug');
  if (bug) {
    bug.style.animation = 'none';
    void bug.offsetWidth;
    bug.style.animation = '';
  }
  requestAnimationFrame(() => els.catchChip.classList.add('show'));
  clearTimeout(showCatchChip._t);
  showCatchChip._t = setTimeout(() => {
    els.catchChip.classList.remove('show');
    setTimeout(() => {
      els.catchChip.hidden = true;
    }, 220);
  }, 6500);
}

const BUG_BURST_COLORS = ['#c45c26', '#e0a800', '#c73a2e', '#ff8a5b', '#ffffff'];

function launchBugBurst() {
  const canvas = document.getElementById('fireworks') || els.fireworks;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  cancelAnimationFrame(fireworksRaf);
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas.classList.add('active');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const originX = w * 0.5;
  const originY = h * 0.38;
  const particles = [];
  const count = reduceMotion ? 18 : 48;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 5;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.016 + Math.random() * 0.02,
      size: 2 + Math.random() * 2.6,
      color: BUG_BURST_COLORS[i % BUG_BURST_COLORS.length],
    });
  }

  const started = performance.now();
  const duration = reduceMotion ? 700 : 1400;

  const tick = (now) => {
    const elapsed = now - started;
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.vx *= 0.98;
      p.life -= p.decay;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (elapsed < duration) {
      fireworksRaf = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, w, h);
      canvas.classList.remove('active');
    }
  };

  fireworksRaf = requestAnimationFrame(tick);
}

const FIREWORK_COLORS = ['#34bb78', '#18784c', '#e0a800', '#ffffff', '#7ee0a8', '#ff6b4a', '#5ad4ff'];
let fireworksRaf = 0;

function launchFireworks() {
  const canvas = document.getElementById('fireworks') || els.fireworks;
  if (!canvas) return;
  // Still show a brief flash even when reduced motion is on
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  cancelAnimationFrame(fireworksRaf);
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas.classList.add('active');

  if (reduceMotion) {
    // Tiny sparkles only — keep the page fully visible
    for (let i = 0; i < 24; i += 1) {
      ctx.fillStyle = FIREWORK_COLORS[i % FIREWORK_COLORS.length];
      ctx.beginPath();
      ctx.arc(w * Math.random(), h * (0.15 + Math.random() * 0.5), 2 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    setTimeout(() => {
      ctx.clearRect(0, 0, w, h);
      canvas.classList.remove('active');
    }, 450);
    return;
  }

  const rockets = [];
  const particles = [];
  const rocketCount = 6;
  for (let i = 0; i < rocketCount; i += 1) {
    rockets.push({
      x: w * (0.12 + Math.random() * 0.76),
      y: h + 10,
      targetY: h * (0.12 + Math.random() * 0.38),
      vy: -(7.5 + Math.random() * 3.5),
      color: FIREWORK_COLORS[i % FIREWORK_COLORS.length],
      exploded: false,
      delay: i * 90,
    });
  }

  const explode = (x, y, color) => {
    const count = 55 + Math.floor(Math.random() * 30);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6.5;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.01 + Math.random() * 0.014,
        size: 2 + Math.random() * 2.8,
        color: Math.random() > 0.3 ? color : FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
      });
    }
  };

  const started = performance.now();
  const duration = 2800;

  const tick = (now) => {
    const elapsed = now - started;
    // Transparent clear — page stays visible underneath
    ctx.clearRect(0, 0, w, h);

    for (const rocket of rockets) {
      if (elapsed < rocket.delay || rocket.exploded) continue;
      rocket.y += rocket.vy;
      ctx.fillStyle = rocket.color;
      ctx.beginPath();
      ctx.arc(rocket.x, rocket.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(rocket.x, rocket.y + 8, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (rocket.y <= rocket.targetY) {
        rocket.exploded = true;
        explode(rocket.x, rocket.y, rocket.color);
      }
    }

    for (const p of particles) {
      if (p.life <= 0) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.055;
      p.vx *= 0.985;
      p.life -= p.decay;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (elapsed < duration) {
      fireworksRaf = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, w, h);
      canvas.classList.remove('active');
    }
  };

  fireworksRaf = requestAnimationFrame(tick);
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
