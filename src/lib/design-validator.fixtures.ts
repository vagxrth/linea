// Designs for the validator's tests, in the shape gemini-2.5-flash writes them for the eval's fixtures
// (scripts/eval-fixtures.ts): the <style> block the instructions ask for, with the contract's values,
// then the page. Each failing one carries what the live eval on ed09207 reported: white-on-white status
// text (1.00:1), banned words, made-up names, a chart placeholder, a hero image that collapses, a
// duplicate column and an off-contract color on refine. They're rebuilt from that report, since the
// run's own output files weren't kept.

// The dense dashboard's contract (buildDesignContract on its guide), as the model writes it
export const DASHBOARD_STYLE = `<style>
[data-generated-ui] { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
[data-generated-ui] .c-bg { background-color: #F8FAFC; }
[data-generated-ui] .c-fg { color: #0F172A; }
[data-generated-ui] .c-card-bg { background-color: #FFFFFF; }
[data-generated-ui] .c-card-fg { color: #0F172A; }
[data-generated-ui] .c-popover-bg { background-color: #FFFFFF; }
[data-generated-ui] .c-popover-fg { color: #0F172A; }
[data-generated-ui] .c-primary-bg { background-color: #0F766E; }
[data-generated-ui] .c-primary-fg { color: #FFFFFF; }
[data-generated-ui] .c-secondary-bg { background-color: #E2E8F0; }
[data-generated-ui] .c-secondary-fg { color: #0F172A; }
[data-generated-ui] .c-muted-bg { background-color: #F1F5F9; }
[data-generated-ui] .c-muted-fg { color: #677180; }
[data-generated-ui] .c-accent-bg { background-color: #5EEAD4; }
[data-generated-ui] .c-accent-fg { color: #5C5C5C; }
[data-generated-ui] .c-destructive-bg { background-color: #DC2626; }
[data-generated-ui] .c-destructive-fg { color: #FFFFFF; }
[data-generated-ui] .c-border { border-color: #E2E8F0; }
[data-generated-ui] .c-input-bg { background-color: #E2E8F0; }
[data-generated-ui] .c-ring { outline-color: #0F766E; --tw-ring-color: #0F766E; }
[data-generated-ui] .t-h1 { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; font-size: 1.75rem; font-weight: 600; line-height: 1.25; letter-spacing: -0.01em; }
[data-generated-ui] .t-h2 { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; font-size: 1.25rem; font-weight: 600; line-height: 1.3; letter-spacing: normal; }
[data-generated-ui] .t-h3 { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; font-size: 1rem; font-weight: 600; line-height: 1.4; letter-spacing: normal; }
[data-generated-ui] .t-body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; font-size: 0.9375rem; font-weight: 400; line-height: 1.5; letter-spacing: normal; }
[data-generated-ui] .t-small { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; font-size: 0.8125rem; font-weight: 400; line-height: 1.4; letter-spacing: normal; }
[data-generated-ui] .t-button { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; font-size: 0.875rem; font-weight: 500; line-height: 1.2; letter-spacing: normal; }
[data-generated-ui] .t-label { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; font-size: 0.75rem; font-weight: 500; line-height: 1.3; letter-spacing: 0.02em; }
@media (max-width: 640px) { [data-generated-ui] .t-h1 { font-size: 1.3125rem; } }
</style>`

const dashboardShell = (main: string) => `<div data-generated-ui>
${DASHBOARD_STYLE}
<div class="c-bg c-fg flex min-h-full">
  <aside id="sidebar-nav" class="c-card-bg c-card-fg border-r c-border w-56 p-4 flex flex-col gap-1">
    <span class="t-h3 px-3 py-2">Tallyboard</span>
    <a href="#" class="t-body px-3 py-2 rounded-lg c-secondary-bg c-secondary-fg" data-node="nav-a">Overview</a>
    <a href="#" class="t-body px-3 py-2 rounded-lg" data-node="nav-b">Orders</a>
    <a href="#" class="t-body px-3 py-2 rounded-lg" data-node="nav-c">Customers</a>
    <a href="#" class="t-body px-3 py-2 rounded-lg" data-node="nav-d">Reports</a>
    <a href="#" class="t-body px-3 py-2 rounded-lg" data-node="nav-e">Settings</a>
  </aside>
  <main id="dashboard-main" class="flex-1 p-4 md:p-6 flex flex-col gap-4">
    <header id="top-bar" class="flex items-center justify-between gap-3" data-node="head01">
      <label for="order-search" class="sr-only">Search orders</label>
      <input id="order-search" type="search" placeholder="Search orders" class="c-input-bg c-fg t-body h-10 rounded-lg px-3 w-80">
      <div class="h-8 w-8 rounded-full c-primary-bg c-primary-fg t-label flex items-center justify-center">TB</div>
    </header>
    <section id="key-figures" class="grid grid-cols-4 gap-3 md:gap-4">
      <article class="c-card-bg c-card-fg rounded-xl p-4 border c-border" data-node="kpi001"><p class="t-label c-muted-fg">Orders this week</p><p class="t-h2">128</p></article>
      <article class="c-card-bg c-card-fg rounded-xl p-4 border c-border" data-node="kpi002"><p class="t-label c-muted-fg">Revenue</p><p class="t-h2">$4,210</p></article>
      <article class="c-card-bg c-card-fg rounded-xl p-4 border c-border" data-node="kpi003"><p class="t-label c-muted-fg">Refunds</p><p class="t-h2">3</p></article>
      <article class="c-card-bg c-card-fg rounded-xl p-4 border c-border" data-node="kpi004"><p class="t-label c-muted-fg">Open tickets</p><p class="t-h2">7</p></article>
    </section>
${main}
  </main>
</div>
</div>`

// The initial dashboard with what the eval found: status pills in white text on the white table
// (c-primary-fg without c-primary-bg, 1.00:1), made-up customers, and a box where the chart should be
export const DASHBOARD_FAILING = dashboardShell(`    <section id="revenue-chart" class="c-card-bg c-card-fg rounded-xl p-4 border c-border h-64 flex items-center justify-center" data-node="chrt01">
      <p class="t-body c-muted-fg">Chart placeholder</p>
    </section>
    <section id="recent-orders" class="c-card-bg c-card-fg rounded-xl border c-border" data-node="tabl01">
      <table id="orders-table" class="w-full text-left">
        <thead><tr><th class="t-label c-muted-fg px-3 py-2">Order</th><th class="t-label c-muted-fg px-3 py-2">Customer</th><th class="t-label c-muted-fg px-3 py-2">Date</th><th class="t-label c-muted-fg px-3 py-2">Status</th><th class="t-label c-muted-fg px-3 py-2">Total</th></tr></thead>
        <tbody>
          <tr><td class="t-body px-3 py-2">#1042</td><td class="t-body px-3 py-2">Alice Smith</td><td class="t-body px-3 py-2">Nov 3</td><td class="px-3 py-2"><span class="inline-flex rounded-full px-2 py-0.5 t-label c-primary-fg">Completed</span></td><td class="t-body px-3 py-2">$84.00</td></tr>
          <tr><td class="t-body px-3 py-2">#1041</td><td class="t-body px-3 py-2">Bob Johnson</td><td class="t-body px-3 py-2">Nov 3</td><td class="px-3 py-2"><span class="inline-flex rounded-full px-2 py-0.5 t-label c-primary-fg">Completed</span></td><td class="t-body px-3 py-2">$32.50</td></tr>
          <tr><td class="t-body px-3 py-2">#1040</td><td class="t-body px-3 py-2">Carol Davis</td><td class="t-body px-3 py-2">Nov 2</td><td class="px-3 py-2"><span class="inline-flex rounded-full px-2 py-0.5 t-label c-primary-fg">Completed</span></td><td class="t-body px-3 py-2">$120.00</td></tr>
        </tbody>
      </table>
    </section>`)

// The refine round ("Make the table rows more compact and add a status column") as the eval saw it:
// a second Status column, painted in a green the contract doesn't have
export const DASHBOARD_REFINE_FAILING = dashboardShell(`    <section id="revenue-chart" class="c-card-bg c-card-fg rounded-xl p-4 border c-border h-64 flex items-center justify-center" data-node="chrt01">
      <p class="t-body c-muted-fg">Chart placeholder</p>
    </section>
    <style>[data-generated-ui] .status-paid { background-color: #DCFCE7; color: #166534; }</style>
    <section id="recent-orders" class="c-card-bg c-card-fg rounded-xl border c-border" data-node="tabl01">
      <table id="orders-table" class="w-full text-left">
        <thead><tr><th class="t-label c-muted-fg px-3 py-1">Order</th><th class="t-label c-muted-fg px-3 py-1">Customer</th><th class="t-label c-muted-fg px-3 py-1">Date</th><th class="t-label c-muted-fg px-3 py-1">Status</th><th class="t-label c-muted-fg px-3 py-1">Total</th><th class="t-label c-muted-fg px-3 py-1">Status</th></tr></thead>
        <tbody>
          <tr><td class="t-body px-3 py-1">#1042</td><td class="t-body px-3 py-1">Alice Smith</td><td class="t-body px-3 py-1">Nov 3</td><td class="px-3 py-1"><span class="inline-flex rounded-full px-2 py-0.5 t-label c-primary-fg">Completed</span></td><td class="t-body px-3 py-1">$84.00</td><td class="px-3 py-1"><span class="status-paid inline-flex rounded-full px-2 py-0.5 t-label">Paid</span></td></tr>
          <tr><td class="t-body px-3 py-1">#1041</td><td class="t-body px-3 py-1">Bob Johnson</td><td class="t-body px-3 py-1">Nov 3</td><td class="px-3 py-1"><span class="inline-flex rounded-full px-2 py-0.5 t-label c-primary-fg">Completed</span></td><td class="t-body px-3 py-1">$32.50</td><td class="px-3 py-1"><span class="status-paid inline-flex rounded-full px-2 py-0.5 t-label">Paid</span></td></tr>
          <tr><td class="t-body px-3 py-1">#1040</td><td class="t-body px-3 py-1">Carol Davis</td><td class="t-body px-3 py-1">Nov 2</td><td class="px-3 py-1"><span class="inline-flex rounded-full px-2 py-0.5 t-label c-primary-fg">Completed</span></td><td class="t-body px-3 py-1">$120.00</td><td class="px-3 py-1"><span class="status-paid inline-flex rounded-full px-2 py-0.5 t-label">Paid</span></td></tr>
        </tbody>
      </table>
    </section>`)

// The same dashboard done right: pills on their own pair, a chart drawn from divs, customers by role
export const DASHBOARD_PASSING = dashboardShell(`    <section id="revenue-chart" class="c-card-bg c-card-fg rounded-xl p-4 border c-border flex flex-col gap-3" data-node="chrt01">
      <h2 class="t-h2">Revenue by day</h2>
      <div class="flex items-end gap-3 h-40" role="img" aria-label="Revenue by day, highest on Friday">
        <div class="flex-1 flex flex-col items-center gap-1 h-full justify-end"><div class="chart-bar w-full rounded-t c-primary-bg" style="height: 45%"></div><span class="t-small c-muted-fg">Mon</span></div>
        <div class="flex-1 flex flex-col items-center gap-1 h-full justify-end"><div class="chart-bar w-full rounded-t c-primary-bg" style="height: 62%"></div><span class="t-small c-muted-fg">Tue</span></div>
        <div class="flex-1 flex flex-col items-center gap-1 h-full justify-end"><div class="chart-bar w-full rounded-t c-primary-bg" style="height: 100%"></div><span class="t-small c-muted-fg">Fri</span></div>
      </div>
    </section>
    <section id="recent-orders" class="c-card-bg c-card-fg rounded-xl border c-border" data-node="tabl01">
      <table id="orders-table" class="w-full text-left">
        <thead><tr><th class="t-label c-muted-fg px-3 py-2">Order</th><th class="t-label c-muted-fg px-3 py-2">Customer</th><th class="t-label c-muted-fg px-3 py-2">Date</th><th class="t-label c-muted-fg px-3 py-2">Status</th><th class="t-label c-muted-fg px-3 py-2">Total</th></tr></thead>
        <tbody>
          <tr><td class="t-body px-3 py-2">#1042</td><td class="t-body px-3 py-2">Retail customer</td><td class="t-body px-3 py-2">Nov 3</td><td class="px-3 py-2"><span class="inline-flex rounded-full px-2 py-0.5 t-label c-primary-bg c-primary-fg">Completed</span></td><td class="t-body px-3 py-2">$84.00</td></tr>
          <tr><td class="t-body px-3 py-2">#1041</td><td class="t-body px-3 py-2">Wholesale account</td><td class="t-body px-3 py-2">Nov 3</td><td class="px-3 py-2"><span class="inline-flex rounded-full px-2 py-0.5 t-label c-muted-bg c-muted-fg">Pending</span></td><td class="t-body px-3 py-2">$32.50</td></tr>
          <tr><td class="t-body px-3 py-2">#1040</td><td class="t-body px-3 py-2">Retail customer</td><td class="t-body px-3 py-2">Nov 2</td><td class="px-3 py-2"><span class="inline-flex rounded-full px-2 py-0.5 t-label c-destructive-bg c-destructive-fg">Refunded</span></td><td class="t-body px-3 py-2">$120.00</td></tr>
        </tbody>
      </table>
    </section>`)

// The landing page's contract, as the model writes it
const LANDING_STYLE = `<style>
[data-generated-ui] { font-family: 'Lato', ui-sans-serif, system-ui, sans-serif; }
[data-generated-ui] .c-bg { background-color: #EADED3; }
[data-generated-ui] .c-fg { color: #343036; }
[data-generated-ui] .c-card-bg { background-color: #E3D6C9; }
[data-generated-ui] .c-card-fg { color: #343036; }
[data-generated-ui] .c-primary-bg { background-color: #C58066; }
[data-generated-ui] .c-primary-fg { color: #2D292F; }
[data-generated-ui] .c-secondary-bg { background-color: #5F9873; }
[data-generated-ui] .c-secondary-fg { color: #252525; }
[data-generated-ui] .c-muted-bg { background-color: #E0D4C8; }
[data-generated-ui] .c-muted-fg { color: #615C5E; }
[data-generated-ui] .c-border { border-color: #CDBFB2; }
[data-generated-ui] .t-h1 { font-size: 3rem; font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; }
[data-generated-ui] .t-h2 { font-size: 2.25rem; font-weight: 700; line-height: 1.2; letter-spacing: -0.01em; }
[data-generated-ui] .t-h3 { font-size: 1.5rem; font-weight: 600; line-height: 1.3; letter-spacing: normal; }
[data-generated-ui] .t-body { font-size: 1.0625rem; font-weight: 400; line-height: 1.6; letter-spacing: normal; }
[data-generated-ui] .t-button { font-size: 1rem; font-weight: 600; line-height: 1.2; letter-spacing: 0.01em; }
</style>`

const leaf = `<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 19c8 0 14-6 14-14C11 5 5 11 5 19z"/></svg>`

// The landing page with what the eval found: banned words, and a hero image with nothing holding its
// size open, so it collapses when the picture doesn't load. Its feature icons are inline SVG.
export const LANDING_FAILING = `<div data-generated-ui>
${LANDING_STYLE}
<div class="c-bg c-fg">
  <nav id="main-nav" class="flex items-center justify-between px-6 py-4" data-node="nav01">
    <span class="t-h3">Veridian</span>
    <a href="#" class="t-button c-primary-bg c-primary-fg rounded-lg h-10 px-6 inline-flex items-center">Shop plants</a>
  </nav>
  <section id="hero-section" class="py-16 md:py-24 px-6 grid md:grid-cols-2 gap-8 items-center">
    <div class="flex flex-col gap-4 md:gap-6">
      <h1 class="t-h1" data-node="head01">Discover plants that thrive in any room</h1>
      <p class="t-body c-muted-fg">Explore our unique collection, curated for the perfect home.</p>
      <a href="#" class="t-button c-primary-bg c-primary-fg rounded-lg h-10 px-6 inline-flex items-center w-fit" data-node="btn001">Shop low-light plants</a>
    </div>
    <div class="relative">
      <img src="https://eval.invalid/hanging-plant.webp" data-slot="slot-1" alt="A pothos trailing from a hanging pot" class="w-full rounded-2xl object-cover" data-node="hero01">
    </div>
  </section>
  <section id="features" class="py-16 md:py-24 px-6 grid grid-cols-3 gap-6 md:gap-8">
    <article class="c-card-bg c-card-fg rounded-xl p-6 md:p-8" data-node="card01">${leaf}<h3 class="t-h3">Potted and ready</h3><p class="t-body">Every plant ships in its pot, with care notes.</p></article>
    <article class="c-card-bg c-card-fg rounded-xl p-6 md:p-8" data-node="card02">${leaf}<h3 class="t-h3">Low-light picks</h3><p class="t-body">Pothos, snake plants and ZZ plants for rooms away from the window.</p></article>
    <article class="c-card-bg c-card-fg rounded-xl p-6 md:p-8" data-node="card03">${leaf}<h3 class="t-h3">Repotting kits</h3><p class="t-body">Soil, a pot one size up and a short guide.</p></article>
  </section>
</div>
</div>`
