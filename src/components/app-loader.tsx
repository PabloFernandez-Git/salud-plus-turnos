import styles from "./app-loader.module.css";

export function AppLoader({ fullScreen = true }: { fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${styles.loader} flex w-full flex-col items-center justify-center bg-slate-50 px-4 text-slate-950 ${fullScreen ? "fixed inset-0" : "h-full"}`}
    >
      <div className={`${styles.content} flex flex-col items-center`}>
        <span aria-hidden="true" className={`${styles.symbol} text-sky-700`} />
        <span aria-hidden="true" className="mt-3 text-lg leading-6 font-semibold">
          Salud Plus
        </span>
        <span className="sr-only">Salud Plus, cargando</span>
      </div>
    </div>
  );
}
