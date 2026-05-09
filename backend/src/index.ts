import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import dashboardRouter from './routes/dashboard';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth',      authRouter);
app.use('/api/v1/dashboard', dashboardRouter);

app.listen(PORT, () => {
  console.log(`✅ SPADIA backend démarré sur http://localhost:${PORT}`);
});

export default app;