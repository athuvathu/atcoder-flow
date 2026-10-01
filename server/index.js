// AtCoder Flow Micro-Server Entry Point
import http from 'node:http';
import { initDb, closeDb, getUserState, getProblems } from './db.js';
import { handleRequest } from './routes.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Initialize SQLite database
console.log('[server] Initializing persistence layer...');
initDb();

const server = http.createServer((req, res) => {
  handleRequest(req, res);
});

// Start listening if run directly
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  server.listen(PORT, HOST, () => {
    const problems = getProblems();
    const userState = getUserState('atrv');
    console.log('====================================================');
    console.log(`  ATCODER FLOW PRACTICE PLATFORM (Port ${PORT})`);
    console.log('====================================================');
    console.log(`  HTTP Server:     http://${HOST}:${PORT}`);
    console.log(`  Problems in DB:  ${problems.length}`);
    console.log(`  Active User:     ${userState.handle} (Streak: ${userState.streak}, Solved: ${userState.solved_count})`);
    console.log(`  Kenkoooo Sync:   Ready (atrv)`);
    console.log('====================================================');
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('\n[server] Shutting down gracefully...');
    server.close(() => {
      closeDb();
      console.log('[server] Server closed and database connection terminated.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export { server };
