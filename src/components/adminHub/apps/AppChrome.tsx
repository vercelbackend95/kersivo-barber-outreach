import { createContext, useContext, useEffect, type ReactNode } from 'react';

export type AdminHubAppChrome = {
  headerAction: ReactNode | null;
  footer: ReactNode | null;
};

export const emptyAppChrome: AdminHubAppChrome = { headerAction: null, footer: null };

const AppChromeContext = createContext<(chrome: AdminHubAppChrome) => void>(() => undefined);
const AppLeaveGuardContext = createContext<(active: boolean) => void>(() => undefined);

export function AppChromeProvider(props: {
  setChrome: (chrome: AdminHubAppChrome) => void;
  /** AppHost: asks "Leave without saving?" before closing or switching apps while active. */
  setLeaveGuard?: (active: boolean) => void;
  children: ReactNode;
}) {
  const guard = props.setLeaveGuard;
  const body = <AppChromeContext.Provider value={props.setChrome}>{props.children}</AppChromeContext.Provider>;
  return guard ? <AppLeaveGuardContext.Provider value={guard}>{body}</AppLeaveGuardContext.Provider> : body;
}

export function useAppChrome(chrome: AdminHubAppChrome) {
  const setChrome = useContext(AppChromeContext);
  const { headerAction, footer } = chrome;
  useEffect(() => {
    setChrome({ headerAction, footer });
    return () => setChrome(emptyAppChrome);
  }, [footer, headerAction, setChrome]);
}

/**
 * The app has unsaved edits: closing it, switching app from the sidebar or going Back first asks the owner
 * (AppHost shows the dialog). A full page unload is the app's own beforeunload listener.
 */
export function useAppLeaveGuard(active: boolean) {
  const setGuard = useContext(AppLeaveGuardContext);
  useEffect(() => {
    setGuard(active);
    return () => setGuard(false);
  }, [active, setGuard]);
}
