# StudyQuest frontend

Interface web estática para o backend FastAPI do StudyQuest.

## Executar localmente

1. Inicie a API na pasta `backend`:

```powershell
uvicorn app.main:app --reload
```

2. Em outro terminal, sirva esta pasta:

```powershell
python -m http.server 5173 --directory frontend
```

3. Abra `http://localhost:5173`.

A interface usa a API em `http://127.0.0.1:8000/api/v1` e persiste o token JWT no armazenamento local do navegador.

Na lista de missões, abra **Ver detalhes** para consultar descrição, tipo, dificuldade, status e prazo. **Editar** permite atualizar esses campos e vincular a missão a uma disciplina.

Os Boss Fights exibem uma barra de vida e as missões vinculadas; concluir uma missão vinculada causa o dano indicado e atualiza a vida do desafio.

## Executar com Docker

Na raiz do projeto, execute:

```powershell
docker compose up --build
```

Depois abra `http://localhost:5173`. O serviço de backend executa as migrations do Alembic antes de iniciar a API.
