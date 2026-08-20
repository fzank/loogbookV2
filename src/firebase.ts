import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCvolSsSxwZRLKUOTaB1w6o9jMdR-m3uL0",
  authDomain: "logbook-de-tiro.firebaseapp.com",
  projectId: "logbook-de-tiro",
  storageBucket: "logbook-de-tiro.firebasestorage.app",
  messagingSenderId: "1042557557631",
  appId: "1:1042557557631:web:ca5eb8b0ff4baafdd5584a"
};

// Se o app não existe, ele cria. Se já existe na memória, ele apenas reaproveita.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);