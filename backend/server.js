import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import si from 'systeminformation';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());

// Servir la carpeta frontend situada al mismo nivel del backend
app.use(express.static(path.join(__dirname, '../frontend')));

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m`;
}

// 1. API REST: Información estática
app.get('/api/datos', async (req, res) => {
  try {
    const [osInfo, cpuInfo, memInfo] = await Promise.all([
      si.osInfo(),
      si.cpu(),
      si.mem()
    ]);

    res.json({
      hostname: osInfo.hostname,
      distro: `${osInfo.distro} ${osInfo.release}`,
      kernel: osInfo.kernel,
      arch: osInfo.arch,
      cpuModel: `${cpuInfo.manufacturer} ${cpuInfo.brand}`,
      cpuCores: cpuInfo.physicalCores || cpuInfo.cores,
      totalRamGB: (memInfo.total / 1024 / 1024 / 1024).toFixed(2)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta comodín para Express 5
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 2. WebSockets: Métricas en tiempo real
io.on('connection', (socket) => {
  const interval = setInterval(async () => {
    try {
      const [load, mem, time, fsSize, netStats] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.time(),
        si.fsSize(),
        si.networkStats()
      ]);

      const disk = fsSize[0] || { size: 0, used: 0, use: 0, mount: '/' };
      const net = netStats[0] || { rx_sec: 0, tx_sec: 0 };

      socket.emit('metricas', {
        timestamp: new Date().toLocaleTimeString(),
        uptime: formatUptime(time.uptime),
        cpu: {
          load: (load.currentLoad || 0).toFixed(1)
        },
        ram: {
          used: (mem.used / 1024 / 1024 / 1024).toFixed(2),
          total: (mem.total / 1024 / 1024 / 1024).toFixed(2),
          percentage: ((mem.used / mem.total) * 100).toFixed(1)
        },
        disk: {
          mount: disk.mount,
          percentage: (disk.use || 0).toFixed(1),
          used: (disk.used / 1024 / 1024 / 1024).toFixed(2),
          total: (disk.size / 1024 / 1024 / 1024).toFixed(2)
        },
        network: {
          rx: ((net.rx_sec || 0) / 1024).toFixed(1),
          tx: ((net.tx_sec || 0) / 1024).toFixed(1)
        }
      });
    } catch (err) {
      console.error('Error al leer métricas:', err.message);
    }
  }, 1500);

  socket.on('disconnect', () => clearInterval(interval));
});

server.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});