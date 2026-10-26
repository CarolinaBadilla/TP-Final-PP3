const BASE_URL = window.location.protocol.startsWith('http') 
  ? window.location.origin 
  : 'http://localhost:3000';

const badgeStatus = document.getElementById('badgeStatus');

// 1. Cargar datos estáticos desde la API REST
fetch(`${BASE_URL}/api/datos`)
  .then((res) => res.json())
  .then((data) => {
    document.getElementById('hostTitle').innerText = `Host: ${data.hostname}`;
    document.getElementById('distroText').innerText = data.distro;
    document.getElementById('kernelText').innerText = `Kernel ${data.kernel} (${data.arch})`;
    document.getElementById('cpuModelText').innerText = data.cpuModel;
    document.getElementById('cpuCoresText').innerText = `${data.cpuCores} núcleos`;
  })
  .catch((err) => console.error('Error cargando API:', err));

// 2. Gráfico en tiempo real con Chart.js
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
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        tension: 0.3,
        fill: true
      },
      {
        label: 'RAM %',
        data: [],
        borderColor: '#0dcaf0',
        backgroundColor: 'rgba(13, 202, 240, 0.1)',
        tension: 0.3,
        fill: true
      }
    ]
  },
  options: {
    responsive: true,
    animation: false,
    scales: {
      y: { min: 0, max: 100, ticks: { callback: (val) => val + '%' } },
      x: { ticks: { maxTicksLimit: 8 } }
    }
  }
});

// 3. WebSockets con Socket.IO
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
  // Actualizar textos y barras
  document.getElementById('uptimeText').innerText = data.uptime;
  
  document.getElementById('cpuLoad').innerText = `${data.cpu.load}%`;
  document.getElementById('cpuBar').style.width = `${data.cpu.load}%`;

  document.getElementById('ramLoad').innerText = `${data.ram.percentage}%`;
  document.getElementById('ramBar').style.width = `${data.ram.percentage}%`;
  document.getElementById('ramDetail').innerText = `${data.ram.used} / ${data.ram.total} GB`;

  document.getElementById('diskMount').innerText = data.disk.mount;
  document.getElementById('diskLoad').innerText = `${data.disk.percentage}%`;
  document.getElementById('diskBar').style.width = `${data.disk.percentage}%`;
  document.getElementById('diskDetail').innerText = `${data.disk.used} / ${data.disk.total} GB`;

  document.getElementById('netRx').innerText = data.network.rx;
  document.getElementById('netTx').innerText = data.network.tx;

  // Actualizar histórico del gráfico (máximo 12 puntos)
  if (chart.data.labels.length >= 12) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
    chart.data.datasets[1].data.shift();
  }
  chart.data.labels.push(data.timestamp);
  chart.data.datasets[0].data.push(data.cpu.load);
  chart.data.datasets[1].data.push(data.ram.percentage);
  chart.update();
});