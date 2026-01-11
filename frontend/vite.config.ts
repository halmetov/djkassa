import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const host = process.env.VITE_HOST || "0.0.0.0";
  const port = Number(process.env.VITE_PORT || 8080);

<<<<<<< HEAD
  return {
    appType: "spa",
    server: {
      host,
      port,
      strictPort: true,
      hmr: {
        protocol: "ws",
        host: "localhost",
        port,
      },
=======
    return {
      appType: "spa",
      server: {
        host: HOST,         // фиксируем хост
        port: PORT,         // фиксируем порт
        strictPort: true,   // если порт занят — не прыгать на другой, а упасть с ошибкой
      // при работе по LAN иногда полезно:
      // hmr: { host: HOST, clientPort: PORT },
>>>>>>> e4494f3fb22711ac05788128b3a97ef4ae0dbcb1
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});





















// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react-swc";
// import path from "path";
// import { componentTagger } from "lovable-tagger";
//
// // https://vitejs.dev/config/
// export default defineConfig(({ mode }) => ({
//   server: {
//     host: "::",
//     port: 8080,
//   },
//   plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
//   resolve: {
//     alias: {
//       "@": path.resolve(__dirname, "./src"),
//     },
//   },
// }));
