import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";       
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext";
import { store } from "./store";                
import "./index.css";
import App from "./App.jsx";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    
    <Provider store={store}>
      <GoogleOAuthProvider clientId={googleClientId}>
  
        <AuthProvider>
          <App />
        </AuthProvider>
      </GoogleOAuthProvider>
    </Provider>
  </StrictMode>
);
