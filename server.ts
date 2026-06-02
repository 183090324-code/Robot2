import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleApiRoute } from './src/server/apiHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000; // Hardcoded port 3000 required by infrastructure

  app.use(express.json({ limit: '20mb' }));

  // API Route redirection to our Gemini Service
  app.post('/api/tutor/*', async (req, res) => {
    try {
      const result = await handleApiRoute(req.path, req.body);
      res.status(result.status).json(result.data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Internal Server Error' });
    }
  });

  // Smart production mode checking based on file-type or environment
  const isProd = process.env.NODE_ENV === 'production' || __filename.endsWith('.cjs') || __filename.includes('dist');

  if (isProd) {
    console.log('启动生产环境：静态资源服务模式。');
    // In production, serve index.html and assets directly
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log('启动开发环境：Vite 中间件调试模式。');
    // In development mode, load Vite dynamically in middleware mode
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    // Use Vite's connect middleware to handle asset serving and hot reloading
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`码上建智能实训平台运行在: http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Express 服务启动失败:", err);
});
