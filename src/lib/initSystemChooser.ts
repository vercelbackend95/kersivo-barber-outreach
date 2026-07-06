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

  const activateTile = (tile: Element) => {
    if (tileNavigationInFlight) {
      return;
    }

    const href = tile.getAttribute('data-tile-href');
    if (!href) {
      return;
    }
    tileNavigationInFlight = true;
    setTileLoadingState(tile);

    setTimeout(() => {
      window.open(href, '_blank', 'noopener');
      setTimeout(resetTileLoadingState, 600);
    }, 260);
  };

  tiles.forEach((tile) => {
    if (!(tile instanceof HTMLElement)) {
      return;
    }

    tile.addEventListener('click', () => {
      activateTile(tile);
    });

    tile.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activateTile(tile);
      }
    });
  });
}
