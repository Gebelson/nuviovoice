# Guia de Publicação do Nuvio na Microsoft Store (MSIX / AppX)

Este guia orienta o processo completo para empacotar e publicar o **Nuvio Desktop** na **Microsoft Store**, eliminando definitivamente e sem custos recorrentes qualquer aviso do Windows Defender SmartScreen.

---

## 1. Vantagens Estratégicas da Microsoft Store

A Microsoft Store é a solução mais recomendada e profissional para aplicativos Windows com orçamento enxuto:

1. **Imunidade Total ao SmartScreen**: Todos os pacotes distribuídos pela Microsoft Store são assinados criptograficamente pela própria Microsoft com chaves de raiz confiável universal do Windows. O instalador **nunca** exibirá avisos de "fornecedor desconhecido" ou "o Windows protegeu o computador".
2. **Custo Único Vitalício de \$19 USD**: Não existem taxas anuais de renovação (diferente de certificados EV comerciais que custam \$400 a \$900 anualmente).
3. **Instalação com Um Clique**: Usuários instalam o Nuvio diretamente pelo ecossistema nativo do Windows, transmitindo máxima credibilidade.
4. **Atualizações Automáticas Silenciosas**: A loja gerencia as atualizações de versão em segundo plano, sem necessidade de janelas modais complexas de reinicialização.
5. **Compatibilidade Nativa Preservada**: Através do Desktop Bridge com a permissão `runFullTrust`, o Electron preserva todos os recursos nativos do Nuvio:
   * Chamadas de voz e vídeo com baixa latência (LiveKit).
   * Captura de áudio do sistema (`venmic`).
   * Atalhos de teclado globais de microfone (`uiohook-napi`).
   * Notificações nativas e bandeja do sistema (tray).

---

## 2. Passo a Passo para Publicação

### Passo 1: Cadastro no Microsoft Partner Center
1. Acesse o portal: [https://partner.microsoft.com/dashboard/registration](https://partner.microsoft.com/dashboard/registration).
2. Entre com uma conta Microsoft corporativa ou pessoal.
3. Escolha o tipo de conta **Individual** (ou **Empresa** caso possua CNPJ registrado e documentação formal).
4. Efetue o pagamento único da taxa de inscrição de desenvolvedor (~**\$19 USD** para pessoa física, sem cobranças recorrentes).

### Passo 2: Reservar o Nome do Aplicativo
1. No painel do Partner Center, selecione **Apps e jogos** > **Novo aplicativo**.
2. Reserve o nome: **Nuvio** (ou *Nuvio Voice & Chat* caso o termo isolado esteja ocupado).
3. Clique em **Reservar nome do produto**.

### Passo 3: Coletar as Credenciais de Identidade do Pacote
1. No menu lateral do aplicativo no Partner Center, vá em **Gerenciamento do produto** > **Identidade do produto**.
2. Copie os seguintes três valores:
   * **Nome do pacote** (ex.: `12345SuaConta.Nuvio`)
   * **ID do pacote** (ex.: `app.nuvio.desktop`)
   * **Identificador do editor (CN)** (ex.: `CN=A1B2C3D4-E5F6-7890-ABCD-EF1234567890`)
   * **Nome de exibição do editor** (ex.: `Nuvio` ou seu nome registrado)

### Passo 4: Compilar o Pacote MSIX / AppX do Nuvio
O projeto Nuvio já está configurado no `packages/desktop/electron-builder.yml` para compilar o alvo `appx`.

Execute no terminal:
```bash
# Definindo as variáveis de ambiente com os dados coletados do Partner Center:
$env:APPX_IDENTITY_NAME="SEU_PACKAGE_IDENTITY_NAME"
$env:APPX_PUBLISHER="CN=SEU_PUBLISHER_ID"
$env:APPX_APPLICATION_ID="Nuvio"

# Compilar o pacote da loja:
pnpm --filter @concord/desktop run build:store
```

O comando gerará o arquivo `.appx` (ou `.msix`) pronto para submissão dentro da pasta `packages/desktop/dist-electron/`.

### Passo 5: Criar a Submissão no Partner Center
1. No menu do app no Partner Center, inicie uma **Nova submissão**.
2. **Propriedades**:
   * Categoria: *Comunicação / Redes Sociais*.
   * Política de privacidade: informe a URL pública dos termos (ex.: `https://nuviovoice.vercel.app`).
3. **Preços e Disponibilidade**:
   * Preço: **Gratuito**.
   * Mercados: Todos os mercados (ou conforme preferência).
4. **Pacotes**:
   * Faça o upload do arquivo gerado (`dist-electron/Nuvio-*.appx`).
   * O Partner Center validará a integridade do manifesto e os recursos `runFullTrust`.
5. **Listagem na Loja**:
   * Título, descrição curta e completa em Português e Inglês.
   * Ícone oficial (localizado em `packages/desktop/build/icon.png`).
   * Capturas de tela e mockups oficiais (localizados em `packages/web/public/images/mockup-laptop-monitor.png`).
6. **Notas para Certificação**:
   * Adicione uma breve mensagem aos revisores da Microsoft explicando:
     *"Nuvio is a desktop voice and chat platform built with Electron. It requires runFullTrust to interface with low-latency system audio and global push-to-talk hotkeys."*
7. Clique em **Submeter para a Loja**. A análise costuma levar entre 24 a 48 horas.

---

## 3. Integrando o Botão da Microsoft Store no Site Nuvio Web

Quando seu aplicativo estiver publicado e ativo na Microsoft Store, você terá um Product ID (ex.: `9NBLGGH4NNS1`).

O Nuvio Web já está preparado para exibir um botão oficial **"Instalar pela Microsoft Store"** lado a lado com o instalador direto tradicional.

Basta adicionar a URL no arquivo `.env` do frontend (`packages/web/.env`):
```env
VITE_MICROSOFT_STORE_URL="https://apps.microsoft.com/detail/SEU_PRODUCT_ID"
```
Ou utilizando o protocolo de deep link para abrir a loja do Windows diretamente no computador do usuário:
```env
VITE_MICROSOFT_STORE_URL="ms-windows-store://pdp/?productid=SEU_PRODUCT_ID"
```

Desta forma, os visitantes do site podem escolher entre o download direto tradicional (`Nuvio-Setup.exe`) ou a instalação homologada pela Microsoft Store.
