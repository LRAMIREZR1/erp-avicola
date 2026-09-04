# ERP Avícola Doña Idelia



Panel interno de gestión: clientes, stock, productos y pedidos.

Para poner esto en marcha (Supabase, GitHub, Vercel) sigue **[SETUP.md](./SETUP.md)** paso a paso.

## Desarrollo local

```bash
npm install
cp .env.local.example .env.local   # y completa con tus datos de Supabase
npm run dev
```

## Stack

- [Next.js](https://nextjs.org) (App Router)
- [Supabase](https://supabase.com) (base de datos Postgres + autenticación)
- [Vercel](https://vercel.com) (hosting)
- [Tailwind CSS](https://tailwindcss.com) (estilos)
