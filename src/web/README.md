# Porfin Frontend Application

![Porfin](https://porfin.com/logo.png)

## Introdução

Porfin é uma plataforma de gestão empresarial baseada em IA, desenvolvida especificamente para profissionais de saúde no Brasil. Esta aplicação frontend é construída com Next.js 13.5.0 e oferece uma interface moderna e responsiva para gerenciamento de comunicações via WhatsApp, automação de processos e análise de dados.

[![LGPD Compliant](https://img.shields.io/badge/LGPD-Compliant-green.svg)](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
[![CFM Compliant](https://img.shields.io/badge/CFM%201.821%2F07-Compliant-blue.svg)](https://sistemas.cfm.org.br/normas/visualizar/resolucoes/BR/2007/1821)

## Pré-requisitos

- Node.js 18.x ou superior
- pnpm 8.0+
- Docker e Docker Compose
- Git

## Começando

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/porfin/frontend.git
cd frontend
```

2. Instale as dependências:
```bash
pnpm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env.development
```

4. Inicie o ambiente de desenvolvimento:
```bash
docker-compose up -d
pnpm dev
```

## Desenvolvimento

### Estrutura do Projeto

```
src/
├── app/                 # App router e páginas
├── components/          # Componentes React reutilizáveis
├── features/           # Funcionalidades específicas
│   ├── auth/          # Autenticação (LGPD compliant)
│   ├── chat/          # Interface WhatsApp
│   ├── campaigns/     # Gestão de campanhas
│   └── analytics/     # Painéis analíticos
├── hooks/              # React hooks customizados
├── lib/                # Utilitários e configurações
├── locales/           # Traduções (pt-BR)
├── services/          # Integrações de serviços
└── styles/            # Estilos globais
```

### Scripts Disponíveis

```bash
# Desenvolvimento
pnpm dev           # Inicia servidor de desenvolvimento
pnpm lint         # Executa linting
pnpm type-check   # Verifica tipos TypeScript

# Testes
pnpm test         # Executa testes
pnpm test:watch   # Executa testes em modo watch
pnpm test:coverage # Gera relatório de cobertura

# Build
pnpm build        # Gera build de produção
pnpm start        # Inicia servidor de produção
```

### Variáveis de Ambiente

```env
NEXT_PUBLIC_API_URL=                 # URL da API backend
NEXT_PUBLIC_FIREBASE_CONFIG=         # Configuração Firebase
NEXT_PUBLIC_SOCKET_URL=              # URL WebSocket
NEXT_PUBLIC_WHATSAPP_CONFIG=         # Configuração WhatsApp Business
NEXT_PUBLIC_LGPD_COMPLIANCE=         # Configurações LGPD
```

## Funcionalidades Principais

### Autenticação
- Autenticação Firebase com verificação de profissionais de saúde
- Conformidade com LGPD e CFM 1.821/07
- Gestão de consentimento do usuário

### Chat em Tempo Real
- Integração WhatsApp Business API
- Interface unificada de mensagens
- Assistente virtual com IA
- Suporte a mídia e documentos

### Gestão de Campanhas
- Criação e agendamento de campanhas
- Segmentação de público-alvo
- Templates personalizáveis
- Análise de desempenho

### Painel Analítico
- Métricas de conversão
- Análise de engajamento
- Relatórios personalizados
- Exportação de dados

## Conformidade e Segurança

### LGPD
- Minimização de dados
- Gestão de consentimento
- Procedimentos de exclusão
- Política de privacidade

### Saúde
- Conformidade CFM 1.821/07
- Proteção de dados do paciente
- Padrões de privacidade médica

## Dependências Principais

```json
{
  "dependencies": {
    "next": "13.5.0",
    "@radix-ui/react": "1.0.0",
    "tailwindcss": "3.3.0",
    "@reduxjs/toolkit": "1.9.0",
    "socket.io-client": "4.7.0",
    "firebase": "9.0.0",
    "next-intl": "3.0.0",
    "date-fns-tz": "2.0.0"
  },
  "devDependencies": {
    "typescript": "5.1.6",
    "jest": "29.6.2",
    "eslint": "8.46.0",
    "prettier": "3.0.0"
  }
}
```

## Implantação

### Build de Produção
```bash
pnpm build
```

### Docker
```bash
docker build -t porfin-frontend .
docker run -p 3000:3000 porfin-frontend
```

## Contribuindo

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Suporte

Para suporte, envie um email para suporte@porfin.com.br ou abra uma issue no GitHub.

## Licença

Copyright © 2023 Porfin. Todos os direitos reservados.