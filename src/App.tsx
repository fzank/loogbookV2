import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import LogbookApp from './LogbookApp';

export default function App() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  
  // Estados do Formulário de Login
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [modoCadastro, setModoCadastro] = useState(false);
  const [erro, setErro] = useState('');

  // Fica escutando se o usuário está logado ou não
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
      if (error.code === 'auth/invalid-credential') setErro('E-mail ou senha incorretos.');
      else if (error.code === 'auth/email-already-in-use') setErro('Este e-mail já está cadastrado.');
      else if (error.code === 'auth/weak-password') setErro('A senha deve ter pelo menos 6 caracteres.');
      else setErro('Ocorreu um erro na autenticação. Verifique seus dados.');
    }
  };

  const fazerLogout = () => {
    signOut(auth);
  };

  if (carregando) {
    return <div style={{textAlign: 'center', marginTop: '50px', fontFamily: 'system-ui'}}>Carregando sistema...</div>;
  }

  // Se estiver logado, exibe o aplicativo completo passando a função de logout
  if (usuario) {
    return (
      <>
        {/* Um botão flutuante de logout para segurança */}
        <button 
          onClick={fazerLogout}
          style={{
            position: 'fixed', top: '15px', left: '15px', zIndex: 1000, 
            backgroundColor: '#e74c3c', color: 'white', border: 'none', 
            borderRadius: '4px', padding: '5px 10px', fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          Sair
        </button>
        <LogbookApp usuarioLogout={fazerLogout} />
      </>
    );
  }

  // Se NÃO estiver logado, exibe a tela de login profissional
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '20px', maxWidth: '400px', margin: '50px auto', backgroundColor: '#f4f4f9', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', color: '#2c3e50' }}>🎯 Logbook de Tiro v2.0</h2>
      <p style={{ textAlign: 'center', color: '#7f8c8d', fontSize: '14px', marginBottom: '25px' }}>
        Acesso Seguro à Nuvem (CAC)
      </p>

      {erro && (
        <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '13px', textAlign: 'center' }}>
          {erro}
        </div>
      )}

      <form onSubmit={lidarComAutenticacao}>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold', color: '#555' }}>E-mail:</label>
        <input 
          type="email" 
          required 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }} 
        />

        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold', color: '#555' }}>Senha:</label>
        <input 
          type="password" 
          required 
          value={senha} 
          onChange={e => setSenha(e.target.value)} 
          style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }} 
        />

        <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>
          {modoCadastro ? 'Criar Nova Conta' : 'Entrar no Acervo'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button 
          type="button" 
          onClick={() => { setModoCadastro(!modoCadastro); setErro(''); }} 
          style={{ background: 'none', border: 'none', color: '#2980b9', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px' }}
        >
          {modoCadastro ? 'Já tenho uma conta. Fazer Login.' : 'Ainda não tenho conta. Criar uma agora.'}
        </button>
      </div>
    </div>
  );
}