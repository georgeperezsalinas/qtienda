"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

interface Props {
  label?: string;
  mode?: "vendor" | "buyer";
}

export default function FacebookLoginButton({
  label = "Continuar con Facebook",
  mode = "vendor",
}: Props) {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);

  if (!process.env.NEXT_PUBLIC_FACEBOOK_APP_ID) return null;

  const endpoint = mode === "buyer" ? "/auth/facebook-buyer" : "/auth/facebook";

  const handleClick = () => {
    if (!window.FB) {
      toast.error("Facebook aún no está listo, intenta de nuevo en un momento");
      return;
    }

    // El SDK de Facebook rechaza callbacks `async` ("Expression is of type
    // asyncfunction, not function"), por eso el callback es sync y delega
    // el trabajo async a una función interna.
    const onFbResponse = (response: any) => {
      if (!response.authResponse?.accessToken) {
        toast.error("Inicio con Facebook cancelado");
        return;
      }
      void handleFbLogin(response.authResponse.accessToken);
    };

    const handleFbLogin = async (accessToken: string) => {
      setLoading(true);
      try {
        const { data } = await apiClient.post(endpoint, { access_token: accessToken });
        setTokens(data.access_token, data.refresh_token);
        const { data: me } = await apiClient.get("/auth/me", {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        setUser(me);
        toast.success("¡Bienvenido!");
        if (me.role === "admin")       router.push("/admin");
        else if (me.role === "buyer")  router.push("/mis-pedidos");
        else                           router.push("/dashboard");
      } catch (err: any) {
        toast.error(err.response?.data?.detail || "Error al iniciar con Facebook");
      } finally {
        setLoading(false);
      }
    };

    window.FB.login(onFbResponse, { scope: "email,public_profile" });
  };

  return (
    <button
      type="button"
      className="btn-social"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? <Spinner /> : <FacebookIcon />}
      {loading ? "Conectando..." : label}
    </button>
  );
}
