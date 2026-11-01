import { createContext, useContext, useEffect, type ReactNode } from 'react';

export type AdminHubAppChrome = {
  headerAction: ReactNode | null;
  footer: ReactNode | null;
};

export const emptyAppChrome: AdminHubAppChrome = { headerAction: null, footer: null };

const AppChromeContext = createContext<(chrome: AdminHubAppChrome) => void>(() => undefined);

export function AppChromeProvider(props: {
  setChrome: (chrome: AdminHubAppChrome) => void;
  children: ReactNode;
}) {
  return <AppChromeContext.Provider value={props.setChrome}>{props.children}</AppChromeContext.Provider>;
}

export function useAppChrome(chrome: AdminHubAppChrome) {
  const setChrome = useContext(AppChromeContext);
  const { headerAction, footer } = chrome;
  useEffect(() => {
    setChrome({ headerAction, footer });
    return () => setChrome(emptyAppChrome);
  }, [footer, headerAction, setChrome]);
}
