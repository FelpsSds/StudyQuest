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
- GitHub Actions executa os testes backend em cada push e pull request

A migração do frontend para React + Vite está planejada para a próxima etapa.

## Configuração de ambiente

Antes de iniciar o projeto, copie os arquivos de exemplo para `.env` quando necessário:

```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
```

Os valores padrão já servem para desenvolvimento local; ajuste `JWT_SECRET_KEY` em produção.

A geração de planos funciona sem provedor de IA, usando um gerador local. Para ativar a integração compatível com a API da OpenAI, configure `AI_GENERATION_ENABLED=true` e `OPENAI_API_KEY` em `backend\.env`. Provedores locais compatíveis, como Ollama, podem ser selecionados na interface sem chave da OpenAI.

Para executar o backend sem Docker, copie `backend\.env.example` para `backend\.env`, use `DATABASE_URL=sqlite:///./studyquest.db`, defina `AI_GENERATION_ENABLED=true` e coloque a chave OpenAI em `OPENAI_API_KEY`. A configuração em `backend\.env.example` é apenas um modelo e não é carregada automaticamente. Reinicie o backend depois de criar/alterar `backend\.env`; o app informa se cada plano foi criado pela IA ou pelo gerador local e explica quando a configuração de IA não foi carregada.

Para usar o Ollama local, mantenha `AI_GENERATION_ENABLED=true` em `backend\.env`, deixe o servidor Ollama acessível em `http://localhost:11434` com o modelo selecionado já baixado e escolha Ollama no formulário. Não coloque chaves no frontend ou em arquivos `.env.example`.

O painel também reúne recomendações de aprendizagem com referências a revisões e estudos publicados. Os estudos disponíveis usam amostras e contextos específicos; o app não apresenta esses resultados como uma porcentagem universal de preferência ou sucesso para toda a população.

Referências exibidas no guia:

- Karpicke, Butler & Roediger (2009), levantamento com 177 universitários sobre estratégias de estudo e prática de recuperação: https://doi.org/10.1080/09658210802647009
- Cepeda et al. (2006), síntese quantitativa sobre prática distribuída: https://doi.org/10.1037/0033-2909.132.3.354
- Dunlosky et al. (2013), revisão de técnicas de aprendizagem: https://doi.org/10.1111/j.1539-6053.2013.01059.x

Novas contas exigem senha com pelo menos 8 caracteres. O login de contas já existentes permanece compatível com as senhas atuais.

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
4. Preparar deploy.
