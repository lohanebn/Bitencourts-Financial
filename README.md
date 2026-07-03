# Bitencourt's Financial

Sistema de controle financeiro pessoal para casal ou duas pessoas, focado em simplicidade, organização e projeção de gastos futuros.

O sistema não tenta competir em complexidade com aplicativos como Mobills ou Organizze. A proposta é responder, de forma rápida e visual, quatro perguntas:

- Quanto entrou?
- Quanto saiu?
- Quanto sobra?
- Quanto já está comprometido nos próximos meses?

## Tecnologias

**Frontend:** HTML5, CSS3, JavaScript Vanilla (sem frameworks)
**Backend:** Node.js + Express
**Banco de Dados:** MySQL
**Arquitetura:** MVC + API REST

## Estrutura de Pastas

```
bitencourts-financial/
├── config/
│   └── database.js          # Configuração de conexão MySQL
├── models/                  # Camada de acesso a dados
│   ├── usuarioModel.js
│   ├── receitaModel.js
│   ├── despesaModel.js
│   ├── cartaoModel.js
│   └── parcelamentoModel.js
├── controllers/             # Regras de negócio
│   ├── usuarioController.js
│   ├── receitaController.js
│   ├── despesaController.js
│   ├── cartaoController.js
│   ├── parcelamentoController.js
│   ├── dashboardController.js
│   └── projecaoController.js
├── routes/                  # Definição das rotas REST
├── middleware/
│   └── errorHandler.js
├── database/
│   └── schema.sql           # Script completo do banco (tabelas + dados fictícios)
├── public/                  # Frontend
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── server.js                 # Ponto de entrada da aplicação
├── package.json
└── .env.example
```

## Pré-requisitos

- Node.js 18 ou superior
- MySQL 8 (ou MariaDB compatível) instalado e em execução

## Instalação

**1. Instale as dependências**

```bash
npm install
```

**2. Configure o banco de dados**

Abra o MySQL e execute o script completo (ele já cria o banco, as tabelas e os dados fictícios de demonstração):

```bash
mysql -u root -p < database/schema.sql
```

Ou, se preferir, abra o arquivo `database/schema.sql` em uma ferramenta como o MySQL Workbench e execute o script inteiro.

**3. Configure as variáveis de ambiente**

Copie o arquivo de exemplo e ajuste usuário/senha do seu MySQL local:

```bash
cp .env.example .env
```

Edite o `.env` com os dados da sua instalação:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha_aqui
DB_NAME=bitencourts_financial
PORT=3000
```

**4. Inicie o servidor**

```bash
npm start
```

Para desenvolvimento, com reinício automático ao salvar arquivos:

```bash
npm run dev
```

**5. Acesse o sistema**

Abra o navegador em: **http://localhost:3000**

## Usuários do Sistema

O sistema não possui autenticação (login/senha), conforme solicitado. Ele já vem com dois usuários fixos pré-cadastrados para uso imediato:

- **Lohane**
- **Parceira**

Ambos com dados fictícios de receitas, despesas, cartões e parcelamentos para demonstração.

## Funcionalidades

### 1. Dashboard
Cards de receita total, despesas, saldo previsto e parcelamentos futuros; semáforo financeiro (verde/amarelo/vermelho); resumo por pessoa; próximas contas a vencer; parcelamentos ativos; gráfico de despesas por categoria.

### 2. Receitas
Cadastro, edição, exclusão e filtros por pessoa e categoria (Salário, Freelance, Extra, Investimento, Outros).

### 3. Despesas
Cadastro, edição, exclusão e filtros por pessoa, categoria, tipo (Fixa/Variável) e status (Pendente/Pago/Atrasado). Despesas pendentes vencidas são automaticamente marcadas como "Atrasado".

### 4. Cartões e Parcelamentos
Cadastro de cartões (limite, dia de fechamento e vencimento) e de compras parceladas. Ao cadastrar uma compra parcelada, **todas as parcelas futuras são geradas automaticamente**, com acompanhamento de progresso (pagas x pendentes) e cálculo do valor restante.

### 5. Projeção Financeira
A tela mais importante do sistema: mostra os próximos 12 meses com receita prevista, despesas fixas, parcelamentos programados, total comprometido e saldo previsto — com o semáforo financeiro indicando a saúde de cada mês. Os meses futuros usam a média dos últimos meses como estimativa de receita e despesas fixas; os parcelamentos são exatos, pois já estão programados.

### 6. Configurações
Visualização das pessoas cadastradas no sistema e informações gerais.

## Indicador (Semáforo Financeiro)

- 🟢 **Verde:** saldo previsto maior que 20% da receita
- 🟡 **Amarelo:** saldo previsto entre 0% e 20% da receita
- 🔴 **Vermelho:** saldo previsto negativo

## Observações Técnicas

- O banco usa `InnoDB` com chaves estrangeiras, índices e `CHECK constraints` para garantir integridade dos dados.
- A geração de parcelas ajusta automaticamente a última parcela para eliminar diferenças de centavos por arredondamento.
- Todas as datas são tratadas como `DATE` (sem hora), e o backend retorna strings de data já formatadas para evitar problemas de fuso horário.
- O frontend é uma SPA simples (sem frameworks), com navegação por troca de conteúdo via JavaScript puro.
