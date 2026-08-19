import React, { useState, useEffect } from 'react';
import { auth, googleProvider } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  onAuthStateChanged, 
  signOut
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import LogbookApp from './LogbookApp';

export default function App() {
  const [usuario, setUsuario] = useState<User | any>(null);
  const [carregando, setCarregando] = useState(true);
  
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [modoCadastro, setModoCadastro] = useState(false);
  const [erro, setErro] = useState('');
  const [redeBloqueada, setRedeBloqueada] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => { if (carregando) { setRedeBloqueada(true); setCarregando(false); } }, 3000);
    try {
      const unsubscribe = onAuthStateChanged(auth, (user) => { setUsuario(user); setCarregando(false); clearTimeout(timer); });
      return unsubscribe;
    } catch (e) { setRedeBloqueada(true); setCarregando(false); }
  }, [carregando]);

  const lidarComAutenticacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    try {
      if (modoCadastro) await createUserWithEmailAndPassword(auth, email, senha);
      else await signInWithEmailAndPassword(auth, email, senha);
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential') setErro('E-mail ou senha incorretos.');
      else if (error.code === 'auth/email-already-in-use') setErro('Este e-mail já está cadastrado.');
      else setErro('Erro na autenticação. Verifique seus dados.');
    }
  };

  const loginComGoogle = async () => {
    setErro('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      setErro('Erro ao fazer login com o Google.');
    }
  };

  const fazerLogout = () => { 
    if (usuario?.uid === 'offline-dev') setUsuario(null);
    else signOut(auth);
  };

  const forcarLoginOffline = () => { setUsuario({ uid: 'offline-dev', email: 'dev@logbook.com' }); };

  if (carregando) return <div style={{textAlign: 'center', marginTop: '50px', fontFamily: 'system-ui', color: '#2c3e50'}}>Aguardando conexão com o servidor...</div>;

  if (usuario) {
    return (
      <>
        <button onClick={fazerLogout} style={{ position: 'fixed', top: '15px', left: '15px', zIndex: 1000, backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', fontWeight: 'bold', cursor: 'pointer' }}>Sair</button>
        <LogbookApp usuarioLogout={fazerLogout} />
      </>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '20px', maxWidth: '400px', margin: '50px auto', backgroundColor: '#f4f4f9', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', color: '#2c3e50' }}>🎯 Logbook v2.0</h2>
      <p style={{ textAlign: 'center', color: '#7f8c8d', fontSize: '14px', marginBottom: '25px' }}>Acesso Seguro à Nuvem</p>

      {erro && <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '13px', textAlign: 'center' }}>{erro}</div>}

      <form onSubmit={lidarComAutenticacao}>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold', color: '#555' }}>E-mail:</label>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold', color: '#555' }}>Senha:</label>
        <input type="password" required value={senha} onChange={e => setSenha(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
        <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', marginBottom: '10px' }}>
          {modoCadastro ? 'Criar Nova Conta' : 'Entrar com E-mail'}
        </button>
      </form>

      <button onClick={loginComGoogle} style={{ width: '100%', padding: '12px', backgroundColor: '#fff', color: '#757575', border: '1px solid #ccc', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{width: '18px'}} />
        Entrar com Google
      </button>

      {redeBloqueada && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '1px solid #ffeeba', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#856404', marginBottom: '10px', fontWeight: 'bold' }}>⚠️ Bloqueio de Rede Detectado</p>
          <button onClick={forcarLoginOffline} style={{ width: '100%', padding: '10px', backgroundColor: '#e67e22', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>Acessar Modo Offline (Dev)</button>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button type="button" onClick={() => { setModoCadastro(!modoCadastro); setErro(''); }} style={{ background: 'none', border: 'none', color: '#2980b9', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px' }}>
          {modoCadastro ? 'Já tenho conta. Fazer Login.' : 'Não tenho conta. Criar agora.'}
        </button>
      </div>
    </div>
  );
}