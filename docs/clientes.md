# Clientes, branches e entregas

Um único produto (núcleo) atende vários clientes. O que é igual para todos fica no núcleo; o que
é de cada cliente fica na branch dele e se limita à **marca** e à **forma de implantação**.

## Branches

| Branch            | Para que serve                                                                                          | Quem faz deploy                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `develop`         | Núcleo: funcionalidades, correções, migrações. Marca neutra.                                            | Só CI (testes).                                                      |
| `clientes/<nome>` | Um cliente: `develop` + marca + arquivos de implantação dele.                                           | Workflow do cliente (imagens, desktop, servidor).                    |
| `clientes/demo`   | Ambiente de apresentação (Raspberry Pi, ponto.yacacode.com).                                            | `Demo (Raspberry Pi)`: imagens arm64 + atualização automática no Pi. |
| `main`            | **Legado**: produção atual da PH Motopeças (deploy automático no servidor). Não use para trabalho novo. | Servidor da PH (cron).                                               |

Regras:

1. Toda mudança de produto entra em `develop` (por PR, com CI verde).
2. O workflow **Sincronizar clientes** leva `develop` para cada `clientes/*` automaticamente.
   Se houver conflito, ele abre um PR para resolver à mão — nada é forçado.
3. Na branch de um cliente só se alteram os arquivos da lista abaixo. Qualquer outra mudança
   deve ir para `develop`, senão vira conflito e diferença escondida entre clientes.

## O que muda por cliente

| Arquivo                                | Conteúdo                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/shared/src/brand.ts`         | Nome do produto, nome da empresa, cidade do relógio, dados do app desktop.      |
| `packages/shared/brand/logo.png`       | Logo horizontal (fundo transparente).                                           |
| `packages/shared/brand/icon.png`       | Ícone quadrado, PNG de no mínimo 512×512 (gera os ícones do Windows/Mac/Linux). |
| `deploy/<nome>/`                       | Compose, nginx e variáveis de exemplo da implantação do cliente.                |
| `.github/workflows/cliente-<nome>.yml` | Build/entrega do cliente (opcional).                                            |

Dados da empresa (razão social, CNPJ, endereço) **não** ficam no código: o cliente preenche em
**Empresa & Sistema › Minha Empresa** e eles aparecem nos documentos e espelhos.

## Novo cliente, passo a passo

```bash
git fetch origin
git switch -c clientes/novo-cliente origin/develop
# 1. edite packages/shared/src/brand.ts
# 2. troque packages/shared/brand/logo.png e icon.png
# 3. copie deploy/demo para deploy/novo-cliente e ajuste domínio e portas
pnpm check            # lint, tipos, testes e build
git commit -am "chore(cliente): marca e implantação do Novo Cliente"
git push -u origin clientes/novo-cliente
```

A partir daí a branch passa a receber o núcleo sozinha (workflow de sincronização).

## Dados de demonstração

`pnpm db:seed` cria só o administrador inicial e o horário padrão. Os dados fictícios (empresa,
colaboradores, documentos) só entram com `SEED_DEMO_DATA=true` e **nunca** devem ser usados no
banco de um cliente real: eles sobrescrevem a empresa e criam logins de teste.
