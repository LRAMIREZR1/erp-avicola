"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

// Centro por defecto del mapa cuando el cliente todavía no tiene un punto
// cargado: Talca, la ciudad más grande de la zona donde reparte Doña Idelia.
const CENTRO_POR_DEFECTO: google.maps.LatLngLiteral = { lat: -35.4264, lng: -71.6554 };

interface MapaClienteProps {
  // id del <input> de texto "Dirección" del mismo formulario: se lee su
  // valor al presionar "Buscar dirección", en vez de duplicar ese estado.
  direccionInputId: string;
  latitudInicial?: number | null;
  longitudInicial?: number | null;
  // Opcional: se llama cada vez que cambia el punto (buscar, arrastrar o
  // clic en el mapa). Los <input type="hidden"> ya alcanzan para un <form>
  // normal (como ClienteForm), pero un formulario que arma su propio
  // FormData a mano (como el modal de "+ Crear cliente" dentro de un
  // pedido) necesita enterarse del cambio para incluirlo él mismo.
  onCambiarUbicacion?: (lat: number, lng: number) => void;
}

// Intenta sacar un par de coordenadas (latitud, longitud) de un texto
// pegado a mano: un link de Google Maps ("...@-35.123,-71.456,17z",
// ".../?q=-35.123,-71.456") o las coordenadas sueltas tal como quedan al
// copiar una ubicación compartida por WhatsApp ("-35.123, -71.456"). No
// funciona con links cortos (maps.app.goo.gl/xxxx), porque esos no traen
// las coordenadas a la vista en el texto — hay que abrirlos primero en el
// navegador y copiar el link completo (o las coordenadas) desde ahí.
function extraerCoordenadas(texto: string): google.maps.LatLngLiteral | null {
  const match = texto.match(/(-?\d{1,3}(?:\.\d+))\s*,\s*(-?\d{1,3}(?:\.\d+))/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// Mapa para ubicar el punto exacto de entrega de un cliente: busca la
// dirección escrita arriba con el Geocoder de Google, y deja mover el pin a
// mano (arrastrándolo o haciendo clic en otro punto del mapa) para ajustarlo.
// Guarda el resultado en dos <input type="hidden"> (latitud/longitud) que
// viajan con el resto del formulario al guardar el cliente.
export default function MapaCliente({
  direccionInputId,
  latitudInicial,
  longitudInicial,
  onCambiarUbicacion,
}: MapaClienteProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const [scriptListo, setScriptListo] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);
  const [textoPegado, setTextoPegado] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<google.maps.LatLngLiteral | null>(
    latitudInicial != null && longitudInicial != null
      ? { lat: latitudInicial, lng: longitudInicial }
      : null,
  );

  const colocarMarcador = useCallback((pos: google.maps.LatLngLiteral) => {
    const mapa = mapaRef.current;
    const g = window.google;
    if (!mapa || !g) return;

    if (markerRef.current) {
      markerRef.current.setPosition(pos);
    } else {
      const marker = new g.maps.Marker({ position: pos, map: mapa, draggable: true });
      // El pin se puede arrastrar para corregir el punto exacto sin tener
      // que volver a buscar la dirección.
      marker.addListener("dragend", () => {
        const p = marker.getPosition();
        if (p) setCoords({ lat: p.lat(), lng: p.lng() });
      });
      markerRef.current = marker;
    }
    mapa.panTo(pos);
    setCoords(pos);
    onCambiarUbicacion?.(pos.lat, pos.lng);
  }, [onCambiarUbicacion]);

  // Inicializa el mapa una sola vez, apenas el script de Google termina de
  // cargar (no depende de "coords" ni "colocarMarcador" para no reconstruir
  // el mapa cada vez que cambia el punto).
  useEffect(() => {
    const g = window.google;
    if (!scriptListo || !g || !contenedorRef.current || mapaRef.current) return;

    // Red de seguridad: si por lo que sea Google todavía no dejó listo
    // "Map" (por ejemplo un corte de conexión a mitad de carga), se avisa
    // con un mensaje en vez de tirar un error sin capturar que se lleve
    // abajo toda la página.
    try {
      const centro = coords ?? CENTRO_POR_DEFECTO;
      const mapa = new g.maps.Map(contenedorRef.current, {
        center: centro,
        zoom: coords ? 16 : 12,
      });
      mapaRef.current = mapa;
      geocoderRef.current = new g.maps.Geocoder();

      if (coords) colocarMarcador(coords);

      mapa.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        colocarMarcador({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });
    } catch (err) {
      console.error("No se pudo iniciar el mapa de Google:", err);
      // El aviso se muestra en un microtask aparte (no llamando a setError
      // directo acá) para no actualizar el estado de forma síncrona dentro
      // del efecto.
      queueMicrotask(() => {
        setError(
          "No se pudo cargar el mapa. Puedes seguir sin ubicar el punto, o recarga la página e intenta de nuevo."
        );
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptListo]);

  function buscarDireccion() {
    const input = document.getElementById(direccionInputId) as HTMLInputElement | null;
    const direccion = input?.value.trim();
    if (!direccion) {
      setError("Escribe la dirección arriba antes de buscarla");
      return;
    }
    if (!geocoderRef.current) return;

    setBuscando(true);
    setError(null);
    geocoderRef.current.geocode({ address: `${direccion}, Chile` }, (resultados, status) => {
      setBuscando(false);
      if (status === "OK" && resultados && resultados[0]) {
        const loc = resultados[0].geometry.location;
        colocarMarcador({ lat: loc.lat(), lng: loc.lng() });
        mapaRef.current?.setZoom(17);
      } else {
        setError(
          "No se encontró esa dirección. Ubica el punto a mano haciendo clic en el mapa.",
        );
      }
    });
  }

  // Usa el GPS del celular/computador para ubicar el punto — pensado para
  // cuando ya estás en terreno haciendo el reparto y quieres dejar guardada
  // tu posición actual como el punto de entrega del cliente (útil sobre
  // todo para clientes en el campo, sin una dirección formal).
  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setError("Este navegador no permite obtener la ubicación actual.");
      return;
    }
    setObteniendoUbicacion(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setObteniendoUbicacion(false);
        colocarMarcador({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        mapaRef.current?.setZoom(17);
      },
      (err) => {
        setObteniendoUbicacion(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "No diste permiso para usar tu ubicación. Revisa los permisos de ubicación del navegador para este sitio e intenta de nuevo."
            : "No se pudo obtener tu ubicación. Intenta de nuevo, o ubica el punto a mano haciendo clic en el mapa."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Para cuando el cliente manda su ubicación por WhatsApp: se comparte esa
  // ubicación a este número/chat, se copia el texto o el link que queda, y
  // se pega acá.
  function usarUbicacionPegada() {
    const punto = extraerCoordenadas(textoPegado);
    if (!punto) {
      setError(
        "No encontré coordenadas en eso. Si es un link corto (maps.app.goo.gl), ábrelo primero en el navegador y copia el link completo o las coordenadas."
      );
      return;
    }
    setError(null);
    colocarMarcador(punto);
    mapaRef.current?.setZoom(17);
    setTextoPegado("");
  }

  return (
    <div>
      <Script
        // Sin "loading=async": ese modo hace que Google cargue las clases
        // (Map, Marker, Geocoder) de a poco, en segundo plano, y no
        // garantiza que ya estén listas apenas el script termina de
        // cargar — por eso a veces al abrir el mapa tiraba "Map is not a
        // constructor" y hacía caerse la página (en el celular se veía
        // como "This page couldn't load"). El código de acá abajo usa
        // "new google.maps.Map(...)" directo, así que necesita el modo
        // clásico (sin loading=async), donde todo queda disponible de
        // una sola vez.
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&v=weekly`}
        strategy="afterInteractive"
        // onReady (no onLoad): onLoad solo se dispara la primera vez que el
        // script termina de cargar en el navegador. Si el visitante ya había
        // pasado por otra pantalla que cargó Google Maps y vuelve a este
        // formulario, el script ya está listo pero un "onLoad" nunca vuelve a
        // dispararse para este nuevo montaje del componente — el botón
        // quedaba deshabilitado para siempre. onReady sí se dispara también
        // cuando el script ya estaba cargado de antes.
        onReady={() => setScriptListo(true)}
      />

      <label className="mb-1 block text-sm font-medium text-stone-700">
        Ubicación en el mapa (para el reparto)
      </label>
      <p className="mb-2 text-xs text-stone-500">
        Busca la dirección escrita arriba, usa tu ubicación actual, pega la
        que te haya mandado el cliente por WhatsApp, o haz clic en el mapa /
        arrastra el pin — lo que sea más fácil para ajustar el punto exacto
        de entrega.
      </p>

      <div className="mb-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={buscarDireccion}
          disabled={buscando || !scriptListo}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
        >
          {buscando ? "Buscando…" : "Buscar dirección en el mapa"}
        </button>
        <button
          type="button"
          onClick={usarMiUbicacion}
          disabled={obteniendoUbicacion || !scriptListo}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
        >
          {obteniendoUbicacion ? "Obteniendo tu ubicación…" : "📍 Usar mi ubicación actual"}
        </button>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <input
          type="text"
          value={textoPegado}
          onChange={(e) => setTextoPegado(e.target.value)}
          placeholder="Pega acá el link o las coordenadas que te mandó el cliente por WhatsApp"
          className="min-w-[240px] flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-amber-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={usarUbicacionPegada}
          disabled={!textoPegado.trim() || !scriptListo}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
        >
          Usar esta ubicación
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div
        ref={contenedorRef}
        className="h-64 w-full overflow-hidden rounded-lg border border-stone-300 bg-stone-100"
      />

      {coords ? (
        <p className="mt-2 text-xs text-stone-500">
          Punto guardado: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
        </p>
      ) : (
        <p className="mt-2 text-xs text-stone-400">
          Aún no hay un punto ubicado para este cliente
        </p>
      )}

      <input type="hidden" name="latitud" value={coords?.lat ?? ""} />
      <input type="hidden" name="longitud" value={coords?.lng ?? ""} />
    </div>
  );
}
