# Delivery Routing Server

API e backoffice que coordenam pedidos, motoboys e criação de rotas otimizadas para entregas locais.

## Visão Geral de Componentes

- **API Node/Express**: autenticação do motoboy, criação de pedidos, configuração de preços, endpoints de debug.
- **Agendador de rotas (`src/scheduler.ts`)**: monitora pedidos pendentes e motoboys disponíveis para montar novas rotas.
- **Persistência**: banco SQLite em `data/delivery.db`, acessado via `better-sqlite3`. O arquivo JSON antigo (`data/db.json`) é migrado automaticamente na primeira execução.
- **Painel web (`delivery-web`)**: dashboard operacional e aplicativo do motoboy, ambos consumindo os mesmos endpoints.

## Como o Roteamento Funciona Hoje

1. **Criação de pedido**  
   - `POST /orders` aceita tanto as coordenadas (`address`, `lat`, `lng`) quanto o endereço textual (`street`, `number`, `neighborhood`, `city`, `state`, `complement`, `reference`).  
   - Se `lat/lng` forem omitidos, o servidor concatena os campos textuais e resolve as coordenadas automaticamente através do `geocodingService` antes de salvar.  
   - Após persistir o pedido, `onNewOrderCreated` tenta agrupar o pedido em um lote.

2. **Agrupamento automático**  
   - Sempre que a fila de `PENDING` tem pelo menos `minBatch` pedidos **ou** o mais antigo passou de `maxWaitMinutes`, o scheduler cria uma rota sem motoboy.  
   - Os pedidos selecionados ficam com status `QUEUED` e recebem `routeId`, evitando que entrem em outros lotes.

3. **Critérios para montar rota (`routingConfig` em `src/config.ts`)**  
   - `minBatch`: mínimo de pedidos para liberar rota (default: 2).  
   - `maxBatch`: máximo de pedidos por rota (default: 5).  
   - `maxWaitMinutes`: se o pedido mais antigo passou desse tempo (default: 25), a rota é forçada mesmo sem atingir o mínimo.

4. **Seleção dos pedidos**  
   - Ordenamos todos os `PENDING` por `createdAt`.  
   - Começamos pelo mais antigo para respeitar SLA.  
   - Os próximos pedidos são escolhidos pelo mais próximo (Haversine) do último endereço selecionado até atingir `maxBatch` ou acabar a fila.

5. **Criação da rota**  
   - Gera `Route` com status `AWAITING_COURIER`, `mapsUrl` (link Google Maps), `totalPrice` estimado e lista de pedidos.  
   - Os pedidos permanecem associados apenas ao `routeId` e status `QUEUED`, aguardando decisão do operador.

6. **Atribuição manual ou automática**  
   - O operador escolhe o motoboy ideal e chama `POST /routes/:id/assign` enviando `courierId`, ou usa o endpoint `POST /routes/:id/assign/auto` que seleciona automaticamente o motoboy disponível há mais tempo sem rota recente.  
   - Os pedidos viram `ON_ROUTE`, o motoboy passa para o status `ASSIGNED` e a rota muda para `ASSIGNED` (aguardando o início).

7. **Motoboy inicia a rota**  
   - No app, o motoboy toca em “Iniciar rota”, que chama `POST /routes/:id/start` (endpoint autenticado).  
   - Isso muda o status do motoboy para `ON_TRIP` e a rota para `IN_PROGRESS`.

8. **Finalização**  
   - Cada `POST /orders/:id/delivered` atualiza o pedido e recalcula o status da rota.  
   - Quando todos os pedidos ficam `DELIVERED`, a rota vira `DONE` e o motoboy volta para `AVAILABLE`.

### Eventos que Disparam o Agendador

- Novo pedido criado.
- Operator pode chamar manualmente (por enquanto usamos sempre o gatilho de novos pedidos).

### Configurações Sugeridas

- Ajuste os parâmetros de roteamento (mín/máx de pedidos por rota, SLA máximo e o tempo adicional para esperar pedidos na mesma região) diretamente na aba Configurações ou via `restaurant_profile`.  
- `restaurantLocation` define a origem usada no cálculo da ordem das entregas e na URL do Google Maps.

### Geocodificação Automática

- Escolha o provedor definindo `GEOCODER_PROVIDER=google` (padrão) ou `opencage`.
- Para Google:
  - Habilite a **Geocoding API** na Google Cloud, crie uma key e configure `GOOGLE_MAPS_API_KEY`.
  - Opcional: ajuste `GOOGLE_GEOCODE_URL` ou `GOOGLE_ALLOW_PARTIAL=1` se quiser aceitar `partial_match`.
- Para OpenCage: mantenha `GEOCODER_PROVIDER=opencage` e informe `OPENCAGE_API_KEY`.
- Campos aceitos em `POST /orders`: `address`, `street`, `number`, `neighborhood`, `city`, `state`, `country`, `complement`, `reference`, além de `lat`/`lng` quando já conhecidos (se `lat/lng` vierem, pulamos o geocoder).
- O serviço usa cache em memória por 24h (`GEOCODING_CACHE_TTL_MS`) e aplica padrões via `GEOCODING_DEFAULT_*` para evitar campos duplicados.
- Caso o geocoder não encontre um match aceitável, o endpoint responde erro 4xx explicando que é preciso ajustar rua/número/bairro.

### Estados utilizados

- **Pedidos**: `PENDING` (fila), `QUEUED` (lote aguardando motoboy), `ON_ROUTE` (rota em execução), `DELIVERED`.  
- **Rotas**: `AWAITING_COURIER` (sem motoboy), `ASSIGNED` (motoboy definido, aguardando início), `IN_PROGRESS`, `DONE`.  
- **Motoboys**: `OFFLINE`, `AVAILABLE`, `ASSIGNED` (rota recebida, aguardando início), `ON_TRIP`.

### Guia rápido de status

A aba **Guia** dentro do painel mostra o significado detalhado de cada status/label. Resumo:

- **Pedidos**: `PENDING` (aguardando agrupamento), `QUEUED` (já vinculado a uma rota), `ON_ROUTE` (motoboy saiu) e `DELIVERED` (concluído).  
- **Rotas**: `AWAITING_COURIER` (somente pedidos agrupados), `ASSIGNED` (aguardando motoboy iniciar), `IN_PROGRESS` (motoboy em campo) e `DONE` (finalizada).  
- **Motoboys**: `OFFLINE` (fora do plantão), `AVAILABLE` (liberado para receber rota), `ASSIGNED` (rota pendente de start) e `ON_TRIP` (rota em execução).  
- **Dia de operação**: “Iniciar dia” limita a visão aos pedidos daquele turno; “Fechar dia” arquiva o período; a opção “Exibir histórico completo” volta a listar todos os registros para auditoria.

## Como Rodar

```bash
npm install
npm run dev        # modo desenvolvimento
npm run build && npm start

# simular fluxo completo (gera pedidos, rotas e atribui um motoboy demo)
npm run demo

# limpar o banco e começar do zero
rm -f data/delivery.db

```

## Autenticação de Administrador

- Agora todo o painel e os endpoints de operação estão protegidos por JWT.  
- Faça login em `POST /auth/admin/login` informando `email` e `password`. O payload de sucesso retorna `{ token, admin }`.  
- O token precisa ser enviado como `Authorization: Bearer <token>` em qualquer chamada de `/restaurant`, `/operation-day`, `/pricing`, `/orders`, `/routes` (atribuição), `/reports` e endpoints de debug (`/debug/*`).  
- Endpoint `GET /auth/admin/me` valida o token salvo e devolve o perfil do admin logado.
- Um usuário padrão é criado automaticamente sempre que a tabela de admins está vazia:
  - **E-mail:** `admin@demo.com`
  - **Senha:** `admin123`
- Após limpar o banco (`rm data/delivery.db`), suba o servidor novamente para que o usuário padrão seja recriado.

### Gestão de administradores

Todos os endpoints da API agora aceitam CRUD completo de administradores autenticados:

- `GET /admins` lista os usuários já cadastrados.
- `POST /admins` cria um novo acesso (nome, e-mail e senha obrigatórios e únicos).
- `PUT /admins/:id` permite editar nome/e-mail e redefinir a senha.
- `DELETE /admins/:id` remove um administrador, desde que exista ao menos outro usuário ativo e não seja o próprio usuário logado.

As mesmas regras são aplicadas diretamente no painel web através da seção **Administradores** (aba Configurações), que exibe a lista atual, formulário de criação e botões de edição/remoção.

## Painel Administrativo

O dashboard (`delivery-web`) exibe uma tela de login antes de carregar as abas. Basta informar as credenciais válidas (como o admin padrão acima); o token fica salvo no navegador e pode ser invalidado usando o botão **Sair** no canto superior direito.

O painel web agora está dividido em abas:

- **Operação**: visão diária (resumo, alertas, pedidos, motoboys e rotas) com capacidade de atribuição manual/automática.
- **Mapa da rota**: ao selecionar uma rota o painel mostra o restaurante e os pedidos no mapa (Leaflet/OSM) para validar agrupamentos.
- **Dia de trabalho**: antes de iniciar as entregas, abra o dia pelo painel; os cards/tabelas exibem apenas o que foi criado após a abertura. Ao encerrar o expediente, feche o dia para limpar a visão (o histórico pode ser reexibido marcando “Exibir histórico completo”).
- **Regras de preço**: CRUD completo de faixas de distância e zonas especiais.
- **Motoboys**: acompanhe disponibilidade em tempo real, veja rotas ativas e realize o CRUD completo (criar, editar, trocar PIN ou remover).
- **Pedidos**: monitore a fila diária, edite endereços/status e abra o formulário manual que usa geocodificação automática quando necessário.
- **Administração**: CRUD completo de pedidos, rotas, motoboys e administradores (com remoção forçada quando necessário).
- **Configurações**: gestão completa do restaurante (nome/endereço/contato/raio e parâmetros de roteamento).
- **Relatórios**: escolha o intervalo de data/hora, visualize gráficos (status, volume diário e ranking de motoboys) e exporte o CSV completo para auditoria.

As regras de negócio aplicadas nos CRUDs:

- Não é possível marcar pedido como `ON_ROUTE`/`DELIVERED` sem um motoboy associado.
- Pedidos em rota ou finalizados não podem ser excluídos.
- Motoboys com rotas pendentes/em andamento não podem ser removidos.
- Coordenadas e raio máximo do restaurante são utilizados automaticamente para cálculo de distância, preços e construção das rotas.

Use o app do motoboy para confirmar o início da rota: enquanto o status estiver “Aguardando início”, o painel indica o motoboy como “Rota pendente” e a rota continua em `ASSIGNED`.
```

O painel web fica em `delivery-web`. Rode `npm install && npm run dev` dentro da pasta para o dashboard/Vite.

## Tutorial para configurar em outra máquina

- Siga o passo a passo detalhado em [`docs/SETUP.md`](docs/SETUP.md) para clonar o projeto, criar o `.env`, instalar dependências (API, painel e app Android) e iniciar o sistema do zero em qualquer computador.
- Resumo rápido:
  1. `git clone ... && cd delivery-server`
  2. `cp .env.example .env` e preencha `GOOGLE_MAPS_API_KEY` e `JWT_SECRET`.
  3. `npm install && npm run dev` (backend)  
     `cd delivery-web && npm install && npm run dev` (painel)
  4. [Opcional] Abra `DeliveryScanner` no Android Studio e ajuste o endpoint em “Configurar servidor”.
- O usuário admin padrão (`admin@demo.com` / `admin123`) é recriado sempre que o banco (`data/delivery.db`) é removido ou substituído.
