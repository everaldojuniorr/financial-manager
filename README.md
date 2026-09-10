# Controle Financeiro

Painel de gerenciamento financeiro pessoal com ênfase em **microgerenciamento**: acompanhar cada entrada e saída no detalhe, ver o ritmo de gasto em relação ao orçamento e registrar lançamentos no momento em que acontecem.

A tela é única e densa, no formato de painel de controle — todo o acompanhamento cabe em uma visão só, sem navegação entre páginas.

## O que a tela entrega

**Resumo do período** — entradas, saídas, saldo e ticket médio, cada um comparado com o período anterior de mesmo tamanho. A taxa de poupança sai direto do saldo sobre as entradas.

**Fluxo de caixa diário** — gráfico divergente com entradas acima da linha e saídas abaixo, dia a dia, com detalhamento ao passar o mouse. Uma segunda visão mostra o saldo acumulado ao longo do período, para enxergar em que ponto do mês a conta virou.

**Ritmo de gasto** — a peça central do microgerenciamento. Compara o quanto já foi gasto com o quanto deveria ter sido gasto até hoje, calcula quanto ainda dá para gastar por dia sem estourar e projeta o fechamento do período.

A projeção trata gasto fixo e variável de forma diferente, e isso importa. Contas fixas caem em dias específicos — aluguel no dia 10, plano de saúde no dia 8 — então extrapolá-las a partir da média diária infla a previsão no começo do mês. O cálculo em `buildPacing` extrapola apenas o gasto variável e assume, para os lançamentos recorrentes, a mesma carga do período anterior. O limite diário exibido também desconta as contas fixas ainda por vencer, de modo que o número represente o que sobra de fato para gasto livre. Quando o período já está encerrado, o card mostra o resultado realizado em vez de uma previsão.

**Gasto por categoria** — cada categoria com valor gasto, percentual do orçamento consumido, número de lançamentos e participação no total. Categorias acima do orçamento ficam em vermelho. Clicar em uma categoria filtra a tabela de lançamentos.

**Para onde o dinheiro vaza** — ranking das etiquetas por gasto acumulado, com quantidade e valor médio. É o painel que expõe o gasto pequeno e repetido que o total mensal esconde.

**Lançamentos** — tabela com busca por texto, filtros por tipo, categoria e método de pagamento, ordenação por data, descrição ou valor, e ações de duplicar para hoje ou excluir.

**Registro rápido** — formulário sempre visível no desktop (e em painel deslizante no celular) para lançar entrada ou saída à vista em poucos campos. Compras no cartão não entram aqui.

**Faturas de cartão** — uma linha por ciclo (competência + vencimento). Compras e parcelas (`5/12`, `1/1`) ficam nos detalhes da fatura, não espalhadas no extrato. Ao quitar, o sistema gera uma única saída de caixa (“Pagamento fatura …”) na data do pagamento.

A interface cobre estados de carregamento, erro com opção de tentar novamente, e vazio (tanto sem dados quanto sem resultados para os filtros). Funciona em desktop e celular, com tema claro e escuro.

## Como rodar

Requer Node.js 20+ e PostgreSQL (local ou via Docker).

Copie `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | Connection string do PostgreSQL |
| `AUTH_SECRET` | Segredo para assinar o cookie de sessão (mín. 32 caracteres) |
| `SEED_USERNAME` | Usuário admin criado no seed |
| `SEED_PASSWORD` | Senha do admin (hasheada com bcrypt no banco) |

### Desenvolvimento local

Suba só o Postgres:

```bash
docker compose up -d db
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

A aplicação sobe em [http://localhost:3000](http://localhost:3000). Login padrão do seed: `admin` / `admin123` (ou o que estiver em `.env.local`). Sem sessão válida, o acesso redireciona para `/login`.

### Produção / VPS (app + Postgres)

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

O script builda a nova imagem com o slot atual no ar, sobe o outro slot (`app-blue` / `app-green`), só troca o Caddy depois de `https://financyexpert.com/login` responder 200 e então remove o slot antigo. O acesso público é [https://financyexpert.com](https://financyexpert.com).

#### Deploy automático (GitHub Actions)

Há um workflow em [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) que, a cada push em `main`, conecta na VPS por SSH, atualiza o código e roda `scripts/deploy.sh`.

Configure em **Settings → Secrets and variables → Actions**:

| Secret | Exemplo |
| --- | --- |
| `VPS_HOST` | `2.25.158.41` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | conteúdo da chave **privada** (`id_ed25519`) da VPS/deploy |
| `VPS_PORT` | `22` (opcional) |

A chave pública correspondente precisa estar em `~/.ssh/authorized_keys` do usuário da VPS. O runner do GitHub deve conseguir acessar a porta SSH.

Para importar um `data/ledger.json` antigo para o admin:

```bash
npm run db:import-ledger
```

Outros comandos:

```bash
npm run build          # build de produção
npm start              # servir o build
npm run lint           # ESLint
npx tsc --noEmit       # checagem de tipos
npm run db:generate    # gera migration Drizzle
npm run db:migrate     # aplica migrations
npm run db:seed        # admin + demo se vazio
```

## Dados

Os dados ficam no **PostgreSQL**, isolados por usuário (`user_id`). Categorias e orçamentos continuam em código (`src/lib/categories.ts`).

Na primeira subida, `npm run db:seed` (ou o entrypoint do Docker) cria o usuário admin e, se não houver lançamentos, popula um demonstrativo com o gerador determinístico (`src/lib/seed.ts`) — 210 dias de lançamentos realistas, faturas de cartão e um pagamento de fatura fechada.

Os orçamentos em `src/lib/categories.ts` foram calibrados contra o gasto médio gerado: o total fica em torno de 97% do orçamento, com lazer e compras deliberadamente apertados para que o estado de estouro apareça no painel.

**Como o cartão funciona:** compras no crédito viram itens dentro da fatura da competência. O extrato mensal mostra só movimentação de caixa (Pix, débito, pagamento da fatura). Categorias e etiquetas somam gastos à vista **mais** itens das faturas da competência — sem contar o pagamento da fatura de novo.

## API

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Autentica e define cookie de sessão (`200`, ou `401`) |
| `POST` | `/api/auth/logout` | Encerra a sessão (`204`) |
| `GET` | `/api/transactions` | Lista lançamentos e categorias |
| `POST` | `/api/transactions` | Cria um lançamento (`201`, ou `422` com a lista de erros) |
| `PUT` | `/api/transactions/:id` | Substitui um lançamento |
| `DELETE` | `/api/transactions/:id` | Remove um lançamento (`204`, ou `404`) |
| `GET` | `/api/invoices` | Lista faturas com totais |
| `POST` | `/api/invoices` | Cria uma fatura |
| `GET` | `/api/invoices/:id` | Detalhe da fatura + itens |
| `DELETE` | `/api/invoices/:id` | Remove fatura não paga |
| `POST` | `/api/invoices/:id/items` | Adiciona compra à fatura |
| `PUT/DELETE` | `/api/invoices/:id/items/:itemId` | Edita ou remove compra |
| `POST` | `/api/invoices/:id/pay` | Quita fatura e gera saída de caixa |

As demais rotas exigem sessão válida (`401` sem cookie). A validação fica em `src/lib/validation.ts` e `src/lib/invoice-validation.ts`. Compras no cartão via `/api/transactions` são rejeitadas — use os itens da fatura.


## Estrutura

```
src/
  app/
    api/                  rotas da API (auth, transactions, invoices)
    login/                tela de login
    layout.tsx
    page.tsx
  components/finance/     painel
  db/                     schema e client Drizzle
  lib/
    auth.ts               sessão + bcrypt
    store.ts              repositório PostgreSQL
    categories.ts
    finance.ts
    seed.ts
docker/
  entrypoint.sh           migrate → seed → start
drizzle/                  migrations SQL
scripts/                  migrate, seed, import-ledger
docker-compose.yml
Dockerfile
```

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, PostgreSQL + Drizzle ORM. Os gráficos são desenhados à mão com CSS e SVG, sem biblioteca de charts. Deploy com Docker Compose (app + Postgres).
