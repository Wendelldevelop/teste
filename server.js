const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const empresas = [
  { id: 1, nome: 'Barbearia Vintage' },
  { id: 2, nome: 'Barbearia Moderna' },
];

const paymentMethods = [
  { id: 'pix', nome: 'Pix' },
  { id: 'credito', nome: 'Crédito' },
];

const agendamentos = [];

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    serveFile(res, path.join(__dirname, 'public', 'index.html'), 'text/html');
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/empresas') {
    sendJson(res, 200, empresas);
    return;
  }

  const paymentMatch = url.pathname.match(/^\/api\/empresas\/(\d+)\/payment-methods$/);
  if (req.method === 'GET' && paymentMatch) {
    sendJson(res, 200, paymentMethods);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/agendamentos') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      let data;
      try {
        data = JSON.parse(body || '{}');
      } catch (err) {
        sendJson(res, 400, { erro: 'JSON inválido' });
        return;
      }

      const { nome, data: dataAgendamento, formaPagamento } = data;

      if (!nome || !dataAgendamento || !formaPagamento) {
        sendJson(res, 400, { erro: 'Campos obrigatórios: nome, data, formaPagamento' });
        return;
      }

      const agendamento = {
        id: agendamentos.length + 1,
        nome,
        data: dataAgendamento,
        formaPagamento,
      };
      agendamentos.push(agendamento);

      sendJson(res, 201, { mensagem: 'Agendamento criado com sucesso', agendamento });
    });
    return;
  }

  sendJson(res, 404, { erro: 'Rota não encontrada' });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
