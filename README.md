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

Requer Node.js 20 ou superior.

Copie `.env.example` para `.env.local` e defina as credenciais:

```bash
cp .env.example .env.local
```

| Variável | Descrição |
| --- | --- |
| `AUTH_USERNAME` | Usuário fixo do painel |
| `AUTH_PASSWORD` | Senha fixa |
| `AUTH_SECRET` | Segredo para assinar o cookie de sessão (mín. 32 caracteres) |

```bash
npm install
npm run dev
```

A aplicação sobe em [http://localhost:3000](http://localhost:3000). Sem sessão válida, o acesso redireciona para `/login`. A sessão dura 7 dias (cookie httpOnly). Use **Sair** no header para encerrar. Para usar outra porta:

```bash
npm run dev -- --port 43917
```

Outros comandos:

```bash
npm run build   # build de produção
npm start       # servir o build
npm run lint    # ESLint
npx tsc --noEmit  # checagem de tipos
```

## Dados

O projeto não depende de banco de dados nem de credenciais. Um gerador determinístico (`src/lib/seed.ts`) cria 210 dias de lançamentos realistas — contas fixas mensais, mercado, delivery, transporte, lazer, salário e freelances — usando um PRNG com semente fixa, então o conjunto é sempre o mesmo em qualquer máquina. O histórico é longo o bastante para que a janela de 90 dias tenha um período anterior completo com que se comparar.

Os orçamentos em `src/lib/categories.ts` foram calibrados contra o gasto médio gerado: o total fica em torno de 97% do orçamento, com lazer e compras deliberadamente apertados para que o estado de estouro apareça no painel.

Os lançamentos, faturas e itens de fatura são persistidos em `data/ledger.json` no disco. Na primeira execução, se o arquivo não existir, o gerador de seed popula o ledger automaticamente (incluindo faturas de demonstração). Cada mutação grava o arquivo de imediato (escrita atômica via `.tmp` + rename). O arquivo real não vai para o Git — só a pasta `data/` com um `.gitkeep`; cada máquina ou VPS mantém o seu próprio ledger.

**Como o cartão funciona:** compras no crédito viram itens dentro da fatura da competência. O extrato mensal mostra só movimentação de caixa (Pix, débito, pagamento da fatura). Categorias e etiquetas somam gastos à vista **mais** itens das faturas da competência — sem contar o pagamento da fatura de novo.

Se `ledger.json` estiver corrompido, o sistema faz backup com sufixo `.corrupt-<timestamp>.json` e re-seeda. Ledgers antigos (só transações) ganham faturas demo na primeira leitura após a atualização.

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
    api/transactions/       rotas da API
    layout.tsx              fontes, metadados e bootstrap do tema
    page.tsx
    globals.css             tokens de cor, incluindo positivo/negativo
  components/
    finance/                componentes do painel
    ui/                     primitivos shadcn/ui
  lib/
    categories.ts           categorias, cores e orçamentos mensais
    finance.ts              períodos, agregações e cálculo de ritmo
    format.ts               formatação em pt-BR (moeda e datas)
    seed.ts                 gerador determinístico de lançamentos
    store.ts                repositório em memória
    types.ts
    validation.ts
```

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 e shadcn/ui. Os gráficos são desenhados à mão com CSS e SVG, sem biblioteca de charts.
