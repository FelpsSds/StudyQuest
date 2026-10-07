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

O nome de exibição pode ser alterado no cartão **Perfil**. O e-mail de login permanece somente para consulta.

O cartão **Conquistas** mostra marcos desbloqueados e bloqueados, com a descrição e o progresso até cada objetivo.

Na lista de disciplinas, **Editar** permite atualizar nome, descrição, cor, ícone, professor e período. Essas informações são usadas para identificar a disciplina sem alterar as missões vinculadas.

Ao criar uma missão, também é possível informar descrição, tipo, dificuldade e prazo; XP, duração e disciplina continuam disponíveis no mesmo formulário.

Use os filtros **Atrasadas**, **Vencendo hoje** e **Próximos 7 dias**, ou ordene a lista pelo prazo. Missões concluídas e arquivadas não aparecem nos filtros de vencimento.

O histórico de sessões mostra disciplina, missão, horário de início e duração. Um resumo acima da lista informa quantas sessões correspondem aos filtros, quantas estão em andamento, o tempo total e a duração média das sessões concluídas visíveis. Sessões em andamento mostram o tempo decorrido, o tempo restante e o percentual concluído da meta planejada junto à barra de progresso; sessões finalizadas mostram o tempo registrado. Durações de uma hora ou mais são exibidas em horas e minutos. Ao atingir a meta, timer e barra mudam para um estado visual positivo; se a sessão continuar, o indicador passa a mostrar o excedente sem interrompê-la e mantém o progresso limitado a 100%. A interface respeita a preferência do sistema por movimento reduzido. Os filtros por situação, disciplina e período (hoje, últimos 7 ou 30 dias) podem ser combinados com a busca por nome da disciplina ou missão; as escolhas são mantidas no navegador e podem ser removidas juntas em **Limpar filtros**. **Exportar CSV** baixa as sessões visíveis com os filtros atuais, em formato compatível com planilhas.

O painel recalcula a sequência atual e a melhor sequência de dias com sessões sempre que é carregado, inclusive depois de iniciar, concluir ou excluir uma sessão.

O cartão **Insights** inclui um gráfico diário dos minutos de sessões concluídas nos últimos sete dias, junto com os totais gerais.

Controles interativos exibem um contorno de foco visível durante a navegação por teclado.

## Executar com Docker

Na raiz do projeto, execute:

```powershell
docker compose up --build
```

Depois abra `http://localhost:5173`. O serviço de backend executa as migrations do Alembic antes de iniciar a API.
