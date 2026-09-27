"use client";

import { useState, useTransition } from "react";
import { crearUsuario } from "@/app/admin/usuarios/actions";
import { NOMBRES_ROL, type Rol } from "@/lib/supabase/types";

const ROLES: Rol[] = ["vendedor", "encargado_bodega", "repartidor", "administrador"];

function generarPassword() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let resultado = "";
  for (let i = 0; i < 10; i++) {
    resultado += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return resultado;
}

export default function CrearUsuarioForm() {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("vendedor");
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "ok"; texto: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function limpiar() {
    setNombre("");
    setEmail("");
    setPassword("");
    setRol("vendedor");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    const passwordCreada = password;
    startTransition(async () => {
      const resultado = await crearUsuario({ nombre, email, password, rol });
      if ("error" in resultado) {
        setMensaje({ tipo: "error", texto: resultado.error });
      } else {
        setMensaje({
          tipo: "ok",
          texto: `Usuario creado. Contraseña inicial: ${passwordCreada} (compártesela ahora, no queda guardada acá).`,
        });
        limpiar();
      }
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
      >
        + Crear usuario
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full space-y-3 rounded-2xl border border-stone-200 bg-white p-4 sm:max-w-lg"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-stone-700">Crear usuario</p>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setMensaje(null);
          }}
          className="text-sm text-stone-400 hover:text-stone-600"
        >
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Nombre</label>
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Correo</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Perfil</label>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as Rol)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {NOMBRES_ROL[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">
            Contraseña inicial
          </label>
          <div className="flex gap-2">
            <input
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm focus:border-amber-600 focus:outline-none"
              placeholder="mínimo 6 caracteres"
            />
            <button
              type="button"
              onClick={() => setPassword(generarPassword())}
              className="whitespace-nowrap rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-100"
            >
              Generar
            </button>
          </div>
        </div>
      </div>

      {mensaje && (
        <p className={`text-sm ${mensaje.tipo === "error" ? "text-red-600" : "text-green-700"}`}>
          {mensaje.texto}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear usuario"}
      </button>
      <p className="text-xs text-stone-400">
        Comparte la contraseña inicial directamente con la persona (por ejemplo por WhatsApp);
        el sistema no la vuelve a mostrar después de este paso.
      </p>
    </form>
  );
}
