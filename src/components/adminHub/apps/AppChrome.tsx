import { createContext, useContext, useEffect, type ComponentType, type ReactNode, type SVGProps } from 'react';

export type AdminHubAppChrome = {
  headerAction: ReactNode | null;
  footer: ReactNode | null;
  /** Window bar overrides while the app shows one part of itself (Add to your website › Business details). */
  title?: string;
  crumb?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
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
  const { headerAction, footer, title, crumb, icon } = chrome;
  useEffect(() => {
    setChrome({ headerAction, footer, title, crumb, icon });
  }, [crumb, footer, headerAction, icon, setChrome, title]);
  useEffect(() => () => setChrome(emptyAppChrome), [setChrome]);
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
