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
- Integracao com a OpenAI usando a `Responses API`.
- Resumo em portugues com foco em identificacao, uso geral e alertas.
- Aviso visivel de que o site nao substitui consulta com medico especialista.

## Como rodar

1. Crie um arquivo `.env` na raiz com base em `.env.example`.
2. Preencha sua chave:

```env
OPENAI_API_KEY=sua_chave_aqui
PORT=3000
```

3. Inicie o projeto:

```bash
npm start
```

4. Abra `http://localhost:3000`.

## Como subir no GitHub, na Vercel e usar um dominio novo

### 1. Criar um novo repositorio no GitHub

Voce pode criar o repositorio pela interface web do GitHub:

1. Entre no GitHub e clique em `New repository`.
2. Escolha o dono do repositorio.
3. Defina um nome, por exemplo `bula-ia`.
4. Escolha `Public` ou `Private`.
5. Nao marque a opcao de criar outro `README`, porque este projeto ja tem os arquivos locais.
6. Clique em `Create repository`.

Depois, no terminal da pasta do projeto, publique o codigo:

```bash
git init
git add .
git commit -m "feat: projeto inicial bula ia"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/bula-ia.git
git push -u origin main
```

### 2. Importar o projeto na Vercel

1. Entre em https://vercel.com/new
2. Conecte sua conta do GitHub na Vercel, se ainda nao estiver conectada.
3. Encontre o repositorio `bula-ia` e clique em `Import`.
4. Em `Environment Variables`, adicione:

```env
OPENAI_API_KEY=sua_chave_aqui
```

5. Mantenha as configuracoes padrao e clique em `Deploy`.

Observacao:
- Este projeto ja esta preparado para a Vercel com o endpoint em `api/analyze.js`.
- O frontend e servido de forma estatica a partir da pasta `public/`.

### 3. Testar o dominio gerado pela Vercel

Ao final do deploy, a Vercel vai criar um dominio automatico no formato:

```text
https://seu-projeto.vercel.app
```

Use esse endereco para validar:

- se a pagina abre
- se o upload da foto funciona
- se a variavel `OPENAI_API_KEY` foi configurada corretamente

### 4. Adicionar um dominio novo

Se voce ainda nao tiver um dominio, pode comprar um na propria Vercel ou em outro registrador.

Depois:

1. Abra o projeto na Vercel.
2. Va em `Settings`.
3. Clique em `Domains`.
4. Adicione o dominio novo, por exemplo `meusiteremedio.com.br`.
5. A Vercel vai mostrar quais registros DNS voce precisa criar.

Em geral:

- para dominio raiz, a Vercel costuma pedir um registro `A`
- para subdominio como `www`, a Vercel costuma pedir um `CNAME`

Exemplo comum:

```text
A     @      76.76.21.21
CNAME www    cname.vercel-dns.com
```

Importante:
- confira sempre os valores exatos mostrados no painel da Vercel para o seu projeto
- a propagacao do DNS pode levar alguns minutos ou algumas horas

### 5. Fazer novas publicacoes

Depois que o projeto estiver conectado ao GitHub e importado na Vercel, os proximos deploys ficam simples:

```bash
git add .
git commit -m "feat: sua alteracao"
git push origin main
```

A Vercel vai detectar o push e publicar automaticamente.

### 6. Checklist antes de publicar em producao

- confirme que `OPENAI_API_KEY` foi adicionada na Vercel
- garanta que `.env` nao foi enviado para o GitHub
- teste o envio de imagem em celular
- confirme que o aviso medico continua visivel na pagina
- revise o dominio customizado e o certificado HTTPS

## Fontes oficiais

- GitHub: criar novo repositorio
  https://docs.github.com/articles/creating-a-new-repository
- Vercel: importar projeto existente
  https://vercel.com/docs/getting-started-with-vercel/import
- Vercel: funcoes Node.js em `api/`
  https://vercel.com/docs/functions/runtimes/node-js
- Vercel: adicionar dominio customizado
  https://vercel.com/docs/domains/working-with-domains/add-a-domain

## Observacoes importantes

- A IA pode errar a identificacao se a foto estiver desfocada, cortada ou com reflexo.
- O ideal e fotografar a frente da caixa com nome, dosagem e principio ativo visiveis.
- Este projeto e informativo e nao substitui bula oficial, consulta medica ou orientacao farmaceutica.
