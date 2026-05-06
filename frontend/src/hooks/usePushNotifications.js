// src/hooks/usePushNotifications.js
import { useEffect } from 'react';
import { getToken } from 'firebase/messaging';
import { messaging } from '../firebase';
import { authApi } from '../api/auth';

export const usePushNotifications = (user) => {
  useEffect(() => {
    const fetchToken = async () => {
      
      if (!user || !user.id) return;

      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const currentToken = await getToken(messaging, {
            vapidKey: "BMM0d9-RZe3qtv8Z6eUdKvkr6pvPOJPjVgYtDXeRrfNU7Uwf6ao3xVLCYCmftP9hR6qgxr3u9ZlfIyOsSMdSEFU" 
          });

          if (currentToken) {
            console.log("fcf",currentToken)
            // Use the user's email or unique ID as the session_id
            await authApi.registerFcmToken(user.id, currentToken);
            console.log("FCM Token synced for:", user.id);
          }
        }
      } catch (err) {
        console.error("Notification setup failed:", err);
      }
    };

    fetchToken();
  }, [user]); 
};