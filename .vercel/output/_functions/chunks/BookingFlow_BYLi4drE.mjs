import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { useState, useEffect, useMemo } from 'react';

function normalizeToIsoDate(input) {
  const trimmed = input.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const dmyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!dmyMatch) return null;
  const day = Number(dmyMatch[1]);
  const month = Number(dmyMatch[2]);
  const year = Number(dmyMatch[3]);
  const validated = new Date(Date.UTC(year, month - 1, day));
  if (validated.getUTCFullYear() !== year || validated.getUTCMonth() !== month - 1 || validated.getUTCDate() !== day) {
    return null;
  }
  return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
}
function BookingFlow({ services, barbers, mode = "create", token = "" }) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [barberId, setBarberId] = useState(barbers[0]?.id ?? "");
  const [date, setDate] = useState((/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
  const [slots, setSlots] = useState([]);
  const [time, setTime] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!serviceId || !barberId || !date) return;
    const isoDate = normalizeToIsoDate(date);
    if (!isoDate) {
      setSlots([]);
      setTime("");
      return;
    }
    fetch(`/api/availability?serviceId=${serviceId}&barberId=${barberId}&date=${isoDate}`).then((res) => res.json()).then((data) => {
      setSlots(data.slots ?? []);
      setTime("");
    });
  }, [serviceId, barberId, date]);
  const selectedService = useMemo(() => services.find((s) => s.id === serviceId), [serviceId, services]);
  async function submit() {
    setMessage("");
    if (!serviceId || !barberId) {
      setMessage("Please choose a service and barber.");
      return;
    }
    const isoDate = normalizeToIsoDate(date);
    if (!isoDate) {
      setMessage("Please choose a valid date.");
      return;
    }
    if (!time) {
      setMessage("Please select an available time.");
      return;
    }
    if (mode === "reschedule") {
      if (!token) {
        setMessage("Missing reschedule token. Please use the manage link from your email.");
        return;
      }
      const payload2 = {
        token,
        serviceId,
        barberId,
        date: isoDate,
        time
      };
      const res2 = await fetch("/api/bookings/reschedule", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload2)
      });
      const data2 = await res2.json().catch(() => ({}));
      if (!res2.ok) {
        setMessage(data2.error || "Unable to reschedule booking.");
        return;
      }
      const startAt = data2.booking?.startAt ? new Date(data2.booking.startAt).toLocaleString("en-GB", { timeZone: "Europe/London" }) : `${isoDate} ${time}`;
      setMessage(`Booking rescheduled successfully. New time: ${startAt}.`);
      return;
    }
    const normalizedFullName = fullName.trim();
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();
    if (!normalizedFullName || !normalizedEmail) {
      setMessage("Please provide your full name and email.");
      return;
    }
    const payload = {
      serviceId,
      barberId,
      date: isoDate,
      time,
      fullName: normalizedFullName,
      email: normalizedEmail,
      ...normalizedPhone ? { phone: normalizedPhone } : {}
    };
    const res = await fetch("/api/bookings/create", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Booking created. Check email for confirmation magic link." : data.error || "Unable to create booking.");
  }
  return /* @__PURE__ */ jsxs("section", { className: "surface booking-shell", children: [
    /* @__PURE__ */ jsx("h1", { children: mode === "reschedule" ? "Reschedule Booking" : "Book Now" }),
    /* @__PURE__ */ jsxs("p", { className: "muted", children: [
      "Timezone: Europe/London • ",
      mode === "reschedule" ? "Choose a new slot and submit once." : "Confirmation required by email."
    ] }),
    /* @__PURE__ */ jsx("label", { children: "Service" }),
    /* @__PURE__ */ jsx("select", { value: serviceId, onChange: (e) => setServiceId(e.target.value), children: services.map((service) => /* @__PURE__ */ jsxs("option", { value: service.id, children: [
      service.name,
      " (",
      service.durationMinutes,
      " min)"
    ] }, service.id)) }),
    /* @__PURE__ */ jsx("label", { children: "Barber" }),
    /* @__PURE__ */ jsx("select", { value: barberId, onChange: (e) => setBarberId(e.target.value), children: barbers.map((barber) => /* @__PURE__ */ jsx("option", { value: barber.id, children: barber.name }, barber.id)) }),
    /* @__PURE__ */ jsx("label", { children: "Date" }),
    /* @__PURE__ */ jsx("input", { type: "date", value: date, onChange: (e) => setDate(e.target.value) }),
    /* @__PURE__ */ jsxs("label", { children: [
      "Available times ",
      selectedService ? `for ${selectedService.name}` : ""
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "slot-grid", children: [
      slots.map((slot) => /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: time === slot ? "btn btn--primary" : "btn btn--secondary",
          onClick: () => setTime(slot),
          children: slot
        },
        slot
      )),
      slots.length === 0 && /* @__PURE__ */ jsx("p", { className: "muted", children: "No slots available for this date." })
    ] }),
    mode === "create" && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("label", { children: "Full name" }),
      /* @__PURE__ */ jsx("input", { value: fullName, onChange: (e) => setFullName(e.target.value) }),
      /* @__PURE__ */ jsx("label", { children: "Email" }),
      /* @__PURE__ */ jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value) }),
      /* @__PURE__ */ jsx("label", { children: "Phone (optional)" }),
      /* @__PURE__ */ jsx("input", { value: phone, onChange: (e) => setPhone(e.target.value) })
    ] }),
    /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--primary", disabled: !time || mode === "create" && (!fullName || !email), onClick: submit, children: mode === "reschedule" ? "Reschedule booking" : "Create booking" }),
    message && /* @__PURE__ */ jsx("p", { children: message })
  ] });
}

export { BookingFlow as B };
