import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function MatiereConfig() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/matieres/classe", { replace: true }); }, [navigate]);
  return null;
}
