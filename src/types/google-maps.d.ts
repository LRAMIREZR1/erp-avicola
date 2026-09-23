// Declaraciones mínimas para el subconjunto de la API de Google Maps
// JavaScript que usa MapaCliente.tsx. El script se carga desde el CDN de
// Google en tiempo de ejecución (ver ese componente), no como paquete npm —
// por eso no hay @types/google.maps instalado. Este archivo le basta a
// TypeScript para tipar ese uso puntual sin agregar una dependencia nueva
// (evita tener que regenerar package-lock.json a mano).

declare namespace google.maps {
  interface LatLngLiteral {
    lat: number;
    lng: number;
  }

  interface LatLng {
    lat(): number;
    lng(): number;
  }

  interface MapMouseEvent {
    latLng: LatLng | null;
  }

  interface MapOptions {
    center: LatLngLiteral;
    zoom: number;
  }

  class Map {
    constructor(mapDiv: HTMLElement, opts?: MapOptions);
    panTo(latLng: LatLngLiteral): void;
    setZoom(zoom: number): void;
    addListener(eventName: "click", handler: (event: MapMouseEvent) => void): void;
  }

  interface MarkerOptions {
    position: LatLngLiteral;
    map: Map;
    draggable?: boolean;
  }

  class Marker {
    constructor(opts: MarkerOptions);
    setPosition(latLng: LatLngLiteral): void;
    getPosition(): LatLng | null;
    addListener(eventName: "dragend", handler: () => void): void;
  }

  interface GeocoderRequest {
    address: string;
  }

  interface GeocoderResult {
    geometry: {
      location: LatLng;
    };
  }

  type GeocoderStatus =
    | "OK"
    | "ZERO_RESULTS"
    | "OVER_QUERY_LIMIT"
    | "REQUEST_DENIED"
    | "INVALID_REQUEST"
    | "UNKNOWN_ERROR"
    | "ERROR";

  class Geocoder {
    geocode(
      request: GeocoderRequest,
      callback: (results: GeocoderResult[] | null, status: GeocoderStatus) => void,
    ): void;
  }
}

interface Window {
  google?: typeof google;
}
