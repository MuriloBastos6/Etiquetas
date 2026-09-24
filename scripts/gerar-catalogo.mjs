// Lê as etiquetas (.lbx) da pasta "etiquetas-originais", copia para "public/etiquetas"
// com nomes simples (sem acento/espaço) e gera "src/catalogo.json" para a busca.
//
// Para atualizar: coloque/troque os .lbx em "etiquetas-originais" e rode "npm run build".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGEM = path.join(RAIZ, "etiquetas-originais");
const DESTINO = path.join(RAIZ, "public", "etiquetas");
const CATALOGO = path.join(RAIZ, "src", "catalogo.json");
const AVISOS = path.join(RAIZ, "avisos.json");

// arquivos que não são etiqueta de produto
const IGNORAR = [/^MODELO PIX/i];

const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const slug = (s) =>
  semAcento(s).toLowerCase().replace(/\.lbx$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const desescapar = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function caixasDeTexto(xml) {
  const caixas = [];
  for (const m of xml.matchAll(/<text:text>([\s\S]*?)<\/text:text>/g)) {
    const bloco = m[1];
    const dado = /<pt:data>([\s\S]*?)<\/pt:data>/.exec(bloco);
    if (!dado) continue;
    const texto = desescapar(dado[1]).replace(/\r\n/g, "\n").replace(/\u007f/g, "").trim();
    const tamanhos = [...bloco.matchAll(/ size="([\d.]+)pt"/g)].map((t) => parseFloat(t[1]));
    caixas.push({ texto, fonte: Math.max(0, ...tamanhos) });
  }
  return caixas;
}

const PALAVRAS_FORA = /envasado|ingredientes|distribu|conservar|validade|al[eé]rgicos|lote|banco|ag[eê]ncia/i;
const SO_PESO = /^[\d.,]+\s*(kg|g|gr)$/i;

function nomeDoProduto(caixas) {
  const cand = caixas
    .filter((c) => c.texto && !PALAVRAS_FORA.test(c.texto))
    .map((c) => ({ ...c, texto: c.texto.replace(/\s+/g, " ").trim() }));
  const peso = cand.find((c) => SO_PESO.test(c.texto));
  const comLetras = cand.filter((c) => !SO_PESO.test(c.texto) && /[A-Za-zÀ-ú]{3}/.test(c.texto));
  comLetras.sort((a, b) => b.fonte - a.fonte);
  let nome = comLetras[0]?.texto ?? "";
  if (peso && !/\d\s*(kg|g)\b/i.test(nome)) nome = `${nome} ${peso.texto}`.trim();
  return nome;
}

function separarPeso(nome) {
  const m = /(\d+(?:[.,]\d+)?)\s*(kg|g|gr)\b/i.exec(nome);
  if (!m) return { produto: nome, peso: "" };
  const unidade = m[2].toLowerCase() === "kg" ? "kg" : "g";
  return { produto: nome.replace(m[0], "").replace(/\s+/g, " ").trim(), peso: `${m[1]} ${unidade}` };
}

function validade(xml) {
  const m = /<text:dateTimeStyle [^>]*addtion="true"[^>]*units="(\w+)"[^>]*addPeriod="(\d+)"/.exec(xml);
  if (!m) return "";
  const n = parseInt(m[2], 10);
  const u = { MONTHS: n === 1 ? "mês" : "meses", DAYS: n === 1 ? "dia" : "dias", YEARS: n === 1 ? "ano" : "anos" }[m[1]] ?? m[1];
  return `${n} ${u}`;
}

async function main() {
  if (!fs.existsSync(ORIGEM)) {
    console.error(`Pasta não encontrada: ${ORIGEM}`);
    process.exit(1);
  }
  const avisos = fs.existsSync(AVISOS) ? JSON.parse(fs.readFileSync(AVISOS, "utf8")) : {};
  fs.rmSync(DESTINO, { recursive: true, force: true });
  fs.mkdirSync(DESTINO, { recursive: true });

  const itens = [];
  const usados = new Set();
  const problemas = [];
  for (const arquivo of fs.readdirSync(ORIGEM).filter((f) => f.toLowerCase().endsWith(".lbx")).sort()) {
    if (IGNORAR.some((r) => r.test(arquivo))) continue;
    const bruto = fs.readFileSync(path.join(ORIGEM, arquivo));
    let xml;
    try {
      const zip = await JSZip.loadAsync(bruto);
      xml = await zip.file("label.xml").async("string");
    } catch {
      problemas.push(`${arquivo}: arquivo não abre (corrompido?) — ficou fora do catálogo`);
      continue;
    }
    let s = slug(arquivo) || "etiqueta";
    while (usados.has(s)) s += "-2";
    usados.add(s);
    fs.writeFileSync(path.join(DESTINO, `${s}.lbx`), bruto);

    const nomeArquivo = arquivo.replace(/\.lbx$/i, "").replace(/[-_]+/g, " ").trim().toUpperCase();
    const nome = nomeDoProduto(caixasDeTexto(xml)) || nomeArquivo;
    const { produto, peso } = separarPeso(nome);
    itens.push({
      id: s,
      arquivo,
      produto: produto || nomeArquivo,
      peso,
      validade: validade(xml),
      datasAutomaticas: xml.includes("<text:datetime>"),
      aviso: avisos[arquivo] ?? "",
      busca: semAcento(`${produto} ${arquivo}`).toLowerCase(),
    });
  }
  itens.sort((a, b) => a.produto.localeCompare(b.produto, "pt-BR"));
  fs.writeFileSync(CATALOGO, JSON.stringify(itens, null, 1));
  console.log(`Catálogo: ${itens.length} etiquetas.`);
  problemas.forEach((p) => console.warn("  ! " + p));
}

main();
