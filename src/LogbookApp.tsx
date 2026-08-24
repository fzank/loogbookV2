import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

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
        callback(canvas.toDataURL('image/jpeg', 0.5)); 
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

    if (xMedio < 0.45 && yMedio > 0.55) diagnosticos.push("🚨 Antecipação do recuo (Jerking): Tiros baixo-esquerda. Puxe o gatilho suavemente.");
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
  imgRef?: React.RefObject<HTMLImageElement | null>;
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
  const [loadingDb, setLoadingDb] = useState(true);
  
  const [telaAtual, setTelaAtual] = useState<string>('arsenal');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [perfil, setPerfil] = useState<any>({ nome: 'Atirador', cr: '', validadeCr: '', clubeAfiliado: '' });
  const [armas, setArmas] = useState<any[]>([]);
  const [armasClube, setArmasClube] = useState<any[]>([]);
  const [historicoSessoes, setHistoricoSessoes] = useState<any[]>([]);
  const [relatoriosHabSalvos, setRelatoriosHabSalvos] = useState<any[]>([]);

  useEffect(() => {
    const fetchBancoDeDados = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userDocRef = doc(db, 'usuarios', user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          const dados = docSnap.data();
          if (dados.logbook_darkmode !== undefined) setIsDarkMode(dados.logbook_darkmode);
          if (dados.logbook_perfil) setPerfil(dados.logbook_perfil);
          if (dados.logbook_armas) setArmas(dados.logbook_armas);
          
          if (dados.logbook_armas_clube) {
            setArmasClube(dados.logbook_armas_clube.map((item: any) => 
              typeof item === 'string' ? { id: Date.now() + Math.random(), marca: item, modelo: '', calibre: '9mm' } : item
            ));
          }
          if (dados.logbook_sessoes) setHistoricoSessoes(dados.logbook_sessoes);
          if (dados.logbook_hab) setRelatoriosHabSalvos(dados.logbook_hab);
        } else {
          await setDoc(userDocRef, {
            logbook_darkmode: false,
            logbook_perfil: { nome: 'Atirador', cr: '', validadeCr: '', clubeAfiliado: '' },
            logbook_armas: [],
            logbook_armas_clube: [],
            logbook_sessoes: [],
            logbook_hab: []
          });
        }
      } catch (error) {
        console.error("Erro ao puxar dados do Firestore:", error);
      } finally {
        setLoadingDb(false);
      }
    };

    fetchBancoDeDados();
  }, []);

  useEffect(() => { if (!loadingDb && auth.currentUser) updateDoc(doc(db, 'usuarios', auth.currentUser.uid), { logbook_darkmode: isDarkMode }).catch(console.error); }, [isDarkMode, loadingDb]);
  useEffect(() => { if (!loadingDb && auth.currentUser) updateDoc(doc(db, 'usuarios', auth.currentUser.uid), { logbook_perfil: perfil }).catch(console.error); }, [perfil, loadingDb]);
  useEffect(() => { if (!loadingDb && auth.currentUser) updateDoc(doc(db, 'usuarios', auth.currentUser.uid), { logbook_armas: armas }).catch(console.error); }, [armas, loadingDb]);
  useEffect(() => { if (!loadingDb && auth.currentUser) updateDoc(doc(db, 'usuarios', auth.currentUser.uid), { logbook_armas_clube: armasClube }).catch(console.error); }, [armasClube, loadingDb]);
  useEffect(() => { if (!loadingDb && auth.currentUser) updateDoc(doc(db, 'usuarios', auth.currentUser.uid), { logbook_sessoes: historicoSessoes }).catch(console.error); }, [historicoSessoes, loadingDb]);
  useEffect(() => { if (!loadingDb && auth.currentUser) updateDoc(doc(db, 'usuarios', auth.currentUser.uid), { logbook_hab: relatoriosHabSalvos }).catch(console.error); }, [relatoriosHabSalvos, loadingDb]);

  const theme = {
    bg: isDarkMode ? '#121212' : '#f4f4f9', 
    cardBg: isDarkMode ? '#1e1e1e' : '#ffffff',
    textMain: isDarkMode ? '#ecf0f1' : '#2c3e50', 
    textSec: isDarkMode ? '#bdc3c7' : '#555',
    inputBg: isDarkMode ? '#2c3e50' : '#ffffff', 
    inputText: isDarkMode ? '#ecf0f1' : '#000000',
    borderColor: isDarkMode ? '#34495e' : '#cccccc', 
    navBg: isDarkMode ? '#1e1e1e' : '#ffffff',
    cardRelatorioBg: isDarkMode ? '#2c3e50' : '#eaf2f8', 
    caixaDiagBg: isDarkMode ? '#34495e' : '#d5e1ee',
    itemBorder: isDarkMode ? '#34495e' : '#bdc3c7', 
    caixaDiagText: isDarkMode ? '#ecf0f1' : '#2c3e50',
    paneBg: isDarkMode ? '#4a2323' : '#fdedec',
    paneBorder: isDarkMode ? '#e74c3c' : '#e74c3c'
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
  
  // NOVOS ESTADOS PARA A FUNCIONALIDADE DE PANE
  const [houvePane, setHouvePane] = useState<boolean>(false);
  const [descPane, setDescPane] = useState<string>('');
  const [resolucaoPane, setResolucaoPane] = useState<string>('');
  const [mostrarDicasPane, setMostrarDicasPane] = useState<boolean>(false);

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
    if (telaAtual === 'treino' && !sessaoEmEdicaoId && !loadingDb) {
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
  }, [telaAtual, sessaoEmEdicaoId, historicoSessoes, armas, loadingDb]);

  useEffect(() => {
    if (!sessaoEmEdicaoId && (imagemAlvo === ALVO_CIRCULAR || imagemAlvo === ALVO_HUMANOIDE)) {
      setImagemAlvo(tipoAlvoPadrao === 'circular' ? ALVO_CIRCULAR : ALVO_HUMANOIDE);
      setMarcacoes([]);
      setQtdTiros('');
    }
  }, [tipoAlvoPadrao, sessaoEmEdicaoId]);

  if (loadingDb) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f4f4f9', color: '#2c3e50', fontFamily: 'system-ui' }}>
        <h2 style={{margin: '0 0 15px 0', fontSize: '20px'}}>🎯 Logbook v2.0</h2>
        <div style={{ padding: '12px 24px', backgroundColor: 'white', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontWeight: 'bold', fontSize: '13px' }}>
          ☁️ Sincronizando com a Nuvem...
        </div>
      </div>
    );
  }

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

  const lidarCarregamentoImagem = () => {
    if (isAutoScanning && imgAlvoRef.current) {
      escanearFuros(imgAlvoRef.current);
      setIsAutoScanning(false);
    }
  };

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
    setDataTreino(obterDataHoje());
    setHoraTreino(obterHoraAtual());
    setQtdTiros(''); 
    setMarcacoes([]); 
    setImagemAlvo(tipoAlvoPadrao === 'circular' ? ALVO_CIRCULAR : ALVO_HUMANOIDE); 
    setHouvePane(false);
    setDescPane('');
    setResolucaoPane('');
    setMostrarDicasPane(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const finalizarSessao = () => {
    if (!armaSelecionada) return alert("Selecione uma arma.");
    if (!qtdTiros && marcacoes.length === 0) return alert("Marque os disparos ou insira a quantidade.");

    let nomeArmaUsada = '';
    let calibreUsado = '';

    const arrayBusca = tipoArmaTreino === 'acervo' ? armas : armasClube;
    const a = arrayBusca.find((a: any) => a.id.toString() === armaSelecionada);
    
    if (a) {
      nomeArmaUsada = `${a.marca} ${a.modelo || ''}`.trim();
      calibreUsado = a.calibre;
    }

    const metricas = avaliarMetricasTiro(marcacoes);
    const taxaPapel = qtdTiros && parseInt(qtdTiros) > 0 ? parseFloat(((marcacoes.length / parseInt(qtdTiros)) * 100).toFixed(0)) : 0;

    const novaSessao = {
      id: sessaoEmEdicaoId ? sessaoEmEdicaoId : Date.now(), 
      data: dataTreino, hora: horaTreino, 
      tipoArmaTreino: tipoArmaTreino,
      armaId: armaSelecionada, 
      armaNome: nomeArmaUsada, calibre: calibreUsado,
      tirosDeclarados: qtdTiros || marcacoes.length.toString(), 
      tirosNoAlvo: marcacoes.length, distancia: distancia, municao: tipoMunicao, habitualidade: ehHabitualidade,
      taxaPapel: taxaPapel, precisaoScore: metricas.precisao, dispersaoIndex: metricas.dispersao, 
      diagnosticos: metricas.diagnosticos, imagemOriginal: imagemAlvo, marcacoesSalvas: marcacoes,
      // Dados de Pane
      houvePane: houvePane, descPane: houvePane ? descPane : '', resolucaoPane: houvePane ? resolucaoPane : ''
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
    setHouvePane(sessao.houvePane || false);
    setDescPane(sessao.descPane || '');
    setResolucaoPane(sessao.resolucaoPane || '');
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
      <div style={{backgroundColor: theme.caixaDiagBg, padding: '12px', borderRadius: '6px', border: `1px solid ${theme.borderColor}`, marginTop: '12px', color: theme.caixaDiagText}}>
        <h4 style={{margin: '0 0 8px 0', textAlign: 'center', fontSize: '13px'}}>📊 Análise de Progressão</h4>
        <p style={{margin: '4px 0', fontSize: '12px', textAlign: 'center'}}>De: <strong>{formatarData(s1.data)}</strong> ➡️ Para: <strong>{formatarData(s2.data)}</strong></p>
        <div style={{display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px'}}>
          <span style={{fontSize: '12px'}}>{evolucaoScore}</span>
          <span style={{fontSize: '12px'}}>{evolucaoDisp}</span>
        </div>
      </div>
    );
  };
  
  const styles: { [key: string]: React.CSSProperties } = {
    container: { fontFamily: 'system-ui, sans-serif', padding: '10px', paddingBottom: '70px', maxWidth: '400px', margin: '0 auto', backgroundColor: theme.bg, color: theme.textMain, minHeight: '100vh', position: 'relative', boxSizing: 'border-box' },
    card: { backgroundColor: theme.cardBg, padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '12px', color: theme.textMain },
    input: { width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '6px', border: `1px solid ${theme.borderColor}`, boxSizing: 'border-box', backgroundColor: theme.inputBg, color: theme.inputText, fontSize: '13px' },
    button: { width: '100%', padding: '8px', backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
    btnSecundario: { width: '100%', padding: '6px', backgroundColor: theme.caixaDiagBg, color: theme.textMain, border: `1px solid ${theme.borderColor}`, borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' },
    btnAcao: { background: 'none', border: 'none', cursor: 'pointer', margin: 0, padding: '4px' },
    navBar: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '400px', display: 'flex', backgroundColor: theme.navBg, borderTop: `1px solid ${theme.borderColor}`, padding: '4px 0', zIndex: 10 },
    tabBtn: { flex: 1, padding: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', transition: '0.2s' }
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

      <div className="no-print" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', marginBottom: '16px'}}>
        <h2 style={{textAlign: 'center', margin: 0, fontSize: '18px'}}>🎯 Logbook v2.0</h2>
        <div style={{position: 'absolute', right: 0, display: 'flex', gap: '6px', alignItems: 'center'}}>
          <button onClick={() => setIsDarkMode(!isDarkMode)} style={{background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', padding: 0}}>
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <button onClick={() => signOut(auth)} style={{background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', padding: 0, color: '#e74c3c'}} title="Sair">
            ⏻
          </button>
        </div>
      </div>

      {/* ABA DO ACERVO */}
      {telaAtual === 'arsenal' && (
        <div className="no-print">
          <div style={{display: 'flex', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${theme.borderColor}`, marginBottom: '12px'}}>
            <button style={{...styles.tabBtn, backgroundColor: abaAcervo === 'pessoal' ? '#2980b9' : theme.cardBg, color: abaAcervo === 'pessoal' ? 'white' : theme.textMain}} onClick={() => {setAbaAcervo('pessoal'); setArmaEmEdicao(null);}}>Meu Acervo</button>
            <button style={{...styles.tabBtn, backgroundColor: abaAcervo === 'clube' ? '#2980b9' : theme.cardBg, color: abaAcervo === 'clube' ? 'white' : theme.textMain}} onClick={() => {setAbaAcervo('clube'); setArmaEmEdicao(null);}}>Armas do Clube</button>
          </div>

          <form onSubmit={salvarArma} style={styles.card}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: '6px', marginBottom: '8px'}}>
              <h3 style={{margin: 0, fontSize: '13px'}}>{armaEmEdicao ? 'Editar Arma' : (abaAcervo === 'pessoal' ? 'Nova Arma Pessoal' : 'Nova Arma do Clube')}</h3>
              {armaEmEdicao && <button type="button" onClick={() => {setArmaEmEdicao(null); setMostrarCamposAvancados(false);}} style={{...styles.btnAcao, color: '#e74c3c', fontSize: '11px', fontWeight: 'bold'}}>✖ Cancelar</button>}
            </div>

            <div style={{display: 'flex', gap: '6px'}}>
              <div style={{flex: 2}}><input style={styles.input} placeholder="Marca (Ex: Taurus)" value={novaArma.marca} onChange={e => setNovaArma({...novaArma, marca: e.target.value})} /></div>
              <div style={{flex: 2}}><input style={styles.input} placeholder="Modelo (Opcional)" value={novaArma.modelo} onChange={e => setNovaArma({...novaArma, modelo: e.target.value})} /></div>
            </div>
            <select style={styles.input} value={novaArma.calibre} onChange={e => setNovaArma({...novaArma, calibre: e.target.value})}>
              <option value="">Selecione o Calibre...</option>
              {CALIBRES_DISPONIVEIS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {abaAcervo === 'pessoal' && (
              <>
                <button type="button" onClick={() => setMostrarCamposAvancados(!mostrarCamposAvancados)} style={{...styles.btnAcao, color: '#2980b9', fontSize: '11px', fontWeight: 'bold', width: '100%', textAlign: 'center', marginBottom: '6px'}}>
                  {mostrarCamposAvancados ? 'Ocultar Documentos ▲' : 'Inserir Documentos de Registro ▼'}
                </button>

                {mostrarCamposAvancados && (
                  <div style={{backgroundColor: theme.cardRelatorioBg, padding: '8px', borderRadius: '6px', marginBottom: '10px'}}>
                    <select style={styles.input} value={novaArma.orgao} onChange={e => setNovaArma({...novaArma, orgao: e.target.value})}>
                      <option value="Sigma">SIGMA (Exército)</option>
                      <option value="Sinarm">SINARM (Polícia Federal)</option>
                    </select>
                    <div style={{display: 'flex', gap: '6px'}}>
                      <div style={{flex: 1}}><label style={{fontSize: '10px'}}>Nº CRAF</label><input style={styles.input} value={novaArma.craf} onChange={e => setNovaArma({...novaArma, craf: e.target.value})} /></div>
                      <div style={{flex: 1}}><label style={{fontSize: '10px'}}>Validade CRAF</label><input type="date" style={styles.input} value={novaArma.validadeCraf} onChange={e => setNovaArma({...novaArma, validadeCraf: e.target.value})} /></div>
                    </div>
                    <div style={{display: 'flex', gap: '6px'}}>
                      <div style={{flex: 1}}><label style={{fontSize: '10px'}}>Nº Guia de Tráfego</label><input style={styles.input} value={novaArma.gt} onChange={e => setNovaArma({...novaArma, gt: e.target.value})} /></div>
                      <div style={{flex: 1}}><label style={{fontSize: '10px'}}>Validade GT</label><input type="date" style={styles.input} value={novaArma.validadeGt} onChange={e => setNovaArma({...novaArma, validadeGt: e.target.value})} /></div>
                    </div>
                  </div>
                )}
              </>
            )}

            <button type="submit" style={styles.button}>{armaEmEdicao ? 'Atualizar' : 'Salvar no Acervo'}</button>
          </form>

          <div>
            <h3 style={{marginTop: 0, marginBottom: '10px', borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: '4px', fontSize: '14px', textAlign: 'center'}}>
              {abaAcervo === 'pessoal' ? 'Armas Registradas' : 'Armas Salvas do Clube'}
            </h3>
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
              {(abaAcervo === 'pessoal' ? armas : armasClube).map((a: any) => {
                const stats = calcularTirosArma(a.id, abaAcervo === 'clube');
                const isExpanded = armaExpandida === a.id;
                
                return (
                  <li 
                    key={a.id} 
                    style={{ backgroundColor: theme.cardRelatorioBg, padding: '10px', borderRadius: '8px', marginBottom: '10px', border: `1px solid ${theme.itemBorder}`, cursor: 'pointer' }} 
                    onClick={() => setArmaExpandida(isExpanded ? null : a.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                       <div>
                          <strong style={{ fontSize: '14px', display: 'block', color: theme.textMain }}>{a.marca} {a.modelo}</strong>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', marginBottom: '8px' }}>
                             {a.calibre && <span style={{ backgroundColor: '#34495e', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold' }}>{a.calibre}</span>}
                             <span style={{ backgroundColor: '#8e44ad', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold' }}>🎯 {stats.total} tiros</span>
                          </div>
                       </div>
                       <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={(e) => { e.stopPropagation(); editarArma(a); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: 0 }}>✏️</button>
                          <button onClick={(e) => { e.stopPropagation(); excluirArma(a.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: 0 }}>🗑️</button>
                       </div>
                    </div>

                    {abaAcervo === 'pessoal' && (
                      <div style={{ backgroundColor: isDarkMode ? '#2c3e50' : '#e2e8f0', padding: '8px', borderRadius: '6px', margin: '4px 0', fontSize: '11px' }}>
                         <p style={{margin: '0 0 4px 0', fontWeight: 'bold', color: theme.textMain}}>CRAF: <span style={{fontWeight: 'normal'}}>{a.craf || 'Não inf.'} {a.validadeCraf ? ` (Val: ${formatarData(a.validadeCraf)})` : ''}</span></p>
                         <p style={{margin: 0, fontWeight: 'bold', color: theme.textMain}}>GT: <span style={{fontWeight: 'normal'}}>{a.gt || 'Não inf.'} {a.validadeGt ? ` (Val: ${formatarData(a.validadeGt)})` : ''}</span></p>
                      </div>
                    )}
                    
                    {!isExpanded && <div style={{textAlign: 'center', color: theme.textSec, fontSize: '10px', marginTop: '6px'}}>▼ Clique para expandir detalhes</div>}
                    {isExpanded && <div style={{textAlign: 'center', color: theme.textSec, fontSize: '10px', marginTop: '6px'}}>▲ Clique para recolher</div>}

                    {isExpanded && (
                      <div style={{ marginTop: '4px', cursor: 'default' }} onClick={e => e.stopPropagation()}>
                        <div style={{ borderTop: `1px dashed ${theme.borderColor}`, margin: '10px 0' }} />

                        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                          <strong style={{ fontSize: '11px', color: theme.textMain, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>📊 Consumo de Munição</strong>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '6px' }}>
                             <div style={{ flex: 1, border: `1px solid ${isDarkMode ? '#3498db' : '#2980b9'}`, padding: '4px 0', borderRadius: '4px', fontSize: '10px', color: theme.textMain, backgroundColor: isDarkMode ? '#1e2b3c' : '#eaf2f8' }}>Orig.: {stats.porMunicao['Original'] || 0}</div>
                             <div style={{ flex: 1, border: `1px solid ${isDarkMode ? '#f39c12' : '#d35400'}`, padding: '4px 0', borderRadius: '4px', fontSize: '10px', color: theme.textMain, backgroundColor: isDarkMode ? '#3d2e1b' : '#fef5e7' }}>Recarg.: {stats.porMunicao['Recarregada'] || 0}</div>
                             <div style={{ flex: 1, border: `1px solid ${isDarkMode ? '#e74c3c' : '#c0392b'}`, padding: '4px 0', borderRadius: '4px', fontSize: '10px', color: theme.textMain, backgroundColor: isDarkMode ? '#3b2222' : '#fdedec' }}>Dry Fire: {stats.porMunicao['Dry Fire'] || 0}</div>
                          </div>
                        </div>

                        {abaAcervo === 'pessoal' && (
                          <>
                            <div style={{ borderTop: `1px dashed ${theme.borderColor}`, margin: '10px 0' }} />
                            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                              <strong style={{ fontSize: '11px', color: theme.textMain, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>🛠️ Controle de Manutenção</strong>
                            </div>

                            <div style={{ backgroundColor: isDarkMode ? '#2c3e50' : '#d5e1ee', padding: '6px 8px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 'bold', color: theme.textMain }}>Limpeza:</span>
                                <input type="date" style={{ padding: '4px', borderRadius: '4px', border: 'none', fontSize: '10px', backgroundColor: isDarkMode ? '#1a252f' : '#fff', color: theme.textMain, outline: 'none' }} value={dataNovaManutencao} onChange={e => setDataNovaManutencao(e.target.value)} />
                              </div>
                              <button onClick={() => registrarLimpeza(a.id)} style={{ background: 'none', border: 'none', color: isDarkMode ? '#ecf0f1' : '#2980b9', fontWeight: 'bold', fontSize: '10px', cursor: 'pointer' }}>Limpei Hoje</button>
                            </div>
                            {a.dataUltimaLimpeza && <p style={{ fontSize: '10px', margin: '-2px 0 8px 0', color: '#27ae60', textAlign: 'center' }}>Última limpeza: {formatarData(a.dataUltimaLimpeza)}</p>}

                            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                               <input type="date" style={{...styles.input, marginBottom: 0, padding: '6px', fontSize: '10px', flex: 1}} value={dataNovaManutencao} onChange={e => setDataNovaManutencao(e.target.value)} />
                               <input type="text" placeholder="Ex: Troca de mola" style={{...styles.input, marginBottom: 0, padding: '6px', fontSize: '10px', flex: 2}} value={descNovaManutencao} onChange={e => setDescNovaManutencao(e.target.value)} />
                               <button onClick={() => adicionarManutencao(a.id)} style={{backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '6px', padding: '0 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold'}}>Add</button>
                            </div>
                            
                            <ul style={{listStyle: 'none', padding: 0, margin: 0, fontSize: '10px', maxHeight: '90px', overflowY: 'auto'}}>
                              {(a.historicoManutencao || []).map((m: any, idx: number) => (
                                <li key={idx} style={{display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${theme.itemBorder}`, padding: '4px 0', color: theme.textMain}}>
                                  <span><strong>{formatarData(m.data)}:</strong> {m.descricao}</span>
                                  <button onClick={() => excluirManutencao(a.id, idx)} style={{background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '10px'}}>✖</button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
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
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: '6px', marginBottom: '10px'}}>
            <h3 style={{margin: 0, fontSize: '14px'}}>{sessaoEmEdicaoId ? 'Editar Sessão' : 'Registrar Sessão'}</h3>
            {sessaoEmEdicaoId && <button onClick={limparFormularioTreino} style={{...styles.btnAcao, color: '#e74c3c', fontSize: '11px', fontWeight: 'bold'}}>✖ Cancelar</button>}
          </div>

          <div style={{display: 'flex', gap: '12px', marginBottom: '8px'}}>
            <label style={{fontSize: '12px', cursor: 'pointer'}}><input type="radio" checked={tipoArmaTreino === 'acervo'} onChange={() => setTipoArmaTreino('acervo')} /> Meu Acervo</label>
            <label style={{fontSize: '12px', cursor: 'pointer'}}><input type="radio" checked={tipoArmaTreino === 'clube'} onChange={() => setTipoArmaTreino('clube')} /> Arma do Clube</label>
          </div>
          
          <div style={{marginBottom: '8px'}}>
            <select style={{...styles.input, marginBottom: mostraNovaArmaClube ? '4px' : '0'}} value={armaSelecionada} onChange={(e) => {
              if (e.target.value === 'NOVA') setMostraNovaArmaClube(true);
              else { setArmaSelecionada(e.target.value); setMostraNovaArmaClube(false); }
            }}>
              <option value="">Selecione a Arma...</option>
              {(tipoArmaTreino === 'acervo' ? armas : armasClube).map((a: any) => <option key={a.id} value={a.id}>{a.marca} {a.modelo} ({a.calibre})</option>)}
              {tipoArmaTreino === 'clube' && <option value="NOVA" style={{fontWeight: 'bold'}}>+ Adicionar Nova Arma do Clube...</option>}
            </select>
            {mostraNovaArmaClube && (
              <div style={{display: 'flex', gap: '4px', backgroundColor: theme.cardRelatorioBg, padding: '6px', borderRadius: '6px'}}>
                <input type="text" placeholder="Marca/Modelo" style={{...styles.input, marginBottom: 0, flex: 2}} value={novaArmaClubeMarca} onChange={e => setNovaArmaClubeMarca(e.target.value)} />
                <select style={{...styles.input, marginBottom: 0, flex: 1}} value={novaArmaClubeCalibre} onChange={e => setNovaArmaClubeCalibre(e.target.value)}>
                  <option value="">Calibre</option>
                  {CALIBRES_DISPONIVEIS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={adicionarNovaArmaClube} style={{backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', padding: '0 8px', fontWeight: 'bold', fontSize: '11px'}}>Add</button>
              </div>
            )}
          </div>

          <div style={{display: 'flex', gap: '6px'}}>
            <div style={{flex: 1}}>
              <label style={{fontSize: '11px', fontWeight: 'bold', color: theme.textSec}}>Munição:</label>
              <select style={styles.input} value={tipoMunicao} onChange={(e) => setTipoMunicao(e.target.value)}>
                <option value="Original">Original</option>
                <option value="Recarregada">Recarregada</option>
                <option value="Dry Fire">Dry Fire</option>
              </select>
            </div>
            <div style={{flex: 1}}>
              <label style={{fontSize: '11px', fontWeight: 'bold', color: theme.textSec}}>Distância (m):</label>
              <input type="number" style={styles.input} value={distancia} onChange={(e) => setDistancia(e.target.value)} />
            </div>
          </div>

          <label style={{display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 'bold', color: theme.textSec, marginBottom: '10px', cursor: 'pointer'}}>
            <input type="checkbox" checked={ehHabitualidade} onChange={(e) => setEhHabitualidade(e.target.checked)} style={{width: '13px', height: '13px'}} />
            Válido para Habitualidade (CAC)
          </label>

          {/* NOVO: REGISTRO DE PANES */}
          <div style={{ marginBottom: '10px', border: `1px solid ${houvePane ? theme.paneBorder : theme.borderColor}`, borderRadius: '6px', overflow: 'hidden' }}>
            <label style={{display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 'bold', color: houvePane ? '#e74c3c' : theme.textSec, padding: '8px', backgroundColor: houvePane ? theme.paneBg : theme.inputBg, cursor: 'pointer', margin: 0}}>
              <input type="checkbox" checked={houvePane} onChange={(e) => setHouvePane(e.target.checked)} style={{width: '13px', height: '13px'}} />
              ⚠️ Ocorreu alguma pane no armamento?
            </label>
            
            {houvePane && (
              <div style={{ padding: '8px', backgroundColor: theme.cardBg }}>
                <input type="text" placeholder="Qual foi a pane? (Ex: Nega, Chaminé)" value={descPane} onChange={e => setDescPane(e.target.value)} style={{...styles.input, marginBottom: '6px', borderColor: '#e74c3c'}} />
                <input type="text" placeholder="Como foi resolvida?" value={resolucaoPane} onChange={e => setResolucaoPane(e.target.value)} style={{...styles.input, marginBottom: '6px'}} />
                
                <button onClick={() => setMostrarDicasPane(!mostrarDicasPane)} style={{...styles.btnAcao, color: '#2980b9', fontSize: '10px', fontWeight: 'bold', width: '100%', textAlign: 'center'}}>
                  {mostrarDicasPane ? '▲ Ocultar Dicas Táticas' : '▼ Ver Dicas de Resolução de Panes'}
                </button>

                {mostrarDicasPane && (
                  <div style={{ marginTop: '6px', padding: '8px', backgroundColor: theme.cardRelatorioBg, borderRadius: '4px', fontSize: '10px', color: theme.textMain, lineHeight: '1.4' }}>
                    <strong>Ação Imediata (Tap-Rack-Bang):</strong><br/>
                    1. Bata forte na base do carregador.<br/>
                    2. Puxe o ferrolho (rack) para ejetar a munição falha.<br/>
                    3. Retome a visada e tente o disparo.<br/><br/>
                    <strong>Dupla Alimentação:</strong><br/>
                    Trave o ferrolho aberto, remova o carregador, puxe o ferrolho 2x para limpar a câmara, insira novo carregador e engrije a arma.
                  </div>
                )}
              </div>
            )}
          </div>

          <label style={{fontSize: '11px', fontWeight: 'bold', color: theme.textSec}}>Qtd Disparos (Calculado na foto):</label>
          <input type="number" style={{...styles.input, opacity: 0.7, cursor: 'not-allowed'}} value={qtdTiros} disabled placeholder="Auto" />
          
          {(!imagemAlvo || imagemAlvo === ALVO_CIRCULAR || imagemAlvo === ALVO_HUMANOIDE) && (
            <div style={{marginBottom: '10px', backgroundColor: theme.cardRelatorioBg, padding: '8px', borderRadius: '6px'}}>
              <label style={{display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px'}}>Tipo de Alvo Padrão:</label>
              <div style={{display: 'flex', gap: '10px'}}>
                <label style={{fontSize: '12px', cursor: 'pointer'}}><input type="radio" name="alvo" checked={tipoAlvoPadrao === 'circular'} onChange={() => setTipoAlvoPadrao('circular')} /> Circular</label>
                <label style={{fontSize: '12px', cursor: 'pointer'}}><input type="radio" name="alvo" checked={tipoAlvoPadrao === 'humanoide'} onChange={() => setTipoAlvoPadrao('humanoide')} /> Humanoide (PF)</label>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label style={{fontSize: '11px', fontWeight: 'bold', color: theme.textSec}}>Upload da Foto para Auto-Análise:</label>
            {imagemAlvo !== ALVO_CIRCULAR && imagemAlvo !== ALVO_HUMANOIDE && (
              <button onClick={removerFoto} style={{ background: 'none', border: 'none', color: '#e74c3c', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                🗑️ Remover
              </button>
            )}
          </div>
          
          <input type="file" accept="image/*" ref={fileInputRef} onChange={lidarComUploadAlvo} style={{marginBottom: '10px', width: '100%', color: theme.textMain, fontSize: '11px'}} />
          
          <div style={{backgroundColor: theme.cardRelatorioBg, padding: '8px', borderRadius: '6px', border: `1px solid ${theme.borderColor}`}}>
            <p style={{fontSize: '10px', textAlign: 'center', marginBottom: '6px', color: theme.textSec}}>
              Toque no papel para <strong>adicionar</strong> tiro.<br/>Toque no tiro para <strong>apagar</strong>.
            </p>
            <RenderizarAlvo 
              imagem={imagemAlvo} 
              marcacoes={marcacoes} 
              onTargetClick={marcarTiro} 
              onImgLoad={lidarCarregamentoImagem}
              imgRef={imgAlvoRef} 
            />
            
            <div style={{textAlign: 'center', marginTop: '8px'}}>
              <span style={{fontWeight: 'bold', fontSize: '13px', color: '#e74c3c'}}>Impactos Identificados: {marcacoes.length}</span>
            </div>
          </div>
          
          <button onClick={finalizarSessao} style={{...styles.button, backgroundColor: sessaoEmEdicaoId ? '#f39c12' : '#27ae60', marginTop: '12px'}}>
            {sessaoEmEdicaoId ? 'Atualizar Treino' : 'Finalizar Treino'}
          </button>
        </div>
      )}

      {/* ABA LOGBOOK & COMPARAÇÃO */}
      {telaAtual === 'relatorios' && (
        <div className="no-print" style={{padding: '0 4px'}}>
          <div style={{display: 'flex', gap: '6px', marginBottom: '8px'}}>
            <div style={{flex: 1}}><input type="date" style={{...styles.input, marginBottom: 0}} value={filtroDataInicioLogbook} onChange={e => setFiltroDataInicioLogbook(e.target.value)} /></div>
            <div style={{flex: 1}}><input type="date" style={{...styles.input, marginBottom: 0}} value={filtroDataFimLogbook} onChange={e => setFiltroDataFimLogbook(e.target.value)} /></div>
          </div>
          
          <div style={{display: 'flex', gap: '6px', marginBottom: '12px'}}>
            <select style={{...styles.input, marginBottom: 0, flex: 2}} value={filtroArmaLogbook} onChange={e => setFiltroArmaLogbook(e.target.value)}>
              <option value="">Todas as armas</option>
              {Array.from(new Set(historicoSessoes.map((s:any) => s.armaId?.toString()))).map(id => {
                const sRef = historicoSessoes.find((s:any) => s.armaId?.toString() === id);
                return sRef ? <option key={id as string} value={id as string}>{sRef.armaNome} {sRef.tipoArmaTreino === 'clube' ? '(Clube)' : ''}</option> : null;
              })}
            </select>
            <select style={{...styles.input, marginBottom: 0, flex: 1}} value={ordemLogbook} onChange={e => setOrdemLogbook(e.target.value)}>
              <option value="padrao">Padrão</option>
              <option value="data">Recente</option>
              <option value="score">Score</option>
            </select>
          </div>

          <button onClick={() => { setModoComparacao(!modoComparacao); setSessoesParaComparar([]); }} style={{ width: '100%', padding: '10px', backgroundColor: '#9b59b6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>
            {modoComparacao ? 'Cancelar Comparação' : '⚖️ Comparar Períodos'}
          </button>

          <h3 style={{textAlign: 'center', borderBottom: `1px solid ${theme.itemBorder}`, paddingBottom: '6px', margin: '0 0 12px 0', fontSize: '15px'}}>Sessões Salvas</h3>

          {modoComparacao && (
            <div style={{backgroundColor: '#fff3cd', padding: '8px', borderRadius: '6px', marginBottom: '12px', border: '1px solid #ffeeba', color: '#856404', fontSize: '11px', textAlign: 'center'}}>
              Selecione 2 treinos abaixo para comparar.
            </div>
          )}

          {modoComparacao && renderAnaliseEvolucao()}

          {modoComparacao && sessoesParaComparar.length === 2 && (
            <div style={{backgroundColor: theme.caixaDiagBg, padding: '10px', borderRadius: '6px', marginBottom: '12px', border: `1px solid ${theme.borderColor}`}}>
              <div style={{display: 'flex', gap: '6px'}}>
                {sessoesParaComparar.map((s, idx) => (
                  <div key={idx} style={{flex: 1, backgroundColor: theme.cardBg, padding: '6px', borderRadius: '6px', border: `1px solid ${theme.itemBorder}`, textAlign: 'center'}}>
                    <strong style={{display: 'block', fontSize: '11px', marginBottom: '4px'}}>{formatarData(s.data)}</strong>
                    <div style={{marginBottom: '6px'}}><RenderizarAlvo imagem={s.imagemOriginal} marcacoes={s.marcacoesSalvas} /></div>
                    <div style={{fontSize: '10px'}}>
                      <p style={{margin: '2px 0'}}><strong>Arma:</strong> {s.armaNome}</p>
                      <p style={{margin: '2px 0'}}><strong>Calibre:</strong> {s.calibre}</p>
                      <p style={{margin: '2px 0'}}><strong>Distância:</strong> {s.distancia || 10}m</p>
                      <p style={{margin: '2px 0'}}><strong>Score:</strong> {s.precisaoScore}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sessoesLogbookFiltradas.length === 0 ? <p style={{textAlign: 'center', fontSize: '12px'}}>Nenhum treino atende aos filtros.</p> : (
            sessoesLogbookFiltradas.map((sessao: any) => (
              <div key={sessao.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '10px' }}>
                {modoComparacao && (
                  <input type="checkbox" checked={!!sessoesParaComparar.find(s => s.id === sessao.id)} onChange={() => toggleComparacao(sessao)} style={{width: '16px', height: '16px', marginTop: '12px'}} />
                )}
                
                <div style={{ flex: 1, backgroundColor: theme.cardRelatorioBg, borderRadius: '6px', padding: '10px', border: `1px solid ${theme.itemBorder}` }}>
                  
                  {/* CARD V1 Layout - Compact */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div>
                      <strong style={{ fontSize: '13px' }}>{formatarData(sessao.data)}</strong>
                      <span style={{ fontSize: '10px', color: theme.textSec, marginLeft: '4px' }}>às {sessao.hora}</span>
                    </div>
                    {sessao.habitualidade && <span style={{ backgroundColor: '#f39c12', color: 'white', padding: '2px 4px', borderRadius: '4px', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>Habitualidade</span>}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
                      {sessao.armaNome} <span style={{ fontSize: '9px', color: theme.textSec, fontWeight: 'normal' }}>({sessao.municao}) {sessao.tipoArmaTreino === 'clube' ? '[Clube]' : ''}</span>
                    </div>
                    <div style={{ fontSize: '11px' }}>Tiros: {sessao.tirosDeclarados}</div>
                  </div>

                  {/* Laudo V1 Box */}
                  <div style={{ backgroundColor: isDarkMode ? '#2c3e50' : '#eaf2f8', borderLeft: `3px solid #3498db`, padding: '8px', borderRadius: '4px' }}>
                     <div style={{ textAlign: 'center', color: parseFloat(sessao.precisaoScore) > 70 ? '#f39c12' : '#e74c3c', fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}>
                        Score de Precisão: {sessao.precisaoScore}%
                     </div>
                     <div style={{ fontSize: '10px', textAlign: 'center', color: theme.textMain, lineHeight: '1.3' }}>
                        <strong>Laudo Técnico:</strong> {(sessao.diagnosticos && sessao.diagnosticos.length > 0) ? sessao.diagnosticos.join(' ') : (sessao.diagnostico || 'Agrupamento consistente.')}
                     </div>
                     
                     {/* AVISO DE PANE (Se houver) */}
                     {sessao.houvePane && (
                       <div style={{ marginTop: '8px', padding: '6px', backgroundColor: '#fdedec', border: '1px solid #e74c3c', borderRadius: '4px', textAlign: 'left', color: '#c0392b', fontSize: '10px' }}>
                         <strong>⚠️ PANE NO ARMAMENTO:</strong> {sessao.descPane || 'Não detalhada'}<br/>
                         {sessao.resolucaoPane && <span><strong>Resolução:</strong> {sessao.resolucaoPane}</span>}
                       </div>
                     )}

                     {!modoComparacao && (
                        <div 
                           onClick={() => setSessaoExpandida(sessaoExpandida === sessao.id ? null : sessao.id)}
                           style={{fontSize: '9px', color: theme.textSec, textAlign: 'center', marginTop: '6px', cursor: 'pointer'}}
                        >
                           {sessaoExpandida === sessao.id ? '▲ Ocultar Alvo' : '▼ Ver Alvo e Opções'}
                        </div>
                     )}
                  </div>
                  
                  {/* Expanded View */}
                  {sessaoExpandida === sessao.id && !modoComparacao && (
                    <div style={{marginTop: '10px', paddingTop: '10px', borderTop: `1px dashed ${theme.borderColor}`}}>
                      <RenderizarAlvo imagem={sessao.imagemOriginal} marcacoes={sessao.marcacoesSalvas} />
                      <div style={{display: 'flex', gap: '6px', marginTop: '10px'}}>
                        <button onClick={(e) => { e.stopPropagation(); editarSessao(sessao); }} style={{...styles.button, backgroundColor: '#f39c12', flex: 1, padding: '6px', fontSize: '12px'}}>✏️ Editar</button>
                        <button onClick={(e) => { e.stopPropagation(); setHistoricoSessoes(historicoSessoes.filter((s:any) => s.id !== sessao.id)); }} style={{...styles.button, backgroundColor: '#e74c3c', flex: 1, padding: '6px', fontSize: '12px'}}>🗑️ Apagar</button>
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
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: '4px', marginBottom: '10px'}}>
              <h3 style={{margin: 0, fontSize: '14px'}}>Documento do Atirador</h3>
              <button onClick={() => setEditandoPerfil(!editandoPerfil)} style={{...styles.btnAcao, fontSize: '12px', color: '#2980b9'}}>✏️ Editar</button>
            </div>
            {editandoPerfil ? (
              <div style={{marginTop: '6px'}}>
                <label style={{fontSize: '11px', fontWeight: 'bold', color: theme.textSec}}>Nome Completo:</label>
                <input style={styles.input} value={perfil.nome} onChange={e => setPerfil({...perfil, nome: e.target.value})} />
                <label style={{fontSize: '11px', fontWeight: 'bold', color: theme.textSec}}>Número do CR:</label>
                <input style={styles.input} value={perfil.cr} onChange={e => setPerfil({...perfil, cr: e.target.value})} />
                <label style={{fontSize: '11px', fontWeight: 'bold', color: theme.textSec}}>Validade do CR:</label>
                <input type="date" style={styles.input} value={perfil.validadeCr} onChange={e => setPerfil({...perfil, validadeCr: e.target.value})} />
                <label style={{fontSize: '11px', fontWeight: 'bold', color: theme.textSec}}>Clube Afiliado:</label>
                <input style={styles.input} placeholder="Nome do Clube" value={perfil.clubeAfiliado} onChange={e => setPerfil({...perfil, clubeAfiliado: e.target.value})} />
                <button onClick={() => setEditandoPerfil(false)} style={styles.button}>Salvar Perfil</button>
              </div>
            ) : (
              <div style={{backgroundColor: theme.cardRelatorioBg, padding: '10px', borderRadius: '6px', fontSize: '12px'}}>
                <p style={{margin: '0 0 4px 0'}}><strong>Nome:</strong> {perfil.nome}</p>
                <p style={{margin: '0 0 4px 0'}}><strong>CR nº:</strong> {perfil.cr || 'Não informado'}</p>
                <p style={{margin: '0 0 4px 0'}}><strong>Clube:</strong> {perfil.clubeAfiliado || 'Não informado'}</p>
                <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px'}}>
                  <strong>Validade:</strong> {formatarData(perfil.validadeCr) || 'Não informada'}
                  {perfil.validadeCr && (
                    <span style={{backgroundColor: verificarValidade(perfil.validadeCr).cor, color: 'white', padding: '2px 4px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold'}}>
                      {verificarValidade(perfil.validadeCr).texto}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="no-print" style={styles.card}>
            <h3 style={{marginTop: 0, marginBottom: '10px', borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: '4px', fontSize: '13px'}}>Gerar Relatório de Habitualidade</h3>
            <div style={{display: 'flex', gap: '6px', marginBottom: '8px'}}>
              <div style={{flex: 1}}><label style={{fontSize: '11px', fontWeight: 'bold', color: theme.textSec}}>Data Inicial:</label><input type="date" style={styles.input} value={filtroHabInicio} onChange={e => setFiltroHabInicio(e.target.value)} /></div>
              <div style={{flex: 1}}><label style={{fontSize: '11px', fontWeight: 'bold', color: theme.textSec}}>Data Final:</label><input type="date" style={styles.input} value={filtroHabFim} onChange={e => setFiltroHabFim(e.target.value)} /></div>
            </div>
            <button onClick={salvarPeriodoHabitualidade} style={{...styles.btnSecundario, marginBottom: '10px'}}>💾 Salvar este Período</button>
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
          
          <div className="no-print" style={{display: 'flex', gap: '6px', marginTop: '10px'}}>
            <button style={{...styles.button, backgroundColor: '#8e44ad', flex: 1, fontSize: '12px'}} onClick={() => window.print()}>🖨️ Imprimir PDF</button>
            <button style={{...styles.button, backgroundColor: '#27ae60', flex: 1, fontSize: '12px'}} onClick={exportarCSV}>📊 Exportar CSV</button>
          </div>
        </div>
      )}

      <div className="no-print" style={styles.navBar}>
        <button style={{flex: 1, border: 'none', background: 'none', color: telaAtual === 'arsenal' ? '#2980b9' : '#7f8c8d'}} onClick={() => setTelaAtual('arsenal')}>🔫 Acervo</button>
        <button style={{flex: 1, border: 'none', background: 'none', color: telaAtual === 'treino' ? '#2980b9' : '#7f8c8d'}} onClick={() => setTelaAtual('treino')}>🎯 Treino</button>
        <button style={{flex: 1, border: 'none', background: 'none', color: telaAtual === 'relatorios' ? '#2980b9' : '#7f8c8d'}} onClick={() => setTelaAtual('relatorios')}>📊 Logbook</button>
        <button style={{flex: 1, border: 'none', background: 'none', color: telaAtual === 'cac' ? '#2980b9' : '#7f8c8d'}} onClick={() => setTelaAtual('cac')}>👤 CAC</button>
      </div>
    </div>
  );
}