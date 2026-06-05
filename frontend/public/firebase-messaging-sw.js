/* global importScripts, firebase */

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA7s71oWuQ4v8A_pNK8Y-VpQu-j_sZI1_I",
  messagingSenderId: "172085848088",
  appId: "1:172085848088:web:18305c5b51bc55a60bbb6d",
  projectId: "aion-notification-21bb3",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png' 
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
