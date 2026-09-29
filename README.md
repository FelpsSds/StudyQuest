# StudyQuest

StudyQuest é uma plataforma de estudos gamificada. O usuário transforma atividades acadêmicas em missões, recebe XP, sobe de nível, acompanha streaks e enfrenta Boss Fights.

## Estado atual

- API REST em FastAPI
- PostgreSQL preparado para Docker e SQLite para desenvolvimento local
- SQLAlchemy e migrations com Alembic
- Autenticação com JWT e senha protegida por hash
- Disciplinas, missões, XP, conquistas, Boss Fights e sessões de estudo
- Frontend estático funcional consumindo a API
- Testes automatizados para as principais regras de negócio

A migração do frontend para React + Vite está planejada para a próxima etapa.

## Configuração de ambiente

Antes de iniciar o projeto, copie os arquivos de exemplo para `.env` quando necessário:

```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
```

Os valores padrão já servem para desenvolvimento local; ajuste `JWT_SECRET_KEY` em produção.

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

Em outro terminal, sirva o frontend atual:

```powershell
python -m http.server 5173 --directory frontend
```

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
frontend/      # interface atual
```

## Próximas etapas

1. Migrar a interface para React + Vite.
2. Adicionar filtros, edição e detalhes de missões.
3. Construir as telas de perfil, conquistas e Boss Fight.
4. Adicionar CI para testes e lint.
5. Preparar deploy.
