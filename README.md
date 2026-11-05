# StudyQuest

> Transforme seus estudos em missões, acompanhe seu progresso e conquiste seu próximo nível.

**StudyQuest** é uma plataforma de estudos gamificada criada por [FelpsSds](https://github.com/FelpsSds). Ela reúne planejamento, sessões de foco e acompanhamento de aprendizagem em uma jornada com XP, níveis, sequência de estudos e Boss Fights.

[Abrir o repositório](https://github.com/FelpsSds/StudyQuest) · [Documentação da API](http://localhost:8000/docs)

## O que você pode fazer

- Criar disciplinas e organizar missões por tema, dificuldade e prazo.
- Concluir missões, ganhar XP, subir de nível e desbloquear conquistas.
- Criar Boss Fights ligados às missões e acompanhar a vida do desafio.
- Iniciar sessões de estudo com duração planejada, cronômetro e histórico.
- Consultar sequência de estudos, atividade semanal, estatísticas e ranking.
- Filtrar e exportar o histórico de sessões em CSV.
- Gerar um plano de estudo e revisar as missões antes de salvá-las.
- Consultar recomendações de aprendizagem com links para estudos publicados.

## Como funciona a geração de planos

O StudyQuest sempre consegue criar um plano com seu gerador local integrado. Para geração por IA, escolha um dos provedores opcionais:

- **Ollama:** executa um modelo no seu computador, sem cobrança por chamada do serviço.
- **OpenAI API:** exige uma chave de API e pode gerar cobrança. O uso da API é separado de uma assinatura ChatGPT.

A tela informa se o plano veio de um provedor de IA ou do gerador local. Uma resposta com erro ou sem cota disponível não impede o uso do app: o plano local continua disponível, e a interface apresenta a causa conhecida do fallback.

> Nunca coloque uma chave no frontend, no GitHub ou em um arquivo `.env.example`. Use apenas `backend\.env`, que é ignorado pelo Git. Se uma chave for exposta, revogue-a e crie outra.

### Ativar OpenAI no backend local

1. Se ainda não existir, crie a configuração local a partir do exemplo (isso preserva uma configuração que você já tenha):

   ```powershell
   if (-not (Test-Path .\backend\.env)) { Copy-Item .\backend\.env.example .\backend\.env }
   ```

2. Edite `backend\.env` e preencha `OPENAI_API_KEY` com sua chave. Confirme também:

   ```dotenv
   AI_GENERATION_ENABLED=true
   OPENAI_BASE_URL=https://api.openai.com/v1
   OPENAI_MODEL=gpt-4o-mini
   ```

3. Reinicie o backend para carregar as alterações e escolha **OpenAI** no formulário.

Se a resposta mostrar erro **429**, confira uso, limites e cobrança da API na sua conta OpenAI. Uma chave válida, sozinha, não garante que o projeto tenha cota disponível.

### Ativar Ollama no backend local

1. Instale e inicie o [Ollama](https://ollama.com/).
2. Baixe um modelo no PowerShell, por exemplo:

   ```powershell
   ollama pull llama3.1
   ```

3. Deixe `AI_GENERATION_ENABLED=true` em `backend\.env`, reinicie o backend e escolha **Ollama local** no formulário.

O modelo selecionado na interface precisa estar instalado no Ollama.

## Executar no Windows

### Requisitos

- Python 3.12
- PowerShell

Clone o repositório e entre na pasta:

```powershell
git clone https://github.com/FelpsSds/StudyQuest.git
Set-Location .\StudyQuest
```

Crie o ambiente, instale as dependências e crie a configuração local:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if (-not (Test-Path .\backend\.env)) { Copy-Item .\backend\.env.example .\backend\.env }
```

O exemplo usa SQLite para desenvolvimento local; não é necessário iniciar PostgreSQL.

### Terminal 1 — backend

Na raiz do projeto:

```powershell
Set-Location .\backend
& "..\.venv\Scripts\python.exe" -m alembic upgrade head
& "..\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload
```

Mantenha esse terminal aberto. A API fica em `http://localhost:8000`.

### Terminal 2 — frontend

Abra outro terminal na raiz do projeto:

```powershell
python -m http.server 5173 --directory .\frontend
```

Abra `http://localhost:5173` no navegador. A documentação interativa da API fica em `http://localhost:8000/docs`.

## Executar com Docker

Com o Docker Desktop instalado e iniciado, rode na raiz:

```powershell
docker compose up --build
```

- Site: `http://localhost:5173`
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

O Docker Compose inicia o PostgreSQL, o backend aplica as migrações e o frontend é servido pelo container. Para encerrar:

```powershell
docker compose down
```

Na configuração Docker incluída, as variáveis de provedor de IA não são encaminhadas ao backend; a geração de planos usa o gerador local. Para usar OpenAI ou Ollama, siga a execução local do backend e configure `backend\.env`.

## Testes

Na raiz do projeto:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## Tecnologias

| Área | Tecnologias |
| --- | --- |
| Backend | Python 3.12, FastAPI, SQLAlchemy, Pydantic |
| Banco de dados | SQLite local, PostgreSQL no Docker |
| Migrações | Alembic |
| Autenticação | JWT e hash de senha |
| Frontend | HTML, CSS e JavaScript |
| Testes | pytest e FastAPI TestClient |
| Automação | GitHub Actions |

## Estrutura do projeto

```text
backend/
  app/
    api/       # rotas e schemas da API
    core/      # configuração, segurança e regras de negócio
    models/    # entidades do banco
  alembic/     # migrações do banco
  tests/       # testes automatizados
frontend/      # interface web
docker-compose.yml
```

## Sobre as recomendações de estudo

O guia do produto apresenta estratégias com apoio de pesquisas publicadas. Os resultados variam conforme a amostra, o contexto e o método; por isso, o StudyQuest não transforma um estudo específico em uma porcentagem universal de preferência ou sucesso da população.

- Karpicke, Butler & Roediger (2009), estudo de estratégias de aprendizagem com 177 universitários: [DOI](https://doi.org/10.1080/09658210802647009)
- Cepeda et al. (2006), revisão quantitativa sobre prática distribuída: [DOI](https://doi.org/10.1037/0033-2909.132.3.354)
- Dunlosky et al. (2013), revisão de técnicas de aprendizagem: [DOI](https://doi.org/10.1111/j.1539-6053.2013.01059.x)

## Próximos passos

- Continuar refinando a experiência e a navegação do frontend.
- Evoluir os fluxos de IA e melhorar a orientação sobre configuração de provedores.
- Planejar a migração gradual da interface para React + Vite.
- Preparar uma configuração segura de deploy.
