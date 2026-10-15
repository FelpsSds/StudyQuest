# Frontend do StudyQuest

A interface principal usa React 19 e Vite. O painel inclui autenticação, progresso, edição de disciplinas e missões, sessões cronometradas, histórico com filtros e exportação CSV, Boss Fights, conquistas, ranking e geração de planos de estudo. A interface anterior continua disponível em `/legacy.html` como alternativa.

## Desenvolvimento local

Inicie o backend conforme as instruções do README da raiz. Depois execute:

```powershell
npm ci
npm run dev
```

O Vite serve a interface em `http://localhost:5173` e encaminha `/api` para `http://127.0.0.1:8000`. Gere os arquivos de produção com `npm run build`; o build inclui a interface principal e `/legacy.html`.

## Docker

A imagem instala as dependências, compila o Vite e usa Nginx para servir as duas interfaces e encaminhar `/api` ao backend. Execute `docker compose up --build` na raiz do repositório.
