# Se Poupe — Deploy Guide
## Supabase + GitHub + Vercel

Tempo estimado: **15–20 minutos**

---

## 1. Supabase — banco de dados e autenticação

### 1.1 Criar projeto
1. Acesse **https://supabase.com** e faça login (ou crie uma conta gratuita)
2. Clique em **"New project"**
3. Escolha um nome: `sepoupe`
4. Defina uma senha forte para o banco (anote — você vai precisar)
5. Selecione a região: **South America (São Paulo)** → `sa-east-1`
6. Clique **"Create new project"** e aguarde ~2 minutos

### 1.2 Rodar o schema SQL
1. No painel do Supabase, clique em **SQL Editor** (ícone de banco no menu lateral)
2. Clique em **"New query"**
3. Abra o arquivo `supabase_schema.sql` deste projeto e copie todo o conteúdo
4. Cole no editor e clique **"Run"** (ou `Ctrl+Enter`)
5. Você deve ver `Success. No rows returned` — as tabelas foram criadas ✓

### 1.3 Copiar as chaves da API
1. Vá em **Settings → API** no painel do Supabase
2. Anote:
   - **Project URL** → começa com `https://xxxx.supabase.co`
   - **anon / public key** → chave longa começando com `eyJ...`

### 1.4 (Opcional) Configurar Auth
1. Vá em **Authentication → Providers**
2. **Email** já vem habilitado por padrão ✓
3. Em **Authentication → URL Configuration**, adicione sua URL do Vercel depois do deploy:
   - Site URL: `https://sepoupe.vercel.app`
   - Redirect URLs: `https://sepoupe.vercel.app/**`

---

## 2. GitHub — controle de versão

### 2.1 Criar repositório
1. Acesse **https://github.com/new**
2. Nome do repositório: `sepoupe`
3. Visibilidade: **Private** (recomendado)
4. Clique **"Create repository"**

### 2.2 Fazer upload do projeto
Descompacte a pasta `sepoupe/` do arquivo zip e rode no terminal:

```bash
cd sepoupe
git init
git add .
git commit -m "chore: initial commit — Se Poupe dashboard"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/sepoupe.git
git push -u origin main
```

> Se preferir a interface gráfica, use **GitHub Desktop** ou arraste a pasta para o github.com.

---

## 3. Vercel — deploy e hospedagem

### 3.1 Importar projeto
1. Acesse **https://vercel.com** e faça login com sua conta GitHub
2. Clique em **"Add New → Project"**
3. Selecione o repositório `sepoupe` que você acabou de criar
4. Clique **"Import"**

### 3.2 Configurar build
O Vercel detecta automaticamente o Vite. Confirme as configurações:

| Campo | Valor |
|-------|-------|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

### 3.3 Adicionar variáveis de ambiente
Antes de clicar em Deploy, vá em **"Environment Variables"** e adicione:

| Nome | Valor |
|------|-------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` (da etapa 1.3) |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (da etapa 1.3) |
| `VITE_ANTHROPIC_API_KEY` | `sk-ant-...` (do console.anthropic.com) |

### 3.4 Deploy
1. Clique **"Deploy"**
2. Aguarde ~1 minuto
3. Sua URL será algo como `https://sepoupe-xyz.vercel.app` 🎉

### 3.5 Domínio customizado (opcional)
1. Em Vercel → seu projeto → **"Domains"**
2. Adicione `sepoupe.com.br` (ou qualquer domínio seu)
3. Siga as instruções para apontar o DNS

---

## 4. Após o deploy — configurações finais

### Atualizar Supabase com a URL final
1. Supabase → **Authentication → URL Configuration**
2. **Site URL**: `https://sua-url.vercel.app`
3. **Redirect URLs**: `https://sua-url.vercel.app/**`

### Testar
- Acesse sua URL
- Crie uma conta nova
- Verifique que os dados persistem após recarregar a página

---

## 5. Deploys futuros (automáticos)

A partir de agora, qualquer `git push origin main` dispara um novo deploy automático na Vercel. Não é necessário fazer nada manualmente.

```bash
# Fluxo de atualização
git add .
git commit -m "feat: nova funcionalidade"
git push origin main
# → Vercel faz o deploy automaticamente em ~1 min
```

---

## Arquitetura

```
Browser
  └── Vercel CDN (React + Vite build)
        ├── window.storage → localStorage (dados locais/sessão)
        ├── Supabase Auth  (login, registro, sessão)
        ├── Supabase DB    (expenses, goals, planning, profiles)
        └── Anthropic API  (IA: análise, importação, relatório)
```

---

## Suporte

Qualquer dúvida, abra uma issue no repositório GitHub.
