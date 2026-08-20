import React, { useState, useEffect } from 'react';
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
}