import styles from "./app-loader.module.css";

export function AppLoader({ fullScreen = true }: { fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full flex-col items-center justify-center bg-slate-50 px-4 text-slate-950 ${fullScreen ? "min-h-dvh" : "h-full"}`}
    >
      <span aria-hidden="true" className={`${styles.symbol} text-sky-700`} />
      <span aria-hidden="true" className="mt-3.5 text-xl font-semibold">
        Salud Plus
      </span>
      <span className="sr-only">Salud Plus, cargando</span>
    </div>
  );
}
