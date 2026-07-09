import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function SOS() {
  const navigate = useNavigate();
  useEffect(() => {
    // Preserve previous behaviour: redirect /sos to /dashboard
    navigate("/dashboard", { replace: true });
  }, [navigate]);
  return null;
}
