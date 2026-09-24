// Comunicação com a impressora Brother pelo b-PAC (componente + extensão do navegador).
import BrotherSDK from "bpac-js";

const CHAVE_IMPRESSORA = "etiquetas.impressora";

export function extensaoInstalada() {
  return document.body.classList.contains("bpac-extension-installed");
}

/** Espera a extensão do b-PAC responder (ela marca a página ao carregar).
 *  Importante: a biblioteca só começa a observar a página quando um BrotherSDK é criado,
 *  por isso criamos um aqui antes de esperar. */
let sdkIniciado = false;
function iniciarDeteccao() {
  if (sdkIniciado) return;
  try {
    new BrotherSDK({ templatePath: new URL("etiquetas/teste.lbx", window.location.href).href });
    sdkIniciado = true;
  } catch {
    /* ignora: a checagem abaixo olha a página diretamente */
  }
}

export async function esperarExtensao(ms = 6000) {
  iniciarDeteccao();
  const inicio = Date.now();
  while (Date.now() - inicio < ms) {
    if (extensaoInstalada()) {
      try {
        await BrotherSDK.printerIsReady(1500);
      } catch {
        /* a marca já está na página; segue */
      }
      return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

/** Informações para diagnóstico (mostradas na ajuda). */
export function diagnostico() {
  const ua = navigator.userAgent;
  const navegador = /Edg\//.test(ua) ? "Microsoft Edge" : /Chrome\//.test(ua) ? "Google Chrome" : /Firefox\//.test(ua) ? "Firefox" : "Outro";
  return {
    navegador,
    windows: /Windows/.test(ua),
    extensao: extensaoInstalada(),
    endereco: window.location.origin,
  };
}

export async function listarImpressoras(ms = 10000) {
  const tempo = new Promise((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), ms));
  const lista = await Promise.race([BrotherSDK.getPrinterList(), tempo]);
  return Array.isArray(lista) ? lista : [];
}

export function impressoraSalva() {
  try {
    return localStorage.getItem(CHAVE_IMPRESSORA) || "";
  } catch {
    return "";
  }
}

export function salvarImpressora(nome) {
  try {
    localStorage.setItem(CHAVE_IMPRESSORA, nome);
  } catch {
    /* navegador sem armazenamento: só não lembra a escolha */
  }
}

/** Escolhe a impressora: a salva neste computador, senão a primeira QL-800, senão a primeira da lista. */
export function escolherImpressora(lista) {
  const salva = impressoraSalva();
  if (salva && lista.includes(salva)) return salva;
  return lista.find((p) => /QL-?800/i.test(p)) || lista[0] || "";
}

/** Endereço completo do modelo .lbx (o b-PAC exige o mesmo site da página). */
export function urlDoModelo(item) {
  return new URL(`etiquetas/${item.id}.lbx`, window.location.href).href;
}

export async function imprimir(item, copias, impressora) {
  const sdk = new BrotherSDK({ templatePath: urlDoModelo(item), printer: impressora });
  // As datas (envase, validade e lote) são campos automáticos do próprio modelo:
  // o P-touch preenche com a data e a hora do momento da impressão.
  return sdk.print({}, { copies: copias, printName: item.produto, ignoreMissingKeys: true });
}

export async function previa(item) {
  const sdk = new BrotherSDK({ templatePath: urlDoModelo(item) });
  const dado = await sdk.getImageData({}, { width: 700, ignoreMissingKeys: true });
  if (!dado) return "";
  return dado.startsWith("data:") ? dado : `data:image/png;base64,${dado}`;
}

export function mensagemDeErro(erro) {
  const texto = String(erro?.message || erro || "");
  if (/initialization|communication|extension/i.test(texto))
    return "Não consegui falar com a impressora. Confira se a extensão Brother b-PAC está ativa no navegador e se a impressora está ligada.";
  if (/printer/i.test(texto) && /set/i.test(texto))
    return "A impressora escolhida não respondeu. Confira se ela está ligada e conectada a este computador.";
  if (/open|template/i.test(texto))
    return "Não consegui abrir o modelo da etiqueta. Recarregue a página e tente de novo.";
  return `Não foi possível imprimir. Detalhe técnico: ${texto || "erro desconhecido"}`;
}
