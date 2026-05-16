import { useEffect } from 'react';
import { getToken } from 'firebase/messaging';
import { messaging } from '../firebase';
import { authApi } from '../api/auth';

export const usePushNotifications = (user, sessionId) => {
  useEffect(() => {
    const fetchToken = async () => {
      if (!user || !user.email) return;   // need email, not sessionId

      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const currentToken = await getToken(messaging, {
          vapidKey: "BMM0d9-RZe3qtv8Z6eUdKvkr6pvPOJPjVgYtDXeRrfNU7Uwf6ao3xVLCYCmftP9hR6qgxr3u9ZlfIyOsSMdSEFU"
        });

        if (currentToken) {
          // Store token keyed by email — one record per user, not per session
          await authApi.registerFcmToken(user.email, currentToken);
          console.log("[FCM] Token stored for", user.email);
        }
      } catch (err) {
        console.error("[FCM] Setup failed:", err);
      }
    };

    fetchToken();
  }, [user?.email]);   // only re-run if email changes, not every new session
};