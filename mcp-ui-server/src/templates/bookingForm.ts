/**
 * bookingForm.ts
 *
 * Generates the self-contained HTML page for the meeting booking form.
 * The page is designed to be embedded inside an iframe.
 *
 * All dynamic logic (loading colleagues, slots, validation, postMessage) is
 * implemented inline — the external booking-form.js from booking-service is
 * loaded as a demo of external resource loading, but is NOT required for the
 * form to function.
 */

export interface BookingFormConfig {
  formId: string;
  bookingServiceUrl: string;
  initialValues?: {
    colleague?: string;
    date?: string;
    time?: string;
    duration?: string;
    customDuration?: number;
    subject?: string;
  };
}

export function generateBookingFormHtml(config: BookingFormConfig): string {
  const configJson = JSON.stringify(config);
  const bookingJsUrl = `${config.bookingServiceUrl}/static/booking-form.js`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Book a Meeting</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* Slot button base styles — Tailwind can't use dynamic class names well */
    .slot-btn {
      padding: 0.375rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 500;
      transition: all 0.15s ease;
      border: 1.5px solid transparent;
      cursor: pointer;
      text-align: center;
    }
    .slot-available {
      background: #f0fdf4;
      border-color: #86efac;
      color: #15803d;
    }
    .slot-available:hover {
      background: #dcfce7;
      border-color: #4ade80;
    }
    .slot-selected {
      background: #16a34a !important;
      border-color: #15803d !important;
      color: #ffffff !important;
    }
    .slot-unavailable {
      background: #f9fafb;
      border-color: #e5e7eb;
      color: #9ca3af;
      cursor: not-allowed;
      text-decoration: line-through;
    }
    .slot-preselected-unavailable {
      background: #fef3c7;
      border-color: #fcd34d;
      color: #92400e;
    }
    .slot-warning {
      color: #b45309;
      font-size: 0.8rem;
      margin-top: 0.5rem;
    }
    body {
      margin: 0;
      padding: 0;
      background: #f8fafc;
    }
  </style>
</head>
<body class="bg-slate-50 min-h-screen">
  <script>
    window.__BOOKING_CONFIG__ = ${configJson};
  </script>

  <div class="max-w-lg mx-auto p-6">
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center gap-3 mb-1">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </div>
        <h1 class="text-xl font-bold text-slate-800">Book a Meeting</h1>
      </div>
      <p class="text-sm text-slate-500 ml-11">Fill in the form to schedule your meeting</p>
    </div>

    <!-- Form card -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="p-6 space-y-5">

        <!-- Colleague selector -->
        <div>
          <label for="colleague-select" class="block text-sm font-medium text-slate-700 mb-1.5">
            Colleague <span class="text-red-500">*</span>
          </label>
          <div class="relative">
            <select id="colleague-select"
              class="w-full appearance-none bg-slate-50 border border-slate-300 text-slate-800 rounded-lg
                     px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                     focus:border-blue-500 transition-colors">
              <option value="">Select a colleague...</option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </div>
          </div>
          <div id="colleague-warning" class="hidden mt-1.5 text-xs text-amber-600 flex items-center gap-1">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            <span id="colleague-warning-text"></span>
          </div>
        </div>

        <!-- Date picker -->
        <div>
          <label for="date-input" class="block text-sm font-medium text-slate-700 mb-1.5">
            Date <span class="text-red-500">*</span>
          </label>
          <input type="date" id="date-input"
            class="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg
                   px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                   focus:border-blue-500 transition-colors" />
        </div>

        <!-- Time slots -->
        <div id="slots-container" class="hidden">
          <label class="block text-sm font-medium text-slate-700 mb-1.5">
            Time <span class="text-red-500">*</span>
          </label>
          <div id="slots-loading" class="hidden py-4 text-center">
            <div class="inline-flex items-center gap-2 text-sm text-slate-500">
              <svg class="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Loading slots...
            </div>
          </div>
          <div id="slots-error" class="hidden text-sm text-red-600 py-2"></div>
          <div id="slots-grid"
            class="grid grid-cols-4 gap-2">
          </div>
          <div id="slots-time-warning" class="hidden mt-1.5 text-xs text-amber-600 flex items-center gap-1">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            <span id="slots-time-warning-text"></span>
          </div>
        </div>

        <!-- Duration -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1.5">
            Duration <span class="text-red-500">*</span>
          </label>
          <div class="flex flex-wrap gap-2" id="duration-group">
            <label class="duration-option flex items-center gap-2 cursor-pointer px-3.5 py-2 rounded-lg border
                          border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors
                          text-sm text-slate-700 has-[:checked]:bg-blue-600 has-[:checked]:border-blue-600
                          has-[:checked]:text-white">
              <input type="radio" name="duration" value="30" class="sr-only" />
              30 min
            </label>
            <label class="duration-option flex items-center gap-2 cursor-pointer px-3.5 py-2 rounded-lg border
                          border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors
                          text-sm text-slate-700 has-[:checked]:bg-blue-600 has-[:checked]:border-blue-600
                          has-[:checked]:text-white">
              <input type="radio" name="duration" value="60" class="sr-only" />
              1 h
            </label>
            <label class="duration-option flex items-center gap-2 cursor-pointer px-3.5 py-2 rounded-lg border
                          border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors
                          text-sm text-slate-700 has-[:checked]:bg-blue-600 has-[:checked]:border-blue-600
                          has-[:checked]:text-white">
              <input type="radio" name="duration" value="90" class="sr-only" />
              1.5 h
            </label>
            <label class="duration-option flex items-center gap-2 cursor-pointer px-3.5 py-2 rounded-lg border
                          border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors
                          text-sm text-slate-700 has-[:checked]:bg-blue-600 has-[:checked]:border-blue-600
                          has-[:checked]:text-white">
              <input type="radio" name="duration" value="custom" class="sr-only" />
              Custom
            </label>
          </div>
          <div id="custom-duration-wrapper" class="hidden mt-2">
            <input type="number" id="custom-duration-input" min="15" max="480" placeholder="Enter minutes (15–480)"
              class="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg
                     px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                     focus:border-blue-500 transition-colors" />
          </div>
        </div>

        <!-- Subject -->
        <div>
          <label for="subject-input" class="block text-sm font-medium text-slate-700 mb-1.5">
            Meeting Subject
            <span class="text-slate-400 font-normal text-xs ml-1">(optional)</span>
          </label>
          <input type="text" id="subject-input" placeholder="e.g. Sprint retrospective"
            class="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg
                   px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                   focus:border-blue-500 transition-colors" />
        </div>

        <!-- Validation errors -->
        <div id="form-error"
          class="hidden rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        </div>

        <!-- Submit -->
        <div class="pt-1">
          <button id="submit-btn" type="button"
            class="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50
                   disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 px-6 text-sm
                   transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            Book Meeting
          </button>
        </div>

        <!-- Success state (hidden initially) -->
        <div id="success-state" class="hidden">
          <div class="rounded-xl bg-green-50 border border-green-200 p-5 text-center">
            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <p class="text-green-800 font-semibold text-base mb-1">Meeting booked!</p>
            <p id="success-details" class="text-green-700 text-sm"></p>
          </div>
        </div>

        <!-- Loading overlay (shown while awaiting MCP result) -->
        <div id="loading-overlay" class="hidden">
          <div class="flex items-center justify-center gap-3 py-4">
            <svg class="animate-spin w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span class="text-sm text-slate-500">Processing...</span>
          </div>
        </div>

      </div><!-- /p-6 -->
    </div><!-- /card -->

    <!-- Legend -->
    <div class="mt-4 flex items-center gap-4 text-xs text-slate-400 px-1">
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-300"></span>
        Available
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm bg-slate-100 border border-slate-200"></span>
        Busy
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm bg-green-600 border border-green-700"></span>
        Selected
      </span>
    </div>
  </div><!-- /max-w-lg -->

  <!-- Main inline script -->
  <script>
  (function () {
    "use strict";

    var cfg = window.__BOOKING_CONFIG__ || {};
    var formId = cfg.formId || "booking-form";
    var baseUrl = (cfg.bookingServiceUrl || "http://localhost:3002").replace(/\\/$/, "");
    var initialValues = cfg.initialValues || {};

    // ── DOM refs ───────────────────────────────────────────────────────────────

    var colleagueSelect = document.getElementById("colleague-select");
    var dateInput = document.getElementById("date-input");
    var slotsContainer = document.getElementById("slots-container");
    var slotsGrid = document.getElementById("slots-grid");
    var slotsLoading = document.getElementById("slots-loading");
    var slotsError = document.getElementById("slots-error");
    var slotsTimeWarning = document.getElementById("slots-time-warning");
    var slotsTimeWarningText = document.getElementById("slots-time-warning-text");
    var customDurationWrapper = document.getElementById("custom-duration-wrapper");
    var customDurationInput = document.getElementById("custom-duration-input");
    var subjectInput = document.getElementById("subject-input");
    var submitBtn = document.getElementById("submit-btn");
    var formError = document.getElementById("form-error");
    var successState = document.getElementById("success-state");
    var successDetails = document.getElementById("success-details");
    var loadingOverlay = document.getElementById("loading-overlay");
    var colleagueWarning = document.getElementById("colleague-warning");
    var colleagueWarningText = document.getElementById("colleague-warning-text");

    // ── State ──────────────────────────────────────────────────────────────────

    var selectedTime = null;

    // ── Helpers ────────────────────────────────────────────────────────────────

    function getTomorrow() {
      var d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    }

    function showError(msg) {
      if (!formError) return;
      if (msg) {
        formError.textContent = msg;
        formError.classList.remove("hidden");
      } else {
        formError.classList.add("hidden");
        formError.textContent = "";
      }
    }

    function setLoading(loading) {
      if (slotsLoading) slotsLoading.style.display = loading ? "block" : "none";
      if (slotsError) slotsError.classList.add("hidden");
      if (slotsGrid) slotsGrid.style.display = loading ? "none" : "grid";
    }

    function notifyResize() {
      var height = document.body.scrollHeight;
      window.parent.postMessage({ type: "ui_resize", height: height }, "*");
    }

    function getDurationValue() {
      var radios = document.querySelectorAll('input[name="duration"]');
      for (var i = 0; i < radios.length; i++) {
        if (radios[i].checked) return radios[i].value;
      }
      return null;
    }

    function setDurationValue(val) {
      var radios = document.querySelectorAll('input[name="duration"]');
      for (var i = 0; i < radios.length; i++) {
        if (radios[i].value === val) {
          radios[i].checked = true;
          onDurationChange();
          return;
        }
      }
    }

    // ── Colleague loading ──────────────────────────────────────────────────────

    function loadColleagues() {
      return fetch(baseUrl + "/api/colleagues")
        .then(function (resp) {
          if (!resp.ok) throw new Error("HTTP " + resp.status);
          return resp.json();
        })
        .then(function (colleagues) {
          // Clear all options except placeholder
          while (colleagueSelect.options.length > 1) {
            colleagueSelect.remove(1);
          }

          colleagues.forEach(function (c) {
            var opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.name + " — " + c.role;
            opt.dataset.name = c.name;
            colleagueSelect.appendChild(opt);
          });

          // Apply initial value
          if (initialValues.colleague) {
            var matchById = Array.from(colleagueSelect.options).find(function (o) {
              return o.value === initialValues.colleague;
            });
            var matchByName = Array.from(colleagueSelect.options).find(function (o) {
              return (o.dataset.name || "").toLowerCase() === (initialValues.colleague || "").toLowerCase();
            });
            var match = matchById || matchByName;
            if (match) {
              colleagueSelect.value = match.value;
              // Hide warning if found
              if (colleagueWarning) colleagueWarning.classList.add("hidden");
            } else {
              // Show warning if not found
              if (colleagueWarning && colleagueWarningText) {
                colleagueWarningText.textContent =
                  'Colleague "' + initialValues.colleague + '" not found in the list';
                colleagueWarning.classList.remove("hidden");
              }
            }
          }
        })
        .catch(function (err) {
          console.error("[booking-form] Failed to load colleagues:", err);
          if (slotsError) {
            slotsError.textContent = "Failed to load colleagues";
            slotsError.classList.remove("hidden");
          }
        });
    }

    // ── Slot loading ───────────────────────────────────────────────────────────

    function loadSlots() {
      var colleagueId = colleagueSelect.value;
      var date = dateInput.value;

      selectedTime = null;

      if (!colleagueId) {
        if (slotsContainer) slotsContainer.classList.add("hidden");
        return Promise.resolve();
      }

      if (slotsContainer) slotsContainer.classList.remove("hidden");
      setLoading(true);
      if (slotsTimeWarning) slotsTimeWarning.classList.add("hidden");

      var params = "colleague=" + encodeURIComponent(colleagueId);
      if (date) params += "&date=" + encodeURIComponent(date);

      return fetch(baseUrl + "/api/slots?" + params)
        .then(function (resp) {
          if (!resp.ok) throw new Error("HTTP " + resp.status);
          return resp.json();
        })
        .then(function (data) {
          renderSlots(data.slots || []);

          // Apply initial time
          if (initialValues.time) {
            var btn = slotsGrid.querySelector('[data-time="' + initialValues.time + '"]');
            if (btn && !btn.disabled) {
              selectSlot(initialValues.time, btn);
            } else if (btn && btn.disabled) {
              btn.classList.add("slot-preselected-unavailable");
              if (slotsTimeWarning && slotsTimeWarningText) {
                slotsTimeWarningText.textContent =
                  "Slot " + initialValues.time + " is unavailable. Please choose a different time.";
                slotsTimeWarning.classList.remove("hidden");
              }
            }
            // Clear so it's only applied once
            initialValues.time = null;
          }
        })
        .catch(function (err) {
          console.error("[booking-form] Failed to load slots:", err);
          setLoading(false);
          if (slotsError) {
            slotsError.textContent = "Failed to load time slots";
            slotsError.classList.remove("hidden");
          }
        })
        .finally(function () {
          notifyResize();
        });
    }

    function renderSlots(slots) {
      slotsGrid.innerHTML = "";
      slots.forEach(function (slot) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.time = slot.time;
        btn.textContent = slot.time;

        if (!slot.available) {
          btn.disabled = true;
          btn.className = "slot-btn slot-unavailable";
          btn.title = "Slot unavailable";
        } else {
          btn.className = "slot-btn slot-available";
          btn.addEventListener("click", function () {
            selectSlot(slot.time, btn);
          });
        }
        slotsGrid.appendChild(btn);
      });
      setLoading(false);
    }

    function selectSlot(time, btn) {
      slotsGrid.querySelectorAll(".slot-btn.slot-selected").forEach(function (b) {
        b.classList.remove("slot-selected");
      });
      selectedTime = time;
      btn.classList.add("slot-selected");
      showError("");
    }

    // ── Duration handling ──────────────────────────────────────────────────────

    function onDurationChange() {
      var val = getDurationValue();
      var isCustom = val === "custom";
      if (customDurationWrapper) {
        customDurationWrapper.style.display = isCustom ? "block" : "none";
      }
      notifyResize();
    }

    // ── Validation ─────────────────────────────────────────────────────────────

    function validateForm() {
      var errors = [];

      var colleagueId = colleagueSelect.value;
      if (!colleagueId) errors.push("Please select a colleague");

      var date = dateInput.value;
      if (!date) {
        errors.push("Please specify a date");
      } else if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) {
        errors.push("Invalid date format (expected YYYY-MM-DD)");
      }

      if (!selectedTime) errors.push("Please select a meeting time");

      var durationVal = getDurationValue();
      var durationMinutes = null;

      if (!durationVal) {
        errors.push("Please select a duration");
      } else if (durationVal === "custom") {
        var custom = customDurationInput ? parseInt(customDurationInput.value, 10) : NaN;
        if (!custom || custom < 15 || custom > 480) {
          errors.push("Enter a valid duration (15–480 minutes)");
        } else {
          durationMinutes = custom;
        }
      } else {
        durationMinutes = parseInt(durationVal, 10);
      }

      if (errors.length > 0) {
        return { valid: false, errors: errors };
      }

      var selectedOption = colleagueSelect.options[colleagueSelect.selectedIndex];

      return {
        valid: true,
        values: {
          colleague: colleagueId,
          date: date,
          time: selectedTime,
          duration: durationMinutes,
          subject: subjectInput ? subjectInput.value.trim() : ""
        }
      };
    }

    // ── Submit ─────────────────────────────────────────────────────────────────

    submitBtn.addEventListener("click", function (e) {
      e.preventDefault();
      showError("");

      var result = validateForm();
      if (!result.valid) {
        showError(result.errors.join(". "));
        return;
      }

      // Show loading, disable submit
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
      if (loadingOverlay) loadingOverlay.classList.remove("hidden");

      window.parent.postMessage(
        {
          type: "mcp_tool_call",
          tool: "submit_booking_form",
          params: {
            formId: formId,
            values: result.values
          }
        },
        "*"
      );
    });

    // ── Listen for MCP result ──────────────────────────────────────────────────

    window.addEventListener("message", function (event) {
      var msg = event.data;
      if (!msg || msg.type !== "mcp_tool_result") return;

      if (loadingOverlay) loadingOverlay.classList.add("hidden");

      if (msg.result && msg.result.accepted === true) {
        // Show success
        submitBtn.style.display = "none";
        if (successState) {
          successState.classList.remove("hidden");
          var v = msg.result.values || {};
          if (successDetails) {
            successDetails.textContent =
              (v.date || "") + " at " + (v.time || "") +
              " with " + (v.colleague || "") +
              (v.subject ? ' — "' + v.subject + '"' : "");
          }
        }
        notifyResize();
      } else if (msg.result && msg.result.accepted === false) {
        // Re-enable submit, show errors
        submitBtn.disabled = false;
        submitBtn.textContent = "Book Meeting";
        var errors = Array.isArray(msg.result.errors)
          ? msg.result.errors.join(". ")
          : "Booking error";
        showError(errors);
      }
    });

    // ── Event wiring ───────────────────────────────────────────────────────────

    colleagueSelect.addEventListener("change", function () {
      loadSlots();
      notifyResize();
    });

    dateInput.addEventListener("change", function () {
      if (colleagueSelect.value) loadSlots();
      notifyResize();
    });

    var durationRadios = document.querySelectorAll('input[name="duration"]');
    durationRadios.forEach(function (radio) {
      radio.addEventListener("change", onDurationChange);
    });

    // ── Initialization ─────────────────────────────────────────────────────────

    // Default date = tomorrow
    dateInput.value = initialValues.date || getTomorrow();
    dateInput.min = new Date().toISOString().slice(0, 10);

    // Default duration = 30
    var initDuration = initialValues.duration || "30";
    setDurationValue(initDuration);

    if (customDurationInput && initialValues.customDuration) {
      customDurationInput.value = String(initialValues.customDuration);
    }

    if (subjectInput && initialValues.subject) {
      subjectInput.value = initialValues.subject;
    }

    // Load colleagues, then slots
    loadColleagues().then(function () {
      if (colleagueSelect.value) {
        return loadSlots();
      }
    }).then(function () {
      notifyResize();
      console.log("[booking-form] Initialized");
    });

  })();
  </script>

  <!-- External booking-form.js (demo: loads additional helper if available) -->
  <script>
    (function () {
      var cfg = window.__BOOKING_CONFIG__ || {};
      var externalJs = cfg.bookingJsUrl || "${bookingJsUrl}";
      if (externalJs) {
        var s = document.createElement("script");
        s.src = externalJs;
        s.onerror = function () {
          console.warn("[booking-form] External booking-form.js not loaded (this is OK)");
        };
        document.body.appendChild(s);
      }
    })();
  </script>
</body>
</html>`;
}
