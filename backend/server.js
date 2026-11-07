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
app.use(express.static(path.join(__dirname, '../frontend')));

// Función auxiliar para convertir segundos a formato legible
function formatUptime(segundos) {
  const d = Math.floor(segundos / 86400);
  const h = Math.floor((segundos % 86400) / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m`;
}

// 1. Datos estáticos del hardware
app.get('/api/datos', async (req, res) => {
  try {
    const osInfo = await si.osInfo();
    const cpuInfo = await si.cpu();
    const memInfo = await si.mem();

    res.json({
      hostname: osInfo.hostname,
      distro: `${osInfo.distro} ${osInfo.release}`,
      kernel: `${osInfo.kernel} (${osInfo.arch})`,
      cpuModel: `${cpuInfo.manufacturer} ${cpuInfo.brand}`,
      cpuCores: cpuInfo.physicalCores || cpuInfo.cores,
      totalRamGB: (memInfo.total / 1024 ** 3).toFixed(2),
      totalSwapGB: (memInfo.swaptotal / 1024 ** 3).toFixed(2)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 2. Transmisión de métricas en tiempo real
io.on('connection', (socket) => {
  const timer = setInterval(async () => {
    try {
      const [load, mem, time, fsSize, netStats, processes] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.time(),
        si.fsSize(),
        si.networkStats(),
        si.processes()
      ]);

      // Unidad principal (C: en Windows o / en Linux)
      const disco = fsSize[0] || { mount: '/', use: 0, used: 0, size: 0 };
      const red = netStats[0] || { rx_sec: 0, tx_sec: 0 };

      // Top 5 procesos que más CPU consumen
      const listaProcesos = processes.list
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, 5)
        .map((p) => ({
          pid: p.pid,
          name: p.name,
          cpu: p.cpu.toFixed(1),
          mem: p.mem.toFixed(1)
        }));

      socket.emit('metricas', {
        timestamp: new Date().toLocaleTimeString(),
        uptime: formatUptime(time.uptime),
        cpu: {
          load: load.currentLoad.toFixed(1),
          loadAvg: load.avgLoad ? load.avgLoad.toFixed(2) : 'N/A'
        },
        ram: {
          percentage: ((mem.used / mem.total) * 100).toFixed(1),
          used: (mem.used / 1024 ** 3).toFixed(2),
          total: (mem.total / 1024 ** 3).toFixed(2),
          swapUsed: (mem.swapused / 1024 ** 3).toFixed(2),
          swapTotal: (mem.swaptotal / 1024 ** 3).toFixed(2)
        },
        disk: {
          mount: disco.mount,
          percentage: (disco.use || 0).toFixed(1),
          used: (disco.used / 1024 ** 3).toFixed(2),
          total: (disco.size / 1024 ** 3).toFixed(2)
        },
        network: {
          rx: (red.rx_sec / 1024).toFixed(1),
          tx: (red.tx_sec / 1024).toFixed(1)
        },
        processes: listaProcesos
      });
    } catch (err) {
      console.error('Error al emitir métricas:', err.message);
    }
  }, 1500);

  socket.on('disconnect', () => {
    clearInterval(timer);
  });
});

server.listen(3000, () => {
  console.log('Servidor en ejecución en http://localhost:3000');
});