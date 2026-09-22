import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const playtest = await server.ssrLoadModule("/app/playtest.tsx");
  const report = playtest.runPlaytestRuntimeCertification();
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) {
    console.error(`Playtest runtime certification FAILED (${report.failures.length} failures)`);
    process.exitCode = 1;
  } else {
    console.error(`Playtest runtime certification PASS — ${report.behaviorallyCertifiedEffects}/${report.structuredEffects} effects behaviorally certified through Playtest/module routes; ${report.outOfModeEffects} out-of-mode; 0 route failures.`);
  }
} finally {
  await server.close();
}
