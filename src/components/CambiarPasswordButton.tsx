"use client";

import { useState, useTransition } from "react";
import { cambiarPasswordUsuario } from "@/app/admin/usuarios/actions";

function generarPassword() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let resultado = "";
  for (let i = 0; i < 10; i++) {
    resultado += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return resultado;
}

export default function CambiarPasswordButton({ vendedorId }: { vendedorId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "ok"; texto: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    const passwordNueva = password;
    startTransition(async () => {
      const resultado = await cambiarPasswordUsuario(vendedorId, passwordNueva);
      if ("error" in resultado) {
        setMensaje({ tipo: "error", texto: resultado.error });
      } else {
        setMensaje({ tipo: "ok", texto: `Nueva contraseña: ${passwordNueva}` });
        setPassword("");
      }
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs font-medium text-amber-700 hover:underline"
      >
        Cambiar contraseña
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-1">
        <input
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="nueva contraseña"
          className="w-32 rounded-lg border border-stone-300 px-2 py-1 font-mono text-xs focus:border-amber-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setPassword(generarPassword())}
          className="whitespace-nowrap rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
        >
          Generar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-700 px-2 py-1 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-60"
        >
          {pending ? "…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setMensaje(null);
            setPassword("");
          }}
          className="text-xs text-stone-400 hover:text-stone-600"
        >
          Cancelar
        </button>
      </form>
      {mensaje && (
        <p className={`text-xs ${mensaje.tipo === "error" ? "text-red-600" : "text-green-700"}`}>
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}
