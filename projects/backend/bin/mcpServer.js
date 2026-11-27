// stdio reserva stdout para el protocolo MCP. Cualquier log accidental debe
// salir por stderr para no corromper los mensajes JSON-RPC.
console.log = (...args) => console.error(...args);

const { connectDB, disconnectDB } = await import('../databases/db.js');
const { createMcpServer } = await import('../microservices/mcp/server.js');
const { StdioServerTransport } = await import(
  '@modelcontextprotocol/sdk/server/stdio.js'
);

async function main() {
  await connectDB();
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error('[FalconSync MCP] Servidor stdio listo.');

  const shutdown = async (signal) => {
    console.error(`[FalconSync MCP] Cerrando por ${signal}...`);
    try {
      await server.close();
    } finally {
      await disconnectDB();
      process.exit(0);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch(async (error) => {
  console.error('[FalconSync MCP] No se pudo iniciar:', error);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
