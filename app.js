(function () {
  "use strict";

  const STORAGE_KEY = "flower-trade-management-v1";
  const API_BASE = window.location.protocol === "file:" ? "" : "/api";
  const app = document.getElementById("app");
  const toastEl = document.getElementById("toast");
  const currentDateEl = document.getElementById("currentDate");
  const storageModeEl = document.getElementById("storageMode");
  let serverBacked = false;
  let saveTimer = null;

  const statusMap = {
    created: { label: "已创建", className: "status-created", next: "paid", nextLabel: "确认付款" },
    paid: { label: "已付款", className: "status-paid", next: "shipped", nextLabel: "安排发货" },
    shipped: { label: "已发货", className: "status-shipped", next: "delivered", nextLabel: "确认交付" },
    delivered: { label: "已交付", className: "status-delivered", next: null, nextLabel: "" },
    cancelled: { label: "已取消", className: "status-cancelled", next: null, nextLabel: "" }
  };

  const periodNames = {
    month: "月度",
    quarter: "季度",
    year: "年度"
  };

  const state = {
    view: "dashboard",
    data: loadData(),
    cart: [],
    filters: {
      flowerSearch: "",
      orderStatus: "all",
      statsPeriod: "month",
      shopCustomerId: "CUS001"
    },
    editing: {
      flowerId: null,
      customerId: null,
      supplierId: null
    }
  };

  function seedData() {
    const suppliers = [
      {
        id: "SUP001",
        name: "晨露花艺供应社",
        contact: "周岚",
        phone: "13800010001",
        email: "morning@example.com",
        agreement: "年度鲜切花供应协议，结算周期为月结 30 天。",
        paymentRecords: [
          { date: "2026-04-28", amount: 8600, status: "已付款" },
          { date: "2026-05-28", amount: 9200, status: "已付款" }
        ]
      },
      {
        id: "SUP002",
        name: "云上温室基地",
        contact: "林启",
        phone: "13800010002",
        email: "greenhouse@example.com",
        agreement: "精品盆栽与兰花供应协议，支持紧急补货。",
        paymentRecords: [
          { date: "2026-05-25", amount: 5800, status: "待付款" }
        ]
      },
      {
        id: "SUP003",
        name: "南湾鲜花合作社",
        contact: "何敏",
        phone: "13800010003",
        email: "southbay@example.com",
        agreement: "节日花束供应协议，按批次验收付款。",
        paymentRecords: [
          { date: "2026-05-12", amount: 4300, status: "已付款" }
        ]
      }
    ];

    const flowers = [
      {
        id: "FL001",
        name: "红玫瑰礼束",
        sku: "ROSE-RED-10",
        category: "玫瑰",
        price: 88,
        supplierId: "SUP001",
        stock: 28,
        threshold: 15,
        unit: "束",
        status: "上架",
        theme: "theme-rose",
        description: "10 支红玫瑰搭配尤加利，适合纪念日与生日订单。"
      },
      {
        id: "FL002",
        name: "向日葵暖阳束",
        sku: "SUN-06",
        category: "向日葵",
        price: 68,
        supplierId: "SUP003",
        stock: 9,
        threshold: 12,
        unit: "束",
        status: "上架",
        theme: "theme-sun",
        description: "6 支向日葵与绿色配草，适合探望和祝福场景。"
      },
      {
        id: "FL003",
        name: "蝴蝶兰盆栽",
        sku: "ORCHID-POT-02",
        category: "兰花",
        price: 168,
        supplierId: "SUP002",
        stock: 16,
        threshold: 8,
        unit: "盆",
        status: "上架",
        theme: "theme-orchid",
        description: "双枝蝴蝶兰盆栽，适合办公桌、前台和开业赠礼。"
      },
      {
        id: "FL004",
        name: "香水百合花束",
        sku: "LILY-WHITE-05",
        category: "百合",
        price: 98,
        supplierId: "SUP001",
        stock: 5,
        threshold: 10,
        unit: "束",
        status: "上架",
        theme: "theme-lily",
        description: "白色香水百合搭配满天星，花期稳定，香气明显。"
      },
      {
        id: "FL005",
        name: "蓝绣球礼盒",
        sku: "HYD-BLUE-BOX",
        category: "绣球",
        price: 128,
        supplierId: "SUP003",
        stock: 22,
        threshold: 9,
        unit: "盒",
        status: "上架",
        theme: "theme-blue",
        description: "蓝色绣球礼盒装，适合节日送礼与企业客户。"
      }
    ];

    const customers = [
      {
        id: "CUS001",
        name: "李婉",
        phone: "13900020001",
        email: "liwan@example.com",
        address: "上海市浦东新区花木路 88 号",
        preference: "偏好玫瑰和浅色系花束",
        level: "VIP",
        notes: "纪念日订单频率高",
        joinedAt: "2026-01-16"
      },
      {
        id: "CUS002",
        name: "陈序",
        phone: "13900020002",
        email: "chenxu@example.com",
        address: "杭州市西湖区文三路 19 号",
        preference: "偏好盆栽与低维护花材",
        level: "普通",
        notes: "常为公司前台采购",
        joinedAt: "2026-02-08"
      },
      {
        id: "CUS003",
        name: "苏晴",
        phone: "13900020003",
        email: "suqing@example.com",
        address: "南京市玄武区中央路 66 号",
        preference: "偏好向日葵和明亮色系",
        level: "银卡",
        notes: "节日前会提前下单",
        joinedAt: "2026-03-11"
      }
    ];

    const orders = [
      {
        id: "ORD20260501001",
        customerId: "CUS001",
        customerName: "李婉",
        items: [
          { flowerId: "FL001", name: "红玫瑰礼束", price: 88, quantity: 2 },
          { flowerId: "FL005", name: "蓝绣球礼盒", price: 128, quantity: 1 }
        ],
        total: 304,
        status: "delivered",
        createdAt: "2026-05-01T09:28:00",
        paidAt: "2026-05-01T09:33:00",
        shippedAt: "2026-05-01T15:20:00",
        deliveredAt: "2026-05-02T11:05:00"
      },
      {
        id: "ORD20260518002",
        customerId: "CUS002",
        customerName: "陈序",
        items: [
          { flowerId: "FL003", name: "蝴蝶兰盆栽", price: 168, quantity: 3 }
        ],
        total: 504,
        status: "paid",
        createdAt: "2026-05-18T14:10:00",
        paidAt: "2026-05-18T14:16:00",
        shippedAt: "",
        deliveredAt: ""
      },
      {
        id: "ORD20260602003",
        customerId: "CUS003",
        customerName: "苏晴",
        items: [
          { flowerId: "FL002", name: "向日葵暖阳束", price: 68, quantity: 4 },
          { flowerId: "FL004", name: "香水百合花束", price: 98, quantity: 1 }
        ],
        total: 370,
        status: "created",
        createdAt: "2026-06-02T10:35:00",
        paidAt: "",
        shippedAt: "",
        deliveredAt: ""
      }
    ];

    return {
      suppliers,
      flowers,
      customers,
      orders,
      inventoryLogs: [
        { id: "LOG001", flowerId: "FL002", flowerName: "向日葵暖阳束", type: "销售扣减", quantity: 4, note: "订单 ORD20260602003", date: "2026-06-02T10:35:00" },
        { id: "LOG002", flowerId: "FL004", flowerName: "香水百合花束", type: "销售扣减", quantity: 1, note: "订单 ORD20260602003", date: "2026-06-02T10:35:00" },
        { id: "LOG003", flowerId: "FL003", flowerName: "蝴蝶兰盆栽", type: "补货", quantity: 8, note: "供应商到货入库", date: "2026-05-29T16:20:00" }
      ],
      notifications: [
        {
          id: "NTC001",
          type: "订单通知",
          title: "新订单待处理",
          message: "苏晴提交了订单 ORD20260602003，总金额 ￥370.00。",
          createdAt: "2026-06-02T10:35:00",
          read: false,
          ref: "ORD20260602003"
        }
      ]
    };
  }

  function normalizeData(parsed) {
    return {
      ...seedData(),
      ...parsed,
      suppliers: parsed.suppliers || [],
      flowers: parsed.flowers || [],
      customers: parsed.customers || [],
      orders: parsed.orders || [],
      inventoryLogs: parsed.inventoryLogs || [],
      notifications: parsed.notifications || []
    };
  }

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        return seedData();
      }
      const parsed = JSON.parse(saved);
      return normalizeData(parsed);
    } catch (error) {
      console.error(error);
      return seedData();
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    if (serverBacked) {
      persistToServer();
    }
  }

  function hasSnapshotData(data) {
    return ["suppliers", "flowers", "customers", "orders", "inventoryLogs", "notifications"]
      .some((key) => Array.isArray(data[key]) && data[key].length > 0);
  }

  async function loadServerData() {
    if (!API_BASE) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/data`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      serverBacked = true;
      if (hasSnapshotData(payload)) {
        state.data = normalizeData(payload);
        if (!state.data.customers.some((customer) => customer.id === state.filters.shopCustomerId)) {
          state.filters.shopCustomerId = state.data.customers[0]?.id || "";
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
      } else {
        await persistToServerNow();
      }
      showToast("已连接 SQLite 数据库");
      render();
    } catch (error) {
      console.warn("SQLite backend unavailable, using localStorage.", error);
      serverBacked = false;
      render();
    }
  }

  function persistToServer() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(persistToServerNow, 180);
  }

  async function persistToServerNow() {
    if (!serverBacked || !API_BASE) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.data)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Failed to save data to SQLite.", error);
      showToast("数据库保存失败，已保留浏览器本地数据", "error");
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function currency(value) {
    return `￥${Number(value || 0).toFixed(2)}`;
  }

  function formatDate(value, withTime) {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const dateText = date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    if (!withTime) {
      return dateText;
    }
    return `${dateText} ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function nextId(prefix, list) {
    const max = list.reduce((acc, item) => {
      const numeric = Number(String(item.id || "").replace(/\D/g, ""));
      return Number.isFinite(numeric) ? Math.max(acc, numeric) : acc;
    }, 0);
    return `${prefix}${String(max + 1).padStart(3, "0")}`;
  }

  function nextOrderId() {
    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("");
    const count = state.data.orders.filter((order) => order.id.includes(stamp)).length + 1;
    return `ORD${stamp}${String(count).padStart(3, "0")}`;
  }

  function supplierName(id) {
    return state.data.suppliers.find((supplier) => supplier.id === id)?.name || "未关联供应商";
  }

  function customerName(id) {
    return state.data.customers.find((customer) => customer.id === id)?.name || "未知客户";
  }

  function stockStatus(flower) {
    if (flower.stock <= 0) {
      return { label: "无库存", className: "stock-empty" };
    }
    if (flower.stock <= flower.threshold) {
      return { label: "需补货", className: "stock-low" };
    }
    return { label: "库存正常", className: "stock-ok" };
  }

  function addNotification(type, title, message, ref) {
    state.data.notifications.unshift({
      id: nextId("NTC", state.data.notifications),
      type,
      title,
      message,
      createdAt: nowIso(),
      read: false,
      ref
    });
  }

  function syncInventoryAlerts() {
    state.data.flowers.forEach((flower) => {
      const existing = state.data.notifications.find((notice) => notice.type === "补货预警" && notice.ref === flower.id && !notice.resolved);
      if (flower.stock <= flower.threshold) {
        if (!existing) {
          addNotification(
            "补货预警",
            `${flower.name} 库存低于阈值`,
            `当前库存 ${flower.stock}${flower.unit}，警戒阈值 ${flower.threshold}${flower.unit}，建议联系 ${supplierName(flower.supplierId)} 补货。`,
            flower.id
          );
        }
      } else if (existing) {
        existing.resolved = true;
        existing.read = true;
      }
    });
  }

  function showToast(message, type) {
    toastEl.textContent = message;
    toastEl.className = `toast show ${type === "error" ? "error" : ""}`;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toastEl.className = "toast";
    }, 2400);
  }

  function setView(view) {
    state.view = view;
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.view === view);
    });
    render();
    app.focus({ preventScroll: true });
  }

  function render() {
    syncInventoryAlerts();
    saveData();
    currentDateEl.textContent = formatDate(new Date().toISOString(), true);
    if (storageModeEl) {
      storageModeEl.textContent = serverBacked ? "SQLite 数据库" : "浏览器本地";
    }

    const views = {
      dashboard: renderDashboard,
      shop: renderShop,
      flowers: renderFlowers,
      orders: renderOrders,
      inventory: renderInventory,
      customers: renderCustomers,
      statistics: renderStatistics,
      suppliers: renderSuppliers
    };

    app.innerHTML = views[state.view]();
  }

  function viewHeader(title, subtitle, actions = "") {
    return `
      <div class="view-header">
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
        </div>
        ${actions ? `<div class="toolbar-group">${actions}</div>` : ""}
      </div>
    `;
  }

  function renderDashboard() {
    const monthKey = new Date().toISOString().slice(0, 7);
    const activeOrders = state.data.orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
    const lowStock = state.data.flowers.filter((flower) => flower.stock <= flower.threshold);
    const monthRevenue = state.data.orders
      .filter((order) => order.status === "delivered" && order.deliveredAt.slice(0, 7) === monthKey)
      .reduce((sum, order) => sum + order.total, 0);
    const unread = state.data.notifications.filter((notice) => !notice.read && !notice.resolved).length;
    const recentOrders = [...state.data.orders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    return `
      ${viewHeader("运营概览", "花卉交易平台后台")}
      <section class="grid four">
        ${statCard("本月销售额", currency(monthRevenue), "已交付订单")}
        ${statCard("待处理订单", activeOrders.length, "创建、付款、发货中")}
        ${statCard("库存预警", lowStock.length, "低于警戒阈值")}
        ${statCard("未读通知", unread, "订单与补货消息")}
      </section>

      <section class="grid two" style="margin-top: 16px;">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>最近订单</h3>
              <p>按创建时间排序</p>
            </div>
            <button class="small-button" type="button" data-view="orders">查看全部</button>
          </div>
          ${recentOrders.length ? renderOrderTable(recentOrders, true) : emptyState("暂无订单")}
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>通知中心</h3>
              <p>订单通知与库存预警</p>
            </div>
            <button class="small-button" type="button" data-action="read-all-notices">全部已读</button>
          </div>
          ${renderNotifications()}
        </div>
      </section>

      <section class="panel" style="margin-top: 16px;">
        <div class="panel-header">
          <div>
            <h3>库存预警清单</h3>
            <p>补货后预警会自动归档</p>
          </div>
          <button class="small-button" type="button" data-view="inventory">进入库存</button>
        </div>
        ${lowStock.length ? renderLowStockList(lowStock) : emptyState("当前库存状态良好")}
      </section>
    `;
  }

  function statCard(label, value, hint) {
    return `
      <div class="stat-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(hint)}</small>
      </div>
    `;
  }

  function renderNotifications() {
    const notices = state.data.notifications
      .filter((notice) => !notice.resolved)
      .slice(0, 8);
    if (!notices.length) {
      return emptyState("暂无通知");
    }
    return `
      <div class="notice-list">
        ${notices.map((notice) => `
          <div class="notice-item ${notice.read ? "" : "unread"}">
            <div class="notice-top">
              <span class="notice-title">${escapeHtml(notice.title)}</span>
              <span class="level-pill">${escapeHtml(notice.type)}</span>
            </div>
            <p>${escapeHtml(notice.message)}</p>
            <div class="notice-top">
              <p>${formatDate(notice.createdAt, true)}</p>
              ${notice.read ? "" : `<button class="small-button" type="button" data-action="read-notice" data-id="${notice.id}">已读</button>`}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderLowStockList(flowers) {
    return `
      <div class="simple-list">
        ${flowers.map((flower) => `
          <div class="simple-item">
            <div class="simple-top">
              <span class="simple-title">${escapeHtml(flower.name)}</span>
              <span class="stock-pill ${stockStatus(flower).className}">${stockStatus(flower).label}</span>
            </div>
            <p>库存 ${flower.stock}${escapeHtml(flower.unit)} / 阈值 ${flower.threshold}${escapeHtml(flower.unit)}，供应商：${escapeHtml(supplierName(flower.supplierId))}</p>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderShop() {
    const availableFlowers = state.data.flowers.filter((flower) => flower.status === "上架");
    const selectedCustomer = state.filters.shopCustomerId || state.data.customers[0]?.id || "";

    return `
      ${viewHeader("客户下单", "浏览花卉并生成订单")}
      <section class="grid two">
        <div class="panel">
          <div class="toolbar">
            <div class="toolbar-group">
              <label>
                下单客户
                <select id="shopCustomerSelect" data-filter="shopCustomerId">
                  ${state.data.customers.map((customer) => `
                    <option value="${customer.id}" ${customer.id === selectedCustomer ? "selected" : ""}>${escapeHtml(customer.name)} · ${escapeHtml(customer.phone)}</option>
                  `).join("")}
                </select>
              </label>
            </div>
            <button class="secondary-button" type="button" data-view="customers">维护客户</button>
          </div>
          <div class="flower-grid">
            ${availableFlowers.map(renderFlowerCard).join("")}
          </div>
        </div>
        <div class="panel cart-panel">
          <div class="panel-header">
            <div>
              <h3>购物车</h3>
              <p>${escapeHtml(customerName(selectedCustomer))}</p>
            </div>
            <button class="small-button" type="button" data-action="clear-cart">清空</button>
          </div>
          ${renderCart()}
        </div>
      </section>
    `;
  }

  function renderFlowerCard(flower) {
    const stock = stockStatus(flower);
    const disabled = flower.stock <= 0 ? "disabled" : "";
    return `
      <article class="flower-card">
        <div class="flower-art ${escapeHtml(flower.theme)}" aria-hidden="true"></div>
        <div>
          <h3>${escapeHtml(flower.name)}</h3>
          <p>${escapeHtml(flower.description)}</p>
        </div>
        <div class="card-meta">
          <span class="money">${currency(flower.price)}</span>
          <span class="stock-pill ${stock.className}">${flower.stock}${escapeHtml(flower.unit)}</span>
        </div>
        <button class="primary-button" type="button" data-action="add-to-cart" data-id="${flower.id}" ${disabled}>加入购物车</button>
      </article>
    `;
  }

  function renderCart() {
    if (!state.cart.length) {
      return emptyState("购物车为空");
    }
    const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return `
      <div>
        ${state.cart.map((item) => `
          <div class="cart-line">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <p class="muted">${currency(item.price)} / ${escapeHtml(item.unit)}</p>
            </div>
            <input class="compact-number" type="number" min="1" max="${item.stock}" value="${item.quantity}" data-action="cart-quantity" data-id="${item.flowerId}" />
            <button class="small-button danger" type="button" data-action="remove-cart-item" data-id="${item.flowerId}">×</button>
          </div>
        `).join("")}
        <div class="cart-total">
          <span>合计</span>
          <span>${currency(total)}</span>
        </div>
        <div class="button-row">
          <button class="primary-button" type="button" data-action="place-order">提交订单</button>
        </div>
      </div>
    `;
  }

  function renderFlowers() {
    const keyword = state.filters.flowerSearch.trim().toLowerCase();
    const flowers = state.data.flowers.filter((flower) => {
      const text = `${flower.name} ${flower.sku} ${flower.category} ${supplierName(flower.supplierId)}`.toLowerCase();
      return text.includes(keyword);
    });

    return `
      ${viewHeader("花卉信息管理", "维护商品库、价格、供应商和上下架状态")}
      <section class="grid two">
        ${renderFlowerForm()}
        <div class="panel">
          <div class="toolbar">
            <input type="search" placeholder="搜索名称、SKU、分类或供应商" value="${escapeHtml(state.filters.flowerSearch)}" data-filter="flowerSearch" />
            <span class="muted">${flowers.length} 条记录</span>
          </div>
          ${renderFlowerTable(flowers)}
        </div>
      </section>
    `;
  }

  function renderFlowerForm() {
    const editing = state.data.flowers.find((flower) => flower.id === state.editing.flowerId);
    const flower = editing || {
      name: "",
      sku: "",
      category: "玫瑰",
      price: "",
      supplierId: state.data.suppliers[0]?.id || "",
      stock: 0,
      threshold: 10,
      unit: "束",
      status: "上架",
      theme: "theme-rose",
      description: ""
    };

    return `
      <form class="form-panel" data-form="flower">
        <h3>${editing ? "编辑花卉" : "新增花卉"}</h3>
        <p>${editing ? escapeHtml(editing.id) : "创建新的商品 SKU"}</p>
        <div class="field-grid" style="margin-top: 14px;">
          <label>名称<input name="name" required value="${escapeHtml(flower.name)}" /></label>
          <label>SKU<input name="sku" required value="${escapeHtml(flower.sku)}" /></label>
          <label>分类<input name="category" required value="${escapeHtml(flower.category)}" /></label>
          <label>单价<input name="price" type="number" min="0" step="0.01" required value="${escapeHtml(flower.price)}" /></label>
          <label>供应商
            <select name="supplierId" required>
              ${state.data.suppliers.map((supplier) => `
                <option value="${supplier.id}" ${supplier.id === flower.supplierId ? "selected" : ""}>${escapeHtml(supplier.name)}</option>
              `).join("")}
            </select>
          </label>
          <label>单位<input name="unit" required value="${escapeHtml(flower.unit)}" /></label>
          <label>库存<input name="stock" type="number" min="0" step="1" required value="${escapeHtml(flower.stock)}" /></label>
          <label>警戒阈值<input name="threshold" type="number" min="0" step="1" required value="${escapeHtml(flower.threshold)}" /></label>
          <label>状态
            <select name="status">
              <option value="上架" ${flower.status === "上架" ? "selected" : ""}>上架</option>
              <option value="下架" ${flower.status === "下架" ? "selected" : ""}>下架</option>
            </select>
          </label>
          <label>色卡
            <select name="theme">
              ${["theme-rose", "theme-sun", "theme-orchid", "theme-lily", "theme-blue"].map((theme) => `
                <option value="${theme}" ${theme === flower.theme ? "selected" : ""}>${theme.replace("theme-", "")}</option>
              `).join("")}
            </select>
          </label>
          <label class="field-full">描述<textarea name="description">${escapeHtml(flower.description)}</textarea></label>
        </div>
        <div class="button-row">
          ${editing ? `<button class="ghost-button" type="button" data-action="cancel-flower-edit">取消</button>` : ""}
          <button class="primary-button" type="submit">${editing ? "保存修改" : "添加花卉"}</button>
        </div>
      </form>
    `;
  }

  function renderFlowerTable(flowers) {
    if (!flowers.length) {
      return emptyState("没有匹配的花卉");
    }
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>花卉</th>
              <th>SKU</th>
              <th>价格</th>
              <th>库存</th>
              <th>供应商</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${flowers.map((flower) => {
              const stock = stockStatus(flower);
              return `
                <tr>
                  <td><strong>${escapeHtml(flower.name)}</strong><br><span class="muted">${escapeHtml(flower.category)}</span></td>
                  <td>${escapeHtml(flower.sku)}</td>
                  <td class="money">${currency(flower.price)}</td>
                  <td><span class="stock-pill ${stock.className}">${flower.stock}${escapeHtml(flower.unit)} · ${stock.label}</span></td>
                  <td>${escapeHtml(supplierName(flower.supplierId))}</td>
                  <td>${escapeHtml(flower.status)}</td>
                  <td>
                    <div class="row-actions">
                      <button class="small-button" type="button" data-action="edit-flower" data-id="${flower.id}">编辑</button>
                      <button class="small-button danger" type="button" data-action="delete-flower" data-id="${flower.id}">删除</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderOrders() {
    const status = state.filters.orderStatus;
    const orders = state.data.orders
      .filter((order) => status === "all" || order.status === status)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return `
      ${viewHeader("订单管理", "跟踪创建、付款、发货和交付")}
      <section class="panel">
        <div class="toolbar">
          <div class="toolbar-group">
            <label>
              订单状态
              <select data-filter="orderStatus">
                <option value="all" ${status === "all" ? "selected" : ""}>全部</option>
                ${Object.entries(statusMap).map(([key, meta]) => `
                  <option value="${key}" ${status === key ? "selected" : ""}>${meta.label}</option>
                `).join("")}
              </select>
            </label>
          </div>
          <span class="muted">${orders.length} 条订单</span>
        </div>
        ${orders.length ? renderOrderTable(orders, false) : emptyState("暂无订单")}
      </section>
    `;
  }

  function renderOrderTable(orders, compact) {
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>订单号</th>
              <th>客户</th>
              <th>商品</th>
              <th>金额</th>
              <th>状态</th>
              <th>时间</th>
              ${compact ? "" : "<th>操作</th>"}
            </tr>
          </thead>
          <tbody>
            ${orders.map((order) => {
              const meta = statusMap[order.status];
              return `
                <tr>
                  <td><strong>${escapeHtml(order.id)}</strong></td>
                  <td>${escapeHtml(order.customerName)}</td>
                  <td>${order.items.map((item) => `${escapeHtml(item.name)} × ${item.quantity}`).join("<br>")}</td>
                  <td class="money">${currency(order.total)}</td>
                  <td><span class="status-pill ${meta.className}">${meta.label}</span></td>
                  <td>${formatDate(order.createdAt, true)}</td>
                  ${compact ? "" : `<td>${renderOrderActions(order)}</td>`}
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderOrderActions(order) {
    const meta = statusMap[order.status];
    if (order.status === "delivered" || order.status === "cancelled") {
      return `<span class="muted">已结束</span>`;
    }
    return `
      <div class="row-actions">
        ${meta.next ? `<button class="small-button primary" type="button" data-action="advance-order" data-id="${order.id}" data-next="${meta.next}">${meta.nextLabel}</button>` : ""}
        ${["created", "paid"].includes(order.status) ? `<button class="small-button danger" type="button" data-action="cancel-order" data-id="${order.id}">取消</button>` : ""}
      </div>
    `;
  }

  function renderInventory() {
    const logs = [...state.data.inventoryLogs]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);

    return `
      ${viewHeader("库存管理", "补货、报废与警戒阈值")}
      <section class="grid two">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>库存台账</h3>
              <p>库存变化会写入流水</p>
            </div>
          </div>
          ${renderInventoryTable()}
        </div>
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>库存流水</h3>
              <p>最近 8 条记录</p>
            </div>
          </div>
          ${logs.length ? `
            <div class="history-list">
              ${logs.map((log) => `
                <div class="history-item">
                  <strong>${escapeHtml(log.type)} · ${escapeHtml(log.flowerName)} · ${log.quantity}</strong>
                  <p>${escapeHtml(log.note)} · ${formatDate(log.date, true)}</p>
                </div>
              `).join("")}
            </div>
          ` : emptyState("暂无库存流水")}
        </div>
      </section>
    `;
  }

  function renderInventoryTable() {
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>花卉</th>
              <th>库存</th>
              <th>阈值</th>
              <th>供应商</th>
              <th>补货</th>
              <th>报废</th>
            </tr>
          </thead>
          <tbody>
            ${state.data.flowers.map((flower) => {
              const stock = stockStatus(flower);
              return `
                <tr data-row-id="${flower.id}">
                  <td><strong>${escapeHtml(flower.name)}</strong><br><span class="muted">${escapeHtml(flower.sku)}</span></td>
                  <td><span class="stock-pill ${stock.className}">${flower.stock}${escapeHtml(flower.unit)} · ${stock.label}</span></td>
                  <td><input class="compact-number" type="number" min="0" value="${flower.threshold}" data-action="threshold-change" data-id="${flower.id}" /></td>
                  <td>${escapeHtml(supplierName(flower.supplierId))}</td>
                  <td>
                    <div class="row-actions">
                      <input class="compact-number" type="number" min="1" value="10" data-inventory-qty="${flower.id}" />
                      <button class="small-button primary" type="button" data-action="restock" data-id="${flower.id}">入库</button>
                    </div>
                  </td>
                  <td>
                    <div class="row-actions">
                      <input class="compact-number" type="number" min="1" value="1" data-scrap-qty="${flower.id}" />
                      <button class="small-button warning" type="button" data-action="scrap" data-id="${flower.id}">报废</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderCustomers() {
    return `
      ${viewHeader("客户管理", "客户资料、购买历史和偏好")}
      <section class="grid two">
        ${renderCustomerForm()}
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>客户档案</h3>
              <p>${state.data.customers.length} 位客户</p>
            </div>
          </div>
          ${renderCustomerTable()}
        </div>
      </section>
    `;
  }

  function renderCustomerForm() {
    const editing = state.data.customers.find((customer) => customer.id === state.editing.customerId);
    const customer = editing || {
      name: "",
      phone: "",
      email: "",
      address: "",
      preference: "",
      level: "普通",
      notes: "",
      joinedAt: new Date().toISOString().slice(0, 10)
    };

    return `
      <form class="form-panel" data-form="customer">
        <h3>${editing ? "编辑客户" : "新增客户"}</h3>
        <p>${editing ? escapeHtml(editing.id) : "记录联系方式与偏好"}</p>
        <div class="field-grid" style="margin-top: 14px;">
          <label>姓名<input name="name" required value="${escapeHtml(customer.name)}" /></label>
          <label>电话<input name="phone" required value="${escapeHtml(customer.phone)}" /></label>
          <label>邮箱<input name="email" type="email" value="${escapeHtml(customer.email)}" /></label>
          <label>会员等级
            <select name="level">
              ${["普通", "银卡", "VIP"].map((level) => `
                <option value="${level}" ${customer.level === level ? "selected" : ""}>${level}</option>
              `).join("")}
            </select>
          </label>
          <label class="field-full">地址<input name="address" value="${escapeHtml(customer.address)}" /></label>
          <label class="field-full">偏好<input name="preference" value="${escapeHtml(customer.preference)}" /></label>
          <label class="field-full">备注<textarea name="notes">${escapeHtml(customer.notes)}</textarea></label>
        </div>
        <div class="button-row">
          ${editing ? `<button class="ghost-button" type="button" data-action="cancel-customer-edit">取消</button>` : ""}
          <button class="primary-button" type="submit">${editing ? "保存修改" : "添加客户"}</button>
        </div>
      </form>
    `;
  }

  function renderCustomerTable() {
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>客户</th>
              <th>联系方式</th>
              <th>偏好</th>
              <th>购买历史</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${state.data.customers.map((customer) => {
              const orders = state.data.orders.filter((order) => order.customerId === customer.id && order.status !== "cancelled");
              const total = orders.reduce((sum, order) => sum + order.total, 0);
              return `
                <tr>
                  <td><strong>${escapeHtml(customer.name)}</strong><br><span class="level-pill">${escapeHtml(customer.level)}</span></td>
                  <td>${escapeHtml(customer.phone)}<br><span class="muted">${escapeHtml(customer.email)}</span></td>
                  <td>${escapeHtml(customer.preference || "-")}</td>
                  <td>${orders.length} 单<br><span class="money">${currency(total)}</span></td>
                  <td>
                    <div class="row-actions">
                      <button class="small-button" type="button" data-action="edit-customer" data-id="${customer.id}">编辑</button>
                      <button class="small-button danger" type="button" data-action="delete-customer" data-id="${customer.id}">删除</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderStatistics() {
    const period = state.filters.statsPeriod;
    const deliveredOrders = state.data.orders.filter((order) => order.status === "delivered");
    const groups = groupSales(deliveredOrders, period);
    const totalSales = deliveredOrders.reduce((sum, order) => sum + order.total, 0);
    const bestSellers = getBestSellers(deliveredOrders);

    return `
      ${viewHeader("销售统计", "销售额、订单量和畅销花卉")}
      <section class="grid three">
        ${statCard("累计销售额", currency(totalSales), "已交付订单")}
        ${statCard("成交订单", deliveredOrders.length, "已交付订单数")}
        ${statCard("畅销花卉", bestSellers[0]?.name || "-", bestSellers[0] ? `${bestSellers[0].quantity} 件` : "暂无数据")}
      </section>

      <section class="grid two" style="margin-top: 16px;">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>${periodNames[period]}销售额</h3>
              <p>按交付时间统计</p>
            </div>
            <label>
              周期
              <select data-filter="statsPeriod">
                ${Object.keys(periodNames).map((key) => `
                  <option value="${key}" ${period === key ? "selected" : ""}>${periodNames[key]}</option>
                `).join("")}
              </select>
            </label>
          </div>
          ${groups.length ? renderBarChart(groups) : emptyState("暂无已交付订单")}
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>畅销花卉</h3>
              <p>按销量排序</p>
            </div>
          </div>
          ${bestSellers.length ? `
            <div class="table-wrap">
              <table>
                <thead><tr><th>花卉</th><th>销量</th><th>销售额</th></tr></thead>
                <tbody>
                  ${bestSellers.map((item) => `
                    <tr>
                      <td><strong>${escapeHtml(item.name)}</strong></td>
                      <td>${item.quantity}</td>
                      <td class="money">${currency(item.sales)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : emptyState("暂无畅销数据")}
        </div>
      </section>
    `;
  }

  function groupSales(orders, period) {
    const groups = new Map();
    orders.forEach((order) => {
      const date = new Date(order.deliveredAt || order.createdAt);
      let key = String(date.getFullYear());
      if (period === "month") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }
      if (period === "quarter") {
        key = `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`;
      }
      const current = groups.get(key) || { label: key, revenue: 0, orders: 0 };
      current.revenue += order.total;
      current.orders += 1;
      groups.set(key, current);
    });
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
  }

  function getBestSellers(orders) {
    const map = new Map();
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const current = map.get(item.name) || { name: item.name, quantity: 0, sales: 0 };
        current.quantity += item.quantity;
        current.sales += item.price * item.quantity;
        map.set(item.name, current);
      });
    });
    return [...map.values()].sort((a, b) => b.quantity - a.quantity);
  }

  function renderBarChart(groups) {
    const max = Math.max(...groups.map((item) => item.revenue), 1);
    return `
      <div class="bar-chart">
        ${groups.map((item) => `
          <div class="bar-item">
            <div class="bar" style="height: ${Math.max(8, Math.round((item.revenue / max) * 210))}px"></div>
            <div class="bar-value">${currency(item.revenue)}</div>
            <div class="bar-label">${escapeHtml(item.label)} · ${item.orders} 单</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderSuppliers() {
    return `
      ${viewHeader("供应商管理", "联系方式、合作协议和付款记录")}
      <section class="grid two">
        ${renderSupplierForm()}
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>供应商档案</h3>
              <p>${state.data.suppliers.length} 家供应商</p>
            </div>
          </div>
          ${renderSupplierTable()}
        </div>
      </section>
    `;
  }

  function renderSupplierForm() {
    const editing = state.data.suppliers.find((supplier) => supplier.id === state.editing.supplierId);
    const supplier = editing || {
      name: "",
      contact: "",
      phone: "",
      email: "",
      agreement: ""
    };

    return `
      <form class="form-panel" data-form="supplier">
        <h3>${editing ? "编辑供应商" : "新增供应商"}</h3>
        <p>${editing ? escapeHtml(editing.id) : "维护合作信息"}</p>
        <div class="field-grid" style="margin-top: 14px;">
          <label>供应商名称<input name="name" required value="${escapeHtml(supplier.name)}" /></label>
          <label>联系人<input name="contact" required value="${escapeHtml(supplier.contact)}" /></label>
          <label>电话<input name="phone" required value="${escapeHtml(supplier.phone)}" /></label>
          <label>邮箱<input name="email" type="email" value="${escapeHtml(supplier.email)}" /></label>
          <label class="field-full">合作协议<textarea name="agreement">${escapeHtml(supplier.agreement)}</textarea></label>
        </div>
        <div class="button-row">
          ${editing ? `<button class="ghost-button" type="button" data-action="cancel-supplier-edit">取消</button>` : ""}
          <button class="primary-button" type="submit">${editing ? "保存修改" : "添加供应商"}</button>
        </div>
      </form>
    `;
  }

  function renderSupplierTable() {
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>供应商</th>
              <th>联系方式</th>
              <th>合作协议</th>
              <th>付款记录</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${state.data.suppliers.map((supplier) => {
              const flowers = state.data.flowers.filter((flower) => flower.supplierId === supplier.id).length;
              const payments = supplier.paymentRecords || [];
              const paid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
              return `
                <tr data-row-id="${supplier.id}">
                  <td><strong>${escapeHtml(supplier.name)}</strong><br><span class="muted">关联 ${flowers} 个商品</span></td>
                  <td>${escapeHtml(supplier.contact)} · ${escapeHtml(supplier.phone)}<br><span class="muted">${escapeHtml(supplier.email)}</span></td>
                  <td>${escapeHtml(supplier.agreement || "-")}</td>
                  <td>
                    <span class="money">${currency(paid)}</span><br>
                    <div class="row-actions" style="margin-top: 8px;">
                      <input class="compact-number" type="number" min="0" step="0.01" value="1000" data-payment-amount="${supplier.id}" />
                      <button class="small-button primary" type="button" data-action="record-payment" data-id="${supplier.id}">登记</button>
                    </div>
                  </td>
                  <td>
                    <div class="row-actions">
                      <button class="small-button" type="button" data-action="edit-supplier" data-id="${supplier.id}">编辑</button>
                      <button class="small-button danger" type="button" data-action="delete-supplier" data-id="${supplier.id}">删除</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function emptyState(text) {
    return `<div class="empty-state">${escapeHtml(text)}</div>`;
  }

  function getFormData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function handleClick(event) {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      setView(viewButton.dataset.view);
      return;
    }

    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const id = button.dataset.id;

    const actions = {
      "reset-demo": resetDemo,
      "read-notice": () => readNotice(id),
      "read-all-notices": readAllNotices,
      "add-to-cart": () => addToCart(id),
      "remove-cart-item": () => removeCartItem(id),
      "clear-cart": clearCart,
      "place-order": placeOrder,
      "edit-flower": () => startEdit("flowerId", id),
      "delete-flower": () => deleteFlower(id),
      "cancel-flower-edit": () => cancelEdit("flowerId"),
      "advance-order": () => advanceOrder(id, button.dataset.next),
      "cancel-order": () => cancelOrder(id),
      restock: () => adjustInventory(id, "restock"),
      scrap: () => adjustInventory(id, "scrap"),
      "edit-customer": () => startEdit("customerId", id),
      "delete-customer": () => deleteCustomer(id),
      "cancel-customer-edit": () => cancelEdit("customerId"),
      "edit-supplier": () => startEdit("supplierId", id),
      "delete-supplier": () => deleteSupplier(id),
      "cancel-supplier-edit": () => cancelEdit("supplierId"),
      "record-payment": () => recordPayment(id)
    };

    actions[action]?.();
  }

  function handleInput(event) {
    const target = event.target;
    if (target.dataset.filter) {
      state.filters[target.dataset.filter] = target.value;
    }
  }

  function handleChange(event) {
    const target = event.target;
    if (target.dataset.filter) {
      state.filters[target.dataset.filter] = target.value;
      render();
      return;
    }
    if (target.dataset.action === "cart-quantity") {
      updateCartQuantity(target.dataset.id, Number(target.value));
      return;
    }
    if (target.dataset.action === "threshold-change") {
      const flower = state.data.flowers.find((item) => item.id === target.dataset.id);
      if (flower) {
        flower.threshold = Math.max(0, Number(target.value || 0));
        syncInventoryAlerts();
        saveData();
        render();
      }
    }
  }

  function handleSubmit(event) {
    const form = event.target.closest("[data-form]");
    if (!form) {
      return;
    }
    event.preventDefault();

    const formType = form.dataset.form;
    if (formType === "flower") {
      saveFlower(form);
    }
    if (formType === "customer") {
      saveCustomer(form);
    }
    if (formType === "supplier") {
      saveSupplier(form);
    }
  }

  function resetDemo() {
    if (!window.confirm("确认恢复初始演示数据？当前浏览器中的本地数据会被覆盖。")) {
      return;
    }
    state.data = seedData();
    state.cart = [];
    state.editing = { flowerId: null, customerId: null, supplierId: null };
    saveData();
    showToast("演示数据已重置");
    render();
  }

  function readNotice(id) {
    const notice = state.data.notifications.find((item) => item.id === id);
    if (notice) {
      notice.read = true;
      saveData();
      render();
    }
  }

  function readAllNotices() {
    state.data.notifications.forEach((notice) => {
      notice.read = true;
    });
    saveData();
    render();
  }

  function addToCart(id) {
    const flower = state.data.flowers.find((item) => item.id === id);
    if (!flower || flower.stock <= 0) {
      showToast("当前花卉库存不足", "error");
      return;
    }
    const item = state.cart.find((cartItem) => cartItem.flowerId === id);
    if (item) {
      if (item.quantity >= flower.stock) {
        showToast("购物车数量不能超过库存", "error");
        return;
      }
      item.quantity += 1;
    } else {
      state.cart.push({
        flowerId: flower.id,
        name: flower.name,
        price: flower.price,
        quantity: 1,
        stock: flower.stock,
        unit: flower.unit
      });
    }
    showToast("已加入购物车");
    render();
  }

  function updateCartQuantity(id, quantity) {
    const item = state.cart.find((cartItem) => cartItem.flowerId === id);
    const flower = state.data.flowers.find((entry) => entry.id === id);
    if (!item || !flower) {
      return;
    }
    item.quantity = Math.min(Math.max(1, quantity || 1), flower.stock);
    render();
  }

  function removeCartItem(id) {
    state.cart = state.cart.filter((item) => item.flowerId !== id);
    render();
  }

  function clearCart() {
    state.cart = [];
    render();
  }

  function placeOrder() {
    if (!state.cart.length) {
      showToast("购物车为空", "error");
      return;
    }

    const customerId = state.filters.shopCustomerId || state.data.customers[0]?.id;
    const customer = state.data.customers.find((item) => item.id === customerId);
    if (!customer) {
      showToast("请先选择客户", "error");
      return;
    }

    for (const cartItem of state.cart) {
      const flower = state.data.flowers.find((item) => item.id === cartItem.flowerId);
      if (!flower || flower.stock < cartItem.quantity) {
        showToast(`${cartItem.name} 库存不足`, "error");
        return;
      }
    }

    const orderId = nextOrderId();
    const orderItems = state.cart.map((cartItem) => ({
      flowerId: cartItem.flowerId,
      name: cartItem.name,
      price: cartItem.price,
      quantity: cartItem.quantity
    }));
    const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    state.data.orders.unshift({
      id: orderId,
      customerId: customer.id,
      customerName: customer.name,
      items: orderItems,
      total,
      status: "created",
      createdAt: nowIso(),
      paidAt: "",
      shippedAt: "",
      deliveredAt: ""
    });

    orderItems.forEach((orderItem) => {
      const flower = state.data.flowers.find((item) => item.id === orderItem.flowerId);
      flower.stock -= orderItem.quantity;
      state.data.inventoryLogs.unshift({
        id: nextId("LOG", state.data.inventoryLogs),
        flowerId: flower.id,
        flowerName: flower.name,
        type: "销售扣减",
        quantity: orderItem.quantity,
        note: `订单 ${orderId}`,
        date: nowIso()
      });
    });

    addNotification("订单通知", "新订单待处理", `${customer.name} 提交了订单 ${orderId}，总金额 ${currency(total)}。`, orderId);
    syncInventoryAlerts();
    state.cart = [];
    saveData();
    showToast(`订单 ${orderId} 已生成`);
    setView("orders");
  }

  function startEdit(key, id) {
    state.editing[key] = id;
    render();
  }

  function cancelEdit(key) {
    state.editing[key] = null;
    render();
  }

  function saveFlower(form) {
    const values = getFormData(form);
    const payload = {
      name: values.name.trim(),
      sku: values.sku.trim(),
      category: values.category.trim(),
      price: Number(values.price || 0),
      supplierId: values.supplierId,
      stock: Math.max(0, Number(values.stock || 0)),
      threshold: Math.max(0, Number(values.threshold || 0)),
      unit: values.unit.trim(),
      status: values.status,
      theme: values.theme,
      description: values.description.trim()
    };

    if (state.editing.flowerId) {
      const index = state.data.flowers.findIndex((flower) => flower.id === state.editing.flowerId);
      state.data.flowers[index] = { ...state.data.flowers[index], ...payload };
      state.editing.flowerId = null;
      showToast("花卉信息已更新");
    } else {
      state.data.flowers.unshift({ id: nextId("FL", state.data.flowers), ...payload });
      showToast("花卉已添加");
    }

    syncInventoryAlerts();
    saveData();
    render();
  }

  function deleteFlower(id) {
    if (!window.confirm("确认删除该花卉？历史订单仍会保留商品快照。")) {
      return;
    }
    state.data.flowers = state.data.flowers.filter((flower) => flower.id !== id);
    state.cart = state.cart.filter((item) => item.flowerId !== id);
    saveData();
    showToast("花卉已删除");
    render();
  }

  function advanceOrder(id, nextStatus) {
    const order = state.data.orders.find((item) => item.id === id);
    if (!order || !nextStatus) {
      return;
    }
    order.status = nextStatus;
    if (nextStatus === "paid") {
      order.paidAt = nowIso();
    }
    if (nextStatus === "shipped") {
      order.shippedAt = nowIso();
    }
    if (nextStatus === "delivered") {
      order.deliveredAt = nowIso();
    }
    addNotification("订单通知", "订单状态已更新", `${order.id} 已更新为${statusMap[nextStatus].label}。`, order.id);
    saveData();
    showToast("订单状态已更新");
    render();
  }

  function cancelOrder(id) {
    const order = state.data.orders.find((item) => item.id === id);
    if (!order || !["created", "paid"].includes(order.status)) {
      return;
    }
    if (!window.confirm("确认取消订单并回补库存？")) {
      return;
    }
    order.status = "cancelled";
    order.cancelledAt = nowIso();
    order.items.forEach((item) => {
      const flower = state.data.flowers.find((entry) => entry.id === item.flowerId);
      if (flower) {
        flower.stock += item.quantity;
        state.data.inventoryLogs.unshift({
          id: nextId("LOG", state.data.inventoryLogs),
          flowerId: flower.id,
          flowerName: flower.name,
          type: "订单取消回补",
          quantity: item.quantity,
          note: `订单 ${order.id}`,
          date: nowIso()
        });
      }
    });
    saveData();
    showToast("订单已取消，库存已回补");
    render();
  }

  function adjustInventory(id, type) {
    const flower = state.data.flowers.find((item) => item.id === id);
    if (!flower) {
      return;
    }
    const input = document.querySelector(type === "restock" ? `[data-inventory-qty="${id}"]` : `[data-scrap-qty="${id}"]`);
    const quantity = Math.max(1, Number(input?.value || 1));
    if (type === "scrap" && quantity > flower.stock) {
      showToast("报废数量不能超过当前库存", "error");
      return;
    }
    flower.stock += type === "restock" ? quantity : -quantity;
    state.data.inventoryLogs.unshift({
      id: nextId("LOG", state.data.inventoryLogs),
      flowerId: flower.id,
      flowerName: flower.name,
      type: type === "restock" ? "补货" : "报废",
      quantity,
      note: type === "restock" ? `联系 ${supplierName(flower.supplierId)} 补货入库` : "花材损耗报废",
      date: nowIso()
    });
    syncInventoryAlerts();
    saveData();
    showToast(type === "restock" ? "补货已入库" : "报废已登记");
    render();
  }

  function saveCustomer(form) {
    const values = getFormData(form);
    const payload = {
      name: values.name.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      address: values.address.trim(),
      preference: values.preference.trim(),
      level: values.level,
      notes: values.notes.trim()
    };

    if (state.editing.customerId) {
      const index = state.data.customers.findIndex((customer) => customer.id === state.editing.customerId);
      const current = state.data.customers[index];
      state.data.customers[index] = { ...current, ...payload };
      state.data.orders.forEach((order) => {
        if (order.customerId === current.id) {
          order.customerName = payload.name;
        }
      });
      state.editing.customerId = null;
      showToast("客户信息已更新");
    } else {
      state.data.customers.unshift({
        id: nextId("CUS", state.data.customers),
        joinedAt: new Date().toISOString().slice(0, 10),
        ...payload
      });
      showToast("客户已添加");
    }

    saveData();
    render();
  }

  function deleteCustomer(id) {
    const hasOrders = state.data.orders.some((order) => order.customerId === id);
    if (hasOrders) {
      showToast("该客户存在订单，不能删除", "error");
      return;
    }
    if (!window.confirm("确认删除该客户？")) {
      return;
    }
    state.data.customers = state.data.customers.filter((customer) => customer.id !== id);
    if (state.filters.shopCustomerId === id) {
      state.filters.shopCustomerId = state.data.customers[0]?.id || "";
    }
    saveData();
    render();
  }

  function saveSupplier(form) {
    const values = getFormData(form);
    const payload = {
      name: values.name.trim(),
      contact: values.contact.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      agreement: values.agreement.trim()
    };

    if (state.editing.supplierId) {
      const index = state.data.suppliers.findIndex((supplier) => supplier.id === state.editing.supplierId);
      state.data.suppliers[index] = { ...state.data.suppliers[index], ...payload };
      state.editing.supplierId = null;
      showToast("供应商信息已更新");
    } else {
      state.data.suppliers.unshift({
        id: nextId("SUP", state.data.suppliers),
        paymentRecords: [],
        ...payload
      });
      showToast("供应商已添加");
    }

    saveData();
    render();
  }

  function deleteSupplier(id) {
    const hasFlowers = state.data.flowers.some((flower) => flower.supplierId === id);
    if (hasFlowers) {
      showToast("该供应商仍有关联花卉，不能删除", "error");
      return;
    }
    if (!window.confirm("确认删除该供应商？")) {
      return;
    }
    state.data.suppliers = state.data.suppliers.filter((supplier) => supplier.id !== id);
    saveData();
    render();
  }

  function recordPayment(id) {
    const supplier = state.data.suppliers.find((item) => item.id === id);
    const input = document.querySelector(`[data-payment-amount="${id}"]`);
    const amount = Number(input?.value || 0);
    if (!supplier || amount <= 0) {
      showToast("请输入有效付款金额", "error");
      return;
    }
    supplier.paymentRecords = supplier.paymentRecords || [];
    supplier.paymentRecords.unshift({
      date: new Date().toISOString().slice(0, 10),
      amount,
      status: "已付款"
    });
    saveData();
    showToast("付款记录已登记");
    render();
  }

  document.body.addEventListener("click", handleClick);
  document.body.addEventListener("input", handleInput);
  document.body.addEventListener("change", handleChange);
  document.body.addEventListener("submit", handleSubmit);

  render();
  loadServerData();
})();
