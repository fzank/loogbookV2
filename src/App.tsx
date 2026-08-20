import { useState, useEffect } from 'react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, onAuthStateChanged, type User } from 'firebase/auth';
import LogbookApp from './LogbookApp';

export default function App() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => { 
      setUsuario(user); 
      setCarregando(false); 
    });
    return unsubscribe;
  }, []);

  const loginComGoogle = async () => {
    setErro('');
    try { 
      await signInWithPopup(auth, googleProvider); 
    } 
    catch (error: any) { 
      console.error("Erro no login:", error);
      setErro(`Falha na autenticação: ${error.message || 'Erro desconhecido'}`);
    }
  };

  if (carregando) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'system-ui' }}>
        Carregando autenticação...
      </div>
    );
  }

  if (usuario) {
    return <LogbookApp />;
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: '20px', maxWidth: '400px', margin: '50px auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>🎯 Logbook v2.0</h2>
      
      {erro && (
        <div style={{ color: '#e74c3c', backgroundColor: '#fdedec', padding: '10px', borderRadius: '6px', textAlign: 'center', marginBottom: '15px', fontSize: '13px' }}>
          {erro}
        </div>
      )}

      <button 
        onClick={loginComGoogle} 
        style={{ width: '100%', padding: '12px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
      >
        <span>🌐</span> Entrar com Google
      </button>
    </div>
  );
}import { useState, useEffect } from 'react';
import { auth, googleProvider } from './firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  type User 
} from 'firebase/auth';
import LogbookApp from './LogbookApp';

export default function App() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [modoCadastro, setModoCadastro] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => { 
      setUsuario(user); 
      setCarregando(false); 
    });
    return unsubscribe;
  }, []);

  const lidarComAutenticacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    try {
      if (modoCadastro) {
        await createUserWithEmailAndPassword(auth, email, senha);
      } else {
        await signInWithEmailAndPassword(auth, email, senha);
      }
    } catch (error: any) {
      console.error(error);
      setErro('Erro na autenticação. Verifique e-mail e senha.');
    }
  };

  const loginComGoogle = async () => {
    setErro('');
    try { 
      await signInWithPopup(auth, googleProvider); 
    } 
    catch (error: any) { 
      console.error("Erro no login:", error);
      setErro(`Falha na autenticação: ${error.message || 'Erro desconhecido'}`);
    }
  };

  if (carregando) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'system-ui' }}>
        Carregando autenticação...
      </div>
    );
  }

  if (usuario) {
    return <LogbookApp />;
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: '20px', maxWidth: '400px', margin: '50px auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>🎯 Logbook v2.0</h2>
      
      {erro && (
        <div style={{ color: '#e74c3c', backgroundColor: '#fdedec', padding: '10px', borderRadius: '6px', textAlign: 'center', marginBottom: '15px', fontSize: '13px' }}>
          {erro}
        </div>
      )}

      <form onSubmit={lidarComAutenticacao}>
        <input 
          type="email" 
          placeholder="Seu E-mail" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} 
          required 
        />
        <input 
          type="password" 
          placeholder="Sua Senha (mín. 6 caracteres)" 
          value={senha} 
          onChange={e => setSenha(e.target.value)} 
          style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} 
          required 
        />
        <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>
          {modoCadastro ? 'Criar Nova Conta' : 'Entrar com E-mail'}
        </button>
      </form>
      
      <div style={{ textAlign: 'center', marginTop: '15px' }}>
        <button onClick={() => {setModoCadastro(!modoCadastro); setErro('');}} style={{ background: 'none', border: 'none', color: '#2980b9', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>
          {modoCadastro ? 'Já tenho uma conta. Fazer Login.' : 'Ainda não tem conta? Crie aqui.'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', margin: '25px 0' }}>
         <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }} />
         <span style={{ margin: '0 10px', color: '#7f8c8d', fontSize: '12px' }}>OU</span>
         <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }} />
      </div>

      <button 
        onClick={loginComGoogle} 
        style={{ width: '100%', padding: '12px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
      >
        <span>🌐</span> Entrar com Google
      </button>
    </div>
  );
}