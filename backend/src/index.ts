import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import authRouter from './routes/auth';
import dashboardRouter from './routes/dashboard';
import databaseRouter from './routes/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

const supabaseHost = process.env.SUPABASE_URL || 'https://*.supabase.co';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      fontSrc:     ["'self'", 'data:'],
      imgSrc:      ["'self'", 'data:', 'blob:', supabaseHost],
      mediaSrc:    ["'self'", supabaseHost],
      frameSrc:    ["'self'", supabaseHost],
      objectSrc:   ["'self'", supabaseHost],
      connectSrc:  ["'self'", supabaseHost],
    },
  },
}));
app.use(cors({
  origin: isProd ? false : (process.env.FRONTEND_URL || 'http://localhost:5173'),
  credentials: true,
}));
app.use(express.json());

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth',      authRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/database',  databaseRouter);

if (isProd) {
  const staticPath = path.join(__dirname, '..', 'public');
  app.use(express.static(staticPath));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`✅ SPADIA backend démarré sur http://localhost:${PORT}`);
});

export default app;