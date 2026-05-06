import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyA7s71oWuQ4v8A_pNK8Y-VpQu-j_sZI1_I",
  authDomain: "aion-notification-21bb3.firebaseapp.com",
  projectId: "aion-notification-21bb3",
  storageBucket: "aion-notification-21bb3.firebasestorage.app",
  messagingSenderId: "172085848088",
  appId: "1:172085848088:web:18305c5b51bc55a60bbb6d"
};

const app = initializeApp(firebaseConfig);
// Export messaging so we can use it in our hooks
export const messaging = getMessaging(app);