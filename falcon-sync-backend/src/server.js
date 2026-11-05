import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { config } from './config/env.js';

async function startServer() {
  await connectDB();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(
      `[FalconSync] API escuchando en http://localhost:${config.port}`,
    );
  });

  const shutdown = (signal) => {
    console.log(`[FalconSync] Cerrando por ${signal}...`);

    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((error) => {
  console.error('[FalconSync] No se pudo iniciar la API:', error);
  process.exit(1);
});
