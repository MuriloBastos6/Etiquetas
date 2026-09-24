# Impressão de Etiquetas — Bourached & Bastos

Página web onde o funcionário procura o produto, escolhe a quantidade e imprime a
etiqueta na Brother QL-800. Envase, validade e lote saem automáticos (são campos
do próprio modelo .lbx, preenchidos na hora da impressão). O funcionário não abre o
P-touch Editor e não consegue alterar as etiquetas.

## Como funciona

- A página e os modelos (.lbx) ficam hospedados juntos na internet.
- Quem imprime é o **b-PAC**, o componente oficial da Brother: a página manda a ordem, e o
  b-PAC abre o modelo e imprime na impressora do computador.
- Os modelos ficam só no site; não é preciso copiar arquivos para os computadores.

## 1. Publicar o site (uma vez)

Use a pasta **site** (conteúdo dos dois zips `site-pronto-parte1` e `site-pronto-parte2`
extraídos **na mesma pasta**). Ela deve ter `index.html`, `assets/` e `etiquetas/`.

**Opção mais simples — Netlify Drop (grátis):**
1. Acesse https://app.netlify.com/drop e crie uma conta.
2. Arraste a pasta **site** para a página.
3. Pronto: o Netlify mostra o endereço (algo como `https://nome-aleatorio.netlify.app`).
   Dá para trocar o nome em *Site configuration → Change site name*.

Outras opções que também servem: Vercel, Cloudflare Pages ou qualquer hospedagem de site
estático com **https**.

> **Importante:** o endereço fica acessível para quem tiver o link. Não divulgue fora da
> empresa. Para exigir senha, use o recurso de senha do Netlify (plano pago) ou o
> Cloudflare Access (grátis para poucos usuários).

## 2. Preparar cada computador que imprime (uma vez por computador)

Funciona em **Windows** com **Chrome ou Edge**.
1. Driver da **Brother QL-800** instalado e imprimindo pelo Windows.
2. **b-PAC Client Component**:
   https://support.brother.com/g/s/es/dev/en/bpac/download/index.html
   (mesma arquitetura do navegador; na dúvida, 64 bits).
3. Extensão **Brother b-PAC**:
   - Chrome: https://chromewebstore.google.com/detail/ilpghlfadkjifilabejhhijpfphfcfhb
   - Edge: https://microsoftedge.microsoft.com/addons/detail/brother-bpac-extension/kmopihekhjobijiipnloimfdgjddbnhg
4. Feche e abra o navegador, entre no site e confira se aparece **"Impressora pronta"**
   no alto da página.

Dica: salve o site como favorito ou atalho na área de trabalho.

## 3. Atualizar ou incluir etiquetas

**Sem programação (pelo site pronto):** os modelos ficam em `site/etiquetas/` com nomes
simples (ex.: `alho-em-po.lbx`). Para corrigir uma etiqueta, abra o arquivo original no
P-touch, salve e substitua o arquivo com o **mesmo nome simples** em `site/etiquetas/`;
depois arraste a pasta **site** de novo no Netlify (*Deploys → arraste a pasta*).

**Para incluir produtos novos** (precisa do Node.js instalado, versão 18 ou mais nova):
1. Coloque os `.lbx` na pasta `etiquetas-originais/` do código-fonte (pode usar os nomes normais).
2. No terminal, dentro da pasta do projeto: `npm install` (só da primeira vez) e depois `npm run build`.
3. Publique a pasta `dist/` gerada (ela substitui a pasta **site**).

O arquivo `avisos.json` guarda os avisos que aparecem em amarelo em alguns produtos (ex.:
tabela desatualizada). Quando corrigir a etiqueta, apague a linha correspondente.

## Problemas comuns

| Mensagem | O que fazer |
| --- | --- |
| "Computador não preparado para imprimir" | Falta o b-PAC Client ou a extensão (passo 2), ou a extensão está desativada. |
| "Nenhuma impressora Brother encontrada" | Instale/ligue a QL-800 e clique em "Tentar de novo". |
| "Não consegui abrir o modelo da etiqueta" | Recarregue a página. Se persistir, confira se o arquivo existe em `site/etiquetas/`. |
| Imprime com a impressora errada | Escolha a impressora na caixa ao lado de "Impressora pronta" (fica salvo no computador). |

## Código

- React + Vite. Impressão pela biblioteca `bpac-js` (usa o b-PAC da Brother).
- `scripts/gerar-catalogo.mjs` lê os `.lbx`, tira nome, peso e validade e gera `src/catalogo.json`.
