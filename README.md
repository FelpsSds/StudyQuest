# StudyQuest

StudyQuest é uma plataforma de estudos gamificada. O usuário transforma atividades acadêmicas em missões, recebe XP, sobe de nível, acompanha streaks e enfrenta Boss Fights.

## Estado atual

- API REST em FastAPI
- PostgreSQL preparado para Docker e SQLite para desenvolvimento local
- SQLAlchemy e migrations com Alembic
- Autenticação com JWT e senha protegida por hash
- Disciplinas, missões, XP, conquistas, Boss Fights e sessões de estudo
- Frontend principal em React + Vite com autenticação, painel de progresso, edição de disciplinas e ciclo completo de missões
- Sessões com cronômetro, filtros, histórico e exportação CSV
- Boss Fights, conquistas, ranking e gerador de planos com provedores opcionais de IA
- Interface anterior preservada em `frontend/legacy.html` como alternativa
- Testes automatizados para as regras de negócio; GitHub Actions executa os testes backend e compila o frontend em cada push e pull request

## Configuração de ambiente

Antes de iniciar o projeto, copie os arquivos de exemplo para `.env` quando necessário:

```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
```

O Docker Compose lê as configurações de `.env` na raiz do repositório. O backend iniciado diretamente no computador lê `backend\.env`.

No Docker, `POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD` configuram o banco local; a URL de conexão é montada com esses campos, inclusive quando a senha contém caracteres especiais. Para usar um PostgreSQL externo, defina `DATABASE_URL` com um endereço acessível pelo container do backend. URLs `postgres://` e `postgresql://` são convertidas automaticamente para o driver Psycopg 3. Nesse endereço externo, codifique caracteres especiais da senha para URL.

Em desenvolvimento, o backend gera um segredo JWT aleatório se `JWT_SECRET_KEY` estiver vazio. Esse segredo muda ao reiniciar o backend, invalidando sessões existentes. Configure um valor aleatório persistente no `.env` para manter as sessões e use um segredo exclusivo em produção.

No Docker, o Nginx encaminha `/api` ao backend no mesmo host do frontend. Para desenvolvimento local com Vite, o proxy envia as chamadas para `http://127.0.0.1:8000`. Se usar uma API hospedada em outro domínio, configure `CORS_ORIGINS` no `.env` e defina `VITE_API_BASE` ou ajuste `studyquest-api-base` em `frontend/index.html` para a URL da API, incluindo `/api/v1`.

A geração de planos funciona sem provedor de IA, usando um gerador local. Na interface, escolha entre os estilos Objetivo, Prático, Leve e Intensivo; o gerador local também considera o material informado para montar os tópicos. Se a IA estiver indisponível ou retornar um plano inválido para o estilo escolhido, a aplicação gera um plano local e informa isso na prévia. Para ativar a integração compatível com a API da OpenAI, configure `AI_GENERATION_ENABLED=true` e `OPENAI_API_KEY` em `.env` na raiz ao usar Docker, ou em `backend\.env` ao iniciar o backend localmente. O Compose repassa também `OPENAI_BASE_URL` e `OPENAI_MODEL`. Provedores locais compatíveis, como Ollama, podem ser selecionados na interface sem chave da OpenAI. Também é possível usar um endpoint compatível personalizado e informar a chave no formulário: ela vale apenas para aquela geração e não fica salva no navegador. Credenciais incluídas na URL do endpoint são removidas das preferências salvas; parâmetros de configuração, como `api-version`, são mantidos. O endpoint escolhido precisa estar acessível a partir do backend. No Docker Desktop, use `host.docker.internal` para acessar um provedor executado no computador.

## Executar com Docker

Pré-requisito: Docker Desktop instalado e iniciado.

```powershell
docker compose up --build
```

Acesse:

- Frontend: http://localhost:5173
- API: http://localhost:8000
- Documentação da API: http://localhost:8000/docs

Para parar os serviços:

```powershell
docker compose down
```

## Executar o backend localmente

Crie ou ative o ambiente virtual e instale as dependências:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Inicie a API a partir da pasta `backend`:

```powershell
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Em outro terminal, inicie o frontend React com Node.js 24:

```powershell
cd frontend
npm ci
npm run dev
```

Abra `http://localhost:5173`. A interface anterior continua disponível em `http://localhost:5173/legacy.html`.

## Testes

Na raiz do projeto:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## Estrutura

```text
backend/
  app/
    api/       # routers e schemas da API
    core/      # configuração, banco e segurança
    models/    # entidades SQLAlchemy
  alembic/     # migrations do banco
  tests/       # testes das regras de negócio
frontend/      # React + Vite e interface anterior em legacy.html
```

## Próximas etapas

1. Validar os fluxos completos em uma instalação limpa com Docker e PostgreSQL.
2. Adicionar cobertura ponta a ponta no navegador para autenticação, missões, sessões e geração de planos.
3. Preparar o deploy de produção com segredo JWT, HTTPS, backups e configuração externa.
