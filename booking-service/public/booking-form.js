/**
 * booking-form.js
 *
 * Loaded by the booking form HTML page (rendered inside an iframe).
 * Provides initBookingForm(config) which wires up the dynamic behaviour:
 *   - populates the colleagues dropdown
 *   - loads available time slots when a colleague / date changes
 *   - validates the form before the host page submits it via postMessage
 *
 * The host page is responsible for the actual postMessage submit call.
 * This script ONLY prepares data and notifies the host when the form is
 * ready / when the user clicks Submit.
 */

(function () {
  "use strict";

  /**
   * @typedef {Object} InitialValues
   * @property {string} [colleague]
   * @property {string} [date]
   * @property {string} [time]
   * @property {string} [duration]
   * @property {number} [customDuration]
   * @property {string} [subject]
   */

  /**
   * @typedef {Object} BookingFormConfig
   * @property {string} bookingServiceUrl   - Base URL of the booking service, e.g. "http://localhost:3002"
   * @property {string} [formId]            - Unique form identifier passed back in the postMessage
   * @property {InitialValues} [initialValues]
   */

  /**
   * Main entry point.  Called by the host HTML page once the DOM is ready.
   *
   * @param {BookingFormConfig} config
   */
  window.initBookingForm = async function initBookingForm(config) {
    const baseUrl = (config.bookingServiceUrl || "").replace(/\/$/, "");
    const formId = config.formId || "booking-form";
    const initialValues = config.initialValues || {};

    // ── DOM refs ───────────────────────────────────────────────────────────

    const colleagueSelect = document.getElementById("colleague-select");
    const dateInput = document.getElementById("date-input");
    const slotsContainer = document.getElementById("slots-container");
    const slotsGrid = document.getElementById("slots-grid");
    const slotsLoading = document.getElementById("slots-loading");
    const slotsError = document.getElementById("slots-error");
    const durationSelect = document.getElementById("duration-select");
    const customDurationWrapper = document.getElementById("custom-duration-wrapper");
    const customDurationInput = document.getElementById("custom-duration-input");
    const subjectInput = document.getElementById("subject-input");
    const submitBtn = document.getElementById("submit-btn");
    const formError = document.getElementById("form-error");

    if (!colleagueSelect || !dateInput || !slotsGrid || !submitBtn) {
      console.error("[booking-form] Required DOM elements not found");
      return;
    }

    // ── State ──────────────────────────────────────────────────────────────

    /** @type {string|null} */
    let selectedTime = null;

    // ── Helpers ────────────────────────────────────────────────────────────

    /** Returns tomorrow's date as YYYY-MM-DD */
    function getTomorrow() {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    }

    function showError(msg) {
      if (formError) {
        formError.textContent = msg;
        formError.style.display = msg ? "block" : "none";
      }
    }

    function setLoading(loading) {
      if (slotsLoading) slotsLoading.style.display = loading ? "block" : "none";
      if (slotsError) slotsError.style.display = "none";
      if (slotsGrid) slotsGrid.style.display = loading ? "none" : "grid";
    }

    function notifyResize() {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "ui_resize", height }, "*");
    }

    // ── Load colleagues ────────────────────────────────────────────────────

    async function loadColleagues() {
      try {
        const resp = await fetch(`${baseUrl}/api/colleagues`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        /** @type {Array<{id: string, name: string, role: string}>} */
        const colleagues = await resp.json();

        // Clear existing options (keep placeholder)
        while (colleagueSelect.options.length > 1) {
          colleagueSelect.remove(1);
        }

        colleagues.forEach((c) => {
          const opt = document.createElement("option");
          opt.value = c.id;
          opt.textContent = `${c.name} — ${c.role}`;
          opt.dataset.name = c.name;
          colleagueSelect.appendChild(opt);
        });

        // Apply initialValues
        if (initialValues.colleague) {
          // Try to match by id or by name
          const matchById = Array.from(colleagueSelect.options).find(
            (o) => o.value === initialValues.colleague
          );
          const matchByName = Array.from(colleagueSelect.options).find(
            (o) => (o.dataset.name || "").toLowerCase() === (initialValues.colleague || "").toLowerCase()
          );
          const match = matchById || matchByName;
          if (match) {
            colleagueSelect.value = match.value;
          }
        }
      } catch (err) {
        console.error("[booking-form] Failed to load colleagues:", err);
        if (slotsError) {
          slotsError.textContent = "Не удалось загрузить список коллег";
          slotsError.style.display = "block";
        }
      }
    }

    // ── Load slots ─────────────────────────────────────────────────────────

    async function loadSlots() {
      const colleagueId = colleagueSelect.value;
      const date = dateInput.value;

      selectedTime = null;

      if (!colleagueId) {
        if (slotsContainer) slotsContainer.style.display = "none";
        return;
      }

      if (slotsContainer) slotsContainer.style.display = "block";
      setLoading(true);

      try {
        const params = new URLSearchParams({ colleague: colleagueId });
        if (date) params.set("date", date);

        const resp = await fetch(`${baseUrl}/api/slots?${params}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data = await resp.json();
        renderSlots(data.slots || []);

        // Apply initial time if provided
        if (initialValues.time) {
          const btn = slotsGrid.querySelector(`[data-time="${initialValues.time}"]`);
          if (btn && !btn.disabled) {
            btn.click();
          } else if (btn && btn.disabled) {
            // Slot is unavailable — show a warning but still pre-select display
            btn.classList.add("slot-preselected-unavailable");
            const warn = document.createElement("p");
            warn.className = "slot-warning";
            warn.style.cssText = "color:#b45309;font-size:0.8rem;margin-top:0.5rem;";
            warn.textContent = `Слот ${initialValues.time} недоступен. Выберите другое время.`;
            if (slotsContainer) slotsContainer.appendChild(warn);
          }
        }
      } catch (err) {
        console.error("[booking-form] Failed to load slots:", err);
        setLoading(false);
        if (slotsError) {
          slotsError.textContent = "Не удалось загрузить временные слоты";
          slotsError.style.display = "block";
        }
      } finally {
        notifyResize();
      }
    }

    /**
     * @param {Array<{time: string, available: boolean}>} slots
     */
    function renderSlots(slots) {
      slotsGrid.innerHTML = "";

      slots.forEach((slot) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.time = slot.time;
        btn.textContent = slot.time;

        if (!slot.available) {
          btn.disabled = true;
          btn.className = "slot-btn slot-unavailable";
          btn.title = "Слот недоступен";
        } else {
          btn.className = "slot-btn slot-available";
          btn.addEventListener("click", () => selectSlot(slot.time, btn));
        }

        slotsGrid.appendChild(btn);
      });

      setLoading(false);
    }

    /**
     * @param {string} time
     * @param {HTMLButtonElement} btn
     */
    function selectSlot(time, btn) {
      // Deselect previous
      slotsGrid.querySelectorAll(".slot-btn.slot-selected").forEach((b) => {
        b.classList.remove("slot-selected");
      });

      selectedTime = time;
      btn.classList.add("slot-selected");
      showError("");
    }

    // ── Duration handling ──────────────────────────────────────────────────

    function onDurationChange() {
      if (!durationSelect || !customDurationWrapper) return;
      const isCustom = durationSelect.value === "custom";
      customDurationWrapper.style.display = isCustom ? "block" : "none";
      notifyResize();
    }

    // ── Validation ─────────────────────────────────────────────────────────

    /**
     * Validates the form and returns { valid, values } or { valid: false, errors }.
     */
    function validateForm() {
      const errors = [];

      const colleagueId = colleagueSelect.value;
      if (!colleagueId) errors.push("Выберите коллегу");

      const date = dateInput.value;
      if (!date) errors.push("Укажите дату");

      if (!selectedTime) errors.push("Выберите время встречи");

      const durationVal = durationSelect ? durationSelect.value : "30";
      let durationMinutes = parseInt(durationVal, 10);
      if (durationVal === "custom") {
        const custom = customDurationInput ? parseInt(customDurationInput.value, 10) : NaN;
        if (!custom || custom < 15 || custom > 480) {
          errors.push("Введите корректную длительность (15–480 минут)");
        } else {
          durationMinutes = custom;
        }
      }

      const selectedOption = colleagueSelect.options[colleagueSelect.selectedIndex];
      const colleagueName = selectedOption ? (selectedOption.dataset.name || colleagueId) : colleagueId;

      return errors.length > 0
        ? { valid: false, errors }
        : {
            valid: true,
            values: {
              formId,
              colleague: colleagueId,
              colleagueName,
              date,
              time: selectedTime,
              duration: durationMinutes,
              subject: subjectInput ? subjectInput.value.trim() : "",
            },
          };
    }

    // ── Submit ─────────────────────────────────────────────────────────────

    submitBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showError("");

      const result = validateForm();
      if (!result.valid) {
        showError(result.errors.join(". "));
        return;
      }

      // Notify parent frame — parent will do the actual MCP postMessage call
      window.parent.postMessage(
        {
          type: "mcp_tool_call",
          tool: "submit_booking_form",
          params: {
            formId,
            values: result.values,
          },
        },
        "*"
      );

      // Disable submit to prevent double-click
      submitBtn.disabled = true;
      submitBtn.textContent = "Отправка...";
    });

    // Listen for result from parent (to re-enable on error)
    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (!msg || msg.type !== "mcp_tool_result") return;

      if (msg.result && msg.result.accepted === false) {
        // Re-enable submit and show server-side errors
        submitBtn.disabled = false;
        submitBtn.textContent = "Забронировать";
        const errors = Array.isArray(msg.result.errors) ? msg.result.errors.join(". ") : "Ошибка при бронировании";
        showError(errors);
      }
    });

    // ── Event wiring ───────────────────────────────────────────────────────

    colleagueSelect.addEventListener("change", loadSlots);

    dateInput.addEventListener("change", () => {
      if (colleagueSelect.value) loadSlots();
    });

    if (durationSelect) {
      durationSelect.addEventListener("change", onDurationChange);
    }

    // ── Initial population ─────────────────────────────────────────────────

    // Set default date to tomorrow if not provided
    if (dateInput) {
      dateInput.value = initialValues.date || getTomorrow();
      dateInput.min = new Date().toISOString().slice(0, 10);
    }

    // Duration
    if (durationSelect && initialValues.duration) {
      durationSelect.value = initialValues.duration;
      onDurationChange();
    }

    if (customDurationInput && initialValues.customDuration) {
      customDurationInput.value = String(initialValues.customDuration);
    }

    // Subject
    if (subjectInput && initialValues.subject) {
      subjectInput.value = initialValues.subject;
    }

    // Load colleagues (also applies initial colleague + loads slots)
    await loadColleagues();

    // Load slots after colleagues are populated (initial colleague may be set)
    if (colleagueSelect.value) {
      await loadSlots();
    }

    notifyResize();
    console.log("[booking-form] Initialized");
  };
})();
