const STORAGE_KEY = "restaurant_order_v2";

/* ---------- Helpers ---------- */
function toMoney(n) {
  return (Number(n) || 0).toFixed(2);
}

function getCategory() {
  return document.body.getAttribute("data-category") || "Unknown";
}

function readCart() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeCart(cart) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

function openReceipt() {
  const modal = document.getElementById("receiptModal");
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeReceipt() {
  const modal = document.getElementById("receiptModal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function nowPH() {
  return new Date().toLocaleString("en-PH");
}

/* ---------- Save/Restore per-page cart ---------- */
function saveCurrentPageToCart() {
  const category = getCategory();
  const cart = readCart();
  const items = [];

  document.querySelectorAll(".card").forEach((card) => {
    const name = card.getAttribute("data-item") || "Item";
    const price = Number(card.getAttribute("data-price")) || 0;
    const qty = Number(card.querySelector("[data-value]")?.textContent) || 0;

    if (qty > 0) items.push({ name, price, qty });
  });

  cart[category] = items;
  writeCart(cart);
}

function restoreCurrentPageFromCart() {
  const category = getCategory();
  const cart = readCart();
  const items = cart[category] || [];
  const map = new Map(items.map((i) => [i.name, i.qty]));

  document.querySelectorAll(".card").forEach((card) => {
    const name = card.getAttribute("data-item") || "Item";
    const qty = map.get(name) || 0;
    const valueEl = card.querySelector("[data-value]");
    if (valueEl) valueEl.textContent = String(qty);
  });
}

/* ---------- Combine ALL pages from localStorage ---------- */
function getCombinedItems() {
  const cart = readCart();
  const combined = [];

  Object.keys(cart).forEach((cat) => {
    (cart[cat] || []).forEach((it) => combined.push({ category: cat, ...it }));
  });

  return combined;
}

function computeTotals(age) {
  const items = getCombinedItems();

  let original = 0;
  items.forEach((it) => {
    original += (Number(it.price) || 0) * (Number(it.qty) || 0);
  });

  const isSenior = Number(age) >= 60;
  const discount = isSenior ? original * 0.12 : 0;
  const finalPayable = original - discount;

  return { items, original, discount, finalPayable, isSenior };
}

/* ---------- Update totals section (current page) ---------- */
function updateTotalsUI({ original, discount, finalPayable }) {
  const originalEl = document.getElementById("originalTotal");
  const discountEl = document.getElementById("discountAmount");
  const finalEl = document.getElementById("finalTotal");

  if (originalEl) originalEl.textContent = toMoney(original);
  if (discountEl) discountEl.textContent = toMoney(discount);
  if (finalEl) finalEl.textContent = toMoney(finalPayable);
}

/* ---------- Update receipt modal UI ---------- */
function updateReceiptUI({ items, original, discount, finalPayable, isSenior }) {
  const list = document.getElementById("receiptList");
  const badge = document.getElementById("receiptSeniorBadge");
  const dateEl = document.getElementById("receiptDate");

  const rOriginal = document.getElementById("receiptOriginal");
  const rDiscount = document.getElementById("receiptDiscount");
  const rFinal = document.getElementById("receiptFinal");

  if (badge) badge.textContent = isSenior ? "Senior" : "Regular";
  if (dateEl) dateEl.textContent = nowPH();

  if (rOriginal) rOriginal.textContent = toMoney(original);
  if (rDiscount) rDiscount.textContent = toMoney(discount);
  if (rFinal) rFinal.textContent = toMoney(finalPayable);

  if (!list) return;

  // group by category for clean combined receipt
  const groups = {};
  items.forEach((it) => {
    if (!groups[it.category]) groups[it.category] = [];
    groups[it.category].push(it);
  });

  list.innerHTML = "";

  const cats = Object.keys(groups);
  if (cats.length === 0) {
    list.innerHTML = `<div class="ritem"><span>No items yet</span><span>—</span><span>P 0.00</span></div>`;
    return;
  }

  cats.forEach((cat) => {
    const label = document.createElement("div");
    label.className = "ritem";
    label.innerHTML = `<span><strong>${cat}</strong></span><span></span><span></span>`;
    list.appendChild(label);

    groups[cat].forEach(({ name, price, qty }) => {
      const sub = (Number(price) || 0) * (Number(qty) || 0);
      const row = document.createElement("div");
      row.className = "ritem";
      row.innerHTML = `
        <span>${name} <small>(₱${toMoney(price)})</small></span>
        <span>${qty}</span>
        <span>P ${toMoney(sub)}</span>
      `;
      list.appendChild(row);
    });
  });
}

/* ---------- REAL-TIME SYNC ---------- */
function syncEverything() {
  const age = Number(document.getElementById("ageInput")?.value) || 0;
  const result = computeTotals(age);
  updateTotalsUI(result);
  updateReceiptUI(result);
}

/* ---------- Hook controls ---------- */
function hookControls() {
  document.querySelectorAll(".card").forEach((card) => {
    const valueEl = card.querySelector("[data-value]");
    const minus = card.querySelector("[data-minus]");
    const plus = card.querySelector("[data-plus]");

    const getVal = () => Number(valueEl?.textContent) || 0;
    const setVal = (n) => {
      if (!valueEl) return;
      valueEl.textContent = String(n);
      saveCurrentPageToCart();
      syncEverything();
    };

    minus?.addEventListener("click", () => setVal(Math.max(0, getVal() - 1)));
    plus?.addEventListener("click", () => setVal(getVal() + 1));

    card.querySelector(".buy")?.addEventListener("click", () => {
      const name = card.getAttribute("data-item") || "Item";
      const qty = getVal();
      if (qty <= 0) return alert("Please add quantity first.");
      saveCurrentPageToCart();
      syncEverything();
      alert(`Added ${qty} ${name}(s).`);
    });
  });

  // Age input realtime
  document.getElementById("ageInput")?.addEventListener("input", () => {
    syncEverything();
  });
}

/* ---------- Open receipt button ---------- */
document.getElementById("placeOrder")?.addEventListener("click", () => {
  saveCurrentPageToCart();
  syncEverything();

  const items = getCombinedItems();
  if (!items.length) {
    alert("No items selected yet (from any page).");
    return;
  }
  openReceipt();
});

/* ---------- Close modal ---------- */
document.getElementById("receiptModal")?.addEventListener("click", (e) => {
  const t = e.target;
  if (t && t.matches("[data-close]")) closeReceipt();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeReceipt();
});

/* ---------- Clear all ---------- */
function clearAllOrders() {
  localStorage.removeItem(STORAGE_KEY);
  document.querySelectorAll(".card [data-value]").forEach((el) => (el.textContent = "0"));
  const ageInput = document.getElementById("ageInput");
  if (ageInput) ageInput.value = "";
  syncEverything();
}
window.clearAllOrders = clearAllOrders;

/* ---------- INIT ---------- */
restoreCurrentPageFromCart();
hookControls();
syncEverything();