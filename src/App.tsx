import React, { useState, useEffect } from 'react';
import { auth, googleProvider } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  onAuthStateChanged,
  type User 
} from 'firebase/auth';
import LogbookApp from './LogbookApp';

export default function App() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [modoCadastro] = useState(false);
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
      if (modoCadastro) await createUserWithEmailAndPassword(auth, email, senha);
      else await signInWithEmailAndPassword(auth, email, senha);
    } catch (error: any) {
      setErro('Erro na autenticação. Verifique seus dados.');
    }
  };

  const loginComGoogle = async () => {
    try { 
      await signInWithPopup(auth, googleProvider); 
    } 
    catch (error) { 
      setErro('Erro ao fazer login com o Google.'); 
      console.error(error);
    }
  };

  if (carregando) return <div style={{textAlign: 'center', marginTop: '50px'}}>Carregando...</div>;

  if (usuario) {
    return <LogbookApp />;
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: '20px', maxWidth: '400px', margin: '50px auto' }}>
      <h2 style={{ textAlign: 'center' }}>🎯 Logbook v2.0</h2>
      {erro && <div style={{ color: 'red', textAlign: 'center', marginBottom: '10px' }}>{erro}</div>}
      <form onSubmit={lidarComAutenticacao}>
        <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
        <input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
        <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>{modoCadastro ? 'Criar Conta' : 'Entrar'}</button>
      </form>
      <button onClick={loginComGoogle} style={{ width: '100%', padding: '10px', marginTop: '10px', backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Entrar com Google</button>
    </div>
  );
}