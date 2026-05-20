const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5045;

app.use((req, _res, next) => {
  const start = Date.now();
  _res.on('finish', () => console.log(`${req.method} ${req.originalUrl} -> ${_res.statusCode} (${Date.now() - start}ms)`));
  next();
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'clag' }));

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  },
}));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`clag on port ${PORT}`));
