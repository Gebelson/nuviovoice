# Guia de Assinatura de Código e Segurança Windows (Nuvio)

Este documento detalha o funcionamento técnico da segurança de aplicações Windows (Authenticode e Windows Defender SmartScreen), a dinâmica de reputação de executáveis e as opções de assinatura digital disponíveis para o **Nuvio**, com foco prioritário em soluções gratuitas e sem custos recorrentes.

---

## 1. Como Funciona o Windows Defender SmartScreen

Ao baixar e executar um instalador (`.exe` ou `.msi`) no Windows 10/11, o sistema operacional consulta o serviço em nuvem do **Windows Defender SmartScreen**.

O SmartScreen classifica os arquivos executáveis em três categorias de reputação:
1. **Conhecido e Confiável**: O instalador executa imediatamente sem nenhum aviso.
2. **Conhecido e Malicioso**: O arquivo é imediatamente bloqueado e colocado em quarentena.
3. **Desconhecido**: Ocorre o aviso azul *"O Windows protegeu o computador — Aplicativo: Nuvio-Setup.exe — Fornecedor: Fornecedor desconhecido"*.

### A Dinâmica de Reputação: Hash vs Certificado

* **Binário Sem Assinatura Digital (Estado Inicial)**:
  * O SmartScreen calcula a reputação baseando-se exclusivamente no hash criptográfico SHA-256 do arquivo.
  * **Problema**: Toda vez que uma nova versão do Nuvio é compilada (ex.: v1.12.0 para v1.12.1), o arquivo executável é diferente e gera um **novo SHA-256**.
  * Como resultado, a reputação acumulada pela versão anterior **reseta para zero**. Os primeiros usuários que baixarem a nova versão verão o aviso de tela azul até que dezenas ou centenas de downloads legítimos sejam computados pela telemetria da Microsoft.

* **Binário Assinado com Certificado Authenticode**:
  * O SmartScreen vincula a reputação **à identidade do certificado do fornecedor**, e não apenas ao hash individual de cada compilação.
  * Quando você lança uma nova versão assinada com o mesmo certificado corporativo/open source, a reputação do editor é preservada, evitando que cada atualização retorne ao estado "desconhecido".

---

## 2. Solução Gratuita: SignPath Foundation (Open Source)

O **SignPath Foundation** é uma autoridade sem fins lucrativos apoiada por entidades de certificação que fornece **certificados de assinatura de código gratuitos** para projetos de software livre e código aberto.

### 2.1 Elegibilidade do Nuvio
O Nuvio atende plenamente aos critérios do programa:
1. **Licença Open Source Reconhecida pela OSI**: O Nuvio é licenciado sob a licença **AGPL-3.0-only** (`GNU Affero General Public License v3.0`).
2. **Repositório Público**: O código-fonte está disponível publicamente no GitHub em `https://github.com/Gebelson/nuviovoice`.
3. **Compilação Automatizada no CI**: O executável é gerado exclusivamente de forma transparente e reprodutível através do GitHub Actions (`.github/workflows/release-desktop.yml`).

### 2.2 Requisitos Obrigatórios do SignPath
Para obter a aprovação da fundação, o projeto deve manter:
* Ausência de binários proprietários opacos ou compilações manuais enviadas por fora do fluxo de CI.
* Releases públicos com tags correspondentes no repositório.
* Documentação de política de assinatura de código e termos de privacidade.

> [!NOTE]
> **Identidade do Certificado**: No modelo do SignPath Foundation, o certificado digital emitido identificará a organização signatária no Windows como **"SignPath Foundation"** (ou projeto mantido por SignPath), garantindo a integridade do código e a reputação contínua perante o SmartScreen sem nenhum custo financeiro para os mantenedores.

### 2.3 Como Solicitar a Inscrição no SignPath Foundation
1. Acesse: [https://about.signpath.io/open-source](https://about.signpath.io/open-source) e clique em **Apply now**.
2. Preencha o formulário informando:
   * **Project Name**: `Nuvio`
   * **Project URL**: `https://github.com/Gebelson/nuviovoice`
   * **License**: `AGPL-3.0-only`
   * **Build Pipeline**: GitHub Actions
3. Após aprovação (geralmente entre 3 a 7 dias úteis), acesse o painel do SignPath e crie:
   * A Signing Policy para releases de produção.
   * O token de integração de API para o GitHub Actions.

### 2.4 Configuração de Secrets no Repositório GitHub
No repositório `Gebelson/nuviovoice`, acesse **Settings > Secrets and variables > Actions** e cadastre as seguintes variáveis secretas:

| Secret | Descrição |
| :--- | :--- |
| `SIGNPATH_API_TOKEN` | Token de autenticação gerado no painel da SignPath |
| `SIGNPATH_ORGANIZATION_ID` | Identificador UUID da organização Nuvio na SignPath |
| `SIGNPATH_PROJECT_SLUG` | Slug do projeto (ex.: `nuvio`) |
| `SIGNPATH_SIGNING_POLICY_SLUG` | Slug da política de assinatura (ex.: `release-signing`) |

O workflow `.github/workflows/release-desktop.yml` já possui a etapa `Sign with SignPath` integrada condicionalmente: quando estes segredos forem configurados, os instaladores serão submetidos e assinados digitalmente de forma automatizada a cada release.

---

## 3. Comparativo de Certificados Comerciais (OV vs EV)

Caso a organização opte por emitir um certificado comercial onde a razão social personalizada da empresa apareça diretamente como fornecedor:

| Critério | SignPath Foundation | Certificado OV (Organization Validation) | Certificado EV (Extended Validation) | Microsoft Store |
| :--- | :--- | :--- | :--- | :--- |
| **Custo Financeiro** | **Gratuito (\$0)** | \$200 a \$400 / ano | \$400 a \$900 / ano + HSM | **\$19 taxa única** (sem anuidade) |
| **Exigência Legal** | Projeto Open Source | Empresa com CNPJ ativo e telefone verificado | Empresa com CNPJ ativo e verificação rigorosa | Desenvolvedor individual ou empresa |
| **Armazenamento de Chave** | Seguro na nuvem (SignPath HSM) | Obrigatório Token FIPS ou Cloud HSM (Azure Key Vault / AWS KMS) | Obrigatório Token FIPS ou Cloud HSM (Azure Key Vault / AWS KMS) | Hospedado e assinado pela própria Microsoft |
| **Reputação SmartScreen** | Acumulada no certificado da fundação | **Não imediata**. Começa com reputação neutra e constrói com downloads | Adquirida rapidamente (mas exige telemetria recente) | **Imediata (Totalmente imune)** |
| **Nome exibido no Windows** | SignPath Foundation | Nome da Empresa | Nome da Empresa | Nuvio |

> [!WARNING]
> **Aviso sobre Certificados Autoassinados**: Criar um certificado autoassinado (via OpenSSL ou PowerShell `New-SelfSignedCertificate`) **NÃO** resolve o SmartScreen em computadores de terceiros, pois a cadeia de certificados raiz não estará instalada no repositório de Autoridades Confiáveis do Windows dos usuários finais. Tentar simular isso como solução definitiva é inseguro e ineficaz.

---

## 4. Auditoria e Verificação Local

### Inspecionar Assinatura de um Executável
Abra o PowerShell na pasta do arquivo e execute:
```powershell
Get-AuthenticodeSignature .\Nuvio-Setup.exe | Format-List *
```
* **Status**:
  * `Valid`: O arquivo possui assinatura íntegra e de autoridade confiável.
  * `NotSigned`: O arquivo não possui assinatura digital (SmartScreen atuará por hash).
  * `HashMismatch`: O executável foi corrompido ou modificado após a assinatura.

### Conferir Checksum SHA-256
Para conferir a integridade do instalador comparando com o arquivo oficial `SHA256SUMS.txt`:
```powershell
Get-FileHash .\Nuvio-Setup.exe -Algorithm SHA256
```
O valor calculado deve coincidir com o publicado na GitHub Release.
