import { useEffect, useMemo, useRef, useState } from "react";
import catalogo from "./catalogo.json";
import {
  esperarExtensao,
  listarImpressoras,
  escolherImpressora,
  salvarImpressora,
  imprimir,
  previa,
  mensagemDeErro,
  diagnostico,
} from "./impressora.js";

const LIMITE_LISTA = 60;
const MAX_COPIAS = 300;
const CHAVE_RECENTES = "etiquetas.recentes";

const normalizar = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function lerRecentes() {
  try {
    const ids = JSON.parse(localStorage.getItem(CHAVE_RECENTES) || "[]");
    return ids.map((id) => catalogo.find((i) => i.id === id)).filter(Boolean);
  } catch {
    return [];
  }
}

function guardarRecente(item, atuais) {
  const lista = [item, ...atuais.filter((i) => i.id !== item.id)].slice(0, 8);
  try {
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista.map((i) => i.id)));
  } catch {
    /* sem armazenamento: só não lembra */
  }
  return lista;
}

export default function App() {
  const [busca, setBusca] = useState("");
  const [destaque, setDestaque] = useState(0);
  const [selecionado, setSelecionado] = useState(null);
  const [quantidade, setQuantidade] = useState(1);
  const [conexao, setConexao] = useState("verificando"); // verificando | pronta | sem-extensao | sem-impressora
  const [impressoras, setImpressoras] = useState([]);
  const [impressora, setImpressora] = useState("");
  const [envio, setEnvio] = useState({ tipo: "parado", msg: "" });
  const [imgPrevia, setImgPrevia] = useState({ id: null, src: "", carregando: false });
  const [recentes, setRecentes] = useState(lerRecentes);
  const [ajuda, setAjuda] = useState(false);
  const campoBusca = useRef(null);
  const campoQtd = useRef(null);

  // --- conexão com a impressora
  async function verificarConexao() {
    setConexao("verificando");
    const ok = await esperarExtensao();
    if (!ok) return setConexao("sem-extensao");
    try {
      const lista = await listarImpressoras();
      setImpressoras(lista);
      const escolhida = escolherImpressora(lista);
      setImpressora(escolhida);
      setConexao(escolhida ? "pronta" : "sem-impressora");
    } catch {
      setConexao("sem-impressora");
    }
  }
  useEffect(() => {
    verificarConexao();
    campoBusca.current?.focus();
  }, []);

  // --- busca
  const resultados = useMemo(() => {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean);
    if (!termos.length) return catalogo;
    return catalogo.filter((i) => termos.every((t) => i.busca.includes(t)));
  }, [busca]);
  const visiveis = resultados.slice(0, LIMITE_LISTA);
  useEffect(() => setDestaque(0), [busca]);

  function selecionar(item) {
    setSelecionado(item);
    setQuantidade(1);
    setEnvio({ tipo: "parado", msg: "" });
    setTimeout(() => campoQtd.current?.select(), 50);
  }

  function teclaNaBusca(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDestaque((d) => Math.min(d + 1, visiveis.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestaque((d) => Math.max(d - 1, 0));
    } else if (e.key === "Enter" && visiveis[destaque]) {
      e.preventDefault();
      selecionar(visiveis[destaque]);
    }
  }

  // --- prévia real da etiqueta (vem do P-touch, com as datas de hoje)
  useEffect(() => {
    if (!selecionado || conexao !== "pronta") return;
    let cancelado = false;
    setImgPrevia({ id: selecionado.id, src: "", carregando: true });
    previa(selecionado)
      .then((src) => !cancelado && setImgPrevia({ id: selecionado.id, src, carregando: false }))
      .catch(() => !cancelado && setImgPrevia({ id: selecionado.id, src: "", carregando: false }));
    return () => {
      cancelado = true;
    };
  }, [selecionado, conexao]);

  // --- impressão
  const qtd = Math.max(1, Math.min(MAX_COPIAS, parseInt(quantidade, 10) || 1));
  async function enviarImpressao() {
    if (!selecionado || envio.tipo === "imprimindo") return;
    if (conexao !== "pronta") {
      setEnvio({ tipo: "erro", msg: "Este computador ainda não está pronto para imprimir. Veja \"Como preparar este computador\"." });
      return;
    }
    if (qtd > 50 && !window.confirm(`Imprimir ${qtd} etiquetas de ${selecionado.produto}?`)) return;
    setEnvio({ tipo: "imprimindo", msg: `Enviando ${qtd} ${qtd === 1 ? "etiqueta" : "etiquetas"}…` });
    try {
      await imprimir(selecionado, qtd, impressora);
      setEnvio({
        tipo: "ok",
        msg: `${qtd} ${qtd === 1 ? "etiqueta enviada" : "etiquetas enviadas"} para ${impressora}.`,
      });
      setRecentes((r) => guardarRecente(selecionado, r));
    } catch (erro) {
      setEnvio({ tipo: "erro", msg: mensagemDeErro(erro) });
    }
  }

  function trocarImpressora(nome) {
    setImpressora(nome);
    salvarImpressora(nome);
  }

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <span className="logo" aria-hidden="true">▤</span>
          <div>
            <h1>Impressão de Etiquetas</h1>
            <p>Procure o produto, escolha a quantidade e imprima.</p>
          </div>
        </div>
        <StatusImpressora
          conexao={conexao}
          impressoras={impressoras}
          impressora={impressora}
          onTrocar={trocarImpressora}
          onVerificar={verificarConexao}
          onAjuda={() => setAjuda(true)}
        />
      </header>

      <main className="corpo">
        <section className="coluna-busca" aria-label="Busca de produtos">
          <label className="campo-busca">
            <span className="sr-only">Nome do produto</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
            <input
              ref={campoBusca}
              type="search"
              placeholder="Digite o nome do produto (ex.: alho, castanha, chimichurri)"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={teclaNaBusca}
              autoComplete="off"
            />
          </label>

          {!busca && recentes.length > 0 && (
            <div className="recentes">
              <span>Impressos por último:</span>
              {recentes.map((i) => (
                <button key={i.id} className="chip" onClick={() => selecionar(i)}>
                  {i.produto}
                </button>
              ))}
            </div>
          )}

          <p className="contagem">
            {resultados.length === 0
              ? "Nenhum produto encontrado."
              : resultados.length > LIMITE_LISTA
              ? `Mostrando ${LIMITE_LISTA} de ${resultados.length}. Digite mais letras para filtrar.`
              : `${resultados.length} ${resultados.length === 1 ? "produto" : "produtos"}`}
          </p>

          <ul className="lista" role="listbox" aria-label="Produtos">
            {visiveis.map((item, idx) => (
              <li key={item.id}>
                <button
                  role="option"
                  aria-selected={selecionado?.id === item.id}
                  className={
                    "item" +
                    (selecionado?.id === item.id ? " ativo" : "") +
                    (idx === destaque && busca ? " destaque" : "")
                  }
                  onClick={() => selecionar(item)}
                >
                  <span className="item-nome">{item.produto}</span>
                  <span className="item-info">
                    {item.peso && <span className="tag">{item.peso}</span>}
                    {item.aviso && <span className="tag alerta" title={item.aviso}>atenção</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className={"coluna-impressao" + (selecionado ? " aberta" : "")} aria-label="Impressão">
          {!selecionado ? (
            <div className="vazio">
              <p>Escolha um produto na lista para imprimir.</p>
            </div>
          ) : (
            <div className="painel">
              <button className="fechar" onClick={() => setSelecionado(null)} aria-label="Fechar">×</button>
              <h2>{selecionado.produto}</h2>
              <dl className="dados">
                {selecionado.peso && (<><dt>Peso</dt><dd>{selecionado.peso}</dd></>)}
                <dt>Validade</dt>
                <dd>{selecionado.validade ? `${selecionado.validade} após o envase` : "não definida no modelo"}</dd>
                <dt>Datas</dt>
                <dd>{selecionado.datasAutomaticas ? "Envase, validade e lote saem automáticos" : "Este modelo não tem datas automáticas"}</dd>
              </dl>

              {selecionado.aviso && <div className="aviso">⚠ {selecionado.aviso}</div>}

              <div className="previa">
                {conexao !== "pronta" ? (
                  <span>A prévia aparece quando a impressora estiver conectada.</span>
                ) : imgPrevia.id === selecionado.id && imgPrevia.carregando ? (
                  <span>Carregando prévia…</span>
                ) : imgPrevia.id === selecionado.id && imgPrevia.src ? (
                  <img src={imgPrevia.src} alt={`Prévia da etiqueta ${selecionado.produto}`} />
                ) : (
                  <span>Prévia indisponível.</span>
                )}
              </div>

              <div className="quantidade">
                <span className="rotulo">Quantidade</span>
                <div className="stepper">
                  <button onClick={() => setQuantidade(Math.max(1, qtd - 1))} aria-label="Diminuir">−</button>
                  <input
                    ref={campoQtd}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max={MAX_COPIAS}
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    onBlur={() => setQuantidade(qtd)}
                    onKeyDown={(e) => e.key === "Enter" && enviarImpressao()}
                    aria-label="Quantidade de etiquetas"
                  />
                  <button onClick={() => setQuantidade(Math.min(MAX_COPIAS, qtd + 1))} aria-label="Aumentar">+</button>
                </div>
                <div className="atalhos">
                  {[1, 5, 10, 20, 50].map((n) => (
                    <button key={n} className={qtd === n ? "sel" : ""} onClick={() => setQuantidade(n)}>{n}</button>
                  ))}
                </div>
              </div>

              <button
                className="imprimir"
                onClick={enviarImpressao}
                disabled={envio.tipo === "imprimindo"}
              >
                {envio.tipo === "imprimindo" ? "Imprimindo…" : `Imprimir ${qtd} ${qtd === 1 ? "etiqueta" : "etiquetas"}`}
              </button>

              {envio.msg && <p className={`envio ${envio.tipo}`} role="status">{envio.msg}</p>}
            </div>
          )}
        </section>
      </main>

      {ajuda && <Ajuda onFechar={() => setAjuda(false)} impressoras={impressoras} conexao={conexao} />}
    </div>
  );
}

function StatusImpressora({ conexao, impressoras, impressora, onTrocar, onVerificar, onAjuda }) {
  const textos = {
    verificando: ["verificando", "Procurando a impressora…"],
    pronta: ["pronta", "Impressora pronta"],
    "sem-extensao": ["erro", "Computador não preparado para imprimir"],
    "sem-impressora": ["erro", "Nenhuma impressora Brother encontrada"],
  };
  const [classe, texto] = textos[conexao];
  return (
    <div className="status">
      <span className={`pill ${classe}`}>
        <span className="ponto" aria-hidden="true" />
        {texto}
      </span>
      {conexao === "pronta" && impressoras.length > 1 && (
        <select value={impressora} onChange={(e) => onTrocar(e.target.value)} aria-label="Impressora">
          {impressoras.map((p) => (<option key={p}>{p}</option>))}
        </select>
      )}
      {conexao !== "pronta" && conexao !== "verificando" && (
        <button className="link" onClick={onVerificar}>Tentar de novo</button>
      )}
      <button className="link" onClick={onAjuda}>Como preparar este computador</button>
    </div>
  );
}

function Ajuda({ onFechar, impressoras, conexao }) {
  const d = diagnostico();
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);
  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Como preparar este computador" onClick={(e) => e.stopPropagation()}>
        <button className="fechar" onClick={onFechar} aria-label="Fechar">×</button>
        <h2>Como preparar este computador</h2>
        <p>Só precisa ser feito uma vez em cada computador que imprime. Funciona em Windows, com Chrome ou Edge.</p>
        <ol>
          <li><b>Driver da impressora:</b> instale o driver da Brother QL-800 e confirme que ela imprime pelo Windows.</li>
          <li>
            <b>b-PAC Client Component:</b> baixe e instale no{" "}
            <a href="https://support.brother.com/g/s/es/dev/en/bpac/download/index.html" target="_blank" rel="noreferrer">site da Brother</a>{" "}
            (escolha a versão 32 ou 64 bits igual ao navegador; na dúvida, 64 bits).
          </li>
          <li>
            <b>Extensão do navegador:</b>{" "}
            <a href="https://chromewebstore.google.com/detail/ilpghlfadkjifilabejhhijpfphfcfhb" target="_blank" rel="noreferrer">Chrome</a>{" "}
            ou{" "}
            <a href="https://microsoftedge.microsoft.com/addons/detail/brother-bpac-extension/kmopihekhjobijiipnloimfdgjddbnhg" target="_blank" rel="noreferrer">Edge</a>.
          </li>
          <li>Feche e abra o navegador, entre nesta página e clique em <b>Tentar de novo</b>.</li>
        </ol>
        <p className="nota">Não é preciso ter o P-touch Editor nem os arquivos das etiquetas no computador: os modelos ficam guardados nesta página.</p>
        <h3>Diagnóstico deste computador</h3>
        <ul className="diag">
          <li className={d.windows ? "ok" : "falha"}>Windows: {d.windows ? "sim" : "não (a impressão só funciona no Windows)"}</li>
          <li className={d.navegador === "Microsoft Edge" || d.navegador === "Google Chrome" ? "ok" : "falha"}>Navegador: {d.navegador}</li>
          <li className={d.extensao ? "ok" : "falha"}>Extensão Brother b-PAC: {d.extensao ? "detectada" : "não detectada"}</li>
          <li className={impressoras.length ? "ok" : "falha"}>
            Impressoras Brother: {impressoras.length ? impressoras.join(", ") : conexao === "verificando" ? "procurando…" : "nenhuma encontrada"}
          </li>
        </ul>
        {!d.extensao && (
          <p className="nota">
            Se a extensão já está instalada: abra <b>edge://extensions</b> (ou <b>chrome://extensions</b>), confira se a
            "Brother b-PAC Extension" está <b>ativada</b>, clique em <b>Detalhes</b> e em "Acesso ao site" escolha
            <b> Em todos os sites</b>. Depois recarregue esta página (F5).
          </p>
        )}
      </div>
    </div>
  );
}
