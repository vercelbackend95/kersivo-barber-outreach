export function initSystemChooser(): void {
  const chooser = document.querySelector('[data-system-chooser]');
  const openTriggers = document.querySelectorAll('[data-system-chooser-open]');

  if (!(chooser instanceof HTMLElement) || openTriggers.length === 0) {
    return;
  }

  const closeTriggers = chooser.querySelectorAll('[data-system-chooser-close]');
  const focusTarget = chooser.querySelector('.system-chooser__close');
  let isChooserOpen = false;
  let lastOpenTrigger: HTMLButtonElement | null = null;

  const setChooserOpen = (nextOpen: boolean) => {
    isChooserOpen = nextOpen;
    chooser.hidden = !nextOpen;
    chooser.setAttribute('aria-hidden', String(!nextOpen));
    document.body.classList.toggle('body--modal-open', nextOpen);

    if (nextOpen) {
      window.requestAnimationFrame(() => {
        if (focusTarget instanceof HTMLElement) {
          focusTarget.focus();
        }
      });
    } else if (lastOpenTrigger instanceof HTMLElement) {
      lastOpenTrigger.focus();
    }
  };

  const handleClose = () => {
    if (!isChooserOpen) {
      return;
    }
    setChooserOpen(false);
  };

  setChooserOpen(false);

  openTriggers.forEach((trigger) => {
    if (!(trigger instanceof HTMLButtonElement)) {
      return;
    }

    trigger.addEventListener('click', () => {
      lastOpenTrigger = trigger;
      setChooserOpen(true);
    });
  });

  closeTriggers.forEach((trigger) => {
    trigger.addEventListener('click', handleClose);
  });

  chooser.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
      return;
    }
    if (event.key !== 'Tab' || !isChooserOpen) return;

    // aria-modal requires keyboard focus to stay inside until the chooser closes.
    const focusables = [...chooser.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')]
      .filter((element) => element.getClientRects().length > 0);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || !chooser.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !chooser.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });

  const tiles = chooser.querySelectorAll('[data-tile-href]');
  let tileNavigationInFlight = false;

  const setTileLoadingState = (activeTile: Element) => {
    chooser.classList.add('system-chooser--navigating');
    tiles.forEach((tile) => {
      if (!(tile instanceof HTMLElement)) {
        return;
      }

      const isActive = tile === activeTile;
      tile.classList.toggle('is-loading', isActive);
      tile.setAttribute('aria-busy', String(isActive));
    });
  };

  const resetTileLoadingState = () => {
    tileNavigationInFlight = false;
    chooser.classList.remove('system-chooser--navigating');
    tiles.forEach((t) => {
      if (!(t instanceof HTMLElement)) return;
      t.classList.remove('is-loading');
      t.setAttribute('aria-busy', 'false');
    });
  };

  const activateTile = async (tile: HTMLAnchorElement) => {
    if (tileNavigationInFlight) return;
    const href = tile.getAttribute('href');
    if (!href || !href.startsWith('/')) return;

    tileNavigationInFlight = true;
    setTileLoadingState(tile);

    // Create the new tab within the trusted click/keyboard gesture. Waiting for
    // session checks or a timeout before window.open can trigger popup blocking.
    const newTab = window.open('about:blank', '_blank');
    if (newTab) newTab.opener = null;

    let targetHref = href;
    if (href.startsWith('/admin-demo')) {
      try {
        const response = await fetch('/api/admin/session', { credentials: 'include' });
        if (response.ok) {
          const payload = (await response.json()) as { ok?: boolean; via?: string };
          if (payload.ok && payload.via === 'session') {
            const url = new URL(href, window.location.origin);
            const section = url.searchParams.get('section') || 'bookings_dashboard';
            targetHref = `/admin?section=${encodeURIComponent(section)}`;
          }
        }
      } catch {
        // Continue to the public admin demo when no session lookup is available.
      }
    }

    if (newTab && !newTab.closed) {
      newTab.location.replace(targetHref);
    } else {
      // Popup blockers must not make the demo completely inaccessible.
      window.location.assign(targetHref);
    }
    setTimeout(resetTileLoadingState, 600);
  };

  tiles.forEach((tile) => {
    if (!(tile instanceof HTMLAnchorElement)) return;

    tile.addEventListener('click', (event) => {
      // Allow browser-native middle-click and modifier-click actions on real links.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      void activateTile(tile);
    });

    tile.addEventListener('keydown', (event) => {
      // Enter triggers the native link click. Space is an additional keyboard shortcut.
      if (event.key !== ' ') return;
      event.preventDefault();
      void activateTile(tile);
    });
  });
}
