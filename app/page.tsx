15:55:22.646 Running build in Washington, D.C., USA (East) – iad1
15:55:22.647 Build machine configuration: 2 cores, 8 GB
15:55:22.873 Cloning github.com/antoniavial97-coder/mi-crm (Branch: main, Commit: 19b902f)
15:55:23.743 Cloning completed: 870.000ms
15:55:24.137 Restored build cache from previous deployment (4bn9Mtjdj1VkfvyQ8n6XfLxvQuDS)
15:55:24.352 Running "vercel build"
15:55:25.047 Vercel CLI 53.2.0
15:55:25.430 Installing dependencies...
15:55:26.550 
15:55:26.551 up to date in 868ms
15:55:26.551 
15:55:26.552 143 packages are looking for funding
15:55:26.552   run `npm fund` for details
15:55:26.581 Detected Next.js version: 16.2.3
15:55:26.585 Running "npm run build"
15:55:26.686 
15:55:26.687 > mi-crm@0.1.0 build
15:55:26.687 > next build
15:55:26.687 
15:55:27.399   Applying modifyConfig from Vercel
15:55:27.415 ▲ Next.js 16.2.3 (Turbopack)
15:55:27.416 
15:55:27.445   Creating an optimized production build ...
15:55:32.660 ✓ Compiled successfully in 4.9s
15:55:32.661   Running TypeScript ...
15:55:37.092 Failed to type check.
15:55:37.093 
15:55:37.094 ./app/page.tsx:1037:8
15:55:37.094 Type error: Cannot find name 'AIPendientesPanel'.
15:55:37.094 
15:55:37.094   1035 |       <FiltrosPipeline subStages={P1_SUBSTAGE_ORDER} onFilter={setFiltro}/>
15:55:37.095   1036 |       <DashboardPanels clients={clients} transcripts={transcripts} onEdit={onEdit} onUpd...
15:55:37.095 > 1037 |       <AIPendientesPanel clients={p1} onUpdateTasks={onUpdateTasks} transcripts={transcr...
15:55:37.095        |        ^
15:55:37.095   1038 |       <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
15:55:37.095   1039 |         {P1_SUBSTAGE_ORDER.map(sub=>{
15:55:37.095   1040 |           const items=bySubStage.get(sub)??[];
15:55:37.124 Next.js build worker exited with code: 1 and signal: null
15:55:37.170 Error: Command "npm run build" exited with 1
