/**
 * templates/bookingResult.ts
 *
 * Read-only result card for a completed (or failed) booking.
 * window.__BOOKING_RESULT__ is injected by the backend orchestrator.
 * No form submission — just displays the outcome.
 */

export function generateBookingResultHtml(): string {
  // Note: all JS inside uses string concatenation — no nested template literals.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Booking Result</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>body { margin: 0; padding: 0; background: #f8fafc; }<\/style>
  <script>window.__BOOKING_RESULT__ = {};<\/script>
</head>
<body class="bg-slate-50">
  <div id="root" class="max-w-lg mx-auto p-6"></div>

  <script>
  (function () {
    var d = window.__BOOKING_RESULT__ || {};
    var root = document.getElementById("root");

    function esc(s) {
      var div = document.createElement("div");
      div.textContent = String(s == null ? "" : s);
      return div.innerHTML;
    }

    function fmtDate(s) {
      if (!s) return "—";
      var p = s.split("-");
      return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : s;
    }

    function fmtDur(m) {
      if (!m) return "—";
      var h = Math.floor(m / 60), mn = m % 60;
      if (h === 0) return m + " min";
      return mn ? h + " h " + mn + " min" : h + " h";
    }

    function notifyResize() {
      window.parent.postMessage({ type: "ui_resize", height: document.body.scrollHeight }, "*");
    }

    // ── Icon fragments ───────────────────────────────────────────────────────────

    var icoCalendar =
      '<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
      ' d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>' +
      '</svg>';

    var icoClock =
      '<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
      ' d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
      '</svg>';

    var icoPerson =
      '<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
      ' d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>' +
      '</svg>';

    var icoMsg =
      '<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
      ' d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>' +
      '</svg>';

    var icoHash =
      '<svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>' +
      '</svg>';

    var icoWarn =
      '<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
      ' d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>' +
      '</svg>';

    // ── Helpers ──────────────────────────────────────────────────────────────────

    function detailRow(ico, label, value) {
      if (!value && value !== 0) return "";
      return (
        '<div class="flex items-start gap-3">' +
        '<div class="mt-0.5 w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">' + ico + '</div>' +
        '<div>' +
        '<p class="text-xs text-slate-400 mb-0.5">' + label + '</p>' +
        '<p class="text-sm font-semibold text-slate-800">' + esc(value) + '</p>' +
        '</div></div>'
      );
    }

    // ── Render ───────────────────────────────────────────────────────────────────

    if (d.success) {
      var bookingIdBadge = d.bookingId
        ? '<div class="border-t border-slate-100 pt-4">' +
          '<div class="bg-slate-50 rounded-lg px-4 py-2.5 flex items-center gap-2">' +
          icoHash +
          '<span class="text-xs text-slate-400">Booking ID:</span>' +
          '<span class="text-xs font-mono text-slate-600">' + esc(d.bookingId) + '</span>' +
          '</div></div>'
        : "";

      root.innerHTML =
        '<div class="mb-5">' +
          '<div class="flex items-center gap-3 mb-1">' +
            '<div class="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">' +
              '<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' +
            '</div>' +
            '<h1 class="text-xl font-bold text-slate-800">Meeting Booked</h1>' +
          '</div>' +
          '<p class="text-sm text-slate-500 ml-11">Invitations sent to all participants</p>' +
        '</div>' +
        '<div class="bg-white rounded-2xl shadow-sm border border-green-200 overflow-hidden">' +
          '<div class="h-1.5 bg-gradient-to-r from-green-400 to-emerald-500"></div>' +
          '<div class="p-6 space-y-4">' +
            detailRow(icoPerson, "Participant", d.colleagueName || d.colleague) +
            '<div class="border-t border-slate-100"></div>' +
            '<div class="grid grid-cols-2 gap-4">' +
              detailRow(icoCalendar, "Date", fmtDate(d.date)) +
              detailRow(icoClock, "Time", d.time) +
              detailRow(icoClock, "Duration", fmtDur(d.duration)) +
              detailRow(icoMsg, "Subject", d.subject) +
            '</div>' +
            bookingIdBadge +
          '</div>' +
        '</div>';

    } else {
      root.innerHTML =
        '<div class="mb-5">' +
          '<div class="flex items-center gap-3 mb-1">' +
            '<div class="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">' +
              '<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' +
            '</div>' +
            '<h1 class="text-xl font-bold text-slate-800">Booking Failed</h1>' +
          '</div>' +
          '<p class="text-sm text-slate-500 ml-11">Please adjust the details and try again</p>' +
        '</div>' +
        '<div class="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden">' +
          '<div class="h-1.5 bg-gradient-to-r from-red-400 to-rose-500"></div>' +
          '<div class="p-6">' +
            '<div class="flex items-start gap-4">' +
              '<div class="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center shrink-0 mt-0.5">' + icoWarn + '</div>' +
              '<div>' +
                '<p class="text-sm font-semibold text-red-800 mb-1">Reason</p>' +
                '<p class="text-sm text-red-700">' + esc(d.error || "The selected slot is unavailable") + '</p>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    setTimeout(notifyResize, 80);
  })();
  <\/script>
</body>
</html>`;
}
