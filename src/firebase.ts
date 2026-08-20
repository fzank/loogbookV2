import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Suas novas chaves do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCvolSsSxwZRLKUOTaB1w6o9jMdR-m3uL0",
  authDomain: "logbook-de-tiro.firebaseapp.com", 
  projectId: "logbook-de-tiro",
  storageBucket: "logbook-de-tiro.firebasestorage.app",
  messagingSenderId: "1042557557631",
  appId: "1:1042557557631:web:ca5eb8b0ff4baafdd5584a"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta as ferramentas para o App e LogbookApp conseguirem usar (Isso estava faltando!)
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);