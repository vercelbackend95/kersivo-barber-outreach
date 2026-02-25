import { e as createComponent, m as maybeRenderHead, k as renderComponent, r as renderTemplate } from '../chunks/astro/server_DbsSVQQ7.mjs';
import 'piccolore';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { fromZonedTime, formatInTimeZone, toZonedTime } from 'date-fns-tz';
/* empty css                                 */
/* empty css                                 */
/* empty css                                 */
export { renderers } from '../renderers.mjs';

function AdminLayout({ activeSection, onChangeSection, children }) {
  return /* @__PURE__ */ jsxs("div", { className: "admin-shell", children: [
    /* @__PURE__ */ jsxs("aside", { className: "admin-sidebar", "aria-label": "Admin sections", children: [
      /* @__PURE__ */ jsx("h1", { className: "admin-sidebar-title", children: "Admin" }),
      /* @__PURE__ */ jsxs("nav", { className: "admin-sidebar-nav", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: `admin-sidebar-link ${activeSection === "bookings" ? "admin-sidebar-link--active" : ""}`,
            onClick: () => onChangeSection("bookings"),
            children: "Bookings"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: `admin-sidebar-link ${activeSection === "shop" ? "admin-sidebar-link--active" : ""}`,
            onClick: () => onChangeSection("shop"),
            children: "Shop"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx("section", { className: "admin-main-content", children })
  ] });
}

const ADMIN_TIMEZONE = "Europe/London";
const SLOT_STEP_MINUTES = 15;
const POLL_INTERVAL_MS = 15e3;
const LAST_UPDATED_REFRESH_MS = 1e3;
const UPDATED_ROW_HIGHLIGHT_MS = 2e3;
function getTodayLondonDate() {
  return formatInTimeZone(/* @__PURE__ */ new Date(), ADMIN_TIMEZONE, "yyyy-MM-dd");
}
function shiftLondonDate(date, days) {
  const atMidnight = fromZonedTime(`${date}T00:00:00.000`, ADMIN_TIMEZONE);
  return formatInTimeZone(new Date(atMidnight.getTime() + days * 24 * 60 * 60 * 1e3), ADMIN_TIMEZONE, "yyyy-MM-dd");
}
function getHistoryPresetDates(preset) {
  const today = getTodayLondonDate();
  if (preset === "overall") return { from: "", to: "" };
  if (preset === "last30") return { from: shiftLondonDate(today, -30), to: today };
  return { from: shiftLondonDate(today, -7), to: today };
}
function formatRelativeTime(startAt, endAt) {
  const nowMs = Date.now();
  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();
  if (nowMs >= startMs && nowMs < endMs) return "now";
  const diffMs = startMs - nowMs;
  if (diffMs <= 0) return "now";
  const diffMin = Math.floor(diffMs / 6e4);
  if (diffMin < 60) return `in ${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return mins ? `in ${hours}h ${mins}m` : `in ${hours}h`;
}
function formatStartTime(startAt) {
  return new Date(startAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: ADMIN_TIMEZONE });
}
function getUpcomingBookings(bookings) {
  const nowMs = Date.now();
  return bookings.filter((b) => b.status === "CONFIRMED").filter((b) => new Date(b.endAt).getTime() > nowMs).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}
function formatLastUpdated(lastUpdatedAt, nowMs) {
  if (!lastUpdatedAt) return "never";
  const diffSec = Math.floor((nowMs - lastUpdatedAt) / 1e3);
  if (diffSec <= 4) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  return `${Math.floor(diffSec / 60)}m ago`;
}
const normalizeSearchValue = (value) => value.trim().toLowerCase();
const isCancelledStatus = (status) => status.startsWith("CANCELLED");
const canBeCancelledByShop = (booking) => booking.status === "CONFIRMED";
function getBookingSearchScore(booking, normalizedQuery) {
  const email = normalizeSearchValue(booking.email ?? "");
  const fullName = normalizeSearchValue(booking.fullName ?? "");
  if (email === normalizedQuery) return 6;
  if (email.startsWith(normalizedQuery)) return 5;
  if (email.includes(normalizedQuery)) return 4;
  if (fullName === normalizedQuery) return 3;
  if (fullName.startsWith(normalizedQuery)) return 2;
  if (fullName.includes(normalizedQuery)) return 1;
  return 0;
}
function matchesTabFilter(booking, activeFilter) {
  if (activeFilter === "confirmed") return booking.status === "CONFIRMED" && !booking.rescheduledAt;
  if (activeFilter === "rescheduled") return booking.status === "CONFIRMED" && Boolean(booking.rescheduledAt);
  if (activeFilter === "pending") return booking.status === "PENDING_CONFIRMATION";
  return isCancelledStatus(booking.status);
}
function roundUpLondon(now, stepMinutes = SLOT_STEP_MINUTES) {
  const zoned = toZonedTime(now, ADMIN_TIMEZONE);
  const year = zoned.getFullYear();
  const month = zoned.getMonth();
  const day = zoned.getDate();
  const hours = zoned.getHours();
  const minutes = zoned.getMinutes();
  const rounded = Math.ceil(minutes / stepMinutes) * stepMinutes;
  return fromZonedTime(new Date(year, month, day, hours, rounded, 0, 0), ADMIN_TIMEZONE);
}
function formatLocalInputValue(date) {
  return formatInTimeZone(date, ADMIN_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}
function formatBlockRange(startAt, endAt) {
  return `${new Date(startAt).toLocaleString("en-GB", { timeZone: ADMIN_TIMEZONE })} → ${new Date(endAt).toLocaleString("en-GB", { timeZone: ADMIN_TIMEZONE })}`;
}
function nextLunchWindow(now) {
  const zonedNow = toZonedTime(now, ADMIN_TIMEZONE);
  const noon = fromZonedTime(new Date(zonedNow.getFullYear(), zonedNow.getMonth(), zonedNow.getDate(), 12, 0, 0, 0), ADMIN_TIMEZONE);
  if (now < noon) return { startAt: noon, endAt: new Date(noon.getTime() + 30 * 6e4) };
  const startAt = roundUpLondon(now, SLOT_STEP_MINUTES);
  return { startAt, endAt: new Date(startAt.getTime() + 30 * 6e4) };
}
function BookingsAdminPanel({ isActive }) {
  const [secret, setSecret] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [timeBlocks, setTimeBlocks] = useState([]);
  const [error, setError] = useState("");
  const [updatedBookingIds, setUpdatedBookingIds] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("confirmed");
  const [activeView, setActiveView] = useState("today");
  const [activeSection, setActiveSection] = useState("bookings");
  const [historyBarberId, setHistoryBarberId] = useState("all");
  const [historyPreset, setHistoryPreset] = useState("last7");
  const [historyFrom, setHistoryFrom] = useState(() => getHistoryPresetDates("last7").from);
  const [historyTo, setHistoryTo] = useState(() => getHistoryPresetDates("last7").to);
  const [historyCursor, setHistoryCursor] = useState(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [reports, setReports] = useState(null);
  const [reportsError, setReportsError] = useState("");
  const [cancelSuccessMessage, setCancelSuccessMessage] = useState("");
  const [cancelErrorMessage, setCancelErrorMessage] = useState("");
  const [cancelLoadingBookingId, setCancelLoadingBookingId] = useState(null);
  const [blockScopeBarberId, setBlockScopeBarberId] = useState("all");
  const [blockSuccessMessage, setBlockSuccessMessage] = useState("");
  const [blockErrorMessage, setBlockErrorMessage] = useState("");
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayStartInput, setHolidayStartInput] = useState(() => formatLocalInputValue(roundUpLondon(/* @__PURE__ */ new Date(), SLOT_STEP_MINUTES)));
  const [holidayEndInput, setHolidayEndInput] = useState(() => formatLocalInputValue(new Date(roundUpLondon(/* @__PURE__ */ new Date(), SLOT_STEP_MINUTES).getTime() + 30 * 6e4)));
  const [holidayAllDay, setHolidayAllDay] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [clientProfile, setClientProfile] = useState(null);
  const [isClientLoading, setIsClientLoading] = useState(false);
  const [clientError, setClientError] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const inFlightRef = useRef(false);
  const pollingStoppedRef = useRef(false);
  const previousSignaturesRef = useRef(/* @__PURE__ */ new Map());
  const updatedRowsTimeoutRef = useRef(null);
  const fetchTimeBlocks = useCallback(async () => {
    const response = await fetch("/api/admin/timeblocks?range=today", { credentials: "same-origin" });
    if (response.ok) {
      const data = await response.json();
      setTimeBlocks(data.timeBlocks ?? []);
    }
  }, []);
  const fetchBarbers = useCallback(async () => {
    const response = await fetch("/api/admin/barbers", { credentials: "same-origin" });
    if (response.ok) {
      const data = await response.json();
      setBarbers(data.barbers ?? []);
    }
  }, []);
  const fetchReports = useCallback(async () => {
    if (!loggedIn) return;
    setReportsError("");
    const response = await fetch("/api/admin/reports?range=week", { credentials: "same-origin" });
    if (response.status === 401) {
      pollingStoppedRef.current = true;
      setLoggedIn(false);
      setError("Session expired. Please log in again.");
      return;
    }
    if (!response.ok) {
      setReportsError("Could not load reports right now.");
      return;
    }
    const data = await response.json();
    setReports(data);
  }, [loggedIn]);
  const fetchBookings = useCallback(async (appendHistory = false) => {
    if (!loggedIn || !isActive || pollingStoppedRef.current || inFlightRef.current) return;
    if (activeView === "history" && !appendHistory) setHistoryCursor(null);
    inFlightRef.current = true;
    setIsRefreshing(true);
    try {
      const endpoint = (() => {
        if (activeView === "today") return "/api/admin/bookings?range=today";
        if (activeView === "all") return "/api/admin/bookings";
        const params = new URLSearchParams({ view: "history", barberId: historyBarberId, limit: "50" });
        if (historyPreset !== "custom") params.set("preset", historyPreset);
        if (historyFrom) params.set("from", historyFrom);
        if (historyTo) params.set("to", historyTo);
        if (appendHistory && historyCursor) params.set("cursor", historyCursor);
        return `/api/admin/bookings?${params.toString()}`;
      })();
      const response = await fetch(endpoint, { credentials: "same-origin" });
      if (response.status === 401) {
        pollingStoppedRef.current = true;
        setLoggedIn(false);
        setError("Session expired. Please log in again.");
        return;
      }
      if (!response.ok) throw new Error("Fetch failed");
      const data = await response.json();
      const incomingBookings = data.bookings ?? [];
      const mergedBookings = appendHistory ? [...bookings, ...incomingBookings] : incomingBookings;
      const nextSignatures = new Map(mergedBookings.map((b) => [b.id, [b.id, b.fullName, b.email, b.status, b.startAt, b.endAt, b.rescheduledAt ?? "", b.barber?.name ?? "", b.service?.name ?? "", b.clientId ?? ""].join("|")]));
      const changedIds = mergedBookings.filter((b) => previousSignaturesRef.current.get(b.id) !== nextSignatures.get(b.id)).map((b) => b.id);
      setBookings(mergedBookings);
      if (activeView === "history") {
        setHistoryHasMore(Boolean(data.hasMore));
        setHistoryCursor(data.cursor ?? null);
      }
      previousSignaturesRef.current = nextSignatures;
      setLastUpdatedAt(Date.now());
      if (changedIds.length) {
        setUpdatedBookingIds(changedIds);
        if (updatedRowsTimeoutRef.current) window.clearTimeout(updatedRowsTimeoutRef.current);
        updatedRowsTimeoutRef.current = window.setTimeout(() => setUpdatedBookingIds([]), UPDATED_ROW_HIGHLIGHT_MS);
      }
    } catch {
      setError("Could not refresh bookings right now.");
    } finally {
      inFlightRef.current = false;
      setIsRefreshing(false);
      setHistoryLoadingMore(false);
    }
  }, [activeView, bookings, historyBarberId, historyCursor, historyFrom, historyPreset, historyTo, loggedIn]);
  const loadMoreHistory = useCallback(async () => {
    if (!historyHasMore || historyLoadingMore || activeView !== "history") return;
    setHistoryLoadingMore(true);
    await fetchBookings(true);
  }, [activeView, fetchBookings, historyHasMore, historyLoadingMore]);
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/admin/session", { credentials: "same-origin" });
        setLoggedIn(response.ok);
      } finally {
        setIsCheckingSession(false);
      }
    })();
  }, []);
  useEffect(() => {
    if (!loggedIn || !isActive) return;
    if (activeView !== "history") void fetchBookings();
    void fetchBarbers();
    void fetchTimeBlocks();
    void fetchReports();
    const id = window.setInterval(() => {
      if (activeView !== "history") void fetchBookings();
      void fetchTimeBlocks();
      void fetchReports();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [activeView, fetchBookings, fetchBarbers, fetchReports, fetchTimeBlocks, isActive, loggedIn]);
  useEffect(() => {
    if (!loggedIn || !isActive) return;
    const id = window.setInterval(() => setNowMs(Date.now()), LAST_UPDATED_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [isActive, loggedIn]);
  useEffect(() => {
    if (!loggedIn || !isActive || activeView !== "history") return;
    const timeoutId = window.setTimeout(() => {
      void fetchBookings();
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [activeView, fetchBookings, historyBarberId, historyFrom, historyPreset, historyTo, isActive, loggedIn]);
  const normalizedClientSearchQuery = useMemo(() => normalizeSearchValue(clientSearchQuery), [clientSearchQuery]);
  const upcomingBookings = useMemo(() => getUpcomingBookings(bookings), [bookings]);
  const nextBooking = upcomingBookings[0] ?? null;
  const filteredBookings = useMemo(() => bookings.filter((b) => matchesTabFilter(b, activeFilter)), [bookings, activeFilter]);
  const visibleBookings = useMemo(() => {
    if (!normalizedClientSearchQuery) return filteredBookings;
    return filteredBookings.map((booking, index) => ({ booking, score: getBookingSearchScore(booking, normalizedClientSearchQuery), index })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score).map((entry) => entry.booking);
  }, [filteredBookings, normalizedClientSearchQuery]);
  async function openClientProfile(clientId) {
    if (!clientId) return;
    setSelectedClientId(clientId);
    setIsClientLoading(true);
    setClientError("");
    const response = await fetch(`/api/admin/clients/${clientId}`, { credentials: "same-origin" });
    if (!response.ok) {
      setClientError("Could not load client profile.");
      setIsClientLoading(false);
      return;
    }
    const payload = await response.json();
    setClientProfile(payload);
    setNotesDraft(payload.client.notes ?? "");
    setIsClientLoading(false);
  }
  async function saveNotes() {
    if (!selectedClientId) return;
    setNotesSaving(true);
    const response = await fetch(`/api/admin/clients/${selectedClientId}/notes`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notes: notesDraft })
    });
    if (response.ok && clientProfile) {
      setClientProfile({ ...clientProfile, client: { ...clientProfile.client, notes: notesDraft } });
    }
    setNotesSaving(false);
  }
  async function login() {
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret }) });
    setLoggedIn(res.ok);
    if (!res.ok) setError("Invalid secret");
  }
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    setBookings([]);
    setLoggedIn(false);
  }
  async function cancelBookingByShop(booking) {
    setCancelLoadingBookingId(booking.id);
    const response = await fetch("/api/admin/bookings/cancel", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookingId: booking.id }) });
    if (response.ok) {
      setCancelSuccessMessage("Booking cancelled successfully.");
      await fetchBookings();
    } else {
      setCancelErrorMessage("Could not cancel booking right now.");
    }
    setCancelLoadingBookingId(null);
  }
  async function createTimeBlock(title, startAt, endAt) {
    setBlockErrorMessage("");
    setBlockSuccessMessage("");
    const response = await fetch("/api/admin/timeblocks/create", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, startAt: startAt.toISOString(), endAt: endAt.toISOString(), barberId: blockScopeBarberId === "all" ? null : blockScopeBarberId })
    });
    if (!response.ok) {
      setBlockErrorMessage("Could not create time block.");
      return;
    }
    setBlockSuccessMessage("Time block created.");
    await Promise.all([fetchBookings(), fetchTimeBlocks()]);
  }
  async function handleQuickBlock30() {
    const startAt = roundUpLondon(/* @__PURE__ */ new Date(), SLOT_STEP_MINUTES);
    const endAt = new Date(startAt.getTime() + 30 * 6e4);
    await createTimeBlock("Blocked", startAt, endAt);
  }
  async function handleQuickLunch() {
    const { startAt, endAt } = nextLunchWindow(/* @__PURE__ */ new Date());
    await createTimeBlock("Lunch", startAt, endAt);
  }
  async function submitHoliday(event) {
    event.preventDefault();
    const startAt = holidayAllDay ? fromZonedTime(/* @__PURE__ */ new Date(`${holidayStartInput.slice(0, 10)}T00:00:00`), ADMIN_TIMEZONE) : fromZonedTime(new Date(holidayStartInput), ADMIN_TIMEZONE);
    const endAt = holidayAllDay ? fromZonedTime(/* @__PURE__ */ new Date(`${holidayEndInput.slice(0, 10)}T23:59:00`), ADMIN_TIMEZONE) : fromZonedTime(new Date(holidayEndInput), ADMIN_TIMEZONE);
    await createTimeBlock("Holiday", startAt, endAt);
    setShowHolidayModal(false);
  }
  async function deleteTimeBlock(id) {
    setBlockErrorMessage("");
    setBlockSuccessMessage("");
    const response = await fetch("/api/admin/timeblocks/delete", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id })
    });
    if (!response.ok) {
      setBlockErrorMessage("Could not remove time block.");
      return;
    }
    setBlockSuccessMessage("Time block removed.");
    await Promise.all([fetchBookings(), fetchTimeBlocks()]);
  }
  if (!isActive) return null;
  if (isCheckingSession) return /* @__PURE__ */ jsxs("section", { className: "surface booking-shell", children: [
    /* @__PURE__ */ jsx("h1", { children: "Admin" }),
    /* @__PURE__ */ jsx("p", { className: "muted", children: "Checking session…" })
  ] });
  if (!loggedIn) return /* @__PURE__ */ jsxs("section", { className: "surface booking-shell", children: [
    /* @__PURE__ */ jsx("h1", { children: "Admin" }),
    /* @__PURE__ */ jsx("label", { children: "Admin secret" }),
    /* @__PURE__ */ jsx("input", { type: "password", value: secret, onChange: (e) => setSecret(e.target.value) }),
    /* @__PURE__ */ jsx("button", { className: "btn btn--primary", onClick: login, children: "Login" }),
    error && /* @__PURE__ */ jsx("p", { children: error })
  ] });
  return /* @__PURE__ */ jsxs("section", { className: "surface booking-shell", children: [
    /* @__PURE__ */ jsx("h1", { children: "Admin Dashboard" }),
    /* @__PURE__ */ jsxs("div", { className: "admin-next-block", children: [
      /* @__PURE__ */ jsx("p", { className: "admin-next-primary", children: activeView === "today" ? `Today: ${bookings.length} bookings` : activeView === "all" ? `All: ${bookings.length} bookings` : `History: ${bookings.length} bookings` }),
      nextBooking && activeView !== "history" && /* @__PURE__ */ jsxs("p", { className: "admin-next-secondary", children: [
        "Next: ",
        nextBooking.barber?.name,
        " — ",
        nextBooking.service?.name,
        " — ",
        formatStartTime(nextBooking.startAt),
        " (",
        formatRelativeTime(nextBooking.startAt, nextBooking.endAt),
        ")"
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "admin-refresh-row", children: [
      /* @__PURE__ */ jsxs("p", { className: "muted admin-last-updated", children: [
        "Last updated: ",
        formatLastUpdated(lastUpdatedAt, nowMs)
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "admin-refresh-controls", children: [
        /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--ghost", onClick: () => {
          void fetchBookings();
          void fetchTimeBlocks();
          void fetchReports();
        }, disabled: isRefreshing, children: "Refresh" }),
        /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--secondary", onClick: () => void logout(), children: "Logout" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "admin-view-tabs", role: "tablist", "aria-label": "Admin sections", children: [
      /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${activeSection === "bookings" ? "admin-filter-tab--active" : ""}`, onClick: () => setActiveSection("bookings"), children: "Bookings" }),
      /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${activeSection === "reports" ? "admin-filter-tab--active" : ""}`, onClick: () => setActiveSection("reports"), children: "Reports" })
    ] }),
    cancelSuccessMessage && /* @__PURE__ */ jsx("p", { className: "admin-inline-success", children: cancelSuccessMessage }),
    cancelErrorMessage && /* @__PURE__ */ jsx("p", { className: "admin-inline-error", children: cancelErrorMessage }),
    activeSection === "bookings" && /* @__PURE__ */ jsxs(Fragment, { children: [
      activeView === "today" && /* @__PURE__ */ jsxs("section", { className: "admin-quick-blocks", children: [
        /* @__PURE__ */ jsx("h2", { children: "Quick blocks" }),
        /* @__PURE__ */ jsxs("div", { className: "admin-quick-scope", children: [
          /* @__PURE__ */ jsx("label", { htmlFor: "block-scope", children: "Applies to" }),
          /* @__PURE__ */ jsxs("select", { id: "block-scope", value: blockScopeBarberId, onChange: (event) => setBlockScopeBarberId(event.target.value), children: [
            /* @__PURE__ */ jsx("option", { value: "all", children: "All barbers" }),
            barbers.map((barber) => /* @__PURE__ */ jsx("option", { value: barber.id, children: barber.name }, barber.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "admin-quick-actions", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--secondary", onClick: () => void handleQuickBlock30(), children: "Block 30 min" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--secondary", onClick: () => void handleQuickLunch(), children: "Lunch" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--secondary", onClick: () => setShowHolidayModal(true), children: "Holiday" })
        ] }),
        blockSuccessMessage && /* @__PURE__ */ jsx("p", { className: "admin-inline-success", children: blockSuccessMessage }),
        blockErrorMessage && /* @__PURE__ */ jsx("p", { className: "admin-inline-error", children: blockErrorMessage }),
        /* @__PURE__ */ jsx("h3", { children: "Today's blocks" }),
        /* @__PURE__ */ jsx("ul", { className: "admin-blocks-list", children: timeBlocks.length === 0 ? /* @__PURE__ */ jsx("li", { className: "muted", children: "No blocks yet." }) : timeBlocks.map((block) => /* @__PURE__ */ jsxs("li", { children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("strong", { children: block.title }),
            /* @__PURE__ */ jsxs("p", { className: "muted", children: [
              block.barber?.name ?? "All barbers",
              " · ",
              formatBlockRange(block.startAt, block.endAt)
            ] })
          ] }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--ghost", onClick: () => void deleteTimeBlock(block.id), children: "Remove" })
        ] }, block.id)) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "admin-view-tabs admin-view-tabs--three", role: "tablist", "aria-label": "Admin views", children: [
        /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${activeView === "today" ? "admin-filter-tab--active" : ""}`, onClick: () => setActiveView("today"), children: "Today" }),
        /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${activeView === "all" ? "admin-filter-tab--active" : ""}`, onClick: () => setActiveView("all"), children: "All bookings" }),
        /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${activeView === "history" ? "admin-filter-tab--active" : ""}`, onClick: () => setActiveView("history"), children: "History" })
      ] }),
      activeView === "history" && /* @__PURE__ */ jsxs("section", { className: "admin-history-filters", children: [
        /* @__PURE__ */ jsxs("div", { className: "admin-history-row", children: [
          /* @__PURE__ */ jsx("label", { htmlFor: "history-barber", children: "Barber" }),
          /* @__PURE__ */ jsxs("select", { id: "history-barber", value: historyBarberId, onChange: (event) => setHistoryBarberId(event.target.value), children: [
            /* @__PURE__ */ jsx("option", { value: "all", children: "All barbers" }),
            barbers.map((barber) => /* @__PURE__ */ jsx("option", { value: barber.id, children: barber.name }, barber.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "admin-filter-tabs admin-filter-tabs--history", role: "tablist", "aria-label": "History range presets", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${historyPreset === "last7" ? "admin-filter-tab--active" : ""}`, onClick: () => {
            const next = getHistoryPresetDates("last7");
            setHistoryPreset("last7");
            setHistoryFrom(next.from);
            setHistoryTo(next.to);
          }, children: "Last 7 days" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${historyPreset === "last30" ? "admin-filter-tab--active" : ""}`, onClick: () => {
            const next = getHistoryPresetDates("last30");
            setHistoryPreset("last30");
            setHistoryFrom(next.from);
            setHistoryTo(next.to);
          }, children: "Last 30 days" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${historyPreset === "overall" ? "admin-filter-tab--active" : ""}`, onClick: () => {
            const next = getHistoryPresetDates("overall");
            setHistoryPreset("overall");
            setHistoryFrom(next.from);
            setHistoryTo(next.to);
          }, children: "Overall" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${historyPreset === "custom" ? "admin-filter-tab--active" : ""}`, onClick: () => setHistoryPreset("custom"), children: "Custom" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "admin-history-date-grid", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { htmlFor: "history-from", children: "From" }),
            /* @__PURE__ */ jsx("input", { id: "history-from", type: "date", value: historyFrom, onChange: (event) => {
              setHistoryFrom(event.target.value);
              setHistoryPreset("custom");
            } })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { htmlFor: "history-to", children: "To" }),
            /* @__PURE__ */ jsx("input", { id: "history-to", type: "date", value: historyTo, onChange: (event) => {
              setHistoryTo(event.target.value);
              setHistoryPreset("custom");
            } })
          ] }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--secondary", onClick: () => void fetchBookings(), children: "Apply" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "admin-filter-tabs", role: "tablist", "aria-label": "Booking status filters", children: [
        /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${activeFilter === "confirmed" ? "admin-filter-tab--active" : ""}`, onClick: () => setActiveFilter("confirmed"), children: "Confirmed" }),
        /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${activeFilter === "rescheduled" ? "admin-filter-tab--active" : ""}`, onClick: () => setActiveFilter("rescheduled"), children: "Rescheduled" }),
        /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${activeFilter === "pending" ? "admin-filter-tab--active" : ""}`, onClick: () => setActiveFilter("pending"), children: "Pending" }),
        /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${activeFilter === "cancelled" ? "admin-filter-tab--active" : ""}`, onClick: () => setActiveFilter("cancelled"), children: "Cancelled" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "admin-search-row", children: /* @__PURE__ */ jsx("input", { type: "search", value: clientSearchQuery, onChange: (e) => setClientSearchQuery(e.target.value), placeholder: "Search by client name or email…", "aria-label": "Search by client name or email" }) }),
      /* @__PURE__ */ jsxs("table", { className: "admin-table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Client" }),
          /* @__PURE__ */ jsx("th", { children: "Email" }),
          /* @__PURE__ */ jsx("th", { children: "Service" }),
          /* @__PURE__ */ jsx("th", { children: "Barber" }),
          /* @__PURE__ */ jsx("th", { children: "Status" }),
          /* @__PURE__ */ jsx("th", { children: "Start" }),
          /* @__PURE__ */ jsx("th", { children: "Actions" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: visibleBookings.map((booking) => /* @__PURE__ */ jsxs("tr", { className: updatedBookingIds.includes(booking.id) ? "admin-row--updated" : "", children: [
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("button", { type: "button", className: "admin-link-button", onClick: () => void openClientProfile(booking.clientId), children: booking.fullName }) }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("button", { type: "button", className: "admin-link-button", onClick: () => void openClientProfile(booking.clientId), children: booking.email }) }),
          /* @__PURE__ */ jsx("td", { children: booking.service?.name }),
          /* @__PURE__ */ jsx("td", { children: booking.barber?.name }),
          /* @__PURE__ */ jsx("td", { children: booking.status === "CONFIRMED" && booking.rescheduledAt ? "CONFIRMED · RESCHEDULED" : booking.status }),
          /* @__PURE__ */ jsx("td", { children: new Date(booking.startAt).toLocaleString("en-GB", { timeZone: ADMIN_TIMEZONE }) }),
          /* @__PURE__ */ jsx("td", { children: canBeCancelledByShop(booking) ? /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--secondary admin-cancel-btn", onClick: () => void cancelBookingByShop(booking), disabled: cancelLoadingBookingId === booking.id, children: cancelLoadingBookingId === booking.id ? "Cancelling…" : "Cancel" }) : null })
        ] }, booking.id)) })
      ] }),
      activeView === "history" && historyHasMore && /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--secondary", onClick: () => void loadMoreHistory(), disabled: historyLoadingMore, children: historyLoadingMore ? "Loading…" : "Load more" })
    ] }),
    activeSection === "reports" && /* @__PURE__ */ jsxs("section", { className: "admin-reports", "aria-live": "polite", children: [
      /* @__PURE__ */ jsx("h2", { children: "Reports" }),
      /* @__PURE__ */ jsx("p", { className: "muted", children: "This week (Europe/London)" }),
      reportsError && /* @__PURE__ */ jsx("p", { className: "admin-inline-error", children: reportsError }),
      /* @__PURE__ */ jsxs("div", { className: "admin-reports-grid", children: [
        /* @__PURE__ */ jsxs("article", { className: "admin-kpi-card", children: [
          /* @__PURE__ */ jsx("p", { className: "admin-kpi-label", children: "Bookings this week" }),
          /* @__PURE__ */ jsx("p", { className: "admin-kpi-value", children: reports?.bookingsThisWeek ?? 0 })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "admin-kpi-card", children: [
          /* @__PURE__ */ jsx("p", { className: "admin-kpi-label", children: "Cancelled rate" }),
          /* @__PURE__ */ jsx("p", { className: "admin-kpi-value", children: `${(reports?.cancelledRate ?? 0).toFixed(1)}%` })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "admin-kpi-card", children: [
          /* @__PURE__ */ jsx("p", { className: "admin-kpi-label", children: "Most popular service" }),
          /* @__PURE__ */ jsx("p", { className: "admin-kpi-value", children: reports?.mostPopularService ? `${reports.mostPopularService.name} (${reports.mostPopularService.count})` : "No confirmed bookings" })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "admin-kpi-card", children: [
          /* @__PURE__ */ jsx("p", { className: "admin-kpi-label", children: "Busiest barber" }),
          /* @__PURE__ */ jsx("p", { className: "admin-kpi-value", children: reports?.busiestBarber ? `${reports.busiestBarber.name} (${reports.busiestBarber.count})` : "No confirmed bookings" })
        ] })
      ] })
    ] }),
    showHolidayModal && /* @__PURE__ */ jsx("div", { className: "admin-client-modal-backdrop", role: "presentation", onClick: () => setShowHolidayModal(false), children: /* @__PURE__ */ jsxs("form", { className: "admin-client-modal", onSubmit: (event) => void submitHoliday(event), onClick: (event) => event.stopPropagation(), children: [
      /* @__PURE__ */ jsxs("div", { className: "admin-client-modal-head", children: [
        /* @__PURE__ */ jsx("h2", { children: "Holiday block" }),
        /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--ghost", onClick: () => setShowHolidayModal(false), children: "Close" })
      ] }),
      /* @__PURE__ */ jsx("label", { htmlFor: "holiday-start", children: "Start" }),
      /* @__PURE__ */ jsx("input", { id: "holiday-start", type: "datetime-local", value: holidayStartInput, onChange: (event) => setHolidayStartInput(event.target.value), required: true }),
      /* @__PURE__ */ jsx("label", { htmlFor: "holiday-end", children: "End" }),
      /* @__PURE__ */ jsx("input", { id: "holiday-end", type: "datetime-local", value: holidayEndInput, onChange: (event) => setHolidayEndInput(event.target.value), required: true }),
      /* @__PURE__ */ jsxs("label", { children: [
        /* @__PURE__ */ jsx("input", { type: "checkbox", checked: holidayAllDay, onChange: (event) => setHolidayAllDay(event.target.checked) }),
        " All day"
      ] }),
      /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn--primary", children: "Create holiday block" })
    ] }) }),
    selectedClientId && /* @__PURE__ */ jsx("div", { className: "admin-client-modal-backdrop", role: "presentation", onClick: () => setSelectedClientId(null), children: /* @__PURE__ */ jsxs("div", { className: "admin-client-modal", role: "dialog", "aria-modal": "true", "aria-label": "Client profile", onClick: (event) => event.stopPropagation(), children: [
      /* @__PURE__ */ jsxs("div", { className: "admin-client-modal-head", children: [
        /* @__PURE__ */ jsx("h2", { children: "Client profile" }),
        /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--ghost", onClick: () => setSelectedClientId(null), children: "Close" })
      ] }),
      isClientLoading && /* @__PURE__ */ jsx("p", { className: "muted", children: "Loading…" }),
      clientError && /* @__PURE__ */ jsx("p", { className: "admin-inline-error", children: clientError }),
      clientProfile && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("p", { children: [
          /* @__PURE__ */ jsx("strong", { children: clientProfile.client.fullName || "Unnamed client" }),
          /* @__PURE__ */ jsx("br", {}),
          clientProfile.client.email,
          /* @__PURE__ */ jsx("br", {}),
          clientProfile.client.phone || "No phone"
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "admin-client-stats", children: [
          /* @__PURE__ */ jsxs("p", { children: [
            "Total visits: ",
            clientProfile.stats.totalBookings
          ] }),
          /* @__PURE__ */ jsxs("p", { children: [
            "Last visit: ",
            clientProfile.stats.lastBookingAt ? new Date(clientProfile.stats.lastBookingAt).toLocaleString("en-GB", { timeZone: ADMIN_TIMEZONE }) : "—"
          ] }),
          /* @__PURE__ */ jsxs("p", { children: [
            "Cancelled: ",
            clientProfile.stats.cancelledCount
          ] })
        ] }),
        /* @__PURE__ */ jsx("h3", { children: "Recent bookings" }),
        /* @__PURE__ */ jsx("ul", { className: "admin-client-bookings", children: clientProfile.recentBookings.map((item) => /* @__PURE__ */ jsxs("li", { children: [
          new Date(item.startAt).toLocaleString("en-GB", { timeZone: ADMIN_TIMEZONE }),
          " · ",
          item.status,
          " · ",
          item.service?.name,
          " · ",
          item.barber?.name
        ] }, item.id)) }),
        /* @__PURE__ */ jsx("label", { htmlFor: "client-notes", children: "Notes" }),
        /* @__PURE__ */ jsx("textarea", { id: "client-notes", value: notesDraft, onChange: (event) => setNotesDraft(event.target.value), rows: 5 }),
        /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--primary", onClick: () => void saveNotes(), disabled: notesSaving, children: notesSaving ? "Saving…" : "Save notes" })
      ] })
    ] }) })
  ] });
}

const EMPTY_FORM = {
  name: "",
  description: "",
  priceGbp: "",
  imageUrl: "",
  active: true,
  featured: false,
  sortOrder: 0
};
function formatPrice(pricePence) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pricePence / 100);
}
function penceFromGbp(value) {
  const normalized = value.replace(/,/g, ".").trim();
  if (!normalized) return 0;
  const numeric = Number.parseFloat(normalized);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}
function getCurrentYmdInLondon() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(/* @__PURE__ */ new Date());
}
function getRangeDates(preset) {
  const days = Number(preset);
  const today = /* @__PURE__ */ new Date();
  const to = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(today);
  const fromBase = /* @__PURE__ */ new Date();
  fromBase.setUTCDate(fromBase.getUTCDate() - (days - 1));
  const from = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(fromBase);
  return { from, to };
}
function MiniLineChart({ series }) {
  const width = 900;
  const height = 320;
  const padding = { top: 20, right: 20, bottom: 36, left: 54 };
  const colors = ["var(--accent)", "var(--fg)", "var(--muted)", "var(--accent-hover)"];
  const allPoints = series.flatMap((line) => line.points);
  const allDates = Array.from(new Set(allPoints.map((point) => point.date))).sort((a, b) => a.localeCompare(b));
  const maxValue = Math.max(0, ...allPoints.map((point) => point.revenuePence));
  const yMax = Math.max(maxValue, 100);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const xPosition = (date) => {
    const index = allDates.indexOf(date);
    if (index <= 0 || allDates.length <= 1) return padding.left;
    return padding.left + index / (allDates.length - 1) * innerWidth;
  };
  const yPosition = (value) => padding.top + (1 - value / yMax) * innerHeight;
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }).map((_, index) => Math.round(yMax / ticks * (ticks - index)));
  return /* @__PURE__ */ jsxs("div", { className: "admin-sales-chart-inner", children: [
    /* @__PURE__ */ jsxs("svg", { viewBox: `0 0 ${width} ${height}`, className: "admin-sales-chart-svg", role: "img", "aria-label": "Sales revenue chart", children: [
      yTicks.map((tick) => /* @__PURE__ */ jsxs("g", { children: [
        /* @__PURE__ */ jsx("line", { x1: padding.left, y1: yPosition(tick), x2: width - padding.right, y2: yPosition(tick), className: "admin-sales-grid-line" }),
        /* @__PURE__ */ jsxs("text", { x: padding.left - 8, y: yPosition(tick) + 4, textAnchor: "end", className: "admin-sales-axis-label", children: [
          "£",
          Math.round(tick / 100)
        ] })
      ] }, `tick-${tick}`)),
      series.map((line, lineIndex) => {
        const path = line.points.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${xPosition(point.date)} ${yPosition(point.revenuePence)}`).join(" ");
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx("path", { d: path, fill: "none", stroke: colors[lineIndex % colors.length], strokeWidth: "2" }),
          line.points.map((point) => /* @__PURE__ */ jsx("circle", { cx: xPosition(point.date), cy: yPosition(point.revenuePence), r: "2.25", fill: colors[lineIndex % colors.length], children: /* @__PURE__ */ jsx("title", { children: `${(/* @__PURE__ */ new Date(`${point.date}T00:00:00`)).toLocaleDateString("en-GB")} · ${line.name}: ${formatPrice(point.revenuePence)}` }) }, `${line.key}-${point.date}`))
        ] }, line.key);
      }),
      allDates.filter((_, index) => index % Math.max(1, Math.ceil(allDates.length / 6)) === 0 || index === allDates.length - 1).map((date) => /* @__PURE__ */ jsx("text", { x: xPosition(date), y: height - 12, textAnchor: "middle", className: "admin-sales-axis-label", children: (/* @__PURE__ */ new Date(`${date}T00:00:00`)).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" }) }, `x-${date}`))
    ] }),
    /* @__PURE__ */ jsx("div", { className: "admin-sales-legend", children: series.map((line, index) => /* @__PURE__ */ jsxs("span", { className: "admin-sales-legend-item", children: [
      /* @__PURE__ */ jsx("i", { style: { background: colors[index % colors.length] } }),
      line.name
    ] }, `legend-${line.key}`)) })
  ] });
}
function ShopAdminPanel() {
  const [activeTab, setActiveTab] = useState("products");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [salesPreset, setSalesPreset] = useState("30");
  const [salesFrom, setSalesFrom] = useState(() => getRangeDates("30").from);
  const [salesTo, setSalesTo] = useState(() => getCurrentYmdInLondon());
  const [includeOverall, setIncludeOverall] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [generatingDemo, setGeneratingDemo] = useState(false);
  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.sortOrder - b.sortOrder || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [products]
  );
  const chartSeries = useMemo(() => {
    if (!salesData) return [];
    const lines = [];
    if (includeOverall && salesData.series.overall) {
      lines.push({ key: "overall", name: "Overall", points: salesData.series.overall });
    }
    for (const productSeries of salesData.series.products ?? []) {
      lines.push({
        key: productSeries.productId,
        name: productSeries.name,
        points: productSeries.points.map((point) => ({ date: point.date, revenuePence: point.revenuePence }))
      });
    }
    return lines;
  }, [includeOverall, salesData]);
  async function fetchProducts() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/shop/products");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not fetch products.");
      setProducts(payload.products);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not fetch products.");
    } finally {
      setLoading(false);
    }
  }
  async function fetchOrders() {
    setOrdersLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/shop/orders");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not fetch orders.");
      setOrders(payload.orders);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not fetch orders.");
    } finally {
      setOrdersLoading(false);
    }
  }
  async function fetchOrderDetails(orderId) {
    setError(null);
    try {
      const response = await fetch(`/api/admin/shop/orders/${orderId}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not fetch order details.");
      setSelectedOrder(payload.order);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not fetch order details.");
    }
  }
  async function fetchSales(options) {
    setSalesLoading(true);
    setSalesError(null);
    const preset = salesPreset;
    const from = salesFrom;
    const to = salesTo;
    const query = new URLSearchParams();
    if (preset === "custom") {
      query.set("from", from);
      query.set("to", to);
    } else {
      query.set("range", preset);
    }
    if (!includeOverall) {
      query.set("includeOverall", "false");
    }
    if (selectedProductIds.length > 0) {
      query.set("productIds", selectedProductIds.join(","));
    }
    try {
      const response = await fetch(`/api/admin/shop/sales?${query.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not fetch sales analytics.");
      setSalesData(payload);
    } catch (fetchError) {
      setSalesError(fetchError instanceof Error ? fetchError.message : "Could not fetch sales analytics.");
    } finally {
      setSalesLoading(false);
    }
  }
  useEffect(() => {
    void fetchProducts();
  }, []);
  useEffect(() => {
    if (activeTab === "orders") {
      void fetchOrders();
    }
    if (activeTab === "sales") {
      void fetchSales();
    }
  }, [activeTab]);
  useEffect(() => {
    if (activeTab !== "sales") return;
    void fetchSales();
  }, [activeTab, salesPreset, salesFrom, salesTo, includeOverall, selectedProductIds.join(",")]);
  useEffect(() => {
    if (activeTab !== "orders") return;
    const intervalId = window.setInterval(() => {
      void fetchOrders();
      if (selectedOrder) {
        void fetchOrderDetails(selectedOrder.id);
      }
    }, 15e3);
    return () => window.clearInterval(intervalId);
  }, [activeTab, selectedOrder]);
  function resetForm() {
    setForm(EMPTY_FORM);
    setFormOpen(false);
  }
  function startCreate() {
    setForm(EMPTY_FORM);
    setFormOpen(true);
    setError(null);
    setSuccess(null);
  }
  function startEdit(product) {
    setForm({
      id: product.id,
      name: product.name,
      description: product.description || "",
      priceGbp: (product.pricePence / 100).toFixed(2),
      imageUrl: product.imageUrl || "",
      active: product.active,
      featured: product.featured,
      sortOrder: product.sortOrder
    });
    setFormOpen(true);
    setError(null);
    setSuccess(null);
  }
  async function saveProduct(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    const pricePence = penceFromGbp(form.priceGbp);
    if (pricePence <= 0) {
      setError("Price must be greater than £0.00.");
      return;
    }
    setSaving(true);
    try {
      const endpoint = form.id ? "/api/admin/shop/products/update" : "/api/admin/shop/products/create";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          name: trimmedName,
          description: form.description.trim(),
          pricePence,
          imageUrl: form.imageUrl.trim(),
          active: form.active,
          featured: form.featured,
          sortOrder: form.sortOrder
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save product.");
      await fetchProducts();
      setSuccess(form.id ? "Product updated." : "Product created.");
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save product.");
    } finally {
      setSaving(false);
    }
  }
  async function toggleField(productId, field, value) {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/admin/shop/products/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId, field, value })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to update product.");
      await fetchProducts();
      setSuccess("Product updated.");
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update product.");
    }
  }
  async function disableProduct(productId) {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/admin/shop/products/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to disable product.");
      await fetchProducts();
      setSuccess("Product disabled.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to disable product.");
    }
  }
  async function markCollected(orderId) {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/shop/orders/${orderId}/collect`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to mark order as collected.");
      await fetchOrders();
      await fetchOrderDetails(orderId);
      setSuccess("Order marked as collected.");
    } catch (collectError) {
      setError(collectError instanceof Error ? collectError.message : "Unable to mark order as collected.");
    }
  }
  function toggleProductSelection(productId) {
    setSelectedProductIds((previous) => {
      if (previous.includes(productId)) {
        return previous.filter((id) => id !== productId);
      }
      if (previous.length >= 3) {
        return previous;
      }
      return [...previous, productId];
    });
  }
  function applyPreset(nextPreset) {
    const dates = getRangeDates(nextPreset);
    setSalesPreset(nextPreset);
    setSalesFrom(dates.from);
    setSalesTo(dates.to);
  }
  return /* @__PURE__ */ jsxs("section", { className: "booking-shell", "aria-live": "polite", children: [
    /* @__PURE__ */ jsx("h2", { children: "Shop" }),
    /* @__PURE__ */ jsxs("div", { className: "admin-view-tabs admin-view-tabs--three", role: "tablist", "aria-label": "Shop sections", children: [
      /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${activeTab === "products" ? "admin-filter-tab--active" : ""}`, onClick: () => setActiveTab("products"), children: "Products" }),
      /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${activeTab === "orders" ? "admin-filter-tab--active" : ""}`, onClick: () => setActiveTab("orders"), children: "Orders" }),
      /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${activeTab === "sales" ? "admin-filter-tab--active" : ""}`, onClick: () => setActiveTab("sales"), children: "Sales" })
    ] }),
    activeTab === "products" && /* @__PURE__ */ jsxs("div", { className: "admin-reports admin-products-panel", children: [
      /* @__PURE__ */ jsxs("div", { className: "admin-products-actions", children: [
        /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--primary", onClick: startCreate, children: "Add product" }),
        /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--ghost", onClick: () => void fetchProducts(), disabled: loading, children: loading ? "Refreshing…" : "Refresh" })
      ] }),
      error ? /* @__PURE__ */ jsx("p", { className: "admin-inline-error", children: error }) : null,
      success ? /* @__PURE__ */ jsx("p", { className: "admin-inline-success", children: success }) : null,
      formOpen ? /* @__PURE__ */ jsxs("form", { className: "admin-product-form", onSubmit: saveProduct, children: [
        /* @__PURE__ */ jsx("h3", { children: form.id ? "Edit product" : "Add product" }),
        /* @__PURE__ */ jsxs("label", { children: [
          "Name",
          /* @__PURE__ */ jsx("input", { value: form.name, onChange: (event) => setForm((prev) => ({ ...prev, name: event.target.value })), required: true })
        ] }),
        /* @__PURE__ */ jsxs("label", { children: [
          "Description",
          /* @__PURE__ */ jsx("textarea", { value: form.description, onChange: (event) => setForm((prev) => ({ ...prev, description: event.target.value })), rows: 3 })
        ] }),
        /* @__PURE__ */ jsxs("label", { children: [
          "Price (GBP)",
          /* @__PURE__ */ jsx("input", { type: "number", min: "0.01", step: "0.01", value: form.priceGbp, onChange: (event) => setForm((prev) => ({ ...prev, priceGbp: event.target.value })), required: true })
        ] }),
        /* @__PURE__ */ jsxs("label", { children: [
          "Image URL",
          /* @__PURE__ */ jsx("input", { type: "url", value: form.imageUrl, onChange: (event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value })), placeholder: "https://..." })
        ] }),
        /* @__PURE__ */ jsxs("label", { children: [
          "Sort order",
          /* @__PURE__ */ jsx("input", { type: "number", value: form.sortOrder, onChange: (event) => setForm((prev) => ({ ...prev, sortOrder: Number.parseInt(event.target.value, 10) || 0 })) })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "admin-product-checkbox", children: [
          /* @__PURE__ */ jsx("input", { type: "checkbox", checked: form.active, onChange: (event) => setForm((prev) => ({ ...prev, active: event.target.checked })) }),
          "Active"
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "admin-product-checkbox", children: [
          /* @__PURE__ */ jsx("input", { type: "checkbox", checked: form.featured, onChange: (event) => setForm((prev) => ({ ...prev, featured: event.target.checked })) }),
          "Featured"
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "admin-products-actions", children: [
          /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn--primary", disabled: saving, children: saving ? "Saving…" : "Save product" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--secondary", onClick: resetForm, children: "Cancel" })
        ] })
      ] }) : null,
      /* @__PURE__ */ jsx("div", { className: "admin-products-table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "admin-table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Name" }),
          /* @__PURE__ */ jsx("th", { children: "Price" }),
          /* @__PURE__ */ jsx("th", { children: "Active" }),
          /* @__PURE__ */ jsx("th", { children: "Featured" }),
          /* @__PURE__ */ jsx("th", { children: "Sort" }),
          /* @__PURE__ */ jsx("th", { children: "Updated" }),
          /* @__PURE__ */ jsx("th", { children: "Actions" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: sortedProducts.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 7, children: "No products yet." }) }) : sortedProducts.map((product) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: product.name }),
          /* @__PURE__ */ jsx("td", { children: formatPrice(product.pricePence) }),
          /* @__PURE__ */ jsx("td", { children: product.active ? "Yes" : "No" }),
          /* @__PURE__ */ jsx("td", { children: product.featured ? "Yes" : "No" }),
          /* @__PURE__ */ jsx("td", { children: product.sortOrder }),
          /* @__PURE__ */ jsx("td", { children: new Date(product.updatedAt).toLocaleString("en-GB") }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsxs("div", { className: "admin-products-row-actions", children: [
            /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--ghost", onClick: () => startEdit(product), children: "Edit" }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--ghost", onClick: () => void toggleField(product.id, "active", !product.active), children: product.active ? "Deactivate" : "Activate" }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--ghost", onClick: () => void toggleField(product.id, "featured", !product.featured), children: product.featured ? "Unfeature" : "Feature" }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--secondary", onClick: () => void disableProduct(product.id), children: "Delete" })
          ] }) })
        ] }, product.id)) })
      ] }) })
    ] }),
    activeTab === "orders" && /* @__PURE__ */ jsxs("div", { className: "admin-reports admin-orders-panel", children: [
      error ? /* @__PURE__ */ jsx("p", { className: "admin-inline-error", children: error }) : null,
      success ? /* @__PURE__ */ jsx("p", { className: "admin-inline-success", children: success }) : null,
      /* @__PURE__ */ jsx("div", { className: "admin-products-actions", children: /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--ghost", onClick: () => void fetchOrders(), disabled: ordersLoading, children: ordersLoading ? "Refreshing…" : "Refresh orders" }) }),
      /* @__PURE__ */ jsx("div", { className: "admin-products-table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "admin-table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Date" }),
          /* @__PURE__ */ jsx("th", { children: "Customer email" }),
          /* @__PURE__ */ jsx("th", { children: "Total" }),
          /* @__PURE__ */ jsx("th", { children: "Status" }),
          /* @__PURE__ */ jsx("th", { children: "Items" }),
          /* @__PURE__ */ jsx("th", { children: "Action" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: orders.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 6, children: "No orders yet." }) }) : orders.map((order) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: new Date(order.createdAt).toLocaleString("en-GB") }),
          /* @__PURE__ */ jsx("td", { children: order.customerEmail }),
          /* @__PURE__ */ jsx("td", { children: formatPrice(order.totalPence) }),
          /* @__PURE__ */ jsx("td", { children: order.status }),
          /* @__PURE__ */ jsx("td", { children: order._count.items }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--ghost", onClick: () => void fetchOrderDetails(order.id), children: "View" }) })
        ] }, order.id)) })
      ] }) }),
      selectedOrder ? /* @__PURE__ */ jsxs("article", { className: "admin-order-detail", children: [
        /* @__PURE__ */ jsx("h3", { children: "Order details" }),
        /* @__PURE__ */ jsxs("p", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Email:" }),
          " ",
          selectedOrder.customerEmail
        ] }),
        /* @__PURE__ */ jsxs("p", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Status:" }),
          " ",
          selectedOrder.status
        ] }),
        /* @__PURE__ */ jsxs("p", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Total:" }),
          " ",
          formatPrice(selectedOrder.totalPence)
        ] }),
        /* @__PURE__ */ jsx("div", { className: "admin-products-table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "admin-table", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: "Item" }),
            /* @__PURE__ */ jsx("th", { children: "Unit" }),
            /* @__PURE__ */ jsx("th", { children: "Qty" }),
            /* @__PURE__ */ jsx("th", { children: "Line total" })
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: selectedOrder.items.map((item) => /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("td", { children: item.nameSnapshot }),
            /* @__PURE__ */ jsx("td", { children: formatPrice(item.unitPricePenceSnapshot) }),
            /* @__PURE__ */ jsx("td", { children: item.quantity }),
            /* @__PURE__ */ jsx("td", { children: formatPrice(item.lineTotalPence) })
          ] }, item.id)) })
        ] }) }),
        selectedOrder.status === "PAID" ? /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--primary", onClick: () => void markCollected(selectedOrder.id), children: "Mark as collected" }) : null
      ] }) : null
    ] }),
    activeTab === "sales" && /* @__PURE__ */ jsxs("div", { className: "admin-reports admin-sales-panel", children: [
      salesError ? /* @__PURE__ */ jsx("p", { className: "admin-inline-error", children: salesError }) : null,
      success ? /* @__PURE__ */ jsx("p", { className: "admin-inline-success", children: success }) : null,
      /* @__PURE__ */ jsxs("div", { className: "admin-sales-kpis", children: [
        /* @__PURE__ */ jsxs("article", { className: "admin-sales-kpi", children: [
          /* @__PURE__ */ jsx("p", { children: "Total revenue" }),
          /* @__PURE__ */ jsx("strong", { children: formatPrice(salesData?.kpis.revenuePence ?? 0) })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "admin-sales-kpi", children: [
          /* @__PURE__ */ jsx("p", { children: "Orders count" }),
          /* @__PURE__ */ jsx("strong", { children: salesData?.kpis.ordersCount ?? 0 })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "admin-sales-kpi", children: [
          /* @__PURE__ */ jsx("p", { children: "Average order value" }),
          /* @__PURE__ */ jsx("strong", { children: formatPrice(salesData?.kpis.avgOrderValuePence ?? 0) })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "admin-sales-kpi", children: [
          /* @__PURE__ */ jsx("p", { children: "Best-selling product" }),
          /* @__PURE__ */ jsx("strong", { children: salesData?.kpis.bestProduct ? `${salesData.kpis.bestProduct.name} (${formatPrice(salesData.kpis.bestProduct.revenuePence)})` : "—" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "admin-sales-controls", children: [
        /* @__PURE__ */ jsxs("div", { className: "admin-filter-tabs", role: "tablist", "aria-label": "Sales range presets", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${salesPreset === "7" ? "admin-filter-tab--active" : ""}`, onClick: () => applyPreset("7"), children: "Last 7 days" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${salesPreset === "30" ? "admin-filter-tab--active" : ""}`, onClick: () => applyPreset("30"), children: "Last 30 days" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${salesPreset === "90" ? "admin-filter-tab--active" : ""}`, onClick: () => applyPreset("90"), children: "Last 90 days" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: `admin-filter-tab ${salesPreset === "custom" ? "admin-filter-tab--active" : ""}`, onClick: () => setSalesPreset("custom"), children: "Custom" })
        ] }),
        salesPreset === "custom" ? /* @__PURE__ */ jsxs("div", { className: "admin-sales-custom-dates", children: [
          /* @__PURE__ */ jsxs("label", { children: [
            "From",
            /* @__PURE__ */ jsx("input", { type: "date", value: salesFrom, onChange: (event) => setSalesFrom(event.target.value) })
          ] }),
          /* @__PURE__ */ jsxs("label", { children: [
            "To",
            /* @__PURE__ */ jsx("input", { type: "date", value: salesTo, onChange: (event) => setSalesTo(event.target.value) })
          ] })
        ] }) : null,
        /* @__PURE__ */ jsxs("label", { className: "admin-product-checkbox", children: [
          /* @__PURE__ */ jsx("input", { type: "checkbox", checked: includeOverall, onChange: (event) => setIncludeOverall(event.target.checked) }),
          "Include Overall line"
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "admin-sales-product-picker", children: [
          /* @__PURE__ */ jsx("p", { children: "Select products (max 3):" }),
          /* @__PURE__ */ jsx("div", { className: "admin-sales-product-list", children: sortedProducts.filter((product) => product.active).map((product) => {
            const selected = selectedProductIds.includes(product.id);
            const limitReached = selectedProductIds.length >= 3 && !selected;
            return /* @__PURE__ */ jsxs("label", { className: "admin-product-checkbox", children: [
              /* @__PURE__ */ jsx("input", { type: "checkbox", checked: selected, disabled: limitReached, onChange: () => toggleProductSelection(product.id) }),
              product.name
            ] }, product.id);
          }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "admin-products-actions", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--primary", onClick: () => void fetchSales(), disabled: salesLoading, children: salesLoading ? "Loading…" : "Refresh sales" }),
          null
        ] })
      ] }),
      (salesData?.kpis.ordersCount ?? 0) === 0 ? /* @__PURE__ */ jsx("div", { className: "admin-sales-empty", children: /* @__PURE__ */ jsx("p", { children: "No sales yet." }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("div", { className: "admin-sales-chart-wrap", children: /* @__PURE__ */ jsx(MiniLineChart, { series: chartSeries }) }),
        /* @__PURE__ */ jsx("div", { className: "admin-products-table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "admin-table", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: "Product" }),
            /* @__PURE__ */ jsx("th", { children: "Units sold" }),
            /* @__PURE__ */ jsx("th", { children: "Revenue (GBP)" })
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: (salesData?.leaderboard ?? []).length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 3, children: "No paid order items in this range." }) }) : (salesData?.leaderboard ?? []).map((row) => /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("td", { children: row.name }),
            /* @__PURE__ */ jsx("td", { children: row.units }),
            /* @__PURE__ */ jsx("td", { children: formatPrice(row.revenuePence) })
          ] }, row.productId)) })
        ] }) })
      ] })
    ] })
  ] });
}

function getSectionFromUrl() {
  if (typeof window === "undefined") return "bookings";
  const section = new URLSearchParams(window.location.search).get("section");
  return section === "shop" ? "shop" : "bookings";
}
function AdminPanel() {
  const [activeSection, setActiveSection] = useState("bookings");
  useEffect(() => {
    setActiveSection(getSectionFromUrl());
    const handlePopState = () => {
      setActiveSection(getSectionFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const handleSectionChange = useCallback((section) => {
    setActiveSection(section);
    const params = new URLSearchParams(window.location.search);
    params.set("section", section);
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);
  return /* @__PURE__ */ jsxs(AdminLayout, { activeSection, onChangeSection: handleSectionChange, children: [
    /* @__PURE__ */ jsx(BookingsAdminPanel, { isActive: activeSection === "bookings" }),
    activeSection === "shop" ? /* @__PURE__ */ jsx(ShopAdminPanel, {}) : null
  ] });
}

const $$Admin = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`<html lang="en"> ${maybeRenderHead()}<body> <main class="container page-wrap"> ${renderComponent($$result, "AdminPanel", AdminPanel, { "client:load": true, "client:component-hydration": "load", "client:component-path": "C:/dev/kersivo-barber-outreach/src/components/admin/AdminPanel", "client:component-export": "default" })} </main> </body></html>`;
}, "C:/dev/kersivo-barber-outreach/src/pages/admin.astro", void 0);

const $$file = "C:/dev/kersivo-barber-outreach/src/pages/admin.astro";
const $$url = "/admin";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Admin,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
