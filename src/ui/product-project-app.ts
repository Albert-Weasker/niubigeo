import { PRODUCT_NAME, PRODUCT_TITLE, renderNiubigeoLockup } from "./brand.js";

/**
 * Phase 1 workspace: a product project exists before any audit configuration
 * or provider work. Later phases can replace the placeholder content panels.
 */
export function renderProductProjectAppHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${PRODUCT_TITLE}</title>
  <style>
    :root { --bg:#050505; --sidebar:#080808; --panel:#111111; --panel-hover:#171717; --line:#262626; --line-strong:#383838; --text:#f5f5f5; --muted:#a1a1aa; --weak:#666; --blue:#4c8dff; --green:#20d68f; --red:#ff5c5c; --yellow:#f5b942; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    button, input, select { font:inherit; }
    button { color:inherit; cursor:pointer; }
    button:disabled { cursor:not-allowed; opacity:.56; }
    button:focus-visible, input:focus-visible, select:focus-visible { outline:2px solid var(--blue); outline-offset:2px; }
    .shell { min-height:100vh; display:grid; grid-template-columns:248px minmax(0,1fr); }
    .sidebar { background:var(--sidebar); border-right:1px solid var(--line); display:flex; flex-direction:column; padding:22px 16px; }
    .brand { display:flex; align-items:center; min-height:48px; margin:0 8px 28px; }
    .brand-lockup-image { display:block; width:min(100%,190px); height:auto; }
    .brand img { display:block; width:min(100%,190px); height:auto; }
    .project-label { color:var(--weak); font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; margin:0 8px 7px; }
    .project-select { width:100%; border:1px solid var(--line); border-radius:8px; background:var(--panel); color:var(--text); min-height:40px; padding:0 10px; }
    .nav { margin-top:24px; display:grid; gap:4px; }
    .nav-item { width:100%; min-height:42px; border:1px solid transparent; border-radius:8px; background:transparent; text-align:left; padding:0 12px; color:var(--muted); transition:transform 80ms ease, background-color 140ms ease, border-color 140ms ease, color 140ms ease; }
    .nav-item:hover, .nav-item:focus-visible { background:var(--panel); border-color:var(--line); color:var(--text); }
    .nav-item:active { transform:translateY(1px) scale(.98); }
    .nav-item.active { background:var(--panel); color:var(--text); border-color:var(--line); }
    .sidebar-bottom { margin-top:auto; padding:16px 8px 0; color:var(--weak); font-size:12px; }
    .workspace { min-width:0; padding:32px clamp(20px,4vw,64px); }
    .topbar { display:flex; justify-content:space-between; align-items:center; gap:16px; border-bottom:1px solid var(--line); padding-bottom:20px; }
    .crumb { color:var(--muted); font-size:14px; }
    .crumb strong { color:var(--text); }
    .button { min-height:38px; border-radius:8px; border:1px solid var(--line-strong); background:var(--panel); padding:0 13px; font-weight:700; transition:transform 80ms ease, background-color 140ms ease, border-color 140ms ease, color 140ms ease; }
    .button:hover, .button:focus-visible { background:var(--panel-hover); border-color:#555; }
    .button:active { transform:translateY(1px) scale(.98); }
    .button.primary { background:var(--blue); border-color:var(--blue); color:#07111f; }
    .button.primary:hover, .button.primary:focus-visible { background:#78a8ff; border-color:#78a8ff; }
    .button.danger { color:#ff9a9a; border-color:#703535; }
    .button.success { color:var(--green); border-color:#23654b; }
    .content { max-width:1400px; margin:0 auto; padding-top:34px; }
    .heading { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
    h1 { margin:0; font-size:30px; letter-spacing:0; }
    h2 { margin:0; font-size:18px; }
    h3 { margin:0; font-size:15px; }
    p { line-height:1.55; }
    .subtle { color:var(--muted); margin:8px 0 0; }
    .toolbar { display:flex; gap:9px; margin:26px 0 20px; flex-wrap:wrap; }
    .filter { border:1px solid var(--line); background:transparent; color:var(--muted); padding:8px 10px; border-radius:7px; }
    .filter.active { background:var(--panel); color:var(--text); border-color:var(--line-strong); }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:8px; background:var(--panel); padding:17px; color:var(--text); transition:transform 160ms ease, border-color 160ms ease, background-color 160ms ease; }
    .card:hover, .card:focus-within { transform:translateY(-2px); border-color:#454545; background:var(--panel-hover); }
    .card.selected { border-color:var(--blue); }
    .card-select { display:block; width:100%; color:inherit; background:transparent; border:0; padding:0; text-align:left; }
    .card-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:15px; }
    .card-action { min-height:32px; border:1px solid var(--line-strong); border-radius:6px; background:#0b0b0b; color:var(--muted); padding:0 9px; font-size:12px; font-weight:700; }
    .card-action:hover, .card-action:focus-visible { background:var(--panel-hover); border-color:#555; color:var(--text); }
    .card-action.danger { color:#ff9a9a; border-color:#703535; }
    .card-header { display:flex; justify-content:space-between; gap:10px; align-items:center; }
    .domain { font-feature-settings:"tnum" 1; color:var(--muted); margin-top:8px; overflow-wrap:anywhere; }
    .meta { display:flex; gap:8px; flex-wrap:wrap; margin-top:15px; color:var(--weak); font-size:12px; }
    .tag { border:1px solid var(--line); border-radius:999px; padding:3px 8px; }
    .tag.draft { color:var(--yellow); border-color:#614a19; }
    .tag.archived { color:var(--muted); }
    .tag.deleted { color:#ff9a9a; border-color:#703535; }
    .empty { border:1px dashed var(--line-strong); min-height:250px; display:grid; place-items:center; text-align:center; padding:30px; border-radius:8px; }
    .empty-copy { max-width:470px; }
    .empty h2 { font-size:21px; }
    .empty .button { margin-top:15px; }
    .detail { margin-top:24px; border:1px solid var(--line); border-radius:8px; background:var(--panel); padding:22px; }
    .detail-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:14px; margin:19px 0 22px; }
    .detail-cell { display:grid; gap:5px; }
    .detail-cell span { color:var(--weak); font-size:12px; }
    .detail-cell strong { overflow-wrap:anywhere; }
    .placeholder { border-top:1px solid var(--line); margin-top:24px; padding-top:20px; color:var(--muted); }
    .drawer-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.62); opacity:0; pointer-events:none; transition:opacity 180ms ease; }
    .drawer { position:fixed; z-index:2; top:0; right:0; bottom:0; width:min(530px,100vw); background:#0b0b0b; border-left:1px solid var(--line-strong); transform:translateX(100%); transition:transform 210ms ease; padding:26px; overflow:auto; }
    body.drawer-open .drawer-backdrop { opacity:1; pointer-events:auto; }
    body.drawer-open .drawer { transform:translateX(0); }
    .drawer-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:28px; }
    .close { width:34px; min-width:34px; height:34px; border:1px solid var(--line); border-radius:7px; background:var(--panel); }
    .form { display:grid; gap:16px; }
    .field { display:grid; gap:8px; }
    label { font-size:13px; font-weight:700; }
    .field-help { color:var(--weak); font-size:12px; margin:0; }
    input, select { width:100%; min-height:40px; border-radius:7px; border:1px solid var(--line-strong); background:#080808; color:var(--text); padding:0 10px; }
    .drawer-footer { display:flex; justify-content:space-between; gap:12px; border-top:1px solid var(--line); margin-top:28px; padding-top:18px; }
    .form-status { min-height:20px; color:var(--muted); font-size:13px; }
    .form-status.error { color:#ff9a9a; }
    .form-status.success { color:var(--green); }
    .actions { display:flex; gap:8px; flex-wrap:wrap; }
    .hidden { display:none !important; }
    @media (max-width:760px) { .shell { grid-template-columns:1fr; } .sidebar { display:none; } .workspace { padding:22px 16px; } .heading, .topbar { align-items:flex-start; flex-direction:column; } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; } }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">${renderNiubigeoLockup("brand-lockup-image")}</div>
      <div class="project-label">项目</div>
      <select id="project-select" class="project-select" aria-label="项目切换" data-testid="project-select"></select>
      <nav class="nav" aria-label="项目导航">
        <button type="button" class="nav-item active">总览</button>
        <button type="button" class="nav-item" disabled>问题</button>
        <button type="button" class="nav-item" disabled>模型</button>
        <button type="button" class="nav-item" disabled>监测</button>
      </nav>
      <div class="sidebar-bottom">阶段 1 · 项目基础</div>
    </aside>
    <main class="workspace">
      <header class="topbar"><div class="crumb"><strong>${PRODUCT_NAME}</strong> / 项目</div><button id="new-project" type="button" class="button primary" data-testid="new-project">新建项目</button></header>
      <section class="content">
        <div class="heading"><div><h1>项目</h1><p class="subtle">每个项目只绑定一个主域名。项目创建后会立即保存为草稿，尚不会调用任何 AI Provider。</p></div></div>
        <div class="toolbar"><button type="button" class="filter active" data-list-mode="current">当前项目</button><button type="button" class="filter" data-list-mode="archived">已归档</button><button type="button" class="filter" data-list-mode="deleted">最近删除</button></div>
        <div id="notice" class="form-status" aria-live="polite"></div>
        <div id="project-list" class="grid" aria-live="polite" data-testid="project-list"></div>
        <div id="project-detail" data-testid="project-detail"></div>
      </section>
    </main>
  </div>
  <div id="drawer-backdrop" class="drawer-backdrop"></div>
  <aside id="project-drawer" class="drawer" aria-label="新建项目" aria-hidden="true" data-testid="project-drawer">
    <div class="drawer-head"><div><h2>新建项目</h2><p class="subtle">先保存域名草稿。问题、模型和监测计划将在后续步骤中配置。</p></div><button id="close-drawer" type="button" class="close" aria-label="关闭">×</button></div>
    <form id="project-form" class="form" autocomplete="off">
      <div class="field"><label for="project-domain">主域名</label><input id="project-domain" name="domain" placeholder="example.com" required><p class="field-help">同一个标准化域名只能绑定一个未删除项目。</p></div>
      <div class="field"><label for="project-name">项目名称</label><input id="project-name" name="name" placeholder="可选"></div>
      <div class="field"><label for="brand-name">品牌名称</label><input id="brand-name" name="brandName" placeholder="可选"></div>
      <div class="field"><label for="project-language">默认语言</label><select id="project-language" name="language"><option value="zh-CN">简体中文</option><option value="en">English</option></select></div>
      <div id="form-status" class="form-status" aria-live="polite"></div>
      <div class="drawer-footer"><button id="cancel-draft" type="button" class="button">取消</button><button id="save-draft" type="submit" class="button primary" data-testid="save-draft">保存草稿</button></div>
    </form>
  </aside>
  <script>
    const locationProjectId = new URL(window.location.href).searchParams.get("projectId") || "";
    const state = { mode: "current", projects: [], currentProjects: [], selectedId: locationProjectId || localStorage.getItem("niubigeo.product.projectId") || "", drawerSession: 0 };
    const element = (id) => document.getElementById(id);
    const html = (value) => String(value).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;").split("'").join("&#39;");
    const formatTime = (value) => new Date(value).toLocaleString();
    function setNotice(message, kind) { const notice = element("notice"); notice.textContent = message || ""; notice.className = kind ? "form-status " + kind : "form-status"; }
    function setFormStatus(message, kind) { const status = element("form-status"); status.textContent = message || ""; status.className = kind ? "form-status " + kind : "form-status"; }
    function setDrawer(open) { document.body.classList.toggle("drawer-open", open); element("project-drawer").setAttribute("aria-hidden", String(!open)); }
    function openDrawer() { state.drawerSession += 1; setDrawer(true); }
    function closeDrawer() { state.drawerSession += 1; setDrawer(false); }
    function setSelectedProject(projectId) { state.selectedId = projectId || ""; if (state.selectedId) localStorage.setItem("niubigeo.product.projectId", state.selectedId); else localStorage.removeItem("niubigeo.product.projectId"); const next = new URL(window.location.href); if (state.selectedId) next.searchParams.set("projectId", state.selectedId); else next.searchParams.delete("projectId"); window.history.replaceState({ projectId: state.selectedId }, "", next); }
    async function request(path, options) { const response = await fetch(path, options); const text = await response.text(); const body = text ? JSON.parse(text) : {}; if (!response.ok) throw new Error(body.error || "请求失败"); return body; }
    function listUrl() { if (state.mode === "archived") return "/api/projects?includeArchived=true"; if (state.mode === "deleted") return "/api/projects?includeDeleted=true"; return "/api/projects"; }
    function projectsForMode() { if (state.mode === "archived") return state.projects.filter((project) => project.status === "archived"); if (state.mode === "deleted") return state.projects.filter((project) => project.status === "deleted"); return state.projects.filter((project) => project.status === "draft" || project.status === "active"); }
    function statusText(status) { if (status === "draft") return "草稿"; if (status === "active") return "运行中"; if (status === "archived") return "已归档"; return "已删除"; }
    function renderSelect() { const select = element("project-select"); const current = state.currentProjects; if (current.length === 0) { select.innerHTML = '<option value="">还没有项目</option>'; select.value = ""; return; } select.innerHTML = current.map((project) => '<option value="' + html(project.id) + '">' + html(project.name) + ' · ' + html(project.normalizedDomain) + '</option>').join(""); select.value = state.selectedId; }
    function cardActions(project) { if (state.mode === "archived") return '<div class="card-actions"><button type="button" class="card-action" data-project-action="restore" data-project-id="' + html(project.id) + '">恢复项目</button></div>'; if (state.mode === "deleted") return '<div class="card-actions"><button type="button" class="card-action" data-project-action="restore" data-project-id="' + html(project.id) + '">恢复项目</button><button type="button" class="card-action danger" data-project-action="purge" data-project-id="' + html(project.id) + '">永久清除</button></div>'; return '<div class="card-actions"><button type="button" class="card-action" data-project-action="archive" data-project-id="' + html(project.id) + '">归档</button><button type="button" class="card-action danger" data-project-action="delete" data-project-id="' + html(project.id) + '">删除</button></div>'; }
    function renderList() { const list = element("project-list"); const projects = projectsForMode(); if (projects.length === 0) { const title = state.mode === "current" ? "还没有项目" : state.mode === "archived" ? "没有已归档项目" : "没有最近删除的项目"; const description = state.mode === "current" ? "输入一个域名，立即保存为项目草稿。" : "这里会保留项目生命周期记录。"; list.className = "empty"; list.innerHTML = '<div class="empty-copy" data-testid="empty-state"><h2>' + title + '</h2><p class="subtle">' + description + '</p>' + (state.mode === "current" ? '<button id="empty-new-project" type="button" class="button primary">新建项目</button>' : '') + '</div>'; return; } list.className = "grid"; list.innerHTML = projects.map((project) => '<article class="card ' + (project.id === state.selectedId ? "selected" : "") + '" data-testid="project-card" data-project-id="' + html(project.id) + '"><button type="button" class="card-select" data-project-action="select" data-project-id="' + html(project.id) + '"><div class="card-header"><h3 data-testid="project-title">' + html(project.name) + '</h3><span class="tag ' + html(project.status) + '">' + statusText(project.status) + '</span></div><div class="domain" data-testid="project-domain">' + html(project.normalizedDomain) + '</div><div class="meta"><span>品牌：' + html(project.brandName) + '</span><span>更新：' + html(formatTime(project.updatedAt)) + '</span></div></button>' + cardActions(project) + '</article>').join(""); }
    function selectedProject() { return state.currentProjects.find((project) => project.id === state.selectedId) || null; }
    function renderDetail() { const target = element("project-detail"); const project = selectedProject(); if (!project || state.mode !== "current") { target.innerHTML = ""; return; } target.innerHTML = '<section class="detail"><div class="card-header"><div><h2 data-testid="selected-project-title">' + html(project.name) + '</h2><p class="subtle">项目身份已持久化，可在这里维护基础资料。</p></div><span class="tag ' + html(project.status) + '">' + statusText(project.status) + '</span></div><div class="detail-grid"><div class="detail-cell"><span>主域名</span><strong data-testid="selected-project-domain">' + html(project.normalizedDomain) + '</strong></div><div class="detail-cell"><span>品牌名称</span><strong>' + html(project.brandName) + '</strong></div><div class="detail-cell"><span>默认语言</span><strong>' + html(project.defaultLanguage) + '</strong></div><div class="detail-cell"><span>项目 ID</span><strong data-testid="selected-project-id">' + html(project.id) + '</strong></div></div><form id="project-edit-form" class="form"><div class="field"><label for="edit-domain">主域名</label><input id="edit-domain" value="' + html(project.primaryDomain) + '"></div><div class="field"><label for="edit-name">项目名称</label><input id="edit-name" value="' + html(project.name) + '"></div><div class="field"><label for="edit-brand">品牌名称</label><input id="edit-brand" value="' + html(project.brandName) + '"></div><div class="field"><label for="edit-language">默认语言</label><select id="edit-language"><option value="zh-CN">简体中文</option><option value="en">English</option></select></div><div class="actions"><button type="submit" class="button primary" data-testid="save-project">保存项目</button><button id="archive-project" type="button" class="button" data-testid="archive-project">归档</button><button id="delete-project" type="button" class="button danger" data-testid="delete-project">删除项目</button></div></form></section>'; element("edit-language").value = project.defaultLanguage; }
    function render() { renderSelect(); renderList(); renderDetail(); document.title = selectedProject() ? selectedProject().name + " | " + ${JSON.stringify(PRODUCT_TITLE)} : ${JSON.stringify(PRODUCT_TITLE)}; document.querySelectorAll("[data-list-mode]").forEach((button) => button.classList.toggle("active", button.dataset.listMode === state.mode)); }
    async function refresh(message) { const requests = state.mode === "current" ? [request("/api/projects")] : [request("/api/projects"), request(listUrl())]; const responses = await Promise.all(requests); state.currentProjects = responses[0].projects; state.projects = state.mode === "current" ? state.currentProjects : responses[1].projects; if (!state.currentProjects.some((project) => project.id === state.selectedId)) setSelectedProject(state.currentProjects[0] ? state.currentProjects[0].id : ""); else setSelectedProject(state.selectedId); render(); if (message) setNotice(message, "success"); }
    function setButtonLoading(button, label) { button.disabled = true; button.dataset.originalLabel = button.textContent; button.textContent = label; }
    function restoreButton(button) { button.disabled = false; button.textContent = button.dataset.originalLabel || button.textContent; }
    async function createDraft(event) { event.preventDefault(); const button = element("save-draft"); const drawerSession = state.drawerSession; setButtonLoading(button, "正在保存…"); setFormStatus("正在创建项目草稿", ""); try { const project = await request("/api/projects", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ domain:element("project-domain").value, name:element("project-name").value, brandName:element("brand-name").value, defaultLanguage:element("project-language").value }) }); state.mode = "current"; setSelectedProject(project.project.id); setFormStatus("已保存草稿", "success"); await refresh("项目草稿已保存"); window.setTimeout(() => { restoreButton(button); if (state.drawerSession === drawerSession) closeDrawer(); }, 800); } catch (error) { setFormStatus(error instanceof Error ? error.message : String(error), "error"); restoreButton(button); } }
    async function saveEdit(event) { event.preventDefault(); const project = selectedProject(); if (!project) return; const button = event.currentTarget.querySelector('button[type="submit"]'); setButtonLoading(button, "正在保存…"); try { await request("/api/projects/" + encodeURIComponent(project.id), { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ domain:element("edit-domain").value, name:element("edit-name").value, brandName:element("edit-brand").value, defaultLanguage:element("edit-language").value }) }); await refresh("项目已保存"); window.setTimeout(() => restoreButton(button), 800); } catch (error) { setNotice(error instanceof Error ? error.message : String(error), "error"); restoreButton(button); } }
    async function archiveProject(projectId, button) { const project = state.currentProjects.find((item) => item.id === projectId); if (!project) return; if (button) setButtonLoading(button, "正在归档…"); try { await request("/api/projects/" + encodeURIComponent(project.id) + "/archive", { method:"POST" }); if (state.selectedId === project.id) setSelectedProject(""); await refresh("项目已归档"); } catch (error) { setNotice(error instanceof Error ? error.message : String(error), "error"); if (button) restoreButton(button); } }
    async function deleteProject(projectId, button) { const project = state.currentProjects.find((item) => item.id === projectId); if (!project || !window.confirm("删除后项目将从当前列表移除。仍可在最近删除中恢复或永久清除。")) return; if (button) setButtonLoading(button, "正在删除…"); try { await request("/api/projects/" + encodeURIComponent(project.id), { method:"DELETE" }); if (state.selectedId === project.id) setSelectedProject(""); await refresh("项目已删除"); } catch (error) { setNotice(error instanceof Error ? error.message : String(error), "error"); if (button) restoreButton(button); } }
    async function restoreDeleted(projectId) { await request("/api/projects/" + encodeURIComponent(projectId) + "/restore", { method:"POST" }); state.mode = "current"; setSelectedProject(projectId); await refresh("项目已恢复"); }
    async function purgeDeleted(projectId) { if (!window.confirm("永久删除后无法恢复。")) return; await request("/api/projects/" + encodeURIComponent(projectId) + "/purge", { method:"DELETE" }); await refresh("项目已永久删除"); }
    element("new-project").addEventListener("click", () => { setFormStatus("", ""); openDrawer(); element("project-domain").focus(); });
    element("close-drawer").addEventListener("click", closeDrawer);
    element("cancel-draft").addEventListener("click", closeDrawer);
    element("drawer-backdrop").addEventListener("click", closeDrawer);
    element("project-form").addEventListener("submit", createDraft);
    element("project-select").addEventListener("change", (event) => { setSelectedProject(event.target.value); render(); });
    document.querySelectorAll("[data-list-mode]").forEach((button) => button.addEventListener("click", async () => { state.mode = button.dataset.listMode; await refresh(); }));
    element("project-list").addEventListener("click", async (event) => { if (event.target.id === "empty-new-project") { openDrawer(); return; } const action = event.target.closest("[data-project-action]"); if (!action) return; const id = action.dataset.projectId; if (!id) return; if (action.dataset.projectAction === "select") { setSelectedProject(id); render(); return; } if (action.dataset.projectAction === "archive") { await archiveProject(id, action); return; } if (action.dataset.projectAction === "delete") { await deleteProject(id, action); return; } if (action.dataset.projectAction === "restore") { await restoreDeleted(id); return; } if (action.dataset.projectAction === "purge") { await purgeDeleted(id); } });
    element("project-detail").addEventListener("submit", saveEdit);
    element("project-detail").addEventListener("click", (event) => { if (event.target.id === "archive-project") archiveProject(selectedProject()?.id, event.target); if (event.target.id === "delete-project") deleteProject(selectedProject()?.id, event.target); });
    refresh().catch((error) => setNotice(error instanceof Error ? error.message : String(error), "error"));
  </script>
</body>
</html>`;
}
