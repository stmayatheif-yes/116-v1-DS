/* 116 申請入學資料觀察室 - 前端邏輯 */
const SUBJECTS = ["國文", "英文", "數學A", "數學B", "社會", "自然"];
const SCHOOL_ORDER = null; // 若需自訂學校排序可填陣列

let ALL = [];        // 全部校系
let FILTERED = [];   // 目前篩選結果
let subjectSet = new Set(); // 已勾選科目
let schoolChart = null;
let countChart = null;

const $ = (s) => document.querySelector(s);

async function init() {
  const res = await fetch("data/schools.json");
  ALL = await res.json();
  buildSubjectCheckboxes();
  buildSchoolOptions();
  buildCategoryOptions();
  bindEvents();
  applyFilters();
}

function buildSubjectCheckboxes() {
  const box = $("#fSubjects");
  SUBJECTS.forEach((s) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${s}"> ${s}`;
    box.appendChild(label);
  });
}

function buildSchoolOptions() {
  const sel = $("#fSchool");
  const schools = [...new Set(ALL.map((r) => r.school))];
  if (SCHOOL_ORDER) {
    schools.sort((a, b) => SCHOOL_ORDER.indexOf(a) - SCHOOL_ORDER.indexOf(b));
  } else {
    schools.sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }
  schools.forEach((s) => {
    const o = document.createElement("option");
    o.value = s;
    o.textContent = s;
    sel.appendChild(o);
  });
}

function buildCategoryOptions() {
  const sel = $("#fCategory");
  const cats = [...new Set(ALL.map((r) => r.category).filter(Boolean))].sort();
  cats.forEach((c) => {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    sel.appendChild(o);
  });
}

function bindEvents() {
  $("#fSchool").addEventListener("change", applyFilters);
  $("#fCategory").addEventListener("change", applyFilters);
  $("#fKeyword").addEventListener("input", debounce(applyFilters, 200));
  $("#fSubjects").addEventListener("change", (e) => {
    if (e.target.matches("input[type=checkbox]")) {
      if (e.target.checked) subjectSet.add(e.target.value);
      else subjectSet.delete(e.target.value);
      applyFilters();
    }
  });
  $("#clearFilters").addEventListener("click", clearFilters);
  $("#modalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function clearFilters() {
  $("#fSchool").value = "";
  $("#fCategory").value = "";
  $("#fKeyword").value = "";
  subjectSet.clear();
  document.querySelectorAll("#fSubjects input").forEach((c) => (c.checked = false));
  applyFilters();
}

function applyFilters() {
  const school = $("#fSchool").value;
  const category = $("#fCategory").value;
  const kw = $("#fKeyword").value.trim().toLowerCase();

  FILTERED = ALL.filter((r) => {
    if (school && r.school !== school) return false;
    if (category && r.category !== category) return false;
    if (kw) {
      const hay = (r.code + r.name + r.school).toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    if (subjectSet.size > 0) {
      // 必須「同時參採」所有已勾選科目
      const subs = new Set(r.subjects116 || []);
      for (const s of subjectSet) {
        if (!subs.has(s)) return false;
      }
    }
    return true;
  });

  renderTable();
  renderStats();
  renderCharts();
}

function renderTable() {
  const tbody = $("#resultTable tbody");
  tbody.innerHTML = "";
  $("#resultCount").textContent = FILTERED.length.toLocaleString();
  $("#emptyMsg").hidden = FILTERED.length > 0;

  const frag = document.createDocumentFragment();
  FILTERED.forEach((r) => {
    const tr = document.createElement("tr");

    const nameCell = document.createElement("td");
    nameCell.innerHTML = `
      <div class="code">${r.code} <span class="tag">${escapeHtml(r.group || "")}</span></div>
      <div class="name">${escapeHtml(r.name)}</div>
      ${r.changed ? '<span class="tag changed">科目有變動</span>' : ""}
    `;

    const schoolCell = document.createElement("td");
    schoolCell.textContent = r.school;

    const catCell = document.createElement("td");
    catCell.textContent = r.category || "—";

    const s116 = document.createElement("td");
    s116.innerHTML = chips(r.subjects116);

    const s115 = document.createElement("td");
    s115.innerHTML = r.no_115_record
      ? '<span class="chip none">115 無同名紀錄</span>'
      : chips(r.subjects115);

    const pdfCell = document.createElement("td");
    pdfCell.innerHTML = r.pdf116_url
      ? `<a class="pdf-link" href="${r.pdf116_url}" target="_blank" rel="noopener">116 PDF ↗</a>
         <br><button class="pdf-link btn-detail" data-code="${r.code}">詳情</button>`
      : "—";

    tr.append(nameCell, schoolCell, catCell, s116, s115, pdfCell);
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);

  tbody.querySelectorAll(".btn-detail").forEach((btn) => {
    btn.addEventListener("click", () => showDetail(btn.dataset.code));
  });
}

function chips(subs) {
  if (!subs || subs.length === 0) return '<span class="chip none">無</span>';
  return `<div class="chips">${subs
    .map((s) => `<span class="chip">${escapeHtml(s)}</span>`)
    .join("")}</div>`;
}

function renderStats() {
  const total = ALL.length;
  const univs = new Set(ALL.map((r) => r.school)).size;
  $("#statSchools").textContent = total.toLocaleString();
  $("#statUnivs").textContent = univs.toLocaleString();
  $("#statSubjects").textContent = SUBJECTS.length;

  const changed = FILTERED.filter((r) => r.changed).length;
  const no115 = FILTERED.filter((r) => r.no_115_record).length;
  const same = FILTERED.length - changed - no115;
  $("#kpiChanged").textContent = changed.toLocaleString();
  $("#kpiSame").textContent = Math.max(same, 0).toLocaleString();
  $("#kpiNo115").textContent = no115.toLocaleString();

  const scopeParts = [];
  if ($("#fSchool").value) scopeParts.push($("#fSchool").value);
  else scopeParts.push("全部學校");
  if ($("#fCategory").value) scopeParts.push($("#fCategory").value);
  $("#scopeText").textContent = `目前範圍：${scopeParts.join(" · ")}，${FILTERED.length.toLocaleString()} 筆符合條件的校系`;
}

function renderCharts() {
  // 01 各科參採數
  const counts = SUBJECTS.map(
    (s) => FILTERED.filter((r) => (r.subjects116 || []).includes(s)).length
  );
  const ctx1 = $("#chartSubjects").getContext("2d");
  if (schoolChart) schoolChart.destroy();
  schoolChart = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: SUBJECTS,
      datasets: [
        {
          data: counts,
          backgroundColor: "rgba(110,168,254,.6)",
          borderColor: "rgba(110,168,254,1)",
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: "rgba(255,255,255,.06)" }, ticks: { color: "#9aa3ad" } },
        y: { grid: { display: false }, ticks: { color: "#e8eaed" } },
      },
    },
  });

  // 02 參採科目數分布
  const dist = [0, 1, 2, 3, 4, 5, 6].map(
    (n) => FILTERED.filter((r) => (r.subjects116 || []).length === n).length
  );
  const ctx2 = $("#chartCount").getContext("2d");
  if (countChart) countChart.destroy();
  countChart = new Chart(ctx2, {
    type: "bar",
    data: {
      labels: ["0 科", "1 科", "2 科", "3 科", "4 科", "5 科", "6 科"],
      datasets: [
        {
          data: dist,
          backgroundColor: "rgba(126,224,176,.55)",
          borderColor: "rgba(126,224,176,1)",
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#9aa3ad" } },
        y: { beginAtZero: true, grid: { color: "rgba(255,255,255,.06)" }, ticks: { color: "#9aa3ad" } },
      },
    },
  });
}

/* 詳情 modal：先顯示基本資料，之後接檢定/倍率 */
function showDetail(code) {
  const r = ALL.find((x) => x.code === code);
  if (!r) return;
  const body = $("#modalBody");
  body.innerHTML = `
    <p class="section-label">校系詳情</p>
    <h2>${escapeHtml(r.name)}</h2>
    <p class="muted">${escapeHtml(r.school)} · ${escapeHtml(r.category || "")} ${r.group ? "· " + escapeHtml(r.group) : ""}</p>
    <h3>116 參採科目</h3>
    ${chips(r.subjects116)}
    <h3>115 參採科目</h3>
    ${r.no_115_record ? '<span class="chip none">115 無同名紀錄</span>' : chips(r.subjects115)}
    <h3>116 檢定標準 / 篩選倍率</h3>
    <p class="muted small">${r.rules116_html || "尚未接入（V2 將從校系分則整理）"}</p>
  `;
  $("#modal").hidden = false;
}

function closeModal() {
  $("#modal").hidden = true;
}

/* utils */
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

init().catch((e) => {
  console.error(e);
  $("#emptyMsg").hidden = false;
  $("#emptyMsg").textContent = "資料載入失敗，請確認 data/schools.json 存在。";
});
