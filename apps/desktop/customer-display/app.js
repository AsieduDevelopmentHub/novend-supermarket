(function () {
  "use strict";

  var BRAND_TAGLINE = "Smart POS. Strong business.";
  var currency = new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  });

  var root = document.getElementById("root");
  var state = idleSnapshot();

  function idleSnapshot() {
    return {
      version: 1,
      phase: "idle",
      items: [],
      itemCount: 0,
      subtotal: 0,
      discount: 0,
      total: 0,
      discountMode: "amount",
      discountField: 0,
      branding: { tradeName: "Novend POS", branchName: null, thankYouLine: null },
      updatedAt: Date.now(),
    };
  }

  function formatCurrency(amount) {
    return currency.format(Number.isFinite(amount) ? amount : 0);
  }

  function formatDateTime(value) {
    try {
      var date = new Date(value);
      var day = date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      var time = date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return day + " · " + time;
    } catch (_error) {
      return "";
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function icon(name, className) {
    var paths = {
      sparkles:
        '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path><path d="M20 3v4"></path><path d="M22 5h-4"></path><path d="M4 17v2"></path><path d="M5 18H3"></path>',
      check: '<path d="M21.801 10A10 10 0 1 1 17 3.335"></path><path d="m9 11 3 3L22 4"></path>',
      package:
        '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path><path d="M12 22V12"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><path d="m7.5 4.27 9 5.15"></path>',
    };
    return (
      '<svg class="icon ' +
      (className || "") +
      '" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">' +
      (paths[name] || "") +
      "</svg>"
    );
  }

  function parseSnapshot(raw) {
    if (!raw) return null;
    try {
      var parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!parsed || parsed.version !== 1) return null;
      if (
        parsed.phase !== "idle" &&
        parsed.phase !== "active" &&
        parsed.phase !== "processing" &&
        parsed.phase !== "complete"
      ) {
        return null;
      }
      if (!parsed.branding || typeof parsed.branding.tradeName !== "string") return null;
      if (!Array.isArray(parsed.items)) return null;
      return parsed;
    } catch (_error) {
      return null;
    }
  }

  function applyTheme() {
    try {
      var theme = window.localStorage.getItem("theme");
      document.documentElement.classList.toggle("dark", theme === "dark");
    } catch (_error) {
      /* ignore */
    }
  }

  function renderIdle() {
    var branding = state.branding || {};
    var promo =
      branding.thankYouLine && branding.thankYouLine.trim()
        ? branding.thankYouLine.trim()
        : BRAND_TAGLINE;
    return (
      '<div class="phase-panel customer-display-phase-in">' +
      '<div class="idle-panel">' +
      '<div class="idle-icon-wrap">' +
      '<span class="customer-display-pulse-ring" style="position:absolute;inset:0;border-radius:999px;background:color-mix(in srgb, var(--primary) 20%, transparent);" aria-hidden="true"></span>' +
      '<span class="customer-display-pulse-ring" style="position:absolute;inset:0;border-radius:999px;background:color-mix(in srgb, var(--primary) 10%, transparent);animation-delay:0.9s;" aria-hidden="true"></span>' +
      '<div class="idle-icon customer-display-glass customer-display-float">' +
      icon("sparkles", "text-primary") +
      "</div>" +
      "</div>" +
      '<div class="idle-card customer-display-glass">' +
      "<h2>Welcome to " +
      escapeHtml(branding.tradeName || "Novend POS") +
      "</h2>" +
      "<p>Your order will appear here as items are added. Sit back — we've got you.</p>" +
      '<p class="idle-promo">' +
      escapeHtml(promo) +
      "</p>" +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function renderCompletePanel() {
    var thankYou =
      (state.branding && state.branding.thankYouLine && state.branding.thankYouLine.trim()) ||
      "Thank you for your purchase!";
    var meta = "";
    if (state.invoiceNumber) {
      meta =
        "Receipt · " +
        escapeHtml(state.invoiceNumber) +
        (state.completedAt ? " · " + escapeHtml(formatDateTime(state.completedAt)) : "");
    }
    return (
      '<div class="complete-panel customer-display-complete-pop customer-display-glass">' +
      '<div class="complete-badge">' +
      icon("check") +
      "<span>Payment complete</span>" +
      "</div>" +
      "<h2>" +
      escapeHtml(thankYou) +
      "</h2>" +
      '<p class="complete-total customer-display-total-pop tabular-nums">' +
      formatCurrency(state.total) +
      "</p>" +
      (meta ? '<p class="complete-meta">' + meta + "</p>" : "") +
      "</div>"
    );
  }

  function renderCartItem(item, index) {
    var imageBlock = item.imageUrl
      ? '<img src="' + escapeHtml(item.imageUrl) + '" alt="" loading="lazy" />'
      : '<div class="cart-thumb-fallback">' + icon("package") + "</div>";
    return (
      '<li class="cart-item customer-display-item-in customer-display-glass customer-display-glass--nested" style="animation-delay:' +
      Math.min(index, 10) * 50 +
      'ms">' +
      '<div class="cart-item-row">' +
      '<div class="cart-thumb">' +
      imageBlock +
      "</div>" +
      '<div class="cart-item-body">' +
      '<p class="cart-item-name truncate">' +
      escapeHtml(item.name) +
      "</p>" +
      '<p class="cart-item-meta tabular-nums">' +
      formatCurrency(item.unitPrice) +
      " × " +
      item.quantity +
      "</p>" +
      (item.discount > 0
        ? '<p class="cart-item-discount tabular-nums">−' +
          formatCurrency(item.discount) +
          " discount</p>"
        : "") +
      "</div>" +
      '<p class="cart-item-total tabular-nums">' +
      formatCurrency(item.lineTotal) +
      "</p>" +
      "</div>" +
      "</li>"
    );
  }

  function renderCartPanel(compact) {
    var items = state.items.slice().reverse();
    var processing = state.phase === "processing";
    return (
      '<div class="cart-panel customer-display-glass' +
      (compact ? " compact" : "") +
      '">' +
      '<div class="cart-panel-inner">' +
      '<div class="cart-header' +
      (compact ? " compact" : "") +
      '">' +
      "<h2>" +
      (compact ? "Items" : "Your order") +
      "</h2>" +
      (processing
        ? '<span class="processing-badge customer-display-glass customer-display-shimmer"><span>Processing</span></span>'
        : '<span class="cart-count tabular-nums">' +
          state.itemCount +
          " item" +
          (state.itemCount === 1 ? "" : "s") +
          "</span>") +
      "</div>" +
      (state.customerName
        ? '<p class="customer-name">Customer · <strong>' +
          escapeHtml(state.customerName) +
          "</strong></p>"
        : "") +
      '<ul class="cart-list' +
      (state.customerName ? " has-customer" : "") +
      '">' +
      items.map(renderCartItem).join("") +
      "</ul>" +
      "</div>" +
      "</div>"
    );
  }

  function renderTotalsPanel() {
    var showDiscount = state.discount > 0.001;
    var processing = state.phase === "processing";
    var payment =
      !processing && state.paymentMethod
        ? "Paid · " + escapeHtml(String(state.paymentMethod).replace(/_/g, " "))
        : processing
          ? "Please wait while we finalize your order…"
          : "";
    return (
      '<aside class="aside-panel">' +
      '<div class="totals-panel customer-display-glass">' +
      "<h2>Summary</h2>" +
      '<dl class="totals-list">' +
      '<div class="totals-row"><dt class="text-muted">Subtotal</dt><dd class="tabular-nums">' +
      formatCurrency(state.subtotal) +
      "</dd></div>" +
      (showDiscount
        ? '<div class="totals-row"><dt class="text-muted">Discount' +
          (state.discountMode === "percent" && state.discountField > 0
            ? " (" + state.discountField + "%)"
            : "") +
          '</dt><dd class="text-success tabular-nums">−' +
          formatCurrency(state.discount) +
          "</dd></div>"
        : "") +
      "</dl>" +
      '<hr class="totals-divider" />' +
      '<div class="totals-grand">' +
      '<p class="totals-grand-label">Total</p>' +
      '<p class="totals-grand-value customer-display-total-pop tabular-nums">' +
      formatCurrency(state.total) +
      "</p>" +
      "</div>" +
      (payment
        ? '<p class="totals-note ' +
          (processing ? "text-warning" : "text-muted") +
          '">' +
          payment +
          "</p>"
        : "") +
      "</div>" +
      "</aside>"
    );
  }

  function renderPhasePanel(showCart) {
    if (state.phase === "idle") return renderIdle();
    if (state.phase === "complete") {
      return (
        '<div class="phase-panel customer-display-phase-in cart-layout">' +
        renderCompletePanel() +
        renderCartPanel(true) +
        "</div>"
      );
    }
    if (showCart) {
      return (
        '<div class="phase-panel customer-display-phase-in">' + renderCartPanel(false) + "</div>"
      );
    }
    return "";
  }

  function render() {
    var branding = state.branding || {};
    var showCart =
      state.phase === "active" || state.phase === "processing" || state.phase === "complete";
    root.innerHTML =
      '<div class="customer-display-ambient">' +
      '<div class="customer-display-mesh" aria-hidden="true">' +
      '<div class="customer-display-mesh-blobs"></div>' +
      '<div class="customer-display-mesh-blobs customer-display-mesh-blobs--alt"></div>' +
      '<div class="customer-display-mesh-grid customer-display-mesh-grid--primary"></div>' +
      '<div class="customer-display-mesh-grid customer-display-mesh-grid--diagonal"></div>' +
      "</div>" +
      '<div class="layout">' +
      '<header class="layout-header">' +
      '<div class="welcome-bar customer-display-glass customer-display-fade-up">' +
      '<span class="welcome-label">Welcome</span>' +
      '<span class="welcome-dot" aria-hidden="true">·</span>' +
      '<h1 class="welcome-title truncate">' +
      escapeHtml(branding.tradeName || "Novend POS") +
      "</h1>" +
      '<span class="welcome-dot" aria-hidden="true">·</span>' +
      '<p class="welcome-subtitle truncate">' +
      escapeHtml(branding.branchName || BRAND_TAGLINE) +
      "</p>" +
      "</div>" +
      "</header>" +
      '<main class="layout-main">' +
      renderPhasePanel(showCart) +
      (showCart ? renderTotalsPanel() : "") +
      "</main>" +
      '<footer class="layout-footer">Powered by Novend POS</footer>' +
      "</div>" +
      "</div>";
  }

  function setSnapshot(next) {
    var parsed = parseSnapshot(next);
    if (!parsed) return;
    state = parsed;
    render();
  }

  applyTheme();
  render();

  var bridge = window.novendDesktop;
  if (bridge && typeof bridge.onCustomerDisplayState === "function") {
    bridge.onCustomerDisplayState(setSnapshot);
  }

  window.addEventListener("storage", function (event) {
    if (event.key === "theme") applyTheme();
  });
})();
