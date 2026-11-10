const BASE_URL = 'http://10.0.8.136:3000/';

const badgeStatus = document.getElementById('badgeStatus');

// 1. Obtener datos estáticos de la API
fetch(`${BASE_URL}/api/datos`)
  .then((res) => res.json())
  .then((data) => {
    document.getElementById('hostTitle').innerText = `Host: ${data.hostname}`;
    document.getElementById('distroText').innerText = data.distro;
    document.getElementById('kernelText').innerText = data.kernel;
    document.getElementById('cpuModelText').innerText = data.cpuModel;
    document.getElementById('cpuCoresText').innerText = `${data.cpuCores} núcleos`;
    document.getElementById('swapTotalText').innerText = `${data.totalSwapGB} GB`;
  })
  .catch((err) => console.error('Error al cargar datos estáticos:', err));

// 2. Configurar gráfico con Chart.js
const ctx = document.getElementById('resourceChart').getContext('2d');
const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      {
        label: 'CPU %',
        data: [],
        borderColor: '#ffc107',
        tension: 0.2,
        fill: false
      },
      {
        label: 'RAM %',
        data: [],
        borderColor: '#0dcaf0',
        tension: 0.2,
        fill: false
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      y: { min: 0, max: 100, ticks: { callback: (v) => v + '%' } },
      x: { ticks: { maxTicksLimit: 6 } }
    }
  }
});

// 3. Conexión WebSocket
const socket = io(BASE_URL);

socket.on('connect', () => {
  badgeStatus.className = 'badge text-bg-success';
  badgeStatus.innerText = 'En vivo';
});

socket.on('disconnect', () => {
  badgeStatus.className = 'badge text-bg-danger';
  badgeStatus.innerText = 'Desconectado';
});

socket.on('metricas', (data) => {
  document.getElementById('uptimeText').innerText = data.uptime;

  // CPU
  document.getElementById('cpuLoad').innerText = `${data.cpu.load}%`;
  document.getElementById('cpuBar').style.width = `${data.cpu.load}%`;
  document.getElementById('cpuLoadAvg').innerText = `Avg: ${data.cpu.loadAvg}`;

  // RAM
  document.getElementById('ramLoad').innerText = `${data.ram.percentage}%`;
  document.getElementById('ramBar').style.width = `${data.ram.percentage}%`;
  document.getElementById('ramDetail').innerText = `${data.ram.used} / ${data.ram.total} GB`;

  // Disco
  document.getElementById('diskMount').innerText = data.disk.mount;
  document.getElementById('diskLoad').innerText = `${data.disk.percentage}%`;
  document.getElementById('diskBar').style.width = `${data.disk.percentage}%`;
  document.getElementById('diskDetail').innerText = `${data.disk.used} / ${data.disk.total} GB`;

  // Red
  document.getElementById('netRx').innerText = data.network.rx;
  document.getElementById('netTx').innerText = data.network.tx;

  // Top Procesos
  const tbody = document.getElementById('processList');
  tbody.innerHTML = data.processes
    .map(
      (p) => `
      <tr>
        <td><span class="badge text-bg-secondary">${p.pid}</span></td>
        <td class="text-truncate" style="max-width: 120px;">${p.name}</td>
        <td class="text-end">${p.cpu}%</td>
        <td class="text-end">${p.mem}%</td>
      </tr>`
    )
    .join('');

  // Gráfico histórico (máximo 10 puntos para pantalla móvil)
  if (chart.data.labels.length >= 10) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
    chart.data.datasets[1].data.shift();
  }
  chart.data.labels.push(data.timestamp);
  chart.data.datasets[0].data.push(data.cpu.load);
  chart.data.datasets[1].data.push(data.ram.percentage);
  chart.update();
});