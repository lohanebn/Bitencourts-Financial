// =====================================================================
// BITENCOURT'S FINANCIAL - APLICAÇÃO FRONTEND (Vanilla JS)
// =====================================================================

const API = '/api';

// Estado global simples
const Estado = {
  usuarios: [],
  cartoes: [],
  paginaAtual: 'dashboard',
  exclusaoPendente: null,
  periodo: { periodo: 'mes', mes: new Date().getMonth() + 1, ano: new Date().getFullYear() },
  authToken: localStorage.getItem('bitencourts_auth_token') || '',
  usuarioAuth: null,
  loginEmAndamento: false,
  usuarioEdicao: null
};

const AUTH_STORAGE_KEY = 'bitencourts_auth_token';

function salvarToken(token) {
  Estado.authToken = token;
  localStorage.setItem(AUTH_STORAGE_KEY, token);
}

function limparToken() {
  Estado.authToken = '';
  Estado.usuarioAuth = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function mostrarTelaLogin(mensagem = '', tipo = 'info') {
  const loginShell = document.getElementById('loginShell');
  const appShell = document.getElementById('appShell');
  if (loginShell) loginShell.style.display = 'flex';
  if (appShell) appShell.style.display = 'none';
  const mensagemEl = document.getElementById('loginMensagem');
  if (mensagemEl) {
    mensagemEl.textContent = mensagem;
    mensagemEl.className = `login-mensagem ${tipo}`;
  }
}

function mostrarTelaApp() {
  const loginShell = document.getElementById('loginShell');
  const appShell = document.getElementById('appShell');
  if (loginShell) loginShell.style.display = 'none';
  if (appShell) appShell.style.display = 'flex';
}

function mostrarTrocaSenha(mensagem = '') {
  document.getElementById('formLogin').style.display = 'none';
  document.getElementById('formTrocaSenha').style.display = 'block';
  const mensagemEl = document.getElementById('loginMensagem');
  if (mensagemEl) {
    mensagemEl.textContent = mensagem;
    mensagemEl.className = 'login-mensagem info';
  }
}

function voltarParaLogin() {
  document.getElementById('formLogin').style.display = 'block';
  document.getElementById('formTrocaSenha').style.display = 'none';
}

function controlesPeriodo(prefixo) {
  const p=Estado.periodo;
  const tipoAtual = p.periodo || 'mes';
  const estiloSe = (campo) => campo===tipoAtual ? '' : 'display:none';
  return `<select class="campo-select" id="${prefixo}TipoPeriodo"><option value="mes">Mês/Ano</option><option value="ano">Ano completo</option><option value="todo">Todo período</option><option value="personalizado">Período personalizado</option></select>
    <span class="campo-periodo" data-periodo-prefixo="${prefixo}" data-periodo-campo="mes" style="${estiloSe('mes')}">
      <input class="campo-input" type="month" id="${prefixo}Mes" value="${p.ano}-${String(p.mes).padStart(2,'0')}">
    </span>
    <span class="campo-periodo" data-periodo-prefixo="${prefixo}" data-periodo-campo="ano" style="${estiloSe('ano')}">
      <input class="campo-input" type="number" id="${prefixo}Ano" value="${p.ano}" min="2000" max="2200">
    </span>
    <span class="campo-periodo campo-periodo-duplo" data-periodo-prefixo="${prefixo}" data-periodo-campo="personalizado" style="${estiloSe('personalizado')}">
      <input class="campo-input" type="date" id="${prefixo}Inicio" value="${p.data_inicio||''}">
      <input class="campo-input" type="date" id="${prefixo}Fim" value="${p.data_fim||''}">
    </span>`;
}

// Mostra/esconde os campos de mês, ano ou período personalizado conforme o tipo selecionado,
// com uma transição suave (fade) para não gerar um "salto" abrupto no layout.
function definirVisibilidadeCampoPeriodo(el, visivel) {
  if (!el) return;
  if (visivel) {
    el.style.display = '';
    requestAnimationFrame(() => el.classList.remove('campo-periodo-oculto'));
  } else {
    el.classList.add('campo-periodo-oculto');
    window.setTimeout(() => {
      if (el.classList.contains('campo-periodo-oculto')) el.style.display = 'none';
    }, 160);
  }
}

function aplicarVisibilidadePeriodo(prefixo) {
  const tipoEl = document.getElementById(`${prefixo}TipoPeriodo`);
  if (!tipoEl) return;
  const tipo = tipoEl.value;
  document.querySelectorAll(`[data-periodo-prefixo="${prefixo}"]`).forEach(el => {
    definirVisibilidadeCampoPeriodo(el, el.getAttribute('data-periodo-campo') === tipo);
  });
}

// Define o valor inicial do seletor de período e liga a troca automática de visibilidade dos campos.
function inicializarControlesPeriodo(prefixo) {
  const tipoEl = document.getElementById(`${prefixo}TipoPeriodo`);
  if (!tipoEl) return;
  tipoEl.value = Estado.periodo.periodo;
  aplicarVisibilidadePeriodo(prefixo);
  tipoEl.addEventListener('change', () => aplicarVisibilidadePeriodo(prefixo));
}

function lerPeriodo(prefixo) {
  const tipo=document.getElementById(`${prefixo}TipoPeriodo`).value;
  const partes=(document.getElementById(`${prefixo}Mes`).value||'').split('-');
  Estado.periodo={periodo:tipo,ano:Number(tipo==='mes'?partes[0]:document.getElementById(`${prefixo}Ano`).value),mes:Number(partes[1]),data_inicio:document.getElementById(`${prefixo}Inicio`).value,data_fim:document.getElementById(`${prefixo}Fim`).value};
  return new URLSearchParams(Object.entries(Estado.periodo).filter(([,v])=>v!==''&&v!=null)).toString();
}

// Lê o período de um prefixo sem alterar Estado.periodo (usado para filtros independentes)
function lerPeriodoLocal(prefixo) {
  const tipo=document.getElementById(`${prefixo}TipoPeriodo`).value;
  const partes=(document.getElementById(`${prefixo}Mes`).value||'').split('-');
  const local={periodo:tipo,ano:Number(tipo==='mes'?partes[0]:document.getElementById(`${prefixo}Ano`).value),mes:Number(partes[1]),data_inicio:document.getElementById(`${prefixo}Inicio`).value,data_fim:document.getElementById(`${prefixo}Fim`).value};
  return new URLSearchParams(Object.entries(local).filter(([,v])=>v!==''&&v!=null)).toString();
}

// ---------------------------------------------------------------------
// UTILITÁRIOS
// ---------------------------------------------------------------------

function formatarMoeda(valor) {
  const numero = Number(valor) || 0;
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataISO) {
  if (!dataISO) return '-';
  const [ano, mes, dia] = String(dataISO).split('T')[0].split('-');
  return `${dia}/${mes}/${ano}`;
}

function dataParaInputDate(dataISO) {
  if (!dataISO) return '';
  return String(dataISO).split('T')[0];
}

function escaparHtml(texto) {
  if (texto == null) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function mostrarToast(mensagem, tipo = 'sucesso') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.textContent = mensagem;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

async function chamarApi(endpoint, opcoes = {}) {
  try {
    const resposta = await fetch(`${API}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(Estado.authToken ? { Authorization: `Bearer ${Estado.authToken}` } : {})
      },
      ...opcoes
    });
    const json = await resposta.json().catch(() => ({}));
    if (resposta.status === 401) {
      limparToken();
      mostrarTelaLogin('Sessão expirada. Faça login novamente.', 'erro');
      throw new Error(json.mensagem || 'Sessão expirada.');
    }
    if (!resposta.ok || !json.sucesso) {
      throw new Error(json.mensagem || 'Erro na requisição.');
    }
    return json;
  } catch (err) {
    if (!err.message?.includes('Sessão expirada')) {
      mostrarToast(err.message || 'Erro de conexão com o servidor.', 'erro');
    }
    throw err;
  }
}

function abrirModal(idModal) {
  document.getElementById(idModal).classList.add('aberto');
}

function fecharModal(idModal) {
  document.getElementById(idModal).classList.remove('aberto');
}

// Fecha modal ao clicar fora da caixa ou no X / Cancelar
document.addEventListener('click', (evento) => {
  if (evento.target.classList.contains('fundo-modal')) {
    evento.target.classList.remove('aberto');
  }
  const botaoFechar = evento.target.closest('[data-fechar-modal]');
  if (botaoFechar) {
    fecharModal(botaoFechar.getAttribute('data-fechar-modal'));
  }
});

document.getElementById('toggleSenhaLogin')?.addEventListener('click', () => {
  const senhaInput = document.getElementById('loginSenha');
  const botao = document.getElementById('toggleSenhaLogin');
  if (!senhaInput || !botao) return;
  const visivel = senhaInput.type === 'password';
  senhaInput.type = visivel ? 'text' : 'password';
  botao.setAttribute('aria-label', visivel ? 'Ocultar senha' : 'Mostrar senha');
  botao.innerHTML = visivel
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.26 19.26 0 0 1 5-5.94"></path><path d="M1 1l22 22"></path><path d="M9.88 9.88a3 3 0 0 0 4.24 4.24"></path></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
});

function corDoStatus(status) {
  if (status === 'Pago') return 'badge-pago';
  if (status === 'Atrasado') return 'badge-atrasado';
  return 'badge-pendente';
}

function iniciaisNome(nome) {
  return (nome || '').trim().charAt(0).toUpperCase();
}

// ---------------------------------------------------------------------
// MENU LATERAL / MOBILE
// ---------------------------------------------------------------------

function alternarMenuMobile(forcarFechar = false) {
  const menu = document.getElementById('menuLateral');
  const overlay = document.getElementById('overlayMenu');
  if (forcarFechar) {
    menu.classList.remove('aberto');
    overlay.classList.remove('ativo');
    return;
  }
  menu.classList.toggle('aberto');
  overlay.classList.toggle('ativo');
}

document.getElementById('botaoMenuMobile').addEventListener('click', () => alternarMenuMobile());
document.getElementById('overlayMenu').addEventListener('click', () => alternarMenuMobile(true));

// ---------------------------------------------------------------------
// NAVEGAÇÃO ENTRE PÁGINAS (SPA simples por troca de conteúdo)
// ---------------------------------------------------------------------

const PAGINAS = {
  pagamentos: { titulo: 'Pagamentos', subtitulo: 'Central de baixas e saldos pendentes', render: renderizarPagamentos },
  dashboard:  { titulo: 'Dashboard', subtitulo: 'Visão geral das finanças do mês', render: renderizarDashboard },
  receitas:   { titulo: 'Receitas', subtitulo: 'Gerencie as entradas de dinheiro do casal', render: renderizarReceitas },
  despesas:   { titulo: 'Despesas', subtitulo: 'Controle de contas fixas e variáveis', render: renderizarDespesas },
  cartoes:    { titulo: 'Cartões e Parcelamentos', subtitulo: 'Cartões de crédito e compras parceladas', render: renderizarCartoes },
  projecao:   { titulo: 'Projeção Financeira', subtitulo: 'Os próximos 12 meses, com base no seu histórico', render: renderizarProjecao },
  configuracoes: { titulo: 'Configurações', subtitulo: 'Informações sobre as pessoas do sistema', render: renderizarConfiguracoes }
};

async function navegarPara(pagina) {
  if (!PAGINAS[pagina]) pagina = 'dashboard';
  Estado.paginaAtual = pagina;

  document.querySelectorAll('.menu-item').forEach(item => {
    item.classList.toggle('ativo', item.getAttribute('data-pagina') === pagina);
  });

  document.getElementById('tituloPagina').textContent = PAGINAS[pagina].titulo;
  document.getElementById('subtituloPagina').textContent = PAGINAS[pagina].subtitulo;
  document.getElementById('areaAcaoTopo').innerHTML = '';

  const area = document.getElementById('areaPagina');
  area.innerHTML = '<div class="spinner-carregando"><div class="girando"></div> Carregando...</div>';

  alternarMenuMobile(true);

  try {
    await PAGINAS[pagina].render();
  } catch (err) {
    area.innerHTML = `<div class="estado-vazio"><p>Não foi possível carregar esta página. Tente novamente.</p></div>`;
  }
}

document.getElementById('menuNav').addEventListener('click', (evento) => {
  const item = evento.target.closest('.menu-item');
  if (item) navegarPara(item.getAttribute('data-pagina'));
});

// ---------------------------------------------------------------------
// INICIALIZAÇÃO
// ---------------------------------------------------------------------

async function inicializarApp() {
  if (!Estado.authToken) {
    mostrarTelaLogin();
    return;
  }

  try {
    mostrarTelaApp();
    const dadosMe = await chamarApi('/auth/me');
    Estado.usuarioAuth = dadosMe.dados;

    const respUsuarios = await chamarApi('/usuarios');
    Estado.usuarios = respUsuarios.dados;
    renderizarAvataresRodape();

    const respCartoes = await chamarApi('/cartoes');
    Estado.cartoes = respCartoes.dados;
  } catch (err) {
    // erro já tratado em chamarApi
    return;
  }
  navegarPara('dashboard');
}

async function autenticarLogin(e) {
  e.preventDefault();
  const usuario = document.getElementById('loginUsuario').value.trim();
  const senha = document.getElementById('loginSenha').value;

  if (!usuario || !senha) {
    mostrarTelaLogin('Informe usuário e senha.', 'erro');
    return;
  }

  try {
    const resp = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha })
    });
    const json = await resp.json();
    if (!resp.ok || !json.sucesso) {
      throw new Error(json.mensagem || 'Não foi possível entrar no sistema.');
    }

    if (json.obrigarTrocaSenha) {
      Estado.usuarioAuth = json.dados;
      mostrarTrocaSenha('Este é seu primeiro acesso. Defina uma nova senha para continuar.');
      return;
    }

    salvarToken(json.dados.token);
    Estado.usuarioAuth = json.dados.usuario;
    mostrarTelaApp();
    await inicializarApp();
  } catch (err) {
    mostrarTelaLogin(err.message || 'Erro ao autenticar.', 'erro');
  }
}

async function trocarSenhaPrimeiraVez(e) {
  e.preventDefault();
  const usuario = document.getElementById('trocaUsuario').value.trim();
  const senhaAtual = document.getElementById('trocaSenhaAtual').value;
  const novaSenha = document.getElementById('trocaNovaSenha').value;
  const confirma = document.getElementById('trocaConfirmarSenha').value;

  if (!usuario || !senhaAtual || !novaSenha || !confirma) {
    mostrarTelaLogin('Preencha todos os campos da troca de senha.', 'erro');
    return;
  }

  if (novaSenha !== confirma) {
    mostrarTelaLogin('A nova senha e a confirmação não coincidem.', 'erro');
    return;
  }

  try {
    const resp = await fetch(`${API}/auth/trocar-senha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senhaAtual, novaSenha })
    });
    const json = await resp.json();
    if (!resp.ok || !json.sucesso) {
      throw new Error(json.mensagem || 'Não foi possível trocar a senha.');
    }
    voltarParaLogin();
    mostrarTelaLogin('Senha definida com sucesso. Entre com suas novas credenciais.', 'sucesso');
  } catch (err) {
    mostrarTelaLogin(err.message || 'Erro ao trocar senha.', 'erro');
  }
}

async function sairDoSistema() {
  try {
    if (Estado.authToken) {
      await fetch(`${API}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${Estado.authToken}` } });
    }
  } catch (err) {
    // ignora erro de logout
  } finally {
    limparToken();
    voltarParaLogin();
    mostrarTelaLogin('Sessão encerrada. Faça login novamente.', 'info');
  }
}

function renderizarAvataresRodape() {
  const container = document.getElementById('avataresRodape');
  container.innerHTML = Estado.usuarios.map(u =>
    `<div class="avatar-mini" style="background:${u.cor}" title="${escaparHtml(u.nome)}">${iniciaisNome(u.nome)}</div>`
  ).join('');
}

function opcoesUsuarios(valorSelecionado = '') {
  return Estado.usuarios.map(u =>
    `<option value="${u.id}" ${String(u.id) === String(valorSelecionado) ? 'selected' : ''}>${escaparHtml(u.nome)}</option>`
  ).join('');
}

document.getElementById('formLogin')?.addEventListener('submit', autenticarLogin);
document.getElementById('formTrocaSenha')?.addEventListener('submit', trocarSenhaPrimeiraVez);
document.getElementById('botaoLogout')?.addEventListener('click', sairDoSistema);
document.addEventListener('click', async (evento) => {
  const botao = evento.target.closest('[data-acao-usuario]');
  if (!botao) return;
  const acao = botao.getAttribute('data-acao-usuario');
  const id = botao.getAttribute('data-id');
  if (acao === 'editar') {
    const usuario = Estado.usuarios.find(u => String(u.id) === String(id));
    if (usuario) preencherFormularioUsuario(usuario);
  }
  if (acao === 'toggle') {
    const ativo = botao.getAttribute('data-ativo') === '1';
    await alternarStatusUsuario(id, ativo);
  }
  if (acao === 'resetar') {
    await resetarSenhaUsuario(id);
  }
  if (acao === 'excluir') {
    await excluirUsuario(id);
  }
});
document.addEventListener('DOMContentLoaded', inicializarApp);

// =====================================================================
// PÁGINA: DASHBOARD
// =====================================================================

const ROTULOS_SEMAFORO = {
  verde: 'Saldo saudável',
  amarelo: 'Atenção ao saldo',
  vermelho: 'Saldo negativo'
};

async function renderizarDashboard() {
  const query=new URLSearchParams(Object.entries(Estado.periodo).filter(([,v])=>v!==''&&v!=null)).toString();
  const resp = await chamarApi(`/dashboard?${query}`);
  const d = resp.dados;
  const area = document.getElementById('areaPagina');

  const semaforoHtml = `
    <div class="semaforo ${d.semaforo}">
      <span class="luz"></span>
      ${ROTULOS_SEMAFORO[d.semaforo]}
    </div>
  `;
  document.getElementById('areaAcaoTopo').innerHTML = semaforoHtml;

  area.innerHTML = `<div class="painel"><div class="barra-filtros" id="filtrosDashboard">${controlesPeriodo('dash')}</div></div>
    <div class="grade-cards">
      <div class="card-indicador receita">
        <div class="rotulo-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
          Receita Total do Mês
        </div>
        <div class="valor-card">${formatarMoeda(d.cards.receitaTotal)}</div>
      </div>
      <div class="card-indicador despesa">
        <div class="rotulo-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
          Despesas do Mês
        </div>
        <div class="valor-card">${formatarMoeda((d.cards.despesaTotal||0)+(d.cards.parcelasTotal||0))}</div>
      </div>
      <div class="card-indicador saldo ${d.cards.saldoPrevisto >= 0 ? 'positivo' : 'negativo'}">
        <div class="rotulo-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><line x1="12" y1="6" x2="12" y2="18"></line></svg>
          Saldo Previsto
        </div>
        <div class="valor-card">${formatarMoeda(d.cards.saldoPrevisto)}</div>
      </div>
      <div class="card-indicador parcelas">
        <div class="rotulo-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
          Parcelamentos Futuros
        </div>
        <div class="valor-card">${formatarMoeda(d.cards.parcelamentosFuturos)}</div>
      </div>
    </div>


    <div class="painel"><div class="painel-cabecalho"><h3>Centro de Alertas</h3></div><div class="painel-corpo com-padding">
      ${d.alertas?.length?d.alertas.map(a=>`<div class="badge badge-atrasado" style="margin:4px">${formatarData(a.data_vencimento)} · ${escaparHtml(a.descricao)} · ${escaparHtml(a.tipo)}</div>`).join(''):'<span style="color:var(--cor-texto-suave)">Nenhum vencimento crítico hoje ou amanhã.</span>'}
    </div></div>

    <div class="painel"><div class="painel-cabecalho"><h3>Calendário Financeiro</h3></div><div class="calendario-financeiro">
      ${d.proximasContas.length?d.proximasContas.map(c=>`<div class="evento-calendario" title="${escaparHtml(c.descricao)} — ${formatarMoeda(c.valor)}"><strong>${String(c.data_vencimento).slice(8,10)}</strong><span>${escaparHtml(c.descricao)}</span><small>${formatarMoeda(c.valor)} · ${escaparHtml(c.tipo_obrigacao||c.categoria)}</small></div>`).join(''):'<div class="estado-vazio"><p>Sem eventos no período.</p></div>'}
    </div></div>

    <div class="grade-painéis-duas-colunas">
      <div>
        <div class="painel">
          <div class="painel-cabecalho"><h3>Próximas Contas</h3></div>
          <div class="tabela-wrapper">
            ${renderizarTabelaProximasContas(d.proximasContas)}
          </div>
        </div>

        <div class="painel">
          <div class="painel-cabecalho"><h3>Parcelamentos Ativos</h3></div>
          <div class="tabela-wrapper">
            ${renderizarTabelaParcelamentosAtivos(d.parcelamentosAtivos)}
          </div>
        </div>
      </div>

      <div>
        <div class="painel">
          <div class="painel-cabecalho"><h3>Resumo por Pessoa</h3></div>
          <div class="tabela-wrapper">
            ${renderizarTabelaResumoPessoa(d.resumoPorPessoa)}
          </div>
        </div>

        <div class="painel">
          <div class="painel-cabecalho"><h3>Despesas por Categoria</h3></div>
          ${renderizarGraficoCategorias(d.despesasPorCategoria)}
        </div>

        <div class="painel">
          <div class="painel-cabecalho"><h3>Despesas do Cartão por Categoria</h3></div>
          ${renderizarGraficoCategorias(d.despesasCartaoPorCategoria || [])}
        </div>
      </div>
    </div>

    <div class="painel painel-timeline">
      <div class="painel-cabecalho timeline-cabecalho">
        <div>
          <h3>Linha do Tempo das Alterações</h3>
          <p class="timeline-subtitulo">Últimas ações do sistema, atualizadas automaticamente.</p>
        </div>
        <button class="botao botao-secundario" id="botaoVerHistoricoCompleto">Ver histórico completo</button>
      </div>
      <div class="timeline-lista" id="timelineLista">
        <div class="estado-vazio"><p>Carregando ações recentes...</p></div>
      </div>
    </div>
  `;
  inicializarControlesPeriodo('dash');
  document.querySelectorAll('#filtrosDashboard input,#filtrosDashboard select').forEach(el=>el.addEventListener('change',()=>{lerPeriodo('dash');renderizarDashboard();}));
  document.getElementById('botaoVerHistoricoCompleto')?.addEventListener('click', abrirHistoricoCompleto);
  await carregarTimeline();
}

function formatarDataHora(dataISO) {
  if (!dataISO) return '—';
  const valor = new Date(dataISO);
  if (Number.isNaN(valor.getTime())) return '—';
  return valor.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function parsearDetalhesAuditoria(item) {
  if (!item?.detalhes) return null;
  if (typeof item.detalhes === 'object') return item.detalhes;
  try {
    return JSON.parse(item.detalhes);
  } catch (err) {
    return null;
  }
}

function obterInfoTimeline(item) {
  const tipo = String(item?.tipo_acao || 'Ação').toLowerCase();
  if (tipo.includes('login')) return { icone: '🔐', classe: 'timeline-badge-login', label: 'Login' };
  if (tipo.includes('logout')) return { icone: '🚪', classe: 'timeline-badge-logout', label: 'Logout' };
  if (tipo.includes('senha')) return { icone: '🔑', classe: 'timeline-badge-senha', label: 'Senha' };
  if (tipo.includes('cadastro')) return { icone: '➕', classe: 'timeline-badge-cadastro', label: 'Cadastro' };
  if (tipo.includes('atualiza')) return { icone: '✏️', classe: 'timeline-badge-atualizacao', label: 'Atualização' };
  if (tipo.includes('exclus')) return { icone: '🗑️', classe: 'timeline-badge-exclusao', label: 'Exclusão' };
  if (tipo.includes('pagamento') || tipo.includes('fatura')) return { icone: '💳', classe: 'timeline-badge-pagamento', label: 'Pagamento' };
  if (tipo.includes('parcel')) return { icone: '🧾', classe: 'timeline-badge-parcelamento', label: 'Parcelamento' };
  if (tipo.includes('usuário') || tipo.includes('usuario')) return { icone: '👤', classe: 'timeline-badge-usuario', label: 'Usuário' };
  return { icone: '🗂️', classe: 'timeline-badge-default', label: item?.tipo_acao || 'Ação' };
}

function renderizarDetalhesTimeline(item) {
  const detalhes = parsearDetalhesAuditoria(item);
  if (!detalhes) {
    return `
      <div class="timeline-detalhes">
        <p class="timeline-paragrafo">${escaparHtml(item?.descricao || 'Registro de auditoria enviado pelo sistema.')}</p>
      </div>`;
  }

  const info = obterInfoTimeline(item);
  const titulo = detalhes.titulo || item?.descricao || 'Alteração registrada';
  const resumo = detalhes.resumo || detalhes.registro?.valor || item?.descricao || 'Detalhes disponíveis para análise.';
  const registro = detalhes.registro;

  let corpo = `
    <div class="timeline-detalhes">
      <div class="timeline-card">
        <span class="timeline-card-label">Resumo</span>
        <strong>${escaparHtml(titulo)}</strong>
        <p>${escaparHtml(resumo)}</p>
      </div>`;

  if (registro?.valor) {
    corpo += `
      <div class="timeline-card">
        <span class="timeline-card-label">Registro afetado</span>
        <strong>${escaparHtml(registro.valor)}</strong>
      </div>`;
  }

  if (detalhes.tipo === 'alteracao' && Array.isArray(detalhes.mudancas) && detalhes.mudancas.length) {
    corpo += `
      <div class="timeline-card">
        <span class="timeline-card-label">O que foi alterado</span>
        <div class="timeline-lista-campos">
          ${detalhes.mudancas.map(mudanca => `
            <div class="timeline-comparativo">
              <div class="timeline-comparativo-titulo">${escaparHtml(mudanca.campo)}</div>
              <div class="timeline-comparativo-grid">
                <div class="timeline-valor antigo">
                  <span>De</span>
                  <strong>${escaparHtml(mudanca.de || '—')}</strong>
                </div>
                <div class="timeline-valor novo">
                  <span>Para</span>
                  <strong>${escaparHtml(mudanca.para || '—')}</strong>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
  } else if (Array.isArray(detalhes.campos) && detalhes.campos.length) {
    corpo += `
      <div class="timeline-card">
        <span class="timeline-card-label">Detalhes</span>
        <div class="timeline-lista-campos">
          ${detalhes.campos.map(campo => `
            <div class="timeline-campo">
              <strong>${escaparHtml(campo.campo)}</strong>
              <span>${escaparHtml(campo.valor || '—')}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  if (detalhes.tipo === 'exclusao' && detalhes.motivo) {
    corpo += `
      <div class="timeline-card">
        <span class="timeline-card-label">Motivo</span>
        <strong>${escaparHtml(detalhes.motivo)}</strong>
      </div>`;
  }

  corpo += '</div>';
  return corpo;
}

function montarItemTimelineHtml(item) {
  const info = obterInfoTimeline(item);
  const detalhes = parsearDetalhesAuditoria(item);
  const titulo = detalhes?.titulo || item?.descricao || 'Alteração registrada';
  const resumo = detalhes?.resumo || detalhes?.registro?.valor || item?.descricao || 'Detalhes disponíveis para análise.';
  return `
    <details class="timeline-item timeline-details">
      <summary class="timeline-summary">
        <div class="timeline-icone ${info.classe}">${info.icone}</div>
        <div class="timeline-conteudo-resumo">
          <div class="timeline-meta">
            <div class="timeline-usuario">
              <strong>${escaparHtml(item.usuario_nome || 'Sistema')}</strong>
              <span class="timeline-badge ${info.classe}">${escaparHtml(info.label)}</span>
            </div>
            <small>${formatarDataHora(item.criado_em)}</small>
          </div>
          <p>${escaparHtml(titulo)}</p>
          <span class="timeline-resumo-texto">${escaparHtml(resumo)}</span>
        </div>
        <span class="timeline-chevron">▾</span>
      </summary>
      ${renderizarDetalhesTimeline(item)}
    </details>`;
}

async function carregarTimeline() {
  const container = document.getElementById('timelineLista');
  if (!container) return;
  try {
    const resp = await chamarApi('/auditoria?limite=20');
    const registros = resp.dados || [];
    if (!registros.length) {
      container.innerHTML = `<div class="estado-vazio"><p>Nenhuma ação registrada ainda.</p></div>`;
      return;
    }
    container.innerHTML = registros.map(montarItemTimelineHtml).join('');
  } catch (err) {
    container.innerHTML = `<div class="estado-vazio"><p>Falha ao carregar a linha do tempo.</p></div>`;
  }
}

const EstadoHistorico = { offset: 0, limite: 30, tipoAcao: '' };

function abrirHistoricoCompleto() {
  abrirModal('modalHistorico');
  const filtro = document.getElementById('historicoFiltroTipo');
  if (filtro) filtro.value = '';
  EstadoHistorico.tipoAcao = '';
  carregarHistoricoCompleto({ reset: true });
}

async function carregarHistoricoCompleto({ reset = false } = {}) {
  const container = document.getElementById('historicoLista');
  const botaoMais = document.getElementById('botaoCarregarMaisHistorico');
  if (!container) return;
  if (reset) {
    EstadoHistorico.offset = 0;
    container.innerHTML = `<div class="estado-vazio"><p>Carregando histórico...</p></div>`;
  }
  try {
    const params = new URLSearchParams({
      periodo: 'todo',
      limite: EstadoHistorico.limite,
      offset: EstadoHistorico.offset
    });
    if (EstadoHistorico.tipoAcao) params.set('tipo_acao', EstadoHistorico.tipoAcao);
    const resp = await chamarApi(`/auditoria?${params.toString()}`);
    const registros = resp.dados || [];
    const html = registros.map(montarItemTimelineHtml).join('');
    if (reset) {
      container.innerHTML = registros.length ? html : `<div class="estado-vazio"><p>Nenhuma ação encontrada.</p></div>`;
    } else {
      container.insertAdjacentHTML('beforeend', html);
    }
    EstadoHistorico.offset += registros.length;
    if (botaoMais) botaoMais.style.display = resp.paginacao?.temMais ? '' : 'none';
  } catch (err) {
    if (reset) container.innerHTML = `<div class="estado-vazio"><p>Falha ao carregar o histórico.</p></div>`;
  }
}

document.getElementById('historicoFiltroTipo')?.addEventListener('change', (evento) => {
  EstadoHistorico.tipoAcao = evento.target.value;
  carregarHistoricoCompleto({ reset: true });
});

document.getElementById('botaoCarregarMaisHistorico')?.addEventListener('click', () => {
  carregarHistoricoCompleto({ reset: false });
});

function renderizarTabelaResumoPessoa(lista) {
  if (!lista.length) return `<div class="estado-vazio"><p>Nenhum dado disponível.</p></div>`;
  return `
    <table class="tabela-padrao">
      <thead><tr><th>Pessoa</th><th>Receita</th><th>Despesas</th><th>Saldo</th></tr></thead>
      <tbody>
        ${lista.map(p => `
          <tr>
            <td><span class="etiqueta-pessoa"><span class="bolinha-pessoa" style="background:${p.cor}"></span>${escaparHtml(p.pessoa)}</span></td>
            <td class="valor-positivo">${formatarMoeda(p.receita)}</td>
            <td class="valor-negativo">${formatarMoeda(p.despesa)}</td>
            <td class="${p.saldo >= 0 ? 'valor-positivo' : 'valor-negativo'}">${formatarMoeda(p.saldo)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderizarTabelaProximasContas(lista) {
  if (!lista.length) {
    return `<div class="estado-vazio"><p>Nenhuma conta pendente. Tudo em dia! 🎉</p></div>`;
  }
  return `
    <table class="tabela-padrao">
      <thead><tr><th>Vencimento</th><th>Conta</th><th>Categoria</th><th>Valor</th><th>Pessoa</th></tr></thead>
      <tbody>
        ${lista.map(c => `
          <tr>
            <td>${formatarData(c.data_vencimento)} ${c.status === 'Atrasado' ? '<span class="badge badge-atrasado" style="margin-left:6px;">Atrasado</span>' : ''}</td>
            <td>${escaparHtml(c.descricao)}</td>
            <td>${escaparHtml(c.categoria)}</td>
            <td class="valor-negativo">${formatarMoeda(c.valor)}</td>
            <td><span class="etiqueta-pessoa"><span class="bolinha-pessoa" style="background:${c.usuario_cor}"></span>${escaparHtml(c.usuario_nome)}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderizarTabelaParcelamentosAtivos(lista) {
  if (!lista.length) {
    return `<div class="estado-vazio"><p>Nenhum parcelamento ativo no momento.</p></div>`;
  }
  return `
    <table class="tabela-padrao">
      <thead><tr><th>Compra</th><th>Parcela Atual</th><th>Total Parcelas</th><th>Valor Parcela</th><th>Valor Restante</th></tr></thead>
      <tbody>
        ${lista.map(p => `
          <tr>
            <td>${escaparHtml(p.descricao_compra)}</td>
            <td>${p.parcela_atual}</td>
            <td>${p.qtd_parcelas}</td>
            <td>${formatarMoeda(p.valor_parcela)}</td>
            <td class="valor-negativo">${formatarMoeda(p.valor_restante)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderizarGraficoCategorias(lista) {
  if (!lista.length) {
    return `<div class="estado-vazio"><p>Nenhuma despesa registrada este mês.</p></div>`;
  }
  const totalGeral = lista.reduce((s,c)=>s+Number(c.total),0);
  return `
    <div class="lista-grafico-categorias">
      ${lista.map(c => {
        const percentual = totalGeral > 0 ? (Number(c.total) / totalGeral) * 100 : 0;
        return `
          <div class="linha-grafico-categoria">
            <div class="topo-linha-grafico">
              <strong>${escaparHtml(c.categoria)}</strong>
              <span>${formatarMoeda(c.total)}</span>
            </div>
            <div class="barra-fundo">
              <div class="barra-preenchimento" style="width:${percentual}%"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// =====================================================================
// PÁGINA: RECEITAS
// =====================================================================

async function renderizarReceitas() {
  document.getElementById('areaAcaoTopo').innerHTML = `
    <button class="botao botao-primario" id="botaoNovaReceita">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      Nova Receita
    </button>
  `;
  document.getElementById('botaoNovaReceita').addEventListener('click', () => abrirModalReceita());

  const area = document.getElementById('areaPagina');
  area.innerHTML = `
    <div class="painel">
      <div class="barra-filtros">
        ${controlesPeriodo('rec')}
        <select class="campo-select" id="filtroReceitaUsuario">
          <option value="">Todas as pessoas</option>
          ${opcoesUsuarios()}
        </select>
        <select class="campo-select" id="filtroReceitaCategoria">
          <option value="">Todas as categorias</option>
          <option>Salário</option><option>Freelance</option><option>Extra</option><option>Investimento</option><option>Outros</option>
        </select>
      </div>
      <div class="tabela-wrapper" id="tabelaReceitasContainer"></div>
    </div>
  `;

  inicializarControlesPeriodo('rec');
  document.querySelectorAll('.barra-filtros input,.barra-filtros select').forEach(el=>el.addEventListener('change', carregarTabelaReceitas));

  await carregarTabelaReceitas();

  document.getElementById('formReceita').onsubmit = salvarReceita;
}

async function carregarTabelaReceitas() {
  const usuario_id = document.getElementById('filtroReceitaUsuario').value;
  const categoria = document.getElementById('filtroReceitaCategoria').value;
  const params = new URLSearchParams();
  if (usuario_id) params.append('usuario_id', usuario_id);
  if (categoria) params.append('categoria', categoria);
  lerPeriodo('rec');
  if(Estado.periodo.periodo==='mes'){params.set('mes',Estado.periodo.mes);params.set('ano',Estado.periodo.ano);}
  if(Estado.periodo.periodo==='ano'){params.set('data_inicio',`${Estado.periodo.ano}-01-01`);params.set('data_fim',`${Estado.periodo.ano}-12-31`);}
  if(Estado.periodo.periodo==='personalizado'){params.set('data_inicio',Estado.periodo.data_inicio);params.set('data_fim',Estado.periodo.data_fim);}

  const resp = await chamarApi(`/receitas?${params.toString()}`);
  const lista = resp.dados;
  const container = document.getElementById('tabelaReceitasContainer');

  if (!lista.length) {
    container.innerHTML = `<div class="estado-vazio"><p>Nenhuma receita encontrada.</p></div>`;
    return;
  }

  const subtotal=lista.reduce((s,r)=>s+Number(r.valor),0);
  container.innerHTML = `<div class="barra-filtros"><strong>Receitas encontradas: ${lista.length}</strong><span>Subtotal: <strong class="valor-positivo">${formatarMoeda(subtotal)}</strong></span></div>
    <table class="tabela-padrao">
      <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Pessoa</th><th>Valor</th><th></th></tr></thead>
      <tbody>
        ${lista.map(r => `
          <tr>
            <td>${formatarData(r.data_recebimento)}</td>
            <td>${escaparHtml(r.descricao)}</td>
            <td>${escaparHtml(r.categoria)}</td>
            <td><span class="etiqueta-pessoa"><span class="bolinha-pessoa" style="background:${r.usuario_cor}"></span>${escaparHtml(r.usuario_nome)}</span></td>
            <td class="valor-positivo">${formatarMoeda(r.valor)}</td>
            <td class="celula-acoes">
              <button class="botao-icone" data-editar-receita="${r.id}" title="Editar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="botao-icone" data-excluir-receita="${r.id}" title="Excluir">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  container.querySelectorAll('[data-editar-receita]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalReceita(btn.getAttribute('data-editar-receita'), lista));
  });
  container.querySelectorAll('[data-excluir-receita]').forEach(btn => {
    btn.addEventListener('click', () => confirmarExclusao('receita', btn.getAttribute('data-excluir-receita'), 'esta receita'));
  });
}

function abrirModalReceita(id = null, listaAtual = []) {
  const form = document.getElementById('formReceita');
  form.reset();
  document.getElementById('receitaUsuario').innerHTML = opcoesUsuarios();
  document.getElementById('receitaId').value = id || '';

  if (id) {
    const item = listaAtual.find(r => String(r.id) === String(id));
    document.getElementById('tituloModalReceita').textContent = 'Editar Receita';
    document.getElementById('receitaUsuario').value = item.usuario_id;
    document.getElementById('receitaDescricao').value = item.descricao;
    document.getElementById('receitaCategoria').value = item.categoria;
    document.getElementById('receitaValor').value = item.valor;
    document.getElementById('receitaData').value = dataParaInputDate(item.data_recebimento);
    document.getElementById('receitaObservacao').value = item.observacao || '';
  } else {
    document.getElementById('tituloModalReceita').textContent = 'Nova Receita';
    document.getElementById('receitaData').value = new Date().toISOString().slice(0, 10);
  }

  abrirModal('modalReceita');
}

async function salvarReceita(evento) {
  evento.preventDefault();
  const id = document.getElementById('receitaId').value;
  const dados = {
    usuario_id: document.getElementById('receitaUsuario').value,
    descricao: document.getElementById('receitaDescricao').value.trim(),
    categoria: document.getElementById('receitaCategoria').value,
    valor: parseFloat(document.getElementById('receitaValor').value),
    data_recebimento: document.getElementById('receitaData').value,
    observacao: document.getElementById('receitaObservacao').value.trim()
  };

  try {
    if (id) {
      await chamarApi(`/receitas/${id}`, { method: 'PUT', body: JSON.stringify(dados) });
      mostrarToast('Receita atualizada com sucesso.');
    } else {
      await chamarApi('/receitas', { method: 'POST', body: JSON.stringify(dados) });
      mostrarToast('Receita cadastrada com sucesso.');
    }
    fecharModal('modalReceita');
    await carregarTabelaReceitas();
  } catch (err) { /* erro já tratado */ }
}

// =====================================================================
// PÁGINA: DESPESAS
// =====================================================================

async function renderizarDespesas() {
  document.getElementById('areaAcaoTopo').innerHTML = `
    <button class="botao botao-primario" id="botaoNovaDespesa">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      Nova Despesa
    </button>
  `;
  document.getElementById('botaoNovaDespesa').addEventListener('click', () => abrirModalDespesa());

  const area = document.getElementById('areaPagina');
  area.innerHTML = `
    <div class="painel">
      <div class="barra-filtros">
        ${controlesPeriodo('desp')}
        <select class="campo-select" id="filtroDespesaUsuario">
          <option value="">Todas as pessoas</option>
          ${opcoesUsuarios()}
        </select>
        <select class="campo-select" id="filtroDespesaCategoria">
          <option value="">Todas as categorias</option>
          <option>Moradia</option><option>Energia</option><option>Água</option><option>Internet</option>
          <option>Mercado</option><option>Transporte</option><option>Saúde</option><option>Educação</option>
          <option>Lazer</option><option>Cartão</option><option>Outros</option>
        </select>
        <select class="campo-select" id="filtroDespesaTipo">
          <option value="">Fixa e Variável</option>
          <option>Fixa</option><option>Variável</option>
        </select>
        <select class="campo-select" id="filtroDespesaStatus">
          <option value="">Todos os status</option>
          <option>Pendente</option><option>Pago</option><option>Atrasado</option>
        </select>
        <select class="campo-select" id="filtroDespesaOrigem">
          <option value="">Todas as origens</option>
          <option value="Avulsas">Avulsas</option>
          <option value="Fixas">Fixas Recorrentes</option>
        </select>
        <button class="botao botao-perigo" id="excluirDespesasSelecionadas" style="display:none">Excluir Selecionados</button>
        <button class="botao botao-secundario" id="cancelarSelecaoDespesas" style="display:none">Cancelar Seleção</button>
      </div>
      <div class="tabela-wrapper" id="tabelaDespesasContainer"></div>
    </div>
  `;

  inicializarControlesPeriodo('desp');
  ['filtroDespesaUsuario','filtroDespesaCategoria','filtroDespesaTipo','filtroDespesaStatus','filtroDespesaOrigem','despTipoPeriodo','despMes','despAno','despInicio','despFim'].forEach(id => {
    document.getElementById(id).addEventListener('change', carregarTabelaDespesas);
  });
  document.getElementById('excluirDespesasSelecionadas').addEventListener('click', excluirDespesasSelecionadas);
  document.getElementById('cancelarSelecaoDespesas').addEventListener('click',()=>{document.querySelectorAll('.seletor-despesa').forEach(c=>c.checked=false);atualizarAcoesSelecaoDespesas();});

  await carregarTabelaDespesas();
  document.getElementById('formDespesa').onsubmit = salvarDespesa;
}

async function carregarTabelaDespesas() {
  const params = new URLSearchParams();
  const usuario_id = document.getElementById('filtroDespesaUsuario').value;
  const categoria  = document.getElementById('filtroDespesaCategoria').value;
  const tipo       = document.getElementById('filtroDespesaTipo').value;
  const status     = document.getElementById('filtroDespesaStatus').value;
  const origem     = document.getElementById('filtroDespesaOrigem').value;
  if (usuario_id) params.append('usuario_id', usuario_id);
  if (categoria)  params.append('categoria', categoria);
  if (tipo)       params.append('tipo', tipo);
  if (status)     params.append('status', status);
  if (origem)     params.append('origem', origem);
  lerPeriodo('desp');
  if(Estado.periodo.periodo==='mes'){params.set('mes',Estado.periodo.mes);params.set('ano',Estado.periodo.ano);}
  if(Estado.periodo.periodo==='ano'){params.set('data_inicio',`${Estado.periodo.ano}-01-01`);params.set('data_fim',`${Estado.periodo.ano}-12-31`);}
  if(Estado.periodo.periodo==='personalizado'){params.set('data_inicio',Estado.periodo.data_inicio);params.set('data_fim',Estado.periodo.data_fim);}

  const resp  = await chamarApi(`/despesas?${params.toString()}`);
  const lista = resp.dados;
  const container = document.getElementById('tabelaDespesasContainer');

  if (!lista.length) {
    container.innerHTML = `<div class="estado-vazio"><p>Nenhuma despesa encontrada.</p></div>`;
    document.getElementById('excluirDespesasSelecionadas').style.display='none';
    document.getElementById('cancelarSelecaoDespesas').style.display='none';
    return;
  }

  container.innerHTML = `
    <table class="tabela-padrao">
      <thead><tr><th><input type="checkbox" id="selecionarTodasDespesas" title="Selecionar todos"></th><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Origem</th><th>Responsável</th><th>Valor</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${lista.map(d => {
          const origemBadge = d.eh_recorrente
            ? `<span class="badge badge-fixa">Recorrente</span>`
            : `<span class="badge badge-variavel" style="background:#F1ECFB;color:#7C3AED;">${d.tipo}</span>`;
          return `
          <tr>
            <td><input type="checkbox" class="seletor-despesa" value="${d.id}" aria-label="Selecionar ${escaparHtml(d.descricao)}"></td>
            <td>${formatarData(d.data_vencimento)}</td>
            <td>${escaparHtml(d.descricao)}${d.periodicidade ? `<br><small style="color:var(--cor-texto-fraco)">${d.periodicidade}</small>` : ''}</td>
            <td>${escaparHtml(d.categoria)}</td>
            <td>${origemBadge}</td>
            <td><span class="etiqueta-pessoa"><span class="bolinha-pessoa" style="background:${d.usuario_cor}"></span>${escaparHtml(d.usuario_nome)}</span></td>
            <td class="valor-negativo">${formatarMoeda(d.valor)}</td>
            <td><span class="badge ${corDoStatus(d.status)}">${d.status}</span></td>
            <td class="celula-acoes">
              <button class="botao-icone" data-editar-despesa="${d.id}" title="Editar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="botao-icone" data-excluir-despesa="${d.id}" title="Excluir">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </td>
          </tr>
        `}).join('')}
      </tbody>
    </table>
  `;

  container.querySelectorAll('[data-editar-despesa]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalDespesa(btn.getAttribute('data-editar-despesa'), lista));
  });
  container.querySelectorAll('[data-excluir-despesa]').forEach(btn => {
    btn.addEventListener('click', () => confirmarExclusao('despesa', btn.getAttribute('data-excluir-despesa'), 'esta despesa'));
  });
  document.getElementById('selecionarTodasDespesas').addEventListener('change',e=>{container.querySelectorAll('.seletor-despesa').forEach(c=>c.checked=e.target.checked);atualizarAcoesSelecaoDespesas();});
  container.querySelectorAll('.seletor-despesa').forEach(c=>c.addEventListener('change',atualizarAcoesSelecaoDespesas));
}

function atualizarAcoesSelecaoDespesas(){const tem=[...document.querySelectorAll('.seletor-despesa')].some(c=>c.checked);document.getElementById('excluirDespesasSelecionadas').style.display=tem?'':'none';document.getElementById('cancelarSelecaoDespesas').style.display=tem?'':'none';}
async function excluirDespesasSelecionadas(){const ids=[...document.querySelectorAll('.seletor-despesa:checked')].map(c=>Number(c.value));if(!ids.length)return;if(!confirm(`Excluir ${ids.length} despesa(s) selecionada(s)?`))return;const resp=await chamarApi('/despesas/lote',{method:'DELETE',body:JSON.stringify({ids})});mostrarToast(resp.mensagem);await carregarTabelaDespesas();}

const CATEGORIAS_PADRAO_DESPESA = [
  'Moradia','Energia','Água','Internet','Mercado','Transporte',
  'Saúde','Educação','Lazer','Cartão','Outros'
];

function carregarCategoriasDespesa(valorAtual = null) {
  carregarCategoriasEmSelect('despesaCategoria', valorAtual);
}

function carregarCategoriasEmSelect(selectId, valorAtual = null) {
  const custom = JSON.parse(localStorage.getItem('categorias_despesa_custom') || '[]');
  const todas = [...CATEGORIAS_PADRAO_DESPESA];
  for (const c of custom) { if (!todas.includes(c)) todas.push(c); }
  if (valorAtual && !todas.includes(valorAtual)) todas.push(valorAtual);
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = todas.map(c => `<option value="${escaparHtml(c)}"${valorAtual === c ? ' selected' : ''}>${escaparHtml(c)}</option>`).join('');
}

function carregarCategoriasParcelamento(valorAtual = 'Cartão') {
  carregarCategoriasEmSelect('parcelamentoCategoria', valorAtual || 'Cartão');
}

function carregarCategoriasEdicaoLancamento(valorAtual = 'Cartão') {
  carregarCategoriasEmSelect('editLancCategoria', valorAtual || 'Cartão');
}

const CONTROLES_NOVA_CATEGORIA = [
  {
    botaoId: 'botaoNovaCategoria',
    painelId: 'novaCategoriaSugestao',
    inputId: 'novaCategoriaTexto',
    confirmarId: 'botaoConfirmarNovaCategoria',
    selectId: 'despesaCategoria'
  },
  {
    botaoId: 'botaoNovaCategoriaParcelamento',
    painelId: 'novaCategoriaParcelamentoSugestao',
    inputId: 'novaCategoriaParcelamentoTexto',
    confirmarId: 'botaoConfirmarNovaCategoriaParcelamento',
    selectId: 'parcelamentoCategoria'
  },
  {
    botaoId: 'botaoNovaCategoriaEdicaoLancamento',
    painelId: 'novaCategoriaEdicaoLancamentoSugestao',
    inputId: 'novaCategoriaEdicaoLancamentoTexto',
    confirmarId: 'botaoConfirmarNovaCategoriaEdicaoLancamento',
    selectId: 'editLancCategoria'
  }
];

function ocultarPaineisNovaCategoria() {
  CONTROLES_NOVA_CATEGORIA.forEach(({ painelId }) => {
    const painel = document.getElementById(painelId);
    if (painel) painel.style.display = 'none';
  });
}

function alternarPainelNovaCategoria(controle) {
  const painel = document.getElementById(controle.painelId);
  const input = document.getElementById(controle.inputId);
  if (!painel || !input) return;
  const visivel = painel.style.display !== 'none';
  ocultarPaineisNovaCategoria();
  if (!visivel) {
    painel.style.display = 'block';
    input.value = '';
    input.focus();
  }
}

function confirmarNovaCategoria(controle) {
  const input = document.getElementById(controle.inputId);
  const nome = input.value.trim();
  if (!nome) { input.focus(); return; }
  const custom = JSON.parse(localStorage.getItem('categorias_despesa_custom') || '[]');
  if (!custom.includes(nome) && !CATEGORIAS_PADRAO_DESPESA.includes(nome)) {
    custom.push(nome);
    localStorage.setItem('categorias_despesa_custom', JSON.stringify(custom));
  }
  carregarCategoriasEmSelect(controle.selectId, nome);
  ocultarPaineisNovaCategoria();
  mostrarToast(`Categoria "${nome}" adicionada.`);
}

function abrirModalDespesa(id = null, listaAtual = []) {
  const form = document.getElementById('formDespesa');
  form.reset();
  ocultarPaineisNovaCategoria();
  carregarCategoriasDespesa();
  document.getElementById('despesaUsuario').innerHTML = `${opcoesUsuarios()}<option value="casal">Casal</option>`;
  document.getElementById('despesaId').value = id || '';

  if (id) {
    const item = listaAtual.find(d => String(d.id) === String(id));
    document.getElementById('tituloModalDespesa').textContent = 'Editar Despesa';
    document.getElementById('despesaUsuario').value  = item.rateada ? 'casal' : item.usuario_id;
    document.getElementById('despesaDescricao').value = item.descricao;
    carregarCategoriasDespesa(item.categoria);
    document.getElementById('despesaTipo').value      = item.tipo;
    document.getElementById('despesaValor').value     = item.valor;
    document.getElementById('despesaStatus').value    = item.status;
    document.getElementById('despesaObservacao').value = item.observacao || '';

    if (item.eh_recorrente) {
      document.getElementById('despesaDiaVencimento').value  = item.dia_vencimento || '';
      document.getElementById('despesaPeriodicidade').value  = item.periodicidade || 'Mensal';
      document.getElementById('despesaDuracaoTipo').value    = item.duracao_tipo || 'Indeterminada';
      document.getElementById('despesaQtdOcorrencias').value = item.qtd_ocorrencias || '';
    } else {
      document.getElementById('despesaDataVencimento').value = dataParaInputDate(item.data_vencimento);
    }
  } else {
    document.getElementById('tituloModalDespesa').textContent = 'Nova Despesa';
    document.getElementById('despesaDataVencimento').value = new Date().toISOString().slice(0, 10);
  }

  atualizarCamposDespesa();
  abrirModal('modalDespesa');
}

// Mostra/oculta campos do formulário conforme o Tipo selecionado
function atualizarCamposDespesa() {
  const tipo = document.getElementById('despesaTipo').value;
  const isFixa = tipo === 'Fixa';
  document.getElementById('grupoDataVencimento').style.display  = isFixa ? 'none' : '';
  document.getElementById('grupoRecorrencia').style.display     = isFixa ? '' : 'none';
  document.getElementById('despesaUsuario').closest('.grupo-form').style.display = '';
  document.getElementById('despesaUsuario').required = true;
  // Ao trocar de tipo, limpa os campos que ficam escondidos para não mandar lixo
  if (isFixa) {
    document.getElementById('despesaDataVencimento').value = '';
  } else {
    document.getElementById('despesaDiaVencimento').value  = '';
    document.getElementById('despesaPeriodicidade').value  = 'Mensal';
    document.getElementById('despesaDuracaoTipo').value    = 'Indeterminada';
    document.getElementById('despesaQtdOcorrencias').value = '';
    atualizarCampoDuracao();
  }
}

function atualizarCampoDuracao() {
  const duracao = document.getElementById('despesaDuracaoTipo').value;
  document.getElementById('grupoQtdOcorrencias').style.display = duracao === 'Quantidade' ? '' : 'none';
}

async function salvarDespesa(evento) {
  evento.preventDefault();
  const id   = document.getElementById('despesaId').value;
  const tipo = document.getElementById('despesaTipo').value;
  const isFixa = tipo === 'Fixa';
  const responsavel = document.getElementById('despesaUsuario').value;

  const dados = {
    usuario_id:      responsavel === 'casal' ? null : responsavel,
    rateada:         responsavel === 'casal',
    descricao:       document.getElementById('despesaDescricao').value.trim(),
    categoria:       document.getElementById('despesaCategoria').value,
    tipo,
    valor:           parseFloat(document.getElementById('despesaValor').value),
    status:          document.getElementById('despesaStatus').value,
    observacao:      document.getElementById('despesaObservacao').value.trim()
  };

  if (isFixa && !id) {
    // Nova despesa fixa → modo recorrente com geração automática
    dados.eh_recorrente   = true;
    if(dados.rateada) dados.rateios = Estado.usuarios.slice(0,2).map(u=>({usuario_id:u.id,percentual:50}));
    dados.dia_vencimento  = parseInt(document.getElementById('despesaDiaVencimento').value);
    dados.periodicidade   = document.getElementById('despesaPeriodicidade').value;
    dados.duracao_tipo    = document.getElementById('despesaDuracaoTipo').value;
    dados.qtd_ocorrencias = document.getElementById('despesaQtdOcorrencias').value
      ? parseInt(document.getElementById('despesaQtdOcorrencias').value) : null;
  } else {
    // Despesa variável ou edição: mantém o campo data_vencimento clássico
    dados.data_vencimento = document.getElementById('despesaDataVencimento').value;
  }

  try {
    if (id) {
      await chamarApi(`/despesas/${id}`, { method: 'PUT', body: JSON.stringify(dados) });
      mostrarToast('Despesa atualizada com sucesso.');
    } else {
      const resp = await chamarApi('/despesas', { method: 'POST', body: JSON.stringify(dados) });
      mostrarToast(resp.mensagem || 'Despesa cadastrada com sucesso.');
    }
    fecharModal('modalDespesa');
    await carregarTabelaDespesas();
  } catch (err) { /* erro já tratado */ }
}

// =====================================================================
// PÁGINA: CARTÕES E PARCELAMENTOS (v2 – Obrigações Parceladas Genéricas)
// =====================================================================

async function renderizarCartoes() {
  document.getElementById('areaAcaoTopo').innerHTML = `
    <div class="linha-acoes-topo">
      <button class="botao botao-secundario" id="botaoNovoCartao">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
        Novo Cartão
      </button>
      <button class="botao botao-primario" id="botaoNovoParcelamento">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Nova Obrigação Parcelada
      </button>
    </div>
  `;

  const area = document.getElementById('areaPagina');
  area.innerHTML = `
    <div class="painel">
      <div class="barra-filtros" id="filtrosCartoes">${controlesPeriodo('cart')}</div>
    </div>
    <div class="painel">
      <div class="painel-cabecalho"><h3>Cartões de Crédito</h3></div>
      <div class="tabela-wrapper" id="tabelaCartoesContainer"></div>
    </div>
    <div class="painel">
      <div class="painel-cabecalho"><h3>Parcelamentos de Cartão</h3></div>
      <div class="tabela-wrapper" id="tabelaParcelamentosCC"></div>
    </div>
    <div class="painel">
      <div class="painel-cabecalho"><h3>Empréstimos / Financiamentos / Consórcios</h3></div>
      <div class="tabela-wrapper" id="tabelaParcelamentosOutros"></div>
    </div>
  `;

  inicializarControlesPeriodo('cart');
  document.querySelectorAll('#filtrosCartoes input,#filtrosCartoes select').forEach(el=>el.addEventListener('change',()=>{lerPeriodo('cart');recarregarCartoes();}));
  document.getElementById('botaoNovoCartao').addEventListener('click', () => abrirModalCartao());
  document.getElementById('botaoNovoParcelamento').addEventListener('click', () => abrirModalParcelamento());

  await recarregarCartoes();

  document.getElementById('formCartao').onsubmit = salvarCartao;
  document.getElementById('formParcelamento').onsubmit = salvarParcelamento;
}

async function recarregarCartoes() {
  await carregarTabelaCartoes();
  await carregarTabelaParcelamentos();
}

async function carregarTabelaCartoes() {
  const query=new URLSearchParams(Object.entries(Estado.periodo).filter(([,v])=>v!==''&&v!=null)).toString();
  const resp = await chamarApi(`/cartoes?${query}`);
  Estado.cartoes = resp.dados;
  const container = document.getElementById('tabelaCartoesContainer');

  if (!Estado.cartoes.length) {
    container.innerHTML = `<div class="estado-vazio"><p>Nenhum cartão cadastrado ainda.</p></div>`;
    return;
  }

  container.innerHTML = `
    <table class="tabela-padrao">
      <thead><tr><th>Cartão</th><th>Banco</th><th>Responsável</th><th>Limite</th><th>Fechamento</th><th>Vencimento</th><th>A vencer no período</th><th></th></tr></thead>
      <tbody>
        ${Estado.cartoes.map(c => `
          <tr>
            <td><button type="button" class="botao-fatura-link" data-fatura-id="${c.id}" data-fatura-nome="${escaparHtml(c.nome_cartao)}">${escaparHtml(c.nome_cartao)}</button></td>
            <td>${escaparHtml(c.banco)}</td>
            <td><span class="etiqueta-pessoa"><span class="bolinha-pessoa" style="background:${c.usuario_cor}"></span>${escaparHtml(c.usuario_nome)}</span></td>
            <td>${formatarMoeda(c.limite)}</td>
            <td>Dia ${c.dia_fechamento}</td>
            <td>Dia ${c.dia_vencimento}</td>
            <td class="${Number(c.total_periodo)>0?'valor-negativo':''}">
              ${Number(c.total_periodo)>0
                ? `<button type="button" class="botao-fatura-link valor-negativo" data-fatura-id="${c.id}" data-fatura-nome="${escaparHtml(c.nome_cartao)}">${formatarMoeda(c.total_periodo)}</button>`
                : '—'}
            </td>
            <td class="celula-acoes">
              <button class="botao-icone" data-editar-cartao="${c.id}" title="Editar">✎</button>
              <button class="botao-icone" data-excluir-cartao="${c.id}" title="Excluir">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  container.querySelectorAll('[data-excluir-cartao]').forEach(btn => {
    btn.addEventListener('click', () => confirmarExclusao('cartao', btn.getAttribute('data-excluir-cartao'), 'este cartão (e seus parcelamentos vinculados)'));
  });
  container.querySelectorAll('[data-editar-cartao]').forEach(btn=>btn.addEventListener('click',()=>abrirModalCartao(Estado.cartoes.find(c=>String(c.id)===btn.dataset.editarCartao))));
  container.querySelectorAll('[data-fatura-id]').forEach(btn=>btn.addEventListener('click',()=>abrirModalFatura(btn.dataset.faturaId, btn.dataset.faturaNome)));
}

async function abrirModalFatura(cartaoId, nomeCartao) {
  Estado._faturaCartaoId = String(cartaoId);
  Estado._faturaNomeCartao = nomeCartao;
  document.getElementById('modalFaturaTitulo').textContent = nomeCartao;
  document.getElementById('modalFaturaTotal').textContent = '';
  document.getElementById('modalFaturaCorpo').innerHTML = '<p style="text-align:center;padding:32px;color:var(--cor-texto-suave)">Carregando...</p>';
  abrirModal('modalFatura');
  await _carregarFaturaCorpo(cartaoId);
}

async function _carregarFaturaCorpo(cartaoId) {
  const cartao = Estado.cartoes.find(c => String(c.id) === String(cartaoId)) || {};
  const qs = new URLSearchParams(Object.entries(Estado.periodo).filter(([,v])=>v!==''&&v!=null)).toString();
  const resp = await chamarApi(`/cartoes/${cartaoId}/fatura?${qs}`);
  const parcelas = resp.dados;

  const corpo = document.getElementById('modalFaturaCorpo');
  if (!parcelas || !parcelas.length) {
    corpo.innerHTML = '<div class="estado-vazio"><p>Nenhuma parcela pendente neste período.</p></div>';
    return;
  }

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const totalGeral = parcelas.reduce((s, pa) => s + Number(pa.valor), 0);

  const mesesVenc = [...new Set(parcelas.map(pa => String(pa.data_vencimento).split('T')[0].slice(0,7)))].sort();
  let periodoLabel;
  if (mesesVenc.length === 1) {
    const [ano, mes] = mesesVenc[0].split('-');
    periodoLabel = `${MESES[Number(mes)-1]}/${ano}`;
  } else {
    const [anoI, mesI] = mesesVenc[0].split('-');
    const [anoF, mesF] = mesesVenc[mesesVenc.length-1].split('-');
    periodoLabel = `${MESES[Number(mesI)-1]}/${anoI} – ${MESES[Number(mesF)-1]}/${anoF}`;
  }

  document.getElementById('modalFaturaTotal').textContent = formatarMoeda(totalGeral);

  corpo.innerHTML = `
    <div class="fatura-info-bloco">
      <div class="fatura-info-linha">
        <span class="fatura-info-label">Vencimento</span>
        <span class="fatura-info-valor">Dia ${cartao.dia_vencimento || '—'}</span>
      </div>
      <div class="fatura-info-linha">
        <span class="fatura-info-label">Fechamento</span>
        <span class="fatura-info-valor">Dia ${cartao.dia_fechamento || '—'}</span>
      </div>
      <div class="fatura-info-linha">
        <span class="fatura-info-label">Fatura do período</span>
        <span class="fatura-info-valor">${periodoLabel}</span>
      </div>
      <div class="fatura-info-linha fatura-total-linha">
        <span class="fatura-info-label">Total da Fatura</span>
        <span class="fatura-info-valor valor-negativo">${formatarMoeda(totalGeral)}</span>
      </div>
    </div>
    <div class="tabela-wrapper">
    <table class="tabela-padrao fatura-tabela">
      <thead>
        <tr>
          <th>Data Compra</th>
          <th style="text-align:center">Parcela</th>
          <th>Descrição</th>
          <th>Categoria</th>
          <th style="text-align:right">Valor</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${parcelas.map((i, idx) => `<tr>
          <td class="fatura-col-data">${formatarData(i.data_compra || i.data_vencimento)}</td>
          <td style="text-align:center;color:var(--cor-texto-suave)">${i.numero_parcela}/${i.total_parcelas}</td>
          <td>${escaparHtml(i.descricao_compra)}</td>
          <td>${escaparHtml(i.categoria || 'Cartão')}</td>
          <td style="text-align:right" class="valor-negativo">${formatarMoeda(i.valor)}</td>
          <td><button class="botao-icone fatura-editar-btn" data-idx="${idx}" title="Editar">✎</button></td>
        </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr class="fatura-rodape-total">
          <td colspan="5">Total da Fatura</td>
          <td class="valor-negativo">${formatarMoeda(totalGeral)}</td>
        </tr>
      </tfoot>
    </table>
    </div>`;

  corpo.querySelectorAll('.fatura-editar-btn').forEach(btn => {
    const p = parcelas[Number(btn.dataset.idx)];
    btn.addEventListener('click', () => editarLancamentoFatura(p));
  });
}

function editarLancamentoFatura(parcela) {
  ocultarPaineisNovaCategoria();
  document.getElementById('editLancParcelamentoId').value = parcela.parcelamento_id;
  document.getElementById('editLancParcelaId').value = parcela.id;
  document.getElementById('editLancDescricao').value = parcela.descricao_compra;
  carregarCategoriasEdicaoLancamento(parcela.categoria || 'Cartão');
  document.getElementById('editLancDataCompra').value = parcela.data_compra ? String(parcela.data_compra).split('T')[0] : '';
  document.getElementById('editLancValor').value = Number(parcela.valor).toFixed(2);
  abrirModal('modalEditarLancamento');
}

async function salvarEdicaoLancamento(e) {
  e.preventDefault();
  const parcelamentoId = document.getElementById('editLancParcelamentoId').value;
  const dados = {
    descricao_compra: document.getElementById('editLancDescricao').value.trim(),
    categoria: document.getElementById('editLancCategoria').value,
    data_compra: document.getElementById('editLancDataCompra').value || null,
    parcela_id: Number(document.getElementById('editLancParcelaId').value),
    valor_parcela: parseFloat(document.getElementById('editLancValor').value) || null
  };
  await chamarApi(`/parcelamentos/${parcelamentoId}/lancamento`, { method: 'PATCH', body: JSON.stringify(dados) });
  fecharModal('modalEditarLancamento');
  mostrarToast('Lançamento atualizado com sucesso.');
  if (Estado._faturaCartaoId) await _carregarFaturaCorpo(Estado._faturaCartaoId);
}

// Ícone por tipo de obrigação
const ICONE_TIPO = {
  'Cartão de Crédito': '💳',
  'Empréstimo':        '🏦',
  'Financiamento':     '🏠',
  'Consórcio':         '🤝',
  'Boleto Parcelado':  '📄',
  'Acordo de Dívida':  '✍️',
  'Outro':             '📦'
};

function _renderizarTabelaParcelamentosHtml(lista) {
  if (!lista.length) return `<div class="estado-vazio"><p>Nenhuma obrigação nesta categoria.</p></div>`;
  return `<table class="tabela-padrao">
    <thead><tr><th>Descrição</th><th>Origem</th><th>Responsável</th><th>Pessoa</th><th>Progresso</th><th>Valor Parcela</th><th>Restante</th><th></th></tr></thead>
    <tbody>${lista.map(p=>{
      const pct=(p.parcelas_pagas/p.qtd_parcelas)*100;
      const icone=ICONE_TIPO[p.tipo_obrigacao]||'📦';
      const resp=p.responsavel_texto||p.nome_cartao||'—';
      return `<tr>
        <td>${escaparHtml(p.descricao_compra)}</td>
        <td><span title="${escaparHtml(p.tipo_obrigacao)}">${icone} ${escaparHtml(p.tipo_obrigacao)}</span></td>
        <td>${escaparHtml(resp)}</td>
        <td><span class="etiqueta-pessoa"><span class="bolinha-pessoa" style="background:${p.usuario_cor}"></span>${escaparHtml(p.usuario_nome)}</span></td>
        <td><div class="progresso-parcela"><div class="barra-fundo"><div class="barra-preenchimento" style="width:${pct}%"></div></div><span class="texto-progresso">${p.parcelas_pagas}/${p.qtd_parcelas}</span></div></td>
        <td>${formatarMoeda(p.valor_parcela)}</td>
        <td class="valor-negativo">${formatarMoeda(p.valor_restante)}</td>
        <td class="celula-acoes">
          <button class="botao-icone" data-editar-parcelamento="${p.id}" title="Editar">✎</button>
          <button class="botao-icone" data-excluir-parcelamento="${p.id}" title="Excluir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

async function carregarTabelaParcelamentos() {
  const resp = await chamarApi('/parcelamentos');
  const lista = resp.dados;
  const cc     = lista.filter(p=>p.tipo_obrigacao==='Cartão de Crédito' && Number(p.qtd_parcelas)>1);
  const outros = lista.filter(p=>p.tipo_obrigacao!=='Cartão de Crédito');

  const ctnCC     = document.getElementById('tabelaParcelamentosCC');
  const ctnOutros = document.getElementById('tabelaParcelamentosOutros');
  if (ctnCC)     ctnCC.innerHTML     = _renderizarTabelaParcelamentosHtml(cc);
  if (ctnOutros) ctnOutros.innerHTML = _renderizarTabelaParcelamentosHtml(outros);

  [ctnCC, ctnOutros].forEach(ctn=>{
    if(!ctn) return;
    ctn.querySelectorAll('[data-excluir-parcelamento]').forEach(btn=>btn.addEventListener('click',()=>confirmarExclusao('parcelamento',btn.getAttribute('data-excluir-parcelamento'),'esta obrigação parcelada (todas as parcelas serão removidas)')));
    ctn.querySelectorAll('[data-editar-parcelamento]').forEach(btn=>btn.addEventListener('click',()=>abrirModalParcelamento(lista.find(p=>String(p.id)===btn.dataset.editarParcelamento))));
  });
}

function opcoesResponsavelCartao(item=null) {
  const opts = Estado.usuarios.map(u=>`<option value="${u.id}">${escaparHtml(u.nome)}</option>`).join('');
  return opts + '<option value="casal">Casal (50/50)</option>';
}

function abrirModalCartao(item=null) {
  document.getElementById('formCartao').reset();
  document.getElementById('cartaoUsuario').innerHTML = opcoesResponsavelCartao();
  document.getElementById('cartaoId').value=item?.id||'';
  if(item){
    const val=item.rateado?'casal':String(item.usuario_id);
    document.getElementById('cartaoUsuario').value=val;
    document.getElementById('cartaoNome').value=item.nome_cartao;
    document.getElementById('cartaoBanco').value=item.banco;
    document.getElementById('cartaoLimite').value=item.limite;
    document.getElementById('cartaoFechamento').value=item.dia_fechamento;
    document.getElementById('cartaoVencimento').value=item.dia_vencimento;
  }
  abrirModal('modalCartao');
}

async function salvarCartao(evento) {
  evento.preventDefault();
  const responsavel=document.getElementById('cartaoUsuario').value;
  const dados = {
    usuario_id:      responsavel==='casal'?null:responsavel,
    rateado:         responsavel==='casal'?1:0,
    nome_cartao:     document.getElementById('cartaoNome').value.trim(),
    banco:           document.getElementById('cartaoBanco').value.trim(),
    limite:          parseFloat(document.getElementById('cartaoLimite').value)||0,
    dia_fechamento:  parseInt(document.getElementById('cartaoFechamento').value),
    dia_vencimento:  parseInt(document.getElementById('cartaoVencimento').value)
  };
  try {
    const id=document.getElementById('cartaoId').value;
    await chamarApi(id?`/cartoes/${id}`:'/cartoes', { method: id?'PUT':'POST', body: JSON.stringify(dados) });
    mostrarToast('Cartão salvo com sucesso.');
    fecharModal('modalCartao');
    await carregarTabelaCartoes();
  } catch (err) { /* erro já tratado */ }
}

// Configuração dos campos de cada tipo de obrigação
const CONFIG_TIPO_OBRIGACAO = {
  'Cartão de Crédito': {
    labelResponsavel: null,
    campoValor: 'total',         // exibe "Valor Total" + calcula parcela automaticamente
    usaCartao: true,
    usaDataCompra: true,
    usaPrimeiroVencimento: false
  },
  'Empréstimo': {
    labelResponsavel: 'Instituição Financeira',
    campoValor: 'parcela',       // exibe "Valor Contratado" + "Valor da Parcela" direto
    usaCartao: false,
    usaDataCompra: false,
    usaPrimeiroVencimento: true
  },
  'Financiamento': {
    labelResponsavel: 'Instituição',
    campoValor: 'parcela',
    usaCartao: false,
    usaDataCompra: false,
    usaPrimeiroVencimento: true
  },
  'Consórcio': {
    labelResponsavel: 'Administradora',
    campoValor: 'soParcela',     // só valor da parcela, sem valor total
    usaCartao: false,
    usaDataCompra: false,
    usaPrimeiroVencimento: true
  },
  'Boleto Parcelado': {
    labelResponsavel: 'Fornecedor',
    campoValor: 'total',
    usaCartao: false,
    usaDataCompra: false,
    usaPrimeiroVencimento: true
  },
  'Acordo de Dívida': {
    labelResponsavel: null,
    campoValor: 'parcela',
    usaCartao: false,
    usaDataCompra: false,
    usaPrimeiroVencimento: true
  },
  'Outro': {
    labelResponsavel: null,
    campoValor: 'parcela',
    usaCartao: false,
    usaDataCompra: false,
    usaPrimeiroVencimento: true
  }
};

function opcoesUsuariosComCasal(valorSelecionado = '') {
  const opts = Estado.usuarios.map(u =>
    `<option value="${u.id}" ${String(u.id) === String(valorSelecionado) ? 'selected' : ''}>${escaparHtml(u.nome)}</option>`
  );
  opts.push(`<option value="casal" ${valorSelecionado === 'casal' ? 'selected' : ''}>Casal (50/50)</option>`);
  return opts.join('');
}

function abrirModalParcelamento(item=null) {
  document.getElementById('formParcelamento').reset();
  ocultarPaineisNovaCategoria();
  document.getElementById('parcelamentoUsuario').innerHTML = opcoesUsuariosComCasal();
  carregarCategoriasParcelamento();
  document.getElementById('parcelamentoDataCompra').value = new Date().toISOString().slice(0, 10);
  document.getElementById('parcelamentoPrimeiroVencimento').value = new Date().toISOString().slice(0, 10);
  document.getElementById('parcelamentoId').value=item?.id||'';
  if(item){
    document.getElementById('parcelamentoTipoObrigacao').value=item.tipo_obrigacao;
    document.getElementById('parcelamentoUsuario').value=item.rateado ? 'casal' : item.usuario_id;
    document.getElementById('parcelamentoDescricao').value=item.descricao_compra;
    carregarCategoriasParcelamento(item.categoria || 'Cartão');
    document.getElementById('parcelamentoQtdParcelas').value=item.qtd_parcelas;
    document.getElementById('parcelamentoResponsavel').value=item.responsavel_texto||'';
    document.getElementById('parcelamentoValorTotalInput').value=item.valor_total;
    document.getElementById('parcelamentoValorParcelaInput').value=item.valor_parcela;
    document.getElementById('parcelamentoDataCompra').value=dataParaInputDate(item.data_compra);
    document.getElementById('parcelamentoPrimeiroVencimento').value=dataParaInputDate(item.data_primeiro_vencimento);
  }
  atualizarCamposParcelamento();
  abrirModal('modalParcelamento');
}

function atualizarCamposParcelamento() {
  const tipo = document.getElementById('parcelamentoTipoObrigacao').value;
  const cfg  = CONFIG_TIPO_OBRIGACAO[tipo] || CONFIG_TIPO_OBRIGACAO['Outro'];

  // Responsável (instituição / administradora / fornecedor)
  const grupoResp = document.getElementById('grupoParcelamentoResponsavel');
  if (cfg.labelResponsavel) {
    grupoResp.style.display = '';
    grupoResp.querySelector('label').textContent = cfg.labelResponsavel;
  } else {
    grupoResp.style.display = 'none';
    document.getElementById('parcelamentoResponsavel').value = '';
  }

  // Cartão (só para Cartão de Crédito)
  document.getElementById('grupoParcelamentoCartao').style.display = cfg.usaCartao ? '' : 'none';
  if (cfg.usaCartao) {
    document.getElementById('parcelamentoCartao').innerHTML = Estado.cartoes.length
      ? Estado.cartoes.map(c => `<option value="${c.id}">${escaparHtml(c.nome_cartao)} - ${escaparHtml(c.banco)}</option>`).join('')
      : '<option value="">Nenhum cartão cadastrado</option>';
  }

  // Valor Total (Cartão de Crédito e Boleto Parcelado)
  document.getElementById('grupoParcelamentoValorTotal').style.display    = ['total'].includes(cfg.campoValor) ? '' : 'none';
  // Valor da Parcela (digitado diretamente — Empréstimo, Financiamento, Consórcio, etc.)
  document.getElementById('grupoParcelamentoValorParcela').style.display  = ['parcela','soParcela'].includes(cfg.campoValor) ? '' : 'none';
  // Preview do valor calculado (automático para Cartão / Boleto)
  document.getElementById('grupoParcelamentoValorCalc').style.display     = ['total'].includes(cfg.campoValor) ? '' : 'none';

  // Datas
  document.getElementById('grupoParcelamentoDataCompra').style.display           = cfg.usaDataCompra ? '' : 'none';
  document.getElementById('grupoParcelamentoPrimeiroVencimento').style.display   = cfg.usaPrimeiroVencimento ? '' : 'none';

  // Recalcula quando muda o tipo
  calcularValorParcelaPreview();
}

function calcularValorParcelaPreview() {
  const tipo = document.getElementById('parcelamentoTipoObrigacao').value;
  const cfg  = CONFIG_TIPO_OBRIGACAO[tipo] || CONFIG_TIPO_OBRIGACAO['Outro'];
  if (cfg.campoValor !== 'total') return;
  const valorTotal = parseFloat(document.getElementById('parcelamentoValorTotalInput').value) || 0;
  const qtd        = parseInt(document.getElementById('parcelamentoQtdParcelas').value) || 0;
  const preview    = document.getElementById('parcelamentoValorCalcPreview');
  if (valorTotal > 0 && qtd > 0) {
    preview.value = formatarMoeda(valorTotal / qtd);
  } else {
    preview.value = '';
  }
}

async function salvarParcelamento(evento) {
  evento.preventDefault();
  const tipo = document.getElementById('parcelamentoTipoObrigacao').value;
  const cfg  = CONFIG_TIPO_OBRIGACAO[tipo] || CONFIG_TIPO_OBRIGACAO['Outro'];

  const pessoaVal = document.getElementById('parcelamentoUsuario').value;
  const dados = {
    tipo_obrigacao:   tipo,
    usuario_id:       pessoaVal === 'casal' ? null : pessoaVal,
    rateado:          pessoaVal === 'casal' ? 1 : 0,
    descricao_compra: document.getElementById('parcelamentoDescricao').value.trim(),
    categoria:        document.getElementById('parcelamentoCategoria').value,
    qtd_parcelas:     parseInt(document.getElementById('parcelamentoQtdParcelas').value)
  };

  if (cfg.labelResponsavel) {
    dados.responsavel_texto = document.getElementById('parcelamentoResponsavel').value.trim();
  }
  if (cfg.usaCartao) {
    dados.cartao_id = document.getElementById('parcelamentoCartao').value;
  }
  if (cfg.campoValor === 'total') {
    dados.valor_total = parseFloat(document.getElementById('parcelamentoValorTotalInput').value);
  } else {
    dados.valor_parcela = parseFloat(document.getElementById('parcelamentoValorParcelaInput').value);
  }
  if (cfg.usaDataCompra) {
    dados.data_compra = document.getElementById('parcelamentoDataCompra').value;
  }
  if (cfg.usaPrimeiroVencimento) {
    dados.data_primeiro_vencimento = document.getElementById('parcelamentoPrimeiroVencimento').value;
  }

  try {
    const id=document.getElementById('parcelamentoId').value;
    const resp = await chamarApi(id?`/parcelamentos/${id}`:'/parcelamentos', { method:id?'PUT':'POST', body: JSON.stringify(dados) });
    mostrarToast(resp.mensagem || 'Obrigação parcelada cadastrada com sucesso.');
    fecharModal('modalParcelamento');
    await carregarTabelaParcelamentos();
  } catch (err) { /* erro já tratado */ }
}

// =====================================================================
// PÁGINA: PROJEÇÃO FINANCEIRA (tela mais importante do sistema)
// =====================================================================

async function renderizarPagamentos() {
  const area=document.getElementById('areaPagina');
  area.innerHTML=`
    <div class="painel">
      <div class="barra-filtros" id="filtrosPagamentos">
        ${controlesPeriodo('pag')}
        <select class="campo-select" id="filtroOrigemPagamentos" style="min-width:170px">
          <option value="">Todas as origens</option>
          <option value="Despesas">Despesas</option>
          <option value="Cartão de Crédito">Cartão de Crédito</option>
          <option value="Empréstimo">Empréstimo</option>
          <option value="Financiamento">Financiamento</option>
          <option value="Consórcio">Consórcio</option>
        </select>
      </div>
      <div id="listaPagamentos"></div>
    </div>
    <div class="painel">
      <div class="painel-cabecalho">
        <h3 id="tituloBaixas">Baixas do Período</h3>
      </div>
      <div class="barra-filtros" id="filtrosBaixas" style="padding:10px 16px 0;">${controlesPeriodo('bxs')}</div>
      <div id="historicoPagamentos"></div>
    </div>`;
  inicializarControlesPeriodo('pag');
  inicializarControlesPeriodo('bxs');
  document.querySelectorAll('#filtrosPagamentos input,#filtrosPagamentos select').forEach(el=>el.addEventListener('change',carregarPagamentos));
  document.querySelectorAll('#filtrosBaixas input,#filtrosBaixas select').forEach(el=>el.addEventListener('change',carregarBaixas));
  document.getElementById('formPagamento').onsubmit=confirmarRegistroPagamento;
  await carregarPagamentos();
  await carregarBaixas();
}

async function carregarPagamentos() {
  const queryStr=lerPeriodo('pag');
  const origem=document.getElementById('filtroOrigemPagamentos')?.value||'';
  const resp=await chamarApi(`/pagamentos?${queryStr}${origem?`&origem=${encodeURIComponent(origem)}`:''}`);
  const lista=resp.dados.pendentes;
  const alvo=document.getElementById('listaPagamentos');
  if(!alvo) return;
  alvo.innerHTML=!lista.length
    ?'<div class="estado-vazio"><p>Nenhuma obrigação pendente no período.</p></div>'
    :`<div class="tabela-wrapper"><table class="tabela-padrao"><thead><tr><th>Vencimento</th><th>Descrição</th><th>Origem</th><th>Responsável</th><th>Valor Original</th><th>Valor Pago</th><th>Saldo Aberto</th><th></th></tr></thead><tbody>${lista.map(i=>`<tr>
      <td>${formatarData(i.data_vencimento)}</td>
      <td>${escaparHtml(i.descricao)}${i.numero_parcela?` (${i.numero_parcela}/${i.total_parcelas})`:''}</td>
      <td>${escaparHtml(i.tipo)}</td>
      <td>${escaparHtml(i.usuario_nome||'Casal')}</td>
      <td>${formatarMoeda(i.valor)}</td>
      <td>${formatarMoeda(i.valor_pago)}</td>
      <td class="valor-negativo">${formatarMoeda(i.saldo_pendente)}</td>
      <td><button class="botao botao-primario" data-pagar-tipo="${i.origem_tipo}" data-pagar-id="${i.origem_id}" data-pagar-valor="${i.saldo_pendente}" data-pagar-venc="${String(i.data_vencimento).split('T')[0]}">Registrar</button></td>
    </tr>`).join('')}</tbody></table></div>`;
  alvo.querySelectorAll('[data-pagar-id]').forEach(btn=>btn.addEventListener('click',()=>{
    if(btn.dataset.pagarTipo==='CartaoFatura')
      abrirRegistroFatura(btn.dataset.pagarId,btn.dataset.pagarVenc,btn.dataset.pagarValor);
    else
      abrirRegistroPagamento(btn.dataset.pagarTipo,btn.dataset.pagarId,btn.dataset.pagarValor);
  }));
}

async function carregarBaixas() {
  const queryStr=lerPeriodoLocal('bxs');
  const resp=await chamarApi(`/pagamentos/historico?${queryStr}`);
  const historico=resp.dados;
  const MESES_CURTOS=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const tituloBaixas=document.getElementById('tituloBaixas');
  if(tituloBaixas){
    const el=document.getElementById('bxsTipoPeriodo');
    if(el){
      const tipo=el.value;
      const mes=Number((document.getElementById('bxsMes').value||'').split('-')[1]);
      const ano=Number(document.getElementById('bxsAno')?.value||new Date().getFullYear());
      let label='do Período';
      if(tipo==='mes')label=`de ${MESES_CURTOS[(mes||1)-1]}/${ano}`;
      else if(tipo==='ano')label=`de ${ano}`;
      else if(tipo==='todo')label='— Todo o Período';
      tituloBaixas.textContent=`Baixas ${label}`;
    }
  }
  const hist=document.getElementById('historicoPagamentos');
  if(!hist) return;
  hist.innerHTML=!historico.length
    ?'<div class="estado-vazio"><p>Nenhuma baixa no período.</p></div>'
    :`<div class="tabela-wrapper"><table class="tabela-padrao"><thead><tr><th>Data Pagamento</th><th>Descrição</th><th>Origem</th><th>Valor Pago</th><th>Responsável</th><th></th></tr></thead><tbody>${historico.map(p=>`<tr>
      <td>${formatarData(p.data_pagamento)}</td>
      <td>${escaparHtml(p.descricao)}</td>
      <td>${escaparHtml(p.origem)}</td>
      <td class="valor-positivo">${formatarMoeda(p.valor_pago)}</td>
      <td>${escaparHtml(p.responsavel||'-')}</td>
      <td><button class="botao botao-perigo" data-estornar-id="${p.id}" title="Excluir Baixa" style="font-size:12px;padding:4px 10px;">Excluir</button></td>
    </tr>`).join('')}</tbody></table></div>`;
  hist.querySelectorAll('[data-estornar-id]').forEach(btn=>btn.addEventListener('click',()=>estornarBaixa(btn.dataset.estornarId)));
}

function abrirRegistroFatura(cartao_id,data_vencimento,valor){
  document.getElementById('pagamentoOrigemTipo').value='CartaoFatura';
  document.getElementById('pagamentoOrigemId').value=cartao_id;
  document.getElementById('pagamentoData').value=new Date().toISOString().slice(0,10);
  document.getElementById('pagamentoValor').value=Number(valor).toFixed(2);
  // guarda data_vencimento para usar no submit
  document.getElementById('formPagamento').dataset.faturaVenc=data_vencimento;
  abrirModal('modalPagamento');
}

async function estornarBaixa(id){
  if(!confirm('Excluir esta baixa e restaurar o lançamento como Pendente?')) return;
  await chamarApi(`/pagamentos/${id}`,{method:'DELETE'});
  mostrarToast('Baixa excluída. Lançamento restaurado como Pendente.');
  await carregarPagamentos();
  await carregarBaixas();
}

function abrirRegistroPagamento(tipo,id,valor){document.getElementById('pagamentoOrigemTipo').value=tipo;document.getElementById('pagamentoOrigemId').value=id;document.getElementById('pagamentoData').value=new Date().toISOString().slice(0,10);document.getElementById('pagamentoValor').value=Number(valor).toFixed(2);abrirModal('modalPagamento');}
async function confirmarRegistroPagamento(e){
  e.preventDefault();
  const tipo=document.getElementById('pagamentoOrigemTipo').value;
  const id=document.getElementById('pagamentoOrigemId').value;
  const valor=Number(document.getElementById('pagamentoValor').value);
  const data=document.getElementById('pagamentoData').value;
  if(tipo==='CartaoFatura'){
    const venc=e.target.dataset.faturaVenc;
    await chamarApi('/pagamentos/cartao-fatura',{method:'POST',body:JSON.stringify({cartao_id:Number(id),data_vencimento:venc,valor_pago:valor,data_pagamento:data})});
  } else {
    await chamarApi('/pagamentos',{method:'POST',body:JSON.stringify({origem_tipo:tipo,origem_id:Number(id),valor_pago:valor,data_pagamento:data})});
  }
  fecharModal('modalPagamento');
  mostrarToast('Pagamento registrado. Todos os saldos foram recalculados.');
  await carregarPagamentos();
  await carregarBaixas();
}

async function renderizarProjecao() {
  const resp = await chamarApi('/projecao');
  const meses = resp.dados;
  const area = document.getElementById('areaPagina');

  area.innerHTML = `
    <div class="painel" style="padding:16px 22px; margin-bottom:22px;">
      <p style="margin:0; font-size:13px; color:var(--cor-texto-suave); line-height:1.5;">
        A receita e as despesas fixas dos meses futuros são estimadas com base na média dos últimos meses.
        Os valores de parcelamentos são exatos, pois já estão programados no sistema.
      </p>
    </div>
    <div class="grade-projecao">
      ${meses.map(m => `
        <div class="cartao-mes semaforo-${m.semaforo}">
          <div class="cabecalho-mes">
            <h4>${m.nomeMes} ${m.ano}</h4>
            <span class="semaforo ${m.semaforo}" style="padding:4px 10px 4px 8px; font-size:11px;">
              <span class="luz" style="width:7px;height:7px;"></span>
            </span>
          </div>
          <div class="linha-projecao"><span>Receita Prevista</span><strong class="valor-positivo">${formatarMoeda(m.receitaPrevista)}</strong></div>
          <div class="linha-projecao"><span>Despesas Fixas</span><strong>${formatarMoeda(m.despesasFixas)}</strong></div>
          <div class="linha-projecao"><span>Parcelamentos</span><strong>${formatarMoeda(m.parcelamentos)}</strong></div>
          <div class="linha-projecao"><span>Total Comprometido</span><strong class="valor-negativo">${formatarMoeda(m.totalComprometido)}</strong></div>
          <div class="linha-saldo">
            <span>Saldo Previsto</span>
            <strong class="${m.saldoPrevisto >= 0 ? 'valor-positivo' : 'valor-negativo'}">${formatarMoeda(m.saldoPrevisto)}</strong>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// =====================================================================
// PÁGINA: CONFIGURAÇÕES
// =====================================================================

async function renderizarConfiguracoes() {
  const area = document.getElementById('areaPagina');
  const ehAdmin = Estado.usuarioAuth?.perfil === 'ADMIN';
  area.innerHTML = `
    <div class="painel">
      <div class="painel-cabecalho"><h3>Pessoas do Sistema</h3></div>
      <div class="painel-corpo com-padding">
        <p style="margin:0 0 16px; font-size:13px; color:var(--cor-texto-suave);">
          O Bitencourt's Financial foi desenhado para duas pessoas controlarem as finanças juntas, de forma simples.
        </p>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${Estado.usuarios.map(u => `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border:1px solid var(--cor-borda); border-radius:10px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:12px;">
                <div class="avatar-mini" style="background:${u.cor}; width:34px; height:34px; font-size:13px;">${iniciaisNome(u.nome)}</div>
                <div>
                  <div style="font-weight:600; font-size:14px;">${escaparHtml(u.nome)}</div>
                  <div style="font-size:12px; color:var(--cor-texto-suave);">${escaparHtml(u.usuario || '-')} · ${escaparHtml(u.perfil || 'USUARIO')} · ${u.ativo ? 'Ativo' : 'Bloqueado'}</div>
                </div>
              </div>
              ${ehAdmin ? `<div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="botao botao-secundario" type="button" data-acao-usuario="editar" data-id="${u.id}">Editar</button>
                <button class="botao botao-secundario" type="button" data-acao-usuario="resetar" data-id="${u.id}">Resetar senha</button>
                <button class="botao botao-secundario" type="button" data-acao-usuario="toggle" data-id="${u.id}" data-ativo="${u.ativo ? '1' : '0'}">${u.ativo ? 'Bloquear' : 'Ativar'}</button>
                <button class="botao botao-perigo" type="button" data-acao-usuario="excluir" data-id="${u.id}">Excluir</button>
              </div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
    ${ehAdmin ? `<div class="painel">
      <div class="painel-cabecalho"><h3>Gerenciar Usuários</h3></div>
      <div class="painel-corpo com-padding">
        <form id="formUsuarioConfiguracao">
          <input type="hidden" id="usuarioId" value="">
          <div class="linha-form">
            <div class="grupo-form">
              <label>Nome</label>
              <input class="campo-input" id="usuarioNome" required>
            </div>
            <div class="grupo-form">
              <label>Usuário</label>
              <input class="campo-input" id="usuarioLogin" required>
            </div>
          </div>
          <div class="linha-form">
            <div class="grupo-form">
              <label>Senha</label>
              <input class="campo-input" id="usuarioSenha" type="password" placeholder="Deixe em branco para manter a atual">
            </div>
            <div class="grupo-form">
              <label>Perfil</label>
              <select class="campo-select" id="usuarioPerfil">
                <option value="USUARIO">USUARIO</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          </div>
          <div class="grupo-form">
            <label>Status</label>
            <select class="campo-select" id="usuarioAtivo">
              <option value="1">Ativo</option>
              <option value="0">Bloqueado</option>
            </select>
          </div>
          <button class="botao botao-primario" type="submit">Salvar usuário</button>
        </form>
      </div>
    </div>` : ''}
    <div class="painel">
      <div class="painel-cabecalho"><h3>Sobre o Sistema</h3></div>
      <div class="painel-corpo com-padding">
        <p style="margin:0; font-size:13px; color:var(--cor-texto-suave); line-height:1.6;">
          Bitencourt's Financial é um sistema simples de controle financeiro para duas pessoas, sem a complexidade
          de outros aplicativos do mercado. O foco é responder com clareza: quanto entrou, quanto saiu, quanto
          sobra e quanto já está comprometido nos próximos meses.
        </p>
      </div>
    </div>
  `;

  document.getElementById('formUsuarioConfiguracao')?.addEventListener('submit', salvarUsuarioConfiguracao);
}

async function salvarUsuarioConfiguracao(evento) {
  evento.preventDefault();
  const id = document.getElementById('usuarioId').value;
  const nome = document.getElementById('usuarioNome').value.trim();
  const usuario = document.getElementById('usuarioLogin').value.trim();
  const senha = document.getElementById('usuarioSenha').value;
  const perfil = document.getElementById('usuarioPerfil').value;
  const ativo = document.getElementById('usuarioAtivo').value === '1';

  try {
    const payload = { nome, usuario, perfil, ativo };
    if (senha) payload.senha = senha;
    if (id) {
      await chamarApi(`/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      mostrarToast('Usuário atualizado com sucesso.', 'sucesso');
    } else {
      await chamarApi('/usuarios', { method: 'POST', body: JSON.stringify(payload) });
      mostrarToast('Usuário criado com sucesso.', 'sucesso');
    }
    document.getElementById('formUsuarioConfiguracao').reset();
    document.getElementById('usuarioId').value = '';
    await carregarUsuarios();
    await renderizarConfiguracoes();
  } catch (err) {
    // erro já tratado
  }
}

function preencherFormularioUsuario(usuario) {
  document.getElementById('usuarioId').value = usuario.id;
  document.getElementById('usuarioNome').value = usuario.nome || '';
  document.getElementById('usuarioLogin').value = usuario.usuario || '';
  document.getElementById('usuarioPerfil').value = usuario.perfil || 'USUARIO';
  document.getElementById('usuarioAtivo').value = usuario.ativo ? '1' : '0';
  document.getElementById('usuarioSenha').value = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function carregarUsuarios() {
  const resp = await chamarApi('/usuarios');
  Estado.usuarios = resp.dados || [];
  renderizarAvataresRodape();
}

async function alternarStatusUsuario(id, ativo) {
  try {
    await chamarApi(`/usuarios/${id}/bloquear`, { method: 'PATCH', body: JSON.stringify({ ativo: !ativo }) });
    mostrarToast('Status atualizado com sucesso.', 'sucesso');
    await carregarUsuarios();
    await renderizarConfiguracoes();
  } catch (err) {
    // erro já tratado
  }
}

async function resetarSenhaUsuario(id) {
  try {
    const resp = await chamarApi(`/usuarios/${id}/resetar-senha`, { method: 'POST' });
    mostrarToast(`Senha redefinida. Temporária: ${resp.senhaTemporaria}`, 'sucesso');
    await carregarUsuarios();
    await renderizarConfiguracoes();
  } catch (err) {
    // erro já tratado
  }
}

async function excluirUsuario(id) {
  try {
    await chamarApi(`/usuarios/${id}`, { method: 'DELETE' });
    mostrarToast('Usuário excluído com sucesso.', 'sucesso');
    await carregarUsuarios();
    await renderizarConfiguracoes();
  } catch (err) {
    // erro já tratado
  }
}

// =====================================================================
// EXCLUSÃO GENÉRICA (usada por Receitas, Despesas, Cartões, Parcelamentos)
// =====================================================================

const ENDPOINTS_EXCLUSAO = {
  receita: '/receitas',
  despesa: '/despesas',
  cartao: '/cartoes',
  parcelamento: '/parcelamentos'
};

const RECARREGAR_APOS_EXCLUSAO = {
  receita: carregarTabelaReceitas,
  despesa: carregarTabelaDespesas,
  cartao: carregarTabelaCartoes,
  parcelamento: carregarTabelaParcelamentos
};

function confirmarExclusao(tipo, id, descricaoItem) {
  Estado.exclusaoPendente = { tipo, id };
  document.getElementById('textoConfirmacao').textContent =
    `Tem certeza que deseja excluir ${descricaoItem}? Essa ação não pode ser desfeita.`;
  abrirModal('modalConfirmar');
}

document.getElementById('botaoConfirmarExclusao').addEventListener('click', async () => {
  if (!Estado.exclusaoPendente) return;
  const { tipo, id } = Estado.exclusaoPendente;
  try {
    await chamarApi(`${ENDPOINTS_EXCLUSAO[tipo]}/${id}`, { method: 'DELETE' });
    mostrarToast('Item excluído com sucesso.');
    fecharModal('modalConfirmar');
    if (RECARREGAR_APOS_EXCLUSAO[tipo]) {
      await RECARREGAR_APOS_EXCLUSAO[tipo]();
    }
  } catch (err) {
    // erro já tratado em chamarApi
  } finally {
    Estado.exclusaoPendente = null;
  }
});

// =====================================================================
// NOVA CATEGORIA DE DESPESA / PARCELAMENTO (localStorage)
// =====================================================================

CONTROLES_NOVA_CATEGORIA.forEach(controle => {
  document.getElementById(controle.botaoId)?.addEventListener('click', () => alternarPainelNovaCategoria(controle));
  document.getElementById(controle.confirmarId)?.addEventListener('click', () => confirmarNovaCategoria(controle));
  document.getElementById(controle.inputId)?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmarNovaCategoria(controle); }
    if (e.key === 'Escape') { ocultarPaineisNovaCategoria(); }
  });
});

document.getElementById('formEditarLancamento').onsubmit = salvarEdicaoLancamento;
