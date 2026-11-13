// Local visual preview of the real Portfolio shell with synthetic, read-only data.
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { createServer } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const root = resolve(".");
const temporary = mkdtempSync(join(tmpdir(), "portfolio-sidebar-preview-"));
symlinkSync(resolve("node_modules"), join(temporary, "node_modules"), "junction");
const write = (name, contents) => writeFileSync(join(temporary, name), contents);

write(
  "index.html",
  '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/entry.tsx"></script>',
);
write(
  "link.tsx",
  "import React from 'react'; export default function Link({href,children,...props}) { return <a href={href} {...props}>{children}</a>; } export function useLinkStatus(){return {pending:false}};",
);
write(
  "navigation.ts",
  "const router={refresh(){}}; export function usePathname(){return location.pathname} export function useRouter(){return router}",
);
write("auth-actions.ts", "export async function logoutAction(){return {status:'idle'}}");
write("navigation-loader.tsx", "export function NavigationLoader(){return null}");
write(
  "dashboard-actions.ts",
  `let calls=0; export async function refreshDailyDashboardAction(){
  calls++; if(calls>1) await new Promise(resolve=>setTimeout(resolve,650));
  return {status:'success',data:{scope:'staff',role:'ADMIN',membershipId:'member',activeTotal:3,toAttend:2,
    row:{as_of:'2026-11-13T15:00:00Z',local_date:'2026-11-13',timezone:'America/Argentina/Buenos_Aires',
      pending_count:1,confirmed_count:1,attended_count:1,no_show_count:0,cancelled_count:0,
      professional_centers_with_appointments_count:2,upcoming:[]}}};
}`,
);
write(
  "entry.tsx",
  `import React from 'react';
import {createRoot} from 'react-dom/client';
import {CenterSidebar} from '@/modules/access/components/center-sidebar';
import {CenterHeader} from '@/modules/access/components/center-header';
import {CenterDashboard} from '@/modules/access/components/center-dashboard';
import {ModuleHeader} from '@/components/module-header';
import '@/app/globals.css';
const centerId='11111111-1111-4111-8111-111111111111';
const module=location.pathname.split('/')[3];
const guest=new URLSearchParams(location.search).get('guest')!=='false';
const titles={agenda:'Agenda',appointments:'Turnos',patients:'Pacientes',professionals:'Profesionales',availability:'Disponibilidad',specialties:'Especialidades',users:'Gestión de usuarios',settings:'Configuración del centro'};
createRoot(document.getElementById('root')).render(
  <div className='center-layout grid min-h-dvh grid-rows-[auto_auto_minmax(0,1fr)] bg-slate-100/80'>
    <div className='border-b border-sky-200 bg-sky-50 px-5 py-2 text-center text-sm font-medium text-sky-900'>Estás explorando una versión de demostración con datos ficticios. Las funciones de creación y edición están deshabilitadas.</div>
    <CenterHeader centerId={centerId} centerName='Centro Médico Salud Plus' user={{id:'user',firstName:guest?'Visitante':'Ana',lastName:guest?'Demo':'Pérez',email:guest?'guest+example@guest.salud-plus.invalid':'ana@example.test'}} role='ADMIN' isPlatformAdmin={false} isPortfolioDemo/>
    <div className='min-w-0 md:flex'>
      <CenterSidebar centerId={centerId} role='ADMIN'/>
      <div className='min-w-0 flex-1'>
        {module ? <main className='px-5 py-8 sm:px-8 sm:py-10'><div className='mx-auto max-w-[1400px] space-y-5'><ModuleHeader centerId={centerId} title={location.pathname.split('/')[4]?'Detalle del turno':titles[module]||'Detalle'} description='Vista visual con datos sintéticos' parent={location.pathname.split('/')[4]?{label:'Turnos',href:'/centers/'+centerId+'/appointments'}:undefined}/><p className='text-sm text-slate-500'>Vista local de navegación sin conexión a Supabase.</p></div></main>
          : <CenterDashboard centerId={centerId} membershipId='member' role='ADMIN'/>}
      </div>
    </div>
  </div>);
`,
);

const server = await createServer({
  configFile: false,
  root: temporary,
  cacheDir: join(temporary, ".vite"),
  envDir: temporary,
  css: { postcss: root },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      { find: "next/link", replacement: join(temporary, "link.tsx") },
      { find: "next/navigation", replacement: join(temporary, "navigation.ts") },
      {
        find: "../actions/daily-dashboard-actions",
        replacement: join(temporary, "dashboard-actions.ts"),
      },
      { find: "../actions/auth-actions", replacement: join(temporary, "auth-actions.ts") },
      {
        find: "@/components/navigation-loader",
        replacement: join(temporary, "navigation-loader.tsx"),
      },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 3017, strictPort: true, fs: { allow: [root, temporary] } },
});

await server.listen();
console.log(
  "Portfolio visual preview: http://127.0.0.1:3017/centers/11111111-1111-4111-8111-111111111111",
);
async function close() {
  await server.close();
  rmSync(temporary, { recursive: true, force: true });
}
process.once("SIGINT", () => void close().then(() => process.exit(0)));
process.once("SIGTERM", () => void close().then(() => process.exit(0)));
