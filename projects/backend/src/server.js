import net from 'node:net';
import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { config } from './config/env.js';

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };

    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
}

async function startServer() {
  await connectDB();

  if (await isPortInUse(config.port)) {
    throw new Error(
      `El puerto ${config.port} ya está en uso. Detén la instancia anterior antes de iniciar FalconSync.`,
    );
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(
      `[FalconSync] API escuchando en http://localhost:${config.port} (PID ${process.pid})`,
    );
  });

  server.on('error', (error) => {
    console.error('[FalconSync] Error del servidor HTTP:', error.message);
    process.exit(1);
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
