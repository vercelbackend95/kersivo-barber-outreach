"""Builds the KERSIVO /admin hub mockup screens (HTML) from shared partials."""
from pathlib import Path

OUT = Path(__file__).parent

P = {
    "grid": '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    "checks": '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
    "globe": '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    "palette": '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".8" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".8" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".8" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".8" fill="currentColor"/>',
    "msg": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    "activity": '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    "upright": '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    "store": '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.6-.6.7.7 0 0 0-.8 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.6-.6.7.7 0 0 0-.8 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.6-.6.7.7 0 0 0-.8 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.6-.6.7.7 0 0 0-.8 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
    "right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "lock": '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    "x": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    "phone": '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    "monitor": '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    "ext": '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    "msgplus": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v6"/><path d="M9 10h6"/>',
    "upload": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    "image": '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    "pipette": '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
    "cal": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
    "bag": '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    "eye": '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    "eyeoff": '<path d="M10.73 5.08a10.74 10.74 0 0 1 11.2 6.57 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49"/><path d="M14.08 14.16a3 3 0 0 1-4.24-4.24"/><path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14"/><path d="m2 2 20 20"/>',
    "menu": '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
    "clip": '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    "send": '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    "sparkle": '<path d="M12 3l1.9 5.6L19.5 10.5 13.9 12.4 12 18l-1.9-5.6L4.5 10.5l5.6-1.9Z"/>',
    "scissors": '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
    "users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    "clock": '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    "text": '<path d="M17 6.1H3"/><path d="M21 12.1H3"/><path d="M15.1 18H3"/>',
    "refresh": '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
}


def i(name, cls=""):
    return f'<svg class="i {cls}" viewBox="0 0 24 24" aria-hidden="true">{P[name]}</svg>'


LOGO = """<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="#1f6f6b"/><circle cx="50" cy="50" r="41" fill="none" stroke="#c9a24a" stroke-width="3"/><circle cx="50" cy="50" r="35" fill="#141414"/><text x="50" y="60" text-anchor="middle" font-family="Bebas Neue, Inter" font-size="32" fill="#f2e8d5" letter-spacing="1">NB</text><path d="M30 28 L70 28" stroke="#c9a24a" stroke-width="2.5"/><path d="M30 72 L70 72" stroke="#c9a24a" stroke-width="2.5"/></svg>"""

LOGO_LIGHT = LOGO  # same mark, shown on light swatch


def head(title, width):
    return f"""<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width={width}"><title>{title}</title><link rel="stylesheet" href="styles.css"></head><body>"""


def foot():
    return "</body></html>"


# ───────────────────────── Sidebar ─────────────────────────
def setup_card_prepay(compact=False):
    items = [
        ("Logo", "done", ""),
        ("Shop photos", "done", ""),
        ("Services &amp; prices", "next", ""),
        ("Team", "todo", ""),
        ("Opening hours", "todo", ""),
        ("About your shop", "todo", "Optional"),
    ]
    lis = []
    for label, state, tag in items:
        mk = i("check", "i--xs") if state == "done" else ""
        right = f'<span class="go">{i("right","i--xs")}</span>' if state == "next" else (f'<span class="tag">{tag}</span>' if tag else "")
        lis.append(f'<li class="{state}"><span class="mk">{mk}</span>{label}{right}</li>')
    return f"""<a class="launch" href="#">
  <div class="launch__top"><span class="launch__icon">{i('store')}</span>
    <div><div class="launch__status">Your shop · 2 of 6</div><div class="launch__title">Help us build your site</div></div></div>
  <div class="launch__bar"><span style="width:33%"></span></div>
  <ul class="launch__list">{''.join(lis)}</ul>
</a>"""


def setup_card_launch():
    items = [("Business details", "done"), ("Domain", "next"), ("Payments", "todo", "Optional"), ("Approve your website", "todo")]
    lis = []
    for it in items:
        label, state = it[0], it[1]
        tag = it[2] if len(it) > 2 else ""
        mk = i("check", "i--xs") if state == "done" else ""
        right = f'<span class="go">{i("right","i--xs")}</span>' if state == "next" else (f'<span class="tag">{tag}</span>' if tag else "")
        lis.append(f'<li class="{state}"><span class="mk">{mk}</span>{label}{right}</li>')
    return f"""<a class="launch" href="#">
  <div class="launch__top"><span class="launch__icon">{i('store')}</span>
    <div><div class="launch__status">Launch · 1 of 4</div><div class="launch__title">Let's put you live</div></div></div>
  <div class="launch__bar"><span style="width:25%"></span></div>
  <ul class="launch__list">{''.join(lis)}</ul>
</a>"""


def setup_card_live():
    items = [("View your website", "done", "eye"), ("Make a test booking", "next", "cal"), ("Set up retail", "todo", "bag")]
    lis = []
    for label, state, ic in items:
        mk = i("check", "i--xs") if state == "done" else ""
        right = f'<span class="go">{i("right","i--xs")}</span>' if state == "next" else '<span class="tag">Optional</span>' if label == "Set up retail" else ""
        lis.append(f'<li class="{state}"><span class="mk">{mk}</span>{label}{right}</li>')
    return f"""<a class="launch" href="#">
  <div class="launch__top"><span class="launch__icon">{i('sparkle')}</span>
    <div><div class="launch__status">You're live · 1 of 3</div><div class="launch__title">Get the most from KERSIVO</div></div></div>
  <div class="launch__bar"><span style="width:33%"></span></div>
  <ul class="launch__list">{''.join(lis)}</ul>
</a>"""


def sidebar(active="overview", card=None):
    card = card or setup_card_prepay()
    def nl(key, label, icon, badge=""):
        cls = "navlink navlink--active" if key == active else "navlink"
        b = f'<span class="badge">{badge}</span>' if badge else ""
        return f'<a class="{cls}" href="#">{i(icon)}<span>{label}</span>{b}</a>'
    return f"""<aside class="side">
  <div class="wordmark"><span class="dot"></span>KERSIVO</div>
  <div class="shopchip"><div class="shopchip__logo">{LOGO}</div>
    <div><div class="shopchip__name">Northgate Barbers</div><div class="shopchip__meta">Leeds</div></div></div>
  <div><span class="pill pill--accent"><span class="pdot"></span>Preview ready</span></div>
  <nav>
    <p class="navgroup__title">Your website</p>
    {nl('overview','Overview','grid')}
    {nl('changes','Changes','checks','2')}
    {nl('website','Website','globe')}
  </nav>
  <div class="side__spacer"></div>
  {card}
  <div class="side__foot">{i('eyeoff','i--xs')}Private · hidden from search engines</div>
  <div class="side__user"><span class="avatar">JM</span><span>james@northgatebarbers.co.uk</span></div>
</aside>"""


# ───────────────────────── Bento tiles ─────────────────────────
def mini_site():
    return f"""<div class="site"><div class="site__nav"><span class="mono">{LOGO}</span><span class="site__burger"></span></div>
<div class="site__hero"><div class="site__hero-text"><div class="site__kicker">Leeds · Since 2014</div><div class="site__h">Sharp cuts.<br>No fuss.</div><span class="site__btn">Book now</span></div></div>
<div class="site__sec"><div class="site__sec-h">Services</div>
<div class="site__row"><span>Skin fade</span><b>£24</b></div><div class="site__row"><span>Classic cut</span><b>£20</b></div><div class="site__row"><span>Beard trim</span><b>£12</b></div><div class="site__row"><span>Hot towel shave</span><b>£22</b></div></div></div>"""


def tile_progress():
    stages = [("Requested", "28 Oct", "done"), ("Designing", "29 Oct", "done"), ("Review", "Today", "now"), ("Launch", "", "todo"), ("Live", "", "todo")]
    s = "".join(
        f'<div class="stage stage--{st}"><div class="stage__bar"></div><div class="stage__label"><span class="stage__num">{n+1 if st!="done" else ""}</span>{lab}</div><div class="stage__date">{d or "&nbsp;"}</div></div>'
        for n, (lab, d, st) in enumerate(stages)
    )
    s = s.replace('<span class="stage__num"></span>', f'<span class="stage__num">{i("check","i--xs")}</span>')
    return f"""<a class="tile b-progress" href="#">
  <div class="tile__head"><span class="tile__icon">{i('activity','i--sm')}</span><span class="tile__title">Your website build</span><span class="pill pill--accent" style="margin-left:auto"><span class="pdot"></span>Stage 3 of 5 · Review</span></div>
  <div class="stages">{s}</div>
  <div class="nowgrid">
    <div class="nowbox"><div class="nowbox__k">{i('sparkle','i--xs')}What we're doing</div><div class="nowbox__v">Your preview is ready. We're waiting for your feedback before we change anything.</div></div>
    <div class="nowbox nowbox--you"><div class="nowbox__k">{i('right','i--xs')}What we need from you</div><div class="nowbox__v">Check your services &amp; prices, then tell us what to change.</div></div>
  </div>
</a>"""


def tile_preview():
    return f"""<a class="tile b-preview" href="#">
  <div class="tile__head"><span class="tile__icon">{i('phone','i--sm')}</span><span class="tile__title">Your preview</span><span class="tile__open">{i('upright','i--sm')}</span></div>
  <div class="phonewrap"><div class="phone"><div class="phone__screen"><span class="phone__notch"></span>{mini_site()}</div></div></div>
  <div class="preview-actions"><span class="btn btn--primary btn--sm">{i('globe','i--sm')}Open website</span><span class="btn btn--outline btn--sm">{i('cal','i--sm')}Try booking</span></div>
</a>"""


def tile_colours(hover=False):
    return f"""<a class="tile b-colours{' is-hover' if hover else ''}" href="#">
  <div class="tile__head"><span class="tile__icon">{i('palette','i--sm')}</span><span class="tile__title">Brand colours</span><span class="tile__open">{i('upright','i--sm')}</span></div>
  <div class="logo-mini">{LOGO}<p><strong>4 colours found in your logo</strong>Pick and fine-tune the ones you like</p></div>
  <div class="swatches"><div class="sw" style="background:#1f6f6b"><span class="role">Main</span><small>#1F6F6B</small></div><div class="sw sw--light" style="background:#c9a24a"><span class="role">Accent</span><small>#C9A24A</small></div><div class="sw" style="background:#141414"><small>#141414</small></div><div class="sw sw--light" style="background:#f2e8d5"><small>#F2E8D5</small></div></div>
  <div class="tile__foot"><span class="pill pill--amber"><span class="pdot"></span>Not sent yet</span><span>Takes about a minute</span></div>
</a>"""


def tile_messages():
    return f"""<a class="tile b-messages" href="#">
  <div class="tile__head"><span class="tile__icon">{i('msg','i--sm')}</span><span class="tile__title">Messages</span><span class="tile__open">{i('upright','i--sm')}</span></div>
  <div class="msg"><span class="msg__av">K</span><div><div class="msg__bubble">Your preview is ready. We've used the photos you sent for the top of the page — let me know if you'd like a different one.</div><div class="msg__meta">KERSIVO · 2 hours ago</div></div></div>
  <div class="composer-fake">{i('clip','i--sm')}Write a message…</div>
  <div class="tile__foot"><span class="unread">1 unread</span></div>
</a>"""


def tile_changes():
    return f"""<a class="tile b-changes" href="#">
  <div class="tile__head"><span class="tile__icon">{i('checks','i--sm')}</span><span class="tile__title">Changes</span><span class="tile__open">{i('upright','i--sm')}</span></div>
  <div class="chstats"><div class="chstat"><b>2</b><span>Drafts</span></div><div class="chstat"><b>0</b><span>With KERSIVO</span></div><div class="chstat"><b>0</b><span>Done</span></div></div>
  <ul class="chlist"><li><span class="chip chip--page">Home</span>Use the shopfront photo at the top<span class="chip chip--draft">DRAFT</span></li><li><span class="chip chip--page">Barbers</span>Add Kyle — joined last month<span class="chip chip--draft">DRAFT</span></li></ul>
  <div class="tile__foot">Round 1 of 1 included · <strong>Send when you're ready</strong></div>
</a>"""


def tile_activity():
    rows = [
        ("accent", "globe", "Your preview is ready", "KERSIVO", "2h ago"),
        ("", "image", "You added 6 shop photos", "You", "Yesterday"),
        ("", "upload", "You added your logo", "You", "Yesterday"),
        ("", "msg", "Message from KERSIVO", "KERSIVO", "29 Oct"),
        ("ok", "check", "Request received", "", "28 Oct"),
    ]
    lis = "".join(
        f'<li><span class="fdot{(" fdot--"+c) if c else ""}">{i(ic,"i--xs")}</span><span>{t}{(" <span class=who>· "+w+"</span>") if w else ""}</span><time>{tm}</time></li>'
        for c, ic, t, w, tm in rows
    )
    return f"""<section class="tile tile--quiet b-activity">
  <div class="tile__head"><span class="tile__icon">{i('activity','i--sm')}</span><span class="tile__title">Activity</span><span class="btn btn--ghost btn--sm" style="margin-left:auto">Show all</span></div>
  <ul class="feed">{lis}</ul>
</section>"""


def overview_header(mobile=False):
    actions = "" if mobile else f"""<div class="head__actions"><span class="btn btn--outline">Launch this website <small>£39/month</small></span><span class="btn btn--primary">{i('globe','i--sm')}Open your preview</span></div>"""
    return f"""<header class="head"><div><span class="eyebrow">Overview</span><h1>Your preview is ready</h1><p class="sub">Have a look, check your details and tell us what to change.</p></div>{actions}</header>"""


def bento(hover_colours=False):
    return f"""<div class="bento">{tile_progress()}{tile_preview()}{tile_colours(hover_colours)}{tile_messages()}{tile_changes()}{tile_activity()}</div>"""


# ───────────────────────── Screens ─────────────────────────
def screen_overview_desktop():
    notes = """
<div class="note" data-n="1" style="left:300px;top:560px"><b>Bento</b>Every tile opens its app (window on desktop, full sheet on mobile). URL: /admin?app=colours</div>
<div class="note" data-n="2" style="left:24px;top:470px;max-width:210px"><b>Red setup card</b>Steps open the matching app. Next step highlighted. Same component as today's admin launch card.</div>
<div class="note" data-n="3" style="left:1180px;top:640px;max-width:220px"><b>Preview</b>Static phone thumbnail (no iframe in tile). Before Review: locked state with shop initials on brand colour.</div>
"""
    return head("Overview — desktop", 1440) + f'<div class="app">{sidebar()}<main class="main">{overview_header()}{bento(hover_colours=True)}</main></div>' + foot()


def colour_window_body():
    variants = ["#0c3533", "#124a47", "#185e5a", "#1f6f6b", "#2a8a85", "#3fa59f", "#6cc0ba"]
    vs = "".join(f'<div class="{"cur" if c=="#1f6f6b" else ""}" style="background:{c}"></div>' for c in variants)
    return f"""<div class="cp">
  <div class="cp__panel">
    <div class="cp__label">{i('image','i--xs')}Your logo</div>
    <div class="logo-pair"><div style="background:#0b0b0b;border:1px solid rgba(255,255,255,.08)">{LOGO}</div><div style="background:#f4efe6">{LOGO_LIGHT}</div></div>
    <div class="cp__label" style="margin-top:16px">{i('sparkle','i--xs')}Found in your logo</div>
    <div class="extract">
      <div class="extract__row sel"><span class="extract__chip" style="background:#1f6f6b"></span><div><div class="extract__name">Teal <span class="extract__hex">#1F6F6B</span></div><div class="share"><span style="width:52%"></span></div></div><span class="rolechip">Main</span></div>
      <div class="extract__row sel"><span class="extract__chip" style="background:#c9a24a"></span><div><div class="extract__name">Brass <span class="extract__hex">#C9A24A</span></div><div class="share"><span style="width:28%"></span></div></div><span class="rolechip rolechip--2">Accent</span></div>
      <div class="extract__row"><span class="extract__chip" style="background:#141414"></span><div><div class="extract__name">Ink <span class="extract__hex">#141414</span></div><div class="share"><span style="width:14%"></span></div></div></div>
      <div class="extract__row"><span class="extract__chip" style="background:#f2e8d5"></span><div><div class="extract__name">Cream <span class="extract__hex">#F2E8D5</span></div><div class="share"><span style="width:6%"></span></div></div></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px"><span class="btn btn--outline btn--sm" style="flex:1">{i('pipette','i--sm')}Pick from a photo</span><span class="btn btn--outline btn--sm">#&nbsp;Hex</span></div>
  </div>

  <div>
    <div class="roles">
      <div class="role active"><div class="role__top"><span class="role__sw" style="background:#1f6f6b"></span><div><div class="role__k">Main</div><div class="role__v">Teal</div></div><span class="role__hex">#1F6F6B</span></div></div>
      <div class="role"><div class="role__top"><span class="role__sw" style="background:#c9a24a"></span><div><div class="role__k">Accent</div><div class="role__v">Brass</div></div><span class="role__hex">#C9A24A</span></div></div>
    </div>
    <div class="cp__panel tuner">
      <div class="cp__label" style="margin-bottom:0">Fine-tune main colour</div>
      <div><div class="slider__top"><span>Lighter</span><b>Depth</b><span>Deeper</span></div>
        <div class="track" style="background:linear-gradient(90deg,#6cc0ba,#1f6f6b,#0a2a28)"><span class="thumb" style="left:46%;background:#1f6f6b"></span></div></div>
      <div><div class="slider__top"><span>Muted</span><b>Intensity</b><span>Vivid</span></div>
        <div class="track" style="background:linear-gradient(90deg,#4a5a59,#1f6f6b,#008a80)"><span class="thumb" style="left:55%;background:#1f6f6b"></span></div></div>
      <div><div class="slider__top"><span>Quick picks</span><span>Same colour, lighter → deeper</span></div><div class="variants">{vs}</div></div>
      <div><div class="slider__top"><span>Website background</span></div><div class="tone"><div class="on"><i style="background:#0e1514"></i>Dark</div><div><i style="background:#f4efe6"></i>Light</div></div></div>
    </div>
  </div>

  <div>
    <div class="cp__label">{i('eye','i--xs')}How it looks on your site</div>
    <div class="livep">
      <div class="livep__hero" style="background:radial-gradient(90% 90% at 85% 0%,rgba(201,162,74,.35),transparent 55%),linear-gradient(160deg,#1f6f6b,#0f3b39 60%,#0b1f1e)">
        <div class="livep__nav" style="color:#f2e8d5"><span>NORTHGATE</span><span style="padding:5px 8px;border-radius:7px;background:#c9a24a;color:#141414">BOOK</span></div>
        <div class="livep__h" style="color:#f2e8d5">Sharp cuts.<br>No fuss.</div>
        <div class="livep__btns"><span style="background:#c9a24a;color:#141414">Book now</span><span style="border:1px solid rgba(242,232,213,.4);color:#f2e8d5">Our prices</span></div>
      </div>
      <div class="livep__body" style="background:#0e1514;color:#f2e8d5">
        <div class="livep__svc"><span>Skin fade</span><b style="color:#c9a24a">£24</b></div>
        <div class="livep__svc" style="border:0"><span>Beard trim</span><b style="color:#c9a24a">£12</b></div>
        <div class="livep__slots"><span style="background:#1f6f6b;color:#fff">10:00</span><span style="border:1px solid rgba(242,232,213,.18)">10:30</span><span style="border:1px solid rgba(242,232,213,.18)">11:15</span></div>
      </div>
    </div>
    <div class="check-ok" style="margin-top:10px">{i('check','i--sm')}Text on your buttons is easy to read</div>
    <p style="font-size:12px;color:var(--muted-2);margin:10px 2px 0">This is a guide, not your final design. We'll build your website in these colours.</p>
  </div>
</div>"""


def screen_colours_desktop():
    w = f"""<div class="scrim"></div><div class="window">
  <div class="window__bar"><span class="tile__icon">{i('palette','i--sm')}</span><div><div class="window__title">Brand colours</div><div class="window__crumb">Overview › Brand colours</div></div>
    <span class="btn btn--ghost btn--sm" style="margin-left:auto">{i('refresh','i--sm')}Reset to logo</span><span class="iconbtn">{i('x','i--sm')}</span></div>
  <div class="window__body">{colour_window_body()}</div>
  <div class="window__foot"><p>Not sure? <a href="#" style="color:var(--fg)">Let KERSIVO choose</a> — we'll pick from your logo.</p><span class="btn btn--outline" style="margin-left:auto">Save draft</span><span class="btn btn--primary">{i('send','i--sm')}Send colours to KERSIVO</span></div>
</div>"""
    notes = """
<div class="note" data-n="1" style="left:330px;top:24px;max-width:280px"><b>Extraction</b>Client-side canvas, k-means in OKLab, ignore transparent pixels. Show share of logo per colour. Near-black/white kept as "Ink/Cream", not offered as Main by default.</div>
<div class="note" data-n="2" style="left:820px;top:24px;max-width:260px"><b>Tuning</b>Sliders change only OKLCH lightness &amp; chroma — hue stays the shop's. Quick picks = 7 lightness steps.</div>
<div class="note" data-n="3" style="left:1180px;top:24px;max-width:240px"><b>Live preview + contrast</b>WCAG check on button text. If it fails: "Make it deeper" one-tap fix.</div>
"""
    return head("Brand colours — desktop", 1440) + f'<div class="app">{sidebar()}<main class="main">{overview_header()}{bento()}</main></div>' + w + foot()


def screen_website_desktop():
    toolbar = f"""<div class="wtoolbar">
  <div class="seg"><span class="on">{i('globe','i--sm')}Website</span><span>{i('cal','i--sm')}Booking</span></div>
  <div class="seg seg--icon"><span>{i('phone','i--sm')}Phone</span><span class="on">{i('monitor','i--sm')}Desktop</span></div>
  <span class="wtoolbar__note">{i('lock','i--xs')}Test bookings only — no payments are taken.</span>
  <span class="wtoolbar__spacer"></span>
  <span class="btn btn--ghost btn--sm">{i('ext','i--sm')}Open in new tab</span>
  <span class="btn btn--outline btn--sm">{i('msgplus','i--sm')}Suggest a change</span>
</div>"""
    site = f"""<div class="browser"><div class="browser__bar"><span class="browser__dots"><i></i><i></i><i></i></span><span class="browser__url">{i('lock','i--xs')}northgatebarbers.co.uk</span></div>
<div class="dsite"><div class="dsite__nav"><span class="brand"><span style="width:30px;height:30px;display:block">{LOGO}</span>NORTHGATE</span><span class="links"><span>Services</span><span>Barbers</span><span>Gallery</span><span>Contact</span></span><span class="cta">Book now</span></div>
<div class="dsite__hero"><div class="dsite__hero-in"><div class="site__kicker" style="font-size:11px">Leeds · Walk-ins welcome</div><div class="dsite__h">Sharp cuts.<br>No fuss.</div><p class="dsite__p">Skin fades, classic cuts and hot towel shaves on Northgate. Book online in under a minute.</p><div class="dsite__btns"><span style="background:#c9a24a;color:#141414">Book now</span><span style="border:1px solid rgba(242,232,213,.35)">See prices</span></div></div></div>
<div class="dsite__cols"><div class="dsite__card"><div class="site__sec-h" style="font-size:22px">Services</div><div class="site__row" style="font-size:13px"><span>Skin fade</span><b>£24</b></div><div class="site__row" style="font-size:13px"><span>Classic cut</span><b>£20</b></div></div><div class="dsite__card"><div class="site__sec-h" style="font-size:22px">Opening hours</div><div class="site__row" style="font-size:13px"><span>Mon – Fri</span><span>9:00 – 18:00</span></div><div class="site__row" style="font-size:13px"><span>Saturday</span><span>8:30 – 16:00</span></div></div></div></div></div>"""
    page = f"""<header class="head"><div><span class="eyebrow">Website</span><h1>Your website preview</h1><p class="sub">Exactly what your clients will see. Switch to Booking to try it as a client.</p></div>
<div class="head__actions"><span class="btn btn--outline">Launch this website <small>£39/month</small></span></div></header>
{toolbar}<div class="stagebox" style="position:relative">{site}
<div class="pinhint" style="right:46px;bottom:40px">{i('msgplus','i--sm')}Click anything on the page to suggest a change</div></div>"""
    notes = """
<div class="note" data-n="1" style="left:296px;top:236px;max-width:250px"><b>Buttons</b>Same pill segmented control as /barber-software-cost-calculator (.calc-segmented): black track, active = light fill + red underline.</div>
<div class="note" data-n="2" style="left:1150px;top:236px;max-width:240px"><b>One secondary group</b>Open in new tab = ghost, Suggest a change = outline. Launch lives in the header as outline (primary is in Overview).</div>
"""
    return head("Website — desktop", 1440) + f'<div class="app">{sidebar("website")}<main class="main">{page}</main></div>' + foot()


def mobile_top():
    return f"""<div class="m-top"><span class="wm">KERSIVO</span><span style="width:1px;height:16px;background:var(--hair)"></span><span class="shop">Northgate Barbers</span><span class="pill pill--accent" style="margin-left:auto"><span class="pdot"></span>Review</span><span class="iconbtn" style="position:relative">{i('msg','i--sm')}<span style="position:absolute;top:5px;right:5px;width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 2px #030303"></span></span></div>"""


def mobile_tabs(active="overview"):
    def t(key, label, icon, extra=""):
        return f'<a class="{"on" if key==active else ""}" href="#">{i(icon,"i--lg")}{label}{extra}</a>'
    return f"""<nav class="m-tabs">{t('overview','Overview','grid')}{t('changes','Changes','checks','<span class="dotb" style="background:#fff;width:auto;height:16px;border-radius:8px;padding:0 5px;font-size:10px;color:#000;display:grid;place-items:center;top:2px">2</span>')}{t('website','Website','globe')}</nav>"""


def screen_overview_mobile():
    setup = f'<div class="m-setup">{setup_card_prepay()}</div>'
    return head("Overview — mobile", 390) + f"""<div class="m">{mobile_top()}<main class="m-main">{overview_header(True)}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 16px"><span class="btn btn--primary">Open preview</span><span class="btn btn--outline">Launch · £39/mo</span></div>
{setup}{bento()}</main>{mobile_tabs()}</div>""" + foot()


def screen_website_mobile():
    # Desktop layout scaled to fit the phone width: 1280 → 358 = 0.2797
    inner = f"""<div class="browser" style="width:1280px"><div class="browser__bar"><span class="browser__dots"><i></i><i></i><i></i></span><span class="browser__url">northgatebarbers.co.uk</span></div>
<div class="dsite"><div class="dsite__nav"><span class="brand"><span style="width:30px;height:30px;display:block">{LOGO}</span>NORTHGATE</span><span class="links"><span>Services</span><span>Barbers</span><span>Gallery</span><span>Contact</span></span><span class="cta">Book now</span></div>
<div class="dsite__hero"><div class="dsite__hero-in"><div class="dsite__h">Sharp cuts.<br>No fuss.</div><p class="dsite__p">Skin fades, classic cuts and hot towel shaves on Northgate.</p><div class="dsite__btns"><span style="background:#c9a24a;color:#141414">Book now</span></div></div></div>
<div class="dsite__cols"><div class="dsite__card"><div class="site__sec-h" style="font-size:22px">Services</div><div class="site__row" style="font-size:13px"><span>Skin fade</span><b>£24</b></div><div class="site__row" style="font-size:13px"><span>Classic cut</span><b>£20</b></div><div class="site__row" style="font-size:13px"><span>Beard trim</span><b>£12</b></div></div><div class="dsite__card"><div class="site__sec-h" style="font-size:22px">Opening hours</div><div class="site__row" style="font-size:13px"><span>Mon – Fri</span><span>9:00 – 18:00</span></div><div class="site__row" style="font-size:13px"><span>Saturday</span><span>8:30 – 16:00</span></div></div></div>
<div style="height:260px"></div></div></div>"""
    return head("Website desktop-mode — mobile", 390) + f"""<div class="m">{mobile_top()}<main class="m-main">
<header class="head" style="margin-bottom:14px"><div><span class="eyebrow">Website</span><h1>Your website preview</h1></div></header>
<div style="display:grid;gap:8px;margin-bottom:12px">
  <div class="seg" style="display:grid;grid-template-columns:1fr 1fr"><span class="on">{i('globe','i--sm')}Website</span><span>{i('cal','i--sm')}Booking</span></div>
  <div class="seg" style="display:grid;grid-template-columns:1fr 1fr"><span>{i('phone','i--sm')}Phone</span><span class="on">{i('monitor','i--sm')}Desktop</span></div>
</div>
<div class="stagebox" style="padding:0;display:block;justify-items:start;overflow:hidden;height:270px;position:relative">
  <div style="transform:scale(0.2797);transform-origin:0 0;width:1280px">{inner}</div>
  <span class="pill" style="position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.7)">{i('monitor','i--xs')}1280px · scaled to fit</span>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><span class="btn btn--outline btn--sm">{i('ext','i--sm')}Full screen</span><span class="btn btn--outline btn--sm">{i('msgplus','i--sm')}Suggest</span></div>
<p class="wtoolbar__note" style="margin-top:12px">{i('lock','i--xs')}Test bookings only — no payments are taken.</p>
</main>{mobile_tabs('website')}</div>""" + foot()


def screen_colours_mobile():
    return head("Brand colours — mobile", 390) + f"""<div class="m" style="height:844px;overflow:hidden">{mobile_top()}<main class="m-main" style="filter:brightness(.4)">{overview_header(True)}{bento()}</main>
<div class="sheet"><div class="sheet__grab"></div>
<div class="sheet__bar"><span class="tile__icon">{i('palette','i--sm')}</span><div class="window__title">Brand colours</div><span class="iconbtn" style="margin-left:auto">{i('x','i--sm')}</span></div>
<div class="sheet__body">
  <div class="livep" style="margin-bottom:12px"><div class="livep__hero" style="height:118px;background:radial-gradient(90% 90% at 85% 0%,rgba(201,162,74,.35),transparent 55%),linear-gradient(160deg,#1f6f6b,#0f3b39 60%,#0b1f1e)"><div class="livep__h" style="color:#f2e8d5;font-size:28px">Sharp cuts. No fuss.</div><div class="livep__btns"><span style="background:#c9a24a;color:#141414">Book now</span></div></div></div>
  <div class="cp__label">Found in your logo</div>
  <div style="display:flex;gap:8px;margin-bottom:14px">
    <div style="flex:1;text-align:center"><div style="height:48px;border-radius:12px;background:#1f6f6b;box-shadow:0 0 0 2px #fff"></div><div style="font-size:11px;margin-top:5px;font-weight:650">Main</div></div>
    <div style="flex:1;text-align:center"><div style="height:48px;border-radius:12px;background:#c9a24a;box-shadow:0 0 0 2px rgba(255,255,255,.5)"></div><div style="font-size:11px;margin-top:5px;font-weight:650">Accent</div></div>
    <div style="flex:1;text-align:center"><div style="height:48px;border-radius:12px;background:#141414;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)"></div><div style="font-size:11px;margin-top:5px;color:var(--muted-2)">Ink</div></div>
    <div style="flex:1;text-align:center"><div style="height:48px;border-radius:12px;background:#f2e8d5"></div><div style="font-size:11px;margin-top:5px;color:var(--muted-2)">Cream</div></div>
  </div>
  <div class="seg" style="display:grid;grid-template-columns:1fr 1fr;margin-bottom:14px"><span class="on">Main colour</span><span>Accent</span></div>
  <div class="tuner">
    <div><div class="slider__top"><span>Lighter</span><b>Depth</b><span>Deeper</span></div><div class="track" style="background:linear-gradient(90deg,#6cc0ba,#1f6f6b,#0a2a28)"><span class="thumb" style="left:46%;background:#1f6f6b"></span></div></div>
    <div><div class="slider__top"><span>Muted</span><b>Intensity</b><span>Vivid</span></div><div class="track" style="background:linear-gradient(90deg,#4a5a59,#1f6f6b,#008a80)"><span class="thumb" style="left:55%;background:#1f6f6b"></span></div></div>
    <div class="check-ok">{i('check','i--sm')}Text on your buttons is easy to read</div>
  </div>
</div>
<div class="sheet__foot"><span class="btn btn--primary">{i('send','i--sm')}Send colours to KERSIVO</span><span class="btn btn--ghost btn--sm">Let KERSIVO choose</span></div>
</div></div>""" + foot()


def screen_cards():
    col = lambda title, desc, card: f"""<div style="width:256px"><div class="eyebrow" style="margin-bottom:6px">{title}</div><p style="color:var(--muted);font-size:12.5px;margin:0 0 12px;min-height:54px">{desc}</p><div style="padding:14px;border-radius:18px;background:#070707;border:1px solid var(--hair)">{card}</div></div>"""
    return head("Sidebar setup card — states", 1000) + f"""<div style="padding:36px;display:flex;gap:28px;background:var(--bg)">
{col('1 · Before payment','Preview hub. Steps open the matching app (Logo → upload, Services → review card…). Services/Team/Hours unlock at Review.', setup_card_prepay())}
{col('2 · Paid, not live','Launch checklist (business details, domain, payments, approve). Same card, new steps.', setup_card_launch())}
{col('3 · Live — real admin','Full dashboard. Card disappears when all 3 are done or the owner dismisses it.', setup_card_live())}
</div>""" + foot()


def screen_messages_desktop():
    bubbles = f"""
<div style="text-align:center;font-size:11.5px;color:var(--muted-2);margin:4px 0 14px">Yesterday</div>
<div style="display:flex;justify-content:flex-end;margin-bottom:12px"><div><div style="padding:10px 12px;border-radius:14px 4px 14px 14px;background:color-mix(in srgb,var(--accent) 22%,#141414);border:1px solid rgba(215,38,56,.35);max-width:420px">Here are a few photos of the shop and the new price board.</div><div style="display:flex;gap:6px;justify-content:flex-end;margin-top:6px"><span style="width:64px;height:48px;border-radius:8px;background:linear-gradient(135deg,#1f6f6b,#0b1f1e)"></span><span style="width:64px;height:48px;border-radius:8px;background:linear-gradient(135deg,#3a2f1d,#c9a24a)"></span></div><div class="msg__meta" style="text-align:right">You · 16:42 · Seen</div></div></div>
<div style="text-align:center;font-size:11.5px;color:var(--muted-2);margin:4px 0 14px">Today</div>
<div class="msg" style="margin-bottom:12px"><span class="msg__av">K</span><div><div class="msg__bubble" style="max-width:460px">Your preview is ready. We've used the photos you sent for the top of the page — let me know if you'd like a different one.</div><div class="msg__meta">KERSIVO · 11:05</div></div></div>"""
    w = f"""<div class="scrim"></div><div class="window" style="width:720px">
  <div class="window__bar"><span class="tile__icon">{i('msg','i--sm')}</span><div><div class="window__title">Messages</div><div class="window__crumb">We reply here and by email</div></div><span class="iconbtn" style="margin-left:auto">{i('x','i--sm')}</span></div>
  <div class="window__body" style="height:420px">{bubbles}</div>
  <div class="window__foot"><span class="iconbtn">{i('clip','i--sm')}</span><div class="composer-fake" style="flex:1;margin:0;height:42px">Write a message…</div><span class="btn btn--primary">{i('send','i--sm')}Send</span></div>
</div>"""
    return head("Messages — desktop", 1440) + f'<div class="app">{sidebar()}<main class="main">{overview_header()}{bento()}</main></div>' + w + foot()


SCREENS = {
    "01-overview-desktop": (screen_overview_desktop, 1440, 1180),
    "02-brand-colours-desktop": (screen_colours_desktop, 1440, 900),
    "03-website-desktop": (screen_website_desktop, 1440, 1000),
    "04-overview-mobile": (screen_overview_mobile, 390, None),
    "05-website-desktop-mode-mobile": (screen_website_mobile, 390, 844),
    "06-setup-card-states": (screen_cards, 900, 520),
    "07-brand-colours-mobile": (screen_colours_mobile, 390, 844),
    "08-messages-desktop": (screen_messages_desktop, 1440, 900),
}

if __name__ == "__main__":
    for name, (fn, _, _) in SCREENS.items():
        (OUT / f"{name}.html").write_text(fn(), encoding="utf-8")
    print("built", len(SCREENS))
