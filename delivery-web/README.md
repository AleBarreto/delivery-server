# Painel Delivery Web

Frontend em React + TypeScript (Vite) para acompanhar pedidos, couriers e rotas do servidor em `http://localhost:3000`.

## Requisitos

- Node 18+
- npm

## Scripts

- `npm install` — instala dependências
- `npm run dev` — inicia em modo desenvolvimento (http://localhost:5173)
- `npm run build` — build de produção
- `npm run preview` — pré-visualização do build

## Configuração da API

Por padrão o painel aponta para `http://localhost:3000`. Para usar outro host defina a variável de ambiente `VITE_API_BASE_URL` ao rodar `npm run dev` ou `npm run build`.

```bash
VITE_API_BASE_URL="http://meu-host:3000" npm run dev
```

## Estrutura

- `src/api/client.ts`: cliente fetch para os endpoints
- `src/hooks`: hooks com polling a cada 5 segundos (`useOrders`, `useCouriers`, `useRoutes`)
- `src/components`: layout e tabelas do dashboard

## Fluxo de uso

1. Suba o backend (`npm run dev` no projeto delivery-server).
2. Rode `npm install` e `npm run dev` neste projeto.
3. A dashboard exibirá cards de resumo e tabelas de pedidos, couriers e rotas.
4. Clique em um courier para ver a rota atual (usa `GET /couriers/:id/current-route`).
5. Clique em uma rota para ver os pedidos associados e o link do Maps se disponível.

## Mock rápido

Mesmo sem dados reais, as tabelas mostram placeholders quando vazias. Crie pedidos/couriers via curl ou pelos endpoints REST e a tela atualizará a cada 5 segundos.
