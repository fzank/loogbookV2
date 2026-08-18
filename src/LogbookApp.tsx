import React, { useState, useEffect } from 'react';

const ALVO_PADRAO: string = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e0e0e0'/%3E%3Ccircle cx='50' cy='50' r='45' fill='white' stroke='black' stroke-width='1'/%3E%3Ccircle cx='50' cy='50' r='35' fill='white' stroke='black' stroke-width='1'/%3E%3Ccircle cx='50' cy='50' r='25' fill='white' stroke='black' stroke-width='1'/%3E%3Ccircle cx='50' cy='50' r='15' fill='black'/%3E%3Ccircle cx='50' cy='50' r='5' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E";

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
  } catch (error) {
    return defaultData;
  }
};

const saveData = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error: any) {
    if (error.name === 'QuotaExceededError' || error.message.includes('QuotaExceeded')) {
      alert("⚠️ A memória local do seu navegador está cheia!");
    }
  }
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
      if (img.width > MAX_WIDTH) { scaleSize = MAX_WIDTH / img.width; }
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
  if (marcacoes.length === 0) return { precisao: "0", dispersao: 0, diagnostico: "Nenhum tiro no alvo." };
  const xMedio = marcacoes.reduce((acc: number, val: Marcacao) => acc + val.x, 0) / marcacoes.length;
  const yMedio = marcacoes.reduce((acc: number, val: Marcacao) => acc + val.y, 0) / marcacoes.length;
  const dispersao = marcacoes.reduce((acc: number, val: Marcacao) => acc + Math.sqrt(Math.pow(val.x - xMedio, 2) + Math.pow(val.y - yMedio, 2)), 0) / marcacoes.length;
  let pontuacaoTotal = 0;
  marcacoes.forEach((m: Marcacao) => {
    const distCentro = Math.sqrt(Math.pow(m.x - 0.5, 2) + Math.pow(m.y - 0.5, 2));
    pontuacaoTotal += Math.max(0, 100 - (distCentro / 0.5 * 100)); 
  });
  const precisaoScore = (pontuacaoTotal / marcacoes.length).toFixed(1);
  let diagnostico = "";
  if (marcacoes.length < 3 && dispersao > 0.10) diagnostico = "⚠️ Poucos tiros e distantes entre si. Não forma um agrupamento consistente.";
  else if (dispersao > 0.11) diagnostico = "⚠️ Dispersão Irregular. Tiros espalhados. Foque na empunhadura, visada igual e controle da respiração.";
  else {
    const distanciaCentroReal = Math.sqrt(Math.pow(xMedio - 0.5, 2) + Math.pow(yMedio - 0.5, 2));
    if (distanciaCentroReal <= 0.12) diagnostico = "✅ Excelente agrupamento! Fundamentos corretos.";
    else if (xMedio < 0.45 && yMedio > 0.55) diagnostico = "🚨 Gatilhada (Jerking) ou Over-gripping da mão forte. Puxe progressivamente.";
    else if (xMedio > 0.55 && yMedio > 0.55) diagnostico = "🚨 Quebrando o pulso ou pouca pressão na mão de apoio.";
    else if (xMedio > 0.55 && yMedio < 0.45) diagnostico = "🚨 Heeling (Antecipação). Empurrando a base da arma antes do tiro.";
    else if (xMedio < 0.45 && yMedio < 0.45) diagnostico = "🚨 Antecipação do recuo (Flinching). Abaixando a arma no disparo.";
    else if (Math.abs(xMedio - 0.5) < 0.15 && yMedio > 0.65) diagnostico = "🚨 Foco no alvo, não na massa de mira (Tiros baixos).";
    else if (xMedio < 0.35 && Math.abs(yMedio - 0.5) < 0.15) diagnostico = "🚨 Dedo pouco inserido no gatilho. Puxando arma para a esquerda.";
    else if (xMedio > 0.65 && Math.abs(yMedio - 0.5) < 0.15) diagnostico = "🚨 Dedo muito inserido no gatilho. Puxando arma para a direita.";
    else diagnostico = "⚠️ Agrupamento apertado, mas fora do centro. Verifique o ajuste da sua mira.";
  }
  return { precisao: precisaoScore, dispersao: dispersao, diagnostico };
};

interface RenderizarAlvoProps {
  imagem: string;
  marcacoes: Marcacao[];
  onTargetClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
}

const RenderizarAlvo: React.FC<RenderizarAlvoProps> = ({ imagem, marcacoes, onTargetClick }) => (
  <div style={{ position: 'relative', width: '100%', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
    <img src={imagem} alt="Alvo" onClick={onTargetClick} style={{ width: '100%', display: 'block', backgroundColor: '#fff', cursor: onTargetClick ? 'crosshair' : 'default' }} />
    {marcacoes.map((m: Marcacao, i: number) => (
      <div key={i} style={{ position: 'absolute', left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: '12px', height: '12px', backgroundColor: 'rgba(231,76,60,0.9)', border: '2px solid white', borderRadius: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />
    ))}
  </div>
);

// TIPAGEM CORRETA PARA O COMPONENTE RECEBER O LOGOUT
interface LogbookAppProps {
  usuarioLogout?: () => void;
}

export default function LogbookApp({ usuarioLogout }: LogbookAppProps) {
  const [telaAtual, setTelaAtual] = useState<string>('arsenal');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => loadData('logbook_darkmode', false));
  const [perfil, setPerfil] = useState(() => loadData('logbook_perfil', { nome: 'Fernando Evangelista', cr: '', validadeCr: '' }));
  const [armas, setArmas] = useState(() => loadData('logbook_armas', [{ id: 1, marca: 'Taurus', modelo: 'THc', calibre: '9mm', foto: null, dataCompra: '', orgao: 'Sigma', craf: '', validadeCraf: '', gt: '', validadeGt: '', dataUltimaLimpeza: '', historicoManutencao: [] }]));
  const [historicoSessoes, setHistoricoSessoes] = useState(() => loadData('logbook_sessoes', []));
  const [relatoriosHabSalvos, setRelatoriosHabSalvos] = useState(() => loadData('logbook_hab', []));

  useEffect(() => { saveData('logbook_darkmode', isDarkMode); }, [isDarkMode]);
  useEffect(() => { saveData('logbook_perfil', perfil); }, [perfil]);
  useEffect(() => { saveData('logbook_armas', armas); }, [armas]);
  useEffect(() => { saveData('logbook_sessoes', historicoSessoes); }, [historicoSessoes]);
  useEffect(() => { saveData('logbook_hab', relatoriosHabSalvos); }, [relatoriosHabSalvos]);

  const theme = {
    bg: isDarkMode ? '#121212' : '#f4f4f9',
    cardBg: isDarkMode ? '#1e1e1e' : '#ffffff',
    textMain: isDarkMode ? '#ecf0f1' : '#2c3e50',
    textSec: isDarkMode ? '#bdc3c7' : '#555',
    inputBg: isDarkMode ? '#2c3e50' : '#ffffff',
    inputText: isDarkMode ? '#ecf0f1' : '#000000',
    borderColor: isDarkMode ? '#34495e' : '#cccccc',
    navBg: isDarkMode ? '#1e1e1e' : '#ffffff',
    cardRelatorioBg: isDarkMode ? '#2c3e50' : '#f8f9fa',
    caixaDiagBg: isDarkMode ? '#34495e' : '#e8f4f8',
    itemBorder: isDarkMode ? '#333' : '#eee',
    caixaDiagText: isDarkMode ? '#ecf0f1' : '#2c3e50' 
  };
  
  const [editandoPerfil, setEditandoPerfil] = useState<boolean>(false);
  const [filtroHabInicio, setFiltroHabInicio] = useState<string>('');
  const [filtroHabFim, setFiltroHabFim] = useState<string>('');
  const [novaArma, setNovaArma] = useState<any>({ marca: '', modelo: '', calibre: '9mm', foto: null, dataCompra: '', orgao: 'Sigma', craf: '', validadeCraf: '', gt: '', validadeGt: '', dataUltimaLimpeza: '', historicoManutencao: [] });
  const [armaEmEdicao, setArmaEmEdicao] = useState<number | null>(null);
  const [armaExpandida, setArmaExpandida] = useState<number | null>(null); 
  const [mostrarCamposAvancados, setMostrarCamposAvancados] = useState<boolean>(false);
  const [dataNovaManutencao, setDataNovaManutencao] = useState<string>(obterDataHoje());
  const [descNovaManutencao, setDescNovaManutencao] = useState<string>('');
  const [sessaoEmEdicaoId, setSessaoEmEdicaoId] = useState<number | null>(null);
  const [dataTreino, setDataTreino] = useState<string>(obterDataHoje());
  const [horaTreino, setHoraTreino] = useState<string>(obterHoraAtual());
  const [armaSelecionada, setArmaSelecionada] = useState<string>('');
  const [qtdTiros, setQtdTiros] = useState<string>('');
  const [tipoMunicao, setTipoMunicao] = useState<string>('Original');
  const [ehHabitualidade, setEhHabitualidade] = useState<boolean>(true);
  const [imagemAlvo, setImagemAlvo] = useState<string>(ALVO_PADRAO);
  const [marcacoes, setMarcacoes] = useState<Marcacao[]>([]);
  const [sessaoExpandida, setSessaoExpandida] = useState<number | null>(null);
  const [filtroArma, setFiltroArma] = useState<string>('');
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
  const [filtroDataFim, setFiltroDataFim] = useState<string>('');
  const [modoComparacao, setModoComparacao] = useState<boolean>(false);
  const [sessoesParaComparar, setSessoesParaComparar] = useState<any[]>([]);

  const lidarComFotoArma = (e: React.ChangeEvent<HTMLInputElement>) => { 
    const file = e.target.files?.[0]; 
    if(file) { comprimirImagem(file, (imagemBase64: string) => { setNovaArma({...novaArma, foto: imagemBase64}); }); }
  };

  const salvarArma = (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (!novaArma.marca || !novaArma.modelo) return;
    if (armaEmEdicao) {
      setArmas(armas.map((a: any) => a.id === armaEmEdicao ? { ...novaArma, id: armaEmEdicao } : a));
      setArmaEmEdicao(null);
    } else {
      setArmas([...armas, { ...novaArma, id: Date.now() }]); 
    }
    setNovaArma({ marca: '', modelo: '', calibre: '9mm', foto: null, dataCompra: '', orgao: 'Sigma', craf: '', validadeCraf: '', gt: '', validadeGt: '', dataUltimaLimpeza: '', historicoManutencao: [] });
    setMostrarCamposAvancados(false);
  };
  
  const editarArma = (arma: any) => { setNovaArma(arma); setArmaEmEdicao(arma.id); setMostrarCamposAvancados(true); };
  const excluirArma = (id: number) => { if (window.confirm("Apagar arma do acervo?")) setArmas(armas.filter((a: any) => a.id !== id)); };

  const registrarLimpezaHoje = (idArma: number) => { setArmas(armas.map((a: any) => a.id === idArma ? { ...a, dataUltimaLimpeza: obterDataHoje() } : a)); };
  const atualizarDataLimpeza = (idArma: number, novaData: string) => { setArmas(armas.map((a: any) => a.id === idArma ? { ...a, dataUltimaLimpeza: novaData } : a)); };
  const adicionarManutencao = (idArma: number) => {
    if(!descNovaManutencao) return;
    setArmas(armas.map((a: any) => {
      if (a.id === idArma) return { ...a, historicoManutencao: [{ id: Date.now(), data: dataNovaManutencao, descricao: descNovaManutencao }, ...a.historicoManutencao] };
      return a;
    }));
    setDescNovaManutencao('');
  };
  const removerManutencao = (idArma: number, idManutencao: number) => { setArmas(armas.map((a: any) => a.id === idArma ? { ...a, historicoManutencao: a.historicoManutencao.filter((m: any) => m.id !== idManutencao) } : a)); };

  const lidarComUploadAlvo = (e: React.ChangeEvent<HTMLInputElement>) => { 
    const file = e.target.files?.[0]; 
    if(file){ comprimirImagem(file, (imagemBase64: string) => { setImagemAlvo(imagemBase64); }); } 
    else { setImagemAlvo(ALVO_PADRAO); }
    setMarcacoes([]); 
  };

  const marcarTiro = (e: React.MouseEvent<HTMLImageElement>) => { 
    if (!qtdTiros || marcacoes.length >= parseInt(qtdTiros)) return alert(`Limite atingido.`);
    const rect = e.currentTarget.getBoundingClientRect(); 
    setMarcacoes([...marcacoes, { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }]); 
  };

  const finalizarSessao = () => {
    if (!armaSelecionada || !qtdTiros) return alert("Selecione arma e quantidade de tiros.");
    const armaUsada = armas.find((a: any) => a.id.toString() === armaSelecionada);
    if (!armaUsada) return;

    const metricas = avaliarMetricasTiro(marcacoes);
    const taxaPapel = qtdTiros ? parseFloat(((marcacoes.length / parseInt(qtdTiros)) * 100).toFixed(0)) : 0;

    const novaSessao = {
      id: sessaoEmEdicaoId ? sessaoEmEdicaoId : Date.now(), 
      data: dataTreino, hora: horaTreino, armaId: armaUsada.id, 
      armaNome: `${armaUsada.marca} ${armaUsada.modelo}`, calibre: armaUsada.calibre,
      tirosDeclarados: qtdTiros, tirosNoAlvo: marcacoes.length, municao: tipoMunicao, habitualidade: ehHabitualidade,
      taxaPapel: taxaPapel, precisaoScore: metricas.precisao, dispersaoIndex: metricas.dispersao, 
      diagnostico: metricas.diagnostico, imagemOriginal: imagemAlvo, marcacoesSalvas: marcacoes
    };

    if (sessaoEmEdicaoId) setHistoricoSessoes(historicoSessoes.map((s: any) => s.id === sessaoEmEdicaoId ? novaSessao : s));
    else setHistoricoSessoes([novaSessao, ...historicoSessoes]);

    limparFormularioTreino();
    setTelaAtual('relatorios');
  };

  const limparFormularioTreino = () => {
    setDataTreino(obterDataHoje()); setHoraTreino(obterHoraAtual()); setArmaSelecionada('');
    setQtdTiros(''); setTipoMunicao('Original'); setEhHabitualidade(true);
    setMarcacoes([]); setImagemAlvo(ALVO_PADRAO); setSessaoEmEdicaoId(null);
  };

  const editarSessao = (sessao: any) => {
    setDataTreino(sessao.data); setHoraTreino(sessao.hora || obterHoraAtual());
    setArmaSelecionada(sessao.armaId.toString()); setQtdTiros(sessao.tirosDeclarados.toString());
    setTipoMunicao(sessao.municao || 'Original'); setEhHabitualidade(sessao.habitualidade);
    setImagemAlvo(sessao.imagemOriginal); setMarcacoes(sessao.marcacoesSalvas || []);
    setSessaoEmEdicaoId(sessao.id); setSessaoExpandida(null); setTelaAtual('treino'); 
  };

  const excluirSessao = (id: number) => {
    if (window.confirm("Apagar treino?")) setHistoricoSessoes(historicoSessoes.filter((s: any) => s.id !== id));
  };

  const sessoesFiltradas = historicoSessoes.filter((sessao: any) => {
    if (filtroArma && sessao.armaId.toString() !== filtroArma) return false;
    if (filtroDataInicio && sessao.data < filtroDataInicio) return false;
    if (filtroDataFim && sessao.data > filtroDataFim) return false;
    return true;
  });

  const toggleComparacao = (sessao: any) => {
    if (sessoesParaComparar.find((s: any) => s.id === sessao.id)) setSessoesParaComparar(sessoesParaComparar.filter((s: any) => s.id !== sessao.id));
    else {
      if (sessoesParaComparar.length < 2) setSessoesParaComparar([...sessoesParaComparar, sessao]);
      else alert("Selecione apenas 2 sessões.");
    }
  };

  const calcularEvolucao = () => {
    if (sessoesParaComparar.length !== 2) return null;
    const ordenadas = [...sessoesParaComparar].sort((a: any, b: any) => new Date(`${a.data}T${a.hora || '00:00'}`).getTime() - new Date(`${b.data}T${b.hora || '00:00'}`).getTime());
    const sessaoAntiga = ordenadas[0]; const sessaoNova = ordenadas[1];
    const diffPrecisao = (Number(sessaoNova.precisaoScore) - Number(sessaoAntiga.precisaoScore)).toFixed(1);
    const diffDispersao = (sessaoAntiga.dispersaoIndex - sessaoNova.dispersaoIndex);
    
    if (Number(diffPrecisao) > 3 || diffDispersao > 0.05) return (<div style={{...styles.caixaEvolucao, backgroundColor: '#d4edda', color: '#155724', borderColor: '#c3e6cb'}}>📈 <strong>Evolução Real!</strong> Score subiu em {diffPrecisao}%.</div>);
    if (Number(diffPrecisao) < -3 || diffDispersao < -0.05) return (<div style={{...styles.caixaEvolucao, backgroundColor: '#f8d7da', color: '#721c24', borderColor: '#f5c6cb'}}>📉 <strong>Regressão detectada:</strong> Score caiu {Math.abs(Number(diffPrecisao))}%.</div>);
    return <div style={{...styles.caixaEvolucao, backgroundColor: '#e2e3e5', color: '#383d41', borderColor: '#d6d8db'}}>⚖️ <strong>Desempenho Mantido</strong></div>;
  };

  const sessoesHabitualidade = historicoSessoes.filter((s: any) => {
    if (!s.habitualidade) return false;
    if (filtroHabInicio && s.data < filtroHabInicio) return false;
    if (filtroHabFim && s.data > filtroHabFim) return false;
    return true;
  });

  const salvarPeriodoHabitualidade = () => {
    if (!filtroHabInicio || !filtroHabFim) return alert("Defina a Data Inicial e Final.");
    setRelatoriosHabSalvos([{ id: Date.now(), inicio: filtroHabInicio, fim: filtroHabFim, criacao: obterDataHoje() }, ...relatoriosHabSalvos]);
    alert("Período salvo com sucesso!");
  };

  const exportarCSV = () => {
    let csvContent = "\uFEFFData;Hora;Arma;Calibre;Munição;Tiros;Score Precisão\n";
    sessoesHabitualidade.forEach((s: any) => { csvContent += `${formatarData(s.data)};${s.hora};${s.armaNome};${s.calibre};${s.municao};${s.tirosDeclarados};${s.precisaoScore}%\n`; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Habitualidade_${obterDataHoje()}.csv`;
    link.click();
  };

  const styles: { [key: string]: React.CSSProperties } = {
    container: { fontFamily: 'system-ui, sans-serif', padding: '16px', paddingBottom: '80px', maxWidth: '400px', margin: '0 auto', backgroundColor: theme.bg, color: theme.textMain, minHeight: '100vh', position: 'relative' },
    header: { textAlign: 'center', color: theme.textMain, marginBottom: '20px' },
    card: { backgroundColor: theme.cardBg, padding: '16px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '20px', color: theme.textMain },
    cardTitle: { marginTop: 0, color: theme.textMain, marginBottom: '15px', borderBottom: `2px solid ${theme.borderColor}`, paddingBottom: '8px' },
    label: { display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold', color: theme.textSec },
    input: { width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', border: `1px solid ${theme.borderColor}`, boxSizing: 'border-box', backgroundColor: theme.inputBg, color: theme.inputText, fontSize: '14px' },
    button: { width: '100%', padding: '12px', backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
    btnSecundario: { width: '100%', padding: '10px', backgroundColor: theme.caixaDiagBg, color: theme.textMain, border: `1px solid ${theme.borderColor}`, borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
    list: { listStyleType: 'none', padding: 0, margin: 0 },
    listItem: { padding: '12px 0', borderBottom: `1px solid ${theme.itemBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    badge: { backgroundColor: '#34495e', color: 'white', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' },
    btnAcao: { background: 'none', border: 'none', cursor: 'pointer', margin: 0, padding: '5px' },
    alvoContainer: { backgroundColor: theme.cardRelatorioBg, padding: '10px', borderRadius: '8px', border: `1px solid ${theme.borderColor}` },
    contadorTiros: { fontSize: '14px', fontWeight: 'bold', color: theme.textMain },
    instrucao: { fontSize: '12px', color: theme.textSec, textAlign: 'center', marginBottom: '10px' },
    navBar: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '400px', display: 'flex', backgroundColor: theme.navBg, borderTop: `1px solid ${theme.borderColor}`, padding: '5px 0', boxShadow: '0 -2px 10px rgba(0,0,0,0.05)', zIndex: 10 },
    navBtn: { flex: 1, backgroundColor: 'transparent', border: 'none', padding: '10px 2px', fontSize: '13px', color: '#7f8c8d', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
    navBtnAtivo: { flex: 1, backgroundColor: 'transparent', border: 'none', padding: '10px 2px', fontSize: '13px', color: '#2980b9', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
    cardRelatorio: { backgroundColor: theme.cardRelatorioBg, borderRadius: '8px', padding: '12px', marginBottom: '15px', border: `1px solid ${theme.itemBorder}`, cursor: 'pointer' },
    caixaDiagnostico: { backgroundColor: theme.caixaDiagBg, color: theme.caixaDiagText, borderLeft: '4px solid #3498db', padding: '10px', borderRadius: '4px', fontSize: '13px', marginTop: '10px' },
    caixaEvolucao: { borderLeft: '4px solid', padding: '12px', borderRadius: '4px', fontSize: '14px', textAlign: 'center' }
  };

  return (
    <div style={styles.container} className="app-container">
      <style>
        {`
          :root { color-scheme: ${isDarkMode ? 'dark' : 'light'}; }
          body, html { background-color: ${theme.bg}; }

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
        <h2 style={{...styles.header, marginBottom: 0}}>🎯 Logbook de Tiro</h2>
        <button onClick={() => setIsDarkMode(!isDarkMode)} style={{position: 'absolute', right: 0, background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', padding: '5px'}}>
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>

      {telaAtual === 'arsenal' && (
        <div className="no-print">
          <form onSubmit={salvarArma} style={styles.card}>
            <h3 style={styles.cardTitle}>{armaEmEdicao ? 'Editar Arma' : 'Nova Arma'}</h3>
            <div style={{display: 'flex', gap: '10px'}}>
              <div style={{flex: 2}}><input style={styles.input} placeholder="Marca" value={novaArma.marca} onChange={e => setNovaArma({...novaArma, marca: e.target.value})} /></div>
              <div style={{flex: 2}}><input style={styles.input} placeholder="Modelo" value={novaArma.modelo} onChange={e => setNovaArma({...novaArma, modelo: e.target.value})} /></div>
            </div>
            <select style={styles.input} value={novaArma.calibre} onChange={e => setNovaArma({...novaArma, calibre: e.target.value})}>
              {CALIBRES_DISPONIVEIS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="button" onClick={() => setMostrarCamposAvancados(!mostrarCamposAvancados)} style={styles.btnSecundario}>
              {mostrarCamposAvancados ? 'Ocultar Documentação Legal' : '➕ Adicionar Dados de Registro'}
            </button>
            {mostrarCamposAvancados && (
              <div style={{backgroundColor: theme.cardRelatorioBg, padding: '10px', borderRadius: '8px', marginTop: '10px', border: `1px solid ${theme.borderColor}`}}>
                <label style={styles.label}>Foto do Equipamento:</label>
                <input type="file" accept="image/*" onChange={lidarComFotoArma} style={{marginBottom: '10px', color: theme.textMain}} />
                <div style={{display: 'flex', gap: '10px'}}>
                  <div style={{flex: 1}}><label style={styles.label}>Órgão:</label><select style={styles.input} value={novaArma.orgao} onChange={e => setNovaArma({...novaArma, orgao: e.target.value})}><option value="Sigma">Sigma</option><option value="Sinarm">Sinarm</option></select></div>
                  <div style={{flex: 1}}><label style={styles.label}>Data Compra:</label><input type="date" style={styles.input} value={novaArma.dataCompra} onChange={e => setNovaArma({...novaArma, dataCompra: e.target.value})} /></div>
                </div>
                <div style={{display: 'flex', gap: '10px'}}>
                  <div style={{flex: 1}}><label style={styles.label}>Nº CRAF:</label><input style={styles.input} value={novaArma.craf} onChange={e => setNovaArma({...novaArma, craf: e.target.value})} /></div>
                  <div style={{flex: 1}}><label style={styles.label}>Validade CRAF:</label><input type="date" style={styles.input} value={novaArma.validadeCraf} onChange={e => setNovaArma({...novaArma, validadeCraf: e.target.value})} /></div>
                </div>
                <div style={{display: 'flex', gap: '10px'}}>
                  <div style={{flex: 1}}><label style={styles.label}>Nº Guia de Tráfego:</label><input style={styles.input} value={novaArma.gt} onChange={e => setNovaArma({...novaArma, gt: e.target.value})} /></div>
                  <div style={{flex: 1}}><label style={styles.label}>Validade GT:</label><input type="date" style={styles.input} value={novaArma.validadeGt} onChange={e => setNovaArma({...novaArma, validadeGt: e.target.value})} /></div>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button type="submit" style={{...styles.button, flex: 2}}>{armaEmEdicao ? 'Atualizar Arma' : 'Salvar no Acervo'}</button>
              {armaEmEdicao && <button type="button" onClick={() => {setArmaEmEdicao(null); setMostrarCamposAvancados(false);}} style={{...styles.button, backgroundColor: '#95a5a6', flex: 1}}>Cancelar</button>}
            </div>
          </form>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Meu Acervo</h3>
            <ul style={styles.list}>
              {armas.map((a: any) => {
                const sessoesDaArma = historicoSessoes.filter((s: any) => s.armaId === a.id);
                const disparosOriginal = sessoesDaArma.filter((s: any) => s.municao === 'Original').reduce((acc: number, s: any) => acc + parseInt(s.tirosDeclarados), 0);
                const disparosRecarregada = sessoesDaArma.filter((s: any) => s.municao === 'Recarregada').reduce((acc: number, s: any) => acc + parseInt(s.tirosDeclarados), 0);
                const disparosDryFire = sessoesDaArma.filter((s: any) => s.municao === 'Dry Fire').reduce((acc: number, s: any) => acc + parseInt(s.tirosDeclarados), 0);
                const disparosTotais = disparosOriginal + disparosRecarregada + disparosDryFire;
                const statusCraf = verificarValidade(a.validadeCraf);
                const statusGt = verificarValidade(a.validadeGt);

                return (
                  <li key={a.id} style={{...styles.listItem, flexDirection: 'column', alignItems: 'flex-start', border: `1px solid ${theme.itemBorder}`, padding: '10px', borderRadius: '8px', marginBottom: '10px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', cursor: 'pointer'}} onClick={() => setArmaExpandida(armaExpandida === a.id ? null : a.id)}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        {a.foto && <img src={a.foto} alt="Arma" style={{width: '45px', height: '45px', borderRadius: '4px', objectFit: 'cover'}} />}
                        <div>
                          <strong style={{ display: 'block' }}>{a.marca} {a.modelo}</strong>
                          <div style={{display: 'flex', gap: '5px', marginTop: '4px'}}>
                            <span style={styles.badge}>{a.calibre}</span>
                            <span style={{...styles.badge, backgroundColor: '#8e44ad'}}>🎯 {disparosTotais} tiros</span>
                          </div>
                        </div>
                      </div>
                      <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <button type="button" onClick={() => editarArma(a)} style={styles.btnAcao}>✏️</button>
                        <button type="button" onClick={() => excluirArma(a.id)} style={styles.btnAcao}>🗑️</button>
                      </div>
                    </div>
                    <div style={{width: '100%', fontSize: '11px', backgroundColor: theme.cardRelatorioBg, padding: '6px 10px', borderRadius: '4px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', boxSizing: 'border-box'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}>
                        <span><strong>CRAF:</strong> {a.craf || 'Não inf.'}</span>
                        {a.validadeCraf && <span style={{color: statusCraf.cor, fontWeight: 'bold'}}>● {statusCraf.texto}</span>}
                      </div>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}>
                        <span><strong>GT:</strong> {a.gt || 'Não inf.'}</span>
                        {a.validadeGt && <span style={{color: statusGt.cor, fontWeight: 'bold'}}>● {statusGt.texto}</span>}
                      </div>
                    </div>
                    {armaExpandida === a.id && (
                      <div style={{width: '100%', marginTop: '15px', borderTop: `1px dashed ${theme.borderColor}`, paddingTop: '10px'}}>
                        <h4 style={{fontSize: '13px', margin: '0 0 10px 0', color: theme.textMain}}>📊 Consumo de Munição</h4>
                        <div style={{display: 'flex', gap: '5px', marginBottom: '15px', fontSize: '11px'}}>
                          <span style={{backgroundColor: '#e8f4f8', color: '#2c3e50', padding: '4px 8px', borderRadius: '4px', border: '1px solid #3498db'}}>Orig.: {disparosOriginal}</span>
                          <span style={{backgroundColor: '#fef5e7', color: '#2c3e50', padding: '4px 8px', borderRadius: '4px', border: '1px solid #f39c12'}}>Recarg.: {disparosRecarregada}</span>
                          <span style={{backgroundColor: '#f9ebea', color: '#2c3e50', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e74c3c'}}>Dry Fire: {disparosDryFire}</span>
                        </div>
                        <h4 style={{fontSize: '13px', margin: '0 0 10px 0', color: theme.textMain}}>🛠️ Controle de Manutenção</h4>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.caixaDiagBg, padding: '8px', borderRadius: '4px', fontSize: '12px', marginBottom: '10px'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                            <strong style={{color: theme.caixaDiagText}}>Limpeza:</strong>
                            <input type="date" style={{...styles.input, padding: '4px 6px', marginBottom: 0, width: 'auto', fontSize: '12px'}} value={a.dataUltimaLimpeza || ''} onChange={e => atualizarDataLimpeza(a.id, e.target.value)} />
                          </div>
                          <button onClick={() => registrarLimpezaHoje(a.id)} style={{...styles.btnSecundario, padding: '4px 8px', width: 'auto', fontSize: '11px'}}>Limpei Hoje</button>
                        </div>
                        <div style={{display: 'flex', gap: '5px', marginBottom: '10px'}}>
                          <input type="date" style={{...styles.input, marginBottom: 0, padding: '6px', fontSize: '12px', flex: 1}} value={dataNovaManutencao} onChange={e => setDataNovaManutencao(e.target.value)} />
                          <input style={{...styles.input, marginBottom: 0, padding: '6px', fontSize: '12px', flex: 2}} placeholder="Ex: Troca de mola" value={descNovaManutencao} onChange={e => setDescNovaManutencao(e.target.value)} />
                          <button onClick={() => adicionarManutencao(a.id)} style={{...styles.button, marginTop: 0, padding: '6px 10px', width: 'auto', fontSize: '12px'}}>Add</button>
                        </div>
                        {a.historicoManutencao.length > 0 && (
                          <ul style={{listStyle: 'none', padding: 0, margin: 0, fontSize: '12px'}}>
                            {a.historicoManutencao.map((man: any) => (
                              <li key={man.id} style={{display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${theme.itemBorder}`, padding: '4px 0'}}>
                                <span><strong>{formatarData(man.data)}:</strong> {man.descricao}</span>
                                <button onClick={() => removerManutencao(a.id, man.id)} style={{background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer'}}>x</button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {telaAtual === 'treino' && (
        <div className="no-print" style={styles.card}>
          <h3 style={styles.cardTitle}>{sessaoEmEdicaoId ? 'Editar Treino Salvo' : 'Registrar Sessão'}</h3>
          {sessaoEmEdicaoId && (
            <div style={{backgroundColor: '#fff3cd', color: '#856404', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '13px', border: '1px solid #ffeeba'}}>
              <strong>Atenção:</strong> Você está editando um treino antigo. Modifique os dados e clique em "Atualizar Treino" no final.
            </div>
          )}
          <div style={{display: 'flex', gap: '10px'}}>
            <div style={{flex: 2}}><label style={styles.label}>Data:</label><input type="date" style={styles.input} value={dataTreino} onChange={(e) => setDataTreino(e.target.value)} /></div>
            <div style={{flex: 1}}><label style={styles.label}>Hora:</label><input type="time" style={styles.input} value={horaTreino} onChange={(e) => setHoraTreino(e.target.value)} /></div>
          </div>
          <label style={styles.label}>Arma Utilizada:</label>
          <select style={styles.input} value={armaSelecionada} onChange={(e) => setArmaSelecionada(e.target.value)}>
            <option value="">Selecione...</option>
            {armas.map((a: any) => <option key={a.id} value={a.id}>{a.marca} {a.modelo}</option>)}
          </select>
          <div style={{display: 'flex', gap: '10px'}}>
            <div style={{flex: 1}}><label style={styles.label}>Qtd Disparos:</label><input type="number" style={styles.input} value={qtdTiros} onChange={(e) => setQtdTiros(e.target.value)} /></div>
            <div style={{flex: 1}}><label style={styles.label}>Munição:</label><select style={styles.input} value={tipoMunicao} onChange={(e) => setTipoMunicao(e.target.value)}><option value="Original">Original</option><option value="Recarregada">Recarregada</option><option value="Dry Fire">Dry Fire</option></select></div>
          </div>
          <label style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', backgroundColor: theme.caixaDiagBg, padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', color: theme.caixaDiagText}}>
            <input type="checkbox" checked={ehHabitualidade} onChange={e => setEhHabitualidade(e.target.checked)} style={{transform: 'scale(1.3)'}} />
            Habitualidade Oficial
          </label>
          <label style={styles.label}>Foto do Alvo:</label>
          <input type="file" accept="image/*" onChange={lidarComUploadAlvo} style={{marginBottom: '15px', color: theme.textMain}} />
          <div style={styles.alvoContainer}>
            <p style={styles.instrucao}>Toque na imagem para marcar acertos (Max: {qtdTiros || '0'})</p>
            <RenderizarAlvo imagem={imagemAlvo} marcacoes={marcacoes} onTargetClick={marcarTiro} />
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px'}}>
              <span style={styles.contadorTiros}>Impactos: {marcacoes.length} / {qtdTiros || 0}</span>
              {marcacoes.length > 0 && <button type="button" onClick={() => setMarcacoes(marcacoes.slice(0,-1))} style={{...styles.btnAcao, color: '#e74c3c', fontSize: '14px', fontWeight: 'bold'}}>Desfazer Último</button>}
            </div>
          </div>
          <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
            <button onClick={finalizarSessao} style={{...styles.button, backgroundColor: '#27ae60', flex: 2}}>
              {sessaoEmEdicaoId ? 'Atualizar Treino' : 'Finalizar Treino'}
            </button>
            {sessaoEmEdicaoId && <button onClick={cancelarEdicaoSessao} style={{...styles.button, backgroundColor: '#95a5a6', flex: 1}}>Cancelar</button>}
          </div>
        </div>
      )}

      {telaAtual === 'relatorios' && (
        <div className="no-print">
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Filtros e Análise</h3>
            <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
              <div style={{flex: 1}}><label style={styles.label}>De:</label><input type="date" style={styles.input} value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} /></div>
              <div style={{flex: 1}}><label style={styles.label}>Até:</label><input type="date" style={styles.input} value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} /></div>
            </div>
            <select style={styles.input} value={filtroArma} onChange={e => setFiltroArma(e.target.value)}>
              <option value="">Todas as armas</option>
              {armas.map((a: any) => <option key={a.id} value={a.id}>{a.marca} {a.modelo}</option>)}
            </select>
            <button onClick={() => { setModoComparacao(!modoComparacao); setSessoesParaComparar([]); }} style={{...styles.button, backgroundColor: modoComparacao ? '#e74c3c' : '#8e44ad', marginTop: 0}}>
              {modoComparacao ? 'Cancelar Comparação' : '⚖️ Comparar Períodos'}
            </button>
          </div>

          {modoComparacao && sessoesParaComparar.length === 2 && (
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Evolução / Comparativo</h3>
              <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
                {sessoesParaComparar.map((sessaoComp: any, i: number) => (
                  <div key={i} style={{flex: 1, backgroundColor: theme.cardRelatorioBg, padding: '10px', borderRadius: '8px', border: `1px solid ${theme.borderColor}`}}>
                    <div style={{fontSize: '12px', fontWeight: 'bold', marginBottom: '2px', textAlign: 'center'}}>{formatarData(sessaoComp.data)}</div>
                    <div style={{fontSize: '10px', color: theme.textSec, textAlign: 'center', marginBottom: '5px'}}>{sessaoComp.hora}</div>
                    <div style={{fontSize: '11px', textAlign: 'center', marginBottom: '10px'}}>{sessaoComp.armaNome}</div>
                    <RenderizarAlvo imagem={sessaoComp.imagemOriginal} marcacoes={sessaoComp.marcacoesSalvas} />
                    <div style={{fontSize: '12px', marginTop: '10px', textAlign: 'center', backgroundColor: theme.caixaDiagBg, color: theme.caixaDiagText, padding: '5px', borderRadius: '4px'}}>
                      <strong>Score:</strong> {sessaoComp.precisaoScore}%
                    </div>
                  </div>
                ))}
              </div>
              {calcularEvolucao()}
            </div>
          )}

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Sessões Salvas {modoComparacao && '(Selecione 2)'}</h3>
            {sessoesFiltradas.length === 0 ? <p>Nenhum treino encontrado.</p> : (
              sessoesFiltradas.map((sessao: any) => (
                <div 
                  key={sessao.id} 
                  style={{...styles.cardRelatorio, border: (modoComparacao && sessoesParaComparar.find((s: any) => s.id === sessao.id)) ? '2px solid #8e44ad' : `1px solid ${theme.itemBorder}`, cursor: 'pointer'}}
                  onClick={() => {
                    if(modoComparacao) toggleComparacao(sessao);
                    else setSessaoExpandida(sessaoExpandida === sessao.id ? null : sessao.id);
                  }}
                >
                  <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${theme.itemBorder}`, paddingBottom: '8px', marginBottom: '8px'}}>
                    <div>
                      <strong>{formatarData(sessao.data)}</strong> <span style={{fontSize: '12px', color: theme.textSec}}>às {sessao.hora}</span>
                    </div>
                    {sessao.habitualidade && <span style={{backgroundColor: '#f39c12', color: 'white', fontSize: '10px', padding: '3px 6px', borderRadius: '4px', fontWeight: 'bold'}}>Habitualidade</span>}
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '10px'}}>
                    <span><strong>{sessao.armaNome}</strong> <span style={{fontSize: '11px', color: theme.textSec}}>({sessao.municao})</span></span>
                    <span>Tiros: {sessao.tirosDeclarados}</span>
                  </div>
                  <div style={styles.caixaDiagnostico}>
                    <div style={{marginBottom: '5px'}}>
                       <strong style={{color: Number(sessao.precisaoScore) > 80 ? '#27ae60' : (Number(sessao.precisaoScore) < 50 ? '#e74c3c' : '#f39c12')}}>
                          Score de Precisão: {sessao.precisaoScore}%
                       </strong>
                    </div>
                    <strong>Laudo Técnico:</strong> {sessao.diagnostico}
                  </div>

                  {(!modoComparacao && sessaoExpandida === sessao.id) && (
                    <div style={{marginTop: '15px', paddingTop: '15px', borderTop: `1px dashed ${theme.borderColor}`}}>
                      <strong style={{display: 'block', marginBottom: '10px', fontSize: '13px'}}>Alvo Registrado:</strong>
                      <RenderizarAlvo imagem={sessao.imagemOriginal} marcacoes={sessao.marcacoesSalvas} />
                      <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
                        <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); editarSessao(sessao); }} style={{...styles.btnSecundario, flex: 1}}>✏️ Editar</button>
                        <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); excluirSessao(sessao.id); }} style={{...styles.button, backgroundColor: '#e74c3c', flex: 1, padding: '10px', marginTop: 0}}>🗑️ Apagar</button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {telaAtual === 'cac' && (
        <div>
          <div className="no-print" style={styles.card}>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <h3 style={styles.cardTitle}>Documento do Atirador</h3>
              <button onClick={() => setEditandoPerfil(!editandoPerfil)} style={{...styles.btnAcao, fontSize: '14px', color: '#2980b9'}}>✏️ Editar</button>
            </div>
            {editandoPerfil ? (
              <div style={{marginTop: '10px'}}>
                <label style={styles.label}>Nome Completo:</label>
                <input style={styles.input} value={perfil.nome} onChange={e => setPerfil({...perfil, nome: e.target.value})} />
                <label style={styles.label}>Número do CR:</label>
                <input style={styles.input} value={perfil.cr} onChange={e => setPerfil({...perfil, cr: e.target.value})} />
                <label style={styles.label}>Validade do CR:</label>
                <input type="date" style={styles.input} value={perfil.validadeCr} onChange={e => setPerfil({...perfil, validadeCr: e.target.value})} />
                <button onClick={() => setEditandoPerfil(false)} style={styles.button}>Salvar Perfil</button>
              </div>
            ) : (
              <div style={{backgroundColor: theme.cardRelatorioBg, padding: '15px', borderRadius: '8px'}}>
                <p style={{margin: '0 0 5px 0'}}><strong>Nome:</strong> {perfil.nome}</p>
                <p style={{margin: '0 0 5px 0'}}><strong>CR nº:</strong> {perfil.cr || 'Não informado'}</p>
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
            <h3 style={styles.cardTitle}>Gerar Relatório de Habitualidade</h3>
            <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
              <div style={{flex: 1}}><label style={styles.label}>Data Inicial:</label><input type="date" style={styles.input} value={filtroHabInicio} onChange={e => setFiltroHabInicio(e.target.value)} /></div>
              <div style={{flex: 1}}><label style={styles.label}>Data Final:</label><input type="date" style={styles.input} value={filtroHabFim} onChange={e => setFiltroHabFim(e.target.value)} /></div>
            </div>
            <button onClick={salvarPeriodoHabitualidade} style={{...styles.btnSecundario, marginBottom: '15px'}}>💾 Salvar este Período no Histórico</button>

            {relatoriosHabSalvos.length > 0 && (
              <div style={{backgroundColor: theme.caixaDiagBg, padding: '10px', borderRadius: '8px', marginBottom: '15px'}}>
                <h4 style={{margin: '0 0 10px 0', fontSize: '12px', color: theme.caixaDiagText}}>📂 Relatórios Antigos Salvos</h4>
                {relatoriosHabSalvos.map((rel: any) => (
                  <div key={rel.id} onClick={() => carregarRelatorioSalvo(rel)} style={{display: 'flex', justifyContent: 'space-between', padding: '6px', borderBottom: `1px solid ${theme.borderColor}`, cursor: 'pointer', fontSize: '12px'}}>
                    <span><strong>{formatarData(rel.inicio)}</strong> até <strong>{formatarData(rel.fim)}</strong></span>
                    <span style={{color: theme.textSec}}>Gerado em: {formatarData(rel.criacao)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="relatorio-oficial" style={{border: '2px solid #2c3e50', padding: '20px', borderRadius: '8px', backgroundColor: 'white', color: 'black'}}>
            <h4 style={{textAlign: 'center', margin: '0 0 15px 0', textTransform: 'uppercase', fontSize: '16px', color: 'black'}}>Comprovação de Treinamento</h4>
            <p style={{fontSize: '12px', marginBottom: '15px', lineHeight: '1.5', color: 'black'}}>
              Declaro para os devidos fins que o atirador desportivo <strong>{perfil.nome}</strong> (CR: {perfil.cr}), 
              realizou as seguintes práticas de tiro desportivo
              {filtroHabInicio && filtroHabFim ? ` no período de ${formatarData(filtroHabInicio)} a ${formatarData(filtroHabFim)}` : ''}:
            </p>
            <table style={{width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginBottom: '30px', tableLayout: 'fixed', color: 'black'}}>
              <thead>
                <tr style={{backgroundColor: '#eee'}}>
                  <th style={{border: '1px solid #ccc', padding: '8px', textAlign: 'center', width: '25%', color: 'black'}}>Data</th>
                  <th style={{border: '1px solid #ccc', padding: '8px', textAlign: 'left', width: '50%', color: 'black'}}>Arma / Calibre</th>
                  <th style={{border: '1px solid #ccc', padding: '8px', textAlign: 'center', width: '25%', color: 'black'}}>Tiros Declarados</th>
                </tr>
              </thead>
              <tbody>
                {sessoesHabitualidade.length === 0 ? (
                  <tr><td colSpan={3} style={{border: '1px solid #ccc', padding: '8px', textAlign: 'center', color: 'black'}}>Nenhum treino registrado neste período.</td></tr>
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
            <p style={{textAlign: 'center', fontSize: '10px', marginTop: '5px', color: '#7f8c8d'}}>Gerado via App Logbook de Tiro em {formatarData(obterDataHoje())}</p>
          </div>
          
          <div className="no-print" style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
            <button style={{...styles.button, backgroundColor: '#8e44ad', flex: 1}} onClick={() => window.print()}>🖨️ Imprimir PDF</button>
            <button style={{...styles.button, backgroundColor: '#27ae60', flex: 1}} onClick={exportarCSV}>📊 Exportar CSV</button>
          </div>
        </div>
      )}

      <div className="no-print" style={styles.navBar}>
        <button style={telaAtual === 'arsenal' ? styles.navBtnAtivo : styles.navBtn} onClick={() => setTelaAtual('arsenal')}>🔫 Acervo</button>
        <button style={telaAtual === 'treino' ? styles.navBtnAtivo : styles.navBtn} onClick={() => setTelaAtual('treino')}>🎯 Treino</button>
        <button style={telaAtual === 'relatorios' ? styles.navBtnAtivo : styles.navBtn} onClick={() => setTelaAtual('relatorios')}>📊 Logbook</button>
        <button style={telaAtual === 'cac' ? styles.navBtnAtivo : styles.navBtn} onClick={() => setTelaAtual('cac')}>👤 CAC</button>
      </div>
    </div>
  );
}