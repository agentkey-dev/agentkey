import openNextWorker from "./.open-next/worker.js";
import { getCanonicalHostResponse } from "./src/lib/canonical-host.ts";
import { runScheduledMaintenance } from "./src/lib/maintenance.ts";

const worker = {
  fetch(request, env, ctx) {
    return getCanonicalHostResponse(request) ?? openNextWorker.fetch(request, env, ctx);
  },
  scheduled(event, env, ctx) {
    ctx.waitUntil(
      runScheduledMaintenance(env.DB, event.scheduledTime).then((result) => {
        console.log(
          JSON.stringify({
            event: "scheduled_maintenance_complete",
            scheduledTime: event.scheduledTime,
            ...result,
          }),
        );
      }),
    );
  },
};

export default worker;
