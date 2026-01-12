(() => {
  window.__APP_LOADED__ = true;
  console.log("Rental Tracker loaded from:", document.currentScript?.src);
  const STORAGE_KEY = "rental_tracker_v2";

  /**
   * state:
   * {
   *  properties: [{
   *    id, name, address, tenant, leaseStart, leaseEnd,
   *    monthlyRent, rentAutoEnabled, rentDueDay, notes, createdAt
   *  }],
   *  txns: [{
   *    id, propertyId, type, date, amount, category, desc,
   *    receipt?: { name, mime, dataUrl, note },
   *    recurring?: { kind: "rent", ym: "YYYY-MM" }, // used to prevent duplicates
   *    createdAt
   *  }]
   * }
   */
  const state = load() || { properties: [], txns: [] };

  // Tabs
  const tabButtons = [...document.querySelectorAll(".tab")];
  if (!tabButtons.length) {
    console.error("Tabs not found: .tab buttons missing. JS loaded but DOM selectors failed.");
  }
  const tabPanels = {
    dashboard: document.getElementById("tab-dashboard"),
    properties: document.getElementById("tab-properties"),
    transactions: document.getElementById("tab-transactions"),
    reports: document.getElementById("tab-reports"),
  };

  // Header buttons
  const exportPdfBtn = document.getElementById("exportPdfBtn");
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Dashboard filters
  const filterProperty = document.getElementById("filterProperty");
  const filterFrom = document.getElementById("filterFrom");
  const filterTo = document.getElementById("filterTo");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");
  const stats = document.getElementById("stats");
  const monthlyTableBody = document.getElementById("monthlyTableBody");

  // Properties
  const propertyForm = document.getElementById("propertyForm");
  const propName = document.getElementById("propName");
  const propAddress = document.getElementById("propAddress");
  const propTenant = document.getElementById("propTenant");
  const leaseStart = document.getElementById("leaseStart");
  const leaseEnd = document.getElementById("leaseEnd");
  const monthlyRent = document.getElementById("monthlyRent");
  const rentAutoEnabled = document.getElementById("rentAutoEnabled");
  const rentDueDay = document.getElementById("rentDueDay");
  const propNotes = document.getElementById("propNotes");
  const propertyList = document.getElementById("propertyList");
  const propertyCount = document.getElementById("propertyCount");

  // Transactions form
  const txnForm = document.getElementById("txnForm");
  const txnProperty = document.getElementById("txnProperty");
  const txnType = document.getElementById("txnType");
  const txnDate = document.getElementById("txnDate");
  const txnAmount = document.getElementById("txnAmount");
  const txnCategory = document.getElementById("txnCategory");
  const txnDesc = document.getElementById("txnDesc");
  const receiptRow = document.getElementById("receiptRow");
  const txnReceipt = document.getElementById("txnReceipt");
  const txnReceiptNote = document.getElementById("txnReceiptNote");

  // Transactions table + filters
  const txnFilterProperty = document.getElementById("txnFilterProperty");
  const txnFilterFrom = document.getElementById("txnFilterFrom");
  const txnFilterTo = document.getElementById("txnFilterTo");
  const txnClearFiltersBtn = document.getElementById("txnClearFiltersBtn");
  const txnTableBody = document.getElementById("txnTableBody");

  // Reports
  const reportProperty = document.getElementById("reportProperty");
  const reportFrom = document.getElementById("reportFrom");
  const reportTo = document.getElementById("reportTo");
  const reportApplyBtn = document.getElementById("reportApplyBtn");
  const reportStats = document.getElementById("reportStats");
  const reportTableBody = document.getElementById("reportTableBody");
  const reportPdfBtn = document.getElementById("reportPdfBtn");
  const reportCsvBtn = document.getElementById("reportCsvBtn");

  // Defaults
  txnDate.valueAsDate = new Date();

  // ---------------- Tabs ----------------
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const key = btn.dataset.tab;

      Object.values(tabPanels).forEach(p => p.classList.remove("active"));
      tabPanels[key].classList.add("active");

      // refresh report view on enter
      if (key === "reports") renderReports();
    });
  });

  // ---------------- Events ----------------
  propertyForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = propName.value.trim();
    if (!name) return;

    const dueDay = clampInt(rentDueDay.value, 1, 28, 1);
    const rent = Number(monthlyRent.value || 0);

    const p = {
      id: uid(),
      name,
      address: propAddress.value.trim(),
      tenant: propTenant.value.trim(),
      leaseStart: leaseStart.value || "",
      leaseEnd: leaseEnd.value || "",
      monthlyRent: round2(rent >= 0 ? rent : 0),
      rentAutoEnabled: rentAutoEnabled.value === "yes",
      rentDueDay: dueDay,
      notes: propNotes.value.trim(),
      createdAt: new Date().toISOString(),
    };

    state.properties.push(p);

    // Generate rent transactions if enabled
    generateRecurringRentForProperty(p.id);

    save(state);
    propertyForm.reset();
    rentDueDay.value = "1";
    rentAutoEnabled.value = "yes";
    renderAll();
  });

  txnType.addEventListener("change", () => {
    receiptRow.style.display = txnType.value === "expense" ? "grid" : "none";
    if (txnType.value !== "expense") {
      txnReceipt.value = "";
      txnReceiptNote.value = "";
    }
  });

  txnForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.properties.length) return alert("Add a property first.");

    const propertyId = txnProperty.value;
    const type = txnType.value;
    const date = txnDate.value;
    const amount = Number(txnAmount.value);
    const category = txnCategory.value.trim();
    const desc = txnDesc.value.trim();

    if (!propertyId || !type || !date || !category || !(amount >= 0)) return;

    let receipt = null;
    if (type === "expense" && txnReceipt.files && txnReceipt.files[0]) {
      const file = txnReceipt.files[0];
      receipt = await fileToDataUrlReceipt(file, txnReceiptNote.value.trim());
    }

    state.txns.push({
      id: uid(),
      propertyId,
      type,
      date,
      amount: round2(amount),
      category,
      desc,
      receipt,
      createdAt: new Date().toISOString(),
    });

    save(state);
    txnForm.reset();
    txnDate.valueAsDate = new Date();
    receiptRow.style.display = "none";
    renderAll();
  });

  // Dashboard filters
  filterProperty.addEventListener("change", renderDashboard);
  filterFrom.addEventListener("change", renderDashboard);
  filterTo.addEventListener("change", renderDashboard);
  clearFiltersBtn.addEventListener("click", () => {
    filterProperty.value = "all";
    filterFrom.value = "";
    filterTo.value = "";
    renderDashboard();
  });

  // Txn filters
  txnFilterProperty.addEventListener("change", renderTxns);
  txnFilterFrom.addEventListener("change", renderTxns);
  txnFilterTo.addEventListener("change", renderTxns);
  txnClearFiltersBtn.addEventListener("click", () => {
    txnFilterProperty.value = "all";
    txnFilterFrom.value = "";
    txnFilterTo.value = "";
    renderTxns();
  });

  // Reports
  reportApplyBtn.addEventListener("click", renderReports);
  reportPdfBtn.addEventListener("click", async () => exportReportPdf());
  reportCsvBtn.addEventListener("click", () => exportReportCsv());

  // Header export
  exportCsvBtn.addEventListener("click", () => {
    const rows = getDashboardFilteredTxns();
    const csv = txnsToCsv(rows);
    downloadTextFile(csv, `rental-tracker-${todayISO()}.csv`, "text/csv;charset=utf-8;");
  });

  exportPdfBtn.addEventListener("click", async () => {
    // Exports dashboard filter selection as PDF
    await exportDashboardPdf();
  });

  resetBtn.addEventListener("click", () => {
    const ok = confirm("This deletes ALL properties, transactions, and receipts stored in this browser. Continue?");
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    state.properties = [];
    state.txns = [];
    renderAll();
  });

  // ---------------- Render ----------------
  function renderAll() {
    ensureRecurringRentsForAll();
    renderPropertySelects();
    renderProperties();
    renderDashboard();
    renderTxns();
    renderReports(); // keep stats synced
  }

  function renderPropertySelects() {
    // helper to fill selects with properties
    const fillProps = (sel, includeAll) => {
      const current = sel.value || (includeAll ? "all" : "");
      sel.innerHTML = "";

      if (includeAll) {
        const o = document.createElement("option");
        o.value = "all";
        o.textContent = "All properties";
        sel.appendChild(o);
      }

      for (const p of state.properties) {
        const o = document.createElement("option");
        o.value = p.id;
        o.textContent = p.name;
        sel.appendChild(o);
      }

      if ([...sel.options].some(o => o.value === current)) sel.value = current;
      else sel.value = includeAll ? "all" : (state.properties[0]?.id || "");
    };

    // Txn property picker
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

    fillProps(filterProperty, true);
    fillProps(txnFilterProperty, true);
    fillProps(reportProperty, true);
  }

  function renderProperties() {
    propertyCount.textContent = `${state.properties.length} propert${state.properties.length === 1 ? "y" : "ies"}`;
    propertyList.innerHTML = "";

    if (!state.properties.length) {
      propertyList.innerHTML = `<div class="subtle">No properties yet. Add your first one above.</div>`;
      return;
    }

    for (const p of state.properties) {
      const totals = totalsForProperty(p.id);
      const leaseLine = leaseText(p);

      const el = document.createElement("div");
      el.className = "property-item";
      el.innerHTML = `
        <div class="property-top">
          <div>
            <p class="pname">${escapeHtml(p.name)}</p>
            <div class="pmeta">
              ${p.address ? escapeHtml(p.address) : ""}
              ${p.address && p.tenant ? " • " : ""}
              ${p.tenant ? ("Tenant: " + escapeHtml(p.tenant)) : ""}
            </div>
            <div class="pmeta">${escapeHtml(leaseLine)}</div>
            <div class="pmeta">
              Recurring rent: <strong>${p.rentAutoEnabled ? "ON" : "OFF"}</strong>
              ${p.rentAutoEnabled ? ` • ${money(p.monthlyRent)} on day ${p.rentDueDay}` : ""}
            </div>
          </div>
          <div class="pactions">
            <button class="small-btn" data-action="generate" data-id="${p.id}">Gen Rent</button>
            <button class="small-btn" data-action="edit" data-id="${p.id}">Edit</button>
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

        if (action === "generate") {
          generateRecurringRentForProperty(id, true);
          save(state);
          renderAll();
          return;
        }

        if (action === "edit") {
          editProperty(id);
          return;
        }

        if (action === "delete") {
          const ok = confirm("Delete this property and all its transactions?");
          if (!ok) return;
          state.properties = state.properties.filter(x => x.id !== id);
          state.txns = state.txns.filter(t => t.propertyId !== id);
          save(state);
          renderAll();
        }
      });

      propertyList.appendChild(el);
    }
  }

  function renderDashboard() {
    const rows = getDashboardFilteredTxns();

    const totals = totalsFromTxns(rows);
    const propLabel =
      filterProperty.value === "all"
        ? "All properties"
        : (state.properties.find(p => p.id === filterProperty.value)?.name || "Selected property");

    const rangeLabel = `${filterFrom.value || "…"} → ${filterTo.value || "…"}`
      .replace("… → …", "All dates");

    stats.innerHTML = `
      <div class="stat">
        <div class="k">View</div>
        <div class="v" style="font-size:14px;font-weight:800">${escapeHtml(propLabel)}</div>
        <div class="k" style="margin-top:6px">${escapeHtml(rangeLabel)}</div>
      </div>
      <div class="stat good">
        <div class="k">Income</div>
        <div class="v">${money(totals.income)}</div>
      </div>
      <div class="stat bad">
        <div class="k">Expenses</div>
        <div class="v">${money(totals.expense)}</div>
      </div>
      <div class="stat ${totals.net >= 0 ? "good" : "bad"}">
        <div class="k">Net</div>
        <div class="v">${money(totals.net)}</div>
      </div>
    `;

    const byMonth = groupByMonth(rows); // { "YYYY-MM": {income, expense, net} }
    const months = Object.keys(byMonth).sort(); // ascending

    monthlyTableBody.innerHTML = "";
    if (!months.length) {
      monthlyTableBody.innerHTML = `<tr><td colspan="4" class="subtle">No transactions yet.</td></tr>`;
      return;
    }

    for (const ym of months) {
      const m = byMonth[ym];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(formatYM(ym))}</td>
        <td class="right">${money(m.income)}</td>
        <td class="right">${money(m.expense)}</td>
        <td class="right" style="font-weight:900;color:${m.net>=0?"var(--good)":"var(--bad)"}">${money(m.net)}</td>
      `;
      monthlyTableBody.appendChild(tr);
    }
  }

  function renderTxns() {
    const rows = getTxnFilteredTxns().sort((a, b) => (a.date < b.date ? 1 : -1));
    txnTableBody.innerHTML = "";

    if (!rows.length) {
      txnTableBody.innerHTML = `<tr><td colspan="8" class="subtle">No transactions for this filter.</td></tr>`;
      return;
    }

    for (const t of rows) {
      const p = state.properties.find(x => x.id === t.propertyId);
      const receiptCell = t.receipt
        ? `<a class="link" href="${t.receipt.dataUrl}" target="_blank" rel="noopener">View</a>`
        : "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(t.date)}</td>
        <td>${escapeHtml(p?.name || "Unknown")}</td>
        <td><span class="pill ${t.type}">${t.type === "income" ? "Income" : "Expense"}</span></td>
        <td>${escapeHtml(t.category)}</td>
        <td class="right">${money(t.amount)}</td>
        <td>${escapeHtml(t.desc || "")}</td>
        <td>${receiptCell}</td>
        <td class="right">
          <button class="small-btn" data-action="edit" data-id="${t.id}">Edit</button>
          <button class="small-btn small-danger" data-action="delete" data-id="${t.id}">Delete</button>
        </td>
      `;

      tr.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === "delete") {
          const ok = confirm("Delete this transaction?");
          if (!ok) return;
          state.txns = state.txns.filter(x => x.id !== id);
          save(state);
          renderAll();
          return;
        }

        if (action === "edit") {
          await editTxn(id);
          save(state);
          renderAll();
        }
      });

      txnTableBody.appendChild(tr);
    }
  }

  function renderReports() {
    // keep report defaults in sync
    if (!reportProperty.value) reportProperty.value = "all";

    const rows = getReportTxns();
    const totals = totalsFromTxns(rows);

    const propLabel =
      reportProperty.value === "all"
        ? "All properties"
        : (state.properties.find(p => p.id === reportProperty.value)?.name || "Selected property");

    const rangeLabel = `${reportFrom.value || "…"} → ${reportTo.value || "…"}`
      .replace("… → …", "All dates");

    reportStats.innerHTML = `
      <div class="stat">
        <div class="k">Report</div>
        <div class="v" style="font-size:14px;font-weight:800">${escapeHtml(propLabel)}</div>
        <div class="k" style="margin-top:6px">${escapeHtml(rangeLabel)}</div>
      </div>
      <div class="stat good"><div class="k">Income</div><div class="v">${money(totals.income)}</div></div>
      <div class="stat bad"><div class="k">Expenses</div><div class="v">${money(totals.expense)}</div></div>
      <div class="stat ${totals.net>=0?"good":"bad"}"><div class="k">Net</div><div class="v">${money(totals.net)}</div></div>
    `;

    reportTableBody.innerHTML = "";
    const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));

    if (!sorted.length) {
      reportTableBody.innerHTML = `<tr><td colspan="6" class="subtle">No transactions for this report.</td></tr>`;
      return;
    }

    for (const t of sorted) {
      const receipt = t.receipt
        ? (t.receipt.mime.startsWith("image/") ? "Image" : "PDF/File")
        : "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(t.date)}</td>
        <td>${escapeHtml(t.type === "income" ? "Income" : "Expense")}</td>
        <td>${escapeHtml(t.category)}</td>
        <td class="right">${money(t.amount)}</td>
        <td>${escapeHtml(t.desc || "")}</td>
        <td>${receipt}</td>
      `;
      reportTableBody.appendChild(tr);
    }
  }

  // ---------------- Editing ----------------
  function editProperty(id) {
    const p = state.properties.find(x => x.id === id);
    if (!p) return;

    const name = prompt("Property name:", p.name);
    if (name === null) return;

    const tenant = prompt("Tenant name (optional):", p.tenant || "");
    if (tenant === null) return;

    const ls = prompt("Lease start (YYYY-MM-DD) or blank:", p.leaseStart || "");
    if (ls === null) return;

    const le = prompt("Lease end (YYYY-MM-DD) or blank:", p.leaseEnd || "");
    if (le === null) return;

    const rent = prompt("Monthly rent for recurring (number):", String(p.monthlyRent || 0));
    if (rent === null) return;

    const enabled = prompt("Recurring rent enabled? (yes/no):", p.rentAutoEnabled ? "yes" : "no");
    if (enabled === null) return;

    const due = prompt("Rent due day (1-28):", String(p.rentDueDay || 1));
    if (due === null) return;

    p.name = name.trim() || p.name;
    p.tenant = tenant.trim();
    p.leaseStart = isValidDateStr(ls.trim()) ? ls.trim() : "";
    p.leaseEnd = isValidDateStr(le.trim()) ? le.trim() : "";
    p.monthlyRent = round2(Math.max(0, Number(rent) || 0));
    p.rentAutoEnabled = (enabled.trim().toLowerCase() === "yes");
    p.rentDueDay = clampInt(due, 1, 28, 1);

    // Optionally generate missing recurring rent after changes
    generateRecurringRentForProperty(p.id);

    save(state);
    renderAll();
  }

  async function editTxn(id) {
    const t = state.txns.find(x => x.id === id);
    if (!t) return;

    const newAmount = prompt("Amount:", String(t.amount));
    if (newAmount === null) return;

    const newCategory = prompt("Category:", t.category);
    if (newCategory === null) return;

    const newDesc = prompt("Description (optional):", t.desc || "");
    if (newDesc === null) return;

    const amt = Number(newAmount);
    if (!(amt >= 0)) return alert("Amount must be a number >= 0.");

    t.amount = round2(amt);
    t.category = newCategory.trim() || t.category;
    t.desc = newDesc.trim();

    // receipt edit: only for expense
    if (t.type === "expense") {
      const change = prompt("Update receipt? (keep/remove):", "keep");
      if (change && change.toLowerCase() === "remove") {
        t.receipt = null;
      }
    }
  }

  // ---------------- Recurring Rent ----------------
  function ensureRecurringRentsForAll() {
    // Generates missing rent transactions based on lease + recurring settings.
    // Runs on render to keep things consistent if user edits dates.
    for (const p of state.properties) generateRecurringRentForProperty(p.id);
    save(state);
  }

  function generateRecurringRentForProperty(propertyId, forceAlert = false) {
    const p = state.properties.find(x => x.id === propertyId);
    if (!p) return;

    if (!p.rentAutoEnabled) {
      if (forceAlert) alert("Recurring rent is OFF for this property. Turn it on in Edit.");
      return;
    }

    if (!(p.monthlyRent > 0)) {
      if (forceAlert) alert("Set a Monthly Rent amount first.");
      return;
    }

    // Lease start required to generate recurring rent
    if (!p.leaseStart) {
      if (forceAlert) alert("Set a Lease Start date to generate recurring rent.");
      return;
    }

    const start = new Date(p.leaseStart + "T00:00:00");
    if (Number.isNaN(start.getTime())) return;

    // End: leaseEnd if present else generate up to current month + 2 months
    const end = p.leaseEnd ? new Date(p.leaseEnd + "T23:59:59") : addMonths(new Date(), 2);

    // Build month list from start month to end month
    const months = enumerateMonths(start, end);

    let added = 0;
    for (const ym of months) {
      // Date is due day within that month, clamped
      const d = dateFromYMAndDay(ym, p.rentDueDay);

      // Skip outside lease end boundary
      if (p.leaseEnd) {
        const le = new Date(p.leaseEnd + "T23:59:59");
        if (d > le) continue;
      }

      const exists = state.txns.some(tx =>
        tx.propertyId === p.id &&
        tx.type === "income" &&
        tx.recurring?.kind === "rent" &&
        tx.recurring?.ym === ym
      );
      if (exists) continue;

      state.txns.push({
        id: uid(),
        propertyId: p.id,
        type: "income",
        date: toISODate(d),
        amount: round2(p.monthlyRent),
        category: "Rent",
        desc: `Auto rent for ${formatYM(ym)}`,
        receipt: null,
        recurring: { kind: "rent", ym },
        createdAt: new Date().toISOString(),
      });
      added++;
    }

    if (forceAlert) alert(added ? `Generated ${added} rent entries.` : "No missing rent entries to generate.");
  }

  // ---------------- Report Export ----------------
  function getReportTxns() {
    const prop = reportProperty.value || "all";
    const from = reportFrom.value ? new Date(reportFrom.value + "T00:00:00") : null;
    const to = reportTo.value ? new Date(reportTo.value + "T23:59:59") : null;

    return state.txns.filter(t => {
      if (prop !== "all" && t.propertyId !== prop) return false;
      const d = new Date(t.date + "T12:00:00");
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }

  function exportReportCsv() {
    const rows = getReportTxns();
    const csv = txnsToCsv(rows);
    downloadTextFile(csv, `rental-report-${todayISO()}.csv`, "text/csv;charset=utf-8;");
  }

  async function exportReportPdf() {
    const rows = getReportTxns().sort((a, b) => (a.date < b.date ? -1 : 1));
    const propLabel =
      reportProperty.value === "all"
        ? "All properties"
        : (state.properties.find(p => p.id === reportProperty.value)?.name || "Selected property");

    const title = `Rental Report - ${propLabel}`;
    await exportPdf({
      title,
      from: reportFrom.value || "",
      to: reportTo.value || "",
      rows,
      includeReceipts: true
    });
  }

  async function exportDashboardPdf() {
    const rows = getDashboardFilteredTxns().sort((a, b) => (a.date < b.date ? -1 : 1));
    const propLabel =
      filterProperty.value === "all"
        ? "All properties"
        : (state.properties.find(p => p.id === filterProperty.value)?.name || "Selected property");

    const title = `Rental Summary - ${propLabel}`;
    await exportPdf({
      title,
      from: filterFrom.value || "",
      to: filterTo.value || "",
      rows,
      includeReceipts: true
    });
  }

  async function exportPdf({ title, from, to, rows, includeReceipts }) {
    // jsPDF is loaded via CDN
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert("PDF library not loaded. Check your internet connection or CDN links.");
      return;
    }

    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const left = 40;

    doc.setFontSize(16);
    doc.text(title, left, 48);

    doc.setFontSize(10);
    const range = (from || to) ? `Date Range: ${from || "…"} → ${to || "…"}`
                              : `Date Range: All dates`;
    doc.text(range, left, 66);
    doc.text(`Generated: ${new Date().toLocaleString()}`, left, 82);

    const tableRows = rows.map(t => {
      const p = state.properties.find(x => x.id === t.propertyId);
      const receiptLabel =
        t.receipt ? (t.receipt.mime?.startsWith("image/") ? "Image" : "PDF/File") : "";
      return [
        t.date,
        p?.name || "Unknown",
        t.type === "income" ? "Income" : "Expense",
        t.category,
        money(t.amount),
        t.desc || "",
        receiptLabel
      ];
    });

    doc.autoTable({
      startY: 100,
      head: [["Date", "Property", "Type", "Category", "Amount", "Description", "Receipt"]],
      body: tableRows,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [30, 45, 90] },
      columnStyles: { 4: { halign: "right" } }
    });

    if (includeReceipts) {
      // Attach receipt thumbnails (images only) after the table
      let y = doc.lastAutoTable.finalY + 18;

      const imageReceipts = rows
        .filter(t => t.receipt && t.receipt.mime && t.receipt.mime.startsWith("image/"))
        .slice(0, 12); // keep PDFs from exploding in size

      if (imageReceipts.length) {
        doc.setFontSize(12);
        doc.text("Receipt Thumbnails (first 12 image receipts)", left, y);
        y += 14;

        for (const t of imageReceipts) {
          const p = state.properties.find(x => x.id === t.propertyId);
          const label = `${t.date} • ${(p?.name || "Unknown")} • ${t.category} • ${money(t.amount)}`;

          doc.setFontSize(9);
          doc.text(label, left, y);
          y += 8;

          // Add image scaled
          const imgInfo = await safeLoadImage(t.receipt.dataUrl);
          if (!imgInfo) {
            doc.setFontSize(8);
            doc.text("(Could not embed this image receipt)", left, y + 10);
            y += 24;
            continue;
          }

          const maxW = 520;
          const maxH = 220;
          const { width, height, format } = imgInfo;

          const scale = Math.min(maxW / width, maxH / height, 1);
          const w = width * scale;
          const h = height * scale;

          // Page break if image won't fit
          const pageH = doc.internal.pageSize.getHeight();
          if (y + h + 40 > pageH) {
            doc.addPage();
            y = 60;
          }

          // Embed image
          doc.addImage(imgInfo.dataUrl, format, left, y, w, h);
          y += h + 16;

          // If we're near the bottom, start a new page for the next receipt
          if (y + 40 > pageH) {
            doc.addPage();
            y = 60;
          }
        }
      }
    }

    // Save PDF
    const fileSafeTitle = String(title || "rental-report")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const filename = `${fileSafeTitle || "rental-report"}-${todayISO()}.pdf`;
    doc.save(filename);
  }

  // Helper used by exportPdf() – was missing
  function safeLoadImage(dataUrl) {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          // jsPDF expects format like "PNG" or "JPEG"
          const fmt = dataUrl.startsWith("data:image/png")
            ? "PNG"
            : dataUrl.startsWith("data:image/webp")
            ? "WEBP"
            : "JPEG";
          resolve({ width: img.width, height: img.height, format: fmt, dataUrl });
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      } catch {
        resolve(null);
      }
    });
  }

  // Helper function for date formatting
  function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

})(); // Close the IIFE
