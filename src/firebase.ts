import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCvolSsSxwZRLKUOTaB1w6o9jMdR-m3uL0",
  authDomain: "logbook-de-tiro.firebaseapp.com",
  projectId: "logbook-de-tiro",
  storageBucket: "logbook-de-tiro.firebasestorage.app",
  messagingSenderId: "1042557557631",
  appId: "1:1042557557631:web:f120812c7bd0b77bd5584a"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta a Autenticação e o Banco de Dados para usarmos no app
export const auth = getAuth(app);
export const db = getFirestore(app);