export function renderMotionRuntime(): string {
  return String.raw`
    const motion = (() => {
      const buttonTimers = new WeakMap();
      const scrollPositions = new Map();
      let chartGeometry = new Map();
      let tooltip = null;
      let lastFocusedElement = null;

      function reduced() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      }

      function wait(milliseconds) {
        return new Promise((resolve) => window.setTimeout(resolve, reduced() ? 0 : milliseconds));
      }

      function rememberButton(button) {
        if (!button) return;
        if (!button.dataset.motionLabel) button.dataset.motionLabel = button.textContent || "";
        if (!button.style.minWidth) button.style.minWidth = Math.ceil(button.getBoundingClientRect().width) + "px";
      }

      function setButton(button, status, label) {
        if (!button) return;
        rememberButton(button);
        button.dataset.uiState = status;
        button.setAttribute("aria-busy", status === "loading" ? "true" : "false");
        button.disabled = status === "loading" || status === "disabled";
        if (label) button.textContent = label;
      }

      function resetButton(button) {
        if (!button || !button.isConnected) return;
        const timer = buttonTimers.get(button);
        if (timer) window.clearTimeout(timer);
        buttonTimers.delete(button);
        button.dataset.uiState = "idle";
        button.removeAttribute("aria-busy");
        button.disabled = false;
        if (button.dataset.motionLabel != null) button.textContent = button.dataset.motionLabel;
      }

      function errorHost(button) {
        return button && (button.closest(".task-card") || button.closest("form") || button.closest(".section") || button.parentElement);
      }

      function clearError(button) {
        const host = errorHost(button);
        if (!host) return;
        host.querySelectorAll(".action-error").forEach((node) => node.remove());
      }

      function showError(button, error) {
        const host = errorHost(button);
        if (!host) return;
        clearError(button);
        const message = document.createElement("div");
        message.className = "action-error";
        message.setAttribute("role", "alert");
        message.textContent = error instanceof Error ? error.message : String(error);
        host.appendChild(message);
      }

      async function run(button, labels, operation) {
        if (!button || button.dataset.uiState === "loading") return { ok: false };
        rememberButton(button);
        clearError(button);
        setButton(button, "loading", labels.loading);
        const timer = window.setTimeout(() => {
          if (button.dataset.uiState === "loading" && labels.stage) button.textContent = labels.stage;
        }, 3000);
        buttonTimers.set(button, timer);
        try {
          const value = await operation();
          window.clearTimeout(timer);
          setButton(button, "success", labels.success);
          await wait(800);
          resetButton(button);
          return { ok: true, value };
        } catch (error) {
          window.clearTimeout(timer);
          setButton(button, "error", labels.error);
          button.disabled = false;
          showError(button, error);
          return { ok: false, error };
        }
      }

      function setToggle(control, checked) {
        if (!control) return;
        control.setAttribute("aria-checked", checked ? "true" : "false");
        control.dataset.checked = checked ? "true" : "false";
        const label = control.querySelector(".task-switch-label");
        if (label) label.textContent = checked ? control.dataset.onLabel || "" : control.dataset.offLabel || "";
      }

      async function runToggle(control, checked, operation) {
        if (!control || control.dataset.uiState === "loading") return { ok: false };
        const previous = control.getAttribute("aria-checked") === "true";
        clearError(control);
        setToggle(control, checked);
        control.dataset.uiState = "loading";
        control.setAttribute("aria-busy", "true");
        control.disabled = true;
        try {
          const value = await operation();
          if (control.isConnected) {
            control.dataset.uiState = "success";
            control.setAttribute("aria-busy", "false");
            await wait(800);
            control.dataset.uiState = "idle";
            control.disabled = false;
          }
          return { ok: true, value };
        } catch (error) {
          setToggle(control, previous);
          control.dataset.uiState = "error";
          control.setAttribute("aria-busy", "false");
          control.disabled = false;
          showError(control, error);
          return { ok: false, error };
        }
      }

      function progressStageLabel(progress) {
        if (!progress) return t("preparingAudit");
        if (progress.stage === "calling_providers") return t("callingProviders");
        if (progress.stage === "building_result") return t("buildingResult");
        if (progress.stage === "saving_result") return t("savingResult");
        if (progress.stage === "completed") return t("runFinished");
        if (progress.stage === "failed") return t("failed");
        return t("preparingAudit");
      }

      function renderProgress(job) {
        const panel = $("audit-progress");
        if (!panel || !job) return;
        const progress = job.progress || {};
        const planned = Number(progress.plannedObservationCount || 0);
        const completed = Number(progress.completedObservationCount || 0);
        const failed = Number(progress.failedObservationCount || 0);
        const finished = completed + failed;
        const ratio = planned > 0 ? Math.min(1, finished / planned) : 0;
        const models = Array.isArray(progress.models) ? progress.models : [];
        const rows = models.map((item) => {
          const done = Number(item.completed || 0) + Number(item.failed || 0);
          const stateLabel = item.failed > 0 ? t("failedCount", { count: item.failed }) : done >= item.planned ? t("completed") : t("running");
          return '<li><span><strong>' + html(modelLabel(item.model)) + '</strong><small>' + html(item.providerId) + '</small></span><span>' + done + ' / ' + item.planned + '<small>' + html(stateLabel) + '</small></span></li>';
        }).join("");
        panel.classList.remove("hidden");
        panel.dataset.jobStatus = job.status;
        const heading = job.status === "failed" ? t("failed") : job.status === "completed" ? t("runFinished") : progressStageLabel(progress);
        panel.innerHTML = '<div class="audit-progress-head"><div><span class="operation-dot"></span><strong>' + html(heading) + '</strong></div><button class="close-button" type="button" data-close-progress="true" aria-label="' + html(t("close")) + '">×</button></div><div class="audit-progress-bar"><span style="transform:scaleX(' + ratio + ')"></span></div><p>' + finished + ' / ' + planned + ' ' + html(t("observationsCompleted")) + '</p><ul>' + rows + '</ul>' + (job.error ? '<div class="action-error" role="alert">' + html(job.error) + '</div>' : '');
      }

      async function pollJob(jobId, button, startedAt) {
        while (true) {
          const job = await requestJson("/audit-jobs/" + encodeURIComponent(jobId));
          renderProgress(job);
          if (Date.now() - startedAt >= 3000 && button && button.dataset.uiState === "loading") {
            button.textContent = progressStageLabel(job.progress);
          }
          if (job.status === "completed") return job.result;
          if (job.status === "failed") throw new Error(job.error || t("failed"));
          await wait(450);
        }
      }

      async function runAuditJob(button, startRequest, onComplete) {
        const startedAt = Date.now();
        const result = await run(
          button,
          { loading: t("creatingRun"), stage: t("runningProviderCalls"), success: t("runStarted"), error: t("retryAction") },
          async () => {
            const job = await startRequest();
            renderProgress(job);
            const value = await pollJob(job.id, button, startedAt);
            await onComplete(value);
            return value;
          },
        );
        if (result.ok) {
          const panel = $("audit-progress");
          await wait(800);
          if (panel && panel.dataset.jobStatus === "completed") panel.classList.add("hidden");
        }
        return result;
      }

      function captureCharts(root) {
        const next = new Map();
        const scope = root || document;
        scope.querySelectorAll(".chart-line[data-series-key]").forEach((line) => {
          const key = line.getAttribute("data-series-key");
          const raw = line.getAttribute("data-chart-points");
          if (!key || !raw) return;
          try { next.set(key, JSON.parse(raw)); } catch {}
        });
        return next;
      }

      function beginChartUpdate() {
        const active = document.querySelector('.view.active');
        chartGeometry = captureCharts(active || document);
        if (active) active.classList.add("data-refreshing");
      }

      function finishDataRefresh() {
        document.querySelectorAll(".view.data-refreshing").forEach((node) => node.classList.remove("data-refreshing"));
      }

      function pointsText(points) {
        return points.map((point) => Number(point[0]).toFixed(1) + "," + Number(point[1]).toFixed(1)).join(" ");
      }

      function animateLineUpdate(line, from, to) {
        if (reduced() || from.length !== to.length) {
          line.setAttribute("points", pointsText(to));
          line.classList.add("chart-line-ready");
          return;
        }
        const start = performance.now();
        const duration = 300;
        const frame = (now) => {
          const amount = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - amount, 3);
          const current = to.map((point, index) => [
            from[index][0] + (point[0] - from[index][0]) * eased,
            from[index][1] + (point[1] - from[index][1]) * eased,
          ]);
          line.setAttribute("points", pointsText(current));
          if (amount < 1) window.requestAnimationFrame(frame);
          else line.classList.add("chart-line-ready");
        };
        line.setAttribute("points", pointsText(from));
        window.requestAnimationFrame(frame);
      }

      function animateCharts(root) {
        if (!root) return;
        root.closest(".view")?.classList.remove("data-refreshing");
        const lines = [...root.querySelectorAll(".chart-line[data-series-key]")];
        const hasPrevious = chartGeometry.size > 0;
        window.requestAnimationFrame(() => {
          root.querySelectorAll(".chart-grid, .chart-axis-label").forEach((node) => node.classList.add("chart-axis-ready"));
          lines.forEach((line) => {
            const key = line.getAttribute("data-series-key");
            const raw = line.getAttribute("data-chart-points");
            let target = [];
            try { target = raw ? JSON.parse(raw) : []; } catch {}
            const previous = key ? chartGeometry.get(key) : undefined;
            if (hasPrevious && previous && target.length > 1) {
              animateLineUpdate(line, previous, target);
              return;
            }
            if (reduced()) {
              line.classList.add("chart-line-ready");
              return;
            }
            const length = line.getTotalLength();
            line.style.setProperty("--chart-path-length", String(length));
            line.classList.add("drawing");
          });
          root.querySelectorAll(".chart-point-group").forEach((node, index) => {
            node.style.setProperty("--point-delay", String(120 + index * 30) + "ms");
            node.classList.add("chart-point-ready");
          });
          root.querySelectorAll(".legend, .trend-proof, .trend-definitions").forEach((node) => node.classList.add("chart-detail-ready"));
          chartGeometry = new Map();
        });
      }

      function tooltipElement() {
        if (tooltip) return tooltip;
        tooltip = document.createElement("div");
        tooltip.className = "chart-tooltip";
        tooltip.setAttribute("role", "tooltip");
        document.body.appendChild(tooltip);
        return tooltip;
      }

      function showPointTooltip(target) {
        const frame = target.closest(".chart-frame");
        if (!frame) return;
        const tip = tooltipElement();
        const box = target.getBoundingClientRect();
        tip.textContent = target.getAttribute("aria-label") || "";
        tip.style.transform = "translate(" + Math.round(box.left + box.width / 2) + "px," + Math.round(box.top - 8) + "px) translate(-50%,-100%)";
        tip.classList.add("visible");
        const activeKey = target.getAttribute("data-series-key");
        frame.querySelectorAll(".chart-line").forEach((line) => {
          line.classList.toggle("chart-line-muted", Boolean(activeKey) && line.getAttribute("data-series-key") !== activeKey);
        });
      }

      function hidePointTooltip(target) {
        if (tooltip) tooltip.classList.remove("visible");
        const frame = target && target.closest(".chart-frame");
        if (frame) frame.querySelectorAll(".chart-line-muted").forEach((line) => line.classList.remove("chart-line-muted"));
      }

      function pulsePoint(target) {
        const group = target && target.closest(".chart-point-group");
        if (!group) return;
        group.classList.remove("point-selected");
        void group.getBoundingClientRect();
        group.classList.add("point-selected");
      }

      function openSheet(sheet) {
        if (!sheet) return;
        lastFocusedElement = document.activeElement;
        sheet.classList.add("open");
        sheet.setAttribute("aria-hidden", "false");
        const backdrop = $("detail-backdrop");
        if (backdrop) backdrop.classList.add("open");
        window.requestAnimationFrame(() => sheet.querySelector("button, [href], input, select, textarea")?.focus());
      }

      function closeSheet(sheet) {
        if (!sheet) return;
        sheet.classList.remove("open");
        sheet.setAttribute("aria-hidden", "true");
        const backdrop = $("detail-backdrop");
        if (backdrop) backdrop.classList.remove("open");
        if (lastFocusedElement && lastFocusedElement.focus) lastFocusedElement.focus();
      }

      function rememberScroll(view) {
        scrollPositions.set(view, window.scrollY);
      }

      function restoreScroll(view) {
        const top = scrollPositions.get(view) || 0;
        window.requestAnimationFrame(() => window.scrollTo({ top, behavior: "auto" }));
      }

      function enterView(node) {
        if (!node) return;
        node.classList.remove("view-entering");
        void node.getBoundingClientRect();
        node.classList.add("view-entering");
      }

      function bind() {
        document.addEventListener("pointerover", (event) => {
          const target = event.target.closest ? event.target.closest(".chart-point-hit") : null;
          if (target) showPointTooltip(target);
        });
        document.addEventListener("pointerout", (event) => {
          const target = event.target.closest ? event.target.closest(".chart-point-hit") : null;
          if (target) hidePointTooltip(target);
        });
        document.addEventListener("focusin", (event) => {
          if (event.target.classList && event.target.classList.contains("chart-point-hit")) showPointTooltip(event.target);
        });
        document.addEventListener("focusout", (event) => {
          if (event.target.classList && event.target.classList.contains("chart-point-hit")) hidePointTooltip(event.target);
        });
      }

      return {
        animateCharts,
        beginChartUpdate,
        bind,
        closeSheet,
        enterView,
        finishDataRefresh,
        openSheet,
        pulsePoint,
        rememberScroll,
        renderProgress,
        resetButton,
        restoreScroll,
        run,
        runAuditJob,
        runToggle,
        setButton,
      };
    })();
  `;
}
