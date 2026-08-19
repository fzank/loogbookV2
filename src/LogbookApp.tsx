import React, { useState, useEffect, useRef } from 'react';

const ALVO_CIRCULAR: string = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e0e0e0'/%3E%3Ccircle cx='50' cy='50' r='45' fill='white' stroke='black' stroke-width='1'/%3E%3Ccircle cx='50' cy='50' r='35' fill='white' stroke='black' stroke-width='1'/%3E%3Ccircle cx='50' cy='50' r='25' fill='white' stroke='black' stroke-width='1'/%3E%3Ccircle cx='50' cy='50' r='15' fill='black'/%3E%3Ccircle cx='50' cy='50' r='5' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E";
const ALVO_HUMANOIDE: string = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%232c3e50'/%3E%3Cpath d='M 40 5 C 40 2, 60 2, 60 5 L 60 18 C 75 18, 85 25, 85 40 L 80 100 L 20 100 L 15 40 C 15 25, 25 18, 40 18 Z' fill='%23ecf0f1'/%3E%3Cpath d='M 20 80 Q 50 90 80 80' fill='none' stroke='%23bdc3c7' stroke-width='0.5'/%3E%3Cpath d='M 15 60 Q 50 75 85 60' fill='none' stroke='%23bdc3c7' stroke-width='0.5'/%3E%3Cpath d='M 25 35 Q 50 50 75 35' fill='none' stroke='%23bdc3c7' stroke-width='0.5'/%3E%3Ccircle cx='50' cy='45' r='8' fill='none' stroke='%23bdc3c7' stroke-width='0.5'/%3E%3Ccircle cx='50' cy='12' r='3' fill='none' stroke='%23bdc3c7' stroke-width='0.5'/%3E%3C/svg%3E";

const CALIBRES_DISPONIVEIS: string[] = [".22 LR", ".380 ACP", "9mm", ".38 SPL", ".357 Mag", ".40 S&W", ".45 ACP", "12 Gauge", "5.56x45mm", ".308 Win"];

const formatarData = (dataString: string): string => {
  if (!dataString) return '';
  const partes = dataString.split('-');
  if (partes.length !== 3) return dataString;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
};

const obterDataHoje = (): string => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
};

const obterHoraAtual = (): string => {
  const hoje = new Date();
  return `${String(hoje.getHours()).padStart(2, '0')}:${String(hoje.getMinutes()).padStart(2, '0')}`;
};

const verificarValidade = (dataValidade: string) => {
  if (!dataValidade) return { status: 'nulo', cor: '#bdc3c7', texto: 'Não informado' };
  const diffTime = new Date(dataValidade).getTime() - new Date().getTime();
  const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diasRestantes < 0) return { status: 'vencido', cor: '#e74c3c', texto: 'Vencido' };
  if (diasRestantes <= 90) return { status: 'atencao', cor: '#f39c12', texto: `Vence em ${diasRestantes} dias` };
  return { status: 'regular', cor: '#27ae60', texto: 'Regular' };
};

const loadData = (key: string, defaultData: any) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultData;
  } catch (error) { return defaultData; }
};

const saveData = (key: string, data: any) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } 
  catch (error: any) { if (error.name === 'QuotaExceededError') alert("⚠️ A memória local está cheia!"); }
};

const comprimirImagem = (file: File, callback: (base64: string) => void) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (event: ProgressEvent<FileReader>) => {
    if (!event.target?.result) return;
    const img = new Image();
    img.src = event.target.result as string;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 600; 
      let scaleSize = 1;
      if (img.width > MAX_WIDTH) scaleSize = MAX_WIDTH / img.width;
      canvas.width = img.width * scaleSize;
      canvas.height = img.height * scaleSize;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.6)); 
      }
    };
  };
};

interface Marcacao { x: number; y: number; }

const avaliarMetricasTiro = (marcacoes: Marcacao[]) => {
  if (marcacoes.length === 0) return { precisao: "0", dispersao: 0, diagnosticos: ["Nenhum tiro no alvo."] };
  const xMedio = marcacoes.reduce((acc, val) => acc + val.x, 0) / marcacoes.length;
  const yMedio = marcacoes.reduce((acc, val) => acc + val.y, 0) / marcacoes.length;
  const dispersao = marcacoes.reduce((acc, val) => acc + Math.sqrt(Math.pow(val.x - xMedio, 2) + Math.pow(val.y - yMedio, 2)), 0) / marcacoes.length;
  
  let pontuacaoTotal = 0;
  marcacoes.forEach((m) => {
    const distCentro = Math.sqrt(Math.pow(m.x - 0.5, 2) + Math.pow(m.y - 0.5, 2));
    pontuacaoTotal += Math.max(0, 100 - (distCentro / 0.5 * 100)); 
  });
  const precisaoScore = (pontuacaoTotal / marcacoes.length).toFixed(1);
  
  let diagnosticos: string[] = [];
  
  if (marcacoes.length < 3 && dispersao > 0.10) {
    diagnosticos.push("⚠️ Poucos tiros para agrupar de forma consistente.");
  } else {
    if (dispersao > 0.15) diagnosticos.push("⚠️ Dispersão Alta: Foque na empunhadura firme e controle de respiração.");
    else if (dispersao > 0.10) diagnosticos.push("⚠️ Dispersão Média: Atenção à puxada progressiva do gatilho.");

    const distCentroReal = Math.sqrt(Math.pow(xMedio - 0.5, 2) + Math.pow(yMedio - 0.5, 2));

    if (xMedio < 0.45 && yMedio > 0.55) diagnosticos.push("🚨 Gatilhada (Jerking): Tiros baixo-esquerda. Puxe o gatilho suavemente.");
    else if (xMedio > 0.55 && yMedio > 0.55) diagnosticos.push("🚨 Quebra de pulso: Tiros baixo-direita. Ajuste a pressão da mão de apoio.");
    else if (xMedio > 0.55 && yMedio < 0.45) diagnosticos.push("🚨 Antecipação (Heeling): Empurrando a arma (alto-direita).");
    else if (xMedio < 0.45 && yMedio < 0.45) diagnosticos.push("🚨 Flinching: Abaixando a arma no disparo (alto-esquerda).");

    if (distCentroReal <= 0.10 && dispersao <= 0.10) diagnosticos.push("✅ Excelente precisão! Fundamentos aplicados com perfeição.");
    else if (distCentroReal > 0.10 && dispersao <= 0.10) diagnosticos.push("⚠️ Bom agrupamento, mas deslocado. Verifique o alinhamento da mira.");
  }

  if (diagnosticos.length === 0) diagnosticos.push("✅ Agrupamento consistente e aceitável.");

  return { precisao: precisaoScore, dispersao: dispersao, diagnosticos };
};

interface RenderizarAlvoProps {
  imagem: string;
  marcacoes: Marcacao[];
  onTargetClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
  onImgLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  imgRef?: React.RefObject<HTMLImageElement>;
}

const RenderizarAlvo: React.FC<RenderizarAlvoProps> = ({ imagem, marcacoes, onTargetClick, onImgLoad, imgRef }) => (
  <div style={{ position: 'relative', width: '100%', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
    <img ref={imgRef} src={imagem} alt="Alvo" onClick={onTargetClick} onLoad={onImgLoad} style={{ width: '100%', display: 'block', backgroundColor: '#fff', cursor: onTargetClick ? 'crosshair' : 'default' }} />
    {marcacoes.map((m: Marcacao, i: number) => (
      <div key={i} style={{ 
        position: 'absolute', left: `${m.x * 100}%`, top: `${m.y * 100}%`, 
        width: '6px', height: '6px', backgroundColor: '#ff0000', 
        boxShadow: '0px 0px 3px rgba(0,0,0,0.8)', borderRadius: '50%', 
        transform: 'translate(-50%, -50%)', pointerEvents: 'none' 
      }} />
    ))}
  </div>
);

export default function LogbookApp() {
  const [telaAtual, setTelaAtual] = useState<string>('arsenal');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => loadData('logbook_darkmode', false));
  const [perfil, setPerfil] = useState(() => loadData('logbook_perfil', { nome: 'Atirador', cr: '', validadeCr: '', clubeAfiliado: '' }));
  const [armas, setArmas] = useState(() => loadData('logbook_armas', []));
  
  const [armasClube, setArmasClube] = useState<any[]>(() => {
    const saved = loadData('logbook_armas_clube', []);
    return saved.map((item: any) => typeof item === 'string' ? { id: Date.now() + Math.random(), marca: item, modelo: '', calibre: '9mm' } : item);
  });
  
  const [historicoSessoes, setHistoricoSessoes] = useState(() => loadData('logbook_sessoes', []));
  const [relatoriosHabSalvos, setRelatoriosHabSalvos] = useState(() => loadData('logbook_hab', []));

  useEffect(() => { saveData('logbook_darkmode', isDarkMode); }, [isDarkMode]);
  useEffect(() => { saveData('logbook_perfil', perfil); }, [perfil]);
  useEffect(() => { saveData('logbook_armas', armas); }, [armas]);
  useEffect(() => { saveData('logbook_armas_clube', armasClube); }, [armasClube]);
  useEffect(() => { saveData('logbook_sessoes', historicoSessoes); }, [historicoSessoes]);
  useEffect(() => { saveData('logbook_hab', relatoriosHabSalvos); }, [relatoriosHabSalvos]);

  const theme = {
    bg: isDarkMode ? '#121212' : '#f4f4f9', cardBg: isDarkMode ? '#1e1e1e' : '#ffffff',
    textMain: isDarkMode ? '#ecf0f1' : '#2c3e50', textSec: isDarkMode ? '#bdc3c7' : '#555',
    inputBg: isDarkMode ? '#2c3e50' : '#ffffff', inputText: isDarkMode ? '#ecf0f1' : '#000000',
    borderColor: isDarkMode ? '#34495e' : '#cccccc', navBg: isDarkMode ? '#1e1e1e' : '#ffffff',
    cardRelatorioBg: isDarkMode ? '#2c3e50' : '#f8f9fa', caixaDiagBg: isDarkMode ? '#34495e' : '#e8f4f8',
    itemBorder: isDarkMode ? '#333' : '#eee', caixaDiagText: isDarkMode ? '#ecf0f1' : '#2c3e50' 
  };
  
  const [abaAcervo, setAbaAcervo] = useState<'pessoal' | 'clube'>('pessoal');
  const [novaArma, setNovaArma] = useState<any>({ marca: '', modelo: '', calibre: '', orgao: 'Sigma', craf: '', validadeCraf: '', gt: '', validadeGt: '', historicoManutencao: [] });
  const [armaEmEdicao, setArmaEmEdicao] = useState<number | null>(null);
  const [armaExpandida, setArmaExpandida] = useState<number | null>(null);
  const [mostrarCamposAvancados, setMostrarCamposAvancados] = useState<boolean>(false);
  const [dataNovaManutencao, setDataNovaManutencao] = useState<string>(obterDataHoje());
  const [descNovaManutencao, setDescNovaManutencao] = useState<string>('');
  
  const [editandoPerfil, setEditandoPerfil] = useState<boolean>(false);
  const [filtroHabInicio, setFiltroHabInicio] = useState<string>('');
  const [filtroHabFim, setFiltroHabFim] = useState<string>('');
  
  const [sessaoEmEdicaoId, setSessaoEmEdicaoId] = useState<number | null>(null);
  const [tipoArmaTreino, setTipoArmaTreino] = useState<'acervo' | 'clube'>('acervo');
  const [armaSelecionada, setArmaSelecionada] = useState<string>('');
  
  const [mostraNovaArmaClube, setMostraNovaArmaClube] = useState<boolean>(false);
  const [novaArmaClubeMarca, setNovaArmaClubeMarca] = useState<string>('');
  const [novaArmaClubeCalibre, setNovaArmaClubeCalibre] = useState<string>('');
  
  const [dataTreino, setDataTreino] = useState<string>(obterDataHoje());
  const [horaTreino, setHoraTreino] = useState<string>(obterHoraAtual());
  const [qtdTiros, setQtdTiros] = useState<string>('');
  const [distancia, setDistancia] = useState<string>('10'); 
  const [tipoMunicao, setTipoMunicao] = useState<string>('Original');
  const [ehHabitualidade, setEhHabitualidade] = useState<boolean>(true);
  
  const [tipoAlvoPadrao, setTipoAlvoPadrao] = useState<'circular' | 'humanoide'>('circular');
  const [imagemAlvo, setImagemAlvo] = useState<string>(ALVO_CIRCULAR);
  const [marcacoes, setMarcacoes] = useState<Marcacao[]>([]);
  const [isAutoScanning, setIsAutoScanning] = useState<boolean>(false);
  
  const [modoComparacao, setModoComparacao] = useState<boolean>(false);
  const [sessoesParaComparar, setSessoesParaComparar] = useState<any[]>([]);
  const [sessaoExpandida, setSessaoExpandida] = useState<number | null>(null);
  
  const [filtroArmaLogbook, setFiltroArmaLogbook] = useState<string>('');
  const [filtroDataInicioLogbook, setFiltroDataInicioLogbook] = useState<string>('');
  const [filtroDataFimLogbook, setFiltroDataFimLogbook] = useState<string>('');
  const [ordemLogbook, setOrdemLogbook] = useState<string>('padrao'); 

  const imgAlvoRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (telaAtual === 'treino' && !sessaoEmEdicaoId) {
      if (historicoSessoes.length > 0) {
        const ultima = historicoSessoes[0];
        setTipoArmaTreino(ultima.tipoArmaTreino || 'acervo');
        setArmaSelecionada(ultima.armaId?.toString() || '');
        setTipoMunicao(ultima.municao || 'Original');
        setDistancia(ultima.distancia || '10');
      } else if (armas.length === 1) {
        setTipoArmaTreino('acervo');
        setArmaSelecionada(armas[0].id.toString());
      }
    }
  }, [telaAtual, sessaoEmEdicaoId, historicoSessoes, armas]);

  useEffect(() => {
    if (!sessaoEmEdicaoId && (imagemAlvo === ALVO_CIRCULAR || imagemAlvo === ALVO_HUMANOIDE)) {
      setImagemAlvo(tipoAlvoPadrao === 'circular' ? ALVO_CIRCULAR : ALVO_HUMANOIDE);
      setMarcacoes([]);
      setQtdTiros('');
    }
  }, [tipoAlvoPadrao, sessaoEmEdicaoId]);

  const adicionarNovaArmaClube = () => {
    if (!novaArmaClubeMarca.trim() || !novaArmaClubeCalibre) return alert("Preencha a Marca e o Calibre.");
    const nova = { id: Date.now(), marca: novaArmaClubeMarca, modelo: '', calibre: novaArmaClubeCalibre };
    setArmasClube([...armasClube, nova]);
    setArmaSelecionada(nova.id.toString());
    setMostraNovaArmaClube(false);
    setNovaArmaClubeMarca('');
    setNovaArmaClubeCalibre('');
  };

  const lidarComUploadAlvo = (e: React.ChangeEvent<HTMLInputElement>) => { 
    const file = e.target.files?.[0]; 
    if (file) { 
      comprimirImagem(file, (base64) => {
        setImagemAlvo(base64);
        setIsAutoScanning(true); 
      }); 
    } else { 
      removerFoto();
    }
  };

  const removerFoto = () => {
    setImagemAlvo(tipoAlvoPadrao === 'circular' ? ALVO_CIRCULAR : ALVO_HUMANOIDE);
    setMarcacoes([]);
    setQtdTiros('');
    setIsAutoScanning(false);
    if (fileInputRef.current) fileInputRef.current.value = ''; 
  };

  const lidarCarregamentoImagem = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (isAutoScanning && imgAlvoRef.current) {
      escanearFuros(imgAlvoRef.current);
      setIsAutoScanning(false);
    }
  };

  // SCANNER DE CONTRASTE LOCAL OTIMIZADO
  const escanearFuros = (img: HTMLImageElement) => {
    if (imagemAlvo === ALVO_CIRCULAR || imagemAlvo === ALVO_HUMANOIDE) return;
    
    const MAX_DIM = 800;
    let scale = 1;
    if (img.naturalWidth > MAX_DIM || img.naturalHeight > MAX_DIM) {
      scale = Math.min(MAX_DIM / img.naturalWidth, MAX_DIM / img.naturalHeight);
    }
    
    const canvas = document.createElement('canvas');
    const w = Math.floor(img.naturalWidth * scale);
    const h = Math.floor(img.naturalHeight * scale);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    const binaryMap = new Uint8Array(w * h);
    const lumaMap = new Uint8Array(w * h);
    const THRESHOLD = 135; 
    
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const luma = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        lumaMap[y * w + x] = luma;
        binaryMap[y * w + x] = luma < THRESHOLD ? 1 : 0;
      }
    }

    const blobs: any[] = [];
    const visited = new Uint8Array(w * h);

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (binaryMap[idx] === 1 && visited[idx] === 0) {
          const blob = { minX: x, maxX: x, minY: y, maxY: y, pixels: 0, sumX: 0, sumY: 0, sumLuma: 0, touchesEdge: false };
          const stack = [idx];
          visited[idx] = 1;

          while (stack.length > 0) {
            const curr = stack.pop()!;
            const cy = Math.floor(curr / w);
            const cx = curr % w;

            blob.pixels++;
            blob.sumX += cx;
            blob.sumY += cy;
            blob.sumLuma += lumaMap[curr];

            if (cx <= 5 || cx >= w - 5 || cy <= 5 || cy >= h - 5) blob.touchesEdge = true;

            const neighbors = [curr - w, curr + w, curr - 1, curr + 1];
            for (const n of neighbors) {
              if (n >= 0 && n < w * h && binaryMap[n] === 1 && visited[n] === 0) {
                visited[n] = 1; stack.push(n);
              }
            }
          }
          blobs.push(blob);
        }
      }
    }

    const validHoles: {x: number, y: number}[] = [];
    const marginX = w * 0.12; 
    const marginY = h * 0.12; 

    for (const blob of blobs) {
      const width = blob.maxX - blob.minX + 1;
      const height = blob.maxY - blob.minY + 1;
      const aspect = Math.max(width, height) / Math.min(width, height);
      const density = blob.pixels / (width * height);
      const cx = Math.floor(blob.sumX / blob.pixels);
      const cy = Math.floor(blob.sumY / blob.pixels);

      if (cx < marginX || cx > w - marginX || cy < marginY || cy > h - marginY) continue;

      if (!blob.touchesEdge && blob.pixels >= 5 && blob.pixels <= 400 && aspect <= 3.0 && density >= 0.25) {
          const margin = 15;
          let bgLumaSum = 0;
          let bgCount = 0;
          let darkNeighbors = 0;

          for(let py = cy - margin; py <= cy + margin; py += 2) {
              for(let px = cx - margin; px <= cx + margin; px += 2) {
                  if (Math.abs(px - cx) < width/2 && Math.abs(py - cy) < height/2) continue;

                  if (px >= 0 && px < w && py >= 0 && py < h) {
                      const luma = lumaMap[py * w + px];
                      bgLumaSum += luma;
                      bgCount++;
                      if (luma < 90) darkNeighbors++;
                  }
              }
          }

          if (bgCount > 0 && (darkNeighbors / bgCount) > 0.40) continue;

          const avgBgLuma = bgCount > 0 ? bgLumaSum / bgCount : 255;
          const coreLuma = blob.sumLuma / blob.pixels;
          
          if (avgBgLuma - coreLuma > 10) {
              validHoles.push({ x: cx / w, y: cy / h });
          }
      }
    }

    setMarcacoes(validHoles);
    setQtdTiros(validHoles.length.toString()); 
  };

  const marcarTiro = (e: React.MouseEvent<HTMLImageElement>) => { 
    const rect = e.currentTarget.getBoundingClientRect(); 
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;
    
    const xRatio = xPx / rect.width;
    const yRatio = yPx / rect.height;

    const RAIO_PX = 15; 

    const indexParaRemover = marcacoes.findIndex(m => {
      const mxPx = m.x * rect.width;
      const myPx = m.y * rect.height;
      return Math.hypot(mxPx - xPx, myPx - yPx) < RAIO_PX;
    });

    if (indexParaRemover !== -1) {
      const novasMarcacoes = [...marcacoes];
      novasMarcacoes.splice(indexParaRemover, 1);
      setMarcacoes(novasMarcacoes);
      setQtdTiros(novasMarcacoes.length.toString());
    } else {
      const novasMarcacoes = [...marcacoes, { x: xRatio, y: yRatio }];
      setMarcacoes(novasMarcacoes);
      setQtdTiros(novasMarcacoes.length.toString());
    }
  };

  const limparFormularioTreino = () => {
    setSessaoEmEdicaoId(null);
    setQtdTiros(''); setMarcacoes([]); 
    setImagemAlvo(tipoAlvoPadrao === 'circular' ? ALVO_CIRCULAR : ALVO_HUMANOIDE); 
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const finalizarSessao = () => {
    if (!armaSelecionada) return alert("Selecione uma arma.");
    if (!qtdTiros) return alert("Marque os disparos.");

    let nomeArmaUsada = '';
    let calibreUsado = '';

    const arrayBusca = tipoArmaTreino === 'acervo' ? armas : armasClube;
    const a = arrayBusca.find((a: any) => a.id.toString() === armaSelecionada);
    
    if (a) {
      nomeArmaUsada = `${a.marca} ${a.modelo || ''}`.trim();
      calibreUsado = a.calibre;
    }

    const metricas = avaliarMetricasTiro(marcacoes);
    const taxaPapel = qtdTiros ? parseFloat(((marcacoes.length / parseInt(qtdTiros)) * 100).toFixed(0)) : 0;

    const novaSessao = {
      id: sessaoEmEdicaoId ? sessaoEmEdicaoId : Date.now(), 
      data: dataTreino, hora: horaTreino, 
      tipoArmaTreino: tipoArmaTreino,
      armaId: armaSelecionada, 
      armaNome: nomeArmaUsada, calibre: calibreUsado,
      tirosDeclarados: qtdTiros, tirosNoAlvo: marcacoes.length, distancia: distancia, municao: tipoMunicao, habitualidade: ehHabitualidade,
      taxaPapel: taxaPapel, precisaoScore: metricas.precisao, dispersaoIndex: metricas.dispersao, 
      diagnosticos: metricas.diagnosticos, imagemOriginal: imagemAlvo, marcacoesSalvas: marcacoes
    };

    if (sessaoEmEdicaoId) setHistoricoSessoes(historicoSessoes.map((s: any) => s.id === sessaoEmEdicaoId ? novaSessao : s));
    else setHistoricoSessoes([novaSessao, ...historicoSessoes]);
    
    limparFormularioTreino();
    setTelaAtual('relatorios');
  };

  const editarSessao = (sessao: any) => {
    setSessaoEmEdicaoId(sessao.id);
    setDataTreino(sessao.data);
    setHoraTreino(sessao.hora);
    setTipoArmaTreino(sessao.tipoArmaTreino || 'acervo');
    setArmaSelecionada(sessao.armaId?.toString() || '');
    setQtdTiros(sessao.tirosDeclarados);
    setDistancia(sessao.distancia || '10');
    setTipoMunicao(sessao.municao || 'Original');
    setEhHabitualidade(sessao.habitualidade !== false);
    setMarcacoes(sessao.marcacoesSalvas || []);
    setImagemAlvo(sessao.imagemOriginal || ALVO_CIRCULAR);
    setTelaAtual('treino');
  };

  const salvarArma = (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (!novaArma.marca || !novaArma.calibre) return alert("Preencha Marca e Calibre.");
    
    const list = abaAcervo === 'pessoal' ? armas : armasClube;
    const setList = abaAcervo === 'pessoal' ? setArmas : setArmasClube;

    if (armaEmEdicao) setList(list.map((a: any) => a.id === armaEmEdicao ? { ...novaArma, id: armaEmEdicao, historicoManutencao: a.historicoManutencao } : a));
    else setList([...list, { ...novaArma, id: Date.now(), historicoManutencao: [] }]); 
    
    setNovaArma({ marca: '', modelo: '', calibre: '', orgao: 'Sigma', craf: '', validadeCraf: '', gt: '', validadeGt: '', historicoManutencao: [] });
    setMostrarCamposAvancados(false);
    setArmaEmEdicao(null);
  };
  
  const editarArma = (arma: any) => { setNovaArma(arma); setArmaEmEdicao(arma.id); setMostrarCamposAvancados(true); };
  const excluirArma = (id: number) => { 
    if (window.confirm("Apagar arma? O histórico de treinos será mantido.")) {
      abaAcervo === 'pessoal' ? setArmas(armas.filter((a: any) => a.id !== id)) : setArmasClube(armasClube.filter((a: any) => a.id !== id));
    }
  };

  const registrarLimpeza = (id: number) => {
    setArmas(armas.map((a: any) => a.id === id ? { ...a, dataUltimaLimpeza: dataNovaManutencao } : a));
    alert("Limpeza atualizada com sucesso!");
  };

  const adicionarManutencao = (id: number) => {
    if (!descNovaManutencao) return alert("Digite a descrição da manutenção.");
    setArmas(armas.map((a: any) => {
      if (a.id === id) {
        const hist = a.historicoManutencao || [];
        return { ...a, historicoManutencao: [{ data: dataNovaManutencao, descricao: descNovaManutencao }, ...hist] };
      }
      return a;
    }));
    setDescNovaManutencao('');
  };

  const excluirManutencao = (armaId: number, index: number) => {
    if (window.confirm("Apagar registro de manutenção?")) {
      setArmas(armas.map((a: any) => {
        if (a.id === armaId) {
          const novoHist = [...(a.historicoManutencao || [])];
          novoHist.splice(index, 1);
          return { ...a, historicoManutencao: novoHist };
        }
        return a;
      }));
    }
  };

  const calcularTirosArma = (armaId: number, isClube: boolean) => {
    const sessoesArma = historicoSessoes.filter((s: any) => s.armaId?.toString() === armaId.toString() && s.tipoArmaTreino === (isClube ? 'clube' : 'acervo'));
    const total = sessoesArma.reduce((acc: number, s: any) => acc + (parseInt(s.tirosDeclarados) || 0), 0);
    const porMunicao = sessoesArma.reduce((acc: any, s: any) => {
        const tipo = s.municao || 'Original';
        acc[tipo] = (acc[tipo] || 0) + (parseInt(s.tirosDeclarados) || 0);
        return acc;
    }, {});
    return { total, porMunicao };
  };

  const salvarPeriodoHabitualidade = () => {
    if (!filtroHabInicio || !filtroHabFim) return alert("Defina a Data Inicial e Final.");
    setRelatoriosHabSalvos([{ id: Date.now(), inicio: filtroHabInicio, fim: filtroHabFim, criacao: obterDataHoje() }, ...relatoriosHabSalvos]);
    alert("Período salvo com sucesso!");
  };

  const sessoesHabitualidade = historicoSessoes.filter((s: any) => {
    if (!s.habitualidade) return false;
    if (filtroHabInicio && s.data < filtroHabInicio) return false;
    if (filtroHabFim && s.data > filtroHabFim) return false;
    return true;
  });

  const exportarCSV = () => {
    let csvContent = "\uFEFFData;Hora;Arma;Calibre;Munição;Tiros;Distância;Score Precisão\n";
    sessoesHabitualidade.forEach((s: any) => { csvContent += `${formatarData(s.data)};${s.hora};${s.armaNome};${s.calibre};${s.municao};${s.tirosDeclarados};${s.distancia || '10'}m;${s.precisaoScore}%\n`; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Habitualidade_${obterDataHoje()}.csv`;
    link.click();
  };

  let sessoesLogbookFiltradas = historicoSessoes.filter((s: any) => {
    if (filtroArmaLogbook && s.armaId?.toString() !== filtroArmaLogbook) return false;
    if (filtroDataInicioLogbook && s.data < filtroDataInicioLogbook) return false;
    if (filtroDataFimLogbook && s.data > filtroDataFimLogbook) return false;
    return true;
  });

  sessoesLogbookFiltradas.sort((a: any, b: any) => {
    if (ordemLogbook === 'arma') return a.armaNome.localeCompare(b.armaNome);
    if (ordemLogbook === 'calibre') return (a.calibre || '').localeCompare(b.calibre || '');
    if (ordemLogbook === 'score') return parseFloat(b.precisaoScore) - parseFloat(a.precisaoScore);
    const dataDiff = new Date(b.data).getTime() - new Date(a.data).getTime();
    if (dataDiff !== 0) return dataDiff;
    const armaDiff = a.armaNome.localeCompare(b.armaNome);
    if (armaDiff !== 0) return armaDiff;
    return parseFloat(b.precisaoScore) - parseFloat(a.precisaoScore);
  });

  const toggleComparacao = (sessao: any) => {
    if (sessoesParaComparar.find(s => s.id === sessao.id)) setSessoesParaComparar(sessoesParaComparar.filter(s => s.id !== sessao.id));
    else {
      if (sessoesParaComparar.length >= 2) return alert("Selecione apenas 2 treinos para comparar.");
      setSessoesParaComparar([...sessoesParaComparar, sessao]);
    }
  };

  const renderAnaliseEvolucao = () => {
    if (sessoesParaComparar.length !== 2) return null;
    
    const [s1, s2] = [...sessoesParaComparar].sort((a, b) => {
        const d1 = new Date(`${a.data}T${a.hora}`).getTime();
        const d2 = new Date(`${b.data}T${b.hora}`).getTime();
        return d1 - d2;
    });

    const scoreDiff = parseFloat(s2.precisaoScore) - parseFloat(s1.precisaoScore);
    const dispDiff = parseFloat(s2.dispersaoIndex) - parseFloat(s1.dispersaoIndex);

    let evolucaoScore = '';
    if (scoreDiff > 0) evolucaoScore = `📈 Melhorou ${scoreDiff.toFixed(1)}% na zona de pontuação.`;
    else if (scoreDiff < 0) evolucaoScore = `📉 Caiu ${Math.abs(scoreDiff).toFixed(1)}% na pontuação.`;
    else evolucaoScore = `➖ Pontuação manteve-se idêntica.`;

    let evolucaoDisp = '';
    if (dispDiff < -0.01) evolucaoDisp = `🎯 Agrupamento evoluiu (Tiros mais concentrados).`;
    else if (dispDiff > 0.01) evolucaoDisp = `⚠️ Regressão no agrupamento (Tiros mais dispersos).`;
    else evolucaoDisp = `🔄 Consistência de agrupamento inalterada.`;

    return (
      <div style={{backgroundColor: theme.caixaDiagBg, padding: '15px', borderRadius: '8px', border: `1px solid ${theme.borderColor}`, marginTop: '15px', color: theme.caixaDiagText}}>
        <h4 style={{margin: '0 0 10px 0', textAlign: 'center', fontSize: '14px'}}>📊 Análise de Progressão</h4>
        <p style={{margin: '5px 0', fontSize: '13px', textAlign: 'center'}}>De: <strong>{formatarData(s1.data)}</strong> ➡️ Para: <strong>{formatarData(s2.data)}</strong></p>
        <div style={{display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '10px'}}>
          <span style={{fontSize: '13px'}}>{evolucaoScore}</span>
          <span style={{fontSize: '13px'}}>{evolucaoDisp}</span>
        </div>
      </div>
    );
  };
  
  const styles: { [key: string]: React.CSSProperties } = {
    container: { fontFamily: 'system-ui, sans-serif', padding: '16px', paddingBottom: '80px', maxWidth: '400px', margin: '0 auto', backgroundColor: theme.bg, color: theme.textMain, minHeight: '100vh', position: 'relative' },
    card: { backgroundColor: theme.cardBg, padding: '16px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '20px', color: theme.textMain },
    input: { width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', border: `1px solid ${theme.borderColor}`, boxSizing: 'border-box', backgroundColor: theme.inputBg, color: theme.inputText, fontSize: '14px' },
    button: { width: '100%', padding: '12px', backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
    btnSecundario: { width: '100%', padding: '10px', backgroundColor: theme.caixaDiagBg, color: theme.textMain, border: `1px solid ${theme.borderColor}`, borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
    btnAcao: { background: 'none', border: 'none', cursor: 'pointer', margin: 0, padding: '5px' },
    navBar: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '400px', display: 'flex', backgroundColor: theme.navBg, borderTop: `1px solid ${theme.borderColor}`, padding: '5px 0', zIndex: 10 },
    tabBtn: { flex: 1, padding: '10px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', transition: '0.2s' }
  };

  return (
    <div style={styles.container} className="app-container">
      <style>
        {`
          @media print {
            @page { margin: 10mm; size: A4 portrait; }
            body, html { background-color: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
            * { color: black !important; }
            .no-print { display: none !important; }
            .app-container { max-width: 100% !important; width: 100% !important; padding: 0 !important; margin: 0 !important; min-height: auto !important; background-color: white !important; }
            .relatorio-oficial { border: 2px solid #2c3e50 !important; border-radius: 8px !important; padding: 20px !important; width: 100% !important; box-sizing: border-box !important; margin: 0 !important; page-break-inside: avoid; background-color: white !important; }
            table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; color: black !important; }
            th, td { border: 1px solid #ccc !important; padding: 8px !important; color: black !important; }
            th { background-color: #eee !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}
      </style>

      <div className="no-print" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', marginBottom: '20px'}}>
        <h2 style={{textAlign: 'center', margin: 0}}>🎯 Logbook v2.0</h2>
        <button onClick={() => setIsDarkMode(!isDarkMode)} style={{position: 'absolute', right: 0, background: 'none', border: 'none', fontSize: '22px'}}>
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>

      {/* ABA DO ACERVO */}
      {telaAtual === 'arsenal' && (
        <div className="no-print">
          <div style={{display: 'flex', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${theme.borderColor}`, marginBottom: '15px'}}>
            <button style={{...styles.tabBtn, backgroundColor: abaAcervo === 'pessoal' ? '#2980b9' : theme.cardBg, color: abaAcervo === 'pessoal' ? 'white' : theme.textMain}} onClick={() => {setAbaAcervo('pessoal'); setArmaEmEdicao(null);}}>Meu Acervo</button>
            <button style={{...styles.tabBtn, backgroundColor: abaAcervo === 'clube' ? '#2980b9' : theme.cardBg, color: abaAcervo === 'clube' ? 'white' : theme.textMain}} onClick={() => {setAbaAcervo('clube'); setArmaEmEdicao(null);}}>Armas do Clube</button>
          </div>

          <form onSubmit={salvarArma} style={styles.card}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${theme.borderColor}`, paddingBottom: '8px', marginBottom: '15px'}}>
              <h3 style={{margin: 0}}>{armaEmEdicao ? 'Editar Arma' : (abaAcervo === 'pessoal' ? 'Nova Arma Pessoal' : 'Nova Arma do Clube')}</h3>
              {armaEmEdicao && <button type="button" onClick={() => {setArmaEmEdicao(null); setMostrarCamposAvancados(false);}} style={{...styles.btnAcao, color: '#e74c3c', fontSize: '12px', fontWeight: 'bold'}}>✖ Cancelar</button>}
            </div>

            <div style={{display: 'flex', gap: '10px'}}>
              <div style={{flex: 2}}><input style={styles.input} placeholder="Marca (Ex: Taurus)" value={novaArma.marca} onChange={e => setNovaArma({...novaArma, marca: e.target.value})} /></div>
              <div style={{flex: 2}}><input style={styles.input} placeholder="Modelo (Opcional)" value={novaArma.modelo} onChange={e => setNovaArma({...novaArma, modelo: e.target.value})} /></div>
            </div>
            <select style={styles.input} value={novaArma.calibre} onChange={e => setNovaArma({...novaArma, calibre: e.target.value})}>
              <option value="">Selecione o Calibre...</option>
              {CALIBRES_DISPONIVEIS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {abaAcervo === 'pessoal' && (
              <>
                <button type="button" onClick={() => setMostrarCamposAvancados(!mostrarCamposAvancados)} style={{...styles.btnAcao, color: '#2980b9', fontSize: '12px', fontWeight: 'bold', width: '100%', textAlign: 'center', marginBottom: '10px'}}>
                  {mostrarCamposAvancados ? 'Ocultar Documentos ▲' : 'Inserir Documentos de Registro ▼'}
                </button>

                {mostrarCamposAvancados && (
                  <div style={{backgroundColor: theme.cardRelatorioBg, padding: '10px', borderRadius: '8px', marginBottom: '15px'}}>
                    <select style={styles.input} value={novaArma.orgao} onChange={e => setNovaArma({...novaArma, orgao: e.target.value})}>
                      <option value="Sigma">SIGMA (Exército)</option>
                      <option value="Sinarm">SINARM (Polícia Federal)</option>
                    </select>
                    <div style={{display: 'flex', gap: '10px'}}>
                      <div style={{flex: 1}}><label style={{fontSize: '11px'}}>Nº CRAF</label><input style={styles.input} value={novaArma.craf} onChange={e => setNovaArma({...novaArma, craf: e.target.value})} /></div>
                      <div style={{flex: 1}}><label style={{fontSize: '11px'}}>Validade CRAF</label><input type="date" style={styles.input} value={novaArma.validadeCraf} onChange={e => setNovaArma({...novaArma, validadeCraf: e.target.value})} /></div>
                    </div>
                    <div style={{display: 'flex', gap: '10px'}}>
                      <div style={{flex: 1}}><label style={{fontSize: '11px'}}>Nº Guia de Tráfego</label><input style={styles.input} value={novaArma.gt} onChange={e => setNovaArma({...novaArma, gt: e.target.value})} /></div>
                      <div style={{flex: 1}}><label style={{fontSize: '11px'}}>Validade GT</label><input type="date" style={styles.input} value={novaArma.validadeGt} onChange={e => setNovaArma({...novaArma, validadeGt: e.target.value})} /></div>
                    </div>
                  </div>
                )}
              </>
            )}

            <button type="submit" style={styles.button}>{armaEmEdicao ? 'Atualizar' : 'Salvar no Acervo'}</button>
          </form>

          <div style={styles.card}>
            <h3 style={{marginTop: 0, marginBottom: '15px', borderBottom: `2px solid ${theme.borderColor}`, paddingBottom: '8px'}}>
              {abaAcervo === 'pessoal' ? 'Armas Registradas' : 'Armas Salvas do Clube'}
            </h3>
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
              {(abaAcervo === 'pessoal' ? armas : armasClube).map((a: any) => {
                const stats = calcularTirosArma(a.id, abaAcervo === 'clube');
                const isExpanded = armaExpandida === a.id;
                
                return (
                  <li key={a.id} style={{ border: `1px solid ${theme.itemBorder}`, padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setArmaExpandida(isExpanded ? null : a.id)}>
                      <div>
                        <strong style={{ display: 'block', fontSize: '15px' }}>{a.marca} {a.modelo}</strong>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          {a.calibre && <span style={{ backgroundColor: '#34495e', color: 'white', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>{a.calibre}</span>}
                          <span style={{ backgroundColor: '#e67e22', color: 'white', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>{stats.total} Tiros</span>
                        </div>
                      </div>
                      <div style={{color: theme.textSec}}>{isExpanded ? '▲' : '▼'}</div>
                    </div>
                    
                    {isExpanded && (
                      <div style={{marginTop: '15px', paddingTop: '15px', borderTop: `1px dashed ${theme.borderColor}`}}>
                        
                        <div style={{backgroundColor: theme.cardRelatorioBg, padding: '10px', borderRadius: '8px', marginBottom: '10px'}}>
                          <strong style={{fontSize: '12px', display: 'block', marginBottom: '5px'}}>Desgaste por Munição:</strong>
                          {Object.keys(stats.porMunicao).length > 0 ? (
                            Object.entries(stats.porMunicao).map(([tipo, qtd]) => (
                              <div key={tipo} style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid #ccc', padding: '2px 0'}}>
                                <span>{tipo}</span> <strong>{qtd as number}</strong>
                              </div>
                            ))
                          ) : <span style={{fontSize: '12px', color: theme.textSec}}>Arma sem disparos registrados.</span>}
                        </div>

                        {abaAcervo === 'pessoal' && (
                          <>
                            <div style={{backgroundColor: theme.cardRelatorioBg, padding: '10px', borderRadius: '8px', marginBottom: '10px'}}>
                              <strong style={{fontSize: '12px', display: 'block', marginBottom: '5px'}}>Registro ({a.orgao}):</strong>
                              <div style={{fontSize: '12px', marginBottom: '4px'}}>
                                <strong>CRAF:</strong> {a.craf || 'N/A'} - Val: {formatarData(a.validadeCraf) || 'N/A'} 
                                {a.validadeCraf && <span style={{marginLeft: '5px', color: verificarValidade(a.validadeCraf).cor, fontWeight: 'bold'}}>({verificarValidade(a.validadeCraf).texto})</span>}
                              </div>
                              <div style={{fontSize: '12px'}}>
                                <strong>GT:</strong> {a.gt || 'N/A'} - Val: {formatarData(a.validadeGt) || 'N/A'}
                                {a.validadeGt && <span style={{marginLeft: '5px', color: verificarValidade(a.validadeGt).cor, fontWeight: 'bold'}}>({verificarValidade(a.validadeGt).texto})</span>}
                              </div>
                            </div>

                            <div style={{backgroundColor: theme.cardRelatorioBg, padding: '10px', borderRadius: '8px', marginBottom: '10px'}}>
                              <strong style={{fontSize: '12px', display: 'block', marginBottom: '5px'}}>Manutenção Expressa:</strong>
                              <div style={{display: 'flex', gap: '5px'}}>
                                <input type="date" style={{...styles.input, marginBottom: 0, padding: '5px', fontSize: '11px', flex: 1}} value={dataNovaManutencao} onChange={e => setDataNovaManutencao(e.target.value)} />
                                <button onClick={() => registrarLimpeza(a.id)} style={{backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold'}}>Marcar Última Limpeza</button>
                              </div>
                              {a.dataUltimaLimpeza && <p style={{fontSize: '11px', margin: '5px 0 0 0', color: '#27ae60'}}>✅ Realizada em {formatarData(a.dataUltimaLimpeza)}</p>}
                            </div>

                            <div style={{backgroundColor: theme.cardRelatorioBg, padding: '10px', borderRadius: '8px', marginBottom: '15px'}}>
                              <strong style={{fontSize: '12px', display: 'block', marginBottom: '5px'}}>Histórico de Manutenção e Peças:</strong>
                              <div style={{display: 'flex', gap: '5px', marginBottom: '10px'}}>
                                <input type="date" style={{...styles.input, marginBottom: 0, padding: '5px', fontSize: '11px', flex: 1}} value={dataNovaManutencao} onChange={e => setDataNovaManutencao(e.target.value)} />
                                <input type="text" placeholder="Ex: Troca de Mola" style={{...styles.input, marginBottom: 0, padding: '5px', fontSize: '11px', flex: 2}} value={descNovaManutencao} onChange={e => setDescNovaManutencao(e.target.value)} />
                                <button onClick={() => adicionarManutencao(a.id)} style={{backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold'}}>+</button>
                              </div>
                              
                              <ul style={{listStyle: 'none', padding: 0, margin: 0, fontSize: '11px', maxHeight: '100px', overflowY: 'auto'}}>
                                {(a.historicoManutencao || []).map((m: any, idx: number) => (
                                  <li key={idx} style={{display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${theme.itemBorder}`, padding: '4px 0'}}>
                                    <span><strong>{formatarData(m.data)}:</strong> {m.descricao}</span>
                                    <button onClick={() => excluirManutencao(a.id, idx)} style={{background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer'}}>✖</button>
                                  </li>
                                ))}
                                {!(a.historicoManutencao && a.historicoManutencao.length > 0) && <li style={{color: theme.textSec}}>Nenhum registro de peça ou reparo.</li>}
                              </ul>
                            </div>
                          </>
                        )}

                        <div style={{display: 'flex', gap: '10px'}}>
                          <button onClick={() => editarArma(a)} style={{...styles.button, backgroundColor: '#f39c12', flex: 1, padding: '8px'}}>✏️ Editar</button>
                          <button onClick={() => excluirArma(a.id)} style={{...styles.button, backgroundColor: '#e74c3c', flex: 1, padding: '8px'}}>🗑️ Excluir</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* ABA DE TREINO */}
      {telaAtual === 'treino' && (
        <div className="no-print" style={styles.card}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${theme.borderColor}`, paddingBottom: '8px', marginBottom: '15px'}}>
            <h3 style={{margin: 0}}>{sessaoEmEdicaoId ? 'Editar Sessão' : 'Registrar Sessão'}</h3>
            {sessaoEmEdicaoId && <button onClick={limparFormularioTreino} style={{...styles.btnAcao, color: '#e74c3c', fontSize: '12px', fontWeight: 'bold'}}>✖ Cancelar</button>}
          </div>

          <div style={{display: 'flex', gap: '15px', marginBottom: '10px'}}>
            <label style={{fontSize: '13px', cursor: 'pointer'}}><input type="radio" checked={tipoArmaTreino === 'acervo'} onChange={() => setTipoArmaTreino('acervo')} /> Meu Acervo</label>
            <label style={{fontSize: '13px', cursor: 'pointer'}}><input type="radio" checked={tipoArmaTreino === 'clube'} onChange={() => setTipoArmaTreino('clube')} /> Arma do Clube</label>
          </div>
          
          <div style={{marginBottom: '12px'}}>
            <select style={{...styles.input, marginBottom: mostraNovaArmaClube ? '5px' : '0'}} value={armaSelecionada} onChange={(e) => {
              if (e.target.value === 'NOVA') setMostraNovaArmaClube(true);
              else { setArmaSelecionada(e.target.value); setMostraNovaArmaClube(false); }
            }}>
              <option value="">Selecione a Arma...</option>
              {(tipoArmaTreino === 'acervo' ? armas : armasClube).map((a: any) => <option key={a.id} value={a.id}>{a.marca} {a.modelo} ({a.calibre})</option>)}
              {tipoArmaTreino === 'clube' && <option value="NOVA" style={{fontWeight: 'bold'}}>+ Adicionar Nova Arma do Clube...</option>}
            </select>
            {mostraNovaArmaClube && (
              <div style={{display: 'flex', gap: '5px', backgroundColor: theme.cardRelatorioBg, padding: '10px', borderRadius: '8px'}}>
                <input type="text" placeholder="Marca/Modelo" style={{...styles.input, marginBottom: 0, flex: 2}} value={novaArmaClubeMarca} onChange={e => setNovaArmaClubeMarca(e.target.value)} />
                <select style={{...styles.input, marginBottom: 0, flex: 1}} value={novaArmaClubeCalibre} onChange={e => setNovaArmaClubeCalibre(e.target.value)}>
                  <option value="">Calibre</option>
                  {CALIBRES_DISPONIVEIS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={adicionarNovaArmaClube} style={{backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', padding: '0 10px', fontWeight: 'bold'}}>Add</button>
              </div>
            )}
          </div>

          <div style={{display: 'flex', gap: '10px'}}>
            <div style={{flex: 1}}>
              <label style={{fontSize: '13px', fontWeight: 'bold', color: theme.textSec}}>Munição:</label>
              <select style={styles.input} value={tipoMunicao} onChange={(e) => setTipoMunicao(e.target.value)}>
                <option value="Original">Original</option>
                <option value="Recarregada">Recarregada</option>
                <option value="Dry Fire">Dry Fire</option>
              </select>
            </div>
            <div style={{flex: 1}}>
              <label style={{fontSize: '13px', fontWeight: 'bold', color: theme.textSec}}>Distância (m):</label>
              <input type="number" style={styles.input} value={distancia} onChange={(e) => setDistancia(e.target.value)} />
            </div>
          </div>

          <label style={{display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 'bold', color: theme.textSec, marginBottom: '15px', cursor: 'pointer'}}>
            <input type="checkbox" checked={ehHabitualidade} onChange={(e) => setEhHabitualidade(e.target.checked)} style={{width: '16px', height: '16px'}} />
            Válido para Habitualidade (CAC)
          </label>

          <label style={{fontSize: '13px', fontWeight: 'bold', color: theme.textSec}}>Qtd Disparos (Calculado na foto):</label>
          <input type="number" style={{...styles.input, opacity: 0.7, cursor: 'not-allowed'}} value={qtdTiros} disabled placeholder="Auto" />
          
          {(!imagemAlvo || imagemAlvo === ALVO_CIRCULAR || imagemAlvo === ALVO_HUMANOIDE) && (
            <div style={{marginBottom: '15px', backgroundColor: theme.cardRelatorioBg, padding: '10px', borderRadius: '8px'}}>
              <label style={{display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px'}}>Tipo de Alvo Padrão:</label>
              <div style={{display: 'flex', gap: '15px'}}>
                <label style={{fontSize: '14px', cursor: 'pointer'}}><input type="radio" name="alvo" checked={tipoAlvoPadrao === 'circular'} onChange={() => setTipoAlvoPadrao('circular')} /> Circular</label>
                <label style={{fontSize: '14px', cursor: 'pointer'}}><input type="radio" name="alvo" checked={tipoAlvoPadrao === 'humanoide'} onChange={() => setTipoAlvoPadrao('humanoide')} /> Humanoide (PF)</label>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <label style={{fontSize: '13px', fontWeight: 'bold', color: theme.textSec}}>Upload da Foto para Auto-Análise:</label>
            {imagemAlvo !== ALVO_CIRCULAR && imagemAlvo !== ALVO_HUMANOIDE && (
              <button onClick={removerFoto} style={{ background: 'none', border: 'none', color: '#e74c3c', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                🗑️ Remover Foto
              </button>
            )}
          </div>
          
          <input type="file" accept="image/*" ref={fileInputRef} onChange={lidarComUploadAlvo} style={{marginBottom: '15px', width: '100%', color: theme.textMain}} />
          
          <div style={{backgroundColor: theme.cardRelatorioBg, padding: '10px', borderRadius: '8px', border: `1px solid ${theme.borderColor}`}}>
            <p style={{fontSize: '12px', textAlign: 'center', marginBottom: '10px', color: theme.textSec}}>
              Toque no papel para <strong>adicionar</strong> tiro.<br/>Toque em cima do tiro para <strong>apagar</strong>.
            </p>
            <RenderizarAlvo 
              imagem={imagemAlvo} 
              marcacoes={marcacoes} 
              onTargetClick={marcarTiro} 
              onImgLoad={lidarCarregamentoImagem}
              imgRef={imgAlvoRef} 
            />
            
            <div style={{textAlign: 'center', marginTop: '10px'}}>
              <span style={{fontWeight: 'bold', fontSize: '15px', color: '#e74c3c'}}>Impactos Identificados: {marcacoes.length}</span>
            </div>
          </div>
          
          <button onClick={finalizarSessao} style={{...styles.button, backgroundColor: sessaoEmEdicaoId ? '#f39c12' : '#27ae60', marginTop: '15px'}}>
            {sessaoEmEdicaoId ? 'Atualizar Treino' : 'Finalizar Treino'}
          </button>
        </div>
      )}

      {/* ABA LOGBOOK & COMPARAÇÃO */}
      {telaAtual === 'relatorios' && (
        <div className="no-print" style={styles.card}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${theme.borderColor}`, paddingBottom: '8px', marginBottom: '15px'}}>
            <h3 style={{margin: 0}}>Logbook Analítico</h3>
            <button onClick={() => { setModoComparacao(!modoComparacao); setSessoesParaComparar([]); }} style={{...styles.btnSecundario, width: 'auto', padding: '5px 10px', margin: 0, backgroundColor: modoComparacao ? '#e74c3c' : '#2980b9', color: 'white'}}>
              {modoComparacao ? 'Cancelar Comparação' : '⚖️ Comparar'}
            </button>
          </div>

          <div style={{backgroundColor: theme.cardRelatorioBg, padding: '10px', borderRadius: '8px', marginBottom: '15px'}}>
            <label style={{fontSize: '12px', fontWeight: 'bold'}}>Filtros e Ordenação:</label>
            <div style={{display: 'flex', gap: '10px', marginTop: '5px', marginBottom: '8px'}}>
              <select style={{...styles.input, marginBottom: 0, flex: 1}} value={filtroArmaLogbook} onChange={e => setFiltroArmaLogbook(e.target.value)}>
                <option value="">Todas as Armas</option>
                {Array.from(new Set(historicoSessoes.map((s:any) => s.armaId?.toString()))).map(id => {
                  const sRef = historicoSessoes.find((s:any) => s.armaId?.toString() === id);
                  return sRef ? <option key={id as string} value={id as string}>{sRef.armaNome} {sRef.tipoArmaTreino === 'clube' ? '(Clube)' : ''}</option> : null;
                })}
              </select>
              <select style={{...styles.input, marginBottom: 0, flex: 1}} value={ordemLogbook} onChange={e => setOrdemLogbook(e.target.value)}>
                <option value="padrao">Padrão (Data/Arma/Score)</option>
                <option value="data">Data (Mais Recente)</option>
                <option value="arma">Arma (A-Z)</option>
                <option value="calibre">Calibre</option>
                <option value="score">Pontuação (Maior p/ Menor)</option>
              </select>
            </div>
            <div style={{display: 'flex', gap: '10px'}}>
              <div style={{flex: 1}}><input type="date" style={{...styles.input, marginBottom: 0}} value={filtroDataInicioLogbook} onChange={e => setFiltroDataInicioLogbook(e.target.value)} /></div>
              <div style={{flex: 1}}><input type="date" style={{...styles.input, marginBottom: 0}} value={filtroDataFimLogbook} onChange={e => setFiltroDataFimLogbook(e.target.value)} /></div>
            </div>
          </div>

          {modoComparacao && (
            <div style={{backgroundColor: '#fff3cd', padding: '10px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #ffeeba', color: '#856404', fontSize: '13px', textAlign: 'center'}}>
              Selecione 2 treinos abaixo para comparar o seu desempenho.
            </div>
          )}

          {modoComparacao && renderAnaliseEvolucao()}

          {modoComparacao && sessoesParaComparar.length === 2 && (
            <div style={{backgroundColor: theme.caixaDiagBg, padding: '15px', borderRadius: '8px', marginBottom: '20px', border: `1px solid ${theme.borderColor}`}}>
              <div style={{display: 'flex', gap: '10px'}}>
                {sessoesParaComparar.map((s, idx) => (
                  <div key={idx} style={{flex: 1, backgroundColor: theme.cardBg, padding: '10px', borderRadius: '8px', border: `1px solid ${theme.itemBorder}`, textAlign: 'center'}}>
                    <strong style={{display: 'block', fontSize: '13px', marginBottom: '5px'}}>{formatarData(s.data)}</strong>
                    <div style={{marginBottom: '10px'}}><RenderizarAlvo imagem={s.imagemOriginal} marcacoes={s.marcacoesSalvas} /></div>
                    <div style={{fontSize: '12px'}}>
                      <p style={{margin: '2px 0'}}><strong>Arma:</strong> {s.armaNome} {s.tipoArmaTreino === 'clube' ? '(Clube)' : ''}</p>
                      <p style={{margin: '2px 0'}}><strong>Calibre:</strong> {s.calibre}</p>
                      <p style={{margin: '2px 0'}}><strong>Distância:</strong> {s.distancia || 10}m</p>
                      <p style={{margin: '2px 0'}}><strong>Score:</strong> {s.precisaoScore}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sessoesLogbookFiltradas.length === 0 ? <p>Nenhum treino atende aos filtros.</p> : (
            sessoesLogbookFiltradas.map((sessao: any) => (
              <div key={sessao.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                {modoComparacao && (
                  <input type="checkbox" checked={!!sessoesParaComparar.find(s => s.id === sessao.id)} onChange={() => toggleComparacao(sessao)} style={{width: '20px', height: '20px'}} />
                )}
                <div style={{ flex: 1, backgroundColor: theme.cardRelatorioBg, borderRadius: '8px', padding: '12px', border: `1px solid ${theme.itemBorder}`, cursor: 'pointer' }} onClick={() => !modoComparacao && setSessaoExpandida(sessaoExpandida === sessao.id ? null : sessao.id)}>
                  <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${theme.itemBorder}`, paddingBottom: '8px', marginBottom: '8px'}}>
                    <div><strong>{formatarData(sessao.data)}</strong> <span style={{fontSize: '11px', color: theme.textSec, marginLeft: '5px'}}>({sessao.distancia || 10}m)</span></div>
                    <span>Score: <strong style={{color: '#2980b9'}}>{sessao.precisaoScore}%</strong></span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div>
                      <strong>{sessao.armaNome}</strong> 
                      {sessao.tipoArmaTreino === 'clube' && <span style={{fontSize:'10px', backgroundColor:'#e67e22', color:'white', padding:'2px 5px', borderRadius:'8px', marginLeft:'5px'}}>Clube</span>}
                    </div>
                    <div style={{fontSize: '13px'}}>{sessao.tirosDeclarados} tiros ({sessao.municao})</div>
                  </div>
                  
                  {sessaoExpandida === sessao.id && !modoComparacao && (
                    <div style={{marginTop: '15px', paddingTop: '15px', borderTop: `1px dashed ${theme.borderColor}`}}>
                      <RenderizarAlvo imagem={sessao.imagemOriginal} marcacoes={sessao.marcacoesSalvas} />
                      
                      {(sessao.diagnosticos && sessao.diagnosticos.length > 0) && (
                        <div style={{ backgroundColor: theme.caixaDiagBg, padding: '12px', borderRadius: '8px', marginTop: '15px', border: `1px solid ${theme.borderColor}` }}>
                          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: theme.caixaDiagText }}>🧠 Análise de Fundamentos</h4>
                          <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '12px', color: theme.textMain }}>
                            {sessao.diagnosticos.map((d: string, i: number) => <li key={i} style={{marginBottom: '4px'}}>{d}</li>)}
                          </ul>
                        </div>
                      )}

                      <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
                        <button onClick={(e) => { e.stopPropagation(); editarSessao(sessao); }} style={{...styles.button, backgroundColor: '#f39c12', flex: 1}}>✏️ Editar</button>
                        <button onClick={(e) => { e.stopPropagation(); setHistoricoSessoes(historicoSessoes.filter((s:any) => s.id !== sessao.id)); }} style={{...styles.button, backgroundColor: '#e74c3c', flex: 1}}>🗑️ Apagar</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ABA CAC */}
      {telaAtual === 'cac' && (
        <div>
          <div className="no-print" style={styles.card}>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <h3 style={{marginTop: 0, marginBottom: '15px', borderBottom: `2px solid ${theme.borderColor}`, paddingBottom: '8px', width: '100%'}}>Documento do Atirador</h3>
              <button onClick={() => setEditandoPerfil(!editandoPerfil)} style={{...styles.btnAcao, fontSize: '14px', color: '#2980b9'}}>✏️ Editar</button>
            </div>
            {editandoPerfil ? (
              <div style={{marginTop: '10px'}}>
                <label style={{fontSize: '13px', fontWeight: 'bold', color: theme.textSec}}>Nome Completo:</label>
                <input style={styles.input} value={perfil.nome} onChange={e => setPerfil({...perfil, nome: e.target.value})} />
                <label style={{fontSize: '13px', fontWeight: 'bold', color: theme.textSec}}>Número do CR:</label>
                <input style={styles.input} value={perfil.cr} onChange={e => setPerfil({...perfil, cr: e.target.value})} />
                <label style={{fontSize: '13px', fontWeight: 'bold', color: theme.textSec}}>Validade do CR:</label>
                <input type="date" style={styles.input} value={perfil.validadeCr} onChange={e => setPerfil({...perfil, validadeCr: e.target.value})} />
                <label style={{fontSize: '13px', fontWeight: 'bold', color: theme.textSec}}>Clube Afiliado:</label>
                <input style={styles.input} placeholder="Nome do Clube" value={perfil.clubeAfiliado} onChange={e => setPerfil({...perfil, clubeAfiliado: e.target.value})} />
                <button onClick={() => setEditandoPerfil(false)} style={styles.button}>Salvar Perfil</button>
              </div>
            ) : (
              <div style={{backgroundColor: theme.cardRelatorioBg, padding: '15px', borderRadius: '8px'}}>
                <p style={{margin: '0 0 5px 0'}}><strong>Nome:</strong> {perfil.nome}</p>
                <p style={{margin: '0 0 5px 0'}}><strong>CR nº:</strong> {perfil.cr || 'Não informado'}</p>
                <p style={{margin: '0 0 5px 0'}}><strong>Clube:</strong> {perfil.clubeAfiliado || 'Não informado'}</p>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <strong>Validade:</strong> {formatarData(perfil.validadeCr) || 'Não informada'}
                  {perfil.validadeCr && (
                    <span style={{backgroundColor: verificarValidade(perfil.validadeCr).cor, color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'}}>
                      {verificarValidade(perfil.validadeCr).texto}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="no-print" style={styles.card}>
            <h3 style={{marginTop: 0, marginBottom: '15px', borderBottom: `2px solid ${theme.borderColor}`, paddingBottom: '8px'}}>Gerar Relatório de Habitualidade</h3>
            <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
              <div style={{flex: 1}}><label style={{fontSize: '13px', fontWeight: 'bold', color: theme.textSec}}>Data Inicial:</label><input type="date" style={styles.input} value={filtroHabInicio} onChange={e => setFiltroHabInicio(e.target.value)} /></div>
              <div style={{flex: 1}}><label style={{fontSize: '13px', fontWeight: 'bold', color: theme.textSec}}>Data Final:</label><input type="date" style={styles.input} value={filtroHabFim} onChange={e => setFiltroHabFim(e.target.value)} /></div>
            </div>
            <button onClick={salvarPeriodoHabitualidade} style={{...styles.btnSecundario, marginBottom: '15px'}}>💾 Salvar este Período</button>
          </div>

          <div className="relatorio-oficial" style={{border: '2px solid #2c3e50', padding: '20px', borderRadius: '8px', backgroundColor: 'white', color: 'black'}}>
            <h4 style={{textAlign: 'center', margin: '0 0 15px 0', textTransform: 'uppercase', fontSize: '16px', color: 'black'}}>Comprovação de Treinamento</h4>
            <p style={{fontSize: '12px', marginBottom: '15px', lineHeight: '1.5', color: 'black'}}>
              Declaro para os devidos fins que o atirador desportivo <strong>{perfil.nome}</strong> (CR: {perfil.cr}), {perfil.clubeAfiliado ? `afiliado ao clube ${perfil.clubeAfiliado}, ` : ''} 
              realizou as seguintes práticas de tiro desportivo
              {filtroHabInicio && filtroHabFim ? ` no período de ${formatarData(filtroHabInicio)} a ${formatarData(filtroHabFim)}` : ''}:
            </p>
            <table style={{width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginBottom: '30px', tableLayout: 'fixed', color: 'black'}}>
              <thead>
                <tr style={{backgroundColor: '#eee'}}>
                  <th style={{border: '1px solid #ccc', padding: '8px', textAlign: 'center', width: '25%', color: 'black'}}>Data</th>
                  <th style={{border: '1px solid #ccc', padding: '8px', textAlign: 'left', width: '50%', color: 'black'}}>Arma / Calibre</th>
                  <th style={{border: '1px solid #ccc', padding: '8px', textAlign: 'center', width: '25%', color: 'black'}}>Tiros</th>
                </tr>
              </thead>
              <tbody>
                {sessoesHabitualidade.length === 0 ? (
                  <tr><td colSpan={3} style={{border: '1px solid #ccc', padding: '8px', textAlign: 'center', color: 'black'}}>Nenhum treino registrado.</td></tr>
                ) : (
                  sessoesHabitualidade.map((s: any) => (
                    <tr key={s.id}>
                      <td style={{border: '1px solid #ccc', padding: '8px', textAlign: 'center', color: 'black'}}>{formatarData(s.data)}</td>
                      <td style={{border: '1px solid #ccc', padding: '8px', color: 'black'}}>{s.armaNome} ({s.calibre})</td>
                      <td style={{border: '1px solid #ccc', padding: '8px', textAlign: 'center', color: 'black'}}>{s.tirosDeclarados}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div style={{borderTop: '1px solid #000', width: '70%', margin: '50px auto 10px auto'}}></div>
            <p style={{textAlign: 'center', fontSize: '12px', margin: 0, color: 'black'}}>Assinatura e Carimbo do Clube de Tiro / Instrutor</p>
          </div>
          
          <div className="no-print" style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
            <button style={{...styles.button, backgroundColor: '#8e44ad', flex: 1}} onClick={() => window.print()}>🖨️ Imprimir PDF</button>
            <button style={{...styles.button, backgroundColor: '#27ae60', flex: 1}} onClick={exportarCSV}>📊 Exportar CSV</button>
          </div>
        </div>
      )}

      <div className="no-print" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '400px', display: 'flex', backgroundColor: theme.navBg, borderTop: `1px solid ${theme.borderColor}`, padding: '5px 0', zIndex: 10 }}>
        <button style={{flex: 1, border: 'none', background: 'none', color: telaAtual === 'arsenal' ? '#2980b9' : '#7f8c8d'}} onClick={() => setTelaAtual('arsenal')}>🔫 Acervo</button>
        <button style={{flex: 1, border: 'none', background: 'none', color: telaAtual === 'treino' ? '#2980b9' : '#7f8c8d'}} onClick={() => setTelaAtual('treino')}>🎯 Treino</button>
        <button style={{flex: 1, border: 'none', background: 'none', color: telaAtual === 'relatorios' ? '#2980b9' : '#7f8c8d'}} onClick={() => setTelaAtual('relatorios')}>📊 Logbook</button>
        <button style={{flex: 1, border: 'none', background: 'none', color: telaAtual === 'cac' ? '#2980b9' : '#7f8c8d'}} onClick={() => setTelaAtual('cac')}>👤 CAC</button>
      </div>
    </div>
  );
}