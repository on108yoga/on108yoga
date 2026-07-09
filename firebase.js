<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyBKdaTk43A3Hp00b7gURWl7fejoAYzOkBI",
    authDomain: "on108-yoga.firebaseapp.com",
    projectId: "on108-yoga",
    storageBucket: "on108-yoga.firebasestorage.app",
    messagingSenderId: "852225153853",
    appId: "1:852225153853:web:e61f918ff4e0dacfac4354",
    measurementId: "G-7X1ELMNKXC"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>
