const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const empresas = [
  {
    id: 1,
    nome: 'Barbearia Vintage',
    endereco: 'Rua das Flores, 123',
    paymentMethods: [
      { id: 'pix', nome: 'Pix' },
      { id: 'credito', nome: 'Cartão de Crédito' },
    ],
  },
  {
    id: 2,
    nome: 'Barbearia Moderna',
    endereco: 'Av. Central, 456',
    paymentMethods: [
      { id: 'pix', nome: 'Pix' },
      { id: 'debito', nome: 'Cartão de Débito' },
    ],
  },
  {
    id: 3,
    nome: 'Barbearia Premium',
    endereco: 'Rua do Comércio, 789',
    paymentMethods: [
      { id: 'pix', nome: 'Pix' },
      { id: 'credito', nome: 'Cartão de Crédito' },
      { id: 'debito', nome: 'Cartão de Débito' },
    ],
  },
];

const servicos = [
  { id: 1, nome: 'Corte Masculino', descricao: 'Corte tradicional com acabamento na navalha', preco: 40, duracaoMinutos: 30 },
  { id: 2, nome: 'Corte + Barba', descricao: 'Corte completo com barba desenhada', preco: 65, duracaoMinutos: 50 },
  { id: 3, nome: 'Hidratação Capilar', descricao: 'Tratamento de hidratação profunda para os fios', preco: 55, duracaoMinutos: 40 },
];

const agendamentos = [];

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
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

function gerarCodigoPix(agendamentoId, valor) {
  const chave = `00020126360014BR.GOV.BCB.PIX0114barbearia@app520400005303986540${valor.toFixed(2)}5802BR5920BARBEARIA APP LTDA6009SAO PAULO62070503***6304${String(agendamentoId).padStart(4, '0')}`;
  return chave;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    serveFile(res, path.join(__dirname, 'index.html'), 'text/html');
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/empresas') {
    sendJson(res, 200, empresas.map(({ id, nome, endereco }) => ({ id, nome, endereco })));
    return;
  }

  const paymentMatch = url.pathname.match(/^\/api\/empresas\/(\d+)\/payment-methods$/);
  if (req.method === 'GET' && paymentMatch) {
    const empresaId = Number(paymentMatch[1]);
    const empresa = empresas.find((e) => e.id === empresaId);
    if (!empresa) {
      sendJson(res, 404, { erro: 'Empresa não encontrada' });
      return;
    }
    sendJson(res, 200, empresa.paymentMethods);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/servicos') {
    sendJson(res, 200, servicos);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/agendamentos') {
    let data;
    try {
      data = await readBody(req);
    } catch (err) {
      sendJson(res, 400, { erro: 'JSON inválido' });
      return;
    }

    const { empresaId, servicoId, nome, data: dataAgendamento, hora } = data;

    if (!empresaId || !servicoId || !nome || !dataAgendamento || !hora) {
      sendJson(res, 400, { erro: 'Campos obrigatórios: empresaId, servicoId, nome, data, hora' });
      return;
    }

    const empresa = empresas.find((e) => e.id === Number(empresaId));
    if (!empresa) {
      sendJson(res, 400, { erro: 'Empresa inválida' });
      return;
    }

    const servico = servicos.find((s) => s.id === Number(servicoId));
    if (!servico) {
      sendJson(res, 400, { erro: 'Serviço inválido' });
      return;
    }

    const agendamento = {
      id: agendamentos.length + 1,
      empresaId: empresa.id,
      empresaNome: empresa.nome,
      servicoId: servico.id,
      servicoNome: servico.nome,
      preco: servico.preco,
      nome,
      data: dataAgendamento,
      hora,
      status: 'pendente',
      formaPagamento: null,
    };
    agendamentos.push(agendamento);

    sendJson(res, 201, { mensagem: 'Agendamento criado com sucesso', agendamento });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/checkout') {
    let data;
    try {
      data = await readBody(req);
    } catch (err) {
      sendJson(res, 400, { erro: 'JSON inválido' });
      return;
    }

    const { agendamentoId, formaPagamento } = data;

    if (!agendamentoId || !formaPagamento) {
      sendJson(res, 400, { erro: 'Campos obrigatórios: agendamentoId, formaPagamento' });
      return;
    }

    const agendamento = agendamentos.find((a) => a.id === Number(agendamentoId));
    if (!agendamento) {
      sendJson(res, 404, { erro: 'Agendamento não encontrado' });
      return;
    }

    const empresa = empresas.find((e) => e.id === agendamento.empresaId);
    const metodoValido = empresa.paymentMethods.some((m) => m.id === formaPagamento);
    if (!metodoValido) {
      sendJson(res, 400, { erro: 'Forma de pagamento não disponível para esta barbearia' });
      return;
    }

    agendamento.formaPagamento = formaPagamento;
    agendamento.status = 'confirmado';

    const resposta = {
      mensagem: 'Pagamento processado com sucesso',
      agendamento,
    };

    if (formaPagamento === 'pix') {
      resposta.pix = {
        codigo: gerarCodigoPix(agendamento.id, agendamento.preco),
        expiraEmMinutos: 15,
      };
    }

    sendJson(res, 200, resposta);
    return;
  }

  sendJson(res, 404, { erro: 'Rota não encontrada' });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
