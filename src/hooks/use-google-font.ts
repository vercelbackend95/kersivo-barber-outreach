import { useEffect } from "react";

/**
 * Injects a Google Fonts stylesheet once for the given family name (e.g. "Antonio").
 */
export function useGoogleFont(family: string) {
  useEffect(() => {
    const param = family.replace(/ /g, "+");
    const id = `google-font-${param}`;
    if (document.getElementById(id)) return;

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${param}:wght@400;600;700;800&display=swap`;
    document.head.appendChild(link);
  }, [family]);
}
