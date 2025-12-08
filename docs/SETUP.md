# Guia de Setup em Nova Máquina

Este tutorial resume tudo o que precisa ser feito após clonar o repositório em outro computador (backend, painel web e app Android).

## 1. Pré-requisitos

- **Node.js 18+** (recomendado o LTS mais recente) e **npm 9+**.
- **Git** para clonar o projeto.
- **Chave da API do Google Maps Geocoding** (ou OpenCage) – necessária para converter endereços em coordenadas.
- (Opcional) **Android Studio / SDK 34+** para compilar o app `DeliveryScanner`.

## 2. Clonar o repositório

```bash
git clone <URL-do-repo>
cd delivery-server
```

Sempre que fizer `git pull` em outra máquina, rode `npm install` novamente nas pastas `.` e `delivery-web` para garantir dependências atualizadas.

## 3. Configurar variáveis de ambiente

1. Copie o template:
   ```bash
   cp .env.example .env
   ```
2. Edite `.env` preenchendo:
   - `JWT_SECRET`: string longa/aleatória.
   - `GEOCODER_PROVIDER`: mantenha `google` (recomendado) ou ajuste para `opencage`.
   - `GOOGLE_MAPS_API_KEY` **ou** `OPENCAGE_API_KEY`: informe pelo menos uma chave válida.
   - Os demais campos já vêm com valores padrão focados em Manaus; ajuste se necessário.

> O backend carrega o `.env` automaticamente via `dotenv`. Se o arquivo estiver ausente, algumas features (geocoder, JWT seguro) podem falhar.

## 4. Backend (API + Scheduler)

```bash
npm install
npm run dev         # modo desenvolvimento com ts-node-dev
# ou
npm run build && npm start
```

- O banco SQLite fica em `data/delivery.db` e é criado automaticamente. Para começar do zero, delete o arquivo e reinicie o servidor.
- Usuário admin padrão (recriado sempre que o banco é zerado):
  - `admin@demo.com`
  - `admin123`
- Endpoints principais: `/orders`, `/routes`, `/couriers`, `/pricing`, `/operation-day`, `/reports`, `/auth/admin/*`, `/couriers/me/*`.
- Scripts úteis:
  - `npm run demo`: popula o banco com dados fake para apresentações.
  - `npm run dev`: hot reload para desenvolvimento.

## 5. Painel web (`delivery-web`)

```bash
cd delivery-web
npm install
```

- Opcional: crie um `.env.local` com `VITE_API_BASE_URL=http://localhost:3000` se precisar apontar para outro host.
- Em desenvolvimento:
  ```bash
  npm run dev
  ```
  Acesse `http://localhost:5173` e faça login com o admin padrão ou outro usuário cadastrado.
- Build de produção:
  ```bash
  npm run build
  npm run preview   # para testar o bundle
  ```

## 6. App Android (`DeliveryScanner`)

1. Abra `DeliveryScanner/` no Android Studio ou rode `./gradlew assembleDebug`.
2. Na tela inicial do app:
   - Configure o endpoint (ex.: `http://192.168.1.76:3000`) caso esteja usando aparelho físico.
   - Faça login com o mesmo admin usado no painel.
3. O aplicativo abre a câmera, extrai o endereço via ML Kit e envia para o endpoint `/mobile/receipts`. Ajuste o IP/token conforme sua rede.

Mais detalhes técnicos estão em `DeliveryScanner/README.md`.

## 7. Operação diária

- Antes de iniciar o expediente, abra o painel na aba **Operação** e clique em “Iniciar turno”.
- Crie pedidos manualmente (campo “Endereço completo”) ou receba via API/app Android.
- Deixe o scheduler formar rotas automaticamente ou use “Criar rota manual”.
- Atribua a rota a um motoboy e peça para ele iniciar pelo app (web ou Android).
- Ao final do dia, volte à aba de operação e clique em “Encerrar turno” para arquivar as listas (histórico continua acessível).

## 8. Checklist rápido pós-clone

1. `cp .env.example .env` e configure as chaves.
2. `npm install` na raiz e `npm install` em `delivery-web/`.
3. Rodar `npm run dev` (API) e `npm run dev` (painel) cada um em um terminal.
4. Se for usar o scanner Android, ajustar o endpoint nas preferências do app.
5. Confirmar que `admin@demo.com / admin123` acessa o painel e o app.

Seguindo esses passos você consegue subir o sistema completo em qualquer máquina em poucos minutos.
