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
}: MapaClienteProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const [scriptListo, setScriptListo] = useState(false);
  const [buscando, setBuscando] = useState(false);
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
  }, []);

  // Inicializa el mapa una sola vez, apenas el script de Google termina de
  // cargar (no depende de "coords" ni "colocarMarcador" para no reconstruir
  // el mapa cada vez que cambia el punto).
  useEffect(() => {
    const g = window.google;
    if (!scriptListo || !g || !contenedorRef.current || mapaRef.current) return;

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

  return (
    <div>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&v=weekly`}
        strategy="afterInteractive"
        onLoad={() => setScriptListo(true)}
      />

      <label className="mb-1 block text-sm font-medium text-stone-700">
        Ubicación en el mapa (para el reparto)
      </label>
      <p className="mb-2 text-xs text-stone-500">
        Busca la dirección escrita arriba, o haz clic en el mapa / arrastra el
        pin para ajustar el punto exacto de entrega.
      </p>

      <button
        type="button"
        onClick={buscarDireccion}
        disabled={buscando || !scriptListo}
        className="mb-2 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
      >
        {buscando ? "Buscando…" : "Buscar dirección en el mapa"}
      </button>

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
