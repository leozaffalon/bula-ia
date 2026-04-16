# Bula IA

MVP de um site em que o usuario tira foto de um remedio e recebe um resumo da bula com apoio de IA.

## Estrutura do projeto

- `public/`: frontend estatico da aplicacao.
- `server.js`: servidor local para desenvolvimento em `localhost`.
- `api/analyze.js`: endpoint compativel com deploy na Vercel.
- `lib/analyze.js`: logica compartilhada da analise por IA.
- `vercel.json`: configuracao basica de rota para servir a pagina inicial na Vercel.

## O que esta pronto

- Upload de imagem ou foto direto da camera no celular.
- Backend simples em Node.js sem dependencias externas.
- Integracao com a API Gemini, que possui tier gratuita para testes e beta.
- Resumo em portugues com foco em identificacao, uso geral e alertas.
- Aviso visivel de que o site nao substitui consulta com medico especialista.
