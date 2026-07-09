import axios from "axios";

const API = axios.create({
  baseURL: "https://suraksha-emergency-4.onrender.com/api",
});

export default API;