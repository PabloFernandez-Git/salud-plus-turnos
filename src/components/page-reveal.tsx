import type { ReactNode } from "react";

import styles from "./page-reveal.module.css";

export function PageReveal({ children }: { children: ReactNode }) {
  return <div className={styles.reveal}>{children}</div>;
}
