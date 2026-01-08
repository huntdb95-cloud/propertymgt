(() => {
  const STORAGE_KEY = "rental_tracker_v1";

  /** State shape
   * {
   *   properties: [{id, name, address, notes, createdAt}],
   *   txns: [{id, propertyId, type, date, amount, category, desc, createdAt}]
   * }
   */
  const state = load() || { properties: [], txns: [] };

  // Elements
  const propertyForm = document.getElementById("propertyForm");
  const propName = document.getElementById("propName");
  const propAddress = document.getElementById("propAddress");
  const propNotes = document.getElementById("propNotes");
  const propertyList = document.getElementById("propertyList");
  const propertyCount = document.getElementById("propertyCount");

  const txnForm = document.getElementById("txnForm");
  const txnProperty = document.getElementById("txnProperty");
  const txnType = document.getElementById("txnType");
  const txnDate = document.getElementById("txnDate");
  const txnAmount = document.getElementById("txnAmount");
  const txnCategory = document.getElementById("txnCategory");
  const txnDesc = document.getElementById("txnDesc");

  const filterProperty = document.getElementById("filterProperty");
  const filterFrom = document.getElementById("filterFrom");
  const filterTo = document.getElementById("filterTo");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");

  const txnTableBody = document.getElementById("txnTableBody");
  const stats = document.getElementById("stats");

  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Init default date = today
  txnDate.valueAsDate = new Date();

  // Events
  propertyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = propName.value.trim();
    if (!name) return;

    const newProp = {
      id: uid(),
      name,
      address: propAddress.value.trim(),
      notes: propNotes.value.trim(),
      createdAt: new Date().toISOString(),
    };

    state.properties.push(newProp);
    save(state);

    propName.value = "";
    propAddress.value = "";
    propNotes.value = "";

    render();
  });

  txnForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!state.properties.length) {
      alert("Add a property first.");
      return;
    }

    const propertyId = txnProperty.value;
    const type = txnType.value;
    const date = txnDate.value;
    const amount = Number(txnAmount.value);
    const category = txnCategory.value.trim();
    const desc = txnDesc.value.trim();

    if (!propertyId || !type || !date || !category || !(amount >= 0)) return;

    const newTxn = {
      id: uid(),
      propertyId,
      type,
      date,
      amount: round2(amount),
      category,
      desc,
      createdAt: new Date().toISOString(),
    };

    state.txns.push(newTxn);
    save(state);

    txnAmount.value = "";
    txnCategory.value = "";
    txnDesc.value = "";

    render();
  });

  filterProperty.addEventListener("change", render);
  filterFrom.addEventListener("change", render);
  filterTo.addEventListener("change", render);

  clearFiltersBtn.addEventListener("click", () => {
    filterProperty.value = "all";
    filterFrom.value = "";
    filterTo.value = "";
    render();
  });

  exportCsvBtn.addEventListener("click", () => {
    const rows = getFilteredTxns();
    const csv = toCsv(rows);
    downloadTextFile(csv, `rental-tracker-${todayISO()}.csv`, "text/csv;charset=utf-8;");
  });

  resetBtn.addEventListener("click", () => {
    const ok = confirm("This will delete ALL properties and transactions stored in this browser. Continue?");
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    state.properties = [];
    state.txns = [];
    render();
  });

  // Render
  function render() {
    renderProperties();
    renderPropertySelects();
    renderTxns();
    renderStats();
  }

  function renderProperties() {
    propertyList.innerHTML = "";
    propertyCount.textContent = `${state.properties.length} propert${state.properties.length === 1 ? "y" : "ies"}`;

    if (!state.properties.length) {
      propertyList.innerHTML = `<div class="subtle">No properties yet. Add your first one above.</div>`;
      return;
    }

    for (const p of state.properties) {
      const totals = totalsForProperty(p.id);

      const el = document.createElement("div");
      el.className = "property-item";
      el.innerHTML = `
        <div class="property-top">
          <div>
            <p class="pname">${escapeHtml(p.name)}</p>
            <div class="pmeta">
              ${p.address ? escapeHtml(p.address) : ""}
              ${p.address && p.notes ? " • " : ""}
              ${p.notes ? escapeHtml(p.notes) : ""}
            </div>
          </div>
          <div class="pactions">
            <button class="small-btn" data-action="view" data-id="${p.id}">View</button>
            <button class="small-btn" data-action="rename" data-id="${p.id}">Rename</button>
            <button class="small-btn small-danger" data-action="delete" data-id="${p.id}">Delete</button>
          </div>
        </div>

        <div class="pmeta">
          Income: <strong>${money(totals.income)}</strong> •
          Expenses: <strong>${money(totals.expense)}</strong> •
          Net: <strong style="color:${totals.net >= 0 ? "var(--good)" : "var(--bad)"}">${money(totals.net)}</strong>
        </div>
      `;

      el.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === "view") {
          filterProperty.value = id;
          // scroll to txns table area
          document.querySelector(".table-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
          render();
        }

        if (action === "rename") {
          const current = state.properties.find(x => x.id === id);
          const newName = prompt("New property name:", current?.name || "");
          if (!newName) return;
          if (current) current.name = newName.trim();
          save(state);
          render();
        }

        if (action === "delete") {
          const ok = confirm("Delete this property and all its transactions?");
          if (!ok) return;
          state.properties = state.properties.filter(x => x.id !== id);
          state.txns = state.txns.filter(t => t.propertyId !== id);
          // reset filter if pointing to deleted property
          if (filterProperty.value === id) filterProperty.value = "all";
          save(state);
          render();
        }
      });

      propertyList.appendChild(el);
    }
  }

  function renderPropertySelects() {
    // Txn property select
    txnProperty.innerHTML = "";
    if (!state.properties.length) {
      txnProperty.innerHTML = `<option value="" selected disabled>Add a property first</option>`;
    } else {
      for (const p of state.properties) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        txnProperty.appendChild(opt);
      }
    }

    // Filter property select
    const current = filterProperty.value || "all";
    filterProperty.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = "All properties";
    filterProperty.appendChild(allOpt);

    for (const p of state.properties) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      filterProperty.appendChild(opt);
    }

    // Preserve selection when possible
    if ([...filterProperty.options].some(o => o.value === current)) {
      filterProperty.value = current;
    } else {
      filterProperty.value = "all";
    }
  }

  function renderTxns() {
    const rows = getFilteredTxns()
      .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

    txnTableBody.innerHTML = "";

    if (!rows.length) {
      txnTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="subtle">No transactions for this filter yet.</td>
        </tr>`;
      return;
    }

    for (const t of rows) {
      const p = state.properties.find(x => x.id === t.propertyId);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(t.date)}</td>
        <td>${escapeHtml(p?.name || "Unknown")}</td>
        <td><span class="pill ${t.type}">${t.type === "income" ? "Income" : "Expense"}</span></td>
        <td>${escapeHtml(t.category)}</td>
        <td class="right">${money(t.amount)}</td>
        <td>${escapeHtml(t.desc || "")}</td>
        <td class="right">
          <button class="small-btn" data-action="edit" data-id="${t.id}">Edit</button>
          <button class="small-btn small-danger" data-action="delete" data-id="${t.id}">Delete</button>
        </td>
      `;

      tr.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === "delete") {
          const ok = confirm("Delete this transaction?");
          if (!ok) return;
          state.txns = state.txns.filter(x => x.id !== id);
          save(state);
          render();
        }

        if (action === "edit") {
          const txn = state.txns.find(x => x.id === id);
          if (!txn) return;

          const newAmount = prompt("Amount:", String(txn.amount));
          if (newAmount === null) return;

          const newCategory = prompt("Category:", txn.category);
          if (newCategory === null) return;

          const newDesc = prompt("Description (optional):", txn.desc || "");
          if (newDesc === null) return;

          const amt = Number(newAmount);
          if (!(amt >= 0)) {
            alert("Amount must be a number >= 0.");
            return;
          }

          txn.amount = round2(amt);
          txn.category = newCategory.trim() || txn.category;
          txn.desc = newDesc.trim();

          save(state);
          render();
        }
      });

      txnTableBody.appendChild(tr);
    }
  }

  function renderStats() {
    const rows = getFilteredTxns();

    let income = 0, expense = 0;
    for (const t of rows) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    income = round2(income);
    expense = round2(expense);
    const net = round2(income - expense);

    const propLabel =
      filterProperty.value === "all"
        ? "All properties"
        : (state.properties.find(p => p.id === filterProperty.value)?.name || "Selected property");

    const rangeLabel = `${filterFrom.value || "…"} → ${filterTo.value || "…"}`
      .replace("… → …", "All dates");

    stats.innerHTML = `
      <div class="stat">
        <div class="k">View</div>
        <div class="v" style="font-size:14px;font-weight:700">${escapeHtml(propLabel)}</div>
        <div class="k" style="margin-top:6px">${escapeHtml(rangeLabel)}</div>
      </div>
      <div class="stat good">
        <div class="k">Income</div>
        <div class="v">${money(income)}</div>
      </div>
      <div class="stat bad">
        <div class="k">Expenses</div>
        <div class="v">${money(expense)}</div>
      </div>
      <div class="stat ${net >= 0 ? "good" : "bad"}">
        <div class="k">Net</div>
        <div class="v">${money(net)}</div>
      </div>
    `;
  }

  // Helpers
  function getFilteredTxns() {
    const prop = filterProperty.value || "all";
    const from = filterFrom.value ? new Date(filterFrom.value + "T00:00:00") : null;
    const to = filterTo.value ? new Date(filterTo.value + "T23:59:59") : null;

    return state.txns.filter(t => {
      if (prop !== "all" && t.propertyId !== prop) return false;
      const d = new Date(t.date + "T12:00:00");
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }

  function totalsForProperty(propertyId) {
    let income = 0, expense = 0;
    for (const t of state.txns) {
      if (t.propertyId !== propertyId) continue;
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    income = round2(income);
    expense = round2(expense);
    return { income, expense, net: round2(income - expense) };
  }

  function toCsv(rows) {
    const headers = ["date","property","type","category","amount","description"];
    const lines = [headers.join(",")];

    for (const t of rows) {
      const p = state.properties.find(x => x.id === t.propertyId);
      const vals = [
        t.date,
        (p?.name || "Unknown"),
        t.type,
        t.category,
        String(t.amount),
        (t.desc || "")
      ].map(csvEscape);
      lines.push(vals.join(","));
    }

    return lines.join("\n");
  }

  function csvEscape(v) {
    const s = String(v ?? "");
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadTextFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  function money(n) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number(n || 0));
  }

  function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
  function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // First render
  render();
})();
