# DeliveryScanner

Aplicativo Android para digitalizar recibos e extrair automaticamente o endereço com OCR antes de enviar para o servidor de delivery.

## Principais recursos

- Scanner baseado em CameraX + PreviewView com moldura visual e CTA único.
- Reconhecimento de texto on-device com Google ML Kit (Text Recognition Latin).
- Parser leve que prioriza linhas contendo rua/numero/CEP.
- Envio do texto bruto + endereço extraído para o backend via Retrofit/OkHttp.
- UI em dois passos: captura e tela de confirmação com status do envio.

## Configuração

1. **API**  
   - Por padrão o app aponta para `http://10.0.2.2:3000/`.  
   - Use o botão **Configurar servidor** (na tela principal) para ajustar a URL em tempo de execução – útil para aparelhos físicos (use o IP local, ex.: `http://192.168.0.5:3000/`).  
   - Se preferir fixar na build, defina `delivery.apiBaseUrl` no `gradle.properties` ou com `-Pdelivery.apiBaseUrl="https://seu-servidor/"`.
2. **Token (opcional)**  
   - Informe um token no mesmo painel dentro do app ou via `delivery.apiToken` para builds. O valor é enviado em `Authorization: Bearer …`.
3. **Endpoint esperado**  
   - O Retrofit chama `POST /mobile/receipts` enviando:
     ```json
     {
       "rawText": "texto completo do recibo",
       "addressLine": "linha destacada com endereço"
     }
     ```
   - Adapte no backend conforme necessidade (atualize a interface se o path mudar).

## Execução

```bash
cd DeliveryScanner
./gradlew assembleDebug
```

> Observação: o comando pode exigir acesso de escrita ao diretório `.gradle` do usuário para baixar o wrapper.

Abra o projeto no Android Studio para executar no emulador/dispositivo físico (necessita Android 7.0+, Camera permission). O app solicita a permissão de câmera antes de iniciar a captura.

## Fluxo do usuário

1. Login com credenciais de administrador (mesmo usuário do painel). O botão “Configurar servidor” permite ajustar URL/IP e token se necessário.
2. Após logado, a tela inicial mostra instruções e o botão **Iniciar captura**.
3. Ao conceder a permissão, o preview abre com moldura; o OCR roda em tempo real e interrompe assim que encontra um endereço consistente.
4. A segunda tela exibe o texto detectado em um campo editável, permitindo ajustes antes de tocar em **Enviar para o painel**.

## Stack técnica

- Kotlin, ViewBinding, Navigation Component.
- CameraX (`camera-core`, `camera-view`) com `LifecycleCameraController` + `ImageAnalysis`.
- ML Kit Text Recognition (on-device) para baixa latência.
- Retrofit + Gson + OkHttp Logging para chamadas REST.
- Arquitetura simples com `ScannerViewModel`, `ReceiptRepository` (camada de dados) e `ServiceLocator`.
