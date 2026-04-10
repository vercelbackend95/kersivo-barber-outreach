import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Simple vertical mask reveal for headline text (Hero227-style).
 */
export default function VerticalCutReveal({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block overflow-hidden align-top">
      <motion.span
        className="inline-block"
        initial={{ y: "110%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.55, ease: [0.33, 1, 0.68, 1] }}
      >
        {children}
      </motion.span>
    </span>
  );
}
