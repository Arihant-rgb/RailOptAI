import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import maintenanceRoutes from './routes/maintenanceRoutes.js';
import networkRoutes, { stationsRouter, sectionsRouter } from './routes/networkRoutes.js';
import trainRoutes from './routes/trainRoutes.js';
import blockRoutes from './routes/blockRoutes.js';
import planningRoutes from './routes/planningRoutes.js';
import kpiRoutes from './routes/kpiRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend cross-origin requests
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/stations', stationsRouter);
app.use('/api/sections', sectionsRouter);
app.use('/api/trains', trainRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/replanning', planningRoutes);
app.use('/api/kpis', kpiRoutes);


// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'RailOptAI Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`RailOptAI Backend Server Listening`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`GET Maintenance: http://localhost:${PORT}/api/maintenance`);
  console.log(`=================================`);
});
